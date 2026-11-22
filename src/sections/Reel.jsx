/* FROM THE STAGE (מהבמה): the lit tile wall behind the title, a slow 3D ring of clip
   thumbnails from Cloudinary, and the two doors (weddings / events) below it */
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { reduce, $ } from '../lib/env';
import { scope } from '../lib/scope';
import { stageLights } from '../lib/stageLights';
import { mountTileWall } from '../lib/wall';
import { listClips } from '../lib/cld';
import { useContent } from '../lib/content';

const ARROW = <svg viewBox="0 0 24 24"><path d="M17 7 7 17M7 9.5V17h7.5" /></svg>;
const DOORS = [
  { tag: 'weddings', to: '/weddings', label: 'חתונות' },
  { tag: 'events', to: '/events', label: 'אירועים' }
];

export default function Reel() {
  const ref = useRef(null);
  const [cats, setCats] = useState(null);           // the clips of each door, once Cloudinary answers
  const { texts } = useContent();

  useEffect(() => {
    const sec = ref.current;
    const s = scope();
    let alive = true;
    const ring = $('.reel__ring', sec);
    const head = $('.reel__head', sec);
    const cats = $('.reel__cats', sec);
    const title = $('.reel__title', sec);
    stageLights($('.reel__lights', sec), s, { count: .8 });

    // the lit tile wall behind the title, its light right behind the word
    mountTileWall(sec, $('.reel__wall', sec), s, {
      // the wall reaches a little below the subtitle, then fades out (CSS mask)
      height: () => head.offsetTop + head.offsetHeight + (sec.clientWidth < 900 ? 110 : 170),
      light: () => { const t = title.getBoundingClientRect(); return { x: t.left + t.width / 2, y: t.top + t.height / 2 }; }
    });

    // the cards sit on a cylinder whose centre is the camera (perspective = radius),
    // so every card faces the viewer and the outer ones grow and lift: perspective, not rotation
    const SPEED = 2.2;                                // degrees per second
    let N = 36, STEP = 10, cards = [], R = 0, cull = 40, phase = 0, visible = false;

    function measure() {
      const W = sec.clientWidth, mobile = W < 900;
      const top = head.offsetTop + head.offsetHeight + (mobile ? 28 : 40);
      const floor = cats.offsetTop - (mobile ? 30 : 44);
      // tall enough that the lifted outer cards still clear the heading, never wider than a slice of the screen
      const h = Math.max(120, Math.min((floor - top) / 1.45, W * (mobile ? .34 : .125) * 16 / 9));
      const w = h * 9 / 16;
      R = w / (.86 * STEP * Math.PI / 180);           // cards fill 86% of their slot on the ring
      // centre the whole arc (lifted outer tops down to the front card's foot) in the free space
      const cy = Math.min(floor - h / 2, (top + floor) / 2 + h * .175);
      ring.style.perspective = `${R.toFixed(1)}px`;
      ring.style.perspectiveOrigin = `50% ${(cy + h * .9).toFixed(1)}px`;   // the horizon sits below the cards
      ring.style.setProperty('--w', `${w.toFixed(1)}px`);
      ring.style.setProperty('--h', `${h.toFixed(1)}px`);
      ring.style.setProperty('--cy', `${cy.toFixed(1)}px`);
      // on screen a card lands at R·tan(a); hide the ones past the edge of the screen
      cull = Math.min(60, Math.atan((W / 2 + w * .8) / R) * 180 / Math.PI + 2);
      place();
    }

    function place() {
      for (let i = 0; i < cards.length; i++) {
        const c = cards[i];
        const a = ((i * STEP + phase) % 360 + 540) % 360 - 180;      // signed angle from the front, -180..180
        if (Math.abs(a) > cull) { if (c.on) { c.el.style.visibility = 'hidden'; c.on = false; } continue; }
        if (!c.on) { c.el.style.visibility = 'visible'; c.on = true; }
        const r = a * Math.PI / 180;
        c.el.style.transform = `translate3d(${(R * Math.sin(r)).toFixed(2)}px,0,${(R * (1 - Math.cos(r))).toFixed(2)}px) rotateY(${(-a).toFixed(3)}deg)`;
        // the front card is in the light, the sides fall into the dark
        c.shade.style.opacity = (.7 * Math.pow(Math.abs(a) / cull, 1.4)).toFixed(3);
      }
    }

    Promise.all([listClips('weddings'), listClips('events')]).then(([wed, ev]) => {
      if (!alive) return;
      setCats({ weddings: wed, events: ev });
      // weddings and events take turns around the ring
      const all = [];
      for (let i = 0; i < Math.max(wed.length, ev.length); i++) { wed[i] && all.push(wed[i]); ev[i] && all.push(ev[i]); }
      if (!all.length) return;
      // one card per clip when there are enough of them (so a clip never sits next to its own copy);
      // a short list is repeated whole, so copies stay a full list apart
      N = all.length >= 24 ? Math.min(all.length, 48) : all.length * Math.ceil(24 / all.length);
      STEP = 360 / N;
      cards = Array.from({ length: N }, (_, i) => {
        const el = document.createElement('div');
        el.className = 'reel__card';
        const img = new Image();
        img.alt = ''; img.decoding = 'async';
        img.addEventListener('load', () => el.classList.add('is-in'));
        img.addEventListener('error', () => el.classList.add('is-broken'));
        img.src = all[i % all.length].thumb(480);
        const shade = document.createElement('i');
        shade.className = 'reel__shade';
        el.append(img, shade);
        ring.appendChild(el);
        return { el, shade, on: true };
      });
      measure();
    });
    s.add(() => { alive = false; ring.replaceChildren(); sec.classList.remove('has-wall'); });

    let lastW = 0;
    s.on(window, 'resize', () => { if (sec.clientWidth !== lastW) { lastW = sec.clientWidth; cards.length && measure(); } });
    document.fonts && document.fonts.ready.then(() => alive && cards.length && measure());
    s.observe(sec, ([e]) => { visible = e.isIntersecting; }, { rootMargin: '120px 0px' });

    s.tick((t, dt) => {
      if (!visible || !cards.length || reduce) return;
      phase += SPEED * Math.min(dt, 100) / 1000;    // RTL: the ring turns to the right
      place();
    });

    return () => s.dispose();
  }, []);

  return (
    <section className="reel" id="stage" aria-label="מהבמה" ref={ref}>
      <canvas className="reel__lights" aria-hidden="true" />
      <div className="reel__glow" aria-hidden="true" />
      <canvas className="reel__wall" aria-hidden="true" />
      <div className="reel__head">
        <h2 className="reel__title">{texts.reelTitle}</h2>
        <p className="reel__sub">{texts.reelSub}</p>
      </div>
      <div className="reel__ring" aria-hidden="true" />
      <div className="reel__cats">
        {DOORS.map(d => {
          const clips = cats ? cats[d.tag] : [];
          return (
            <Link key={d.tag} className="btn btn--gold reel__cat" to={d.to}>
              {/* a little fan of this door's own clips; it opens on hover */}
              {clips.length > 0 && (
                <span className="reel__stack" aria-hidden="true">
                  {clips.slice(0, 3).map(c => <img key={c.id} src={c.thumb(480)} alt="" decoding="async" />)}
                </span>
              )}
              <span className="btn__label">{d.label}</span>
              {clips.length > 0 && <span className="reel__count">{clips.length} סרטונים</span>}
              <span className="btn__icon" aria-hidden="true">{ARROW}</span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
