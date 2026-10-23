// Navigation entre les écrans et thème du fond
window.App = (function () {
  function show(id, theme) {
    document.querySelectorAll('.screen').forEach(function (s) { s.classList.toggle('active', s.id === id); });
    document.body.setAttribute('data-theme', theme);
    window.scrollTo(0, 0);
  }
  return { show: show };
})();

(function () {
  var lab = Lab.create(document.getElementById('lab-host'));
  Lessons.init();

  document.getElementById('btn-lab').addEventListener('click', function () {
    App.show('screen-lab', 'lab');
    lab.start();
  });
  document.getElementById('btn-back-lab').addEventListener('click', function () {
    lab.stop();
    App.show('screen-home', 'home');
  });
  document.getElementById('btn-lessons').addEventListener('click', Lessons.openMenu);

  // Module à venir : petit mouvement pour signaler qu'il n'est pas encore ouvert
  var ch = document.getElementById('btn-challenge');
  ch.addEventListener('click', function () {
    ch.classList.remove('nudge');
    void ch.offsetWidth;
    ch.classList.add('nudge');
  });
})();
