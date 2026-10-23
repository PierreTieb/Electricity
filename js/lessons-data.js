// Contenu du mode Leçon : chaque cours est une suite de consignes vérifiées automatiquement sur le labo.
// step : { title, text (explication), task (ce qu'il faut faire, rappelé dans le bandeau), how (aide),
//          palette (éléments disponibles), toggles (cases visibles), set (réglages appliqués au départ),
//          check(lab) → true quand la tâche est réussie, hold (ms pendant lesquels elle doit le rester) }
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

    { id: 'mesures', title: 'Mesurer tension, intensité et résistance', soon: true }
  ];
})();
