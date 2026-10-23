// Laboratoire : plan de travail, fils, appareils de mesure, animations et effets.
window.Lab = (function () {
  var C = Comp, T = C.T, GRID = 20, D2R = Math.PI / 180, NS = 'http://www.w3.org/2000/svg';
  var st = { els: [], wires: [], mem: {}, schema: false, showCur: false, showEl: false, nid: 1, sel: null };
  var svg, ws, bar, barList, hint, toastEl, pop, popBody, popTitle, popIco, btnClear, clearLbl;
  var Lw, Lwh, Le, Ll, Lel, La, Lm, Lfx, Lui, gridRect;
  var view = { w: 800, h: 560, s: 1 };
  var needSolve = true, geom = true, sol = null, obst = [], segsDone = [];
  var running = false, lastT = 0, raf = 0;
  var drag = null, pdrag = null, parts = [], tab = 'dipoles', phases = {}, popEl = null;
  var actx = null, master = null, toastTimer = 0, lastToast = '', clearTimer = 0;

  function $(id) { return document.getElementById(id); }
  function get(id) { for (var i = 0; i < st.els.length; i++) if (st.els[i].id === id) return st.els[i]; return null; }
  function isM(e) { return C.isMeter(e.type); }
  function dipoles() { return st.els.filter(function (e) { return !isM(e); }); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function f1(v) { return Math.round(v * 10) / 10; }
  function dist(a, b) { return Math.hypot(a[0] - b[0], a[1] - b[1]); }

  /* ================= Géométrie ================= */
  function rot(v, a) { var c = Math.cos(a * D2R), s = Math.sin(a * D2R); return [v[0] * c - v[1] * s, v[0] * s + v[1] * c]; }
  function termAt(i, ang, x, y) { var v = rot([i ? T : -T, 0], ang); return [x + v[0], y + v[1]]; }
  function term(e, i) { return termAt(i, e.ang, e.px, e.py); }
  function snapDir(v) { return Math.abs(v[0]) >= Math.abs(v[1]) ? [v[0] < 0 ? -1 : 1, 0] : [0, v[1] < 0 ? -1 : 1]; }
  function tdir(i, ang) { return snapDir(rot([i ? 1 : -1, 0], ang)); }
  function bboxAt(e, ang, x, y) {
    var b = C.bbox(e.type, st.schema), a = Math.round(ang / 90) * 90;
    var pts = [[b.x0, b.y0], [b.x1, b.y0], [b.x1, b.y1], [b.x0, b.y1]].map(function (p) { return rot(p, a); });
    var xs = pts.map(function (p) { return p[0]; }), ys = pts.map(function (p) { return p[1]; });
    return { x0: x + Math.min.apply(0, xs), y0: y + Math.min.apply(0, ys), x1: x + Math.max.apply(0, xs), y1: y + Math.max.apply(0, ys) };
  }
  function boxOf(e) {
    if (isM(e)) { var M = mpos(e), b = C.bbox(e.type, st.schema); return { x0: M[0] + b.x0, y0: M[1] + b.y0, x1: M[0] + b.x1, y1: M[1] + b.y1 }; }
    return bboxAt(e, e.ang, e.px, e.py);
  }
  function mpos(m) { return m._g && m._g.M ? m._g.M : [m.px, m.py]; }

  /* ---------- Polylignes ---------- */
  function plen(p) { var L = 0; for (var i = 1; i < p.length; i++) L += dist(p[i - 1], p[i]); return L; }
  function pAt(p, s) {
    for (var i = 1; i < p.length; i++) {
      var l = dist(p[i - 1], p[i]);
      if (s <= l || i === p.length - 1) {
        var t = l ? clamp(s / l, 0, 1) : 0;
        return { x: p[i - 1][0] + (p[i][0] - p[i - 1][0]) * t, y: p[i - 1][1] + (p[i][1] - p[i - 1][1]) * t, dx: l ? (p[i][0] - p[i - 1][0]) / l : 1, dy: l ? (p[i][1] - p[i - 1][1]) / l : 0 };
      }
      s -= l;
    }
    return { x: p[0][0], y: p[0][1], dx: 1, dy: 0 };
  }
  function closest(p, q) {
    var best = { d: 1e9, s: 0 }, acc = 0;
    for (var i = 1; i < p.length; i++) {
      var a = p[i - 1], b = p[i], l = dist(a, b);
      var t = l ? clamp(((q[0] - a[0]) * (b[0] - a[0]) + (q[1] - a[1]) * (b[1] - a[1])) / (l * l), 0, 1) : 0;
      var d = dist(q, [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
      if (d < best.d) best = { d: d, s: acc + t * l };
      acc += l;
    }
    return best;
  }
  function cub(p0, c1, c2, p3, n) {
    var out = [];
    for (var k = 0; k <= n; k++) {
      var t = k / n, u = 1 - t;
      out.push([u * u * u * p0[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * p3[0],
        u * u * u * p0[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * p3[1]]);
    }
    return out;
  }
  function polyD(p) { return p.map(function (q, i) { return (i ? 'L' : 'M') + f1(q[0]) + ' ' + f1(q[1]); }).join(''); }
  function roundD(p, r) {
    if (p.length < 2) return '';
    var d = 'M' + f1(p[0][0]) + ' ' + f1(p[0][1]);
    for (var i = 1; i < p.length - 1; i++) {
      var a = p[i - 1], b = p[i], c = p[i + 1], l1 = dist(a, b), l2 = dist(b, c), rr = Math.min(r, l1 / 2, l2 / 2);
      if (!l1 || !l2) continue;
      var u = [(b[0] - a[0]) / l1, (b[1] - a[1]) / l1], v = [(c[0] - b[0]) / l2, (c[1] - b[1]) / l2];
      d += 'L' + f1(b[0] - u[0] * rr) + ' ' + f1(b[1] - u[1] * rr) + 'Q' + f1(b[0]) + ' ' + f1(b[1]) + ' ' + f1(b[0] + v[0] * rr) + ' ' + f1(b[1] + v[1] * rr);
    }
    var z = p[p.length - 1];
    return d + 'L' + f1(z[0]) + ' ' + f1(z[1]);
  }

  /* ---------- Routage des fils (lignes brisées horizontales / verticales) ---------- */
  function simplify(p) {
    var o = [p[0]];
    for (var i = 1; i < p.length; i++) {
      var q = p[i], l = o[o.length - 1];
      if (Math.abs(q[0] - l[0]) < .5 && Math.abs(q[1] - l[1]) < .5) continue;
      if (o.length >= 2) {
        var k = o[o.length - 2];
        if ((Math.abs(k[0] - l[0]) < .5 && Math.abs(l[0] - q[0]) < .5) || (Math.abs(k[1] - l[1]) < .5 && Math.abs(l[1] - q[1]) < .5)) { o[o.length - 1] = q; continue; }
      }
      o.push(q);
    }
    return o;
  }
  function segHit(a, b, r) {
    var x0 = Math.min(a[0], b[0]), x1 = Math.max(a[0], b[0]), y0 = Math.min(a[1], b[1]), y1 = Math.max(a[1], b[1]);
    return x1 > r.x0 + 3 && x0 < r.x1 - 3 && y1 > r.y0 + 3 && y0 < r.y1 - 3;
  }
  function routeCost(p, d1, d2, id1, id2) {
    var c = (p.length - 2) * 14;
    for (var i = 1; i < p.length; i++) {
      var a = p[i - 1], b = p[i];
      c += Math.abs(b[0] - a[0]) + Math.abs(b[1] - a[1]);
      for (var k = 0; k < obst.length; k++) {
        var o = obst[k];
        if ((i === 1 && o.id === id1) || (i === p.length - 1 && o.id === id2)) continue;
        if (segHit(a, b, o.b)) c += 260;
      }
    }
    // Éviter de croiser ou de longer les fils déjà tracés
    for (var j = 1; j < p.length; j++) {
      var a2 = p[j - 1], b2 = p[j], hz = Math.abs(a2[1] - b2[1]) < .5;
      for (var m = 0; m < segsDone.length; m++) {
        var sg = segsDone[m], shz = Math.abs(sg[0][1] - sg[1][1]) < .5;
        if (hz !== shz) {
          var H = hz ? [a2, b2] : sg, V = hz ? sg : [a2, b2];
          var hx0 = Math.min(H[0][0], H[1][0]), hx1 = Math.max(H[0][0], H[1][0]), vy0 = Math.min(V[0][1], V[1][1]), vy1 = Math.max(V[0][1], V[1][1]);
          if (V[0][0] > hx0 + 1 && V[0][0] < hx1 - 1 && H[0][1] > vy0 + 1 && H[0][1] < vy1 - 1) c += 110;
        } else if (hz ? Math.abs(a2[1] - sg[0][1]) < 2 : Math.abs(a2[0] - sg[0][0]) < 2) {
          var k0 = hz ? 0 : 1;
          var lo = Math.max(Math.min(a2[k0], b2[k0]), Math.min(sg[0][k0], sg[1][k0])), hi = Math.min(Math.max(a2[k0], b2[k0]), Math.max(sg[0][k0], sg[1][k0]));
          if (hi - lo > 6) c += 80;
        }
      }
    }
    if (p.length >= 2) {
      var s0 = [p[1][0] - p[0][0], p[1][1] - p[0][1]];
      if (s0[0] * d1[0] + s0[1] * d1[1] < -.01) c += 900;
      var n = p.length, s1 = [p[n - 1][0] - p[n - 2][0], p[n - 1][1] - p[n - 2][1]];
      if (s1[0] * d2[0] + s1[1] * d2[1] > .01) c += 900;
    }
    return c;
  }
  function route(p1, d1, p2, d2, b1, b2, id1, id2) {
    var s = 16, q1 = [p1[0] + d1[0] * s, p1[1] + d1[1] * s], q2 = [p2[0] + d2[0] * s, p2[1] + d2[1] * s];
    var mx = (q1[0] + q2[0]) / 2, my = (q1[1] + q2[1]) / 2;
    var yT = Math.min(q1[1], q2[1], b1.y0, b2.y0) - 22, yB = Math.max(q1[1], q2[1], b1.y1, b2.y1) + 22;
    var xL = Math.min(q1[0], q2[0], b1.x0, b2.x0) - 22, xR = Math.max(q1[0], q2[0], b1.x1, b2.x1) + 22;
    var cands = [
      [q1, [q2[0], q1[1]], q2], [q1, [q1[0], q2[1]], q2],
      [q1, [mx, q1[1]], [mx, q2[1]], q2], [q1, [q1[0], my], [q2[0], my], q2],
      [q1, [q1[0], yT], [q2[0], yT], q2], [q1, [q1[0], yB], [q2[0], yB], q2],
      [q1, [xL, q1[1]], [xL, q2[1]], q2], [q1, [xR, q1[1]], [xR, q2[1]], q2]
    ];
    var best = null, bc = 1e12;
    cands.forEach(function (c) {
      var p = simplify([p1].concat(c, [p2])), cost = routeCost(p, d1, d2, id1, id2);
      if (cost < bc) { bc = cost; best = p; }
    });
    return { pts: best, cost: bc };
  }
  function wroute(a, b) {
    var ea = get(a.el), eb = get(b.el);
    return route(term(ea, a.i), tdir(a.i, ea.ang), term(eb, b.i), tdir(b.i, eb.ang),
      bboxAt(ea, ea.ang, ea.px, ea.py), bboxAt(eb, eb.ang, eb.px, eb.py), ea.id, eb.id).pts;
  }

  /* ================= Données du circuit ================= */
  function nextName(type) {
    var p = C.TYPES[type].prefix, used = {};
    st.els.forEach(function (e) { if (e.name && e.name.indexOf(p) === 0) used[e.name.slice(p.length)] = 1; });
    for (var k = 1; ; k++) if (!used[k]) return p + k;
  }
  function addEl(type, x, y) {
    var t = C.TYPES[type];
    var e = {
      id: st.nid++, type: type, x: x, y: y, px: x, py: y, vx: 0, vy: 0, rot: 0, ang: 0, va: 0,
      opt: t.opts ? (st.mem[type] != null ? st.mem[type] : t.def) : 0, closed: false, broken: false,
      name: isM({ type: type }) ? '' : nextName(type), U: 0, I: 0, ratio: 0, dirty: true, la: -34, pa: 0, spd: 0
    };
    st.els.push(e);
    needSolve = true; geom = true;
    hint.classList.add('off');
    return e;
  }
  function removeEl(e) {
    if (e.type === 'ammeter') detachMeter(e);
    if (e.dom) e.dom.remove();
    stopBuzz(e);
    st.wires = st.wires.filter(function (w) { return w.a.el !== e.id && w.b.el !== e.id; });
    st.els.forEach(function (m) {
      if (!m.attach) return;
      if ((m.type !== 'ammeter' && m.attach.el === e.id) || (m.type === 'ammeter' && (m.attach.a.el === e.id || m.attach.b.el === e.id))) {
        var M = mpos(m); m.px = m.x = M[0]; m.py = m.y = M[1]; m.attach = null;
      }
    });
    st.els = st.els.filter(function (x) { return x !== e; });
    if (popEl === e) closePop();
    needSolve = true; geom = true;
    if (!st.els.length) hint.classList.remove('off');
  }
  function newWire(a, b) { return { id: st.nid++, a: { el: a.el, i: a.i }, b: { el: b.el, i: b.i }, temp: 0, burn: 0, I: 0 }; }
  function sameRef(a, b) { return a.el === b.el && a.i === b.i; }
  function addWire(a, b) {
    if (sameRef(a, b)) return;
    if (st.wires.some(function (w) { return (sameRef(w.a, a) && sameRef(w.b, b)) || (sameRef(w.a, b) && sameRef(w.b, a)); })) return;
    st.wires.push(newWire(a, b));
    autoOrient(a, b);
    needSolve = true; geom = true;
  }
  function removeWire(w) {
    st.wires = st.wires.filter(function (x) { return x !== w; });
    if (st.sel && st.sel.id === w.id) st.sel = null;
    needSolve = true; geom = true;
  }
  function connCount(id) {
    var n = 0;
    st.wires.forEach(function (w) { if (w.a.el === id) n++; if (w.b.el === id) n++; });
    st.els.forEach(function (m) { if (m.type === 'ammeter' && m.attach && (m.attach.a.el === id || m.attach.b.el === id)) n++; });
    return n;
  }

  // Oriente le dipôle fraîchement relié pour que le fil suive au mieux les règles du schéma
  function autoOrient(a, b) {
    var ea = get(a.el), eb = get(b.el);
    var fa = connCount(ea.id) === 1, fb = connCount(eb.id) === 1;
    if (ea === eb || (!fa && !fb)) return;
    var X = fb ? eb : ea, xr = fb ? b : a, O = fb ? ea : eb, or = fb ? a : b;
    computeObst();
    var ox = obst.filter(function (o) { return o.id === X.id; })[0];
    var pO = term(O, or.i), dO = tdir(or.i, O.ang), bO = bboxAt(O, O.ang, O.px, O.py);
    var cur = ((Math.round(X.rot / 90) * 90) % 360 + 360) % 360, best = null;
    [0, 90, 180, 270].forEach(function (r) {
      var pX = termAt(xr.i, r, X.x, X.y), dX = tdir(xr.i, r), bX = bboxAt(X, r, X.x, X.y);
      if (ox) ox.b = bX;
      var c = route(pX, dX, pO, dO, bX, bO, X.id, O.id).cost + (r === cur ? 0 : 3);
      if (!best || c < best.c) best = { r: r, c: c };
    });
    X.rot = X.ang + (((best.r - X.ang) % 360 + 540) % 360 - 180);
    // Alignement : si les deux bornes sont presque en face, on rend le fil parfaitement droit
    var pX = termAt(xr.i, best.r, X.x, X.y), dX = tdir(xr.i, best.r);
    if (dX[1] === 0 && dO[1] === 0 && Math.abs(pX[1] - pO[1]) < 34) X.y += pO[1] - pX[1];
    if (dX[0] === 0 && dO[0] === 0 && Math.abs(pX[0] - pO[0]) < 34) X.x += pO[0] - pX[0];
  }

  /* ---------- Appareils de mesure ---------- */
  function detachMeter(m) {
    if (!m.attach) return;
    var M = mpos(m); m.px = m.x = M[0]; m.py = m.y = M[1];
    if (m.type === 'ammeter') {
      var a = m.attach;
      if (get(a.a.el) && get(a.b.el)) st.wires.push(newWire(a.a, a.b));
    }
    m.attach = null; m.I = 0; m._g = null;
    needSolve = true; geom = true;
  }
  function meterCandidate(m, p) {
    var best = null;
    if (m.type === 'ammeter') {
      st.wires.forEach(function (w) {
        if (!w._pts) return;
        var c = closest(w._pts, p);
        if (c.d < 46 && (!best || c.d < best.d)) best = { w: w, d: c.d, s: c.s };
      });
    } else {
      dipoles().forEach(function (e) {
        var d = dist([e.px, e.py], p);
        if (d < 105 && (!best || d < best.d)) best = { e: e, d: d };
      });
    }
    return best;
  }
  function snapMeter(m) {
    var p = [m.px, m.py], c = meterCandidate(m, p);
    if (!c) return;
    if (m.type === 'ammeter') {
      m.attach = { a: c.w.a, b: c.w.b, f: clamp(c.s / plen(c.w._pts), .15, .85) };
      removeWire(c.w);
    } else {
      var n = rot([0, 1], c.e.ang), side = (p[0] - c.e.px) * n[0] + (p[1] - c.e.py) * n[1] > 0 ? 1 : -1;
      m.attach = { el: c.e.id, dir: [n[0] * side, n[1] * side] };
    }
    needSolve = true; geom = true;
  }
  function pot(e, i) {
    if (!sol) return 0;
    var k = sol.node({ el: e.id, i: i });
    return k < 0 || k >= sol.V.length ? 0 : sol.V[k];
  }
  function meterGeom(m) {
    var g = { M: null, leads: [], sch: [] };
    if (!m.attach) { g.M = [m.px, m.py]; return g; }
    if (m.type === 'ammeter') {
      var A = m.attach;
      if (!get(A.a.el) || !get(A.b.el)) { m.attach = null; g.M = [m.px, m.py]; return g; }
      var pts = wroute(A.a, A.b), at = pAt(pts, A.f * plen(pts));
      g.route = pts; g.M = [at.x, at.y];
      if (!st.schema) {
        // Les cordons rouge et noir remplacent tout le fil : ils partent directement des bornes des dipôles
        var ea = get(A.a.el), eb = get(A.b.el), redFirst = (m.I || 0) >= 0;
        var Pa = term(ea, A.a.i), da = tdir(A.a.i, ea.ang), Pb = term(eb, A.b.i), db = tdir(A.b.i, eb.ang);
        var red = [at.x - 12, at.y + 25], blk = [at.x + 12, at.y + 25];
        var S1 = redFirst ? red : blk, S2 = redFirst ? blk : red;
        var l1 = cub(Pa, [Pa[0] + da[0] * 45, Pa[1] + da[1] * 45], [S1[0], S1[1] + 42], S1, 26);
        var l2 = cub(Pb, [Pb[0] + db[0] * 45, Pb[1] + db[1] * 45], [S2[0], S2[1] + 42], S2, 26);
        g.leads.push({ pts: l1, red: redFirst }, { pts: l2, red: !redFirst });
        g.cond = [{ key: 'a' + m.id + 'x', pts: l1, I: m.I || 0 },
          { key: 'a' + m.id + 'y', pts: l2.slice().reverse(), I: m.I || 0 }];
      }
      return g;
    }
    var t = get(m.attach.el);
    if (!t) { m.attach = null; g.M = [m.px, m.py]; return g; }
    var n = rot([0, 1], t.ang), ax = rot([1, 0], t.ang), dp = n[0] * m.attach.dir[0] + n[1] * m.attach.dir[1];
    // Même côté qu'au branchement ; après un quart de tour, au-dessus (ou à gauche)
    var side = Math.abs(dp) > .5 ? (dp > 0 ? 1 : -1) : Math.abs(n[1]) > .5 ? (n[1] < 0 ? 1 : -1) : (n[0] < 0 ? 1 : -1);
    var bb = C.bbox(t.type, st.schema), ext = side > 0 ? bb.y1 : -bb.y0;
    var hm = st.schema ? 16 : (Math.abs(n[0]) > .7 ? 31 : 39);
    var D = ext + hm + (st.schema ? 26 : 18);
    g.M = [t.px + n[0] * side * D, t.py + n[1] * side * D];
    var T0 = term(t, 0), T1 = term(t, 1);
    if (st.schema) {
      g.sch.push([T0, [T0[0] + n[0] * side * D, T0[1] + n[1] * side * D], [g.M[0] - ax[0] * 15, g.M[1] - ax[1] * 15]]);
      g.sch.push([T1, [T1[0] + n[0] * side * D, T1[1] + n[1] * side * D], [g.M[0] + ax[0] * 15, g.M[1] + ax[1] * 15]]);
    } else {
      var red0 = m.type === 'ohmmeter' || pot(t, 0) >= pot(t, 1);
      var redS = [g.M[0] - 12, g.M[1] + 25], blkS = [g.M[0] + 12, g.M[1] + 25];
      [[T0, red0], [T1, !red0]].forEach(function (q, k) {
        var S = q[1] ? redS : blkS, P = q[0];
        var pts2 = cub(P, [P[0] + n[0] * side * 30, P[1] + n[1] * side * 30], [S[0], S[1] + 36], S, 18);
        g.leads.push({ pts: pts2, red: q[1] });
      });
      g.cond = g.leads.map(function (l, k) { return { key: 'v' + m.id + k, pts: l.pts, I: 0 }; });
    }
    return g;
  }

  /* ================= Résolution électrique ================= */
  function links() {
    var l = st.wires.map(function (w) { return { a: w.a, b: w.b, obj: w }; });
    st.els.forEach(function (m) { if (m.type === 'ammeter' && m.attach) l.push({ a: m.attach.a, b: m.attach.b, obj: m }); });
    return l;
  }
  function doSolve() {
    var dips = dipoles();
    sol = Solver.solve(dips, links());
    dips.forEach(function (e) { e.ratio = C.loadRatio(e); });
    geom = true;
  }

  /* ================= Rendu ================= */
  function computeObst() {
    obst = dipoles().map(function (e) { return { id: e.id, b: bboxAt(e, e.ang, e.px, e.py) }; });
  }
  function computeGeom() {
    computeObst();
    segsDone = [];
    st.wires.forEach(function (w) {
      w._pts = wroute(w.a, w.b);
      for (var i = 1; i < w._pts.length; i++) segsDone.push([w._pts[i - 1], w._pts[i]]);
    });
    st.els.forEach(function (m) { if (isM(m)) m._g = meterGeom(m); });
  }

  function buildEl(e) {
    if (!e.dom) {
      e.dom = document.createElementNS(NS, 'g');
      e.dom.setAttribute('class', 'el');
      e.dom.setAttribute('data-act', 'el');
      e.dom.setAttribute('data-id', e.id);
      (isM(e) ? Lm : Le).appendChild(e.dom);
    }
    var extra = '';
    if (isM(e) && st.schema) extra = '<text class="lcd" x="19" y="-11" font-size="13" fill="#111">---</text>';
    e.dom.innerHTML = '<g class="in">' + C.draw(e, st.schema) + extra + '</g>';
    var q = function (s) { return e.dom.querySelector(s); };
    e.refs = { in: q('.in'), halo: q('.halo'), glass: q('.glass'), fil: q('.fil'), prop: q('.prop'), blur: q('.blur'), heat: q('.heat'), waves: q('.waves'), dome: q('.dome'), core: q('.core'), lever: q('.lever'), lcd: q('.lcd'), up: e.dom.querySelectorAll('.up') };
    e._b = e._lcd = e._h = e._w = null; e._sh = false;
    e.dirty = false;
    placeEl(e);
  }
  function placeEl(e) {
    if (!e.dom) return;
    if (isM(e)) { var M = mpos(e); e.dom.setAttribute('transform', 'translate(' + f1(M[0]) + ' ' + f1(M[1]) + ')'); }
    else {
      e.dom.setAttribute('transform', 'translate(' + f1(e.px) + ' ' + f1(e.py) + ') rotate(' + f1(e.ang) + ')');
      // Les inscriptions (+, −, M) restent lisibles quelle que soit l'orientation
      if (e.refs && e.refs.up) e.refs.up.forEach(function (u) { u.setAttribute('transform', 'rotate(' + f1(-e.ang) + ' ' + u.getAttribute('data-c') + ')'); });
    }
  }

  function wireColor(t) {
    if (st.schema) return t < .12 ? '#111' : C.ramp([[.12, '#111111'], [.55, '#C0301A'], [1, '#FF7A1A']], t);
    return C.ramp([[0, '#3A4550'], [.3, '#7E3A22'], [.65, '#E4521C'], [1, '#FFB040']], t);
  }
  function wireSVG(pts, t, sel) {
    var h = '', d = st.schema ? polyD(pts) : roundD(pts, 9);
    if (sel) h += '<path d="' + d + '" fill="none" stroke="#3D8BFF" stroke-opacity=".4" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>';
    if (t > .25) h += '<path d="' + d + '" fill="none" stroke="#FF6A1A" stroke-opacity="' + Math.min(.6, (t - .25) * .9).toFixed(2) + '" stroke-width="' + (st.schema ? 8 : 11) + '" stroke-linecap="round" stroke-linejoin="round"/>';
    if (st.schema) return h + '<path d="' + d + '" fill="none" stroke="' + wireColor(t) + '" stroke-width="2.4" stroke-linecap="square"/>';
    return h + '<path d="' + d + '" fill="none" stroke="' + wireColor(t) + '" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<path d="' + d + '" fill="none" stroke="#fff" stroke-opacity="' + (.3 * (1 - Math.min(1, t))).toFixed(2) + '" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" transform="translate(-.6 -1)"/>';
  }
  function plug(p) { return st.schema ? '' : '<circle cx="' + f1(p[0]) + '" cy="' + f1(p[1]) + '" r="4.6" fill="#262D34"/><circle cx="' + f1(p[0] - 1.2) + '" cy="' + f1(p[1] - 1.4) + '" r="1.4" fill="#fff" fill-opacity=".5"/>'; }

  function renderWires() {
    var h = '', hh = '';
    st.wires.forEach(function (w) {
      if (!w._pts) return;
      h += wireSVG(w._pts, w.temp, st.sel && st.sel.id === w.id) + plug(w._pts[0]) + plug(w._pts[w._pts.length - 1]);
      hh += '<path class="wire-hit" data-act="wire" data-id="' + w.id + '" d="' + polyD(w._pts) + '" fill="none" stroke="#000" stroke-opacity="0" stroke-width="18"/>';
    });
    st.els.forEach(function (m) {
      if (st.schema && m.type === 'ammeter' && m.attach && m._g && m._g.route) h += wireSVG(m._g.route, 0, false);
    });
    Lw.innerHTML = h; Lwh.innerHTML = hh;
  }
  function renderLeads() {
    var h = '';
    st.els.forEach(function (m) {
      if (!isM(m) || !m._g) return;
      var g = m._g;
      if (st.schema) {
        g.sch.forEach(function (p) { h += '<path d="' + polyD(p) + '" fill="none" stroke="#111" stroke-width="2.4"/>'; });
        return;
      }
      g.leads.forEach(function (l) {
        var d = polyD(l.pts);
        h += '<path d="' + d + '" fill="none" stroke="' + (l.red ? '#D9463B' : '#2B3036') + '" stroke-width="3.8" stroke-linecap="round" stroke-linejoin="round"/>' +
          '<path d="' + d + '" fill="none" stroke="#fff" stroke-opacity=".28" stroke-width="1.2" stroke-linecap="round" transform="translate(-.5 -.8)"/>' +
          '<circle cx="' + f1(l.pts[0][0]) + '" cy="' + f1(l.pts[0][1]) + '" r="4" fill="' + (l.red ? '#B8352B' : '#1E2227') + '"/>';
      });
    });
    Ll.innerHTML = h;
  }
  function arrowAt(x, y, dx, dy) {
    var px = -dy, py = dx;
    var p = [[x + dx * 7, y + dy * 7], [x - dx * 5 + px * 5.5, y - dy * 5 + py * 5.5], [x - dx * 5 - px * 5.5, y - dy * 5 - py * 5.5]];
    return '<path d="M' + p.map(function (q) { return f1(q[0]) + ' ' + f1(q[1]); }).join('L') + 'Z" fill="#E5372B" stroke="#fff" stroke-width="' + (st.schema ? 0 : 1.4) + '" stroke-linejoin="round"/>';
  }
  function arrowOn(pts, I, prefer) {
    if (!pts || pts.length < 2 || Math.abs(I) < 1e-4) return '';
    var bi = 1, bl = -1;
    for (var i = 1; i < pts.length; i++) { var l = dist(pts[i - 1], pts[i]); if (l > bl) { bl = l; bi = i; } }
    if (bl < 14) return '';
    var a = pts[bi - 1], b = pts[bi], s = I > 0 ? 1 : -1;
    var dx = (b[0] - a[0]) / bl * s, dy = (b[1] - a[1]) / bl * s;
    return arrowAt((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, dx, dy);
  }
  function renderArrows() {
    if (!st.showCur) { La.innerHTML = ''; return; }
    var h = '';
    st.wires.forEach(function (w) { h += arrowOn(w._pts, w.I); });
    st.els.forEach(function (m) {
      if (m.type !== 'ammeter' || !m.attach || !m._g || !m._g.route) return;
      var g = m._g, I = m.I || 0;
      if (st.schema) h += arrowOn(g.route, I);
      else if (Math.abs(I) >= 1e-4) {
        // Flèche au milieu du cordon par lequel le courant arrive
        var q = pAt(g.leads[0].pts, plen(g.leads[0].pts) / 2), s = I > 0 ? 1 : -1;
        h += arrowAt(q.x, q.y, q.dx * s, q.dy * s);
      }
    });
    La.innerHTML = h;
  }

  function qBadge(x, y, id) {
    return '<g class="ui-q" data-act="q" data-id="' + id + '"><circle cx="' + f1(x) + '" cy="' + f1(y) + '" r="' + f1(Math.max(15, 17 / view.s)) + '" fill="#000" fill-opacity="0"/>' +
      '<circle cx="' + f1(x) + '" cy="' + f1(y) + '" r="10.5" fill="#fff" stroke="#7E8996" stroke-width="1.6"/>' +
      '<text x="' + f1(x) + '" y="' + f1(y + 4.6) + '" font-size="13" font-weight="800" text-anchor="middle" fill="#4E5A66">?</text></g>';
  }
  function rotHandle(x, y, id) {
    return '<g class="ui-rot" data-act="rot" data-id="' + id + '"><circle cx="' + f1(x) + '" cy="' + f1(y) + '" r="' + f1(Math.max(14, 17 / view.s)) + '" fill="#000" fill-opacity="0"/>' +
      '<circle cx="' + f1(x) + '" cy="' + f1(y) + '" r="9.5" fill="#fff" stroke="#7E8996" stroke-width="1.5"/>' +
      '<path d="M' + f1(x + 4.6) + ' ' + f1(y - 1.5) + 'A4.8 4.8 0 1 1 ' + f1(x + 1.5) + ' ' + f1(y - 4.6) + '" fill="none" stroke="#4E5A66" stroke-width="1.7" stroke-linecap="round"/>' +
      '<path d="M' + f1(x + .2) + ' ' + f1(y - 7.4) + 'l3.4 2.6-3.6 2.4z" fill="#4E5A66"/></g>';
  }
  function renderUI() {
    var h = '', act = drag && drag.moved ? drag : null;
    dipoles().forEach(function (e) {
      var b = bboxAt(e, e.ang, e.px, e.py), busy = act && act.id === e.id && act.act === 'el';
      h += '<text class="el-name" x="' + f1(b.x0 + 2) + '" y="' + f1(b.y0 - 5) + '">' + e.name + '</text>';
      if (!busy) {
        h += qBadge(b.x1 - 2, b.y0 - 2, e.id);
        h += rotHandle((b.x0 + b.x1) / 2, b.y1 + 15, e.id);
      }
      for (var i = 0; i < 2; i++) {
        var p = term(e, i), hl = drag && drag.act === 'term' && ((drag.cand && drag.cand.el === e.id && drag.cand.i === i) || (drag.from.el === e.id && drag.from.i === i));
        h += '<g class="term" data-act="term" data-id="' + e.id + '" data-i="' + i + '">' +
          '<circle cx="' + f1(p[0]) + '" cy="' + f1(p[1]) + '" r="' + f1(Math.max(13, 17 / view.s)) + '" fill="#000" fill-opacity="0"/>' +
          (st.schema ? '<circle cx="' + f1(p[0]) + '" cy="' + f1(p[1]) + '" r="3.2" fill="#fff" stroke="#111" stroke-width="1.6"/>' : '') +
          (hl ? '<circle cx="' + f1(p[0]) + '" cy="' + f1(p[1]) + '" r="11" fill="#3D8BFF" fill-opacity=".18" stroke="#3D8BFF" stroke-width="2.4"/>' : '') + '</g>';
      }
    });
    st.els.forEach(function (m) {
      if (!isM(m) || (act && act.id === m.id && act.act === 'el')) return;
      var b = boxOf(m);
      h += st.schema ? qBadge(b.x0 - 6, b.y0 - 4, m.id) : qBadge(b.x1 - 1, b.y0 + 1, m.id);
    });
    if (drag && drag.act === 'term' && drag.moved) {
      var p0 = term(get(drag.from.el), drag.from.i);
      h += '<path d="M' + f1(p0[0]) + ' ' + f1(p0[1]) + 'L' + f1(drag.p[0]) + ' ' + f1(drag.p[1]) + '" stroke="#3D8BFF" stroke-width="3" stroke-dasharray="7 6" stroke-linecap="round"/>' +
        '<circle cx="' + f1(drag.p[0]) + '" cy="' + f1(drag.p[1]) + '" r="5" fill="#3D8BFF"/>';
    }
    if (act && act.act === 'el' && act.mcand) {
      var c = act.mcand;
      if (c.w) h += '<path d="' + polyD(c.w._pts) + '" fill="none" stroke="#3D8BFF" stroke-opacity=".45" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>';
      if (c.e) { var bb = bboxAt(c.e, c.e.ang, c.e.px, c.e.py); h += '<rect x="' + f1(bb.x0 - 6) + '" y="' + f1(bb.y0 - 6) + '" width="' + f1(bb.x1 - bb.x0 + 12) + '" height="' + f1(bb.y1 - bb.y0 + 12) + '" rx="14" fill="#3D8BFF" fill-opacity=".08" stroke="#3D8BFF" stroke-width="2" stroke-dasharray="6 5"/>'; }
    }
    if (st.sel) {
      var x = st.sel.x, y = st.sel.y;
      h += '<g data-act="wdel" data-id="' + st.sel.id + '" style="cursor:pointer"><circle cx="' + f1(x) + '" cy="' + f1(y) + '" r="16" fill="#D9463B" stroke="#fff" stroke-width="2.5"/>' +
        '<path d="M' + f1(x - 5) + ' ' + f1(y - 5) + 'l10 10m0 -10l-10 10" stroke="#fff" stroke-width="2.8" stroke-linecap="round"/></g>';
    }
    Lui.innerHTML = h;
  }

  /* ---------- Électrons ---------- */
  function hash(k) { var x = Math.sin(k * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
  function renderElectrons(dt) {
    var halo = Lel.firstChild, core = Lel.lastChild;
    if (!st.showEl || st.schema) { if (core.getAttribute('d')) { core.setAttribute('d', ''); halo.setAttribute('d', ''); } return; }
    var conds = [];
    st.wires.forEach(function (w) { if (w._pts) conds.push({ key: 'w' + w.id, pts: w._pts, I: w.I }); });
    st.els.forEach(function (m) { if (isM(m) && m._g && m._g.cond) conds = conds.concat(m._g.cond); });
    var dc = '', dh = '', SP = 5.2, R = 1.05;
    conds.forEach(function (c) {
      var L = plen(c.pts);
      if (L < 2) return;
      var ph = phases[c.key] || 0, a = Math.abs(c.I);
      // Les électrons vont du - vers le + : à l'inverse du sens conventionnel
      if (a > 1e-6) ph -= (c.I > 0 ? 1 : -1) * 75 * Math.pow(a, .6) * dt;
      ph = ((ph % SP) + SP) % SP; phases[c.key] = ph;
      var n = Math.floor(L / SP);
      for (var k = 0; k < n; k++) {
        var s = k * SP + ph + (hash(k) - .5) * 1.6;
        if (s < 0 || s > L) continue;
        var q = pAt(c.pts, s), j = (hash(k + 99) - .5) * 2.6;
        var x = q.x - q.dy * j, y = q.y + q.dx * j;
        dc += 'M' + f1(x - R) + ' ' + f1(y) + 'a' + R + ' ' + R + ' 0 1 0 ' + 2 * R + ' 0a' + R + ' ' + R + ' 0 1 0 ' + -2 * R + ' 0';
        dh += 'M' + f1(x - 2.2) + ' ' + f1(y) + 'a2.2 2.2 0 1 0 4.4 0a2.2 2.2 0 1 0 -4.4 0';
      }
    });
    core.setAttribute('d', dc); halo.setAttribute('d', dh);
  }

  /* ---------- Effets (éclats, fumée, flammes) ---------- */
  function emit(p) { parts.push(p); }
  function burst(x, y, col) {
    emit({ k: 'flash', x: x, y: y, life: 0, max: .38 });
    for (var i = 0; i < 12; i++) {
      var a = Math.random() * Math.PI * 2, v = 90 + Math.random() * 140;
      emit({ k: 'shard', x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, life: 0, max: .7 + Math.random() * .3, rot: Math.random() * 360, vr: (Math.random() - .5) * 900, col: col, r: .7 + Math.random() * .7 });
    }
  }
  function smoke(x, y, big) {
    emit({ k: 'smoke', x: x + (Math.random() - .5) * 12, y: y, vx: (Math.random() - .5) * 18, vy: -28 - Math.random() * 20, life: 0, max: 1.4 + Math.random() * .8, r: (big ? 12 : 8) + Math.random() * 6 });
  }
  function renderFx(dt) {
    if (!parts.length) { if (Lfx.firstChild) Lfx.innerHTML = ''; return; }
    var h = '';
    parts = parts.filter(function (p) {
      p.life += dt;
      if (p.life >= p.max) return false;
      var t = p.life / p.max;
      if (p.vx != null) { p.x += p.vx * dt; p.y += p.vy * dt; }
      if (p.k === 'flash') h += '<circle cx="' + f1(p.x) + '" cy="' + f1(p.y) + '" r="' + f1(12 + 60 * t) + '" fill="url(#g-flash)" opacity="' + (1 - t).toFixed(2) + '"/>';
      else if (p.k === 'shard') {
        p.vy += 420 * dt; p.rot += p.vr * dt;
        h += '<path d="M-4 -2.5L5 0L-1.5 3.5Z" transform="translate(' + f1(p.x) + ' ' + f1(p.y) + ') rotate(' + Math.round(p.rot) + ') scale(' + p.r.toFixed(2) + ')" fill="' + p.col + '" stroke="#8796A4" stroke-width=".6" opacity="' + (1 - t * t).toFixed(2) + '"/>';
      } else if (p.k === 'smoke') {
        p.vx *= .99;
        h += '<circle cx="' + f1(p.x) + '" cy="' + f1(p.y) + '" r="' + f1(p.r * (.5 + 1.5 * t)) + '" fill="url(#g-smoke)" opacity="' + (.85 * (1 - t)).toFixed(2) + '"/>';
      } else if (p.k === 'flame') {
        var s = p.r * (1 - t * .6);
        h += '<path d="M0 -13C5 -6 6.5 -1 0 4C-6.5 -1 -5 -6 0 -13Z" transform="translate(' + f1(p.x) + ' ' + f1(p.y) + ') scale(' + s.toFixed(2) + ')" fill="url(#g-fire)" opacity="' + (1 - t).toFixed(2) + '"/>';
      }
      return true;
    });
    Lfx.innerHTML = h;
  }

  /* ================= Animation ================= */
  function springs(dt) {
    var moving = false, n = 4, h = dt / n, k = 240, c = 2 * Math.sqrt(k) * .6;
    st.els.forEach(function (e) {
      if (drag && drag.moved && drag.id === e.id && (drag.act === 'el' || drag.act === 'rot')) return;
      if (isM(e) && e.attach) return;
      for (var s = 0; s < n; s++) {
        e.vx += (k * (e.x - e.px) - c * e.vx) * h; e.px += e.vx * h;
        e.vy += (k * (e.y - e.py) - c * e.vy) * h; e.py += e.vy * h;
        e.va += (k * (e.rot - e.ang) - c * e.va) * h; e.ang += e.va * h;
      }
      if (Math.abs(e.x - e.px) < .05 && Math.abs(e.vx) < .05) { e.px = e.x; e.vx = 0; } else moving = true;
      if (Math.abs(e.y - e.py) < .05 && Math.abs(e.vy) < .05) { e.py = e.y; e.vy = 0; } else moving = true;
      if (Math.abs(e.rot - e.ang) < .05 && Math.abs(e.va) < .05) { e.ang = e.rot; e.va = 0; } else moving = true;
    });
    if (moving) geom = true;
  }

  // Échauffement des fils (court-circuit)
  function heatWires(dt) {
    var hot = false, burned = [];
    st.wires.forEach(function (w) {
      var a = Math.abs(w.I || 0), target = a < 1.5 ? 0 : Math.min(1.3, a / 10), prev = w.temp;
      w.temp += (target - w.temp) * Math.min(1, dt / (target > w.temp ? 1.4 : .8));
      if (w.temp < .005) w.temp = 0;
      if (w.temp !== prev) hot = true;
      if (w.temp > .3 && prev <= .3) toast('Court-circuit ! Le fil chauffe…', true);
      if (w.temp >= .97 && target >= 1) {
        if (!w.burn) toast('Le fil prend feu !', true);
        w.burn += dt;
        var L = plen(w._pts || []), nf = L * dt * .3, cnt = Math.floor(nf) + (Math.random() < nf % 1 ? 1 : 0);
        for (var i = 0; i < cnt; i++) {
          var q = pAt(w._pts, Math.random() * L);
          emit({ k: 'flame', x: q.x + (Math.random() - .5) * 4, y: q.y + 2, vx: (Math.random() - .5) * 10, vy: -40 - Math.random() * 30, life: 0, max: .45 + Math.random() * .35, r: 1 + Math.random() * .9 });
        }
        if (Math.random() < dt * 4) { var q2 = pAt(w._pts, Math.random() * L); smoke(q2.x, q2.y - 8); }
        if (w.burn > 3.2) burned.push(w);
      } else w.burn = 0;
    });
    burned.forEach(function (w) {
      var L = plen(w._pts);
      for (var i = 0; i < 6; i++) { var q = pAt(w._pts, Math.random() * L); smoke(q.x, q.y, true); }
      removeWire(w);
      toast('Le fil a brûlé : le circuit est coupé.', true);
    });
    return hot;
  }

  function breakEl(e, manual) {
    e.broken = true; e.dirty = true; e.over = 0; e._on = null;
    needSolve = true;
    var c = [e.px, e.py];
    if (e.type === 'lamp') burst(c[0], c[1], '#E6EEF4');
    else if (e.type === 'led') burst(c[0], c[1], C.opt(e).c);
    else { e.smoke = 3.2; for (var i = 0; i < 5; i++) smoke(c[0], c[1], true); }
    var msg = { lamp: 'La lampe ' + e.name + (manual ? ' est hors service.' : ' a grillé !'), led: 'La DEL ' + e.name + ' a grillé !', motor: 'Le moteur ' + e.name + ' a brûlé !', res: 'La résistance ' + e.name + ' a brûlé !' }[e.type];
    toast(msg, !manual);
    if (popEl === e) renderPop();
  }

  function rnd(a) { return ((Math.random() - .5) * 2 * a).toFixed(2); }
  function tickEls(dt, time) {
    st.els.forEach(function (e) {
      if (e.dirty) buildEl(e);
      var r = e.refs;
      if (!r) return;
      if (isM(e)) { updateLcd(e); return; }
      var ratio = e.ratio || 0;
      if (C.canBreak(e.type) && !e.broken) {
        if (ratio > 1.5) { e.over = (e.over || 0) + dt; if (e.over > .35) { breakEl(e); return; } }
        else e.over = 0;
      }
      var sh = !e.broken && C.canBreak(e.type) && ratio > 1.15 ? Math.min(3.4, .7 + (ratio - 1.15) * 7) : 0;
      if (sh) { r.in.setAttribute('transform', 'translate(' + rnd(sh) + ' ' + rnd(sh) + ') rotate(' + rnd(sh * .9) + ')'); e._sh = true; }
      else if (e._sh) { r.in.removeAttribute('transform'); e._sh = false; }
      if (e.smoke > 0) { e.smoke -= dt; if (Math.random() < dt * 9) smoke(e.px, e.py - 6); }
      var on = !e.broken;
      switch (e.type) {
        case 'lamp': {
          if (!r.glass) break;
          var b = on ? Math.min(2.5, ratio * ratio) : 0;
          if (e._b != null && Math.abs(b - e._b) < .002) break;
          e._b = b;
          r.halo.setAttribute('opacity', Math.min(1, b * 1.6).toFixed(3));
          r.halo.setAttribute('r', f1(26 + 28 * Math.min(1.6, b)));
          r.glass.setAttribute('fill', b < .01 ? '#F4F8FB' : C.ramp([[.01, '#F8E8DA'], [.15, '#FFCB8C'], [.6, '#FFE9A0'], [1, '#FFF6CF'], [1.6, '#FFFFFF']], b));
          r.fil.setAttribute('stroke', b < .004 ? '#7A6656' : C.ramp([[.004, '#9A3A20'], [.08, '#E5481E'], [.35, '#FF9A1F'], [1, '#FFF2B0'], [1.6, '#FFFFFF']], b));
          break;
        }
        case 'led': {
          if (!r.dome) break;
          var lb = on && e.I > 0 ? e.I / C.LED_I : 0;
          if (e._b != null && Math.abs(lb - e._b) < .002) break;
          e._b = lb;
          var col = C.opt(e).c, off = C.mix(col, '#8A8590', .55);
          r.dome.setAttribute('fill', lb <= 0 ? off : C.mix(off, col, Math.min(1, .35 + lb * .65)));
          r.core.setAttribute('opacity', Math.min(.85, lb * .7).toFixed(3));
          r.halo.setAttribute('opacity', Math.min(1, lb * .95).toFixed(3));
          r.halo.setAttribute('r', f1(22 + 16 * Math.min(1.5, lb)));
          break;
        }
        case 'motor': {
          var target = on && ratio >= .2 ? (e.I >= 0 ? 1 : -1) * 1080 * ratio : 0;
          e.spd += (target - e.spd) * Math.min(1, dt * 2.5);
          if (Math.abs(e.spd) < .5 && !target) e.spd = 0;
          e.pa = (e.pa + e.spd * dt) % 360;
          if (r.prop) r.prop.setAttribute('transform', 'rotate(' + f1(e.pa) + ')');
          if (r.blur) r.blur.setAttribute('opacity', Math.min(.4, Math.abs(e.spd) / 2700).toFixed(3));
          break;
        }
        case 'res': {
          if (!r.heat) break;
          var hh = on ? Math.min(.6, ratio * ratio * .35) : 0;
          if (e._h == null || Math.abs(hh - e._h) > .003) { e._h = hh; r.heat.setAttribute('opacity', hh.toFixed(3)); }
          break;
        }
        case 'buzzer': {
          if (!r.waves) break;
          var vol = Math.min(1, Math.abs(e.U || 0) / 12);
          r.waves.setAttribute('opacity', vol > .004 ? (.25 + .75 * vol * (.55 + .45 * Math.sin(time * 22))).toFixed(3) : '0');
          break;
        }
        case 'sw': {
          if (!r.lever) break;
          var tg = e.closed ? 0 : -34;
          if (e.la !== tg) {
            e.la += (tg - e.la) * Math.min(1, dt * 18);
            if (Math.abs(tg - e.la) < .2) e.la = tg;
            r.lever.setAttribute('transform', 'rotate(' + f1(e.la) + ' -23 0)');
          }
          break;
        }
      }
    });
  }

  /* ---------- Affichage des appareils de mesure ---------- */
  function fmt(v, d) { return v.toFixed(d).replace('.', ','); }
  function sig(v) { return v >= 99.95 ? fmt(v, 0) : v >= 9.995 ? fmt(v, 1) : fmt(v, 2); }
  function fmtU(v) { v = Math.abs(v); if (v < .0005) return '0,00 V'; if (v < .9995) return fmt(v * 1000, 0) + ' mV'; return sig(v) + ' V'; }
  function fmtI(v) { v = Math.abs(v); if (v < .00005) return '0,0 mA'; if (v < .9995) return sig(v * 1000) + ' mA'; return sig(v) + ' A'; }
  function fmtR(v) { if (v < 1) return fmt(v, 1) + ' Ω'; if (v < 999.5) return (v >= 100 ? fmt(v, 0) : fmt(v, 1)) + ' Ω'; return sig(v / 1000) + ' kΩ'; }
  function meterText(m) {
    if (!m.attach) return '---';
    if (m.type === 'ammeter') return fmtI(m.I || 0);
    var t = get(m.attach.el);
    if (!t) return '---';
    if (m.type === 'voltmeter') return fmtU(pot(t, 0) - pot(t, 1));
    // L'ohmmètre ne supporte pas un dipôle alimenté (tension à ses bornes ou courant qui le traverse)
    if (t.type === 'gen' || Math.abs(t.U || 0) > 1e-3 || Math.abs(t.I || 0) > 1e-5) return 'Err';
    var R = Solver.resistance(dipoles(), links(), t);
    return R > 1e6 ? 'OL' : fmtR(R);
  }
  function updateLcd(m) {
    var s = meterText(m);
    if (s === m._lcd || !m.refs.lcd) return;
    m._lcd = s;
    m.refs.lcd.textContent = s;
    if (!st.schema) m.refs.lcd.setAttribute('font-size', s.length > 6 ? '9.6' : '11');
  }

  /* ---------- Son des buzzers ---------- */
  function ensureAudio() {
    if (actx) { if (actx.state === 'suspended' && running) actx.resume(); return; }
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try { actx = new AC(); master = actx.createGain(); master.gain.value = 1; master.connect(actx.destination); } catch (err) { actx = null; }
  }
  function stopBuzz(e) {
    if (!e.osc) return;
    try { e.osc.stop(); e.osc.disconnect(); e.gn.disconnect(); } catch (err) { }
    e.osc = null; e.gn = null;
  }
  function audioTick() {
    if (!actx) return;
    st.els.forEach(function (e) {
      if (e.type !== 'buzzer') return;
      var U = Math.abs(e.U || 0), on = running && U > .02, vol = Math.min(1, U / 12);
      if (on && !e.osc) {
        e.osc = actx.createOscillator(); e.osc.type = 'square';
        var lp = actx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2600;
        e.gn = actx.createGain(); e.gn.gain.value = 0;
        e.osc.connect(lp); lp.connect(e.gn); e.gn.connect(master); e.osc.start();
      }
      if (e.osc) {
        e.osc.frequency.setTargetAtTime(C.opt(e).f, actx.currentTime, .02);
        e.gn.gain.setTargetAtTime(on ? .012 + .07 * vol : 0, actx.currentTime, .04);
      }
    });
  }

  function frame(ts) {
    raf = requestAnimationFrame(frame);
    var dt = lastT ? Math.min(.05, (ts - lastT) / 1000) : .016;
    lastT = ts;
    if (needSolve) { needSolve = false; doSolve(); }
    springs(dt);
    var hot = heatWires(dt);
    st.els.forEach(function (e) { if (e.dirty) buildEl(e); });
    if (geom) { computeGeom(); st.els.forEach(placeEl); }
    if (geom || hot) renderWires();
    if (geom) { renderLeads(); renderUI(); renderArrows(); }
    geom = false;
    tickEls(dt, ts / 1000);
    audioTick();
    renderElectrons(dt);
    renderFx(dt);
  }

  /* ================= Interactions ================= */
  function toWorld(cx, cy) {
    var pt = svg.createSVGPoint(); pt.x = cx; pt.y = cy;
    var r = pt.matrixTransform(svg.getScreenCTM().inverse());
    return [r.x, r.y];
  }
  function overBar(cx, cy) { var r = bar.getBoundingClientRect(); return cx >= r.left && cx <= r.right && cy >= r.top && cy <= r.bottom; }
  function snapG(v) { return Math.round(v / GRID) * GRID; }
  function clampPos(e) { e.x = clamp(e.x, 50, view.w - 50); e.y = clamp(e.y, 46, view.h - 46); }

  function onDown(ev) {
    ensureAudio();
    var t = ev.target.closest ? ev.target.closest('[data-act]') : null;
    var p = toWorld(ev.clientX, ev.clientY);
    if (!t) { if (st.sel) { st.sel = null; geom = true; } return; }
    ev.preventDefault();
    var act = t.getAttribute('data-act'), id = +t.getAttribute('data-id'), e = get(id);
    if (act === 'wdel') { var w = st.wires.filter(function (x) { return x.id === id; })[0]; if (w) removeWire(w); st.sel = null; return; }
    try { svg.setPointerCapture(ev.pointerId); } catch (err) { }
    drag = { act: act, id: id, p: p, c0: [ev.clientX, ev.clientY], moved: false, type: ev.pointerType };
    if (act === 'el' && e) {
      var M = isM(e) ? mpos(e) : [e.px, e.py];
      drag.off = [p[0] - M[0], p[1] - M[1]];
    } else if (act === 'term') {
      drag.from = { el: id, i: +t.getAttribute('data-i') };
    } else if (act === 'rot' && e) {
      drag.a0 = Math.atan2(p[1] - e.py, p[0] - e.px) / D2R - e.ang;
    }
    if (st.sel && act !== 'wire') { st.sel = null; geom = true; }
  }
  function onMove(ev) {
    if (!drag) return;
    var p = toWorld(ev.clientX, ev.clientY);
    drag.p = p;
    if (!drag.moved && Math.hypot(ev.clientX - drag.c0[0], ev.clientY - drag.c0[1]) > 6) {
      drag.moved = true;
      var e0 = get(drag.id);
      if (drag.act === 'el' && e0) {
        if (isM(e0)) detachMeter(e0);
        e0.dom && e0.dom.classList.add('dragging');
      }
    }
    if (!drag.moved) return;
    var e = get(drag.id);
    if (drag.act === 'el' && e) {
      e.x = e.px = p[0] - drag.off[0]; e.y = e.py = p[1] - drag.off[1]; e.vx = e.vy = 0;
      bar.classList.toggle('trash', overBar(ev.clientX, ev.clientY));
      if (isM(e)) drag.mcand = meterCandidate(e, [e.px, e.py]);
      geom = true;
    } else if (drag.act === 'term') {
      var best = null;
      dipoles().forEach(function (d) {
        for (var i = 0; i < 2; i++) {
          if (d.id === drag.from.el && i === drag.from.i) continue;
          var q = term(d, i), dd = dist(q, p);
          if (dd < 24 && (!best || dd < best.d)) best = { el: d.id, i: i, d: dd };
        }
      });
      drag.cand = best;
      geom = true;
    } else if (drag.act === 'rot' && e) {
      e.ang = e.rot = Math.atan2(p[1] - e.py, p[0] - e.px) / D2R - drag.a0; e.va = 0;
      geom = true;
    }
  }
  function onUp(ev) {
    if (!drag) return;
    var d = drag, e = get(d.id);
    drag = null;
    bar.classList.remove('trash');
    if (e && e.dom) e.dom.classList.remove('dragging');
    geom = true;
    if (d.act === 'el' && e) {
      if (!d.moved) { if (e.type === 'sw') { e.closed = !e.closed; e.dirty = true; needSolve = true; } return; }
      if (ev && ev.type !== 'pointercancel' && overBar(ev.clientX, ev.clientY)) { removeEl(e); return; }
      if (isM(e)) { clampPos(e); e.px = e.x; e.py = e.y; snapMeter(e); }
      else { e.x = snapG(e.x); e.y = snapG(e.y); clampPos(e); }
    } else if (d.act === 'term') {
      if (d.cand) addWire(d.from, { el: d.cand.el, i: d.cand.i });
    } else if (d.act === 'q') {
      if (!d.moved && e) openPop(e);
    } else if (d.act === 'rot' && e) {
      if (!d.moved) e.rot = Math.round(e.rot / 90) * 90 + 90;
      else e.rot = Math.round(e.ang / 90) * 90;
    } else if (d.act === 'wire' && !d.moved) {
      var w = st.wires.filter(function (x) { return x.id === d.id; })[0];
      if (!w) return;
      if (d.type === 'mouse') removeWire(w);
      else { var c = closest(w._pts, d.p), q = pAt(w._pts, c.s); st.sel = { id: w.id, x: q.x, y: q.y - 22 }; }
    }
  }

  /* ---------- Barre latérale ---------- */
  function previewSVG(type, schemaMode) {
    var fake = { type: type, opt: C.TYPES[type].opts ? (st.mem[type] != null ? st.mem[type] : C.TYPES[type].def) : 0, closed: false };
    var vb = C.isMeter(type) ? (schemaMode ? '-24 -24 48 48' : '-38 -44 76 88') : type === 'gen' ? (schemaMode ? '-50 -28 100 56' : '-64 -50 128 80') : (schemaMode ? '-50 -26 100 52' : '-56 -36 112 66');
    return '<svg viewBox="' + vb + '" aria-hidden="true">' + C.draw(fake, schemaMode) + '</svg>';
  }
  function buildBar() {
    var list = tab === 'dipoles' ? C.DIPOLES : C.METERS;
    barList.innerHTML = list.map(function (t) {
      return '<button type="button" class="bar__item" data-type="' + t + '">' + previewSVG(t, st.schema) + '<span>' + C.TYPES[t].name + '</span></button>';
    }).join('');
    document.querySelectorAll('.bar__tab').forEach(function (b) { b.setAttribute('aria-selected', b.getAttribute('data-tab') === tab ? 'true' : 'false'); });
  }
  function freeSpot(type) {
    var cx = view.w / 2, cy = view.h / 2, b0 = C.bbox(type, st.schema);
    for (var ring = 0; ring < 9; ring++) {
      var steps = ring ? ring * 6 : 1;
      for (var k = 0; k < steps; k++) {
        var a = k / steps * Math.PI * 2, x = snapG(cx + Math.cos(a) * ring * 130), y = snapG(cy + Math.sin(a) * ring * 95);
        if (x < 60 || x > view.w - 60 || y < 50 || y > view.h - 50) continue;
        var ok = st.els.every(function (e) {
          var b = boxOf(e);
          return x + b0.x1 + 30 < b.x0 || x + b0.x0 - 30 > b.x1 || y + b0.y1 + 44 < b.y0 || y + b0.y0 - 44 > b.y1;
        });
        if (ok) return [x, y];
      }
    }
    return [snapG(cx), snapG(cy)];
  }
  function onBarDown(ev) {
    var item = ev.target.closest('.bar__item');
    if (!item) return;
    ensureAudio();
    pdrag = { type: item.getAttribute('data-type'), c0: [ev.clientX, ev.clientY], moved: false, id: ev.pointerId };
  }
  function onBarMove(ev) {
    if (!pdrag || ev.pointerId !== pdrag.id) return;
    var dx = ev.clientX - pdrag.c0[0], dy = ev.clientY - pdrag.c0[1];
    if (!pdrag.moved) {
      if (Math.hypot(dx, dy) < 8) return;
      // Au doigt, un geste vertical sert à faire défiler la liste
      if (ev.pointerType !== 'mouse' && Math.abs(dy) > Math.abs(dx)) { pdrag = null; return; }
      pdrag.moved = true;
      pdrag.ghost = document.createElement('div');
      pdrag.ghost.className = 'ghost';
      pdrag.ghost.innerHTML = previewSVG(pdrag.type, st.schema);
      document.body.appendChild(pdrag.ghost);
    }
    ev.preventDefault();
    pdrag.ghost.style.transform = 'translate(' + (ev.clientX - 55) + 'px,' + (ev.clientY - 40) + 'px)';
  }
  function onBarUp(ev) {
    if (!pdrag || ev.pointerId !== pdrag.id) return;
    var d = pdrag; pdrag = null;
    if (d.ghost) d.ghost.remove();
    if (ev.type === 'pointercancel') return;
    if (!d.moved) {
      if (!ev.target.closest || !ev.target.closest('.bar__item')) return;
      var s = freeSpot(d.type), e = addEl(d.type, s[0], s[1]);
      if (e.type === 'sw') e.la = -34;
      return;
    }
    var r = ws.getBoundingClientRect();
    if (ev.clientX < r.left || ev.clientX > r.right || ev.clientY < r.top || ev.clientY > r.bottom) return;
    var p = toWorld(ev.clientX, ev.clientY), e2 = addEl(d.type, p[0], p[1]);
    if (isM(e2)) { clampPos(e2); e2.px = e2.x; e2.py = e2.y; computeGeom(); snapMeter(e2); }
    else { e2.x = snapG(p[0]); e2.y = snapG(p[1]); clampPos(e2); }
  }

  /* ---------- Fenêtre « ? » ---------- */
  function openPop(e) { popEl = e; renderPop(); pop.hidden = false; }
  function closePop() { pop.hidden = true; popEl = null; }
  function renderPop() {
    var e = popEl;
    if (!e) return;
    var t = C.TYPES[e.type];
    popTitle.textContent = t.name + (e.name ? ' ' + e.name : '');
    var vb = isM(e) ? '-40 -44 80 88' : e.type === 'gen' ? '-64 -50 128 80' : '-58 -40 116 72';
    popIco.setAttribute('viewBox', vb);
    popIco.innerHTML = C.draw({ type: e.type, opt: e.opt, closed: e.closed, broken: e.broken }, false);
    var h = '';
    if (isM(e)) {
      var f = C.FICHE[e.type];
      h += '<p>' + f.intro + '</p><dl class="fiche">' + f.rows.map(function (r) { return '<dt>' + r[0] + '</dt><dd>' + r[1] + '</dd>'; }).join('') + '</dl>' +
        '<div class="fiche-sym"><svg viewBox="-60 -20 120 40" aria-label="Symbole normalisé">' + '<path d="M-56 0H-15M15 0H56" stroke="#111" stroke-width="2.4"/>' + C.draw({ type: e.type }, true) + '</svg></div>' +
        '<p class="muted">' + f.tip + '</p>';
    } else {
      h += '<p>' + C.INFO[e.type] + '</p>';
      if (t.opts) {
        h += '<p class="pop-label">' + t.optLabel + '</p><div class="seg">' + t.opts.map(function (o, k) {
          var tx = C.optText(e.type, o), sw = e.type === 'led' ? '<span class="sw" style="background:' + o.c + '"></span>' : e.type === 'buzzer' ? '<span class="sw" style="background:' + o.edge + '"></span>' : '';
          return '<button type="button" data-opt="' + k + '" aria-pressed="' + (k === e.opt) + '">' + sw + tx[0] + (tx[1] ? '<small>' + tx[1] + '</small>' : '') + '</button>';
        }).join('') + '</div>';
      }
      if (e.type === 'sw') h += '<button type="button" class="pop-btn pop-btn--ok" data-do="toggle">' + (e.closed ? 'Ouvrir l\'interrupteur' : 'Fermer l\'interrupteur') + '</button>';
      if (e.type === 'lamp' && !e.broken) h += '<button type="button" class="pop-btn" data-do="break">Casser la lampe</button>';
      if (e.broken) h += '<button type="button" class="pop-btn pop-btn--ok" data-do="fix">Remplacer ' + ({ lamp: 'la lampe', led: 'la DEL', motor: 'le moteur', res: 'la résistance' }[e.type]) + '</button>';
    }
    popBody.innerHTML = h;
  }
  function onPopClick(ev) {
    var e = popEl;
    if (!e) return;
    var b = ev.target.closest('[data-opt],[data-do]');
    if (!b) return;
    if (b.hasAttribute('data-opt')) {
      e.opt = +b.getAttribute('data-opt'); st.mem[e.type] = e.opt; e._on = null;
      e.dirty = true; needSolve = true;
      if (tab === 'dipoles') buildBar();
    } else {
      var a = b.getAttribute('data-do');
      if (a === 'toggle') { e.closed = !e.closed; e.dirty = true; needSolve = true; }
      if (a === 'break') { breakEl(e, true); }
      if (a === 'fix') { e.broken = false; e.over = 0; e.smoke = 0; e.dirty = true; needSolve = true; }
    }
    renderPop();
  }

  /* ---------- Divers ---------- */
  function toast(msg, warn) {
    if (msg === lastToast && toastEl.classList.contains('on')) return;
    lastToast = msg;
    toastEl.textContent = msg;
    toastEl.classList.toggle('warn', !!warn);
    toastEl.classList.add('on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('on'); }, 2600);
  }
  function clearAll() {
    if (!btnClear.classList.contains('confirm')) {
      if (!st.els.length) return;
      btnClear.classList.add('confirm'); clearLbl.textContent = 'Confirmer ?';
      clearTimeout(clearTimer);
      clearTimer = setTimeout(function () { btnClear.classList.remove('confirm'); clearLbl.textContent = 'Tout effacer'; }, 2500);
      return;
    }
    clearTimeout(clearTimer);
    btnClear.classList.remove('confirm'); clearLbl.textContent = 'Tout effacer';
    st.els.forEach(function (e) { stopBuzz(e); if (e.dom) e.dom.remove(); });
    st.els = []; st.wires = []; st.sel = null; parts = []; phases = {};
    closePop();
    hint.classList.remove('off');
    needSolve = true; geom = true;
  }
  function setSchema(on) {
    st.schema = on;
    ws.classList.toggle('ws--schema', on);
    gridRect.style.display = on ? 'none' : '';
    st.els.forEach(function (e) { e.dirty = true; });
    buildBar();
    geom = true;
  }
  function resize() {
    var r = ws.getBoundingClientRect();
    if (!r.width || !r.height) return;
    var s = clamp(r.width / 720, .62, 1);
    view = { w: r.width / s, h: r.height / s, s: s };
    svg.setAttribute('viewBox', '0 0 ' + f1(view.w) + ' ' + f1(view.h));
    gridRect.setAttribute('width', view.w); gridRect.setAttribute('height', view.h);
    st.els.forEach(function (e) { if (!(isM(e) && e.attach)) { clampPos(e); } });
    geom = true;
  }

  function init() {
    svg = $('ws-svg'); ws = $('ws'); bar = $('bar'); barList = $('bar-list'); hint = $('ws-hint'); toastEl = $('toast');
    pop = $('pop'); popBody = $('pop-body'); popTitle = $('pop-title'); popIco = $('pop-ico'); btnClear = $('btn-clear'); clearLbl = btnClear.querySelector('span');
    svg.innerHTML = '<defs>' + C.defs() + '</defs><rect id="ws-grid" x="0" y="0" width="100%" height="100%" fill="url(#g-grid)"/>' +
      '<g id="L-e"></g><g id="L-w"></g><g id="L-wh"></g><g id="L-l"></g><g id="L-el" pointer-events="none"><path fill="#FFF3B0" fill-opacity=".28"/><path fill="#FFFBE8"/></g><g id="L-a" pointer-events="none"></g><g id="L-m"></g><g id="L-fx" pointer-events="none"></g><g id="L-ui"></g>';
    gridRect = $('ws-grid'); Lw = $('L-w'); Lwh = $('L-wh'); Le = $('L-e'); Ll = $('L-l'); Lel = $('L-el'); La = $('L-a'); Lm = $('L-m'); Lfx = $('L-fx'); Lui = $('L-ui');
    Ll.setAttribute('pointer-events', 'none'); Lw.setAttribute('pointer-events', 'none');

    svg.addEventListener('pointerdown', onDown);
    svg.addEventListener('pointermove', onMove);
    svg.addEventListener('pointerup', onUp);
    svg.addEventListener('pointercancel', onUp);

    barList.addEventListener('pointerdown', onBarDown);
    window.addEventListener('pointermove', onBarMove, { passive: false });
    window.addEventListener('pointerup', onBarUp);
    window.addEventListener('pointercancel', onBarUp);
    document.querySelectorAll('.bar__tab').forEach(function (b) {
      b.addEventListener('click', function () { tab = b.getAttribute('data-tab'); buildBar(); });
    });

    $('opt-schema').addEventListener('change', function () { setSchema(this.checked); });
    $('opt-current').addEventListener('change', function () { st.showCur = this.checked; geom = true; });
    $('opt-electrons').addEventListener('change', function () { st.showEl = this.checked; });
    btnClear.addEventListener('click', clearAll);

    popBody.addEventListener('click', onPopClick);
    $('pop-close').addEventListener('click', closePop);
    pop.addEventListener('click', function (ev) { if (ev.target === pop) closePop(); });
    document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape' && !pop.hidden) closePop(); });

    if (window.ResizeObserver) new ResizeObserver(resize).observe(ws);
    else window.addEventListener('resize', resize);
    buildBar();
  }
  function enter() {
    running = true; lastT = 0;
    resize();
    if (actx && actx.state === 'suspended') actx.resume();
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(frame);
  }
  function leave() {
    running = false;
    cancelAnimationFrame(raf);
    closePop();
    st.els.forEach(stopBuzz);
    if (actx && actx.state === 'running') actx.suspend();
  }

  return { init: init, enter: enter, leave: leave };
})();
