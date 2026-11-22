/* MOMENTS: YouTube shorts on a pinned row; scrolling down pans it sideways (touch screens swipe) */
import { useEffect, useRef } from 'react';
import { gsap, ScrollTrigger } from '../lib/motion';
import { reduce, $, $$ } from '../lib/env';
import { scope } from '../lib/scope';
import { useVideo } from '../components/VideoModal';

const SHORTS = [
  { yt: '2en3jVyg6eg', name: 'לחי עולמים', meta: 'עם דוידי נחשון', title: 'לחי עולמים · עם דוידי נחשון' },
  { yt: 'AWUDlcMMK4g', name: 'אנרגיות שיא', meta: 'עם לוי אוטינסקי', title: 'אנרגיות שיא · עם לוי אוטינסקי' },
  { yt: 'Wp5a3oPxDzk', name: 'שמחת חתן וכלה', meta: 'חתונה בכפר חב״ד', title: 'שמחת חתן וכלה · כפר חב״ד' },
  { yt: 'aIYqIRPpDTY', name: 'היי צמאה', meta: 'עם דוידי נחשון', title: 'היי צמאה · עם דוידי נחשון' },
  { yt: 'nWLEgu0GKjQ', name: 'אמר רבי עקיבא', meta: 'עם יוסף חיים, מתוך חתונה בכפר חב״ד', title: 'אמר רבי עקיבא · עם יוסף חיים' },
  { yt: 'dwYMi8xB1tQ', name: 'ככה מסיימים חתונה', meta: 'עם לוי אוטינסקי', title: 'ככה מסיימים חתונה · עם לוי אוטינסקי' }
];
const CHANNEL_SHORTS = 'https://www.youtube.com/@elazar_bitton_official/shorts';
const ARROW = <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17 7 7 17M7 9.5V17h7.5" /></svg>;

// when a short has no tall thumbnail, YouTube serves a tiny grey placeholder
const fallback = img => { if (!img.dataset.fb) { img.dataset.fb = '1'; img.src = img.src.replace('/oardefault.jpg', '/hq720.jpg'); } };

export default function Moments() {
  const ref = useRef(null);
  const { open } = useVideo();

  useEffect(() => {
    const sec = ref.current;
    const s = scope();
    const pin = $('.moments__pin', sec);
    const track = $('.moments__track', sec);
    const vp = $('.moments__viewport', sec);
    const bar = $('.moments__progress span', sec);
    const imgs = $$('.mcard__media img', sec);
    const sub = $('.moments__sub', sec);
    // With a mouse or trackpad, scrolling pans the row at any window width.
    // Only touch screens (or reduced motion) get a native swipe row instead.
    const panMQ = matchMedia('(min-width: 901px), (hover: hover) and (pointer: fine)');
    const setMode = () => {
      const swipe = reduce || !panMQ.matches;
      sec.classList.toggle('moments--swipe', swipe);
      sub.textContent = swipe ? 'החליקו הצידה לעוד רגעים.' : 'תמשיכו לגלול, והרגעים זזים הצידה.';
    };
    setMode();
    s.on(panMQ, 'change', () => { setMode(); ScrollTrigger.refresh(); });

    const ctx = gsap.context(() => {
      if (!reduce) {
        gsap.from(['.moments__title', '.moments__sub', '.moments__all'], {
          y: 40, opacity: 0, duration: 1.2, ease: 'expo.out', stagger: .08,
          scrollTrigger: { trigger: sec, start: 'top 75%', once: true }
        });
        gsap.from('.mcard', {
          y: 90, opacity: 0, duration: 1.3, ease: 'expo.out', stagger: .07,
          scrollTrigger: { trigger: sec, start: 'top 62%', once: true }
        });
      }
    }, sec);

    const mm = gsap.matchMedia();
    mm.add('(min-width: 901px) and (prefers-reduced-motion: no-preference), (hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)', () => {
      const dist = () => {
        const cs = getComputedStyle(vp);
        return Math.max(0, track.scrollWidth - (vp.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)));
      };
      // each photo drifts inside its frame, opposite to the track, for depth
      const parallax = () => {
        const mid = innerWidth / 2;
        imgs.forEach(img => {
          const r = img.parentElement.getBoundingClientRect();
          const d = gsap.utils.clamp(-.6, .6, (r.left + r.width / 2 - mid) / innerWidth);
          img.style.transform = `translate3d(${(d * -13).toFixed(2)}%,0,0)`;
        });
      };
      gsap.to(track, {
        x: () => dist(), ease: 'none',                       // RTL: the track slides right
        scrollTrigger: {
          trigger: pin, start: 'top top', end: () => '+=' + dist(),
          pin: true, scrub: 1, invalidateOnRefresh: true, anticipatePin: 1,
          onUpdate: self => { bar.style.transform = `scaleX(${self.progress})`; }
        },
        onUpdate: parallax
      });
      parallax();
      return () => imgs.forEach(i => { i.style.transform = ''; });
    });

    return () => { s.dispose(); mm.revert(); ctx.revert(); };
  }, []);

  return (
    <section className="moments" id="moments" aria-label="רגעים מהשמחות" ref={ref}>
      <div className="moments__pin">
        <div className="moments__head">
          <div>
            <h2 className="moments__title">רגעים מהשמחות</h2>
            <p className="moments__sub">תמשיכו לגלול, והרגעים זזים הצידה.</p>
          </div>
          <a className="moments__all" href={CHANNEL_SHORTS} target="_blank" rel="noopener"><span>לכל הסרטונים ביוטיוב</span>{ARROW}</a>
        </div>

        <div className="moments__viewport">
          <div className="moments__track">
            {SHORTS.map(v => (
              <button key={v.yt} className="mcard" type="button" data-cursor="view"
                onClick={e => open({ yt: v.yt, title: v.title, origin: e.currentTarget.querySelector('.mcard__media') })}>
                <span className="mcard__media">
                  <img src={`https://i.ytimg.com/vi/${v.yt}/oardefault.jpg`} alt="" decoding="async"
                    onError={e => fallback(e.currentTarget)}
                    onLoad={e => { if (e.currentTarget.naturalWidth < 200) fallback(e.currentTarget); }} />
                  <span className="mcard__play" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M8 5.5v13l11-6.5z" /></svg></span>
                </span>
                <span className="mcard__name">{v.name}</span>
                <span className="mcard__meta">{v.meta}</span>
              </button>
            ))}
            <a className="mcard mcard--all" href={CHANNEL_SHORTS} target="_blank" rel="noopener" data-cursor="link">
              <span className="mcard__media">
                <svg className="mcard__mic" viewBox="0 0 142 226" aria-hidden="true"><use href="#micArt" /></svg>
                <span className="mcard__all-text">לכל הרגעים<br />ביוטיוב</span>
                <span className="mcard__all-arrow" aria-hidden="true">{ARROW}</span>
              </span>
            </a>
          </div>
        </div>

        <div className="moments__progress" aria-hidden="true"><span /></div>
      </div>
    </section>
  );
}
