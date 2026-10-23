// Confettis en canvas (repris de l'appli de chimie), aux couleurs des métaux de l'appli
window.Confetti = (function () {
  var canvas = null;

  function burst(originX, originY) {
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.className = 'confetti-canvas';
      document.body.appendChild(canvas);
    }
    var ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    canvas.style.display = 'block';

    var ox = typeof originX === 'number' ? originX : canvas.width / 2;
    var oy = typeof originY === 'number' ? originY : canvas.height * .45;
    var colors = ['#E3B48E', '#F0D27A', '#D3DAE3', '#4FBE7A', '#6FC2B0', '#FFFFFF'];
    var parts = [];
    for (var i = 0; i < 140; i++) {
      var a = Math.random() * Math.PI * 2, v = 4 + Math.random() * 8;
      parts.push({
        x: ox, y: oy, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 5,
        size: Math.random() * 6 + 4, color: colors[Math.floor(Math.random() * colors.length)],
        rot: Math.random() * 360, vr: (Math.random() - .5) * 14, g: .2 + Math.random() * .12
      });
    }
    var start = performance.now(), duration = 1700;

    function frame(now) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      parts.forEach(function (p) {
        p.vy += p.g; p.vx *= .99; p.x += p.vx; p.y += p.vy; p.rot += p.vr;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot * Math.PI / 180);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * .6);
        ctx.restore();
      });
      if (now - start < duration) requestAnimationFrame(frame);
      else { ctx.clearRect(0, 0, canvas.width, canvas.height); canvas.style.display = 'none'; }
    }
    requestAnimationFrame(frame);
  }

  return { burst: burst };
})();
