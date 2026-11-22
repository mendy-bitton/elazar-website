/* EVENTS STRIP: the event types roll past; speed and direction follow the scroll */
import { Fragment, useEffect, useRef } from 'react';
import { gsap, getLenis } from '../lib/motion';
import { reduce, $ } from '../lib/env';
import { scope } from '../lib/scope';

const TYPES = [['אירועים', ''], ['בר מצוות', 'o'], ['חתונות', ''], ['התוועדויות', 'o'], ['שמחות בית השואבה', ''], ['שבע ברכות', 'o']];

function Group({ hidden }) {
  return (
    <div className="events__group" aria-hidden={hidden || undefined}>
      {TYPES.map(([t, o]) => (
        <Fragment key={t}>
          <span className={o || undefined}>{t}</span>
          <svg className="sep" viewBox="0 0 142 226" aria-hidden="true"><use href="#micArt" /></svg>
        </Fragment>
      ))}
    </div>
  );
}

export default function EventsStrip() {
  const ref = useRef(null);

  useEffect(() => {
    if (reduce) return;
    const track = $('.events__track', ref.current);
    const group = $('.events__group', ref.current);
    const s = scope();
    let W = group.offsetWidth, x = 0, dir = 1, speed = 1, skew = 0, visible = true;
    s.on(window, 'resize', () => { W = group.offsetWidth; });
    document.fonts && document.fonts.ready.then(() => { W = group.offsetWidth; });
    s.observe(track, ([e]) => { visible = e.isIntersecting; });
    s.tick((t, dt) => {
      if (!visible || !W) return;
      const lenis = getLenis();
      const v = lenis ? lenis.velocity : 0;
      if (Math.abs(v) > .3) dir = v > 0 ? 1 : -1;
      speed += ((1 + Math.min(Math.abs(v) * .35, 14)) - speed) * .08;
      skew += (gsap.utils.clamp(-10, 10, -v * .5) - skew) * .12;
      x = (((x + dir * speed * dt * .055) % W) + W) % W;
      track.style.transform = `translate3d(${x}px,0,0) skewX(${skew.toFixed(2)}deg)`;
    });
    return () => s.dispose();
  }, []);

  return (
    <section className="events" id="events" aria-label="סוגי אירועים" ref={ref}>
      <div className="events__track">
        <Group />
        <Group hidden />
      </div>
    </section>
  );
}
