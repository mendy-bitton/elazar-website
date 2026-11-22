/* HERO: the silhouette against the stage lights, the headline with its microphone,
   and the intro that plays as the loader's curtain lifts */
import { useEffect, useRef } from 'react';
import { gsap } from '../lib/motion';
import { reduce, fine, beat, $, $$ } from '../lib/env';
import { scope } from '../lib/scope';
import { stageLights } from '../lib/stageLights';
import { whenBooted } from '../lib/ui';

export default function Hero() {
  const ref = useRef(null);

  useEffect(() => {
    const hero = ref.current;
    const s = scope();
    let stageBoost = 0;                          // rises while the mic is hovered

    const ctx = gsap.context(() => {
      const light = $('.hero__light', hero);
      const glow = $('.hero__glow', hero);

      if (fine && !reduce) {
        // the spotlight leans toward the pointer, slowly
        const lx = gsap.quickTo(light, 'x', { duration: 2.4, ease: 'power3' });
        const ly = gsap.quickTo(light, 'y', { duration: 2.4, ease: 'power3' });
        // a soft light trails the cursor on the backdrop; it sits behind the silhouette
        const gx = gsap.quickTo(glow, 'x', { duration: 1.1, ease: 'power3' });
        const gy = gsap.quickTo(glow, 'y', { duration: 1.1, ease: 'power3' });
        let glowOn = false;
        s.on(hero, 'pointermove', e => {
          const r = hero.getBoundingClientRect();
          const x = e.clientX - r.left, y = e.clientY - r.top;
          lx((x / r.width - .5) * innerWidth * .12);
          ly((y / r.height - .5) * innerHeight * .1);
          if (!glowOn) { gsap.set(glow, { x, y }); gsap.to(glow, { opacity: 1, duration: .8, ease: 'power2.out' }); glowOn = true; }
          gx(x); gy(y);
        });
        s.on(hero, 'pointerleave', () => {
          lx(0); ly(0);
          gsap.to(glow, { opacity: 0, duration: .8, ease: 'power2.out' });
          glowOn = false;
        });
      }

      stageLights($('.hero__stage', hero), s, { boost: () => stageBoost, dimRight: true });

      /* ---------- the microphone in the headline ---------- */
      const mic = $('.mic', hero);
      const micBody = $('.mic__body', mic);
      const micWaves = $$('.mic__waves path', mic);
      const micLevel = $('.mic__level', mic);
      const micState = { level: 0, hover: false };
      gsap.set(micBody, { svgOrigin: '61 226' });             // pivot at the handle
      gsap.set(micWaves, { opacity: 0, scale: .6, svgOrigin: '4 72' });         // waves leave from the outer side
      // a light sweep across the mic every few seconds
      if (!reduce) gsap.fromTo('#micSheen', { attr: { x1: -260, x2: -120 } }, { attr: { x1: 260, x2: 400 }, duration: 1.7, ease: 'power2.inOut', repeat: -1, repeatDelay: 4.6, delay: 3.4 });
      let shownLevel = -1;
      // the light inside the mic fills from the handle up
      const drawLevel = () => {
        const l = Math.round(micState.level * 1000) / 1000;
        if (l === shownLevel) return;
        shownLevel = l;
        micLevel.setAttribute('y', (226 - l * 250).toFixed(1));
      };
      drawLevel();

      if (!reduce) {
        s.tick(time => {
          if (micState.hover) {
            const k = beat(time, 1, 0);
            micState.level += ((.22 + .7 * k) - micState.level) * .35;
            micWaves.forEach((w, i) => gsap.set(w, { opacity: .35 + .65 * beat(time, 1, i * .12), scale: .92 + .14 * beat(time, 1, i * .12) }));
          }
          stageBoost += ((micState.hover ? 1 : 0) - stageBoost) * .05;
          drawLevel();
        });
        s.on(mic, 'pointerenter', () => {
          micState.hover = true;
          gsap.to(micBody, { rotation: -9, duration: 1.3, ease: 'elastic.out(1,.32)' });
        });
        s.on(mic, 'pointerleave', () => {
          micState.hover = false;
          gsap.to(micBody, { rotation: 0, duration: 1.1, ease: 'elastic.out(1,.4)' });
          gsap.to(micWaves, { opacity: 0, scale: .6, duration: .45, ease: 'power2.in' });
          gsap.to(micState, { level: 0, duration: .6, ease: 'power2.out' });
        });
      }

      /* ---------- intro, built paused so its start state sits under the loader ---------- */
      const intro = gsap.timeline({ paused: true, defaults: { ease: 'expo.out' } });
      if (!reduce) {
        intro
          .fromTo('.hero__bg', { scale: 1.08 }, { scale: 1, duration: 2.4 }, 0)
          .fromTo('.hero__stage', { opacity: 0 }, { opacity: 1, duration: 2.2, ease: 'power2.out' }, .1)
          .fromTo(light, { opacity: 0, scale: .6 }, { opacity: () => parseFloat(getComputedStyle(light).getPropertyValue('--light-o')) || .9, scale: 1, duration: 2.6, ease: 'power3.out' }, 0)
          .fromTo('.hero__figure img', { opacity: 0, yPercent: 6 }, { opacity: 1, yPercent: 0, duration: 1.9 }, .15)
          .fromTo('.hero__title .line__in',
            { yPercent: 40, opacity: 0, filter: 'blur(14px)', textShadow: '0 0 .5em rgba(255,214,150,.9)' },
            { yPercent: 0, opacity: 1, filter: 'blur(0px)', textShadow: '0 0 0em rgba(255,214,150,0)', duration: 1.5, stagger: .12 }, .3)
          .fromTo(mic, { opacity: 0, scale: .3, rotation: -30, transformOrigin: '50% 90%' }, { opacity: 1, scale: 1, rotation: 0, duration: 1.4, ease: 'elastic.out(1,.5)' }, .85)
          .to(micState, { level: 1, duration: .55, ease: 'power2.in' }, 1.35)
          .to(micState, { level: 0, duration: .8, ease: 'power2.out' }, 1.95)
          .fromTo(['.hero__lead p', '.hero__ctas'], { y: 26, opacity: 0 }, { y: 0, opacity: 1, duration: 1.3, stagger: .08 }, .65)
          .fromTo($$('.nav__brand, .nav__actions > *'), { y: -22, opacity: 0 }, { y: 0, opacity: 1, duration: 1.2, stagger: .06 }, .6)
          .fromTo('.hero__scroll', { opacity: 0 }, { opacity: .78, duration: 1.4 }, 1.3);

        // scroll: the stage drifts up, the figure sinks a little, the copy lifts away
        gsap.timeline({ scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true } })
          .to('.hero__bg', { yPercent: -14, ease: 'none' }, 0)
          .to('.hero__figure', { yPercent: 8, ease: 'none' }, 0)
          .to('.hero__content', { yPercent: -16, opacity: 0, ease: 'none' }, 0);
      }
      s.add(whenBooted(() => intro.play()));
    }, hero);

    return () => { s.dispose(); ctx.revert(); };
  }, []);

  return (
    <section className="hero" id="top" ref={ref}>
      <div className="hero__bg" />
      <canvas className="hero__stage" aria-hidden="true" />
      <div className="hero__light" />
      <div className="hero__glow" aria-hidden="true" />
      <div className="hero__figure">
        <img src="/assets/silhouette.svg" alt="הצללית של אלעזר ביטון" width="501" height="664" />
      </div>

      <div className="hero__content">
        <h1 className="hero__title" data-cursor="text">
          <span className="line"><span className="line__in">עם כל הלב,</span></span>
          <span className="line"><span className="line__in">לשמחה שלכם <Mic /></span></span>
        </h1>
        <div className="hero__lead">
          <p>אני אלעזר ביטון, זמר חתונות ואירועים בסגנון חב״די וחסידי. אני מאמין שכל שמחה צריכה נשמה, ולכן אני מגיע לכל אירוע עם כל הלב.</p>
          <p>מניגוני הקבלת פנים והחופה המרגשים ועד ריקודים סוערים שלא נגמרים, אני בונה את הערב יחד אתכם, לפי הקהל, האווירה והרגע.</p>
        </div>
        <div className="hero__ctas">
          <a className="btn btn--gold" href="#contact"><span className="btn__label">בואו נדבר</span><span className="btn__icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M17 7 7 17M7 9.5V17h7.5" /></svg></span></a>
          <a className="btn btn--line" href="#music"><span className="btn__label">המוזיקה שלי</span></a>
        </div>
      </div>

      <a className="hero__scroll" href="#events"><span>גללו לגלות</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14m-5-5 5 5 5-5" /></svg></a>
    </section>
  );
}

