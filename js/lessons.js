// Mode Leçon : menu des cours, déroulé des consignes, validation automatique et fiche « À retenir »
window.Lessons = (function () {
  var D = LessonsData, KEY = 'elec-lessons-done';
  var lab = null, cur = null, idx = 0, phase = 'idle', timer = 0, holdStart = 0, evs = [];
  var $ = function (id) { return document.getElementById(id); };

  // Labo des leçons par défaut : dipôles idéaux, tension et valeurs nominales bloquées.
  // Chaque cours peut compléter ou remplacer ces réglages (cur.lab) ; chaque consigne peut changer palette, cases et réglages bloqués.
  var LAB_OPTS = { ideal: true, schemaGlow: true, fixedTypes: ['gen', 'lamp', 'motor'], hint: 'Suis la consigne affichée au-dessus.' };

  /* ---------- Progression mémorisée dans le navigateur ---------- */
  function doneMap() { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } }
  function markDone(id) { try { var d = doneMap(); d[id] = 1; localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) { } }

  /* ---------- Menu des cours ---------- */
  function buildMenu() {
    var done = doneMap();
    $('lessons-list').innerHTML = D.map(function (c, i) {
      return '<button type="button" class="mode-btn mode-btn--ox' + i + ' mode-btn--lesson" data-i="' + i + '"' + (c.soon ? ' aria-disabled="true"' : '') + '>' +
        '<span class="mode-btn__kicker">Cours ' + (i + 1) + '</span>' +
        '<span class="mode-btn__title">' + c.title + '</span>' +
        '<span class="mode-btn__subtitle">' + (c.soon ? 'Prochainement...' : c.sub) + '</span>' +
        (done[c.id] ? '<span class="lesson-done" aria-label="Cours terminé">✓</span>' : '') + '</button>';
    }).join('');
  }
  function openMenu() {
    buildMenu();
    App.show('screen-lessons', 'home');
  }

  /* ---------- Déroulé d'un cours ---------- */
  function start(i) {
    cur = D[i]; idx = 0;
    $('lesson-kicker').textContent = 'Cours ' + (i + 1);
    $('lesson-title').textContent = cur.title;
    App.show('screen-lesson', 'ox' + i);
    var o = {}, k;
    for (k in LAB_OPTS) o[k] = LAB_OPTS[k];
    for (k in cur.lab) o[k] = cur.lab[k];
    o.palette = cur.steps[0].palette;
    o.onEvent = function (type) { if (phase === 'doing') evs.push(type); };
    lab = Lab.create($('lesson-host'), o);
    lab.start();
    showStep();
  }
  function step() { return cur.steps[idx]; }
  function applyStep() {
    var s = step();
    lab.set({
      palette: s.palette,
      toggles: s.toggles || cur.lab.toggles,
      fixedTypes: s.fixedTypes || cur.lab.fixedTypes || LAB_OPTS.fixedTypes
    });
    if (s.set) lab.set(s.set);
  }
  function showStep() {
    var s = step();
    phase = 'intro';
    // Circuit imposé : il apparaît derrière la consigne
    if (s.circuit) lab.load(s.circuit);
    $('lesson-step').textContent = (idx + 1) + '/' + cur.steps.length;
    $('lesson-task').textContent = s.task;
    $('lesson-bar').classList.remove('done', 'free');
    $('lesson-next').textContent = 'Consigne suivante';
    $('lesson-next').hidden = true;
    openStepModal();
  }
  function openStepModal() {
    var s = step();
    modal(
      '<p class="lesson-modal__kicker">Consigne ' + (idx + 1) + ' / ' + cur.steps.length + '</p>' +
      '<h2 class="pop-title">' + s.title + '</h2>' +
      '<p class="lesson-modal__text">' + s.text + '</p>' +
      '<div class="lesson-task"><span class="lesson-task__ico" aria-hidden="true">➜</span><span>' + s.task + '</span></div>' +
      (s.how ? '<p class="muted">' + s.how + '</p>' : '') +
      '<div class="ex-actions"><button type="button" class="btn-primary" data-do="go">C\'est parti</button></div>'
    );
  }
  function go() {
    closeModal();
    if (phase !== 'intro') return;
    applyStep();
    phase = 'doing'; holdStart = 0; evs = [];
  }
  // Vérification continue de la tâche en cours (evs : évènements du labo depuis le début de la consigne)
  function tick() {
    if (phase !== 'doing' || !lab) return;
    var s = step(), ok = false;
    try { ok = s.check(lab, evs); } catch (e) { ok = false; }
    if (!ok) { holdStart = 0; return; }
    if (!holdStart) holdStart = performance.now();
    if (performance.now() - holdStart >= (s.hold || 0)) success();
  }
  function success() {
    phase = 'done';
    var b = $('lesson-badge');
    b.hidden = false; b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
    Confetti.burst();
    setTimeout(function () { b.hidden = true; }, 1500);
    $('lesson-bar').classList.add('done');
    if (idx < cur.steps.length - 1) $('lesson-next').hidden = false;
    else { markDone(cur.id); setTimeout(function () { if (phase === 'done' && cur) showEnd(); }, 1400); }
  }
  function next() { idx++; showStep(); }
  function showEnd() {
    phase = 'end';
    modal(
      '<div class="lesson-end__ico" aria-hidden="true">🏅</div>' +
      '<h2 class="pop-title lesson-end__title">Cours terminé !</h2>' +
      '<p class="lesson-modal__text lesson-end__text">' + cur.end + '</p>' +
      '<div class="ex-actions"><button type="button" class="btn-primary" data-do="recap">À retenir</button>' +
      '<button type="button" class="btn-clear lesson-free" data-do="free">Continuer dans le labo</button></div>'
    );
  }
  // Après le cours : le labo reste disponible avec les éléments du cours
  function freeLab() {
    closeModal();
    phase = 'free';
    var last = cur.steps[cur.steps.length - 1];
    lab.set({ palette: last.palette, toggles: last.toggles || cur.lab.toggles });
    $('lesson-step').textContent = '✓';
    $('lesson-task').textContent = 'Cours terminé : continue à expérimenter librement.';
    $('lesson-bar').classList.add('done', 'free');
    $('lesson-next').textContent = 'À retenir';
    $('lesson-next').hidden = false;
  }

  /* ---------- À retenir : images fixes des circuits, texte à côté ---------- */
  // Le circuit est monté dans un labo invisible, photographié puis détruit
  function snap(l) {
    return new Promise(function (resolve) {
      var host = document.createElement('div'), o = l.opts || {};
      host.className = 'snap-host';
      document.body.appendChild(host);
      var m = Lab.create(host, {
        readOnly: true, ideal: o.ideal !== false, clear: false, palette: [], height: '320px',
        toggles: { schema: false, current: false, electrons: false },
        schema: !!o.schema, current: !!o.current, electrons: !!o.electrons, circuit: l.circuit
      });
      m.start();
      setTimeout(function () { var svg = m.snapshot(); m.destroy(); host.remove(); resolve(svg); }, l.wait || 450);
    });
  }
  function showRecap() {
    var h = '<p class="lesson-modal__kicker">' + cur.title + '</p><h2 class="pop-title">À retenir</h2><div class="recap">';
    cur.recap.forEach(function (r, k) {
      h += '<div class="recap__item">';
      if (r.text) h += '<p>' + r.text + '</p>';
      if (r.symbols) {
        h += '<div class="recap__symbols">' + cur.symbols.map(function (s) {
          return '<div class="recap__sym"><svg viewBox="-50 -26 100 52" aria-hidden="true">' + Comp.draw({ type: s[0], opt: 0, closed: false }, true) + '</svg>' +
            '<b>' + Comp.TYPES[s[0]].name + '</b><small>' + s[1] + '</small></div>';
        }).join('') + '</div>';
      }
      (r.labs || []).forEach(function (l, j) {
        h += '<div class="recap__row"><div class="recap__img" data-k="' + k + '" data-j="' + j + '">' + (l._svg || '') + '</div><p class="recap__cap">' + l.caption + '</p></div>';
      });
      h += '</div>';
    });
    h += '</div><div class="ex-actions"><button type="button" class="btn-primary" data-do="' + (phase === 'end' ? 'free' : 'close') + '">' + (phase === 'end' ? 'Continuer dans le labo' : 'Fermer') + '</button></div>';
    modal(h, true);
    // Les images manquantes sont fabriquées une à une, puis gardées pour les ouvertures suivantes
    var todo = [].slice.call(document.querySelectorAll('#lesson-card .recap__img')).filter(function (n) { return !n.firstChild; });
    (function nextSnap() {
      var n = todo.shift();
      if (!n) return;
      var l = cur.recap[+n.getAttribute('data-k')].labs[+n.getAttribute('data-j')];
      snap(l).then(function (svg) { l._svg = svg; if (n.isConnected) n.innerHTML = svg; nextSnap(); });
    })();
  }

  /* ---------- Fenêtre de la leçon ---------- */
  function modal(html, wide) {
    var card = $('lesson-card');
    card.innerHTML = html;
    card.classList.toggle('pop-card--wide', !!wide);
    card.scrollTop = 0;
    $('lesson-modal').hidden = false;
  }
  function closeModal() { $('lesson-modal').hidden = true; }
  function onModalClick(ev) {
    var b = ev.target.closest('[data-do]');
    if (!b) return;
    var a = b.getAttribute('data-do');
    if (a === 'go') go();
    else if (a === 'recap') showRecap();
    else if (a === 'free') freeLab();
    else if (a === 'close') closeModal();
  }
  function quit() {
    closeModal();
    phase = 'idle';
    if (lab) { lab.destroy(); lab = null; }
    cur = null;
    openMenu();
  }

  function init() {
    $('lessons-list').addEventListener('click', function (ev) {
      var b = ev.target.closest('.mode-btn');
      if (!b) return;
      var c = D[+b.getAttribute('data-i')];
      if (c.soon) { b.classList.remove('nudge'); void b.offsetWidth; b.classList.add('nudge'); return; }
      start(+b.getAttribute('data-i'));
    });
    $('btn-back-lessons').addEventListener('click', function () { App.show('screen-home', 'home'); });
    $('btn-quit-lesson').addEventListener('click', quit);
    $('lesson-modal').addEventListener('click', onModalClick);
    $('lesson-goal').addEventListener('click', function () {
      if (phase === 'free') showRecap();
      else if (phase === 'doing' || phase === 'done') openStepModal();
    });
    $('lesson-next').addEventListener('click', function () { if (phase === 'free') showRecap(); else next(); });
    timer = setInterval(tick, 200);
  }

  return { init: init, openMenu: openMenu };
})();
