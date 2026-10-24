// Animation de la loi d'Ohm : un générateur et une résistance vus de près.
// La tension U et la résistance R se règlent avec deux jauges (valeurs non affichées) ; l'intensité I = U / R en découle.
// La formule R = U / I grossit ou rétrécit ses lettres selon les valeurs, les électrons accélèrent ou ralentissent
// et la résistance chauffe plus ou moins.
window.OhmAnim = (function () {
  var U0 = 1, U1 = 12, R0 = 10, R1 = 100, I0 = U0 / R1, I1 = U1 / R0, P1 = U1 * I1;
  var COL = { U: '#D9463B', R: '#2F9E5E', I: '#2F6FD6' };
  // Position sur une échelle logarithmique (0 à 1) : les trois lettres varient alors de façon cohérente
  function norm(v, a, b) { return Math.max(0, Math.min(1, Math.log(v / a) / Math.log(b / a))); }

  // Dessin : générateur en haut, résistance en bas, fils épais pour bien voir les électrons
  var W = 420, H = 290, GEN = { x: 210, y: 66, k: 1.3 }, RES = { x: 210, y: 228, k: 1.7 }, X0 = 52, X1 = 368, T = Comp.T;
  // Trajets des électrons : du − du générateur vers la résistance, puis de la résistance vers le +
  var PATHS = [
    [[GEN.x + T * GEN.k, GEN.y], [X1, GEN.y], [X1, RES.y], [RES.x + T * RES.k, RES.y]],
    [[RES.x - T * RES.k, RES.y], [X0, RES.y], [X0, GEN.y], [GEN.x - T * GEN.k, GEN.y]]
  ];
  function len(p) { var L = 0; for (var i = 1; i < p.length; i++) L += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]); return L; }
  // Point à la distance s le long du trajet, avec la direction du segment
  function at(p, s) {
    for (var i = 1; i < p.length; i++) {
      var dx = p[i][0] - p[i - 1][0], dy = p[i][1] - p[i - 1][1], l = Math.hypot(dx, dy);
      if (s <= l || i === p.length - 1) { var t = Math.min(1, s / l); return { x: p[i - 1][0] + dx * t, y: p[i - 1][1] + dy * t, dx: dx / l, dy: dy / l }; }
      s -= l;
    }
  }
  function roundD(p, r) {
    var d = 'M' + p[0][0] + ' ' + p[0][1];
    for (var i = 1; i < p.length - 1; i++) {
      var a = p[i - 1], b = p[i], c = p[i + 1];
      var u = [Math.sign(b[0] - a[0]), Math.sign(b[1] - a[1])], v = [Math.sign(c[0] - b[0]), Math.sign(c[1] - b[1])];
      d += 'L' + (b[0] - u[0] * r) + ' ' + (b[1] - u[1] * r) + 'Q' + b[0] + ' ' + b[1] + ' ' + (b[0] + v[0] * r) + ' ' + (b[1] + v[1] * r);
    }
    return d + 'L' + p[p.length - 1][0] + ' ' + p[p.length - 1][1];
  }
  function wire(p) {
    var d = roundD(p, 14);
    return '<path d="' + d + '" fill="none" stroke="#2B323A" stroke-width="22" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<path d="' + d + '" fill="none" stroke="#4A5663" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<path d="' + d + '" fill="none" stroke="#fff" stroke-opacity=".18" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" transform="translate(0 -4)"/>';
  }
  function hash(k) { var x = Math.sin(k * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }

  function gauge(id, label, col, ro) {
    return '<div class="anim-g" style="--c:' + col + '"><span class="anim-g__l"><b style="color:' + col + '">' + id + '</b>' + label + '</span>' +
      (ro ? '<span class="anim-g__bar" data-g="' + id + '"></span>'
        : '<input type="range" min="0" max="1000" step="1" data-g="' + id + '" aria-label="' + label + '">') +
      '<span class="anim-trend" data-t="' + id + '" aria-hidden="true"></span></div>';
  }

  function mount(host) {
    var st = { U: 6, R: 40 }, trend = { U: 0, R: 0, I: 0 }, trendT = { U: 0, R: 0, I: 0 }, raf = 0, last = 0, time = 0, ph = [0, 0];
    host.innerHTML =
      '<div class="anim">' +
      '<div class="anim-formula" aria-label="Loi d\'Ohm : R égale U divisé par I"><span class="af" data-f="R" style="color:' + COL.R + '">R</span><span class="af-eq">=</span>' +
      '<span class="frac"><span class="af" data-f="U" style="color:' + COL.U + '">U</span><span class="af" data-f="I" style="color:' + COL.I + '">I</span></span></div>' +
      '<svg class="anim-svg" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Circuit avec un générateur et une résistance">' +
      wire(PATHS[0]) + wire(PATHS[1]) +
      '<g class="anim-el"><path fill="#FFF3B0" fill-opacity=".35"/><path fill="#FFFBE8"/></g>' +
      '<g transform="translate(' + GEN.x + ' ' + GEN.y + ') scale(' + GEN.k + ')">' + Comp.draw({ type: 'gen', opt: 1 }) + '</g>' +
      '<g transform="translate(' + RES.x + ' ' + RES.y + ') scale(' + RES.k + ')">' + Comp.draw({ type: 'res', opt: 1 }) + '</g>' +
      '</svg>' +
      '<div class="anim-ctl">' + gauge('U', 'Tension', COL.U) + gauge('R', 'Résistance', COL.R) + gauge('I', 'Intensité', COL.I, true) + '</div>' +
      '<p class="anim-say" aria-live="polite">Fais varier la tension U ou la résistance R, et observe l\'intensité I.</p>' +
      '</div>';
    var q = function (s) { return host.querySelector(s); };
    var el = q('.anim-el'), halo = el.firstChild, core = el.lastChild, heat = q('.heat'), waves = q('.hwaves');
    var lcd = q('.lcd'), knob = q('.anim-svg [transform^="rotate"]');
    if (lcd) lcd.textContent = 'U';
    var inU = q('input[data-g="U"]'), inR = q('input[data-g="R"]');
    inU.value = Math.round((st.U - U0) / (U1 - U0) * 1000);
    inR.value = Math.round((st.R - R0) / (R1 - R0) * 1000);

    function I() { return st.U / st.R; }
    function say(k, up) {
      var t = k === 'U'
        ? (up ? 'Tu augmentes U, R ne change pas : I augmente. Les électrons vont plus vite et la résistance chauffe davantage.'
          : 'Tu diminues U, R ne change pas : I diminue. Les électrons ralentissent et la résistance chauffe moins.')
        : (up ? 'Tu augmentes R, U ne change pas : I diminue. Les électrons ralentissent et la résistance chauffe moins.'
          : 'Tu diminues R, U ne change pas : I augmente. Les électrons vont plus vite et la résistance chauffe davantage.');
      q('.anim-say').textContent = t;
    }
    function render() {
      var n = { U: norm(st.U, U0, U1), R: norm(st.R, R0, R1), I: norm(I(), I0, I1) };
      ['U', 'R', 'I'].forEach(function (k) {
        q('.af[data-f="' + k + '"]').style.fontSize = (1.3 + 2.4 * n[k]).toFixed(2) + 'em';
        var g = q('[data-g="' + k + '"]');
        // Jauge : remplissage et couleur de plus en plus soutenue avec la valeur
        g.style.setProperty('--p', (k === 'I' ? n.I * 100 : g.value / 10) + '%');
        g.style.setProperty('--o', (.35 + .65 * n[k]).toFixed(2));
      });
      if (knob) knob.setAttribute('transform', 'rotate(' + (-120 + 240 * (st.U - U0) / (U1 - U0)).toFixed(1) + ' 32 -24)');
    }
    function setTrend(k, d) {
      trend[k] = d; trendT[k] = performance.now();
      var t = q('[data-t="' + k + '"]');
      t.textContent = d > 0 ? '▲' : '▼';
      t.className = 'anim-trend ' + (d > 0 ? 'up' : 'down') + ' on';
    }
    function onInput(ev) {
      var k = ev.target.getAttribute('data-g'), t = ev.target.value / 1000, before = st[k], i0 = I();
      st[k] = k === 'U' ? U0 + (U1 - U0) * t : R0 + (R1 - R0) * t;
      if (st[k] === before) return;
      setTrend(k, st[k] > before ? 1 : -1);
      setTrend('I', I() > i0 ? 1 : -1);
      say(k, st[k] > before);
      render();
    }
    inU.addEventListener('input', onInput);
    inR.addEventListener('input', onInput);

    function frame(ts) {
      raf = requestAnimationFrame(frame);
      var dt = last ? Math.min(.05, (ts - last) / 1000) : 0;
      last = ts; time += dt;
      // Électrons toujours présents ; seule leur vitesse dépend de l'intensité (sens : du − vers le +)
      var v = 260 * Math.pow(I() / I1, .6), SP = 10, dc = '', dh = '';
      PATHS.forEach(function (p, j) {
        var L = len(p);
        ph[j] = (ph[j] + v * dt) % SP;
        for (var k = 0, n = Math.floor(L / SP); k < n; k++) {
          var s = k * SP + ph[j] + (hash(k + 40 * j) - .5) * 3;
          if (s < 0 || s > L) continue;
          var a = at(p, s), o = (hash(k + 99 + 40 * j) - .5) * 9, x = a.x - a.dy * o, y = a.y + a.dx * o;
          dc += 'M' + (x - 2.2).toFixed(1) + ' ' + y.toFixed(1) + 'a2.2 2.2 0 1 0 4.4 0a2.2 2.2 0 1 0 -4.4 0';
          dh += 'M' + (x - 4.2).toFixed(1) + ' ' + y.toFixed(1) + 'a4.2 4.2 0 1 0 8.4 0a4.2 4.2 0 1 0 -8.4 0';
        }
      });
      core.setAttribute('d', dc); halo.setAttribute('d', dh);
      // Échauffement de la résistance : lueur et ondes de chaleur selon la puissance U × I
      var h = 2.25 * Math.sqrt(st.U * I() / P1);
      if (heat) heat.setAttribute('opacity', Math.min(.6, h * .35).toFixed(3));
      if (waves) {
        waves.setAttribute('opacity', h < .03 ? '0' : '1');
        waves.setAttribute('stroke', Comp.ramp([[0, '#FFC070'], [1, '#FF8A2A'], [2.25, '#E5372B']], h));
        for (var w = 0, hs = waves.children; w < hs.length; w++) {
          var hp = (time * 1.1 + w / hs.length) % 1;
          hs[w].setAttribute('transform', 'translate(0 ' + (-7 * hp).toFixed(2) + ') scale(' + (.75 + .2 * Math.min(h, 2)).toFixed(2) + ')');
          hs[w].setAttribute('opacity', (Math.sin(Math.PI * hp) * Math.min(1, .3 + .7 * h)).toFixed(3));
        }
      }
      // Les flèches de tendance s'effacent peu après le dernier réglage
      ['U', 'R', 'I'].forEach(function (k) { if (trend[k] && ts - trendT[k] > 1400) { trend[k] = 0; q('[data-t="' + k + '"]').classList.remove('on'); } });
    }
    render();
    raf = requestAnimationFrame(frame);
    return { destroy: function () { cancelAnimationFrame(raf); host.innerHTML = ''; } };
  }

  return { label: 'Voir l\'animation', title: 'La loi d\'Ohm en action', mount: mount };
})();