/* the golden mic after "שלכם": a light fills it from the handle, waves pulse on hover */
function Mic() {
  return (
    <span className="mic" data-cursor="mic" aria-hidden="true">
      <svg viewBox="-58 -10 210 246" focusable="false">
        <defs>
          <clipPath id="micLevel"><rect className="mic__level" x="-60" y="226" width="220" height="250" /></clipPath>
          <linearGradient id="micSheen" gradientUnits="userSpaceOnUse" x1="-260" y1="0" x2="-120" y2="80">
            <stop offset="0" stopColor="#fff6dc" stopOpacity="0" />
            <stop offset=".5" stopColor="#fff6dc" stopOpacity=".85" />
            <stop offset="1" stopColor="#fff6dc" stopOpacity="0" />
          </linearGradient>
        </defs>
        <g className="mic__waves" fill="none" stroke="url(#goldGrad)" strokeWidth="8" strokeLinecap="round">
          <path d="M-8 46c-11 13-11 37 0 50" />
          <path d="M-26 30c-20 22-20 60 0 82" />
        </g>
        <g className="mic__body">
          <use href="#micArt" x="0" y="0" width="142" height="226" fill="url(#goldGrad)" />
          <use href="#micArt" x="0" y="0" width="142" height="226" fill="url(#micSheen)" />
          <use href="#micArt" x="0" y="0" width="142" height="226" className="mic__glow" clipPath="url(#micLevel)" />
        </g>
      </svg>
    </span>
  );
}
