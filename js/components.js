// Composants du laboratoire : caractéristiques électriques, dessins réels (2D) et symboles normalisés.
// Tous les dipôles sont dessinés horizontalement, centrés sur (0,0), bornes en (-T,0) et (+T,0).
window.Comp = (function () {
  var T = 44;
  var K = '#111';

  var TYPES = {
    gen:    { name: 'Générateur', prefix: 'G', opts: [3, 6, 9, 12], def: 1, optLabel: 'Tension' },
    lamp:   { name: 'Lampe', prefix: 'L', opts: [{ u: 3.5, i: .2 }, { u: 6, i: .1 }, { u: 12, i: .1 }], def: 1, optLabel: 'Valeurs nominales' },
    res:    { name: 'Résistance', prefix: 'R', opts: [47, 220, 1000], def: 1, optLabel: 'Valeur de la résistance' },
    motor:  { name: 'Moteur', prefix: 'M', opts: [{ u: 3, i: .2 }, { u: 6, i: .3 }, { u: 12, i: .25 }], def: 1, optLabel: 'Valeurs nominales' },
    led:    { name: 'DEL', prefix: 'D', opts: [{ n: 'Rouge', vf: 1.8, c: '#FF5A4E' }, { n: 'Verte', vf: 2.2, c: '#3FD06A' }, { n: 'Bleue', vf: 2.7, c: '#4A8CFF' }], def: 0, optLabel: 'Couleur' },
    sw:     { name: 'Interrupteur', prefix: 'K' },
    buzzer: { name: 'Buzzer', prefix: 'B', opts: [{ n: 'Grave', f: 440, plate: '#CDEAE4', edge: '#A2CCC2' }, { n: 'Médium', f: 880, plate: '#E3D8F4', edge: '#BFAEDD' }, { n: 'Aigu', f: 1760, plate: '#F8D9CF', edge: '#DFB2A4' }], def: 1, optLabel: 'Fréquence du son' },
    voltmeter: { name: 'Voltmètre', meter: 'V' },
    ammeter:   { name: 'Ampèremètre', meter: 'A' },
    ohmmeter:  { name: 'Ohmmètre', meter: 'Ω' }
  };
  var DIPOLES = ['gen', 'lamp', 'res', 'motor', 'led', 'sw', 'buzzer'];
  var METERS = ['voltmeter', 'ammeter', 'ohmmeter'];

  var R_GEN = 0.5, LED_U = 3, LED_I = 0.02, RES_PMAX = 1, BUZ_R = 150;

  function isMeter(type) { return !!TYPES[type].meter; }
  function opt(el) { var t = TYPES[el.type]; return t.opts ? t.opts[el.opt] : null; }

  // Modèle électrique d'un dipôle (null = circuit ouvert)
  function model(el) {
    var o = opt(el);
    if (el.broken) return null;
    switch (el.type) {
      case 'gen': return { kind: 'src', E: o, r: R_GEN };
      case 'lamp': case 'motor': return { kind: 'R', R: o.u / o.i };
      case 'res': return { kind: 'R', R: o };
      case 'buzzer': return { kind: 'R', R: BUZ_R };
      case 'led': return { kind: 'led', vf: o.vf, rd: (LED_U - o.vf) / LED_I };
      case 'sw': return el.closed ? { kind: 'R', R: 0.005 } : null;
    }
    return null;
  }

  // Taux de charge par rapport au fonctionnement nominal (1 = nominal)
  function loadRatio(el) {
    var o = opt(el), U = Math.abs(el.U || 0);
    switch (el.type) {
      case 'lamp': case 'motor': return U / o.u;
      case 'res': return U / Math.sqrt(RES_PMAX * o);
      case 'led': return Math.max(0, el.I || 0) / LED_I;
    }
    return 0;
  }
  function canBreak(type) { return type === 'lamp' || type === 'motor' || type === 'res' || type === 'led'; }

  function optText(type, o) {
    switch (type) {
      case 'gen': return [o + ' V', ''];
      case 'lamp': case 'motor': return [num(o.u) + ' V', num(o.i) + ' A'];
      case 'res': return [o >= 1000 ? num(o / 1000) + ' kΩ' : o + ' Ω', ''];
      case 'led': return [o.n, 'seuil ' + num(o.vf) + ' V'];
      case 'buzzer': return [o.n, o.f + ' Hz'];
    }
    return ['', ''];
  }
  function num(x, d) {
    var s = d == null ? String(+x.toFixed(3)) : x.toFixed(d);
    return s.replace('.', ',');
  }

  /* ---------- Dessins réels ---------- */
  function plate(fill, edge) {
    return '<rect x="-54" y="-17" width="108" height="44" rx="14" fill="#000" fill-opacity=".07"/>' +
      '<rect x="-52" y="-19" width="104" height="42" rx="12" fill="' + edge + '"/>' +
      '<rect x="-52" y="-22" width="104" height="41" rx="12" fill="' + fill + '"/>' +
      '<path d="M-41 -20h82" stroke="#fff" stroke-opacity=".7" stroke-width="2" stroke-linecap="round"/>';
  }
  function socket(x, ring) {
    return '<circle cx="' + x + '" cy=".8" r="7.6" fill="#7F8994"/>' +
      '<circle cx="' + x + '" cy="0" r="6.8" fill="' + (ring || '#C9D0D7') + '"/>' +
      '<circle cx="' + x + '" cy=".4" r="3.4" fill="#353C44"/>' +
      '<circle cx="' + (x - 2.4) + '" cy="-2.6" r="1.4" fill="#fff" fill-opacity=".85"/>';
  }
  function leads(a, b) {
    return '<path d="M-36 0H' + (-a) + 'M' + a + ' 0H36" stroke="#8C97A3" stroke-width="3.4" stroke-linecap="round"/>' +
      '<path d="M-36 -.9H' + (-a) + 'M' + a + ' -.9H36" stroke="#EEF2F5" stroke-width="1" stroke-linecap="round"/>';
  }
  function base(fill, edge, a) { return plate(fill, edge) + leads(a, 0) + socket(-T) + socket(T); }
  function pm(fill) {
    return '<text class="up" data-c="-33 13" x="-33" y="17" font-size="11" font-weight="800" fill="' + fill + '" text-anchor="middle">+</text>' +
      '<text class="up" data-c="33 13" x="33" y="17" font-size="11" font-weight="800" fill="' + fill + '" text-anchor="middle">−</text>';
  }

  function realGen(el) {
    var v = opt(el), ang = [-120, -40, 40, 120][el.opt];
    return '<rect x="-60" y="-40" width="120" height="68" rx="14" fill="#000" fill-opacity=".08"/>' +
      '<rect x="-60" y="-42" width="120" height="66" rx="13" fill="#536276"/>' +
      '<rect x="-60" y="-45" width="120" height="65" rx="13" fill="#7387A0"/>' +
      '<path d="M-48 -43h96" stroke="#fff" stroke-opacity=".45" stroke-width="2" stroke-linecap="round"/>' +
      '<rect x="-51" y="-37" width="60" height="25" rx="6" fill="#2D3640"/>' +
      '<rect x="-48" y="-34" width="54" height="19" rx="4" fill="#CFE8B6"/>' +
      '<text class="lcd" x="-21" y="-19.6" font-size="14" text-anchor="middle" fill="#24411B">' + num(v, 1) + ' V</text>' +
      '<circle cx="32" cy="-24" r="13" fill="#5C6E83"/>' +
      [-120, -40, 40, 120].map(function (a) {
        var r = a * Math.PI / 180;
        return '<circle cx="' + (32 + 16 * Math.sin(r)).toFixed(1) + '" cy="' + (-24 - 16 * Math.cos(r)).toFixed(1) + '" r="1.5" fill="#E7ECF1"/>';
      }).join('') +
      '<circle cx="32" cy="-24" r="10.5" fill="#EDF1F4"/><circle cx="32" cy="-24" r="10.5" fill="none" stroke="#B9C3CD" stroke-width="1.5"/>' +
      '<path d="M32 -24V-32" stroke="#4E5D6E" stroke-width="3" stroke-linecap="round" transform="rotate(' + ang + ' 32 -24)"/>' +
      '<rect x="-22" y="-5" width="44" height="12" rx="4" fill="#fff" fill-opacity=".14"/>' +
      '<circle cx="0" cy="1" r="2.6" fill="#7CF08F"/><circle cx="0" cy="1" r="5" fill="#7CF08F" fill-opacity=".25"/>' +
      socket(-T, '#F06C5E') + socket(T, '#41474E') +
      '<text class="up" data-c="-44 14" x="-44" y="18" font-size="12" font-weight="800" fill="#fff" text-anchor="middle">+</text>' +
      '<text class="up" data-c="44 14" x="44" y="18" font-size="12" font-weight="800" fill="#fff" text-anchor="middle">−</text>';
  }

  function realLamp(el) {
    var s = base('#F0E4CD', '#D3C2A4', 15) +
      '<circle r="18" fill="#AEB6BF"/><circle r="18" fill="none" stroke="#949EA9" stroke-width="2.2" stroke-dasharray="3.2 2.6"/>' +
      '<circle class="halo" r="46" fill="url(#g-halo)" opacity="0" pointer-events="none"/>';
    if (el.broken) {
      return s + '<circle r="13.5" fill="#E4E8EC" fill-opacity=".7" stroke="#9AA6B1" stroke-width="1.6"/>' +
        '<path d="M-2 -13.5 L1 -6 L-4 -1 L3 4 L0 13.5" fill="none" stroke="#5E6873" stroke-width="1.2" stroke-linejoin="round"/>' +
        '<path d="M1 -6 L8 -9 M-4 -1 L-11 -4 M3 4 L10 7" fill="none" stroke="#5E6873" stroke-width="1" />' +
        '<path d="M3 -13 L12 -6 L6 -2 Z" fill="#AEB6BF"/>' +
        '<path d="M-7 3 L-4 -3 L-2 1 M4 -1 L6 3" fill="none" stroke="#4A3F36" stroke-width="1.4" stroke-linecap="round"/>' +
        '<circle cx="-3" cy="5" r="5" fill="#5A5048" fill-opacity=".25"/>';
    }
    return s + '<circle class="glass" r="13.5" fill="#F4F8FB" fill-opacity=".9" stroke="#A9B5C0" stroke-width="1.6"/>' +
      '<path class="fil" d="M-7 2 L-4.5 -3 L-2 2 L.5 -3 L3 2 L5.5 -3 L7 0" fill="none" stroke="#7A6656" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/>' +
      '<path d="M-7.5 -6.5 A9 9 0 0 1 -1 -10.5" stroke="#fff" stroke-width="2.6" stroke-linecap="round" fill="none" opacity=".9"/>';
  }

  var BAND = { 0: '#222', 1: '#8B5A2B', 2: '#D8392B', 4: '#F2C230', 7: '#8A4FC0' };
  function realRes(el) {
    var R = opt(el), d = R === 47 ? [4, 7, 0] : R === 220 ? [2, 2, 1] : [1, 0, 2];
    var body = el.broken ? '#5E4D42' : '#EDCF9F';
    var s = base('#DCEBD8', '#B6CBB0', 20) +
      '<rect x="-23" y="-9.5" width="13" height="19" rx="6.5" fill="' + body + '"/>' +
      '<rect x="10" y="-9.5" width="13" height="19" rx="6.5" fill="' + body + '"/>' +
      '<rect x="-14" y="-7.5" width="28" height="15" fill="' + body + '"/>';
    var op = el.broken ? .35 : 1;
    s += '<rect x="-18" y="-9.3" width="3.6" height="18.6" fill="' + BAND[d[0]] + '" opacity="' + op + '"/>' +
      '<rect x="-9" y="-7.5" width="3.6" height="15" fill="' + BAND[d[1]] + '" opacity="' + op + '"/>' +
      '<rect x="-2" y="-7.5" width="3.6" height="15" fill="' + BAND[d[2]] + '" opacity="' + op + '"/>' +
      '<rect x="14" y="-9.3" width="3.6" height="18.6" fill="#D4A93A" opacity="' + op + '"/>';
    if (el.broken) return s + '<path d="M-6 -8 L-2 -2 L-7 3 L-3 8" fill="none" stroke="#2A221D" stroke-width="1.4" stroke-linejoin="round"/><circle cx="4" cy="0" r="8" fill="#1E1A17" fill-opacity=".35"/>';
    return s + '<path d="M-19 -5H19" stroke="#fff" stroke-opacity=".5" stroke-width="2.4" stroke-linecap="round"/>' +
      '<rect class="heat" x="-23" y="-9.5" width="46" height="19" rx="8" fill="#FF5A1F" opacity="0"/>';
  }

  function realMotor(el) {
    var dark = el.broken;
    var blade = 'M0 0 C5 -6 24 -8.5 29 -3 C26 2.5 9 4.5 0 0Z';
    return base('#DCE3EC', '#B6C2D0', 17) +
      '<circle r="18" fill="' + (dark ? '#4F4B49' : '#A7B2BE') + '"/>' +
      '<circle r="18" fill="none" stroke="' + (dark ? '#3A3634' : '#87929F') + '" stroke-width="2"/>' +
      '<circle r="13" fill="' + (dark ? '#5E5956' : '#C6CED7') + '"/>' +
      '<circle class="blur" r="29" fill="#8FD694" opacity="0" pointer-events="none"/>' +
      '<g class="prop">' + [0, 120, 240].map(function (a) {
        return '<path d="' + blade + '" transform="rotate(' + a + ')" fill="' + (dark ? '#6F8A70' : '#93DA98') + '" stroke="' + (dark ? '#4E604F' : '#4FA35A') + '" stroke-width="1.3" stroke-linejoin="round"/>';
      }).join('') + '<circle r="5" fill="' + (dark ? '#4E604F' : '#4FA35A') + '"/><circle cx="-1.3" cy="-1.3" r="1.6" fill="#fff" fill-opacity=".6"/></g>';
  }

  function realLed(el) {
    var o = opt(el);
    var s = base('#E8E0F2', '#C6B9D8', 8) + pm('#7B6A96') +
      '<circle class="halo" r="36" fill="url(#g-led' + el.opt + ')" opacity="0" pointer-events="none"/>';
    var dome = 'M8 -7.8 A11.2 11.2 0 1 0 8 7.8 Z';
    if (el.broken) {
      return s + '<path d="' + dome + '" fill="#6F6A73" stroke="#4C4850" stroke-width="1.6"/>' +
        '<path d="M-6 -9 L-1 -2 L-6 3 L-1 9 M-1 -2 L5 -3" fill="none" stroke="#2E2B31" stroke-width="1.2" stroke-linejoin="round"/>';
    }
    return s + '<path class="dome" d="' + dome + '" fill="' + mix(o.c, '#8A8590', .55) + '" fill-opacity=".85" stroke="' + mix(o.c, '#000', .35) + '" stroke-width="1.6"/>' +
      '<circle class="core" cx="-1.5" cy="0" r="4" fill="#fff" opacity="0"/>' +
      '<path d="M-7 -4.5 A8 8 0 0 1 -2.5 -8.2" stroke="#fff" stroke-width="2.2" stroke-linecap="round" fill="none" opacity=".85"/>';
  }

  function realSw(el) {
    return base('#DCE6EE', '#B4C4D2', 24) +
      '<rect x="-29" y="-6.5" width="11" height="13" rx="2.5" fill="#C9D0D7" stroke="#8C97A3" stroke-width="1.2"/>' +
      '<rect x="18" y="-6.5" width="11" height="13" rx="2.5" fill="#C9D0D7" stroke="#8C97A3" stroke-width="1.2"/>' +
      '<g class="lever" transform="rotate(' + (el.closed ? 0 : -34) + ' -23 0)">' +
      '<rect x="-23" y="-3.6" width="48" height="7.2" rx="3.6" fill="#4A5562"/>' +
      '<rect x="15" y="-6.5" width="15" height="13" rx="5.5" fill="#F29A80"/><path d="M18 -4h9" stroke="#fff" stroke-opacity=".6" stroke-width="1.6" stroke-linecap="round"/></g>' +
      '<circle cx="-23" cy="0" r="4.2" fill="#9AA5B1"/><circle cx="-24" cy="-1" r="1.4" fill="#fff" fill-opacity=".7"/>';
  }

  function realBuzzer(el) {
    var o = opt(el);
    return plate(o.plate, o.edge) + leads(17, 0) + socket(-T) + socket(T) +
      '<g class="waves" opacity="0" pointer-events="none" fill="none" stroke="#3A4149" stroke-width="2.2" stroke-linecap="round">' +
      [22, 28, 34].map(function (r) { return '<path d="M' + (-r * .5).toFixed(1) + ' ' + (-r * .866).toFixed(1) + ' A' + r + ' ' + r + ' 0 0 1 ' + (r * .5).toFixed(1) + ' ' + (-r * .866).toFixed(1) + '"/>'; }).join('') + '</g>' +
      '<circle r="18" fill="#2F353C"/><circle r="17" fill="#3B424A"/><circle r="12.5" fill="#2A3036"/>' +
      '<circle r="3.4" fill="#0E1114"/><path d="M-11 -7 A13 13 0 0 1 -4 -12.5" stroke="#fff" stroke-opacity=".35" stroke-width="2.2" stroke-linecap="round" fill="none"/>';
  }

  function realMeter(el) {
    var L = TYPES[el.type].meter;
    return '<rect x="-31" y="-36" width="64" height="78" rx="13" fill="#000" fill-opacity=".1"/>' +
      '<rect x="-31" y="-39" width="62" height="78" rx="13" fill="#3F4852"/>' +
      '<rect x="-27" y="-35" width="54" height="70" rx="10" fill="#F5D978"/>' +
      '<path d="M-20 -33.5h40" stroke="#fff" stroke-opacity=".6" stroke-width="1.6" stroke-linecap="round"/>' +
      '<rect x="-22" y="-29" width="44" height="21" rx="4.5" fill="#2F3A44"/>' +
      '<rect x="-20" y="-27" width="40" height="17" rx="3" fill="#CFE5C0"/>' +
      '<text class="lcd" x="0" y="-14.4" font-size="11" text-anchor="middle" fill="#1F3219">---</text>' +
      '<circle cx="0" cy="5" r="10.5" fill="#fff" stroke="#3F4852" stroke-width="1.6"/>' +
      '<text x="0" y="10" font-size="14" font-weight="800" text-anchor="middle" fill="#2E3A46" font-family="Fredoka, Nunito, sans-serif">' + L + '</text>' +
      '<circle cx="-12" cy="25" r="5.4" fill="#E2584C"/><circle cx="-12" cy="25" r="2.4" fill="#3A1410"/>' +
      '<circle cx="12" cy="25" r="5.4" fill="#2E3338"/><circle cx="12" cy="25" r="2.4" fill="#0E1012"/>';
  }

  /* ---------- Symboles normalisés (noir) ---------- */
  function line(d, w) { return '<path d="' + d + '" fill="none" stroke="' + K + '" stroke-width="' + (w || 2.4) + '"/>'; }
  function schema(el) {
    switch (el.type) {
      case 'gen': return line('M-44 0H-6M6 0H44') + line('M-6 -17V17', 2.6) + line('M6 -9V9', 5.5) +
        '<text class="up" data-c="-16 -15" x="-16" y="-10" font-size="15" font-weight="800" fill="' + K + '" text-anchor="middle">+</text>' +
        '<text class="up" data-c="17 -15" x="17" y="-10" font-size="15" font-weight="800" fill="' + K + '" text-anchor="middle">−</text>';
      case 'lamp': return line('M-44 0H-15M15 0H44') + '<circle r="15" fill="#fff" stroke="' + K + '" stroke-width="2.4"/>' + line('M-10.6 -10.6L10.6 10.6M-10.6 10.6L10.6 -10.6') +
        (el.broken ? '' : '');
      case 'motor': return line('M-44 0H-15M15 0H44') + '<circle r="15" fill="#fff" stroke="' + K + '" stroke-width="2.4"/>' +
        '<text class="up" data-c="0 0" x="0" y="6.5" font-size="18" font-weight="700" fill="' + K + '" text-anchor="middle" font-family="Fredoka, Nunito, sans-serif">M</text>';
      case 'res': return line('M-44 0H-19M19 0H44') + '<rect x="-19" y="-8" width="38" height="16" fill="#fff" stroke="' + K + '" stroke-width="2.4"/>';
      case 'led': return line('M-44 0H-9M9 0H44') + '<path d="M-9 -10 L9 0 L-9 10 Z" fill="#fff" stroke="' + K + '" stroke-width="2.4" stroke-linejoin="round"/>' + line('M9 -10V10', 2.6) +
        line('M1 -11 L7 -18M7 -11 L13 -18', 1.6) + '<path d="M7 -18l-4.5 1 3.5 3.5zM13 -18l-4.5 1 3.5 3.5z" fill="' + K + '"/>';
      case 'sw': return line('M-44 0H-16M16 0H44') + '<circle cx="-16" r="3.4" fill="' + K + '"/><circle cx="16" r="3.4" fill="' + K + '"/>' +
        (el.closed ? line('M-16 0H16') : line('M-16 0L14 -14'));
      case 'buzzer': return line('M-44 0H-13M13 0H44') + '<path d="M-13 0 A13 13 0 0 1 13 0 Z" fill="#fff" stroke="' + K + '" stroke-width="2.4" stroke-linejoin="round"/>';
      default: // appareils de mesure
        return '<circle r="15" fill="#fff" stroke="' + K + '" stroke-width="2.4"/>' +
          '<text x="0" y="6.5" font-size="18" font-weight="700" fill="' + K + '" text-anchor="middle" font-family="Fredoka, Nunito, sans-serif">' + TYPES[el.type].meter + '</text>';
    }
  }

  function real(el) {
    switch (el.type) {
      case 'gen': return realGen(el);
      case 'lamp': return realLamp(el);
      case 'res': return realRes(el);
      case 'motor': return realMotor(el);
      case 'led': return realLed(el);
      case 'sw': return realSw(el);
      case 'buzzer': return realBuzzer(el);
      default: return realMeter(el);
    }
  }
  function draw(el, schemaMode) { return schemaMode ? schema(el) : real(el); }

  // Boîte englobante locale (orientation horizontale)
  function bbox(type, schemaMode) {
    if (isMeter(type)) return schemaMode ? { x0: -16, y0: -16, x1: 16, y1: 16 } : { x0: -31, y0: -39, x1: 31, y1: 39 };
    if (schemaMode) return type === 'gen' ? { x0: -44, y0: -22, x1: 44, y1: 18 } : { x0: -44, y0: -19, x1: 44, y1: 16 };
    if (type === 'gen') return { x0: -60, y0: -45, x1: 60, y1: 24 };
    if (type === 'motor') return { x0: -52, y0: -30, x1: 52, y1: 30 };
    return { x0: -52, y0: -22, x1: 52, y1: 20 };
  }

  // Définitions SVG partagées (dégradés)
  function defs() {
    var leds = TYPES.led.opts.map(function (o, k) {
      return '<radialGradient id="g-led' + k + '"><stop offset="0" stop-color="' + o.c + '" stop-opacity=".95"/><stop offset=".35" stop-color="' + o.c + '" stop-opacity=".5"/><stop offset="1" stop-color="' + o.c + '" stop-opacity="0"/></radialGradient>';
    }).join('');
    return '<radialGradient id="g-halo"><stop offset="0" stop-color="#FFFBE6" stop-opacity="1"/><stop offset=".28" stop-color="#FFE57A" stop-opacity=".9"/><stop offset=".6" stop-color="#FFCF4A" stop-opacity=".4"/><stop offset="1" stop-color="#FFC23A" stop-opacity="0"/></radialGradient>' +
      leds +
      '<radialGradient id="g-fire"><stop offset="0" stop-color="#FFF3A0"/><stop offset=".45" stop-color="#FFA21F"/><stop offset="1" stop-color="#E8401A" stop-opacity="0"/></radialGradient>' +
      '<radialGradient id="g-smoke"><stop offset="0" stop-color="#6B6F75" stop-opacity=".7"/><stop offset="1" stop-color="#6B6F75" stop-opacity="0"/></radialGradient>' +
      '<radialGradient id="g-flash"><stop offset="0" stop-color="#fff" stop-opacity="1"/><stop offset=".4" stop-color="#FFF2B0" stop-opacity=".8"/><stop offset="1" stop-color="#FFE27A" stop-opacity="0"/></radialGradient>' +
      '<pattern id="g-grid" width="20" height="20" patternUnits="userSpaceOnUse"><circle cx="10" cy="10" r="1.2" fill="#9AA4AE" fill-opacity=".45"/></pattern>';
  }

  // Mélange de deux couleurs hexadécimales
  function mix(a, b, t) {
    var pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
    var r = Math.round(((pa >> 16) & 255) * (1 - t) + ((pb >> 16) & 255) * t);
    var g = Math.round(((pa >> 8) & 255) * (1 - t) + ((pb >> 8) & 255) * t);
    var bl = Math.round((pa & 255) * (1 - t) + (pb & 255) * t);
    return '#' + ((1 << 24) | (r << 16) | (g << 8) | bl).toString(16).slice(1);
  }
  // Rampe de couleurs : stops = [[t, '#hex'], ...]
  function ramp(stops, t) {
    if (t <= stops[0][0]) return stops[0][1];
    for (var i = 1; i < stops.length; i++) {
      if (t <= stops[i][0]) return mix(stops[i - 1][1], stops[i][1], (t - stops[i - 1][0]) / (stops[i][0] - stops[i - 1][0]));
    }
    return stops[stops.length - 1][1];
  }

  /* ---------- Textes des fenêtres « ? » ---------- */
  var INFO = {
    gen: 'Le générateur est un <b>dipôle générateur</b> : il fournit l\'électricité au circuit. Le courant sort par sa borne <b>+</b> (rouge) et revient par sa borne <b>−</b> (noire).',
    lamp: 'La lampe est un <b>dipôle récepteur</b> : elle transforme une partie de l\'électricité en <b>lumière</b>, mais aussi en chaleur. Elle brille normalement lorsqu\'elle reçoit sa <b>tension nominale</b>.',
    res: 'La résistance est un <b>dipôle récepteur</b> : elle transforme une partie de l\'électricité qui la traverse en <b>chaleur</b> et limite le passage du courant. Ses bagues de couleur indiquent sa valeur.',
    motor: 'Le moteur est un <b>dipôle récepteur</b> : il se met à tourner lorsque le courant le traverse. Son <b>sens de rotation</b> dépend du sens du courant.',
    led: 'La DEL (diode électroluminescente) ne laisse passer le courant que <b>dans un seul sens</b> : de sa borne <b>+</b> vers sa borne <b>−</b>. Branchée à l\'envers, elle reste éteinte.',
    sw: 'L\'interrupteur n\'est pas un récepteur : c\'est un <b>pont</b> qui laisse passer le courant ou non. <b>Touche-le</b> pour l\'ouvrir ou le fermer.',
    buzzer: 'Le buzzer transforme l\'électricité en <b>son</b>. Il fonctionne quelle que soit la tension : plus il reçoit d\'électricité, plus il sonne <b>fort</b>.'
  };
  var FICHE = {
    voltmeter: {
      intro: 'La <b>tension</b> représente la « force » avec laquelle l\'électricité traverse un dipôle. On la mesure juste avant et juste après le dipôle.',
      rows: [['Grandeur', 'Tension <b>U</b>'], ['Unité', 'Volt (<b>V</b>)'], ['Branchement', 'En <b>dérivation</b>, aux bornes du dipôle'], ['Bornes', '<b>V</b> et <b>COM</b>'], ['Calibre', 'La lettre <b>V</b>']],
      tip: 'Approche-le d\'un dipôle : il se branche tout seul à ses bornes.'
    },
    ammeter: {
      intro: 'L\'<b>intensité</b> est la « quantité » d\'électricité qui passe dans le circuit, comme un débit. L\'ampèremètre doit être <b>traversé</b> par l\'électricité.',
      rows: [['Grandeur', 'Intensité <b>I</b>'], ['Unité', 'Ampère (<b>A</b>)'], ['Branchement', 'En <b>série</b>, à l\'endroit qui nous intéresse'], ['Bornes', '<b>A</b> et <b>COM</b>'], ['Calibre', 'La lettre <b>A</b>']],
      tip: 'Approche-le d\'un fil : il prend sa place dans le circuit.'
    },
    ohmmeter: {
      intro: 'La <b>résistance</b> est la capacité d\'un dipôle récepteur à bloquer le passage de l\'électricité. L\'ohmmètre envoie lui-même un petit courant dans le dipôle.',
      rows: [['Grandeur', 'Résistance <b>R</b>'], ['Unité', 'Ohm (<b>Ω</b>)'], ['Branchement', 'Sur un récepteur <b>hors du circuit</b>'], ['Bornes', '<b>Ω</b> et <b>COM</b>'], ['Calibre', 'Le symbole <b>Ω</b>']],
      tip: 'Approche-le d\'un dipôle qui n\'est pas alimenté. Si le dipôle reçoit du courant, l\'écran affiche « Err ». Attention : s\'il est encore relié à d\'autres récepteurs, l\'ohmmètre les mesure aussi.'
    }
  };

  return {
    T: T, TYPES: TYPES, DIPOLES: DIPOLES, METERS: METERS,
    isMeter: isMeter, opt: opt, model: model, loadRatio: loadRatio, canBreak: canBreak,
    optText: optText, num: num, draw: draw, bbox: bbox, defs: defs, mix: mix, ramp: ramp,
    INFO: INFO, FICHE: FICHE, LED_I: LED_I
  };
})();
