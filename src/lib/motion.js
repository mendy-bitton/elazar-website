/* GSAP, ScrollTrigger and the Lenis smooth scroll, set up once for the whole app */
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { reduce } from './env';

gsap.registerPlugin(ScrollTrigger);
// Safari's address bar grows and shrinks while scrolling on phones; don't re-measure for that
ScrollTrigger.config({ ignoreMobileResize: true });
gsap.config({ nullTargetWarn: false });

let lenis = null;
export function initLenis() {
  if (lenis || reduce) return lenis;
  lenis = new Lenis({ lerp: .085, smoothWheel: true });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add(t => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
  return lenis;
}
export const getLenis = () => lenis;

// glide to a section (or jump, when arriving from another page)
export function goTo(el, { immediate = false } = {}) {
  if (lenis) {
    // after a page change the document height changed; let Lenis re-measure so it doesn't cap the jump
    lenis.resize();
    if (immediate) { lenis.scrollTo(el, { immediate: true, force: true }); return; }   // jumps even while scrolling is held
    lenis.start();
    lenis.scrollTo(el, { duration: 1.6, easing: t => 1 - Math.pow(1 - t, 4) });
  }
  else if (el === 0) window.scrollTo({ top: 0, behavior: immediate || reduce ? 'auto' : 'smooth' });
  else el.scrollIntoView({ behavior: immediate || reduce ? 'auto' : 'smooth' });
}

// freeze / release page scrolling (menu and popup)
export function lockScroll(on) {
  if (lenis) on ? lenis.stop() : lenis.start();
  else document.documentElement.style.overflow = on ? 'hidden' : '';
}

export { gsap, ScrollTrigger };
