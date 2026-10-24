// Mode Leçon : menu des cours, déroulé des consignes, validation automatique et fiche « À retenir »
// Types de consignes : manipulation (par défaut), 'build' (schéma à réaliser), 'measure' (mesures à noter), 'quiz' (question à choix)
window.Lessons = (function () {
  var D = LessonsData, KEY = 'elec-lessons-done', KEY_STEPS = 'elec-lessons-steps';
  var lab = null, cur = null, idx = 0, phase = 'idle', timer = 0, holdStart = 0, evs = [], ctx = {};
  var stepSnap = null, doneSteps = {}, builtSnap = null, results = {}, measureOk = false, quizOk = false, hintT = 0;
  var $ = function (id) { return document.getElementById(id); };

  // Labo des leçons par défaut : dipôles idéaux, tension et valeurs nominales bloquées.
  // Chaque cours peut compléter ou remplacer ces réglages (cur.lab) ; chaque consigne peut changer palette, cases et réglages bloqués.
  // Le bouton d'effacement du labo devient « Recommencer » : il remet le montage du début de la consigne.
  var LAB_OPTS = {
    ideal: true, schemaGlow: true, fixedTypes: ['gen', 'lamp', 'motor'], hint: 'Suis la consigne affichée au-dessus.',
    clearLabel: 'Recommencer', onClear: restartStep
  };

  /* ---------- Progression mémorisée dans le navigateur ---------- */
  function read(key) { try { return JSON.parse(localStorage.getItem(key)) || {}; } catch (e) { return {}; } }
  function write(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch (e) { } }
  function saveStep(id, i) { var m = read(KEY_STEPS), l = m[id] || []; if (l.indexOf(i) < 0) l.push(i); m[id] = l; write(KEY_STEPS, m); }
  function markDone(id) { var d = read(KEY); d[id] = 1; write(KEY, d); }
  // Un cours à plusieurs niveaux n'est terminé que lorsque tous ses niveaux le sont
  function courseDone(c) { var d = read(KEY); return !!d[c.id] && (!c.next || courseDone(D[byId(c.next)])); }
  function byId(id) { for (var i = 0; i < D.length; i++) if (D[i].id === id) return i; return -1; }
  // Rang du cours dans le menu (les niveaux suivants prennent le rang de leur cours)
  function rank(i) {
    if (D[i].parent) return rank(byId(D[i].parent));
    var n = 0;
    for (var k = 0; k < i; k++) if (!D[k].hidden) n++;
    return n;
  }

  /* ---------- Menu des cours ---------- */
  function buildMenu() {
    $('lessons-list').innerHTML = D.map(function (c, i) {
      if (c.hidden) return '';
      var k = rank(i);
      return '<button type="button" class="mode-btn mode-btn--ox' + k + ' mode-btn--lesson" data-i="' + i + '"' + (c.soon ? ' aria-disabled="true"' : '') + '>' +
        '<span class="mode-btn__kicker">Cours ' + (k + 1) + '</span>' +
        '<span class="mode-btn__title">' + c.title + '</span>' +
        '<span class="mode-btn__subtitle">' + (c.soon ? 'Prochainement...' : c.sub) + '</span>' +
        (courseDone(c) ? '<span class="lesson-done" aria-label="Cours terminé">✓</span>' : '') + '</button>';
    }).join('');
  }
  function openMenu() {
    buildMenu();
    App.show('screen-lessons', 'home');
  }
  // Choix du niveau, proposé quand le niveau 1 d'un cours est déjà terminé
  function openLevels(i) {
    var list = [], c = D[i];
    while (c) { list.push(byId(c.id)); c = c.next ? D[byId(c.next)] : null; }
    $('level-card').innerHTML = '<p class="lesson-modal__kicker">Cours ' + (rank(i) + 1) + '</p><h2 class="pop-title">' + D[i].title + '</h2>' +
      '<div class="level-list">' + list.map(function (k) {
        return '<button type="button" class="level-btn" data-i="' + k + '"><b>Niveau ' + D[k].level + '</b><span>' + D[k].levelName + '</span>' +
          (read(KEY)[D[k].id] ? '<i aria-label="Terminé">✓</i>' : '') + '</button>';
      }).join('') + '</div><div class="ex-actions"><button type="button" class="btn-clear" data-do="close">Fermer</button></div>';
    $('level-modal').hidden = false;
  }

  /* ---------- Déroulé d'un cours ---------- */
  function start(i) {
    if (lab) { lab.destroy(); lab = null; }
    cur = D[i]; idx = 0; stepSnap = null; builtSnap = null; results = {};
    doneSteps = {};
    (read(KEY_STEPS)[cur.id] || []).forEach(function (k) { doneSteps[k] = true; });
    var k = rank(i);
    $('lesson-kicker').textContent = 'Cours ' + (k + 1) + (cur.level ? ' · Niveau ' + cur.level + ' : ' + cur.levelName : '');
    $('lesson-title').textContent = cur.title;
    App.show('screen-lesson', 'ox' + k);
    var o = {}, key;
    for (key in LAB_OPTS) o[key] = LAB_OPTS[key];
    for (key in cur.lab) o[key] = cur.lab[key];
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
    if (s.unlock) lab.lock(s.unlock, false);
  }
  function showStep() {
    var s = step();
    phase = 'intro'; measureOk = false; quizOk = false;
    // Circuit imposé, ou retour au circuit construit (sans les appareils de mesure)
    if (s.circuit) lab.load(s.circuit);
    if (s.restore === 'built') lab.load(builtSnap || cur.target);
    $('lesson-step').textContent = (idx + 1) + '/' + cur.steps.length;
    $('lesson-task').textContent = s.task;
    $('lesson-bar').classList.remove('done', 'free');
    $('lesson-next').textContent = 'Consigne suivante';
    // Une consigne déjà réussie une fois peut être passée directement
    $('lesson-next').hidden = !(doneSteps[idx] && idx < cur.steps.length - 1);
    if (s.kind !== 'quiz') applyStep();
    showPanel(s);
    openStepModal();
  }
  function openStepModal() {
    var s = step();
    if (s.kind === 'quiz') { modal(quizHtml(s)); return; }
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
    phase = 'doing'; holdStart = 0; evs = [];
    // État noté au départ de la consigne (ex. tension du générateur) pour vérifier un changement
    ctx = step().start ? step().start(lab) : {};
    // Montage du début de la consigne, rétabli par « Recommencer »
    stepSnap = lab.save(); stepSnap.center = false;
  }
  // Vérification continue de la tâche en cours (evs : évènements du labo depuis le début de la consigne)
  function tick() {
    if (phase !== 'doing' || !lab) return;
    var s = step(), ok = false;
    if (s.kind === 'measure') ok = measureOk;
    else if (s.kind === 'quiz') ok = quizOk;
    else { try { ok = s.check(lab, evs, ctx); } catch (e) { ok = false; } }
    if (!ok) {
      holdStart = 0;
      // Indice quand le montage est presque bon (réglages ou fils à revoir) : sous le schéma à réaliser,
      // sinon dans une bulle de temps en temps
      if (s.hint) {
        var h = null, box = $('lesson-panel').querySelector('.lp-hint');
        try { h = s.hint(lab); } catch (e) { h = null; }
        if (box) box.textContent = h || '';
        else if (h && performance.now() - hintT > 7000) { lab.toast(h); hintT = performance.now(); }
      }
      return;
    }
    var hb = $('lesson-panel').querySelector('.lp-hint');
    if (hb) hb.textContent = '';
    if (!holdStart) holdStart = performance.now();
    if (performance.now() - holdStart >= (s.hold || 0)) success();
  }
  function restartStep() {
    if (!stepSnap) return;
    lab.load(stepSnap);
    holdStart = 0; evs = [];
    lab.toast('Consigne recommencée');
  }
  function success() {
    var s = step();
    phase = 'done';
    doneSteps[idx] = true;
    saveStep(cur.id, idx);
    if (s.kind === 'build') {
      // Les dipôles prennent les noms du schéma, pour que les mesures à noter correspondent au circuit
      var map = null;
      try { map = s.rename ? s.rename(lab) : null; } catch (e) { map = null; }
      if (map && lab.rename(map)) setTimeout(function () { lab.toast('Les dipôles ont été renommés comme sur le schéma.'); }, 1500);
      builtSnap = stripMeters(lab.save());
    }
    var b = $('lesson-badge');
    b.hidden = false; b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
    Confetti.burst();
    setTimeout(function () { b.hidden = true; }, 1500);
    $('lesson-bar').classList.add('done');
    if (idx < cur.steps.length - 1) $('lesson-next').hidden = false;
    else {
      // Le cours n'est terminé que si toutes ses consignes ont été réussies au moins une fois
      if (cur.steps.every(function (x, k) { return doneSteps[k]; })) markDone(cur.id);
      setTimeout(function () { if (phase === 'done' && cur) showEnd(); }, 1400);
    }
  }
  function next() { idx++; showStep(); }
  function showEnd() {
    phase = 'end';
    hidePanel();
    modal(
      '<div class="lesson-end__ico" aria-hidden="true">🏅</div>' +
      '<h2 class="pop-title lesson-end__title">' + (cur.level ? 'Niveau ' + cur.level + ' terminé !' : 'Cours terminé !') + '</h2>' +
      '<p class="lesson-modal__text lesson-end__text">' + cur.end + '</p>' +
      '<div class="ex-actions"><button type="button" class="btn-primary" data-do="recap">À retenir</button>' +
      (cur.next ? '<button type="button" class="btn-primary lesson-level" data-do="level">Niveau ' + D[byId(cur.next)].level + '</button>' : '') +
      '<button type="button" class="btn-clear lesson-free" data-do="free">Continuer dans le labo</button></div>'
    );
  }
  // Après le cours : le labo reste disponible avec les éléments du cours
  function freeLab() {
    closeModal();
    hidePanel();
    phase = 'free';
    var last = cur.steps[cur.steps.length - 1];
    lab.set({ palette: cur.freePalette || last.palette, toggles: last.toggles || cur.lab.toggles });
    $('lesson-step').textContent = '✓';
    $('lesson-task').textContent = 'Cours terminé : continue à expérimenter librement.';
    $('lesson-bar').classList.add('done', 'free');
    $('lesson-next').textContent = 'À retenir';
    $('lesson-next').hidden = false;
  }

  /* ---------- Fenêtre de travail : schéma à réaliser ou mesures à noter ---------- */
  function hidePanel() { $('lesson-panel').hidden = true; }
  function showPanel(s) {
    var p = $('lesson-panel');
    if (s.kind === 'build') {
      p.innerHTML = panelHead('Schéma à réaliser') + '<div class="lp-body"><div class="lp-img"></div><p class="lp-legend">' + cur.legend + '</p><p class="lp-hint" aria-live="polite"></p></div>';
      p.hidden = false;
      var img = p.querySelector('.lp-img');
      if (cur._schema) img.innerHTML = cur._schema;
      else snap({ circuit: labeled(cur.target, cur.labels), opts: { schema: true } }).then(function (svg) { cur._schema = svg; if (img.isConnected) img.innerHTML = svg; });
    } else if (s.kind === 'measure') {
      var prev = results[idx] || {};
      p.innerHTML = panelHead('Mes mesures') + '<div class="lp-body"><table class="lp-table">' + s.rows.map(function (r) {
        return '<tr data-k="' + r.k + '"><th>' + r.label + '</th><td><input type="text" inputmode="decimal" autocomplete="off" data-k="' + r.k + '" value="' +
          (prev[r.k] != null ? String(prev[r.k]).replace('.', ',') : '') + '" aria-label="' + r.label + '"><span>' + r.unit + '</span></td><td class="lp-mark"></td></tr>';
      }).join('') + '</table><div class="lp-actions"><button type="button" class="btn-primary lp-check" data-do="verify">Vérifier</button></div><p class="lp-msg" aria-live="polite"></p></div>';
      p.hidden = false;
    } else hidePanel();
  }
  function panelHead(title) {
    return '<div class="lp-head"><b>' + title + '</b><button type="button" class="lp-fold" data-do="fold" aria-label="Replier ou déplier">▾</button></div>';
  }
  // Mesures notées : chaque valeur est comparée à ce que montrent les appareils dans le circuit
  function verify() {
    var s = step(), p = $('lesson-panel'), all = true, vals = {}, exp = {};
    try { exp = s.expect(lab) || {}; } catch (e) { exp = {}; }
    s.rows.forEach(function (r) {
      var inp = p.querySelector('input[data-k="' + r.k + '"]'), v = parseFloat(inp.value.replace(',', '.').replace(/\s/g, ''));
      var e = exp[r.k], good = isFinite(v) && e != null && Math.abs(v - e) <= Math.max(r.tol || 0, Math.abs(e) * .05);
      var row = p.querySelector('tr[data-k="' + r.k + '"]');
      row.classList.toggle('ok', good); row.classList.toggle('bad', !good);
      row.querySelector('.lp-mark').textContent = good ? '✓' : '✗';
      vals[r.k] = isFinite(v) ? v : null;
      if (!good) all = false;
    });
    results[idx] = vals;
    p.querySelector('.lp-msg').textContent = all ? 'Toutes tes mesures sont justes !' : 'Certaines valeurs ne correspondent pas : mesure à nouveau.';
    p.querySelector('.lp-msg').classList.toggle('ok', all);
    if (all && phase === 'doing') measureOk = true;
  }

  /* ---------- Question à choix ---------- */
  function quizHtml(s) {
    var m = cur.steps[s.results], vals = results[s.results] || {};
    return '<p class="lesson-modal__kicker">Consigne ' + (idx + 1) + ' / ' + cur.steps.length + '</p>' +
      '<h2 class="pop-title">' + s.title + '</h2>' +
      '<table class="quiz__res"><caption>Tes mesures</caption>' + m.rows.map(function (r) {
        return '<tr><th>' + r.label + '</th><td>' + (vals[r.k] != null ? String(vals[r.k]).replace('.', ',') + ' ' + r.unit : '—') + '</td></tr>';
      }).join('') + '</table>' +
      '<p class="lesson-modal__text"><b>' + s.question + '</b></p>' +
      '<div class="quiz">' + s.choices.map(function (c, k) {
        return '<button type="button" class="quiz__c" data-c="' + k + '" aria-pressed="false"><b>' + 'ABCD'[k] + '</b><span>' + c + '</span></button>';
      }).join('') + '</div>' +
      '<p class="muted">' + (s.answer.length > 1 ? s.answer.length + ' bonnes réponses' : 'Une seule bonne réponse') + '</p>' +
      '<p class="quiz__msg" aria-live="polite"></p>' +
      '<div class="ex-actions"><button type="button" class="btn-primary" data-do="answer">Valider</button>' +
      '<button type="button" class="btn-clear" data-do="close">Voir le circuit</button></div>';
  }
  function pick(b) {
    var s = step();
    if (s.answer.length === 1) $('lesson-card').querySelectorAll('.quiz__c').forEach(function (x) { if (x !== b) x.setAttribute('aria-pressed', 'false'); });
    b.setAttribute('aria-pressed', b.getAttribute('aria-pressed') === 'true' ? 'false' : 'true');
    b.classList.remove('bad');
  }
  function answer() {
    var s = step(), card = $('lesson-card'), chosen = [];
    card.querySelectorAll('.quiz__c[aria-pressed="true"]').forEach(function (b) { chosen.push(+b.getAttribute('data-c')); });
    var good = chosen.length === s.answer.length && s.answer.every(function (a) { return chosen.indexOf(a) >= 0; });
    var msg = card.querySelector('.quiz__msg');
    if (good) {
      quizOk = true; phase = 'doing'; holdStart = 0;
      closeModal();
      return;
    }
    card.querySelectorAll('.quiz__c[aria-pressed="true"]').forEach(function (b) { if (s.answer.indexOf(+b.getAttribute('data-c')) < 0) b.classList.add('bad'); });
    msg.textContent = chosen.length ? 'Ce n\'est pas tout à fait ça : compare bien tes mesures.' : 'Choisis une réponse.';
  }

  /* ---------- Circuits : copies utiles ---------- */
  // Circuit construit, sans les appareils de mesure (l'ampèremètre redevient un fil)
  function stripMeters(c) {
    var out = { els: [], wires: c.wires.slice(), center: false };
    c.els.forEach(function (e) {
      if (Comp.isMeter(e.type)) { if (e.between) out.wires.push({ a: e.between[0], b: e.between[1] }); }
      else out.els.push(e);
    });
    return out;
  }
  // Même circuit avec des étiquettes (ex. « L1 (3 V) ») pour l'image du schéma
  function labeled(c, labels) {
    function ren(n) { return labels[n] || n; }
    function ref(r) { var k = r.lastIndexOf('.'); return ren(r.slice(0, k)) + r.slice(k); }
    return {
      els: c.els.map(function (e) { var d = {}; for (var k in e) d[k] = e[k]; d.name = ren(e.name); return d; }),
      wires: c.wires.map(function (w) { return Array.isArray(w) ? [ref(w[0]), ref(w[1])] : { a: ref(w.a), b: ref(w.b) }; })
    };
  }

  /* ---------- Liste des étapes (depuis le compteur) ---------- */
  // Accessible : une étape déjà réussie, ou la première pas encore faite (on ne saute pas d'étape)
  function reachable(i) {
    var first = 0;
    while (first < cur.steps.length && doneSteps[first]) first++;
    return !!doneSteps[i] || i === first || i === idx;
  }
  function toggleSteps(open) {
    var box = $('lesson-steps');
    if (open == null) open = box.hidden;
    if (open) {
      box.innerHTML = cur.steps.map(function (s, i) {
        var ok = reachable(i);
        return '<button type="button" data-goto="' + i + '" class="' + (doneSteps[i] ? 'done' : '') + (ok ? '' : ' locked') + '"' + (ok ? '' : ' disabled') +
          (i === idx && phase !== 'free' ? ' aria-current="step"' : '') + '>' +
          '<span class="lesson-steps__n">' + (doneSteps[i] ? '✓' : ok ? i + 1 : '🔒') + '</span>' + s.title + '</button>';
      }).join('');
    }
    box.hidden = !open;
    $('lesson-step').setAttribute('aria-expanded', open ? 'true' : 'false');
  }
  // Dernière consigne (≤ k) qui impose un circuit, -1 s'il n'y en a pas
  function seg(k) { for (var j = k; j >= 0; j--) if (cur.steps[j].circuit) return j; return -1; }
  // Aller directement à une étape. Si elle s'appuie sur un circuit imposé plus tôt et que l'élève vient
  // d'une autre partie du cours, on remet ce circuit ; sinon on garde son montage.
  function goto(i) {
    if (!reachable(i)) return;
    toggleSteps(false);
    closeModal();
    var s = seg(i);
    if (!cur.steps[i].circuit && s >= 0 && seg(idx) !== s) lab.load(cur.steps[s].circuit);
    idx = i;
    showStep();
  }

  /* ---------- À retenir : images fixes des circuits, texte à côté ---------- */
  // Le circuit est monté dans un labo invisible, photographié puis détruit
  function snap(l) { return Lab.snap(l.circuit, l.opts, l.wait); }
  function showRecap() {
    var h = '<p class="lesson-modal__kicker">' + cur.title + (cur.level ? ' · Niveau ' + cur.level : '') + '</p><h2 class="pop-title">À retenir</h2><div class="recap">';
    cur.recap.forEach(function (r, k) {
      h += '<div class="recap__item">';
      if (r.law) h += '<div class="law"><b class="law__name">' + r.law.name + '</b><p>' + r.law.text + '</p><div class="law__f">' + r.law.formula + '</div></div>';
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
    h += '</div><div class="ex-actions">' +
      (phase === 'end' && cur.next ? '<button type="button" class="btn-primary lesson-level" data-do="level">Niveau ' + D[byId(cur.next)].level + '</button>' : '') +
      '<button type="button" class="btn-primary" data-do="' + (phase === 'end' ? 'free' : 'close') + '">' + (phase === 'end' ? 'Continuer dans le labo' : 'Fermer') + '</button></div>';
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
    var c = ev.target.closest('.quiz__c');
    if (c) { pick(c); return; }
    var b = ev.target.closest('[data-do]');
    if (!b) return;
    var a = b.getAttribute('data-do');
    if (a === 'go') go();
    else if (a === 'recap') showRecap();
    else if (a === 'free') freeLab();
    else if (a === 'close') closeModal();
    else if (a === 'answer') answer();
    else if (a === 'level') { closeModal(); start(byId(cur.next)); }
  }
  function onPanelClick(ev) {
    var b = ev.target.closest('[data-do]');
    if (!b) return;
    if (b.getAttribute('data-do') === 'verify') verify();
    if (b.getAttribute('data-do') === 'fold') $('lesson-panel').classList.toggle('folded');
  }
  function quit() {
    closeModal();
    hidePanel();
    toggleSteps(false);
    phase = 'idle';
    if (lab) { lab.destroy(); lab = null; }
    cur = null;
    openMenu();
  }

  function init() {
    $('lessons-list').addEventListener('click', function (ev) {
      var b = ev.target.closest('.mode-btn');
      if (!b) return;
      var i = +b.getAttribute('data-i'), c = D[i];
      if (c.soon) { b.classList.remove('nudge'); void b.offsetWidth; b.classList.add('nudge'); return; }
      if (c.next && read(KEY)[c.id]) openLevels(i);
      else start(i);
    });
    $('level-modal').addEventListener('click', function (ev) {
      var b = ev.target.closest('.level-btn');
      if (b) { $('level-modal').hidden = true; start(+b.getAttribute('data-i')); return; }
      if (ev.target === $('level-modal') || ev.target.closest('[data-do=close]')) $('level-modal').hidden = true;
    });
    $('btn-back-lessons').addEventListener('click', function () { App.show('screen-home', 'home'); });
    $('btn-quit-lesson').addEventListener('click', quit);
    $('lesson-modal').addEventListener('click', onModalClick);
    $('lesson-panel').addEventListener('click', onPanelClick);
    $('lesson-panel').addEventListener('keydown', function (ev) { if (ev.key === 'Enter' && ev.target.matches('input')) verify(); });
    $('lesson-goal').addEventListener('click', function () {
      if (phase === 'free') showRecap();
      else if (phase === 'intro' || phase === 'doing' || phase === 'done') openStepModal();
    });
    $('lesson-next').addEventListener('click', function () { if (phase === 'free') showRecap(); else next(); });
    $('lesson-step').addEventListener('click', function (ev) { ev.stopPropagation(); toggleSteps(); });
    $('lesson-steps').addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-goto]');
      if (b) goto(+b.getAttribute('data-goto'));
    });
    document.addEventListener('click', function (ev) {
      if (!$('lesson-steps').hidden && !ev.target.closest('#lesson-steps')) toggleSteps(false);
    });
    timer = setInterval(tick, 200);
  }

  return { init: init, openMenu: openMenu };
})();
