/* PLATFORMS: a running band of gold logos that stops on hover and turns to brand colour */
import { useEffect, useRef } from 'react';
import { reduce, fine, $ } from '../lib/env';
import { scope } from '../lib/scope';
import { PLATFORMS } from '../lib/platforms';

const ICON = name => `url(https://cdn.jsdelivr.net/npm/simple-icons@14.0.0/icons/${name}.svg)`;

export default function Platforms() {
  const ref = useRef(null);

  useEffect(() => {
    if (reduce) return;
    const sec = ref.current;
    const s = scope();
    const viewport = $('.platforms__viewport', sec);
    const track = $('.platforms__track', sec);
    const group = $('.platforms__group', sec);
    const base = [...group.children];
    const added = [];
    const quiet = li => {
      li.setAttribute('aria-hidden', 'true');
      li.querySelectorAll('a').forEach(a => { a.tabIndex = -1; });
      return li;
    };
    // repeat the four logos until one group is wider than the screen, then double it for a seamless loop
    let guard = 0;
    while (group.scrollWidth < innerWidth * 1.15 && guard++ < 8) base.forEach(li => { const c = quiet(li.cloneNode(true)); group.appendChild(c); added.push(c); });
    const twin = group.cloneNode(true);
    twin.setAttribute('aria-hidden', 'true');
    [...twin.children].forEach(quiet);
    track.appendChild(twin);
    added.push(twin);
    s.add(() => { added.forEach(n => n.remove()); track.style.transform = ''; });

    let W = group.offsetWidth, x = 0, speed = 1, target = 1, visible = false;
    const remeasure = () => { W = group.offsetWidth; };
    s.on(window, 'resize', remeasure);
    document.fonts && document.fonts.ready.then(remeasure);
    s.observe(sec, ([e]) => { visible = e.isIntersecting; });

    // hovering (or tabbing into) the band slows it to a stop; leaving lets it roll again
    if (fine) {
      s.on(viewport, 'pointerenter', () => { target = 0; });
      s.on(viewport, 'pointerleave', () => { target = 1; });
    }
    s.on(viewport, 'focusin', () => { target = 0; });
    s.on(viewport, 'focusout', () => { target = 1; });

    s.tick((t, dt) => {
      if (!visible || !W) return;
      speed += (target - speed) * (1 - Math.exp(-dt / 1000 * 7));
      x = (((x + speed * dt * .05) % W) + W) % W;               // RTL: the band drifts to the right
      track.style.transform = `translate3d(${x.toFixed(2)}px,0,0)`;
    });
    return () => s.dispose();
  }, []);

  return (
    <section className="platforms" aria-label="להאזנה בכל פלטפורמות המוזיקה" ref={ref}>
      <h2 className="platforms__title">להאזנה בכל פלטפורמות המוזיקה</h2>
      <div className="platforms__viewport">
        <div className="platforms__track">
          <ul className="platforms__group">
            {PLATFORMS.map(p => (
              <li key={p.name}>
                <a className="plat" href={p.href} target="_blank" rel="noopener" data-cursor="mic" aria-label={p.label}
                  style={{ '--brand': p.brand, '--icon': ICON(p.icon) }}>
                  <span className="plat__icon" aria-hidden="true" /><span className="plat__name">{p.name}</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
