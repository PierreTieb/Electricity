// Navigation entre les écrans et thème du fond
(function () {
  function show(id, theme) {
    document.querySelectorAll('.screen').forEach(function (s) { s.classList.toggle('active', s.id === id); });
    document.body.setAttribute('data-theme', theme);
    window.scrollTo(0, 0);
  }

  Lab.init();

  document.getElementById('btn-lab').addEventListener('click', function () {
    show('screen-lab', 'lab');
    Lab.enter();
  });
  document.getElementById('btn-back-lab').addEventListener('click', function () {
    Lab.leave();
    show('screen-home', 'home');
  });

  // Modules à venir : petit mouvement pour signaler qu'ils ne sont pas encore ouverts
  ['btn-lessons', 'btn-challenge'].forEach(function (id) {
    var b = document.getElementById(id);
    b.addEventListener('click', function () {
      b.classList.remove('nudge');
      void b.offsetWidth;
      b.classList.add('nudge');
    });
  });
})();
