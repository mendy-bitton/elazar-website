/* A bag of things to undo when a component leaves the page:
   listeners, GSAP ticker callbacks, observers and timers.
   Every section's effect creates one and calls dispose() in its cleanup,
   so moving between pages never leaves anything running behind. */
import { gsap } from './motion';

export function scope() {
  const undo = [];
  return {
    on(target, type, fn, opts) {
      target.addEventListener(type, fn, opts);
      undo.push(() => target.removeEventListener(type, fn, opts));
    },
    tick(fn) {
      gsap.ticker.add(fn);
      undo.push(() => gsap.ticker.remove(fn));
    },
    observe(el, cb, opts) {
      const io = new IntersectionObserver(cb, opts);
      io.observe(el);
      undo.push(() => io.disconnect());
      return io;
    },
    timeout(fn, ms) {
      const id = setTimeout(fn, ms);
      undo.push(() => clearTimeout(id));
      return id;
    },
    add(fn) { undo.push(fn); },
    dispose() { undo.splice(0).reverse().forEach(f => f()); }
  };
}
