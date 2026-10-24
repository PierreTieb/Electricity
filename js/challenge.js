// Mode Challenge : choix de 3 missions parmi 27, réalisation dans le labo, vérification avec malus, médaille et meilleur score
window.Challenge = (function () {
  var D = ChallengeData, KEY = 'elec-challenge-best';
  var missions = [], picked = [], game = null, lab = null, phase = 'idle';
  var $ = function (id) { return document.getElementById(id); };

  /* ---------- Meilleur score mémorisé dans le navigateur ---------- */
  function readBest() { try { return JSON.parse(localStorage.getItem(KEY)); } catch (e) { return null; } }
  function writeBest(v) { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) { } }
  function pts(n) { return n + ' point' + (Math.abs(n) > 1 ? 's' : ''); }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }

  /* ---------- Dorure des 27 cartes : laiton → or → presque platine, case par case ---------- */
  var GILD = [
    { l: [240, 228, 178], m: [196, 166, 84], d: [140, 112, 44], t: [62, 48, 6] },
    { l: [255, 243, 196], m: [242, 197, 61], d: [185, 140, 23], t: [74, 51, 0] },
    { l: [255, 255, 255], m: [220, 227, 234], d: [154, 166, 180], t: [39, 49, 60] }
  ];
  function lerp(a, b, t) { return a.map(function (x, i) { return Math.round(x + (b[i] - x) * t); }); }
  function rgb(c) { return 'rgb(' + c.join(',') + ')'; }
  function gild(i) {
    var t = i / 26, a = t < .5 ? GILD[0] : GILD[1], b = t < .5 ? GILD[1] : GILD[2], u = t < .5 ? t * 2 : t * 2 - 1;
    return '--c-light:' + rgb(lerp(a.l, b.l, u)) + ';--c-mid:' + rgb(lerp(a.m, b.m, u)) + ';--c-dark:' + rgb(lerp(a.d, b.d, u)) + ';--c-text:' + rgb(lerp(a.t, b.t, u));
  }
  function card(i, extra) {
    var m = missions[i], n = picked.indexOf(i);
    return '<button type="button" class="ch-card' + (n >= 0 ? ' on' : '') + (extra || '') + '" data-i="' + i + '" style="' + gild(i) + '" aria-pressed="' + (n >= 0) + '"' +
      ' aria-label="' + esc(m.group + ', ' + m.tag + ', ' + m.title + ', ' + m.points + ' points') + '">' +
      '<span class="ch-card__pts">' + m.points + '<small>pts</small></span>' +
      '<span class="ch-card__tag">' + m.tag + '</span><span class="ch-card__title">' + (m.title.indexOf(m.tag) === 0 ? m.title.slice(m.tag.length) : m.title) + '</span>' +
      (n >= 0 ? '<span class="ch-card__n">' + (n + 1) + '</span>' : '') + '</button>';
  }

  /* ---------- Page de choix des missions ---------- */
  function openPage() {
    missions = D.generate();
    picked = [];
    renderGrid();
    renderBest();
    App.show('screen-challenge', 'challenge');
  }
  function renderGrid() {
    $('ch-groups').innerHTML = D.GROUPS.map(function (g, gi) {
      var cards = '';
      for (var k = 0; k < 9; k++) cards += card(gi * 9 + k);
      return '<section class="ch-group"><div class="ch-group__head"><h2><span>Groupe ' + (gi + 1) + '</span>' + g.name + '</h2>' +
        '<span class="ch-malus">Échec : −' + pts(g.malus) + '</span></div><p class="ch-group__info">' + g.info + '</p>' +
        '<div class="ch-grid">' + cards + '</div></section>';
    }).join('');
  }
  function renderBest() {
    var b = readBest(), md = b && D.medal(b.score);
    $('ch-best').innerHTML = b ? 'Meilleur score : <b>' + pts(b.score) + '</b>' + (md ? ' · médaille ' + md.name : '') +
      ' <button type="button" class="ch-best__see" data-do="best">Voir le récap</button>' : '';
    $('ch-best').hidden = !b;
    var sub = $('btn-challenge').querySelector('.mode-btn__best');
    sub.textContent = b ? 'Meilleur score : ' + pts(b.score) : '';
    sub.hidden = !b;
  }
  function toggle(i) {
    var n = picked.indexOf(i);
    if (n >= 0) picked.splice(n, 1);
    else if (picked.length < 3) picked.push(i);
    else return;
    renderGrid();
    if (picked.length === 3) setTimeout(confirmPick, 250);
  }
  function confirmPick() {
    if (picked.length !== 3) return;
    var total = 0;
    modal('<p class="lesson-modal__kicker">Tes 3 missions</p><h2 class="pop-title">Prêt à relever le défi ?</h2>' +
      '<ol class="ch-list">' + picked.map(function (i) {
        var m = missions[i]; total += m.points;
        return '<li><span class="ch-list__n">' + (picked.indexOf(i) + 1) + '</span><span><b>' + m.title + '</b><small>' + m.group + ' · ' + m.tag + ' · échec −' + pts(m.malus) + '</small></span><em>' + m.points + ' pts</em></li>';
      }).join('') + '</ol><p class="ch-total">Jusqu\'à <b>' + total + ' points</b> à gagner</p>' +
      '<div class="ex-actions"><button type="button" class="btn-clear" data-do="unpick">Modifier</button><button type="button" class="btn-primary ch-go" data-do="start">C\'est parti</button></div>', 'page');
  }

  /* ---------- Partie : 3 missions, avec possibilité de changer ---------- */
  function startGame() {
    closeModal();
    game = { slots: picked.map(function (i) { return { m: i, fails: 0, status: 'todo', got: 0 }; }), cur: 0, dropped: [] };
    playSlot(0);
  }
  function slot() { return game.slots[game.cur]; }
  function mission() { return missions[slot().m]; }
  function stake(s) { var m = missions[s.m]; return Math.max(0, m.points - m.malus * s.fails); }
  function score() {
    var t = 0;
    game.slots.forEach(function (s) { if (s.status === 'done') t += s.got; });
    game.dropped.forEach(function (d) { t -= d.lost; });
    return Math.max(0, t);
  }
  function playSlot(k) {
    game.cur = k;
    var m = mission();
    // Missions « schéma » : les critères se calculent sur le schéma tiré pour cette partie
    if (m.schema && !m.criteria) { m.spec = D.schemaSpec(m.schema); m.criteria = D.schemaCriteria(m.spec); }
    if (lab) { lab.destroy(); lab = null; }
    App.show('screen-mission', 'challenge');
    var o = { schemaGlow: true, hint: 'Lis la mission affichée au-dessus.', clearLabel: 'Recommencer', onClear: restart }, key;
    for (key in m.lab) o[key] = m.lab[key];
    if (m.circuit) o.circuit = m.circuit;
    lab = Lab.create($('ch-host'), o);
    lab.start();
    $('ch-kicker').textContent = 'Mission ' + (k + 1) + '/3 · ' + m.group;
    $('ch-title').textContent = m.title;
    $('ch-n').textContent = (k + 1) + '/3';
    $('ch-task').textContent = m.task;
    $('ch-bar').classList.remove('done');
    $('ch-verify').hidden = false;
    $('ch-next').hidden = true;
    updateScore();
    showPanel(m);
    phase = 'intro';
    openIntro();
  }
  function updateScore() {
    $('ch-score').innerHTML = '<small>Score</small><b>' + score() + '</b>';
    $('ch-stake').textContent = stake(slot()) + ' pts';
  }
  function openIntro() {
    var m = mission(), s = slot();
    modal('<p class="lesson-modal__kicker">Mission ' + (game.cur + 1) + ' / 3 · ' + m.group + ' · ' + m.tag + '</p>' +
      '<h2 class="pop-title">' + m.title + '</h2>' +
      '<div class="ch-chips"><span class="ch-chip ch-chip--gold">' + pts(stake(s)) + ' à gagner</span><span class="ch-chip">Échec : −' + pts(m.malus) + '</span></div>' +
      '<p class="lesson-modal__text">' + m.intro + '</p>' +
      '<div class="lesson-task"><span class="lesson-task__ico" aria-hidden="true">➜</span><span>' + m.task + '</span></div>' +
      '<p class="muted">Quand tu penses avoir réussi, appuie sur « Vérifier la réponse ».</p>' +
      '<div class="ex-actions"><button type="button" class="btn-primary ch-go" data-do="go">C\'est parti</button></div>');
  }
  function restart() {
    lab.load(mission().circuit || { els: [], wires: [] });
    lab.toast('Mission recommencée');
  }

  /* ---------- Fenêtre de travail : schéma, cahier des charges ou tableau ---------- */
  function showPanel(m) {
    var p = $('ch-panel'), pn = m.panel;
    p.classList.remove('folded');
    if (pn.kind === 'schema') {
      p.innerHTML = head('Schéma à réaliser') + '<div class="lp-body"><div class="lp-img"></div><p class="lp-legend">' + pn.legend + '</p></div>';
      var img = p.querySelector('.lp-img');
      if (m._svg) img.innerHTML = m._svg;
      else Lab.snap(pn.circuit, { schema: true }).then(function (svg) { m._svg = svg; if (img.isConnected) img.innerHTML = svg; });
    } else if (pn.kind === 'spec') {
      p.innerHTML = head(pn.title) + '<div class="lp-body"><ul class="ch-spec">' + pn.lines.map(function (l) { return '<li>' + l + '</li>'; }).join('') + '</ul></div>';
    } else {
      p.innerHTML = head(pn.title) + '<div class="lp-body"><table class="lp-table">' + pn.rows.map(function (r) {
        return '<tr data-k="' + r.k + '"><th>' + r.label + '</th><td><input type="text" inputmode="decimal" autocomplete="off" data-k="' + r.k + '" aria-label="' + r.label + '"><span>' + r.unit + '</span></td><td class="lp-mark"></td></tr>';
      }).join('') + '</table></div>';
    }
    p.hidden = false;
  }
  function head(title) {
    return '<div class="lp-head"><b>' + title + '</b><button type="button" class="lp-fold" data-do="fold" aria-label="Replier ou déplier">▾</button></div>';
  }

  /* ---------- Vérification de la réponse ---------- */
  function readTable(m) {
    var p = $('ch-panel'), filled = false, res = m.panel.rows.map(function (r) {
      var inp = p.querySelector('input[data-k="' + r.k + '"]'), v = parseFloat(inp.value.replace(',', '.').replace(/\s/g, ''));
      var e = null;
      try { e = r.expect(lab); } catch (err) { e = null; }
      if (isFinite(v)) filled = true;
      var ok = isFinite(v) && e != null && Math.abs(v - e) <= Math.max(r.tol || 0, Math.abs(e) * .05);
      var row = p.querySelector('tr[data-k="' + r.k + '"]');
      row.classList.toggle('ok', ok); row.classList.toggle('bad', !ok);
      row.querySelector('.lp-mark').textContent = ok ? '✓' : '✗';
      return { text: r.label, ok: ok };
    });
    return filled ? res : null;
  }
  function verify() {
    if (phase !== 'doing') return;
    var m = mission(), res;
    if (m.panel.kind === 'table') {
      res = readTable(m);
      if (!res) { lab.toast('Remplis le tableau avant de vérifier.'); return; }
    } else {
      if (!lab.names().some(function (n) { var t = lab.state(n).type; return t && !/meter/.test(t); }) || !lab.save().wires.length) {
        lab.toast('Construis d\'abord ton circuit.');
        return;
      }
      var h = D.helpers(lab);
      res = m.criteria.map(function (c) {
        var ok = false;
        try { ok = !!c.test(h); } catch (e) { ok = false; }
        return { text: c.text, ok: ok };
      });
    }
    if (res.every(function (r) { return r.ok; })) success();
    else fail(res);
  }
  function fail(res) {
    var s = slot(), m = mission(), before = stake(s);
    s.fails++;
    updateScore();
    var lost = before - stake(s);
    modal('<div class="ch-fail__ico" aria-hidden="true">✗</div><h2 class="pop-title ch-center">Ce n\'est pas encore ça…</h2>' +
      '<p class="lesson-modal__text ch-center">' + (lost ? '−' + pts(lost) + ' : cette mission rapporte maintenant <b>' + pts(stake(s)) + '</b>.' : 'Cette mission ne peut plus rapporter de points, mais tu peux la terminer.') + '</p>' +
      '<p class="ch-help__t">Ce qui est vérifié</p><ul class="ch-help">' + res.map(function (r) {
        return '<li class="' + (r.ok ? 'ok' : 'bad') + '"><i aria-hidden="true">' + (r.ok ? '✓' : '✗') + '</i><span>' + r.text + '</span></li>';
      }).join('') + '</ul>' +
      '<div class="ex-actions"><button type="button" class="btn-clear" data-do="switch">Changer de mission</button><button type="button" class="btn-primary" data-do="close">Je corrige</button></div>');
  }
  function success() {
    var s = slot();
    s.status = 'done'; s.got = stake(s);
    phase = 'done';
    updateScore();
    $('ch-bar').classList.add('done');
    $('ch-verify').hidden = true;
    var b = $('ch-badge');
    b.hidden = false; b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
    Confetti.burst();
    setTimeout(function () { b.hidden = true; }, 1500);
    var last = game.cur === 2;
    $('ch-next').textContent = last ? 'Voir mes résultats' : 'Mission suivante';
    setTimeout(function () {
      if (phase !== 'done') return;
      $('ch-next').hidden = false;
      modal('<div class="lesson-end__ico" aria-hidden="true">🎯</div><h2 class="pop-title ch-center">Mission réussie !</h2>' +
        '<p class="ch-gain">+' + pts(s.got) + '</p>' +
        (s.fails ? '<p class="lesson-modal__text ch-center">' + s.fails + ' essai' + (s.fails > 1 ? 's' : '') + ' raté' + (s.fails > 1 ? 's' : '') + ' avant de réussir.</p>' : '<p class="lesson-modal__text ch-center">Du premier coup, bravo !</p>') +
        '<div class="ex-actions"><button type="button" class="btn-primary ch-go" data-do="next">' + (last ? 'Voir mes résultats' : 'Mission suivante') + '</button></div>');
    }, 1300);
  }
  function next() {
    closeModal();
    if (game.cur < 2) playSlot(game.cur + 1);
    else showResults();
  }

  /* ---------- Changer de mission (les points déjà perdus restent perdus) ---------- */
  function used(i) {
    return game.slots.some(function (s) { return s.m === i; }) || game.dropped.some(function (d) { return d.m === i; });
  }
  function openSwitch() {
    if (phase !== 'doing' && phase !== 'intro') return;
    var s = slot(), m = mission(), lost = Math.min(m.points, m.malus * s.fails), html = '';
    D.GROUPS.forEach(function (g, gi) {
      var cards = '';
      for (var k = 0; k < 9; k++) { var i = gi * 9 + k; cards += used(i) ? '<span class="ch-card ch-card--used">Déjà choisie</span>' : card(i); }
      html += '<p class="ch-switch__g">' + g.name + ' <span>échec −' + pts(g.malus) + '</span></p><div class="ch-grid ch-grid--mini">' + cards + '</div>';
    });
    modal('<p class="lesson-modal__kicker">Changer de mission</p><h2 class="pop-title">Choisis une autre mission</h2>' +
      '<p class="lesson-modal__text">' + (lost ? 'Les ' + pts(lost) + ' déjà perdus sur « ' + m.title + ' » restent décomptés de ton score.' : 'Tu n\'as encore rien perdu sur cette mission.') + '</p>' +
      '<div class="ch-switch">' + html + '</div>' +
      '<div class="ex-actions"><button type="button" class="btn-clear" data-do="close">Annuler</button></div>', 'wide');
  }
  function switchTo(i) {
    var s = slot(), m = mission();
    game.dropped.push({ m: s.m, fails: s.fails, lost: Math.min(m.points, m.malus * s.fails), at: game.cur });
    s.m = i; s.fails = 0; s.status = 'todo';
    closeModal();
    playSlot(game.cur);
  }

  /* ---------- Résultats : médaille, récapitulatif, meilleur score ---------- */
  function recap() {
    var list = [];
    game.slots.forEach(function (s, k) {
      game.dropped.filter(function (d) { return d.at === k; }).forEach(function (d) {
        var m = missions[d.m];
        list.push({ title: m.title, group: m.group, tag: m.tag, points: m.points, fails: d.fails, got: -d.lost, dropped: true });
      });
      var m = missions[s.m];
      list.push({ title: m.title, group: m.group, tag: m.tag, points: m.points, fails: s.fails, got: s.got, dropped: false });
    });
    return list;
  }
  function recapHtml(list) {
    return '<table class="ch-recap"><thead><tr><th>Mission</th><th>Essais ratés</th><th>Points</th></tr></thead><tbody>' + list.map(function (r) {
      return '<tr class="' + (r.dropped ? 'dropped' : '') + '"><th><b>' + r.title + '</b><small>' + r.group + ' · ' + r.tag + (r.dropped ? ' · abandonnée' : '') + '</small></th>' +
        '<td>' + r.fails + '</td><td class="ch-recap__pts">' + (r.got > 0 ? '+' : '') + r.got + '<small>/' + r.points + '</small></td></tr>';
    }).join('') + '</tbody></table>';
  }
  function medalHtml(md, big) {
    if (!md) return '<div class="ch-nomedal" aria-hidden="true">🎗️</div>';
    return '<div class="medal medal--' + md.id + (big ? ' medal--big' : '') + '" role="img" aria-label="Médaille ' + md.name + '">' +
      '<span class="medal__ribbon"></span><span class="medal__disc"><span class="medal__ring"></span><span class="medal__star">★</span><span class="medal__shine"></span></span>' +
      '<i class="medal__spark"></i><i class="medal__spark"></i><i class="medal__spark"></i></div>';
  }
  function showResults() {
    phase = 'end';
    if (lab) { lab.destroy(); lab = null; }
    var sc = score(), md = D.medal(sc), list = recap(), best = readBest(), record = !best || sc > best.score;
    if (record) writeBest({ score: sc, medal: md ? md.id : null, date: new Date().toISOString(), recap: list });
    var nextMd = [40, 70, 100, 115].filter(function (x) { return x > sc; })[0];
    $('ch-results').innerHTML =
      (md && md.id === 'platine' ? '<div class="ch-banner"><span>Champion de l\'électricité !</span></div>' : '') +
      medalHtml(md, true) +
      '<h1 class="app-title ch-res__title">' + (md ? 'Médaille ' + md.name + ' !' : 'Pas de médaille cette fois') + '</h1>' +
      '<p class="ch-res__score"><b>' + sc + '</b> points</p>' +
      '<p class="app-subtitle ch-res__msg">' + message(md, nextMd, sc) + '</p>' +
      (record ? '<p class="ch-record">🏆 Nouveau meilleur score !</p>' : '<p class="ch-res__best">Meilleur score : ' + pts(best.score) + '</p>') +
      '<div class="ch-res__card"><h2>Récapitulatif</h2>' + recapHtml(list) + '</div>' +
      '<div class="ex-actions"><button type="button" class="btn-clear" data-do="home">Accueil</button><button type="button" class="btn-primary ch-go" data-do="again">Rejouer</button></div>';
    App.show('screen-ch-results', 'challenge');
    renderBest();
    if (md) setTimeout(function () { Confetti.burst(); if (md.id === 'platine') setTimeout(Confetti.burst, 700); }, 400);
  }
  function message(md, nextMd, sc) {
    if (!md) return 'Il te manque ' + pts(nextMd - sc) + ' pour la médaille de bronze. Choisis bien tes missions et vérifie avant de proposer !';
    if (md.id === 'platine') return 'Score exceptionnel ! Tu maîtrises les circuits, les mesures et les lois de l\'électricité. Félicitations !';
    return 'Bravo ! Encore ' + pts(nextMd - sc) + ' et tu décroches la médaille suivante.';
  }
  function showBestRecap() {
    var b = readBest();
    if (!b) return;
    var md = D.medal(b.score);
    modal('<p class="lesson-modal__kicker">Mon meilleur score</p><div class="ch-best__head">' + medalHtml(md) + '<div><h2 class="pop-title">' + pts(b.score) + '</h2>' +
      '<p class="muted">' + (md ? 'Médaille ' + md.name + ' · ' : '') + new Date(b.date).toLocaleDateString('fr-FR') + '</p></div></div>' +
      recapHtml(b.recap || []) + '<div class="ex-actions"><button type="button" class="btn-primary" data-do="close">Fermer</button></div>', 'page wide');
  }

  /* ---------- Fenêtres ---------- */
  // where : 'page' = fenêtre de la page de choix, sinon celle de la mission ; 'wide' = plus large
  function modal(html, where) {
    where = where || '';
    var onPage = where.indexOf('page') >= 0, card = $(onPage ? 'chp-card' : 'ch-card');
    card.innerHTML = html;
    card.classList.toggle('pop-card--wide', where.indexOf('wide') >= 0);
    card.scrollTop = 0;
    $(onPage ? 'chp-modal' : 'ch-modal').hidden = false;
  }
  function closeModal() { $('ch-modal').hidden = true; $('chp-modal').hidden = true; }
  function onModal(ev) {
    var c = ev.target.closest('.ch-card[data-i]');
    if (c) { switchTo(+c.getAttribute('data-i')); return; }
    var b = ev.target.closest('[data-do]');
    if (!b) { if (ev.target === ev.currentTarget && phase !== 'intro') closeModal(); return; }
    var a = b.getAttribute('data-do');
    if (a === 'go') { closeModal(); if (phase === 'intro') phase = 'doing'; }
    else if (a === 'close') closeModal();
    else if (a === 'start') startGame();
    else if (a === 'unpick') { closeModal(); picked.pop(); renderGrid(); }
    else if (a === 'next') next();
    else if (a === 'switch') openSwitch();
    else if (a === 'quit') quit();
  }
  function askQuit() {
    modal('<h2 class="pop-title">Quitter la partie ?</h2><p class="lesson-modal__text">Ta partie en cours sera perdue et ton score ne sera pas enregistré.</p>' +
      '<div class="ex-actions"><button type="button" class="btn-clear ch-danger" data-do="quit">Quitter</button><button type="button" class="btn-primary" data-do="close">Continuer la partie</button></div>');
  }
  function quit() {
    closeModal();
    phase = 'idle';
    if (lab) { lab.destroy(); lab = null; }
    game = null;
    openPage();
  }

  function init() {
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(function () { });
    renderBest();
    $('btn-challenge').addEventListener('click', openPage);
    $('btn-back-challenge').addEventListener('click', function () { App.show('screen-home', 'home'); });
    $('ch-groups').addEventListener('click', function (ev) { var c = ev.target.closest('.ch-card[data-i]'); if (c) toggle(+c.getAttribute('data-i')); });
    $('ch-best').addEventListener('click', function (ev) { if (ev.target.closest('[data-do=best]')) showBestRecap(); });
    $('ch-modal').addEventListener('click', onModal);
    $('chp-modal').addEventListener('click', onModal);
    $('ch-panel').addEventListener('click', function (ev) { if (ev.target.closest('[data-do=fold]')) $('ch-panel').classList.toggle('folded'); });
    $('ch-panel').addEventListener('keydown', function (ev) { if (ev.key === 'Enter' && ev.target.matches('input')) verify(); });
    $('ch-goal').addEventListener('click', function () { if (phase === 'doing' || phase === 'intro') openIntro(); });
    $('ch-verify').addEventListener('click', verify);
    $('ch-switch').addEventListener('click', openSwitch);
    $('ch-next').addEventListener('click', next);
    $('btn-quit-ch').addEventListener('click', function () { if (phase === 'end') return; askQuit(); });
    $('ch-results').addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-do]');
      if (!b) return;
      if (b.getAttribute('data-do') === 'again') openPage();
      else App.show('screen-home', 'home');
    });
  }

  // lab() : labo de la mission en cours (pour les tests)
  return { init: init, openPage: openPage, lab: function () { return lab; }, mission: function () { return game && mission(); } };
})();
