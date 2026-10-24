// Missions du mode Challenge : 3 groupes de 9 missions. Chaque partie tire au hasard une variante de chaque mission.
// mission : { title, tag, intro, task, lab (options du labo), circuit (montage de départ),
//             panel : { kind: 'schema' | 'spec' | 'table', ... }, criteria : [{ text, test(h) }] (missions à construire) }
// h : outils de vérification (voir helpers) ; « fonctionne normalement » = entre 90 % et 115 % du nominal.
window.ChallengeData = (function () {
  var GROUPS = [
    { name: 'Circuits sympas', info: 'Construis des circuits qui fonctionnent : pas de réglage à gérer, tout marche dès que c\'est bien branché.', malus: 1, points: [10, 12, 15], tags: ['Schéma', 'Cahier des charges', 'Fonctionnement'] },
    { name: 'Circuits réalistes', info: 'Attention aux réglages : le matériel peut casser ou mal fonctionner.', malus: 3, points: [15, 20, 25], tags: ['Réglages', 'Défi', 'Valeurs imposées'] },
    { name: 'Mesures et lois', info: 'Mesure, déduis et construis avec précision grâce aux lois de l\'électricité.', malus: 5, points: [25, 30, 40], tags: ['Mesures', 'Déductions', 'Construction précise'] }
  ];

  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function chance() { return Math.random() < .5; }
  function shuffle(a) {
    a = a.slice();
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  function num(x, d) { return (d == null ? String(+x.toFixed(2)) : x.toFixed(d)).replace('.', ','); }
  var WORD = { lamp: 'lampe', motor: 'moteur', buzzer: 'buzzer', res: 'résistance', led: 'DEL', sw: 'interrupteur', gen: 'générateur' };
  var PREFIX = { lamp: 'L', motor: 'M', buzzer: 'B', res: 'R', led: 'D', sw: 'K', gen: 'G' };
  var ALL_TYPES = ['gen', 'lamp', 'motor', 'buzzer', 'res', 'led', 'sw'];
  var GEN_V = [3, 6, 9, 12];

  /* ================= Outils de vérification ================= */
  function helpers(lab) {
    var sw = lab.names('sw'), cache = {};
    function closedWith(o) { var c = {}; sw.forEach(function (n) { c[n] = true; }); for (var k in o) c[k] = o[k]; return c; }
    function sim(o) { var k = JSON.stringify(o); return cache[k] || (cache[k] = lab.simulate(o)); }
    function one(k, v) { var o = {}; o[k] = v; return o; }
    function base() { return sim({ closed: closedWith({}) }); }
    function combos() {
      var out = [];
      for (var m = 0; m < (1 << sw.length); m++) { var c = {}; sw.forEach(function (n, i) { c[n] = !!(m & (1 << i)); }); out.push(c); }
      return out;
    }
    var h = {
      lab: lab, sw: sw,
      // Dipôles d'un type (et éventuellement d'un réglage)
      names: function (t, opt) { return lab.names(t).filter(function (n) { return opt == null || lab.state(n).opt === opt; }); },
      // État interrupteurs fermés (ou dans une autre situation)
      s: function (n, o) { return (o ? sim(o) : base())[n]; },
      on: function (n) { var s = base()[n]; return !!s && s.on; },
      normal: function (n) { var s = base()[n]; return !!s && !s.broken && s.ratio >= .9 && s.ratio <= 1.15; },
      safe: function (n) { var s = base()[n]; return !!s && !s.broken && s.ratio <= 1.15; },
      // K commande X : X fonctionne interrupteurs fermés et s'arrête quand on ouvre K
      controls: function (K, X) { return h.on(X) && !sim({ closed: closedWith(one(K, false)) })[X].on; },
      // Ouvrir K ne coupe pas Y
      spares: function (K, Y) { return sim({ closed: closedWith(one(K, false)) })[Y].on; },
      // X fonctionne quelle que soit la position des interrupteurs
      always: function (X) { return combos().every(function (c) { var s = sim({ closed: c })[X]; return !!s && s.on; }); },
      // Y continue de fonctionner si on retire (dévisse) X
      survives: function (X, Y) { return sim({ closed: closedWith({}), removed: one(X, true) })[Y].on; },
      rel: function (a, b) { return lab.relation(a, b); }
    };
    return h;
  }
  // Paires et triplets d'éléments distincts
  function pairs(a, b) { var o = []; a.forEach(function (x) { b.forEach(function (y) { if (x !== y) o.push([x, y]); }); }); return o; }
  function triples(a) {
    var o = [];
    for (var i = 0; i < a.length; i++) for (var j = i + 1; j < a.length; j++) for (var k = j + 1; k < a.length; k++) o.push([a[i], a[j], a[k]]);
    return o;
  }
  function allDeriv(h, list) { return pairs(list, list).every(function (p) { return h.rel(p[0], p[1]) === 'derivation'; }); }
  // Au moins n dipôles d'un type (réglage) qui fonctionnent normalement / qui fonctionnent
  function nNormal(h, t, opt, n) { return h.names(t, opt).filter(h.normal).length >= n; }

  /* ================= Groupe 1 : circuits sympas ================= */
  var G1_LAB = {
    nominal: true, fixedTypes: ALL_TYPES, palette: ['gen', 'lamp', 'motor', 'buzzer', 'sw'], stock: { gen: 1 }
  };
  // Noms automatiques L1, M1… selon le type
  function namer() {
    var n = {};
    return function (t) { n[t] = (n[t] || 0) + 1; return PREFIX[t] + n[t]; };
  }
  function rec() { return pick(['lamp', 'motor', 'buzzer']); }
  // Schémas à reproduire : niveau 0 = 1 boucle 1 récepteur, 1 = 1 boucle 2 récepteurs, 2 = 2 boucles 2 récepteurs
  function g1Schema(level) {
    var nm = namer(), G = nm('gen'), hasK = Math.random() < .65, els = [{ name: G, type: 'gen', x: 0, y: 0 }], wires = [];
    var A = { type: rec() }, B = { type: rec() }, K = { type: 'sw' };
    A.name = nm(A.type);
    if (level > 0) B.name = nm(B.type);
    if (hasK) K.name = nm('sw');
    if (level === 0) {
      els.push({ name: A.name, type: A.type, x: 0, y: 160 });
      if (hasK) { els.push({ name: K.name, type: 'sw', x: 140, y: 80, rot: 90 }); wires.push([G + '.1', K.name + '.0'], [K.name + '.1', A.name + '.1']); }
      else wires.push([G + '.1', A.name + '.1']);
      wires.push([A.name + '.0', G + '.0']);
    } else if (level === 1) {
      els.push({ name: A.name, type: A.type, x: -70, y: 160 }, { name: B.name, type: B.type, x: 70, y: 160 });
      wires.push([G + '.0', A.name + '.0'], [A.name + '.1', B.name + '.0']);
      if (hasK) { els.push({ name: K.name, type: 'sw', x: 170, y: 80, rot: 90 }); wires.push([B.name + '.1', K.name + '.1'], [K.name + '.0', G + '.1']); }
      else wires.push([B.name + '.1', G + '.1']);
    } else {
      // Interrupteur dans la branche principale, dans la branche de B, dans les deux ou nulle part
      var where = hasK ? pick(['main', 'branch', 'both']) : 'none', K2 = where === 'both' ? nm('sw') : K.name;
      var main = where === 'main' || where === 'both', inB = where === 'branch' || where === 'both';
      els.push({ name: A.name, type: A.type, x: 0, y: 130 });
      els.push({ name: B.name, type: B.type, x: inB ? -60 : 0, y: 240 });
      wires.push([G + '.0', A.name + '.0'], [A.name + '.0', B.name + '.0']);
      if (main) { els.push({ name: K.name, type: 'sw', x: 150, y: 65, rot: 90 }); wires.push([G + '.1', K.name + '.0'], [K.name + '.1', A.name + '.1']); }
      else wires.push([A.name + '.1', G + '.1']);
      if (inB) { els.push({ name: K2, type: 'sw', x: 70, y: 240 }); wires.push([B.name + '.1', K2 + '.0'], [K2 + '.1', A.name + '.1']); }
      else wires.push([B.name + '.1', A.name + '.1']);
    }
    var count = {};
    els.forEach(function (e) { count[e.type] = (count[e.type] || 0) + 1; });
    var legend = Object.keys(count).map(function (t) { return count[t] + ' ' + WORD[t] + (count[t] > 1 ? 's' : ''); }).join(' · ');
    return { circuit: { els: els, wires: wires }, legend: legend };
  }
  // Le montage de l'élève correspond-il exactement au schéma ? (mêmes dipôles, mêmes relations deux à deux)
  function schemaCriteria(spec) {
    return [
      {
        text: 'Les dipôles du schéma sont tous présents, sans rien de plus',
        test: function (h) {
          return Object.keys(spec.count).every(function (t) { return h.lab.names(t).length === spec.count[t]; }) &&
            ALL_TYPES.every(function (t) { return spec.count[t] || !h.lab.names(t).length; });
        }
      },
      {
        text: 'Les branchements correspondent au schéma',
        test: function (h) { return !!matchSchema(h, spec); }
      },
      {
        text: 'Tous les récepteurs fonctionnent quand les interrupteurs sont fermés',
        test: function (h) { return ['lamp', 'motor', 'buzzer'].every(function (t) { return h.lab.names(t).every(h.on); }); }
      }
    ];
  }
  // Cherche une correspondance (dipôle du schéma → dipôle de l'élève, même type) qui respecte toutes les relations
  function matchSchema(h, spec) {
    var parts = spec.parts, students = {}, used = {};
    ALL_TYPES.forEach(function (t) { students[t] = h.lab.names(t); });
    var map = {};
    function ok() {
      for (var i = 0; i < parts.length; i++) for (var j = i + 1; j < parts.length; j++) {
        var a = parts[i], b = parts[j];
        if ((h.rel(map[a.name], map[b.name]) || null) !== (spec.rel[a.name + '|' + b.name] || null)) return false;
      }
      return true;
    }
    function go(k) {
      if (k === parts.length) return ok();
      var p = parts[k];
      return students[p.type].some(function (n) {
        if (used[n]) return false;
        used[n] = true; map[p.name] = n;
        var r = go(k + 1);
        used[n] = false;
        return r;
      });
    }
    return go(0) ? map : null;
  }
  // Relations deux à deux du schéma modèle (calculées sur un labo invisible)
  function schemaSpec(circuit) {
    return Lab.probe(circuit, function (lab) {
      var parts = circuit.els.map(function (e) { return { name: e.name, type: e.type }; }), rel = {}, count = {};
      parts.forEach(function (p, i) {
        count[p.type] = (count[p.type] || 0) + 1;
        parts.forEach(function (q, j) { if (j > i) rel[p.name + '|' + q.name] = lab.relation(p.name, q.name); });
      });
      return { parts: parts, rel: rel, count: count };
    });
  }

  // Cahiers des charges explicites (missions 4 à 6) et comportements à obtenir (missions 7 à 9)
  function serieOf(h, ta, tb) { return pairs(h.names(ta), h.names(tb)).filter(function (p) { return h.rel(p[0], p[1]) === 'serie'; }); }
  function derivOf(h, ta, tb) { return pairs(h.names(ta), h.names(tb)).filter(function (p) { return h.rel(p[0], p[1]) === 'derivation'; }); }
  function bothCtrl(h, p) { return h.sw.some(function (K) { return h.controls(K, p[0]) && h.controls(K, p[1]); }); }
  function ownSwitch(h, X, others) { return h.sw.some(function (K) { return h.controls(K, X) && others.every(function (Y) { return h.spares(K, Y); }); }); }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function crit(text, test) { return { text: text, test: test }; }
  function spec(list) { return { lines: list.map(function (c) { return c.text; }), criteria: list }; }
  function but(list, x) { var i = list.indexOf(x); return list.filter(function (y, j) { return j !== i; }); }
  function type(h, n) { return h.lab.state(n).type; }

  // Mots pour parler des récepteurs (f : féminin)
  var REC = ['lamp', 'motor', 'buzzer'];
  var SAY = {
    lamp: { un: 'une lampe', le: 'la lampe', les: 'lampes', f: true, act: 'brille', acts: 'brillent', inf: 'briller', starts: 's\'allument', start: 's\'allume', stop: 's\'éteint',
      gone: 'Si l\'une est dévissée', goneOf: 'Si l\'une de ces deux lampes est dévissée', fail: 'Si une lampe grille' },
    motor: { un: 'un moteur', le: 'le moteur', les: 'moteurs', act: 'tourne', acts: 'tournent', inf: 'tourner', starts: 'démarrent', start: 'démarre', stop: 's\'arrête',
      gone: 'Si on débranche l\'un', goneOf: 'Si on débranche l\'un de ces deux moteurs', fail: 'Si un moteur tombe en panne' },
    buzzer: { un: 'un buzzer', le: 'le buzzer', les: 'buzzers', act: 'sonne', acts: 'sonnent', inf: 'sonner', starts: 'se mettent à sonner', start: 'se met à sonner', stop: 's\'arrête',
      gone: 'Si on débranche l\'un', goneOf: 'Si on débranche l\'un de ces deux buzzers', fail: 'Si un buzzer tombe en panne' }
  };
  var NUM = ['zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit'];
  function some(t, n) { return n === 1 ? SAY[t].un : NUM[n] + ' ' + SAY[t].les; }
  // « une lampe, deux moteurs et un buzzer »
  function group(types) {
    var count = {}, order = [];
    types.forEach(function (t) { if (!count[t]) order.push(t); count[t] = (count[t] || 0) + 1; });
    var w = order.map(function (t) { return some(t, count[t]); });
    return w.length > 1 ? w.slice(0, -1).join(', ') + ' et ' + w[w.length - 1] : w[0];
  }
  function fem(types) { return types.every(function (t) { return SAY[t].f; }); }
  function they(types) { return fem(types) ? 'Elles' : 'Ils'; }
  function agree(types, w) { return w + (fem(types) ? 'e' : '') + (types.length > 1 ? 's' : ''); }
  function sorted(types) { return types.slice().sort(function (a, b) { return REC.indexOf(a) - REC.indexOf(b); }); }
  // Triplets de dipôles en dérivation deux à deux dont les types sont exactement « types »
  function trio(h, types) {
    var pool = [];
    types.forEach(function (t) { h.names(t).forEach(function (n) { if (pool.indexOf(n) < 0) pool.push(n); }); });
    return triples(pool).filter(function (t) {
      return t.map(function (n) { return type(h, n); }).sort().join() === types.slice().sort().join() && allDeriv(h, t);
    });
  }

  var G1_SPEC = [
    // 4 : une boucle, deux récepteurs
    function () {
      var a = pick(REC), b = pick(REC), ty = [a, b];
      var list = [
        crit(cap(group(sorted(ty))) + ' ' + agree(ty, 'branché') + ' en série', function (h) { return serieOf(h, a, b).length > 0; }),
        crit(they(ty) + ' fonctionnent quand les interrupteurs sont fermés', function (h) { return serieOf(h, a, b).some(function (p) { return h.on(p[0]) && h.on(p[1]); }); })
      ];
      if (chance()) list.splice(1, 0, crit('Un interrupteur commande les deux', function (h) { return serieOf(h, a, b).some(function (p) { return bothCtrl(h, p); }); }));
      return spec(list);
    },
    // 5 : deux boucles, deux récepteurs
    function () {
      var a = pick(REC), b = pick(REC), ty = [a, b], v = pick(['both', 'own', 'common', 'single']);
      if (v === 'single' && a === b) v = 'common';
      function P(h) { return derivOf(h, a, b); }
      var list = [crit(cap(group(sorted(ty))) + ' ' + agree(ty, 'branché') + ' en dérivation', function (h) { return P(h).length > 0; })];
      if (v === 'both') list.push(crit(they(ty) + ' fonctionnent ' + (fem(ty) ? 'toutes' : 'tous') + ' les deux', function (h) { return P(h).some(function (p) { return h.on(p[0]) && h.on(p[1]); }); }));
      else if (v === 'common') list.push(crit('Un interrupteur commande les deux', function (h) { return P(h).some(function (p) { return bothCtrl(h, p); }); }));
      else if (v === 'single') list.push(
        crit('Un interrupteur commande seulement ' + SAY[a].le, function (h) { return P(h).some(function (p) { return ownSwitch(h, p[0], [p[1]]); }); }),
        crit(cap(SAY[b].le) + ' ' + SAY[b].act + ' tout le temps', function (h) { return P(h).some(function (p) { return ownSwitch(h, p[0], [p[1]]) && h.always(p[1]); }); }));
      else if (a === b) list.push(crit('Chaque ' + SAY[a].les.slice(0, -1) + ' a son propre interrupteur (qui ne coupe pas l\'autre)', function (h) {
        return P(h).some(function (p) { return ownSwitch(h, p[0], [p[1]]) && ownSwitch(h, p[1], [p[0]]); });
      }));
      else list.push(
        crit(cap(SAY[a].le) + ' a son propre interrupteur (qui ne coupe pas ' + SAY[b].le + ')', function (h) { return P(h).some(function (p) { return ownSwitch(h, p[0], [p[1]]); }); }),
        crit(cap(SAY[b].le) + ' a son propre interrupteur (qui ne coupe pas ' + SAY[a].le + ')', function (h) { return P(h).some(function (p) { return ownSwitch(h, p[1], [p[0]]); }); }));
      return spec(list);
    },
    // 6 : trois boucles, trois récepteurs
    function () {
      var ty = sorted([pick(REC), pick(REC), pick(REC)]), v = pick(['own', 'common', 'always']);
      function T(h) { return trio(h, ty); }
      var list = [crit(cap(group(ty)) + ' ' + agree(ty, 'branché') + ' en dérivation', function (h) { return T(h).length > 0; })];
      if (v === 'own') list.push(crit((ty[0] === ty[2] ? 'Chaque ' + SAY[ty[0]].les.slice(0, -1) : 'Chaque récepteur') + ' a son propre interrupteur', function (h) {
        return T(h).some(function (t) { return t.every(function (x) { return ownSwitch(h, x, but(t, x)); }); });
      }));
      else if (v === 'common') list.push(crit('Un seul interrupteur les commande ' + (fem(ty) ? 'toutes' : 'tous') + ' les trois', function (h) {
        return T(h).some(function (t) { return h.sw.some(function (K) { return t.every(function (x) { return h.controls(K, x); }); }); });
      }));
      else {
        var x = pick(ty), rest = but(ty, x);
        list.push(
          crit(cap(SAY[x].un) + ' ' + SAY[x].act + ' tout le temps', function (h) { return T(h).some(function (t) { return t.some(function (z) { return type(h, z) === x && h.always(z); }); }); }),
          crit('Les deux autres ont ' + (fem(rest) ? 'chacune' : 'chacun') + ' leur propre interrupteur', function (h) {
            return T(h).some(function (t) {
              return t.some(function (z) { return type(h, z) === x && h.always(z) && but(t, z).every(function (y) { return ownSwitch(h, y, but(t, y)); }); });
            });
          }));
      }
      return spec(list);
    }
  ];

  var G1_BEHAVIOUR = [
    function () {
      if (chance()) {
        var a = pick(REC), b = pick(but(REC, a));
        return spec([
          crit(cap(SAY[a].un) + ' qui ' + SAY[a].start + ' avec un interrupteur', function (h) { return h.names(a).some(function (X) { return h.sw.some(function (K) { return h.controls(K, X); }); }); }),
          crit(cap(SAY[b].un) + ' qui ' + SAY[b].act + ' tout le temps', function (h) { return h.names(b).some(h.always); })
        ]);
      }
      var t = pick(REC), s = SAY[t];
      function P(h) { return pairs(h.names(t), h.names(t)).filter(function (p) { return bothCtrl(h, p); }); }
      return spec([
        crit('Deux ' + s.les + ' qui ' + s.starts + ' ensemble avec un interrupteur', function (h) { return P(h).length > 0; }),
        crit(s.gone + ', l\'autre ' + s.stop + ' aussi', function (h) { return P(h).some(function (p) { return !h.survives(p[0], p[1]) && !h.survives(p[1], p[0]); }); })
      ]);
    },
    function () {
      var v = pick(['indep', 'own', 'general']), a = pick(REC), b = pick(but(REC, a));
      if (v === 'indep') {
        var s = SAY[a];
        return spec([
          crit('Deux ' + s.les + ' qui ' + s.starts + ' ensemble avec un seul interrupteur', function (h) { return pairs(h.names(a), h.names(a)).some(function (p) { return bothCtrl(h, p); }); }),
          crit(s.gone + ', l\'autre continue de ' + s.inf, function (h) { return pairs(h.names(a), h.names(a)).some(function (p) { return bothCtrl(h, p) && h.survives(p[0], p[1]) && h.survives(p[1], p[0]); }); })
        ]);
      }
      if (v === 'own') {
        if (chance()) b = a;
        var ty = sorted([a, b]);
        return spec([crit(cap(group(ty)) + ', ' + (fem(ty) ? 'chacune commandée' : 'chacun commandé') + ' par son propre interrupteur', function (h) {
          return pairs(h.names(a), h.names(b)).some(function (p) { return ownSwitch(h, p[0], [p[1]]) && ownSwitch(h, p[1], [p[0]]); });
        })]);
      }
      return spec([
        crit('Un interrupteur qui coupe à la fois ' + SAY[a].le + ' et ' + SAY[b].le, function (h) { return pairs(h.names(a), h.names(b)).some(function (p) { return bothCtrl(h, p); }); }),
        crit('Un autre interrupteur qui coupe seulement ' + SAY[b].le, function (h) { return pairs(h.names(a), h.names(b)).some(function (p) { return bothCtrl(h, p) && ownSwitch(h, p[1], [p[0]]); }); })
      ]);
    },
    function () {
      var v = pick(['three', 'mixed', 'general']), a = pick(REC), b = pick(REC), s = SAY[a];
      if (v === 'three') {
        var T = function (h) { return triples(h.names(a)).filter(function (t) { return h.sw.some(function (K) { return t.every(function (x) { return h.controls(K, x); }); }); }); };
        return spec([
          crit('Trois ' + s.les + ' qui ' + s.starts + ' ensemble avec un seul interrupteur', function (h) { return T(h).length > 0; }),
          crit(s.fail + ', les deux autres continuent de ' + s.inf, function (h) { return T(h).some(function (t) { return t.every(function (x) { return t.every(function (y) { return x === y || h.survives(x, y); }); }); }); })
        ]);
      }
      if (v === 'mixed') {
        var u = SAY[b];
        var P = function (h) { return pairs(h.names(b), h.names(b)).filter(function (p) { return bothCtrl(h, p) && !h.always(p[0]) && !h.always(p[1]); }); };
        return spec([
          crit(cap(s.un) + ' qui ' + s.act + ' tout le temps', function (h) { return h.names(a).some(h.always); }),
          crit('Deux ' + (a === b ? 'autres ' : '') + u.les + ' qui ' + u.starts + ' ensemble avec un même interrupteur', function (h) { return P(h).length > 0; }),
          crit(u.goneOf + ', l\'autre continue de ' + u.inf, function (h) { return P(h).some(function (p) { return h.survives(p[0], p[1]) && h.survives(p[1], p[0]); }); })
        ]);
      }
      var ty = sorted([a, b]);
      function both2(h) { return pairs(h.names(a), h.names(b)).filter(function (p) { return ownSwitch(h, p[0], [p[1]]) && ownSwitch(h, p[1], [p[0]]); }); }
      return spec([
        crit(cap(group(ty)) + ', ' + (fem(ty) ? 'chacune commandée' : 'chacun commandé') + ' par son propre interrupteur', function (h) { return both2(h).length > 0; }),
        crit('Un interrupteur général qui coupe les deux', function (h) { return both2(h).some(function (p) { return bothCtrl(h, p); }); })
      ]);
    }
  ];

  /* ================= Groupe 2 : circuits réalistes ================= */
  var G2_PALETTE = ['gen', 'lamp', 'motor', 'led', 'res', 'buzzer', 'sw', 'voltmeter', 'ammeter', 'ohmmeter'];
  function both(h, p, f) { return f(p[0]) && f(p[1]); }
  function volts(t, o) { return Comp.TYPES[t].opts[o].u + ' V'; }
  // « une lampe de 6 V », « deux moteurs de 3 V »
  function dip(t, o, n) { return some(t, n) + ' de ' + volts(t, o); }
  function pron(t) { return SAY[t].f ? 'Elle' : 'Il'; }
  function serieOfOpt(h, ta, oa, tb, ob) { return pairs(h.names(ta, oa), h.names(tb, ob)).filter(function (p) { return h.rel(p[0], p[1]) === 'serie'; }); }
  function derivOfOpt(h, ta, oa, tb, ob) { return pairs(h.names(ta, oa), h.names(tb, ob)).filter(function (p) { return h.rel(p[0], p[1]) === 'derivation'; }); }
  // Un dipôle (ta, oa) en dérivation de deux dipôles (tb, ob) en série
  function mixed(h, ta, oa, tb, ob) {
    var out = [];
    h.names(ta, oa).forEach(function (x) {
      serieOfOpt(h, tb, ob, tb, ob).forEach(function (p) { if (p[0] !== x && p[1] !== x && h.rel(x, p[0]) === 'derivation') out.push([x, p[0], p[1]]); });
    });
    return out;
  }
  function ctrl(h, X) { return h.sw.some(function (K) { return h.controls(K, X); }); }

  var G2_SPEC = [
    function () {
      var v = pick(['serie', 'switch', 'deriv']), t = pick(['lamp', 'motor']), o;
      if (v === 'serie') {
        o = pick([0, 1]);
        return [crit(cap(dip(t, o, 2)) + ' ' + agree([t, t], 'branché') + ' en série', function (h) { return serieOfOpt(h, t, o, t, o).length > 0; }),
          crit(they([t]) + ' ' + SAY[t].acts + ' normalement', function (h) { return serieOfOpt(h, t, o, t, o).some(function (p) { return both(h, p, h.normal); }); })];
      }
      o = pick([0, 1, 2]);
      if (v === 'switch') return [crit(cap(dip(t, o, 1)) + ' ' + agree([t], 'commandé') + ' par un interrupteur', function (h) { return h.names(t, o).some(function (X) { return ctrl(h, X); }); }),
        crit(pron(t) + ' ' + SAY[t].act + ' normalement', function (h) { return h.names(t, o).some(h.normal); })];
      var a = t, b = t === 'lamp' ? 'motor' : 'lamp';
      return [crit(cap(dip(a, o, 1)) + ' et ' + dip(b, o, 1) + ' branchés en dérivation', function (h) { return derivOfOpt(h, a, o, b, o).length > 0; }),
        crit(cap(SAY[a].le) + ' ' + SAY[a].act + ' normalement', function (h) { return derivOfOpt(h, a, o, b, o).some(function (p) { return h.normal(p[0]); }); })];
    },
    function () {
      var v = pick(['serie', 'pair', 'deriv', 'buzzer']), t = pick(['lamp', 'motor']), o = pick([0, 1, 2]);
      if (v === 'serie') {
        o = pick([0, 1]);
        return [crit(cap(dip(t, o, 2)) + ' ' + agree([t, t], 'branché') + ' en série', function (h) { return serieOfOpt(h, t, o, t, o).length > 0; }),
          crit('Un interrupteur qui commande les deux', function (h) { return serieOfOpt(h, t, o, t, o).some(function (p) { return bothCtrl(h, p); }); }),
          crit(they([t]) + ' ' + SAY[t].acts + ' normalement', function (h) { return serieOfOpt(h, t, o, t, o).some(function (p) { return both(h, p, h.normal); }); })];
      }
      // Lampe et moteur de 3 V : même intensité nominale, ils fonctionnent normalement en série sous 6 V
      if (v === 'pair') return [crit('Une lampe de 3 V et un moteur de 3 V branchés en série', function (h) { return serieOfOpt(h, 'lamp', 0, 'motor', 0).length > 0; }),
        crit('Ils fonctionnent normalement', function (h) { return serieOfOpt(h, 'lamp', 0, 'motor', 0).some(function (p) { return both(h, p, h.normal); }); })];
      if (v === 'deriv') return [crit(cap(dip('motor', o, 1)) + ' et ' + dip('lamp', o, 1) + ' branchés en dérivation', function (h) { return derivOfOpt(h, 'motor', o, 'lamp', o).length > 0; }),
        crit('Ils fonctionnent normalement', function (h) { return derivOfOpt(h, 'motor', o, 'lamp', o).some(function (p) { return both(h, p, h.normal); }); })];
      return [crit(cap(dip('lamp', o, 1)) + ' et un buzzer branchés en dérivation', function (h) { return derivOfOpt(h, 'lamp', o, 'buzzer', null).length > 0; }),
        crit('La lampe brille normalement', function (h) { return derivOfOpt(h, 'lamp', o, 'buzzer', null).some(function (p) { return h.normal(p[0]); }); }),
        crit('Le buzzer sonne', function (h) { return derivOfOpt(h, 'lamp', o, 'buzzer', null).some(function (p) { return h.on(p[1]); }); })];
    },
    function () {
      if (chance()) {
        // Branche seule de tension nominale double de celle des deux dipôles identiques en série
        var d = pick([[['lamp', 1], 'lamp'], [['motor', 1], 'lamp'], [['lamp', 1], 'motor'], [['motor', 1], 'motor'], [['lamp', 2], 'lamp'], [['motor', 2], 'lamp'], [['lamp', 2], 'motor'], [['motor', 2], 'motor']]);
        var S = d[0][0], so = d[0][1], T = d[1], to = so - 1;
        return [crit(cap(dip(S, so, 1)) + ' en dérivation de ' + dip(T, to, 2) + ' ' + agree([T, T], 'branché') + ' en série', function (h) { return mixed(h, S, so, T, to).length > 0; }),
          crit('Tout fonctionne normalement', function (h) { return mixed(h, S, so, T, to).some(function (t) { return t.every(h.normal); }); })];
      }
      var t = pick(['lamp', 'motor']), o = pick([0, 1, 2]);
      function T3(h) { return triples(h.names(t, o)).filter(function (x) { return allDeriv(h, x); }); }
      return [crit(cap(dip(t, o, 3)) + ' ' + agree([t, t], 'branché') + ' en dérivation', function (h) { return T3(h).length > 0; }),
        crit((SAY[t].f ? 'Chacune' : 'Chacun') + ' a son propre interrupteur', function (h) { return T3(h).some(function (x) { return x.every(function (y) { return ownSwitch(h, y, but(x, y)); }); }); }),
        crit(they([t]) + ' ' + SAY[t].acts + ' normalement', function (h) { return nNormal(h, t, o, 3); })];
    }
  ];

  // Défis : meilleure chaleur / lumière calculées d'avance avec le matériel disponible
  function bestHeat(n) {
    var R = Comp.TYPES.res.opts, best = 0;
    function ok(I, r) { return I * Math.sqrt(r) <= 1.15; }
    GEN_V.forEach(function (U) {
      R.forEach(function (a) {
        if (n === 1) { if (ok(U / a, a)) best = Math.max(best, U * U / a); return; }
        R.forEach(function (b) {
          if (ok(U / a, a) && ok(U / b, b)) best = Math.max(best, U * U / a + U * U / b);
          var I = U / (a + b);
          if (ok(I, a) && ok(I, b)) best = Math.max(best, U * I);
        });
      });
    });
    return best;
  }
  // Lampe la plus lumineuse sans surchauffe (chaque lampe seule sur le générateur)
  function bestLamp() {
    var best = 0;
    Comp.TYPES.lamp.opts.forEach(function (l) { GEN_V.forEach(function (U) { if (U / l.u <= 1.15) best = Math.max(best, U * U * l.i / l.u); }); });
    return best;
  }
  var G2_CHALLENGE = [
    function () {
      var v = pick(['heat', 'light', 'buzz']), n;
      if (v === 'heat') {
        n = pick([1, 2]);
        var best = bestHeat(n);
        return {
          stock: { gen: 1, res: n },
          intro: n === 1 ? 'Je veux me chauffer le plus fort possible avec une seule résistance, sans qu\'elle surchauffe.' : 'Je veux me chauffer le plus fort possible avec deux résistances, sans qu\'aucune ne surchauffe.',
          criteria: [
            crit(n === 1 ? 'La résistance chauffe le plus possible' : 'Les résistances chauffent le plus possible', function (h) { return h.names('res').reduce(function (t, r) { return t + h.s(r).P; }, 0) >= best * .95; }),
            crit(n === 1 ? 'Elle ne surchauffe pas' : 'Aucune ne surchauffe', function (h) { return h.names('res').length > 0 && h.names('res').every(h.safe); })
          ]
        };
      }
      if (v === 'light') {
        n = pick([1, 2, 3]);
        var max = bestLamp() * n;
        return {
          stock: { gen: 1, lamp: n },
          intro: n === 1 ? 'Je veux la lumière la plus forte possible avec une seule lampe, sans qu\'elle surchauffe.' : 'Je veux la lumière la plus forte possible avec ' + NUM[n] + ' lampes, sans qu\'aucune ne surchauffe.',
          criteria: [
            crit(n === 1 ? 'La lampe éclaire le plus possible' : 'Les ' + NUM[n] + ' lampes éclairent le plus possible', function (h) { return h.names('lamp').reduce(function (t, x) { return t + h.s(x).P; }, 0) >= max * .95; }),
            crit(n === 1 ? 'Elle ne surchauffe pas' : 'Aucune lampe ne surchauffe', function (h) { return h.names('lamp').length > 0 && h.names('lamp').every(h.safe); })
          ]
        };
      }
      n = pick([2, 3, 4]);
      return {
        stock: { gen: 1, buzzer: n },
        intro: 'Je veux ' + NUM[n] + ' buzzers que je peux faire sonner autant que je veux, chacun indépendamment des autres.',
        criteria: [
          crit(cap(NUM[n]) + ' buzzers qui sonnent', function (h) { return h.names('buzzer').filter(h.on).length >= n; }),
          crit('Chacun s\'arrête avec son propre interrupteur, sans couper les autres', function (h) {
            var b = h.names('buzzer');
            return b.length >= n && b.every(function (x) { return ownSwitch(h, x, but(b, x)); });
          })
        ]
      };
    },
    function () {
      var v = pick(['two', 'fan', 'bell', 'night']);
      if (v === 'two') {
        var o = pick([null, 0, 1, 2]), what = o == null ? 'deux lampes' : dip('lamp', o, 2);
        return { intro: 'Je veux ' + what + ' qui brillent normalement, et pouvoir éteindre chacune sans éteindre l\'autre.',
          criteria: [
            crit(cap(what) + ' qui brillent normalement', function (h) { return h.names('lamp', o).filter(h.normal).length >= 2; }),
            crit('Chacune s\'éteint avec son propre interrupteur, sans éteindre l\'autre', function (h) {
              return pairs(h.names('lamp', o), h.names('lamp', o)).some(function (p) { return both(h, p, h.normal) && ownSwitch(h, p[0], [p[1]]) && ownSwitch(h, p[1], [p[0]]); });
            })] };
      }
      if (v === 'fan') return { intro: 'Je veux un ventilateur (un moteur) qui tourne normalement et une veilleuse (une DEL) allumée en même temps, avec un seul générateur.',
        criteria: [
          crit('Le moteur tourne normalement', function (h) { return h.names('motor').some(h.normal); }),
          crit('La DEL brille normalement en même temps', function (h) { return h.names('led').some(h.normal); })] };
      if (v === 'night') return { intro: 'Une veilleuse (une DEL) qui brille normalement tout le temps, et un buzzer qui sonne seulement quand on ferme l\'interrupteur.',
        criteria: [
          crit('Une DEL qui brille normalement tout le temps', function (h) { return h.names('led').some(function (D) { return h.normal(D) && h.always(D); }); }),
          crit('Un buzzer qui sonne seulement quand on ferme l\'interrupteur', function (h) { return h.names('buzzer').some(function (B) { return ctrl(h, B); }); })] };
      var lo = pick([0, 1, 2]);
      return { intro: 'Une sonnette : un buzzer qui sonne seulement quand on ferme l\'interrupteur, et ' + dip('lamp', lo, 1) + ' qui brille normalement tout le temps.',
        criteria: [
          crit('Un buzzer qui sonne seulement quand on ferme l\'interrupteur', function (h) { return h.names('buzzer').some(function (B) { return ctrl(h, B); }); }),
          crit(cap(dip('lamp', lo, 1)) + ' qui brille normalement tout le temps', function (h) { return h.names('lamp', lo).some(function (L) { return h.normal(L) && h.always(L); }); })] };
    },
    function () {
      if (chance()) {
        var g = pick([[0, 4], [0, 5], [0, 6], [1, 4], [1, 6]]), o = g[0], n = g[1];
        return { intro: 'Une guirlande : ' + dip('lamp', o, n) + ' qui brillent toutes normalement.',
          criteria: [crit(cap(dip('lamp', o, n)) + ' qui brillent normalement', function (h) { return nNormal(h, 'lamp', o, n); })] };
      }
      var m = pick([[2, 1], [2, 2], [1, 0], [1, 1], [0, 0]]), mo = m[0], lo = m[1];
      return { intro: cap(dip('motor', mo, 1)) + ' et ' + dip('lamp', lo, 2) + ' qui fonctionnent tous normalement, avec un interrupteur qui commande seulement le moteur.',
        criteria: [
          crit(cap(dip('motor', mo, 1)) + ' et ' + dip('lamp', lo, 2) + ' qui fonctionnent normalement', function (h) { return nNormal(h, 'motor', mo, 1) && nNormal(h, 'lamp', lo, 2); }),
          crit('Un interrupteur qui commande seulement le moteur', function (h) {
            var L = h.names('lamp', lo).filter(h.normal);
            return h.names('motor', mo).some(function (M) { return h.normal(M) && ownSwitch(h, M, L); });
          })] };
    }
  ];

  // Valeurs imposées : générateur (et parfois récepteurs) bloqués sur un réglage
  // need : { type: [option bloquée, nombre] } ; K : un interrupteur doit tout éteindre
  function forced(U, need, K) {
    var types = Object.keys(need), lock = {}, w = [], crits = [];
    types.forEach(function (t) {
      var o = need[t][0], n = need[t][1];
      lock[t] = o;
      w.push(some(t, n));
      crits.push(crit(cap(some(t, n)) + ' qui ' + (n > 1 ? SAY[t].acts : SAY[t].act) + ' normalement', function (h) { return nNormal(h, t, o, n); }));
    });
    var o0 = need[types[0]][0], verb = types.length > 1 ? 'fonctionner' : SAY[types[0]].inf;
    var locked = (types.length > 1 ? 'les ' + SAY[types[0]].les + ' et les ' + SAY[types[1]].les : 'les ' + SAY[types[0]].les) + ' sur ' + volts(types[0], o0);
    var intro = 'Le générateur est bloqué sur ' + U + ' V et ' + locked + ' : fais ' + verb + ' normalement ' + w.join(' et ');
    if (K) {
      intro += ', avec un interrupteur qui les éteint tous';
      crits.push(crit('Un interrupteur qui les éteint tous', function (h) {
        var all = [];
        types.forEach(function (t) { all = all.concat(h.names(t, need[t][0]).filter(h.normal)); });
        return h.sw.some(function (S) { return all.every(function (x) { return h.controls(S, x); }); });
      }));
    }
    if (K && types.length === 1 && SAY[types[0]].f) { intro = intro.replace('les éteint tous', 'les éteint toutes'); crits[crits.length - 1].text = 'Un interrupteur qui les éteint toutes'; }
    return { gen: GEN_V.indexOf(U), lock: lock, intro: intro + '.', criteria: crits };
  }
  var G2_FORCED = [
    function () {
      return pick([
        function () { return forced(12, { lamp: [1, 2] }); },
        function () { return forced(6, { lamp: [0, 2] }); },
        function () { return forced(12, { motor: [1, 2] }); },
        function () { return forced(6, { motor: [0, 2] }); },
        function () { return forced(9, { lamp: [0, 3] }); },
        function () { return forced(9, { motor: [0, 3] }); },
        function () { return forced(6, { lamp: [0, 1], motor: [0, 1] }); }
      ])();
    },
    function () {
      return pick([
        function () { return forced(6, { lamp: [0, 4] }); },
        function () { return forced(6, { motor: [0, 4] }); },
        function () { return forced(12, { lamp: [1, 4] }); },
        function () { return forced(12, { motor: [1, 4] }); },
        function () { return forced(9, { lamp: [0, 6] }); },
        function () { return forced(12, { lamp: [0, 4] }, true); },
        function () { return forced(12, { motor: [0, 4] }, true); },
        function () { return forced(12, { lamp: [0, 2], motor: [0, 2] }); }
      ])();
    },
    // Générateur seul bloqué : trois sortes de dipôles, chacune en nombre suffisant pour former une chaîne à sa tension nominale
    function () {
      var U = pick([6, 12, 12, 12]), kinds = [];
      ['lamp', 'motor'].forEach(function (t) { Comp.TYPES[t].opts.forEach(function (n, o) { if (U % n.u === 0) kinds.push({ t: t, o: o, n: U / n.u, u: n.u }); }); });
      var set;
      do { set = shuffle(kinds).slice(0, 3); } while (set.reduce(function (s, k) { return s + k.n; }, 0) > 8);
      set.sort(function (a, b) { return b.u - a.u || (a.t < b.t ? -1 : 1); });
      var w = set.map(function (k) { return dip(k.t, k.o, k.n); });
      return {
        gen: GEN_V.indexOf(U),
        intro: 'Le générateur est bloqué sur ' + U + ' V : fais fonctionner normalement ' + w.slice(0, -1).join(', ') + ' et ' + w[w.length - 1] + '.',
        criteria: set.map(function (k) {
          return crit(cap(dip(k.t, k.o, k.n)) + ' qui ' + (k.n > 1 ? SAY[k.t].acts : SAY[k.t].act) + ' normalement', function (h) { return nNormal(h, k.t, k.o, k.n); });
        })
      };
    }
  ];

  /* ================= Groupe 3 : mesures et lois ================= */
  var METERS1 = { voltmeter: 1, ammeter: 1, ohmmeter: 1 };
  function E(name, type, x, y, opt, extra) { var e = { name: name, type: type, x: x, y: y, opt: opt }; for (var k in extra) e[k] = extra[k]; return e; }
  function lock(c) { c.els.forEach(function (e) { if (!/meter/.test(e.type)) e.lock = true; }); c.wires = c.wires.map(function (w) { return { a: w[0], b: w[1], lock: true }; }); return c; }

  // Une boucle : générateur + deux récepteurs en série
  function loop1(gen, A, B) {
    return {
      els: [E('G1', 'gen', 0, 0, gen), E(A[0], A[1], -70, 150, A[2]), E(B[0], B[1], 70, 150, B[2])],
      wires: [['G1.0', A[0] + '.0'], [A[0] + '.1', B[0] + '.0'], [B[0] + '.1', 'G1.1']]
    };
  }
  // Deux boucles : X et Y en dérivation, chacun mesurable (un fil par borne + du générateur, de X côté retour, de Y côté aller)
  function loop2(gen, X, Y) {
    return {
      els: [E('G1', 'gen', 0, 0, gen), E(X[0], X[1], 0, 130, X[2]), E(Y[0], Y[1], 0, 240, Y[2])],
      wires: [['G1.0', X[0] + '.0'], [X[0] + '.0', Y[0] + '.0'], [X[0] + '.1', 'G1.1'], [Y[0] + '.1', 'G1.1']]
    };
  }
  // Deux boucles : une branche seule (S) et deux dipôles en série (P, Q), comme au cours 7
  function loop2s(gen, S, P, Q) {
    return {
      els: [E('G1', 'gen', 0, 0, gen), E(P[0], P[1], -80, 130, P[2]), E(Q[0], Q[1], 80, 130, Q[2]), E(S[0], S[1], 0, 240, S[2])],
      wires: [['G1.0', P[0] + '.0'], [P[0] + '.1', Q[0] + '.0'], [Q[0] + '.1', 'G1.1'], [P[0] + '.0', S[0] + '.0'], [S[0] + '.1', Q[0] + '.1']]
    };
  }

  // Récepteurs des circuits de mesure : lampes et moteurs, résistance Unom / Inom comme dans le labo
  var KINDS = [];
  ['lamp', 'motor'].forEach(function (t) { Comp.TYPES[t].opts.forEach(function (n, o) { KINDS.push({ t: t, o: o, u: n.u, R: n.u / n.i }); }); });
  // Valeurs de fonctionnement : chaque branche est une suite de dipôles en série, les branches sont en dérivation sur le générateur
  function solve(U, br) {
    var I = 0, out = [];
    br.forEach(function (b, j) {
      var i = U / b.reduce(function (s, k) { return s + k.R; }, 0);
      I += i;
      b.forEach(function (k) { out.push({ k: k, U: i * k.R, I: i, ratio: i * k.R / k.u, br: j }); });
    });
    return { I: I, parts: out };
  }
  function within(U, br, lo, hi) { return solve(U, br).parts.every(function (p) { return p.ratio >= lo - 1e-9 && p.ratio <= hi + 1e-9; }); }
  // Valeur affichée sans arrondi par les appareils : les lois se vérifient alors exactement sur les nombres lus
  function exact(v, d) { return Math.abs(v * d - Math.round(v * d)) < 1e-6; }
  function exactU(v) { return exact(v, v >= 9.995 ? 10 : 100); }
  function exactI(v) { v *= 1000; return exact(v, v >= 99.95 ? 1 : v >= 9.995 ? 10 : 100); }
  function readable(U, br) { var s = solve(U, br); return exactI(s.I) && s.parts.every(function (p) { return exactU(p.U) && exactI(p.I); }); }
  // Toutes les suites de n récepteurs
  function seqs(n) {
    var out = [[]];
    for (var i = 0; i < n; i++) out = [].concat.apply([], out.map(function (c) { return KINDS.map(function (k) { return c.concat([k]); }); }));
    return out;
  }
  // Formes des circuits imposés : nombre de récepteurs, branches, dessin
  var SHAPES = {
    loop1: { n: 2, br: function (c) { return [[c[0], c[1]]]; }, draw: loop1 },
    loop2: { n: 2, br: function (c) { return [[c[0]], [c[1]]]; }, draw: loop2 },
    loop2s: { n: 3, br: function (c) { return [[c[1], c[2]], [c[0]]]; }, draw: loop2s }
  };
  // Tirage d'un circuit imposé : tout fonctionne sans casser (30 % à 110 % du nominal) ; « lisible » = valeurs affichées exactes
  var drawCache = {};
  function drawCircuit(shape, legible) {
    var key = shape + legible, sh = SHAPES[shape];
    if (!drawCache[key]) {
      drawCache[key] = [];
      GEN_V.forEach(function (U) {
        seqs(sh.n).forEach(function (c) {
          var br = sh.br(c);
          if (within(U, br, .3, 1.1) && (!legible || readable(U, br))) drawCache[key].push({ U: U, c: c });
        });
      });
    }
    var d = pick(drawCache[key]), nm = namer(), parts = d.c.map(function (k) { return [nm(k.t), k.t, k.o]; });
    return { parts: parts, names: parts.map(function (p) { return p[0]; }), circuit: sh.draw.apply(null, [GEN_V.indexOf(d.U)].concat(parts)) };
  }
  function U(lab, n) { return lab.state(n).U; }
  function mA(lab, n) { return lab.state(n).I * 1000; }
  function rowU(n, label) { return { k: 'U' + n, label: label || 'Tension aux bornes de ' + n, unit: 'V', tol: .06, expect: function (lab) { return U(lab, n); } }; }
  function rowI(n, label) { return { k: 'I' + n, label: label, unit: 'mA', tol: 3, expect: function (lab) { return mA(lab, n); } }; }

  var G3_MEASURE = [
    function () {
      var d = drawCircuit('loop1'), n = d.names;
      return { circuit: lock(d.circuit), rows: [rowU(n[0]), rowU(n[1]), rowI('G1', 'Intensité dans le circuit')] };
    },
    function () {
      var d = drawCircuit('loop2'), n = d.names, Z = pick(n);
      return { circuit: lock(d.circuit), rows: [rowU(n[0]), rowU(n[1]), rowI('G1', 'Intensité à la sortie du générateur'), rowI(Z, 'Intensité qui traverse ' + Z)] };
    },
    function () {
      var d = drawCircuit('loop2s'), S = d.names[0], P = d.names[1], Q = d.names[2];
      var rows = [rowU(P), rowU(Q), rowU(S), rowI('G1', 'Intensité à la sortie du générateur'), rowI(S, 'Intensité qui traverse ' + S), rowI(P, 'Intensité entre ' + P + ' et ' + Q)];
      rows.splice(Math.floor(Math.random() * rows.length), 1);   // cinq mesures parmi six
      return { circuit: lock(d.circuit), rows: rows };
    }
  ];

  // Déductions : appareils déjà placés, la valeur cachée (« ? ») se déduit des lois
  function V(name, on, dir, hide) { return { name: name, type: 'voltmeter', on: on, dir: dir, hide: !!hide }; }
  function A(name, a, b, hide) { return { name: name, type: 'ammeter', between: [a, b], hide: !!hide }; }
  function withMeters(c, meters) {
    var taken = meters.filter(function (m) { return m.between; }).map(function (m) { return m.between.slice().sort().join(); });
    c.wires = c.wires.filter(function (w) { return taken.indexOf(w.slice().sort().join()) < 0; });
    c.els = c.els.concat(meters);
    return c;
  }
  function hiddenRow(meter, label) {
    var unit = meter.type === 'voltmeter' ? 'V' : 'mA';
    return { k: meter.name, label: label, unit: unit, tol: unit === 'V' ? .06 : 3, expect: function (lab) { var v = lab.state(meter.name).value; return unit === 'V' ? v : v * 1000; } };
  }
  // Emplacements des appareils pour chaque forme : voltmètres (dipôle, côté libre), ampèremètres (fil remplacé, intitulé)
  // v / i : [emplacements visibles, emplacement caché] ; la tension du générateur n'est jamais cachée (elle est affichée sur lui)
  var SPOTS = {
    loop1: function (a, b) {
      return {
        V: { G: ['G1', [0, -1]], a: [a, [0, 1]], b: [b, [0, 1]] },
        I: { in: ['G1.0', a + '.0', 'Intensité à la sortie du générateur'], mid: [a + '.1', b + '.0', 'Intensité entre ' + a + ' et ' + b], out: [b + '.1', 'G1.1', 'Intensité qui revient au générateur'] },
        v: [[['G', 'a'], 'b'], [['G', 'b'], 'a']],
        i: [[['in'], 'mid'], [['in'], 'out'], [['mid'], 'in'], [['mid'], 'out'], [['out'], 'in'], [['out'], 'mid']]
      };
    },
    loop2: function (x, y) {
      return {
        V: { G: ['G1', [0, -1]], y: [y, [0, 1]] },
        I: { in: ['G1.0', x + '.0', 'Intensité à la sortie du générateur'], x: [x + '.1', 'G1.1', 'Intensité qui traverse ' + x], y: [x + '.0', y + '.0', 'Intensité qui traverse ' + y] },
        v: [[['G'], 'y']],
        i: [[['x', 'y'], 'in'], [['in', 'x'], 'y'], [['in', 'y'], 'x']]
      };
    },
    loop2s: function (s, p, q) {
      return {
        V: { G: ['G1', [0, -1]], p: [p, [0, -1]], q: [q, [0, -1]], s: [s, [0, 1]] },
        I: { in: ['G1.0', p + '.0', 'Intensité à la sortie du générateur'], s: [p + '.0', s + '.0', 'Intensité qui traverse ' + s], pq: [p + '.1', q + '.0', 'Intensité entre ' + p + ' et ' + q], out: [q + '.1', 'G1.1', 'Intensité qui revient au générateur'] },
        v: [[['G', 'p'], 'q'], [['G', 'q'], 'p'], [['s', 'p'], 'q'], [['s', 'q'], 'p'], [['p', 'q'], 's'], [['G'], 's']],
        i: [[['in', 's'], 'pq'], [['in', 'pq'], 's'], [['s', 'pq'], 'in'], [['s', 'pq'], 'out'], [['out', 's'], 'pq'], [['out', 'pq'], 's']]
      };
    }
  };
  // kinds : grandeurs à cacher ('v' tension, 'i' intensité), une inconnue par grandeur
  function deduce(shape, kinds) {
    var d = drawCircuit(shape, true), sp = SPOTS[shape].apply(null, d.names), meters = [], rows = [], nv = 0, na = 0;
    kinds.forEach(function (kind) {
      var plan = pick(sp[kind]);
      plan[0].concat([plan[1]]).forEach(function (key, j) {
        var hide = j === plan[0].length, m;
        if (kind === 'v') { m = V('V' + (++nv), sp.V[key][0], sp.V[key][1], hide); if (hide) rows.push(hiddenRow(m, 'Tension aux bornes de ' + sp.V[key][0])); }
        else { m = A('A' + (++na), sp.I[key][0], sp.I[key][1], hide); if (hide) rows.push(hiddenRow(m, sp.I[key][2])); }
        meters.push(m);
      });
    });
    return { circuit: withMeters(d.circuit, meters), rows: rows };
  }
  var G3_DEDUCE = [
    function () { return deduce('loop1', [pick(['v', 'i'])]); },
    function () { return deduce('loop2', [pick(['v', 'i', 'i'])]); },
    function () { return deduce('loop2s', ['v', 'i']); }
  ];

  // Construction précise : pièces fournies (réglages bloqués), valeurs de fonctionnement à obtenir
  function target(n, kind, v) {
    var unit = kind === 'U' ? 'V' : 'mA';
    return crit((kind === 'U' ? n + ' reçoit une tension de ' : 'Le générateur délivre une intensité de ') + num(v) + ' ' + unit, function (h) {
      var s = h.s(n);
      if (!s || s.broken) return false;
      var x = kind === 'U' ? s.U : s.I * 1000;
      return Math.abs(x - v) <= Math.max(kind === 'U' ? .1 : 3, v * .05);
    });
  }
  function parts(gen, list) {
    var n = list.length, els = [E('G1', 'gen', 0, -40, gen)];
    var cols = Math.min(n, 3);
    list.forEach(function (p, i) { els.push(E(p[0], p[1], (i % cols - (cols - 1) / 2) * 140, 120 + Math.floor(i / cols) * 110, p[2])); });
    return { els: els, wires: [] };
  }
  // Circuit modèle (branches de récepteurs) → pièces mélangées et valeurs à obtenir (tension de chaque dipôle, intensité si elle tombe juste)
  function precise(U, br) {
    var s = solve(U, br), nm = namer(), list = shuffle(s.parts).map(function (p) { return { name: nm(p.k.t), p: p }; });
    var targets = list.slice().sort(function (a, b) { return a.name < b.name ? -1 : 1; }).map(function (x) { return [x.name, 'U', +x.p.U.toFixed(2)]; });
    if (exact(s.I * 1000, 1)) targets.push(['G1', 'I', Math.round(s.I * 1000)]);
    // sol : noms des récepteurs branche par branche (montage modèle, pour les tests)
    var sol = br.map(function (b, j) { return list.filter(function (x) { return x.p.br === j; }).map(function (x) { return x.name; }); });
    return { gen: GEN_V.indexOf(U), parts: list.map(function (x) { return [x.name, x.p.k.t, x.p.k.o]; }), targets: targets, sol: sol };
  }
  // Branches possibles où chaque récepteur fonctionne à son régime nominal (même intensité nominale, tensions qui s'additionnent)
  function nominalBranches(U, maxLen) {
    var out = [];
    for (var n = 1; n <= maxLen; n++) seqs(n).forEach(function (c) {
      var sortedOk = c.every(function (k, i) { return !i || KINDS.indexOf(c[i - 1]) <= KINDS.indexOf(k); });
      if (sortedOk && within(U, [c], 1, 1)) out.push(c);
    });
    return out;
  }
  var buildCache = {};
  function buildList(level) {
    if (buildCache[level]) return buildCache[level];
    var list = [];
    GEN_V.forEach(function (U) {
      if (level === 0) {
        // Deux récepteurs, en série ou en dérivation, valeurs exactes
        seqs(2).forEach(function (c) {
          [[c], [[c[0]], [c[1]]]].forEach(function (br) {
            var s = solve(U, br);
            if (within(U, br, .3, 1.1) && s.parts.every(function (p) { return exact(p.U, 10); })) list.push({ U: U, br: br });
          });
        });
        return;
      }
      var opts = nominalBranches(U, 4);
      if (level === 1) {
        // Un récepteur seul en dérivation de deux récepteurs en série
        opts.forEach(function (a) { opts.forEach(function (b) { if (a.length === 1 && b.length === 2) list.push({ U: U, br: [b, a] }); }); });
        return;
      }
      // Quatre à six récepteurs sur deux ou trois branches, dont au moins une avec plusieurs récepteurs
      for (var i = 0; i < opts.length; i++) for (var j = i; j < opts.length; j++) {
        [null].concat(opts.slice(j)).forEach(function (c) {
          var br = [opts[i], opts[j]].concat(c ? [c] : []), n = br.reduce(function (s, b) { return s + b.length; }, 0);
          if (n >= 4 && n <= 6 && br.some(function (b) { return b.length > 1; }) && solve(U, br).I <= 1.0001) list.push({ U: U, br: br });
        });
      }
    });
    return (buildCache[level] = list);
  }
  var G3_BUILD = [0, 1, 2].map(function (level) {
    return function () { var d = pick(buildList(level)); return precise(d.U, d.br); };
  });

  /* ================= Fabrication d'une partie (27 missions) ================= */
  var TITLES = [
    ['Une boucle, un récepteur', 'Une boucle, deux récepteurs', 'Deux boucles, deux récepteurs',
      'Une boucle, deux récepteurs', 'Deux boucles, deux récepteurs', 'Trois boucles, trois récepteurs',
      'Fonctionnement ★', 'Fonctionnement ★★', 'Fonctionnement ★★★'],
    ['Réglages ★', 'Réglages ★★', 'Réglages ★★★', 'Défi ★', 'Défi ★★', 'Défi ★★★', 'Valeurs imposées ★', 'Valeurs imposées ★★', 'Valeurs imposées ★★★'],
    ['Une boucle, trois mesures', 'Deux boucles, quatre mesures', 'Deux boucles, cinq mesures',
      'Une boucle, une inconnue', 'Deux boucles, une inconnue', 'Deux boucles, deux inconnues',
      'Construction précise ★', 'Construction précise ★★', 'Construction précise ★★★']
  ];
  function mission(g, k) {
    var gr = GROUPS[g], row = Math.floor(k / 3), col = k % 3;
    // Points : constants sur une colonne, croissants avec la difficulté (★ à ★★★, de gauche à droite)
    var m = { g: g, k: k, points: gr.points[col], stars: col + 1, malus: gr.malus, tag: gr.tags[row], title: TITLES[g][k], group: gr.name };
    if (g === 0) {
      m.lab = G1_LAB;
      if (row === 0) {
        var s = g1Schema(col);
        m.panel = { kind: 'schema', circuit: s.circuit, legend: s.legend };
        m.intro = 'Construis le circuit du schéma, exactement : mêmes dipôles et mêmes branchements (la disposition peut changer).';
        m.task = 'Construis le circuit du schéma.';
        m.schema = s.circuit;
      } else {
        var c = (row === 1 ? G1_SPEC : G1_BEHAVIOUR)[col]();
        m.panel = { kind: 'spec', title: row === 1 ? 'Cahier des charges' : 'Ce que je veux', lines: c.lines };
        m.criteria = c.criteria;
        m.intro = row === 1 ? 'Construis un circuit qui respecte le cahier des charges. Tu peux ajouter d\'autres éléments si tu veux.'
          : 'Construis un circuit qui fonctionne comme demandé : à toi de trouver les branchements !';
        m.task = row === 1 ? 'Construis un circuit qui respecte le cahier des charges.' : 'Construis un circuit qui fonctionne comme demandé.';
      }
    } else if (g === 1) {
      var lab = { ideal: false, palette: G2_PALETTE, stock: { gen: 1 }, fixedTypes: [] };
      if (row === 0) {
        var cr = G2_SPEC[col]();
        m.criteria = cr;
        m.panel = { kind: 'spec', title: 'Cahier des charges', lines: cr.map(function (x) { return x.text; }) };
        m.intro = 'Construis le circuit demandé et règle bien chaque dipôle : il doit fonctionner normalement, sans trembler ni sous-fonctionner.';
        m.task = 'Construis le circuit demandé, avec les bons réglages.';
      } else if (row === 1) {
        var ch = G2_CHALLENGE[col]();
        if (ch.stock) lab.stock = ch.stock;
        m.criteria = ch.criteria;
        m.panel = { kind: 'spec', title: 'Le défi', lines: [ch.intro] };
        m.intro = ch.intro;
        m.task = 'Relève le défi décrit dans la fenêtre.';
      } else {
        var f = G2_FORCED[col](), defs = { gen: f.gen }, fixed = ['gen'];
        for (var t in f.lock || {}) { defs[t] = f.lock[t]; fixed.push(t); }
        lab.defaults = defs; lab.fixedTypes = fixed;
        m.criteria = f.criteria;
        m.panel = { kind: 'spec', title: 'Valeurs imposées', lines: [f.intro] };
        m.intro = f.intro + ' Certains réglages sont bloqués : à toi de trouver les bons branchements.';
        m.task = 'Fais fonctionner normalement les dipôles demandés.';
      }
      m.lab = lab;
    } else {
      if (row === 0) {
        var ms = G3_MEASURE[col]();
        m.lab = { ideal: false, palette: ['voltmeter', 'ammeter'], stock: { voltmeter: 1, ammeter: 1 }, fixedTypes: ALL_TYPES };
        m.circuit = ms.circuit;
        m.panel = { kind: 'table', title: 'Mes mesures', rows: ms.rows };
        m.intro = 'Le circuit est imposé. Place le voltmètre et l\'ampèremètre aux bons endroits pour remplir le tableau de mesures.';
        m.task = 'Mesure les grandeurs demandées et note-les dans le tableau.';
      } else if (row === 1) {
        var dd = G3_DEDUCE[col]();
        m.lab = { ideal: false, readOnly: true, palette: [], fixedTypes: ALL_TYPES };
        m.circuit = dd.circuit;
        m.panel = { kind: 'table', title: 'Valeurs à déduire', rows: dd.rows };
        m.intro = 'Les appareils sont déjà branchés, mais certains affichent « ? ». Utilise les lois de l\'électricité pour déduire les valeurs manquantes.';
        m.task = 'Déduis les valeurs cachées grâce aux lois de l\'électricité.';
      } else {
        var b = G3_BUILD[col]();
        m.lab = { ideal: false, palette: ['voltmeter', 'ammeter', 'ohmmeter'], stock: METERS1, fixedTypes: ALL_TYPES };
        m.circuit = parts(b.gen, b.parts);
        m.solution = b.sol;
        m.criteria = b.targets.map(function (x) { return target(x[0], x[1], x[2]); });
        m.panel = {
          kind: 'spec', title: 'Valeurs à obtenir',
          lines: ['Générateur G1 bloqué sur ' + GEN_V[b.gen] + ' V ; réglages des dipôles bloqués.'].concat(m.criteria.map(function (x) { return x.text; }))
        };
        m.intro = 'Avec uniquement les pièces fournies, construis un circuit qui donne exactement les valeurs de fonctionnement demandées.';
        m.task = 'Construis le circuit qui donne les valeurs demandées.';
      }
    }
    return m;
  }
  function generate() {
    var list = [];
    for (var g = 0; g < 3; g++) for (var k = 0; k < 9; k++) list.push(mission(g, k));
    return list;
  }

  var MEDALS = [
    { min: 115, id: 'platine', name: 'de platine' },
    { min: 100, id: 'or', name: 'd\'or' },
    { min: 70, id: 'argent', name: 'd\'argent' },
    { min: 40, id: 'bronze', name: 'de bronze' }
  ];
  function medal(score) { for (var i = 0; i < MEDALS.length; i++) if (score >= MEDALS[i].min) return MEDALS[i]; return null; }

  return { GROUPS: GROUPS, generate: generate, helpers: helpers, schemaSpec: schemaSpec, schemaCriteria: schemaCriteria, medal: medal };
})();
