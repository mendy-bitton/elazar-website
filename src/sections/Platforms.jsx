/* PLATFORMS: a running band of gold logos that stops on hover and turns to brand colour */
import { useEffect, useRef } from 'react';
import { reduce, fine, $ } from '../lib/env';
import { scope } from '../lib/scope';

const ICON = name => `url(https://cdn.jsdelivr.net/npm/simple-icons@14.0.0/icons/${name}.svg)`;
const PLATFORMS = [
  { name: 'Spotify', label: 'אלעזר ביטון בספוטיפיי', href: 'https://open.spotify.com/artist/2LZGaMKUowuTEnlYC4bAVT', brand: '#1ED760', icon: 'spotify' },
  { name: 'Apple Music', label: 'אלעזר ביטון באפל מיוזיק', href: 'https://music.apple.com/il/artist/%D7%90%D7%9C%D7%A2%D7%96%D7%A8-%D7%91%D7%99%D7%98%D7%95%D7%9F/6773778760', brand: '#FA243C', icon: 'applemusic' },
  { name: 'YouTube', label: 'אלעזר ביטון ביוטיוב', href: 'https://www.youtube.com/@elazar_bitton_official', brand: '#FF0033', icon: 'youtube' },
  { name: 'YouTube Music', label: 'אלעזר ביטון ביוטיוב מיוזיק', href: 'https://music.youtube.com/channel/UC0X36fnilo2jdZ8hl9tegNw', brand: '#FF0033', icon: 'youtubemusic' }
];

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
      <p className="platforms__title">להאזנה בכל פלטפורמות המוזיקה</p>
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
