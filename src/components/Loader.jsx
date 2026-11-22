/* PRELOADER: a real odometer, every column rolls and carries.
   Shown once, the first time the home page opens. */
import { useEffect, useLayoutEffect, useRef } from 'react';
import { gsap, ScrollTrigger, lockScroll } from '../lib/motion';
import { reduce, $, $$ } from '../lib/env';
import { markBooted } from '../lib/ui';

const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0];

export default function Loader({ onGone }) {
  const ref = useRef(null);

  // hold the page still under the curtain from the very first frame
  useLayoutEffect(() => {
    document.body.classList.add('is-loading');
    lockScroll(true);
  }, []);

  useEffect(() => {
    const L = ref.current;
    let alive = true;
    const finish = () => { document.body.classList.remove('is-loading'); lockScroll(false); markBooted(); };
    if (reduce) { finish(); onGone(); return; }

    const ctx = gsap.context(() => {
      // Each column keeps a running position and only ever rolls forward, so a new step
      // picks up from wherever the previous roll is, with no jumps. Steps are sized so the
      // ones column moves only a few digits per roll: fast, but readable and smooth.
      const cols = $$('.roll', L);                                  // hundreds, tens, ones
      const STEP = 100 / 11;                                        // 0-9 plus a trailing 0
      const state = cols.map(() => ({ p: 0, target: 0 }));
      const place = i => {
        const p = ((state[i].p % 10) + 10) % 10;
        cols[i].style.transform = `translate3d(0,${(-p * STEP).toFixed(3)}%,0)`;
      };
      const rollTo = (n, dur) => {
        String(n).padStart(3, '0').split('').map(Number).forEach((d, i) => {
          const s = state[i];
          const delta = ((d - s.target) % 10 + 10) % 10;
          if (!delta) return;
          s.target += delta;
          gsap.to(s, { p: s.target, duration: dur, ease: 'power3.out', overwrite: true, onUpdate: () => place(i) });
        });
      };
      cols.forEach((_, i) => place(i));

      const logo = $('.loader__logo-in', L);
      gsap.fromTo(logo, { yPercent: 105 }, { yPercent: 0, duration: 1.2, ease: 'expo.out', delay: .1 });

      const STEPS = [12, 26, 39, 53, 66, 78, 89, 97, 100];
      const GAP = .14, ROLL = .42, START = .2;
      STEPS.forEach((n, k) => gsap.delayedCall(START + k * GAP, () => rollTo(n, ROLL)));
      const countDone = (START + (STEPS.length - 1) * GAP + ROLL) * 1000;   // about 1.7s

      const imgs = ['/assets/silhouette.svg', '/assets/logo.svg'].map(src => { const i = new Image(); i.src = src; return i.decode().catch(() => {}); });
      const ready = Promise.all([...imgs, document.fonts ? document.fonts.ready : 1]);
      Promise.all([
        Promise.race([ready, new Promise(r => setTimeout(r, 2500))]),   // never hold the page for long
        new Promise(r => setTimeout(r, countDone + 120))
      ]).then(() => { if (alive) ctx.add(exit); });

      function exit() {
        gsap.timeline({ onComplete: () => { ScrollTrigger.refresh(); onGone(); } })
          .to(logo, { yPercent: -105, duration: .85, ease: 'expo.in' }, .15)
          .to([$('.loader__count', L), $('.loader__glow', L)], { opacity: 0, duration: .45 }, .2)
          .to($$('.loader__strips i', L), { scaleX: 0, duration: 1.05, ease: 'expo.inOut', stagger: { each: .05, from: 'start' } }, .75)
          .add(finish, 1);
      }
    }, L);

    return () => { alive = false; ctx.revert(); };
  }, [onGone]);

  return (
    <div className="loader" ref={ref} aria-hidden="true">
      <div className="loader__strips">{Array.from({ length: 12 }, (_, i) => <i key={i} />)}</div>
      <div className="loader__glow" />
      <div className="loader__logo"><span className="loader__logo-in logo-mark" /></div>
      <div className="loader__count" dir="ltr">
        {[0, 1, 2].map(c => (
          <span className="digit" key={c}><span className="roll">{DIGITS.map((d, i) => <b key={i}>{d}</b>)}</span></span>
        ))}
      </div>
    </div>
  );
}
