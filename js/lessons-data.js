// Contenu du mode Leçon : chaque cours est une suite de consignes vérifiées automatiquement sur le labo.
// step : { title, text (explication), task (ce qu'il faut faire, rappelé dans le bandeau), how (aide),
//          circuit (circuit imposé chargé à cette consigne), palette (éléments disponibles), toggles (cases visibles),
//          fixedTypes (types aux réglages bloqués), set (réglages appliqués au départ), unlock (éléments / 'wires' libérés),
//          start(lab) → état noté au départ, check(lab, evs, ctx) → true quand la tâche est réussie,
//          rename(lab) → { ancien: nouveau } : noms du schéma donnés aux dipôles une fois la construction réussie,
//          hold (ms pendant lesquels elle doit le rester) }
// Consigne 'measure' : rows (une valeur par ligne) ou grid { head, rows, cols: [{ k, head (texte ou fonction(lab)),
//          from (consigne dont la colonne reprend les valeurs notées), fallback }] }, expect(lab) → valeurs attendues,
//          ready(lab) → message tant que la mesure ne peut pas encore être vérifiée
window.LessonsData = (function () {
  // ---- Petites aides de vérification ----
  function has(lab, type) { return lab.names(type).length > 0; }
  function works(lab, type) { return lab.names(type).some(function (n) { return lab.state(n).on; }); }
  // Un interrupteur fermé commande une lampe allumée (ils sont en série)
  function switchOn(lab) {
    return lab.names('sw').some(function (k) {
      return lab.state(k).closed && lab.names('lamp').some(function (l) { return lab.state(l).on && lab.relation(k, l) === 'serie'; });
    });
  }
  // Générateur, lampe et interrupteur ouvert forment une boucle complète
  function openLoop(lab) {
    return lab.names('sw').some(function (k) {
      return !lab.state(k).closed && lab.names('gen').some(function (g) {
        return lab.names('lamp').some(function (l) { return lab.loop([g, l, k]); });
      });
    });
  }

  function lamps(lab) { return lab.names('lamp').map(function (n) { return lab.state(n); }); }
  function count(list, f) { return list.filter(f).length; }
  function on(s) { return s.on; }
  function broken(s) { return s.broken; }
  // Deux lampes allumées branchées en série
  function seriesOn(lab) {
    var ls = lab.names('lamp').filter(function (n) { return lab.state(n).on; });
    return ls.some(function (a) { return ls.some(function (b) { return a !== b && lab.relation(a, b) === 'serie'; }); });
  }
  // Circuit imposé : éléments et fils verrouillés (un fil donné sous forme d'objet sans « lock » reste libre)
  function locked(c) {
    c.els.forEach(function (e) { e.lock = true; });
    c.wires = c.wires.map(function (w) { return Array.isArray(w) ? { a: w[0], b: w[1], lock: true } : w; });
    return c;
  }
  // Générateur et lampe seuls
  function genLamp(gen, extra) {
    return {
      els: [{ name: 'G1', type: 'gen', x: 0, y: 0, opt: gen }, { name: 'L1', type: 'lamp', x: 0, y: 150, broken: !!(extra && extra.broken) }],
      wires: [['G1.0', 'L1.0'], ['L1.1', 'G1.1']].concat(extra && extra.short ? [{ a: 'L1.0', b: 'L1.1' }] : [])
    };
  }
  // Deux lampes en série, L1 éventuellement court-circuitée ou cassée
  function series(gen, o) {
    o = o || {};
    var c = {
      els: [
        { name: 'G1', type: 'gen', x: 0, y: 0, opt: gen },
        { name: 'L1', type: 'lamp', x: -60, y: 150, broken: !!o.broken },
        { name: 'L2', type: 'lamp', x: 60, y: 150 }
      ],
      wires: [['G1.0', 'L1.0'], ['L1.1', 'L2.0'], ['L2.1', 'G1.1']]
    };
    if (o.short) c.wires.push({ a: 'L1.0', b: 'L1.1' });
    return c;
  }
  // Deux lampes en dérivation
  function parallel(o) {
    o = o || {};
    return {
      els: [
        { name: 'G1', type: 'gen', x: 0, y: 0, opt: 1 },
        { name: 'L1', type: 'lamp', x: 0, y: 120, broken: !!o.broken },
        { name: 'L2', type: 'lamp', x: 0, y: 220 }
      ],
      wires: [['G1.0', 'L1.0'], ['L1.1', 'G1.1'], ['L1.0', 'L2.0'], ['L2.1', 'L1.1']]
    };
  }

  var NONE = { schema: false, current: false, electrons: false };

  // ---- Cours 7 : lois de l'électricité ----
  function gen(lab) { return lab.names('gen')[0]; }
  function lampOf(lab, opt) { return lab.names('lamp').filter(function (n) { return lab.state(n).opt === opt; }); }
  function U(lab, n) { return n ? lab.state(n).U : null; }
  function mA(lab, n) { return n ? lab.state(n).I * 1000 : null; }
  // Schémas de référence (lampes : opt 0 = 3 V, opt 1 = 6 V)
  var L1_TARGET = {
    els: [
      { name: 'G1', type: 'gen', x: 0, y: 0, opt: 2 },
      { name: 'L1', type: 'lamp', x: -60, y: 150, opt: 0 },
      { name: 'L2', type: 'lamp', x: 60, y: 150, opt: 1 }
    ],
    wires: [['G1.0', 'L1.0'], ['L1.1', 'L2.0'], ['L2.1', 'G1.1']]
  };
  // Chaque borne du générateur et la lampe L1 n'ont qu'un fil : on peut mesurer l'intensité
  // à la sortie du générateur et juste avant L1 (sinon ces fils n'existent pas)
  var L2_TARGET = {
    els: [
      { name: 'G1', type: 'gen', x: 0, y: 0, opt: 1 },
      { name: 'L2', type: 'lamp', x: -80, y: 130, opt: 0 },
      { name: 'L3', type: 'lamp', x: 80, y: 130, opt: 0 },
      { name: 'L1', type: 'lamp', x: 0, y: 240, opt: 1 }
    ],
    wires: [['G1.0', 'L2.0'], ['L2.1', 'L3.0'], ['L3.1', 'G1.1'], ['L2.0', 'L1.0'], ['L1.1', 'L3.1']]
  };
  // Ajoute des appareils de mesure à un circuit (un ampèremètre prend la place de son fil)
  function withMeters(c, meters) {
    var taken = meters.filter(function (m) { return m.between; }).map(function (m) { return m.between.slice().sort().join(); });
    return {
      els: c.els.concat(meters),
      wires: c.wires.filter(function (w) { return taken.indexOf(w.slice().sort().join()) < 0; })
    };
  }
  // Niveau 1 : générateur 9 V, lampes 3 V et 6 V dans une seule boucle
  function oneLoop(lab) {
    var g = lab.names('gen'), ls = lab.names('lamp');
    if (g.length !== 1 || ls.length !== 2 || !lab.loop([g[0], ls[0], ls[1]])) return { ok: false };
    if (ls.some(function (n) { return lab.state(n).broken; })) return { ok: false, hint: 'Une lampe a grillé : remplace-la depuis sa fenêtre et vérifie les réglages.' };
    var o = ls.map(function (n) { return lab.state(n).opt; }).sort();
    if (lab.state(g[0]).opt !== 2 || o[0] !== 0 || o[1] !== 1) return { ok: false, hint: 'Les branchements sont bons : vérifie les réglages (générateur sur 9 V, une lampe de 3 V et une lampe de 6 V).' };
    // Noms du schéma : L1 = lampe de 3 V, L2 = lampe de 6 V
    var map = {};
    map[g[0]] = 'G1'; map[lampOf(lab, 0)[0]] = 'L1'; map[lampOf(lab, 1)[0]] = 'L2';
    return { ok: lab.closed(), map: map };
  }
  // Niveau 2 : une lampe de 6 V en dérivation de deux lampes de 3 V en série, générateur 6 V,
  // avec un seul fil sur la borne + du générateur et sur la lampe seule (pour les mesures d'intensité)
  function twoLoops(lab) {
    var g = lab.names('gen'), ls = lab.names('lamp'), X = null, P = null;
    if (g.length !== 1 || ls.length !== 3) return { ok: false };
    ls.forEach(function (x) {
      var o = ls.filter(function (n) { return n !== x; });
      if (lab.relation(o[0], o[1]) === 'serie' && lab.relation(x, o[0]) === 'derivation') { X = x; P = o; }
    });
    if (!X || !lab.closed()) return { ok: false };
    if (ls.some(function (n) { return lab.state(n).broken; })) return { ok: false, hint: 'Une lampe a grillé : remplace-la depuis sa fenêtre et vérifie les réglages.' };
    if (lab.state(g[0]).opt !== 1 || lab.state(X).opt !== 1 || lab.state(P[0]).opt !== 0 || lab.state(P[1]).opt !== 0) {
      return { ok: false, hint: 'Les branchements sont bons : vérifie les réglages (générateur sur 6 V, lampe seule de 6 V, deux lampes de 3 V en série).' };
    }
    var meas = lab.wiresAt(g[0], 0) === 1 && (lab.wiresAt(X, 0) === 1 || lab.wiresAt(X, 1) === 1) && lab.linked(P[0], P[1]);
    // Noms du schéma : L1 = lampe seule de 6 V, L2 et L3 = lampes de 3 V en série
    var map = {};
    map[g[0]] = 'G1'; map[X] = 'L1'; map[P[0]] = 'L2'; map[P[1]] = 'L3';
    return meas ? { ok: true, map: map } : {
      ok: false, hint: 'Ton circuit fonctionne, mais on ne pourra pas mesurer toutes les intensités : relie la borne + du générateur par un seul fil, et la lampe de 6 V par un seul fil, comme sur le schéma.'
    };
  }

  // ---- Cours 8 : loi d'Ohm ----
  // Fraction écrite sur deux étages
  function frac(a, b) { return '<span class="frac"><span>' + a + '</span><span>' + b + '</span></span>'; }
  // Générateur 6 V et résistance R1 (47 Ω au départ)
  function ohmCircuit(opt) {
    return {
      els: [{ name: 'G1', type: 'gen', x: 0, y: 0, opt: 1 }, { name: 'R1', type: 'res', x: 0, y: 170, opt: opt || 0 }],
      wires: [['G1.0', 'R1.0'], ['R1.1', 'G1.1']]
    };
  }
  // Lignes du tableau (une colonne par valeur de R1) ; intensité notée en ampères
  var OHM_ROWS = [
    { k: 'U', label: 'Tension U', unit: 'V', tol: .06 },
    { k: 'I', label: 'Intensité I', unit: 'A', tol: .0005 }
  ];
  function ohmExpect(lab) { var r = lab.state('R1'); return { U: r.U, I: r.I }; }
  function ohms(lab) { var R = Comp.TYPES.res.opts[lab.state('R1').opt]; return (R >= 1000 ? '1 000' : R) + ' Ω'; }
  // Circuit de l'étude avec voltmètre et ampèremètre, pour « À retenir »
  function ohmMeasured(opt) {
    return withMeters(ohmCircuit(opt), [{ name: 'V1', type: 'voltmeter', on: 'R1', dir: [0, 1] }, { name: 'A1', type: 'ammeter', between: ['R1.1', 'G1.1'] }]);
  }

  // Circuit de démonstration : générateur, interrupteur et lampe en rectangle
  function basic(closed, extra) {
    var c = {
      els: [
        { name: 'G1', type: 'gen', x: 0, y: 0 },
        { name: 'K1', type: 'sw', x: 140, y: 80, rot: 90, closed: closed, noToggle: true },
        { name: 'L1', type: 'lamp', x: 0, y: 160 }
      ],
      wires: [['G1.1', 'K1.0'], ['K1.1', 'L1.1'], ['L1.0', 'G1.0']]
    };
    return extra ? Object.assign(c, extra) : c;
  }

  return [
    {
      id: 'circuit', title: 'Premier circuit électrique', sub: 'Générateur, récepteur, circuit ouvert ou fermé',
      lab: { toggles: NONE },
      steps: [
        {
          title: 'Le générateur', palette: ['gen'],
          text: 'L\'électricité est produite par un <b>dipôle générateur</b>. Sans lui, aucun circuit ne peut fonctionner.',
          task: 'Place un générateur dans l\'espace de travail.',
          how: 'Touche le générateur dans la barre de droite, ou fais-le glisser jusqu\'à l\'espace de travail.',
          check: function (lab) { return has(lab, 'gen'); }
        },
        {
          title: 'Le récepteur', palette: ['gen', 'lamp'],
          text: 'Pour qu\'un circuit serve à quelque chose, il doit contenir au moins un <b>dipôle récepteur</b> : il utilise l\'électricité pour produire de la lumière, du mouvement, du son…',
          task: 'Place une lampe dans l\'espace de travail.',
          check: function (lab) { return has(lab, 'lamp'); }
        },
        {
          title: 'Le circuit fermé', palette: ['gen', 'lamp'],
          text: 'Pour alimenter la lampe, le circuit doit être <b>fermé</b> : l\'électricité doit pouvoir partir du générateur, traverser la lampe et revenir au générateur.<br>Si le circuit ne permet pas de faire un tour complet, on dit qu\'il est <b>ouvert</b> : il ne fonctionne pas.',
          task: 'Relie les deux bornes du générateur aux deux bornes de la lampe.',
          how: 'Pour tirer un fil, appuie sur une borne et fais glisser jusqu\'à une autre borne.',
          check: function (lab) { return works(lab, 'lamp'); }
        },
        {
          title: 'L\'interrupteur', palette: ['gen', 'lamp', 'sw'],
          text: 'Un <b>interrupteur</b> permet d\'ouvrir et de fermer le circuit. Quand il est <b>fermé</b>, il laisse passer l\'électricité ; quand il est <b>ouvert</b>, il la bloque.',
          task: 'Supprime un fil, place un interrupteur dans le circuit, puis ferme-le.',
          how: 'Clique sur un fil pour le supprimer. Touche l\'interrupteur pour l\'ouvrir ou le fermer.',
          check: switchOn
        }
      ],
      end: 'Bravo, tu as construit ton premier circuit électrique !',
      recap: [
        { text: 'Un circuit électrique contient au moins un <b>dipôle générateur</b> (pile, générateur) et un <b>dipôle récepteur</b> (lampe, moteur…).' },
        { text: 'Un circuit ne fonctionne que s\'il est <b>fermé</b> : l\'électricité part du générateur, traverse les récepteurs et revient au générateur.' },
        {
          text: 'L\'<b>interrupteur</b> permet d\'ouvrir ou de fermer le circuit.',
          labs: [
            { caption: 'Interrupteur ouvert : le circuit est ouvert, la lampe est éteinte.', circuit: basic(false) },
            { caption: 'Interrupteur fermé : le circuit est fermé, la lampe brille.', circuit: basic(true) }
          ]
        }
      ]
    },

    {
      id: 'courant', title: 'Le sens du courant', sub: 'Électrons et sens conventionnel du courant',
      lab: { toggles: NONE },
      steps: [
        {
          title: 'Le circuit d\'étude', palette: ['gen', 'lamp', 'sw'],
          text: 'On va étudier le <b>sens du courant électrique</b> dans un circuit.',
          task: 'Construis un circuit avec un générateur, une lampe et un interrupteur ouvert.',
          how: 'L\'interrupteur est ouvert quand on le pose : relie simplement les trois dipôles en boucle.',
          check: openLoop
        },
        {
          title: 'Les électrons', palette: ['gen', 'lamp', 'sw'], toggles: { schema: false, current: false },
          text: 'Les métaux utilisés dans les fils sont pleins d\'<b>électrons</b> : des particules mobiles qui, par leur mouvement, constituent le courant électrique.',
          task: 'Coche « Électrons » pour voir qu\'il y en a partout dans les fils.',
          check: function (lab) { return lab.modes().electrons; }
        },
        {
          title: 'Le déplacement des électrons', palette: ['gen', 'lamp', 'sw'], toggles: { schema: false, current: false }, hold: 2000,
          text: 'Circuit ouvert, les électrons restent immobiles. Que se passe-t-il quand on ferme le circuit ?',
          task: 'Ferme le circuit et observe le sens de déplacement des électrons.',
          check: function (lab) { return lab.modes().electrons && works(lab, 'lamp'); }
        },
        {
          title: 'Le sens conventionnel', palette: ['gen', 'lamp', 'sw'], toggles: { schema: false },
          text: 'Les électrons se déplacent toujours de la borne <b>−</b> vers la borne <b>+</b> du générateur.<br>Pourtant, le sens du courant a été choisi <b>avant</b> la découverte des électrons : c\'est le <b>sens conventionnel</b>, représenté par une flèche rouge.',
          task: 'Coche « Sens du courant » et compare-le au déplacement des électrons.',
          check: function (lab) { return lab.modes().current; }
        }
      ],
      end: 'Bravo, tu connais maintenant le sens du courant électrique !',
      recap: [
        { text: 'Le courant électrique est dû au <b>déplacement des électrons</b>, présents partout dans les fils.' },
        { text: 'Dans le circuit, les électrons se déplacent de la borne <b>−</b> vers la borne <b>+</b> du générateur.' },
        {
          text: 'Le <b>sens conventionnel du courant</b> va de la borne <b>+</b> vers la borne <b>−</b> du générateur, à l\'extérieur du générateur. On le représente par une <b>flèche rouge</b> sur les fils : il est opposé au déplacement des électrons.',
          labs: [{ caption: 'Flèches rouges : sens conventionnel du courant. Points blancs : électrons.', circuit: basic(true), opts: { current: true, electrons: true } }]
        }
      ]
    },

    {
      id: 'dipoles', title: 'Les dipôles et les schémas', sub: 'Moteur, DEL, résistance, buzzer et schémas normalisés',
      // Les dipôles s'accumulent : pas de gestion de la tension, tout dipôle alimenté fonctionne au nominal
      lab: { toggles: { schema: false }, nominal: true },
      steps: [
        {
          title: 'Le circuit de départ', palette: ['gen', 'lamp', 'sw'],
          text: 'On part d\'un circuit simple, que l\'on va compléter petit à petit avec de nouveaux dipôles.',
          task: 'Construis un circuit avec un générateur, une lampe et un interrupteur fermé.',
          check: switchOn
        },
        {
          title: 'Le schéma', palette: ['gen', 'lamp', 'sw'], toggles: {},
          text: 'Pour représenter un circuit sur un document scientifique, on utilise un <b>schéma</b> et des <b>règles de schématisation</b> : chaque dipôle a son symbole, les fils sont des traits droits et le circuit forme un rectangle.',
          task: 'Coche « Vue schéma ».',
          check: function (lab) { return lab.modes().schema; }
        },
        {
          title: 'Le moteur', palette: ['gen', 'lamp', 'sw', 'motor'], toggles: {}, hold: 1500,
          text: 'Le <b>moteur</b> est un dipôle récepteur qui transforme l\'électricité en <b>mouvement</b>.',
          task: 'En plus de la lampe, ajoute un moteur dans le circuit, puis observe son fonctionnement et son symbole.',
          check: function (lab) { return has(lab, 'lamp') && works(lab, 'motor'); }
        },
        {
          title: 'La DEL', palette: ['gen', 'lamp', 'sw', 'motor', 'led'], toggles: {},
          text: 'La <b>diode électroluminescente</b> (DEL) est une lampe qui ne fonctionne que si elle est <b>bien orientée</b> : pour s\'allumer, elle doit être placée dans le même sens que le <b>sens conventionnel du courant</b>.',
          task: 'Ajoute une DEL dans le circuit et allume-la.',
          check: function (lab) { return works(lab, 'led'); }
        },
        {
          title: 'La résistance', palette: ['gen', 'lamp', 'sw', 'motor', 'led', 'res'], toggles: {},
          text: 'La <b>résistance</b> transforme l\'énergie électrique en <b>chaleur</b> : de petites ondes de chaleur montrent qu\'elle chauffe. Elle limite le passage du courant et permet de protéger les autres composants.',
          task: 'Place une résistance en série avec une lampe.',
          check: function (lab) {
            return lab.names('res').some(function (r) {
              return lab.state(r).I > 1e-5 && lab.names('lamp').some(function (l) { return lab.relation(r, l) === 'serie'; });
            });
          }
        },
        {
          title: 'Le buzzer', palette: ['gen', 'lamp', 'sw', 'motor', 'led', 'res', 'buzzer'], toggles: {},
          text: 'Le <b>buzzer</b> transforme l\'électricité en <b>son</b> : s\'il est alimenté, il sonne. Des petites ondes montrent qu\'il sonne, même si le son de ton appareil est coupé.',
          task: 'Ajoute un buzzer dans le circuit et fais-le sonner.',
          check: function (lab) { return works(lab, 'buzzer'); }
        }
      ],
      end: 'Bravo, tu connais maintenant les principaux dipôles et leurs symboles !',
      recap: [
        { text: 'Pour représenter un circuit, on trace un <b>schéma normalisé</b> à la règle : les fils sont des <b>traits droits</b>, le circuit forme un <b>rectangle</b> et les dipôles ne sont <b>jamais placés dans les coins</b>.' },
        { symbols: true },
        {
          text: 'La <b>DEL</b> ne s\'allume que si elle est orientée dans le <b>sens conventionnel du courant</b>.',
          labs: [{
            caption: 'D1 est bien orientée : elle brille. D2 est à l\'envers : elle reste éteinte.',
            opts: { schema: true, current: true },
            circuit: {
              els: [
                { name: 'G1', type: 'gen', x: 0, y: 0 },
                { name: 'D1', type: 'led', x: 0, y: 110 },
                { name: 'D2', type: 'led', x: 0, y: 210, rot: 180 }
              ],
              wires: [['G1.0', 'D1.0'], ['D1.1', 'G1.1'], ['G1.0', 'D2.1'], ['D2.0', 'G1.1']]
            }
          }]
        },
        { text: 'La <b>résistance</b> transforme l\'énergie électrique en <b>chaleur</b> et limite le passage du courant.' }
      ],
      symbols: [
        ['gen', 'Produit l\'électricité'], ['lamp', 'Lumière (et chaleur)'], ['sw', 'Ouvre ou ferme le circuit'],
        ['motor', 'Mouvement'], ['led', 'Lumière, dans un seul sens'], ['res', 'Chaleur, limite le courant'], ['buzzer', 'Son']
      ]
    },

    {
      id: 'nominal', title: 'Court-circuit et valeurs nominales', sub: 'Tension nominale, dipôle court-circuité, danger du court-circuit',
      // Circuits imposés : rien ne s'ajoute ni ne s'enlève, les réglages se libèrent au fil des consignes
      lab: { ideal: false, toggles: NONE },
      steps: [
        {
          title: 'La tension nominale', palette: [], fixedTypes: ['gen', 'lamp'],
          circuit: locked({
            els: [
              { name: 'G1', type: 'gen', x: 0, y: 0, opt: 3 },
              { name: 'K1', type: 'sw', x: 140, y: 80, rot: 90 },
              { name: 'L1', type: 'lamp', x: 0, y: 160 }
            ],
            wires: [['G1.1', 'K1.0'], ['K1.1', 'L1.1'], ['L1.0', 'G1.0']]
          }),
          text: 'Les dipôles sont fabriqués pour fonctionner avec une tension adaptée : c\'est leur <b>tension nominale</b>. Si un dipôle n\'en reçoit pas assez, il fonctionne mal ; s\'il en reçoit trop, il peut casser.',
          task: 'Ferme l\'interrupteur et observe la lampe.',
          check: function (lab) { return lab.state('L1').broken; }
        },
        {
          title: 'Régler le générateur', palette: [], fixedTypes: ['lamp'], hold: 2000,
          text: 'La lampe a cassé car elle recevait une <b>tension trop forte</b>. Clique sur la lampe pour connaître sa tension nominale, puis clique sur le générateur pour le régler correctement.',
          task: 'Règle le générateur, remplace la lampe et fais-la fonctionner normalement.',
          how: 'Le bouton « Remplacer la lampe » se trouve dans la fenêtre de la lampe.',
          check: function (lab) { var s = lab.state('L1'); return !s.broken && s.ratio >= .95; }
        },
        {
          title: 'Le court-circuit', palette: [], fixedTypes: ['gen', 'lamp'], toggles: { schema: false, current: false }, set: { electrons: true }, hold: 2000,
          circuit: locked({
            els: [
              { name: 'G1', type: 'gen', x: 0, y: 0, opt: 1 },
              { name: 'K1', type: 'sw', x: 180, y: 90, rot: 90, closed: true },
              { name: 'L1', type: 'lamp', x: 80, y: 200 },
              { name: 'L2', type: 'lamp', x: -100, y: 200 }
            ],
            wires: [['G1.1', 'K1.0'], ['K1.1', 'L1.1'], ['L1.0', 'L2.1'], ['L2.0', 'G1.0'], { a: 'L1.0', b: 'L1.1' }]
          }),
          text: 'Dans un circuit, les dipôles récepteurs utilisent l\'énergie électrique. Si l\'électricité peut contourner un dipôle par un fil, elle ne le traverse plus : il ne fonctionne pas, on dit qu\'il est <b>court-circuité</b>.',
          task: 'Supprime le fil en trop pour que l\'électricité alimente les deux lampes.',
          how: 'Observe le trajet des électrons : ils évitent la lampe court-circuitée.',
          check: function (lab) { return lab.state('L1').on && lab.state('L2').on; }
        },
        {
          title: 'Le danger du court-circuit', palette: [], fixedTypes: ['gen', 'lamp'], toggles: { schema: false, current: false }, set: { electrons: true },
          circuit: locked(genLamp(1)),
          text: 'Un court-circuit sur l\'ensemble du circuit peut très vite devenir <b>dangereux</b> : si l\'énergie n\'est utilisée par aucun dipôle, le fil chauffe et peut brûler.',
          task: 'Crée un court-circuit autour de la lampe en reliant ses deux bornes par un fil.',
          check: function (lab, evs) { return evs.indexOf('burn') >= 0; }
        }
      ],
      end: 'Bravo ! Tu sais pourquoi il faut respecter les tensions nominales et éviter les courts-circuits.',
      recap: [
        {
          text: 'Chaque dipôle a une <b>tension nominale</b> : la tension pour laquelle il est fabriqué. Trop faible, il fonctionne mal ; trop forte, il peut être détruit.',
          labs: [
            { caption: 'Tension adaptée (6 V pour une lampe de 6 V) : la lampe brille normalement.', circuit: genLamp(1) },
            { caption: 'Tension trop forte (12 V pour une lampe de 6 V) : la lampe a grillé.', circuit: genLamp(3, { broken: true }) }
          ]
        },
        {
          text: 'Un dipôle est <b>court-circuité</b> quand un fil permet à l\'électricité de le contourner : il ne fonctionne plus.',
          labs: [{ caption: 'L1 est court-circuitée : le courant passe par le fil, L1 reste éteinte et L2 brille.', circuit: series(1, { short: true }), opts: { current: true } }]
        },
        {
          text: 'Court-circuiter le générateur est <b>dangereux</b> : aucun dipôle n\'utilise l\'énergie, le fil chauffe et peut prendre feu.',
          labs: [{ caption: 'Le fil qui court-circuite le générateur chauffe.', circuit: genLamp(1, { short: true }), wait: 1800 }]
        }
      ]
    },

    {
      id: 'serie', title: 'Série et dérivation', sub: 'Deux façons de brancher les dipôles',
      lab: { ideal: false, toggles: { current: false, electrons: false }, defaults: { gen: 3 }, fixedTypes: ['gen', 'lamp'] },
      steps: [
        {
          title: 'Le branchement en série', palette: ['gen', 'lamp', 'sw'], hold: 2000,
          text: 'Il existe deux manières de brancher des dipôles. La plus simple est le <b>branchement en série</b> : les dipôles sont branchés les uns après les autres, sur un seul chemin.',
          task: 'Construis un circuit avec un générateur et deux lampes branchées l\'une après l\'autre.',
          check: seriesOn
        },
        {
          title: 'Des dipôles dépendants', palette: ['gen', 'lamp', 'sw'],
          text: 'Le problème du branchement en série, c\'est que les dipôles <b>dépendent</b> les uns des autres : si l\'un d\'eux ne fonctionne plus, il ouvre le circuit et empêche les autres de fonctionner.',
          task: 'Garde ton circuit, sélectionne une lampe et casse-la !',
          how: 'Touche une lampe : le bouton « Casser la lampe » est dans sa fenêtre.',
          check: function (lab) { var ls = lamps(lab); return ls.length >= 2 && count(ls, broken) >= 1 && count(ls, on) === 0; }
        },
        {
          title: 'Le branchement en dérivation', palette: ['lamp'], hold: 2000,
          circuit: locked(genLamp(1)),
          text: 'Pour éviter les problèmes du branchement en série, il existe le <b>branchement en dérivation</b> (ou en parallèle) : l\'électricité dispose de plusieurs chemins pour atteindre chaque dipôle, tout le temps.',
          task: 'Ajoute une lampe sous la première et branche-la aux bornes de la première lampe.',
          check: function (lab) { return count(lamps(lab), function (s) { return !s.broken && s.ratio >= .95; }) >= 2; }
        },
        {
          title: 'Des dipôles indépendants', palette: ['lamp'], hold: 2000,
          text: 'En dérivation, l\'électricité peut atteindre chaque lampe par son propre chemin, même si l\'autre est cassée.',
          task: 'Sélectionne une lampe et casse-la !',
          check: function (lab) { var ls = lamps(lab); return count(ls, broken) >= 1 && count(ls, on) === 1; }
        }
      ],
      end: 'Bravo ! Tu sais faire la différence entre un branchement en série et un branchement en dérivation.',
      recap: [
        {
          text: 'Dans un branchement <b>en série</b>, les dipôles sont branchés les uns après les autres : il n\'y a qu\'<b>un seul chemin</b> pour l\'électricité.',
          labs: [
            { caption: 'Les deux lampes en série brillent.', circuit: series(3) },
            { caption: 'Si une lampe est cassée, le circuit est ouvert : l\'autre lampe s\'éteint.', circuit: series(3, { broken: true }) }
          ]
        },
        {
          text: 'Dans un branchement <b>en dérivation</b>, chaque dipôle a <b>son propre chemin</b> : les dipôles fonctionnent indépendamment.',
          labs: [
            { caption: 'Les deux lampes en dérivation brillent.', circuit: parallel() },
            { caption: 'Si une lampe est cassée, l\'autre continue de briller.', circuit: parallel({ broken: true }) }
          ]
        }
      ]
    },

    {
      id: 'mesures', title: 'Mesures des grandeurs', sub: 'Mesurer la tension, l\'intensité et la résistance',
      // Circuits imposés, dipôles réglables selon la consigne, vues libres ; appareils de mesure débloqués au fil des consignes
      lab: { ideal: false, electrons: true, toggles: {} },
      steps: [
        {
          title: 'La tension électrique', palette: [], fixedTypes: ['motor', 'lamp', 'res'], hold: 2000,
          circuit: locked({
            els: [
              { name: 'G1', type: 'gen', x: 0, y: 0, opt: 0 },
              { name: 'K1', type: 'sw', x: 140, y: 80, rot: 90 },
              { name: 'M1', type: 'motor', x: 0, y: 160 }
            ],
            wires: [['G1.1', 'K1.0'], ['K1.1', 'M1.1'], ['M1.0', 'G1.0']]
          }),
          text: 'La première grandeur à connaître est la <b>tension électrique</b> : elle correspond à la « force » avec laquelle l\'électricité veut passer. C\'est cette valeur qui est nécessaire au fonctionnement d\'un dipôle.',
          task: 'Règle la tension du générateur pour alimenter correctement le moteur, puis ferme l\'interrupteur.',
          how: 'Touche un dipôle pour voir ses réglages et sa tension nominale.',
          check: function (lab) { var m = lab.state('M1'); return !m.broken && m.ratio >= .7; }
        },
        {
          title: 'Le voltmètre', palette: ['voltmeter'], fixedTypes: ['motor', 'lamp', 'res'], hold: 1500,
          text: 'Pour mesurer la tension, on utilise un <b>voltmètre</b>, que l\'on branche toujours <b>autour du dipôle</b> à mesurer : on dit qu\'il est branché <b>en dérivation</b>. La tension s\'exprime en <b>volts (V)</b>.',
          task: 'Sélectionne le voltmètre et place-le autour du moteur : il indique la tension à ses bornes.',
          check: function (lab) { return lab.names('voltmeter').some(function (v) { return lab.state(v).on === 'M1'; }); }
        },
        {
          title: 'Changer la tension', palette: ['voltmeter'], fixedTypes: ['motor', 'lamp', 'res'], hold: 1500,
          text: 'Que devient la tension du moteur si on change le réglage du générateur ?',
          task: 'Augmente un peu la tension du générateur et mesure à nouveau la tension du moteur : tu vas observer des changements.',
          start: function (lab) { return { opt: lab.state('G1').opt }; },
          check: function (lab, evs, ctx) {
            var m = lab.state('M1');
            return lab.state('G1').opt !== ctx.opt && !m.broken && m.I > 1e-4 &&
              lab.names('voltmeter').some(function (v) { return lab.state(v).on === 'M1'; });
          }
        },
        {
          title: 'L\'intensité électrique', palette: ['voltmeter', 'ammeter'], fixedTypes: ['gen', 'motor', 'lamp', 'res'], hold: 1500,
          circuit: locked({
            els: [
              { name: 'G1', type: 'gen', x: 0, y: 0, opt: 2 },
              { name: 'K1', type: 'sw', x: 180, y: 90, rot: 90 },
              { name: 'M2', type: 'motor', x: 80, y: 200 },
              { name: 'M1', type: 'motor', x: -100, y: 200 }
            ],
            wires: [['G1.1', 'K1.0'], ['K1.1', 'M2.1'], ['M2.0', 'M1.1'], ['M1.0', 'G1.0']]
          }),
          text: 'La deuxième grandeur à connaître est l\'<b>intensité électrique</b> : c\'est le débit de l\'électricité, la vitesse à laquelle elle passe. Elle dépend de la tension appliquée et de la facilité qu\'a l\'électricité à traverser les éléments du circuit.<br>Pour la mesurer, on place un <b>ampèremètre</b> entre deux dipôles : il est branché <b>en série</b>. L\'intensité s\'exprime en <b>ampères (A)</b>.',
          task: 'Ferme le circuit et mesure l\'intensité électrique entre les deux moteurs.',
          check: function (lab) {
            return lab.state('K1').closed && lab.names('ammeter').some(function (a) {
              var b = lab.state(a).between;
              return b && /^M/.test(b[0]) && /^M/.test(b[1]);
            });
          }
        },
        {
          title: 'Changer le circuit', palette: ['voltmeter', 'ammeter'], fixedTypes: ['gen', 'motor', 'lamp', 'res'], unlock: ['M1', 'M2', 'wires'], hold: 1500,
          text: 'L\'intensité dépend des dipôles que l\'électricité doit traverser. Que se passe-t-il avec un seul moteur ?',
          task: 'Supprime un moteur, referme le circuit, puis mesure l\'intensité entre le moteur et l\'interrupteur : tu vas observer des changements.',
          how: 'Pour supprimer un moteur, fais-le glisser dans la barre de droite.',
          check: function (lab) {
            var ms = lab.names('motor');
            return ms.length === 1 && lab.state(ms[0]).on && lab.names('ammeter').some(function (a) {
              var b = lab.state(a).between;
              return b && b.some(function (r) { return r.indexOf(ms[0] + '.') === 0; }) && b.some(function (r) { return r.indexOf('K1.') === 0; });
            });
          }
        },
        {
          title: 'La résistance électrique', palette: ['voltmeter', 'ammeter', 'ohmmeter'], fixedTypes: ['gen', 'motor', 'lamp', 'res'], hold: 1500,
          circuit: (function () {
            var c = locked({
              els: [
                { name: 'G1', type: 'gen', x: 0, y: 0, opt: 3 },
                { name: 'L1', type: 'lamp', x: -70, y: 150 },
                { name: 'R1', type: 'res', x: 70, y: 150, opt: 0 }
              ],
              wires: []
            });
            // Fils libres : il faudra en enlever un pour isoler la résistance
            c.wires = [{ a: 'G1.0', b: 'L1.0' }, { a: 'L1.1', b: 'R1.0' }, { a: 'R1.1', b: 'G1.1' }];
            return c;
          })(),
          text: 'Il reste la <b>résistance électrique</b> à découvrir : c\'est la capacité d\'un dipôle à <b>freiner</b> l\'électricité. Plus la résistance est grande, plus l\'intensité est faible. Tous les dipôles en ont une, et les résistances sont faites exprès pour ça : les résistances ont une résistance… logique !<br>Pour la mesurer, on branche un <b>ohmmètre</b> sur le dipôle, mais attention : le dipôle doit être <b>hors de tout circuit</b>. La résistance s\'exprime en <b>ohms (Ω)</b>.',
          task: 'Mesure la résistance de la résistance R1.',
          how: 'Si l\'ohmmètre affiche « Err », le dipôle est encore alimenté.',
          check: function (lab) {
            return lab.names('ohmmeter').some(function (o) {
              var s = lab.state(o);
              return s.on === 'R1' && typeof s.value === 'number' && isFinite(s.value);
            });
          }
        },
        {
          title: 'Changer la résistance', palette: ['voltmeter', 'ammeter', 'ohmmeter'], fixedTypes: ['gen', 'motor', 'lamp'], hold: 1500,
          text: 'Une résistance plus grande bloque davantage le passage du courant.',
          task: 'Augmente la valeur de la résistance R1 et referme le circuit : la lampe devrait beaucoup moins briller.',
          check: function (lab) { var l = lab.state('L1'); return lab.state('R1').opt > 0 && !l.broken && l.I > 1e-4; }
        }
      ],
      end: 'Bravo ! Tu sais mesurer la tension, l\'intensité et la résistance.',
      recap: [
        {
          text: 'La <b>tension</b> (U) se mesure en <b>volts (V)</b> avec un <b>voltmètre</b>, branché <b>en dérivation</b> aux bornes du dipôle (bornes V et COM). Un dipôle fonctionne normalement quand il reçoit sa tension nominale.',
          labs: [{
            caption: 'Le voltmètre est branché autour du moteur : il mesure la tension à ses bornes.',
            circuit: {
              els: [{ name: 'G1', type: 'gen', x: 0, y: 0, opt: 1 }, { name: 'M1', type: 'motor', x: 0, y: 150 }, { name: 'V1', type: 'voltmeter', on: 'M1', dir: [0, 1] }],
              wires: [['G1.0', 'M1.0'], ['M1.1', 'G1.1']]
            }
          }]
        },
        {
          text: 'L\'<b>intensité</b> (I) se mesure en <b>ampères (A)</b> avec un <b>ampèremètre</b>, branché <b>en série</b> dans le circuit (bornes A et COM). Elle dépend de la tension et des dipôles que l\'électricité traverse.',
          labs: [
            {
              caption: 'Deux moteurs en série : l\'intensité est plus faible.',
              circuit: {
                els: [{ name: 'G1', type: 'gen', x: 0, y: 0, opt: 2 }, { name: 'M1', type: 'motor', x: -60, y: 150 }, { name: 'M2', type: 'motor', x: 60, y: 150 },
                  { name: 'A1', type: 'ammeter', between: ['M1.1', 'M2.0'] }],
                wires: [['G1.0', 'M1.0'], ['M2.1', 'G1.1']]
              }
            },
            {
              caption: 'Un seul moteur : l\'intensité est plus grande.',
              circuit: {
                els: [{ name: 'G1', type: 'gen', x: 0, y: 0, opt: 2 }, { name: 'M1', type: 'motor', x: 0, y: 150 }, { name: 'A1', type: 'ammeter', between: ['M1.1', 'G1.1'] }],
                wires: [['G1.0', 'M1.0']]
              }
            }
          ]
        },
        {
          text: 'La <b>résistance</b> (R) se mesure en <b>ohms (Ω)</b> avec un <b>ohmmètre</b>, sur un dipôle placé <b>hors du circuit</b> (bornes Ω et COM).',
          labs: [{
            caption: 'L\'ohmmètre mesure la résistance de R1, isolée de tout circuit.',
            circuit: { els: [{ name: 'R1', type: 'res', x: 0, y: 0, opt: 0 }, { name: 'O1', type: 'ohmmeter', on: 'R1' }], wires: [] }
          }]
        },
        {
          text: 'Plus la résistance est <b>grande</b>, plus l\'intensité est <b>faible</b> : la lampe brille moins.',
          labs: [
            {
              caption: 'R1 = 47 Ω : l\'intensité est grande, la lampe brille.',
              circuit: {
                els: [{ name: 'G1', type: 'gen', x: 0, y: 0, opt: 3 }, { name: 'L1', type: 'lamp', x: -70, y: 150 }, { name: 'R1', type: 'res', x: 70, y: 150, opt: 0 },
                  { name: 'A1', type: 'ammeter', between: ['L1.1', 'R1.0'] }],
                wires: [['G1.0', 'L1.0'], ['R1.1', 'G1.1']]
              }
            },
            {
              caption: 'R1 = 1 kΩ : l\'intensité est faible, la lampe brille à peine.',
              circuit: {
                els: [{ name: 'G1', type: 'gen', x: 0, y: 0, opt: 3 }, { name: 'L1', type: 'lamp', x: -70, y: 150 }, { name: 'R1', type: 'res', x: 70, y: 150, opt: 2 },
                  { name: 'A1', type: 'ammeter', between: ['L1.1', 'R1.0'] }],
                wires: [['G1.0', 'L1.0'], ['R1.1', 'G1.1']]
              }
            }
          ]
        }
      ]
    },

    {
      id: 'lois', title: 'Les lois de l\'électricité', sub: 'Lois des tensions et des intensités', level: 1, levelName: 'circuit à une boucle', next: 'lois2',
      // Construction d'après un schéma, mesures notées dans une fenêtre, puis questions à choix
      lab: { ideal: false, toggles: {}, fixedTypes: [] },
      target: L1_TARGET, labels: { G1: 'G1 (9 V)', L1: 'L1 (3 V)', L2: 'L2 (6 V)' },
      legend: 'Générateur G1 réglé sur 9 V · L1 : lampe de 3 V · L2 : lampe de 6 V',
      freePalette: ['gen', 'lamp', 'voltmeter', 'ammeter'],
      steps: [
        {
          kind: 'build', title: 'Construction', palette: ['gen', 'lamp'],
          text: 'Pour découvrir les lois de l\'électricité, on commence par construire un circuit à <b>une seule boucle</b>.',
          task: 'Construis le circuit du schéma en réglant les dipôles comme indiqué.',
          how: 'Le schéma reste affiché dans la fenêtre « Schéma à réaliser » ; la disposition peut être différente, seuls les branchements et les réglages comptent.',
          check: function (lab) { return oneLoop(lab).ok; },
          rename: function (lab) { return oneLoop(lab).map; },
          hint: function (lab) { return oneLoop(lab).hint; }
        },
        {
          kind: 'measure', title: 'Mesure des tensions', palette: ['voltmeter'],
          text: 'On mesure maintenant la tension aux bornes de chaque dipôle.',
          task: 'À l\'aide du voltmètre, mesure les tensions du générateur et des deux lampes, puis note-les dans l\'encadré.',
          rows: [
            { k: 'G', label: 'Tension du générateur G1', unit: 'V', tol: .06 },
            { k: 'L3', label: 'Tension de la lampe L1 (3 V)', unit: 'V', tol: .06 },
            { k: 'L6', label: 'Tension de la lampe L2 (6 V)', unit: 'V', tol: .06 }
          ],
          expect: function (lab) { return { G: U(lab, gen(lab)), L3: U(lab, lampOf(lab, 0)[0]), L6: U(lab, lampOf(lab, 1)[0]) }; }
        },
        {
          kind: 'quiz', title: 'La loi des tensions', results: 1,
          question: 'D\'après tes résultats, que peut-on déduire d\'un circuit en série comme celui-ci ?',
          choices: [
            'La tension est la même en tous points du circuit.',
            'La tension aux bornes des dipôles récepteurs correspond toujours à leur tension nominale.',
            'La somme des tensions des dipôles récepteurs est égale à la tension du générateur.'
          ],
          answer: [2], task: 'Réponds à la question à partir de tes mesures.'
        },
        {
          kind: 'measure', title: 'Mesure des intensités', palette: ['ammeter'], restore: 'built',
          text: 'On retire le voltmètre : place maintenant l\'ampèremètre à différents endroits du circuit.',
          task: 'À l\'aide de l\'ampèremètre, mesure l\'intensité à différents points du circuit, puis note-les dans l\'encadré.',
          rows: [
            { k: 'a', label: 'Entre le générateur et la lampe L1', unit: 'mA', tol: 3 },
            { k: 'b', label: 'Entre la lampe L1 et la lampe L2', unit: 'mA', tol: 3 },
            { k: 'c', label: 'Entre la lampe L2 et le générateur', unit: 'mA', tol: 3 }
          ],
          expect: function (lab) { var i = mA(lab, gen(lab)); return { a: i, b: i, c: i }; }
        },
        {
          kind: 'quiz', title: 'La loi des intensités', results: 3,
          question: 'D\'après tes résultats, que peut-on déduire d\'un circuit en série comme celui-ci ?',
          choices: [
            'L\'intensité est la même en tous points du circuit.',
            'L\'intensité augmente à mesure qu\'on s\'éloigne du générateur.',
            'La somme des intensités des récepteurs est égale à celle du générateur.'
          ],
          answer: [0], task: 'Réponds à la question à partir de tes mesures.'
        }
      ],
      end: 'Bravo ! Tu as découvert les deux lois d\'un circuit à une boucle. Prêt pour le niveau 2 ?',
      recap: [
        {
          law: {
            name: 'Loi d\'additivité des tensions',
            text: 'Dans un circuit en série (une seule boucle), la tension aux bornes du générateur est égale à la <b>somme des tensions</b> aux bornes des dipôles récepteurs.',
            formula: 'U<sub>G</sub> = U<sub>L1</sub> + U<sub>L2</sub>'
          },
          labs: [{
            caption: '1,80 V + 7,20 V = 9,00 V : la tension du générateur se partage entre les deux lampes.',
            circuit: withMeters(L1_TARGET, [
              { name: 'V1', type: 'voltmeter', on: 'G1', dir: [0, -1] },
              { name: 'V2', type: 'voltmeter', on: 'L1', dir: [0, 1] },
              { name: 'V3', type: 'voltmeter', on: 'L2', dir: [0, 1] }])
          }]
        },
        {
          law: {
            name: 'Loi d\'unicité de l\'intensité',
            text: 'Dans un circuit en série (une seule boucle), l\'intensité du courant est <b>la même en tout point</b> du circuit.',
            formula: 'I = I<sub>1</sub> = I<sub>2</sub> = I<sub>3</sub>'
          },
          labs: [{
            caption: 'Les deux ampèremètres affichent la même intensité, quel que soit l\'endroit de la boucle.',
            circuit: withMeters(L1_TARGET, [
              { name: 'A1', type: 'ammeter', between: ['G1.0', 'L1.0'] },
              { name: 'A2', type: 'ammeter', between: ['L1.1', 'L2.0'] }])
          }]
        }
      ]
    },

    {
      id: 'lois2', parent: 'lois', hidden: true, title: 'Les lois de l\'électricité', sub: 'Lois des tensions et des intensités', level: 2, levelName: 'circuit à plusieurs boucles',
      lab: { ideal: false, toggles: {}, fixedTypes: [] },
      target: L2_TARGET, labels: { G1: 'G1 (6 V)', L1: 'L1 (6 V)', L2: 'L2 (3 V)', L3: 'L3 (3 V)' },
      legend: 'Générateur G1 réglé sur 6 V · L1 : lampe de 6 V · L2 et L3 : lampes de 3 V',
      freePalette: ['gen', 'lamp', 'voltmeter', 'ammeter'],
      steps: [
        {
          kind: 'build', title: 'Construction', palette: ['gen', 'lamp'],
          text: 'On passe à un circuit à <b>plusieurs boucles</b> : la lampe L1 est branchée en dérivation des lampes L2 et L3, elles-mêmes en série.',
          task: 'Construis le circuit du schéma en réglant les dipôles comme indiqué.',
          how: 'Attention : il faudra pouvoir mesurer l\'intensité à la sortie du générateur et juste avant la lampe L1. Respecte bien les branchements du schéma.',
          check: function (lab) { return twoLoops(lab).ok; },
          rename: function (lab) { return twoLoops(lab).map; },
          hint: function (lab) { return twoLoops(lab).hint; }
        },
        {
          kind: 'measure', title: 'Mesure des tensions', palette: ['voltmeter'],
          text: 'On mesure la tension aux bornes de chaque dipôle.',
          task: 'À l\'aide du voltmètre, mesure les tensions du générateur et des trois lampes, puis note-les dans l\'encadré.',
          rows: [
            { k: 'G', label: 'Tension du générateur G1', unit: 'V', tol: .06 },
            { k: 'L1', label: 'Tension de la lampe L1 (6 V)', unit: 'V', tol: .06 },
            { k: 'L2', label: 'Tension de la lampe L2 (3 V)', unit: 'V', tol: .06 },
            { k: 'L3', label: 'Tension de la lampe L3 (3 V)', unit: 'V', tol: .06 }
          ],
          expect: function (lab) { var s = lampOf(lab, 0); return { G: U(lab, gen(lab)), L1: U(lab, lampOf(lab, 1)[0]), L2: U(lab, s[0]), L3: U(lab, s[1]) }; }
        },
        {
          kind: 'quiz', title: 'La loi des tensions', results: 1,
          question: 'D\'après tes résultats, que peut-on déduire d\'un circuit à plusieurs boucles comme celui-ci ?',
          choices: [
            'La somme des tensions des dipôles récepteurs est égale à la tension du générateur.',
            'La somme des tensions des dipôles d\'une même boucle est égale à celle du générateur.',
            'La tension totale est la même dans toutes les boucles.'
          ],
          answer: [1, 2], task: 'Réponds à la question à partir de tes mesures.'
        },
        {
          kind: 'measure', title: 'Mesure des intensités', palette: ['ammeter'], restore: 'built',
          text: 'On retire le voltmètre : place maintenant l\'ampèremètre aux endroits indiqués.',
          task: 'À l\'aide de l\'ampèremètre, mesure l\'intensité aux trois endroits indiqués, puis note-les dans l\'encadré.',
          rows: [
            { k: 'g', label: 'À la sortie du générateur', unit: 'mA', tol: 3 },
            { k: 's', label: 'Entre la lampe L2 et la lampe L3', unit: 'mA', tol: 3 },
            { k: 'l', label: 'Juste avant la lampe L1', unit: 'mA', tol: 3 }
          ],
          expect: function (lab) { return { g: mA(lab, gen(lab)), s: mA(lab, lampOf(lab, 0)[0]), l: mA(lab, lampOf(lab, 1)[0]) }; }
        },
        {
          kind: 'quiz', title: 'La loi des intensités', results: 3,
          question: 'D\'après tes résultats, que peut-on déduire d\'un circuit à plusieurs boucles comme celui-ci ?',
          choices: [
            'L\'intensité est la même en tous points du circuit.',
            'La somme des intensités des deux boucles est égale à l\'intensité délivrée par le générateur.',
            'L\'intensité du générateur se divise en deux parts égales s\'il y a deux boucles.'
          ],
          answer: [1], task: 'Réponds à la question à partir de tes mesures.'
        }
      ],
      end: 'Bravo ! Tu connais maintenant les quatre lois des tensions et des intensités.',
      recap: [
        {
          law: {
            name: 'Loi d\'unicité des tensions',
            text: 'Des branches montées en dérivation ont la <b>même tension</b> à leurs bornes : chacune reçoit la tension du générateur.',
            formula: 'U<sub>G</sub> = U<sub>L1</sub> = U<sub>L2</sub> + U<sub>L3</sub>'
          },
          labs: [{
            caption: 'La lampe L1 reçoit la même tension que le générateur ; dans l\'autre boucle, L2 et L3 se la partagent.',
            circuit: withMeters(L2_TARGET, [
              { name: 'V1', type: 'voltmeter', on: 'G1', dir: [0, -1] },
              { name: 'V2', type: 'voltmeter', on: 'L1', dir: [0, 1] }])
          }]
        },
        {
          law: {
            name: 'Loi d\'additivité des intensités',
            text: 'L\'intensité dans la <b>branche principale</b> (celle du générateur) est égale à la <b>somme des intensités</b> dans les branches dérivées.',
            formula: 'I<sub>G</sub> = I<sub>1</sub> + I<sub>2</sub>'
          },
          labs: [{
            caption: 'L\'intensité qui sort du générateur se partage entre les deux boucles, puis se rassemble.',
            circuit: withMeters(L2_TARGET, [
              { name: 'A1', type: 'ammeter', between: ['G1.0', 'L2.0'] },
              { name: 'A2', type: 'ammeter', between: ['L2.1', 'L3.0'] },
              { name: 'A3', type: 'ammeter', between: ['L2.0', 'L1.0'] }])
          }]
        }
      ]
    },

    {
      id: 'ohm', title: 'La loi d\'Ohm', sub: 'Relation entre tension, intensité et résistance',
      // Circuit imposé générateur + résistance, mesures notées dans un tableau à colonnes, puis question à choix
      lab: { ideal: false, electrons: true, toggles: {} },
      freePalette: ['gen', 'res', 'lamp', 'voltmeter', 'ammeter', 'ohmmeter'],
      anim: OhmAnim,
      steps: [
        {
          kind: 'measure', title: 'Premières mesures', palette: ['voltmeter', 'ammeter'], fixedTypes: ['gen', 'res'],
          circuit: locked(ohmCircuit()),
          text: 'Dans un circuit électrique, la tension, l\'intensité et la résistance dépendent les unes des autres. Ce lien est une formule mathématique : la <b>loi d\'Ohm</b>.',
          task: 'Place un voltmètre aux bornes de la résistance et un ampèremètre quelque part dans le circuit, puis note les valeurs dans le tableau.',
          how: 'Dans le tableau, l\'intensité se note en <b>ampères (A)</b> : l\'ampèremètre affiche des milliampères, et 1 A = 1 000 mA (par exemple 250 mA = 0,25 A).',
          grid: { head: 'Résistance R', rows: OHM_ROWS, cols: [{ k: 'a', head: '47 Ω' }] },
          expect: ohmExpect
        },
        {
          kind: 'measure', title: 'Changer la résistance', palette: ['voltmeter', 'ammeter'], fixedTypes: ['gen'],
          text: 'Le réglage de la résistance R1 est maintenant possible. La tension du générateur, elle, ne change pas.',
          task: 'Augmente la valeur de la résistance R1, puis note les nouvelles valeurs dans la suite du tableau.',
          how: 'Touche la résistance pour changer sa valeur.',
          grid: {
            head: 'Résistance R', rows: OHM_ROWS,
            cols: [{ k: 'a', head: '47 Ω', from: 0, fallback: { U: 6, I: .128 } }, { k: 'b', head: function (lab) { return lab.state('R1').opt > 0 ? ohms(lab) : '?'; } }]
          },
          ready: function (lab) { return lab.state('R1').opt > 0 ? null : 'Augmente d\'abord la valeur de la résistance R1.'; },
          expect: ohmExpect
        },
        {
          kind: 'quiz', title: 'La formule', results: 1,
          question: 'À l\'aide d\'une calculatrice, effectue des calculs avec tes mesures pour vérifier l\'une de ces 3 formules. Clique sur la bonne réponse quand tu es prêt.',
          choices: ['U = ' + frac('R', 'I'), 'R = ' + frac('U', 'I'), 'I = U × R'],
          answer: [1], task: 'Trouve la formule vérifiée par tes mesures.'
        }
      ],
      end: 'Bravo ! Tu connais maintenant la loi d\'Ohm : la résistance est égale à la tension divisée par l\'intensité.',
      recap: [
        {
          law: {
            name: 'Loi d\'Ohm',
            text: 'La tension U aux bornes d\'une résistance, l\'intensité I qui la traverse et la valeur R de la résistance sont liées : <b>la résistance est égale à la tension divisée par l\'intensité</b>.<br>U en <b>volts (V)</b>, I en <b>ampères (A)</b>, R en <b>ohms (Ω)</b>.',
            formula: 'R = ' + frac('U', 'I')
          }
        },
        {
          law: {
            name: 'Calculer une tension ou une intensité',
            text: 'De la loi d\'Ohm, on tire deux autres formules : l\'une pour calculer la <b>tension</b>, l\'autre pour calculer l\'<b>intensité</b>.',
            formula: 'U = R × I<span class="law__sep"></span>I = ' + frac('U', 'R')
          }
        },
        {
          text: 'Attention aux unités : l\'intensité doit être en <b>ampères</b> (128 mA = 0,128 A).',
          labs: [
            { caption: 'R = 47 Ω : 6,00 V ÷ 0,128 A ≈ 47 Ω.', circuit: ohmMeasured(0) },
            { caption: 'R = 1 000 Ω : 6,00 V ÷ 0,006 A = 1 000 Ω. Plus la résistance est grande, plus l\'intensité est faible.', circuit: ohmMeasured(2) }
          ]
        }
      ]
    }
  ];
})();
