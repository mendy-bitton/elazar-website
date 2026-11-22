/* TILE WALL mount: dark glossy tiles lit from behind (tilewall.js, three.js),
   loaded as its own chunk when the section is near. Behind the "מהבמה" title.
   light(): the light's position on screen; height(): the canvas height, if not set by CSS
   s: the owner's cleanup scope (see scope.js) */
import { reduce, fine } from './env';

const COLORS = { accent: '#e8ad4c', hot: '#fff0cc', deep: '#7a4810', tile: '#16110b', page: '#060709' };

export function mountTileWall(sec, cv, s, { light, height = null }) {
  if (!cv || !window.WebGLRenderingContext) return;
  let wall = null, loading = false, inView = false, gone = false;
  s.add(() => { gone = true; wall && wall.dispose(); wall = null; });

  const frame = () => {
    if (!wall) return;
    if (height) cv.style.height = `${Math.round(height())}px`;
    const c = cv.getBoundingClientRect(), p = light();
    wall.setFrame({
      width: cv.clientWidth, height: cv.clientHeight, lightX: p.x - c.left, lightY: p.y - c.top,
      unitPx: Math.max(46, Math.min(68, sec.clientWidth / 21))
    });
  };

  const load = () => {
    if (loading) return;
    loading = true;
    import('./tilewall.js')
      .then(({ createTileWall }) => {
        if (gone) return null;
        wall = createTileWall(cv, COLORS, { pixelRatio: Math.min(devicePixelRatio, fine ? 2 : 1.5) });
        frame();
        return wall.warmUp();
      })
      .then(() => {
        if (gone || !wall) return;
        sec.classList.add('has-wall');
        if (inView && !reduce) s.timeout(() => wall && wall.ripple(), 250);
      })
      .catch(() => {});                                 // no WebGL / offline: the page reads fine without it
  };
  s.observe(sec, ([e]) => { if (e.isIntersecting) load(); }, { rootMargin: '700px 0px' });

  // a wave runs out from the light each time the section comes back into view
  s.observe(sec, ([e]) => {
    const now = e.intersectionRatio > .35;
    if (now && !inView && wall && !reduce) wall.ripple();
    inView = now;
  }, { threshold: [0, .35] });

  let lastW = 0;
  s.on(window, 'resize', () => { if (sec.clientWidth !== lastW) { lastW = sec.clientWidth; frame(); } });
  document.fonts && document.fonts.ready.then(() => { if (!gone) frame(); });

  // with a mouse, the tiles under the pointer rise and lean away from it
  if (fine && !reduce) {
    let px = -1, py = -1;
    const aim = () => {
      if (!wall) return;
      const r = cv.getBoundingClientRect();
      const inside = px >= r.left && px <= r.right && py >= r.top && py <= r.bottom;
      wall.setPointer(inside ? { x: (px - r.left) / r.width * 2 - 1, y: -((py - r.top) / r.height) * 2 + 1 } : null);
    };
    s.on(window, 'pointermove', e => { px = e.clientX; py = e.clientY; aim(); }, { passive: true });
    s.on(window, 'scroll', aim, { passive: true });           // the wall moves under a still mouse
    s.on(document, 'pointerleave', () => wall && wall.setPointer(null));
  }
}
