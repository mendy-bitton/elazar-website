/* Stage lights: dim bokeh on a canvas, pulsing to the shared beat (hero, music, stage, contact).
   s: the owner's cleanup scope (see scope.js) */
import { reduce, rand, beat } from './env';

const COLORS = [
  [255, 196, 112], [242, 156, 66], [255, 226, 180], [228, 178, 84],
  [255, 196, 112], [242, 156, 66], [228, 178, 84],
  [92, 124, 196], [120, 96, 180]
];

export function stageLights(cv, s, { boost = () => 0, dimRight = false, count = 1 } = {}) {
  if (!cv) return;
  const ctx = cv.getContext('2d');
  let visible = false;
  s.observe(cv, ([e]) => { visible = e.isIntersecting; });
  const SCALE = .5;
  let W = 0, H = 0, V = 0;
  const resize = () => {
    const w = cv.clientWidth, h = cv.clientHeight;
    if (w === W && h === H) return;                 // ignore resizes that didn't change the stage
    W = w; H = h; V = Math.max(W, Math.min(H, innerHeight * 1.2));
    cv.width = Math.max(1, Math.round(W * SCALE)); cv.height = Math.max(1, Math.round(H * SCALE));
    ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
  };
  resize();
  s.on(window, 'resize', resize);

  const mobile = W < 900;
  const N = Math.round((mobile ? 12 : 20) * count);
  const cool = COLORS.length - 2;
  const lights = Array.from({ length: N }, (_, i) => {
    const disc = i % 2 === 0;       // half crisp bokeh discs, half soft washes
    return {
      x: rand(.02, .98), y: rand(.04, .96), disc,
      r: disc ? rand(.03, .075) : rand(.11, .24),
      c: COLORS[i % COLORS.length],
      a: (disc ? rand(.12, .24) : rand(.06, .12)) * (i % COLORS.length >= cool ? .75 : 1),
      group: i % 3,                 // 0: every beat, 1: backbeat, 2: eighth notes
      ph: rand(0, Math.PI * 2),
      dx: rand(.01, .035), dy: rand(.01, .03), sp: rand(.05, .14)
    };
  });

  s.tick(time => {
    if (!visible || !W) return;
    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';
    for (const L of lights) {
      let pulse = 0;
      if (!reduce) {
        if (L.group === 0) pulse = beat(time, 1, 0);
        else if (L.group === 1) pulse = beat(time, 2, 1);
        else pulse = beat(time, .5, .25) * .6;
      }
      const textSide = dimRight && !mobile && L.x > .52 ? .5 : 1;
      const a = L.a * textSide * (.62 + .58 * pulse) * (1 + .7 * boost());
      const cx = (L.x + Math.sin(time * L.sp + L.ph) * L.dx) * W;
      const cy = (L.y + Math.cos(time * L.sp * .8 + L.ph) * L.dy) * H;
      const r = L.r * V * (1 + .04 * pulse);
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      const [cr, cg, cb] = L.c;
      if (L.disc) {
        g.addColorStop(0, `rgba(${cr},${cg},${cb},${a})`);
        g.addColorStop(.62, `rgba(${cr},${cg},${cb},${a * .82})`);
        g.addColorStop(.86, `rgba(${cr},${cg},${cb},${a * .3})`);
      } else {
        g.addColorStop(0, `rgba(${cr},${cg},${cb},${a})`);
        g.addColorStop(.4, `rgba(${cr},${cg},${cb},${a * .45})`);
      }
      g.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, 6.2832); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  });
}
