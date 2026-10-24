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
      var where = hasK ? pick(['main', 'branch']) : 'none';
      els.push({ name: A.name, type: A.type, x: 0, y: 130 });
      els.push({ name: B.name, type: B.type, x: where === 'branch' ? -60 : 0, y: 240 });
      wires.push([G + '.0', A.name + '.0'], [A.name + '.0', B.name + '.0']);
      if (where === 'main') { els.push({ name: K.name, type: 'sw', x: 150, y: 65, rot: 90 }); wires.push([G + '.1', K.name + '.0'], [K.name + '.1', A.name + '.1']); }
      else wires.push([A.name + '.1', G + '.1']);
      if (where === 'branch') { els.push({ name: K.name, type: 'sw', x: 70, y: 240 }); wires.push([B.name + '.1', K.name + '.0'], [K.name + '.1', A.name + '.1']); }
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
  function art(t) { return { lamp: 'une lampe', motor: 'un moteur', buzzer: 'un buzzer' }[t]; }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  var G1_SPEC = [
    // 4 : une boucle, deux récepteurs
    function () {
      var v = pick([['lamp', 'lamp', true], ['lamp', 'motor', false], ['buzzer', 'lamp', true]]), a = v[0], b = v[1], k = v[2];
      var what = a === b ? 'Deux lampes branchées en série' : cap(art(a)) + ' et ' + art(b) + ' branchés en série';
      var crit = [
        { text: what, test: function (h) { return serieOf(h, a, b).length > 0; } },
        { text: 'Ils fonctionnent quand les interrupteurs sont fermés', test: function (h) { return serieOf(h, a, b).some(function (p) { return h.on(p[0]) && h.on(p[1]); }); } }
      ];
      if (k) crit.splice(1, 0, { text: 'Un interrupteur commande les deux', test: function (h) { return serieOf(h, a, b).some(function (p) { return bothCtrl(h, p); }); } });
      return { lines: crit.map(function (c) { return c.text; }), criteria: crit };
    },
    // 5 : deux boucles, deux récepteurs
    function () {
      var v = pick(['motors', 'own', 'common']), crit;
      if (v === 'motors') crit = [
        { text: 'Deux moteurs branchés en dérivation', test: function (h) { return derivOf(h, 'motor', 'motor').length > 0; } },
        { text: 'Les deux moteurs tournent', test: function (h) { return derivOf(h, 'motor', 'motor').some(function (p) { return h.on(p[0]) && h.on(p[1]); }); } }
      ];
      else if (v === 'own') crit = [
        { text: 'Une lampe et un buzzer branchés en dérivation', test: function (h) { return derivOf(h, 'lamp', 'buzzer').length > 0; } },
        { text: 'La lampe a son propre interrupteur (qui ne coupe pas le buzzer)', test: function (h) { return derivOf(h, 'lamp', 'buzzer').some(function (p) { return ownSwitch(h, p[0], [p[1]]); }); } },
        { text: 'Le buzzer a son propre interrupteur (qui n\'éteint pas la lampe)', test: function (h) { return derivOf(h, 'lamp', 'buzzer').some(function (p) { return ownSwitch(h, p[1], [p[0]]); }); } }
      ];
      else crit = [
        { text: 'Une lampe et un moteur branchés en dérivation', test: function (h) { return derivOf(h, 'lamp', 'motor').length > 0; } },
        { text: 'Un interrupteur commande les deux', test: function (h) { return derivOf(h, 'lamp', 'motor').some(function (p) { return bothCtrl(h, p); }); } }
      ];
      return { lines: crit.map(function (c) { return c.text; }), criteria: crit };
    },
    // 6 : trois boucles, trois récepteurs
    function () {
      var v = pick(['lamps', 'mix', 'motor']), crit;
      function trio(h, types) {
        var pool = [];
        types.forEach(function (t) { h.names(t).forEach(function (n) { if (pool.indexOf(n) < 0) pool.push(n); }); });
        return triples(pool).filter(function (t) {
          var ty = t.map(function (n) { return h.lab.state(n).type; }).sort().join();
          return ty === types.slice().sort().join() && allDeriv(h, t);
        });
      }
      if (v === 'lamps') crit = [
        { text: 'Trois lampes branchées en dérivation', test: function (h) { return trio(h, ['lamp', 'lamp', 'lamp']).length > 0; } },
        { text: 'Chaque lampe a son propre interrupteur', test: function (h) { return trio(h, ['lamp', 'lamp', 'lamp']).some(function (t) { return t.every(function (x) { return ownSwitch(h, x, t.filter(function (y) { return y !== x; })); }); }); } }
      ];
      else if (v === 'mix') crit = [
        { text: 'Une lampe, un moteur et un buzzer branchés en dérivation', test: function (h) { return trio(h, ['lamp', 'motor', 'buzzer']).length > 0; } },
        { text: 'Un seul interrupteur les commande tous les trois', test: function (h) { return trio(h, ['lamp', 'motor', 'buzzer']).some(function (t) { return h.sw.some(function (K) { return t.every(function (x) { return h.controls(K, x); }); }); }); } }
      ];
      else crit = [
        { text: 'Un moteur et deux lampes branchés en dérivation', test: function (h) { return trio(h, ['motor', 'lamp', 'lamp']).length > 0; } },
        { text: 'Le moteur tourne tout le temps', test: function (h) { return trio(h, ['motor', 'lamp', 'lamp']).some(function (t) { return t.some(function (x) { return h.lab.state(x).type === 'motor' && h.always(x); }); }); } },
        { text: 'Chaque lampe a son propre interrupteur', test: function (h) { return trio(h, ['motor', 'lamp', 'lamp']).some(function (t) { var L = t.filter(function (x) { return h.lab.state(x).type === 'lamp'; }); return ownSwitch(h, L[0], [L[1]]) && ownSwitch(h, L[1], [L[0]]); }); } }
      ];
      return { lines: crit.map(function (c) { return c.text; }), criteria: crit };
    }
  ];

  var G1_BEHAVIOUR = [
    function () {
      var v = pick(['motor', 'dep', 'bell']), crit;
      if (v === 'motor') crit = [
        { text: 'Une lampe qui s\'allume avec un interrupteur', test: function (h) { return h.names('lamp').some(function (L) { return h.sw.some(function (K) { return h.controls(K, L); }); }); } },
        { text: 'Un moteur qui tourne tout le temps', test: function (h) { return h.names('motor').some(h.always); } }
      ];
      else if (v === 'dep') crit = [
        { text: 'Deux lampes qui s\'allument et s\'éteignent ensemble avec un interrupteur', test: function (h) { return pairs(h.names('lamp'), h.names('lamp')).some(function (p) { return bothCtrl(h, p); }); } },
        { text: 'Si l\'une est dévissée, l\'autre s\'éteint aussi', test: function (h) { return pairs(h.names('lamp'), h.names('lamp')).some(function (p) { return bothCtrl(h, p) && !h.survives(p[0], p[1]) && !h.survives(p[1], p[0]); }); } }
      ];
      else crit = [
        { text: 'Un buzzer qui sonne quand on ferme un interrupteur', test: function (h) { return h.names('buzzer').some(function (B) { return h.sw.some(function (K) { return h.controls(K, B); }); }); } },
        { text: 'Une lampe qui reste toujours allumée', test: function (h) { return h.names('lamp').some(h.always); } }
      ];
      return { lines: crit.map(function (c) { return c.text; }), criteria: crit };
    },
    function () {
      var v = pick(['indep', 'own', 'general']), crit;
      if (v === 'indep') crit = [
        { text: 'Deux lampes qui s\'allument ensemble avec un seul interrupteur', test: function (h) { return pairs(h.names('lamp'), h.names('lamp')).some(function (p) { return bothCtrl(h, p); }); } },
        { text: 'Si l\'une est dévissée, l\'autre continue de briller', test: function (h) { return pairs(h.names('lamp'), h.names('lamp')).some(function (p) { return bothCtrl(h, p) && h.survives(p[0], p[1]) && h.survives(p[1], p[0]); }); } }
      ];
      else if (v === 'own') crit = [
        { text: 'Deux lampes, chacune allumée et éteinte par son propre interrupteur', test: function (h) { return pairs(h.names('lamp'), h.names('lamp')).some(function (p) { return ownSwitch(h, p[0], [p[1]]) && ownSwitch(h, p[1], [p[0]]); }); } }
      ];
      else crit = [
        { text: 'Un interrupteur qui coupe à la fois le moteur et la lampe', test: function (h) { return pairs(h.names('motor'), h.names('lamp')).some(function (p) { return bothCtrl(h, p); }); } },
        { text: 'Un autre interrupteur qui éteint seulement la lampe', test: function (h) { return pairs(h.names('motor'), h.names('lamp')).some(function (p) { return bothCtrl(h, p) && ownSwitch(h, p[1], [p[0]]); }); } }
      ];
      return { lines: crit.map(function (c) { return c.text; }), criteria: crit };
    },
    function () {
      var v = pick(['moto', 'mixed', 'general']), crit;
      if (v === 'moto') crit = [
        { text: 'Trois lampes qui s\'allument ensemble avec un seul interrupteur', test: function (h) { return triples(h.names('lamp')).some(function (t) { return h.sw.some(function (K) { return t.every(function (x) { return h.controls(K, x); }); }); }); } },
        { text: 'Si une lampe grille, les deux autres restent allumées', test: function (h) { return triples(h.names('lamp')).some(function (t) { return t.every(function (x) { return t.every(function (y) { return x === y || h.survives(x, y); }); }); }); } }
      ];
      else if (v === 'mixed') crit = [
        { text: 'Une lampe toujours allumée', test: function (h) { return h.names('lamp').some(h.always); } },
        { text: 'Deux autres lampes qui s\'allument ensemble avec un même interrupteur', test: function (h) { return pairs(h.names('lamp'), h.names('lamp')).some(function (p) { return bothCtrl(h, p) && !h.always(p[0]) && !h.always(p[1]); }); } },
        { text: 'Si l\'une de ces deux lampes est dévissée, l\'autre reste allumée', test: function (h) { return pairs(h.names('lamp'), h.names('lamp')).some(function (p) { return bothCtrl(h, p) && h.survives(p[0], p[1]) && h.survives(p[1], p[0]); }); } }
      ];
      else crit = [
        { text: 'Deux lampes, chacune commandée par son propre interrupteur', test: function (h) { return pairs(h.names('lamp'), h.names('lamp')).some(function (p) { return ownSwitch(h, p[0], [p[1]]) && ownSwitch(h, p[1], [p[0]]); }); } },
        { text: 'Un interrupteur général qui éteint les deux lampes', test: function (h) { return pairs(h.names('lamp'), h.names('lamp')).some(function (p) { return ownSwitch(h, p[0], [p[1]]) && ownSwitch(h, p[1], [p[0]]) && bothCtrl(h, p); }); } }
      ];
      return { lines: crit.map(function (c) { return c.text; }), criteria: crit };
    }
  ];

  /* ================= Groupe 2 : circuits réalistes ================= */
  var G2_PALETTE = ['gen', 'lamp', 'motor', 'led', 'res', 'buzzer', 'sw', 'voltmeter', 'ammeter', 'ohmmeter'];
  function lampV(opt) { return ['3 V', '6 V', '12 V'][opt]; }
  function crit(text, test) { return { text: text, test: test }; }
  function both(h, p, f) { return f(p[0]) && f(p[1]); }

  var G2_SPEC = [
    function () {
      return pick([
        [crit('Deux lampes de 3 V branchées en série', function (h) { return serieOfOpt(h, 'lamp', 0, 'lamp', 0).length > 0; }),
          crit('Elles brillent normalement', function (h) { return serieOfOpt(h, 'lamp', 0, 'lamp', 0).some(function (p) { return both(h, p, h.normal); }); })],
        [crit('Une lampe de 12 V commandée par un interrupteur', function (h) { return h.names('lamp', 2).some(function (L) { return h.sw.some(function (K) { return h.controls(K, L); }); }); }),
          crit('Elle brille normalement', function (h) { return h.names('lamp', 2).some(h.normal); })],
        [crit('Un moteur de 6 V et une lampe de 6 V branchés en dérivation', function (h) { return derivOfOpt(h, 'motor', 1, 'lamp', 1).length > 0; }),
          crit('Le moteur tourne normalement', function (h) { return derivOfOpt(h, 'motor', 1, 'lamp', 1).some(function (p) { return h.normal(p[0]); }); })]
      ]);
    },
    function () {
      return pick([
        [crit('Deux lampes de 6 V branchées en série', function (h) { return serieOfOpt(h, 'lamp', 1, 'lamp', 1).length > 0; }),
          crit('Un interrupteur qui commande les deux', function (h) { return serieOfOpt(h, 'lamp', 1, 'lamp', 1).some(function (p) { return bothCtrl(h, p); }); }),
          crit('Elles brillent normalement', function (h) { return serieOfOpt(h, 'lamp', 1, 'lamp', 1).some(function (p) { return both(h, p, h.normal); }); })],
        [crit('Un moteur de 3 V et une lampe de 3 V branchés en dérivation', function (h) { return derivOfOpt(h, 'motor', 0, 'lamp', 0).length > 0; }),
          crit('Ils fonctionnent normalement', function (h) { return derivOfOpt(h, 'motor', 0, 'lamp', 0).some(function (p) { return both(h, p, h.normal); }); })],
        [crit('Une lampe de 6 V et un buzzer branchés en dérivation', function (h) { return derivOfOpt(h, 'lamp', 1, 'buzzer', null).length > 0; }),
          crit('La lampe brille normalement', function (h) { return derivOfOpt(h, 'lamp', 1, 'buzzer', null).some(function (p) { return h.normal(p[0]); }); }),
          crit('Le buzzer sonne', function (h) { return derivOfOpt(h, 'lamp', 1, 'buzzer', null).some(function (p) { return h.on(p[1]); }); })]
      ]);
    },
    function () {
      return pick([
        [crit('Une lampe de 6 V en dérivation de deux lampes de 3 V branchées en série', function (h) { return mixed(h, 'lamp', 1, 'lamp', 0).length > 0; }),
          crit('Les trois lampes brillent normalement', function (h) { return mixed(h, 'lamp', 1, 'lamp', 0).some(function (t) { return t.every(h.normal); }); })],
        [crit('Un moteur de 12 V en dérivation de deux lampes de 6 V branchées en série', function (h) { return mixed(h, 'motor', 2, 'lamp', 1).length > 0; }),
          crit('Tout fonctionne normalement', function (h) { return mixed(h, 'motor', 2, 'lamp', 1).some(function (t) { return t.every(h.normal); }); })],
        [crit('Trois lampes de 3 V branchées en dérivation', function (h) { return triples(h.names('lamp', 0)).some(function (t) { return allDeriv(h, t); }); }),
          crit('Chacune a son propre interrupteur', function (h) { return triples(h.names('lamp', 0)).some(function (t) { return allDeriv(h, t) && t.every(function (x) { return ownSwitch(h, x, t.filter(function (y) { return y !== x; })); }); }); }),
          crit('Elles brillent normalement', function (h) { return nNormal(h, 'lamp', 0, 3); })]
      ]);
    }
  ];
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

  // Défis : meilleure chaleur / lumière calculées d'avance avec le matériel disponible
  function bestHeat() {
    var best = 0;
    GEN_V.forEach(function (U) { [47, 220, 1000].forEach(function (R) { if (U / Math.sqrt(R) <= 1.15) best = Math.max(best, U * U / R); }); });
    return best;
  }
  var G2_CHALLENGE = [
    function () {
      var v = pick(['heat', 'light', 'buzz']);
      if (v === 'heat') {
        var best = bestHeat();
        return {
          stock: { gen: 1, res: 1 },
          intro: 'Je veux me chauffer le plus fort possible avec une seule résistance, sans qu\'elle surchauffe.',
          criteria: [
            crit('La résistance chauffe le plus possible', function (h) { return h.names('res').some(function (r) { var s = h.s(r); return s.P >= best * .95; }); }),
            crit('Elle ne surchauffe pas', function (h) { return h.names('res').length > 0 && h.names('res').every(h.safe); })
          ]
        };
      }
      if (v === 'light') return {
        stock: { gen: 1, lamp: 2 },
        intro: 'Je veux la lumière la plus forte possible avec deux lampes, sans qu\'aucune ne surchauffe.',
        criteria: [
          crit('Les deux lampes éclairent le plus possible', function (h) { return h.names('lamp').reduce(function (t, n) { return t + h.s(n).P; }, 0) >= 2.4 * .95; }),
          crit('Aucune lampe ne surchauffe', function (h) { return h.names('lamp').length > 0 && h.names('lamp').every(h.safe); })
        ]
      };
      return {
        stock: { gen: 1, buzzer: 3 },
        intro: 'Je veux trois buzzers que je peux faire sonner autant que je veux, chacun indépendamment des autres.',
        criteria: [
          crit('Trois buzzers qui sonnent', function (h) { return h.names('buzzer').filter(h.on).length >= 3; }),
          crit('Chacun s\'arrête avec son propre interrupteur, sans couper les autres', function (h) {
            var b = h.names('buzzer');
            return b.length >= 3 && b.every(function (x) { return ownSwitch(h, x, b.filter(function (y) { return y !== x; })); });
          })
        ]
      };
    },
    function () {
      return pick([
        { intro: 'Je veux deux lampes qui brillent normalement, et pouvoir éteindre chacune sans éteindre l\'autre.',
          criteria: [
            crit('Deux lampes qui brillent normalement', function (h) { return h.names('lamp').filter(h.normal).length >= 2; }),
            crit('Chacune s\'éteint avec son propre interrupteur, sans éteindre l\'autre', function (h) {
              return pairs(h.names('lamp'), h.names('lamp')).some(function (p) { return both(h, p, h.normal) && ownSwitch(h, p[0], [p[1]]) && ownSwitch(h, p[1], [p[0]]); });
            })] },
        { intro: 'Je veux un ventilateur (un moteur) qui tourne normalement et une veilleuse (une DEL) allumée en même temps, avec un seul générateur.',
          criteria: [
            crit('Le moteur tourne normalement', function (h) { return h.names('motor').some(h.normal); }),
            crit('La DEL brille normalement en même temps', function (h) { return h.names('led').some(h.normal); })] },
        { intro: 'Une sonnette : un buzzer qui sonne seulement quand on ferme l\'interrupteur, et une lampe de 6 V qui brille normalement tout le temps.',
          criteria: [
            crit('Un buzzer qui sonne seulement quand on ferme l\'interrupteur', function (h) { return h.names('buzzer').some(function (B) { return h.sw.some(function (K) { return h.controls(K, B); }); }); }),
            crit('Une lampe de 6 V qui brille normalement tout le temps', function (h) { return h.names('lamp', 1).some(function (L) { return h.normal(L) && h.always(L); }); })] }
      ]);
    },
    function () {
      return pick([
        { intro: 'Une guirlande : quatre lampes de 3 V qui brillent toutes normalement.',
          criteria: [crit('Quatre lampes de 3 V qui brillent normalement', function (h) { return nNormal(h, 'lamp', 0, 4); })] },
        { intro: 'Six lampes de 6 V qui brillent toutes normalement.',
          criteria: [crit('Six lampes de 6 V qui brillent normalement', function (h) { return nNormal(h, 'lamp', 1, 6); })] },
        { intro: 'Un moteur de 12 V et deux lampes de 6 V qui fonctionnent tous normalement, avec un interrupteur qui commande seulement le moteur.',
          criteria: [
            crit('Un moteur de 12 V et deux lampes de 6 V qui fonctionnent normalement', function (h) { return nNormal(h, 'motor', 2, 1) && nNormal(h, 'lamp', 1, 2); }),
            crit('Un interrupteur qui commande seulement le moteur', function (h) {
              var L = h.names('lamp', 1).filter(h.normal);
              return h.names('motor', 2).some(function (M) { return h.normal(M) && ownSwitch(h, M, L); });
            })] }
      ]);
    }
  ];

  // Valeurs imposées : générateur (et parfois récepteurs) bloqués sur un réglage
  var G2_FORCED = [
    function () {
      return pick([
        { gen: 3, lock: { lamp: 1 }, intro: 'Le générateur est bloqué sur 12 V et les lampes sur 6 V : fais briller normalement deux lampes.', criteria: [crit('Deux lampes qui brillent normalement', function (h) { return nNormal(h, 'lamp', 1, 2); })] },
        { gen: 1, lock: { lamp: 0 }, intro: 'Le générateur est bloqué sur 6 V et les lampes sur 3 V : fais briller normalement deux lampes.', criteria: [crit('Deux lampes qui brillent normalement', function (h) { return nNormal(h, 'lamp', 0, 2); })] },
        { gen: 3, lock: { motor: 1 }, intro: 'Le générateur est bloqué sur 12 V et les moteurs sur 6 V : fais tourner normalement deux moteurs.', criteria: [crit('Deux moteurs qui tournent normalement', function (h) { return nNormal(h, 'motor', 1, 2); })] }
      ]);
    },
    function () {
      return pick([
        { gen: 1, lock: { lamp: 0 }, intro: 'Le générateur est bloqué sur 6 V et les lampes sur 3 V : fais briller normalement quatre lampes.', criteria: [crit('Quatre lampes qui brillent normalement', function (h) { return nNormal(h, 'lamp', 0, 4); })] },
        { gen: 3, lock: { lamp: 1 }, intro: 'Le générateur est bloqué sur 12 V et les lampes sur 6 V : fais briller normalement quatre lampes.', criteria: [crit('Quatre lampes qui brillent normalement', function (h) { return nNormal(h, 'lamp', 1, 4); })] },
        { gen: 3, lock: { lamp: 0 }, intro: 'Le générateur est bloqué sur 12 V et les lampes sur 3 V : fais briller normalement quatre lampes, avec un interrupteur qui les éteint toutes.',
          criteria: [crit('Quatre lampes qui brillent normalement', function (h) { return nNormal(h, 'lamp', 0, 4); }),
            crit('Un interrupteur qui les éteint toutes', function (h) { var L = h.names('lamp', 0).filter(h.normal); return L.length >= 4 && h.sw.some(function (K) { return L.every(function (x) { return h.controls(K, x); }); }); })] }
      ]);
    },
    function () {
      return pick([
        { gen: 3, intro: 'Le générateur est bloqué sur 12 V : fais fonctionner normalement une lampe de 12 V, deux lampes de 6 V et quatre lampes de 3 V.',
          criteria: [crit('Une lampe de 12 V qui brille normalement', function (h) { return nNormal(h, 'lamp', 2, 1); }), crit('Deux lampes de 6 V qui brillent normalement', function (h) { return nNormal(h, 'lamp', 1, 2); }), crit('Quatre lampes de 3 V qui brillent normalement', function (h) { return nNormal(h, 'lamp', 0, 4); })] },
        { gen: 3, intro: 'Le générateur est bloqué sur 12 V : fais fonctionner normalement un moteur de 12 V, deux lampes de 6 V et deux moteurs de 6 V.',
          criteria: [crit('Un moteur de 12 V qui tourne normalement', function (h) { return nNormal(h, 'motor', 2, 1); }), crit('Deux lampes de 6 V qui brillent normalement', function (h) { return nNormal(h, 'lamp', 1, 2); }), crit('Deux moteurs de 6 V qui tournent normalement', function (h) { return nNormal(h, 'motor', 1, 2); })] },
        { gen: 1, intro: 'Le générateur est bloqué sur 6 V : fais fonctionner normalement une lampe de 6 V, deux lampes de 3 V et deux moteurs de 3 V.',
          criteria: [crit('Une lampe de 6 V qui brille normalement', function (h) { return nNormal(h, 'lamp', 1, 1); }), crit('Deux lampes de 3 V qui brillent normalement', function (h) { return nNormal(h, 'lamp', 0, 2); }), crit('Deux moteurs de 3 V qui tournent normalement', function (h) { return nNormal(h, 'motor', 0, 2); })] }
      ]);
    }
  ];

  /* ================= Groupe 3 : mesures et lois ================= */
  var METERS1 = { voltmeter: 1, ammeter: 1, ohmmeter: 1 };
  function E(name, type, x, y, opt, extra) { var e = { name: name, type: type, x: x, y: y, opt: opt }; for (var k in extra) e[k] = extra[k]; return e; }
  function lock(c) { c.els.forEach(function (e) { if (!/meter/.test(e.type)) e.lock = true; }); c.wires = c.wires.map(function (w) { return { a: w[0], b: w[1], lock: true }; }); return c; }
  var OPT_V = [3, 6, 9, 12];

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
  function U(lab, n) { return lab.state(n).U; }
  function mA(lab, n) { return lab.state(n).I * 1000; }
  function rowU(n, label) { return { k: 'U' + n, label: label || 'Tension aux bornes de ' + n, unit: 'V', tol: .06, expect: function (lab) { return U(lab, n); } }; }
  function rowI(n, label) { return { k: 'I' + n, label: label, unit: 'mA', tol: 3, expect: function (lab) { return mA(lab, n); } }; }

  var G3_MEASURE = [
    function () {
      var d = pick([
        [2, ['L1', 'lamp', 0], ['L2', 'lamp', 2]],
        [1, ['L1', 'lamp', 0], ['M1', 'motor', 0]],
        [3, ['L1', 'lamp', 1], ['L2', 'lamp', 1]]
      ]);
      return { circuit: lock(loop1(d[0], d[1], d[2])), rows: [rowU(d[1][0]), rowU(d[2][0]), rowI('G1', 'Intensité dans le circuit')] };
    },
    function () {
      var d = pick([[1, ['L1', 'lamp', 1], ['M1', 'motor', 1]], [3, ['L1', 'lamp', 2], ['M1', 'motor', 2]], [0, ['L1', 'lamp', 0], ['M1', 'motor', 0]]]);
      var X = d[1][0], Y = d[2][0];
      return {
        circuit: lock(loop2(d[0], d[1], d[2])),
        rows: [rowU(X), rowU(Y), rowI('G1', 'Intensité à la sortie du générateur'), rowI(Y, 'Intensité qui traverse ' + Y)]
      };
    },
    function () {
      var d = pick([[1, ['L1', 'lamp', 1], ['L2', 'lamp', 0], ['L3', 'lamp', 0]], [3, ['M1', 'motor', 2], ['L1', 'lamp', 1], ['L2', 'lamp', 1]]]);
      var S = d[1][0], P = d[2][0], Q = d[3][0];
      return {
        circuit: lock(loop2s(d[0], d[1], d[2], d[3])),
        rows: [rowU(P), rowU(Q), rowI('G1', 'Intensité à la sortie du générateur'), rowI(S, 'Intensité qui traverse ' + S), rowI(P, 'Intensité entre ' + P + ' et ' + Q)]
      };
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
  var G3_DEDUCE = [
    function () {
      return pick([
        function () { var m = [V('V1', 'G1', [0, -1]), V('V2', 'L1', [0, 1]), V('V3', 'L2', [0, 1], true)]; return { circuit: withMeters(loop1(2, ['L1', 'lamp', 0], ['L2', 'lamp', 2]), m), rows: [hiddenRow(m[2], 'Tension aux bornes de L2')] }; },
        function () { var m = [V('V1', 'G1', [0, -1]), V('V2', 'L1', [0, 1]), V('V3', 'M1', [0, 1], true)]; return { circuit: withMeters(loop1(1, ['L1', 'lamp', 0], ['M1', 'motor', 0]), m), rows: [hiddenRow(m[2], 'Tension aux bornes de M1')] }; },
        function () { var m = [A('A1', 'G1.0', 'L1.0'), A('A2', 'L1.1', 'L2.0', true)]; return { circuit: withMeters(loop1(3, ['L1', 'lamp', 1], ['L2', 'lamp', 1]), m), rows: [hiddenRow(m[1], 'Intensité entre L1 et L2')] }; }
      ])();
    },
    function () {
      return pick([
        function () { var m = [A('A1', 'G1.0', 'L1.0'), A('A2', 'L1.1', 'G1.1'), A('A3', 'L1.0', 'M1.0', true)]; return { circuit: withMeters(loop2(1, ['L1', 'lamp', 1], ['M1', 'motor', 1]), m), rows: [hiddenRow(m[2], 'Intensité qui traverse M1')] }; },
        function () { var m = [V('V1', 'G1', [0, -1]), V('V2', 'M1', [0, 1], true)]; return { circuit: withMeters(loop2(3, ['L1', 'lamp', 2], ['M1', 'motor', 2]), m), rows: [hiddenRow(m[1], 'Tension aux bornes de M1')] }; },
        function () { var m = [A('A1', 'G1.0', 'L1.0', true), A('A2', 'L1.1', 'G1.1'), A('A3', 'L1.0', 'M1.0')]; return { circuit: withMeters(loop2(0, ['L1', 'lamp', 0], ['M1', 'motor', 0]), m), rows: [hiddenRow(m[0], 'Intensité à la sortie du générateur')] }; }
      ])();
    },
    function () {
      return pick([
        function () {
          var m = [V('V1', 'G1', [0, -1]), V('V2', 'L2', [0, -1]), V('V3', 'L3', [0, -1], true), A('A1', 'G1.0', 'L2.0'), A('A2', 'L2.0', 'L1.0'), A('A3', 'L2.1', 'L3.0', true)];
          return { circuit: withMeters(loop2s(1, ['L1', 'lamp', 1], ['L2', 'lamp', 0], ['L3', 'lamp', 0]), m), rows: [hiddenRow(m[2], 'Tension aux bornes de L3'), hiddenRow(m[5], 'Intensité entre L2 et L3')] };
        },
        function () {
          var m = [V('V1', 'G1', [0, -1]), V('V2', 'M1', [0, 1], true), A('A1', 'G1.0', 'L1.0'), A('A2', 'L1.0', 'M1.0', true), A('A3', 'L1.1', 'L2.0')];
          return { circuit: withMeters(loop2s(3, ['M1', 'motor', 2], ['L1', 'lamp', 1], ['L2', 'lamp', 1]), m), rows: [hiddenRow(m[1], 'Tension aux bornes de M1'), hiddenRow(m[3], 'Intensité qui traverse M1')] };
        }
      ])();
    }
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
  var G3_BUILD = [
    function () {
      return pick([
        { gen: 2, parts: [['L1', 'lamp', 0], ['L2', 'lamp', 2]], targets: [['L1', 'U', 1], ['L2', 'U', 8]] },
        { gen: 1, parts: [['L1', 'lamp', 1], ['M1', 'motor', 1]], targets: [['L1', 'U', 6], ['M1', 'U', 6], ['G1', 'I', 400]] },
        { gen: 3, parts: [['L1', 'lamp', 1], ['L2', 'lamp', 1]], targets: [['L1', 'U', 6], ['L2', 'U', 6], ['G1', 'I', 100]] }
      ]);
    },
    function () {
      return pick([
        { gen: 1, parts: [['L1', 'lamp', 1], ['L2', 'lamp', 0], ['L3', 'lamp', 0]], targets: [['L1', 'U', 6], ['L2', 'U', 3], ['L3', 'U', 3], ['G1', 'I', 300]] },
        { gen: 3, parts: [['M1', 'motor', 2], ['L1', 'lamp', 1], ['L2', 'lamp', 1]], targets: [['M1', 'U', 12], ['L1', 'U', 6], ['L2', 'U', 6], ['G1', 'I', 350]] }
      ]);
    },
    function () {
      return pick([
        { gen: 3, parts: [['L1', 'lamp', 2], ['L2', 'lamp', 1], ['L3', 'lamp', 1], ['M1', 'motor', 2]], targets: [['L1', 'U', 12], ['L2', 'U', 6], ['L3', 'U', 6], ['M1', 'U', 12], ['G1', 'I', 450]] },
        { gen: 3, parts: [['L1', 'lamp', 1], ['L2', 'lamp', 1], ['L3', 'lamp', 0], ['L4', 'lamp', 0], ['L5', 'lamp', 0], ['L6', 'lamp', 0]], targets: [['L1', 'U', 6], ['L2', 'U', 6], ['L3', 'U', 3], ['L4', 'U', 3], ['L5', 'U', 3], ['L6', 'U', 3], ['G1', 'I', 300]] },
        { gen: 1, parts: [['L1', 'lamp', 1], ['L2', 'lamp', 0], ['L3', 'lamp', 0], ['M1', 'motor', 0], ['M2', 'motor', 0]], targets: [['L1', 'U', 6], ['L2', 'U', 3], ['L3', 'U', 3], ['M1', 'U', 3], ['M2', 'U', 3], ['G1', 'I', 500]] }
      ]);
    }
  ];

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
    var m = { g: g, k: k, points: gr.points[row], malus: gr.malus, tag: gr.tags[row], title: TITLES[g][k], group: gr.name };
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
        m.criteria = b.targets.map(function (x) { return target(x[0], x[1], x[2]); });
        m.panel = {
          kind: 'spec', title: 'Valeurs à obtenir',
          lines: ['Générateur G1 bloqué sur ' + OPT_V[b.gen] + ' V ; réglages des dipôles bloqués.'].concat(m.criteria.map(function (x) { return x.text; }))
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
