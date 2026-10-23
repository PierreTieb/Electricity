// Résolution du circuit par analyse nodale.
// Chaque borne de dipôle est un nœud ; fils et ampèremètres sont de très petites résistances.
// Résultats écrits directement dans les objets : el.U, el.I (de la borne 0 vers la borne 1), wire.I (de a vers b).
window.Solver = (function () {
  var R_WIRE = 0.005, GMIN = 1e-8;

  function gauss(A, b, n) {
    for (var c = 0; c < n; c++) {
      var p = c, best = Math.abs(A[c][c]);
      for (var r = c + 1; r < n; r++) { var v = Math.abs(A[r][c]); if (v > best) { best = v; p = r; } }
      if (best < 1e-30) continue;
      if (p !== c) { var t = A[p]; A[p] = A[c]; A[c] = t; var tb = b[p]; b[p] = b[c]; b[c] = tb; }
      var row = A[c], piv = row[c];
      for (var r2 = c + 1; r2 < n; r2++) {
        var f = A[r2][c] / piv;
        if (f === 0) continue;
        var rr = A[r2];
        for (var k = c; k < n; k++) rr[k] -= f * row[k];
        b[r2] -= f * b[c];
      }
    }
    var x = new Float64Array(n);
    for (var i = n - 1; i >= 0; i--) {
      var s = b[i];
      for (var j = i + 1; j < n; j++) s -= A[i][j] * x[j];
      x[i] = Math.abs(A[i][i]) < 1e-30 ? 0 : s / A[i][i];
    }
    return x;
  }

  // dipoles : éléments non-mesureurs ; links : [{a:{el,i}, b:{el,i}, obj}] (fils et ampèremètres)
  function solve(dipoles, links) {
    var idx = {};
    dipoles.forEach(function (e, k) { idx[e.id] = k; });
    var n = dipoles.length * 2;
    dipoles.forEach(function (e) { e.U = 0; e.I = 0; });
    links.forEach(function (l) { l.obj.I = 0; });
    if (!n) return;

    function node(ref) { return idx[ref.el] == null ? -1 : idx[ref.el] * 2 + ref.i; }
    var models = dipoles.map(function (e) { return Comp.model(e); });
    var leds = [];
    models.forEach(function (m, k) { if (m && m.kind === 'led') { if (dipoles[k]._on == null) dipoles[k]._on = true; leds.push(k); } });

    var V;
    for (var iter = 0; iter < 40; iter++) {
      var A = [], b = new Float64Array(n);
      for (var r = 0; r < n; r++) { A.push(new Float64Array(n)); A[r][r] = GMIN; }
      var stamp = function (a, c, g, s) {
        if (a < 0 || c < 0) return;
        A[a][a] += g; A[c][c] += g; A[a][c] -= g; A[c][a] -= g;
        b[a] -= s; b[c] += s;
      };
      models.forEach(function (m, k) {
        if (!m) return;
        var a = 2 * k, c = 2 * k + 1;
        if (m.kind === 'src') stamp(a, c, 1 / m.r, -m.E / m.r);
        else if (m.kind === 'R') stamp(a, c, 1 / m.R, 0);
        else if (m.kind === 'led') {
          if (dipoles[k]._on) stamp(a, c, 1 / m.rd, -m.vf / m.rd);
          else stamp(a, c, 1e-9, 0);
        }
      });
      links.forEach(function (l) { stamp(node(l.a), node(l.b), 1 / R_WIRE, 0); });
      V = gauss(A, b, n);

      var changed = false;
      leds.forEach(function (k) {
        var m = models[k], v = V[2 * k] - V[2 * k + 1], e = dipoles[k];
        if (e._on && v < m.vf - 1e-9) { e._on = false; changed = true; }
        else if (!e._on && v > m.vf + 1e-9) { e._on = true; changed = true; }
      });
      if (!changed) break;
    }

    models.forEach(function (m, k) {
      var e = dipoles[k], v = V[2 * k] - V[2 * k + 1];
      e.U = v;
      if (!m) e.I = 0;
      else if (m.kind === 'src') e.I = (v - m.E) / m.r;
      else if (m.kind === 'R') e.I = v / m.R;
      else if (m.kind === 'led') e.I = e._on ? (v - m.vf) / m.rd : 0;
    });
    links.forEach(function (l) {
      var a = node(l.a), c = node(l.b);
      l.obj.I = a < 0 || c < 0 ? 0 : (V[a] - V[c]) / R_WIRE;
    });
    return { V: V, node: node };
  }

  // Résistance vue par un ohmmètre entre les bornes de « target » : on injecte 1 A,
  // les générateurs et les DEL ne laissent pas passer le petit courant de l'ohmmètre.
  function resistance(dipoles, links, target) {
    var idx = {};
    dipoles.forEach(function (e, k) { idx[e.id] = k; });
    var n = dipoles.length * 2, A = [], b = new Float64Array(n);
    for (var r = 0; r < n; r++) { A.push(new Float64Array(n)); A[r][r] = GMIN; }
    function stamp(a, c, g) {
      if (a < 0 || c < 0) return;
      A[a][a] += g; A[c][c] += g; A[a][c] -= g; A[c][a] -= g;
    }
    function node(ref) { return idx[ref.el] == null ? -1 : idx[ref.el] * 2 + ref.i; }
    dipoles.forEach(function (e, k) {
      var m = Comp.model(e);
      if (m && m.kind === 'R') stamp(2 * k, 2 * k + 1, 1 / m.R);
    });
    links.forEach(function (l) { stamp(node(l.a), node(l.b), 1 / R_WIRE); });
    var t = idx[target.id] * 2;
    b[t] = 1; b[t + 1] = -1;
    var V = gauss(A, b, n);
    return V[t] - V[t + 1];
  }

  return { solve: solve, resistance: resistance };
})();
