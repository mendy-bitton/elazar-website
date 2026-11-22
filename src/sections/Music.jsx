/* MUSIC: a shelf of album cases. The active one is pulled out and turned to show its cover;
   clicking the cover plays the song in the popup. */
import { useEffect, useMemo, useRef } from 'react';
import { beat, reduce, $ } from '../lib/env';
import { scope } from '../lib/scope';
import { stageLights } from '../lib/stageLights';
import { ui } from '../lib/ui';
import { useVideo } from '../components/VideoModal';
import { useContent } from '../lib/content';
import { DEFAULT_SONGS, songVisual, toSong } from '../lib/videos';

const thumb = id => `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`;
const ARROW = <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17 7 7 17M7 9.5V17h7.5" /></svg>;

export default function Music() {
  const ref = useRef(null);
  const { open } = useVideo();
  const { texts, videos } = useContent();
  // the songs Elazar placed on the shelf, in his order; the built list until the panel takes over
  const songs = useMemo(() => (videos ? videos.music.map(toSong) : DEFAULT_SONGS.map((s, i) => ({ ...s, ...songVisual(s.id, i) }))), [videos]);
  const songsKey = songs.map(s => s.id).join(',');

  useEffect(() => {
    const sec = ref.current;
    if (!sec) return;
    const SONGS = songs, N = songs.length;
    const s = scope();
    const shelf = $('.music__shelf', sec);
    const stage = $('.music__stage', sec);
    const playBtn = $('.music__play', sec);
    const glow = $('.music__glow', sec);
    const masks = [$('.music__name', sec)];
    const idx = $('.music__idx', sec);
    const prevBtn = $('.music__arrow--prev', sec);
    const nextBtn = $('.music__arrow--next', sec);
    stageLights($('.music__lights', sec), s, { count: .85 });

    const cases = [...stage.querySelectorAll('.case')].map(el => ({ el, sp: el.firstElementChild, cv: el.lastElementChild, lift: 0, liftT: 0 }));

    // ---------- geometry, measured from --H ----------
    let H = 0, ws = 0, d = 0, gap = 0;
    const measure = () => {
      const probe = document.createElement('div');
      probe.style.cssText = 'position:absolute;visibility:hidden;width:1px;height:var(--H)';
      sec.appendChild(probe);
      H = probe.getBoundingClientRect().height;
      probe.remove();
      ws = H * (innerWidth <= 900 ? .15 : .12);
      d = H;                                   // square album cover
      gap = H * .035;
      stage.style.setProperty('--h', H + 'px');
      stage.style.setProperty('--ws', ws + 'px');
      stage.style.setProperty('--d', d + 'px');
    };
    measure();
    s.on(window, 'resize', measure);

    // ---------- state ----------
    const START = Math.min(1, N - 1);               // open on the second song (or the only one)
    let sPos = START, T = START, active = -1, dragging = false;
    let tiltX = 0, tiltY = 0, visible = false, inView = false;
    const ptr = { x: 0, y: 0, in: false };
    const clampT = v => Math.min(N - 1, Math.max(0, v));
    const smooth01 = x => x * x * (3 - 2 * x);
    // spines step by their width; the open cover pushes neighbours apart by half its extra width
    const B = r => Math.abs(r) < 1 ? (r + Math.sin(Math.PI * r) / Math.PI) / 2 : Math.sign(r) * .5;

    s.observe(sec, ([e]) => { visible = e.isIntersecting; }, { rootMargin: '100px 0px' });
    s.observe(sec, ([e]) => { inView = e.intersectionRatio > .5; }, { threshold: [0, .5, 1] });

    // ---------- caption: each line rolls through its own mask ----------
    const swapCaption = (i, dir) => {
      const texts = [SONGS[i].he];
      masks.forEach((m, k) => {
        const span = document.createElement('span');
        span.textContent = texts[k];
        m.appendChild(span);
        const old = [...m.children].slice(0, -1);
        if (reduce || active === -1) { old.forEach(o => o.remove()); return; }
        const opts = { duration: 650, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'both' };
        span.animate([{ transform: `translateY(${dir * 105}%)` }, { transform: 'translateY(0)' }], opts);
        old.forEach(o => {
          if (o.dataset.leaving) return;
          o.dataset.leaving = '1';
          const from = getComputedStyle(o).transform;
          o.animate([{ transform: from === 'none' ? 'translateY(0)' : from }, { transform: `translateY(${-dir * 105}%)` }], opts).onfinish = () => o.remove();
        });
      });
      idx.textContent = String(i + 1).padStart(2, '0');
      prevBtn.disabled = i === 0;
      nextBtn.disabled = i === N - 1;
      cases.forEach((c, j) => { c.el.dataset.cursor = j === i ? 'view' : 'mic'; });
    };

    // ---------- every frame ----------
    s.tick((time, dtMs) => {
      if (!visible) return;
      const dt = Math.min(.05, dtMs / 1000);
      const k = reduce ? 60 : dragging ? 12 : 3.2;
      sPos += (T - sPos) * (1 - Math.exp(-k * dt));
      if (Math.abs(T - sPos) < 1e-4) sPos = T;

      const a = Math.min(N - 1, Math.max(0, Math.round(sPos)));
      if (a !== active) { swapCaption(a, Math.sign(T - sPos) || (a > active ? 1 : -1)); active = a; }

      // the open cover leans toward the pointer like a card held in the hand
      const settled = Math.abs(T - sPos) < .3;
      const onCover = ptr.in && !ui.modalOpen && settled && Math.abs(ptr.x) < .55 * d && Math.abs(ptr.y) < .55 * H;
      const ty = !ptr.in || reduce ? 0 : onCover ? (ptr.x / (.55 * d)) * 9 : (ptr.x / innerWidth) * 5;
      const tx = onCover && !reduce ? -(ptr.y / (H / 2)) * 6 : 0;
      const kt = 1 - Math.exp(-7 * dt);
      tiltY += (ty - tiltY) * kt;
      tiltX += (tx - tiltX) * kt;

      const kl = reduce ? 1 : 1 - Math.exp(-12 * dt);
      cases.forEach((c, i) => {
        const r = i - sPos;
        const x = -(r * (ws + gap) + (d - ws + 1.6 * gap) * B(r));      // RTL: later songs to the left
        const o = smooth01(Math.max(0, 1 - Math.abs(r)));
        c.lift += (c.liftT - c.lift) * kl;
        const y = -o * .025 * H - c.lift * .045 * H;
        c.el.style.transform = `translate3d(${x.toFixed(2)}px,${y.toFixed(2)}px,${(o * .16 * H).toFixed(2)}px) rotateZ(${(-3.5 * o).toFixed(3)}deg) rotateX(${(tiltX * o).toFixed(3)}deg) rotateY(${(-90 * o + tiltY * o).toFixed(3)}deg)`;
        c.el.style.zIndex = Math.round(100 - Math.abs(r) * 4);
        c.sp.style.setProperty('--shade', (o * .55).toFixed(3));
        c.cv.style.setProperty('--shade', ((1 - o) * .5).toFixed(3));
      });

      // play button on the cover's lower corner; it pops in once the shelf settles
      const ps = ui.modalOpen ? 0 : smooth01(Math.max(0, 1 - Math.abs(T - sPos) * 3));
      const sr = shelf.getBoundingClientRect(), cr = sec.getBoundingClientRect();
      playBtn.style.left = (sr.left - cr.left + sr.width / 2 - d * .5 + 4) + 'px';
      playBtn.style.top = (sr.top - cr.top + sr.height / 2 + H * .36) + 'px';
      playBtn.style.transform = `translate(-50%,-50%) scale(${ps.toFixed(3)})`;

      glow.style.opacity = reduce ? .7 : (.6 + .18 * beat(time, 1, 0)).toFixed(3);
    });

    // ---------- input ----------
    const go = i => { T = clampT(Math.round(i)); };
    s.on(prevBtn, 'click', () => go(Math.round(T) - 1));
    s.on(nextBtn, 'click', () => go(Math.round(T) + 1));
    const listen = i => open({ yt: SONGS[i].id, title: SONGS[i].he, origin: cases[i].cv, wide: true });
    s.on(playBtn, 'click', () => listen(active));

    let suppressClick = false;
    cases.forEach((c, i) => {
      s.on(c.el, 'pointerenter', () => { if (Math.abs(i - sPos) > .5) c.liftT = 1; });
      s.on(c.el, 'pointerleave', () => { c.liftT = 0; });
      s.on(c.el, 'click', e => {
        if (suppressClick) { e.preventDefault(); suppressClick = false; return; }
        if (Math.abs(i - sPos) < .5) listen(i);
        else go(i);
      });
      s.on(c.el, 'focus', () => { if (!dragging) go(i); });
    });

    s.on(shelf, 'pointermove', e => {
      const r = shelf.getBoundingClientRect();
      ptr.x = e.clientX - (r.left + r.width / 2);
      ptr.y = e.clientY - (r.top + r.height / 2);
      ptr.in = true;
    });
    s.on(shelf, 'pointerleave', () => { ptr.in = false; });

    // drag with a mouse or a finger (touch-action: pan-y keeps vertical scrolling native)
    let down = null;
    s.on(shelf, 'pointerdown', e => { down = { x: e.clientX, T0: T, moved: false }; });
    s.on(window, 'pointermove', e => {
      if (!down) return;
      const dx = e.clientX - down.x;
      if (!down.moved && Math.abs(dx) > 5) { down.moved = true; dragging = true; }
      if (down.moved) T = Math.min(N - .6, Math.max(-.4, down.T0 + dx / (d * .55)));
    }, { passive: true });
    const endDrag = () => {
      if (!down) return;
      if (down.moved) { suppressClick = true; s.timeout(() => { suppressClick = false; }, 60); go(T); }
      down = null; dragging = false;
    };
    s.on(window, 'pointerup', endDrag);
    s.on(window, 'pointercancel', endDrag);

    // a sideways trackpad swipe moves the shelf; vertical scrolling stays with the page
    let wheelTimer = 0;
    s.on(shelf, 'wheel', e => {
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
      e.preventDefault();
      T = Math.min(N - .6, Math.max(-.4, T - Math.max(-30, Math.min(30, e.deltaX)) / (d * 1.4)));
      clearTimeout(wheelTimer);
      wheelTimer = setTimeout(() => go(T), 240);
    }, { passive: false });
    s.add(() => clearTimeout(wheelTimer));

    s.on(document, 'keydown', e => {
      if (!inView || ui.modalOpen || ui.menuOpen) return;
      if (e.key === 'ArrowLeft') { e.preventDefault(); go(Math.round(T) + 1); }
      if (e.key === 'ArrowRight') { e.preventDefault(); go(Math.round(T) - 1); }
    });

    return () => { s.dispose(); masks.forEach(m => m.replaceChildren()); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, songsKey]);

  if (!songs.length) return null;               // nothing on the shelf: the section stays out of the page
  return (
    <section className="music" id="music" aria-label="המוזיקה שלי" ref={ref}>
      <canvas className="music__lights" aria-hidden="true" />
      <div className="music__glow" aria-hidden="true" />

      <div className="music__head">
        <div>
          <h2 className="music__title">{texts.musicTitle}</h2>
          <p className="music__sub">{texts.musicSub}</p>
        </div>
        <a className="moments__all" href="https://www.youtube.com/@elazar_bitton_official/videos" target="_blank" rel="noopener"><span>לכל השירים ביוטיוב</span>{ARROW}</a>
      </div>

      <div className="music__shelf" aria-label="מדף השירים">
        <div className="music__stage">
          {songs.map(song => {
            const img = `url(${thumb(song.id)})`;
            return (
              <button key={song.id} type="button" className="case" aria-label={`${song.he}, ${song.meta}`} data-cursor="mic">
                <span className="face case__sp" style={{ '--tint': song.tint, '--img': img, '--focus': song.focus }}>
                  <span className="case__band" /><span className="case__t">{song.he}</span><span className="case__m">ELAZAR</span>
                </span>
                <span className="face case__cv" style={{ '--img': img, '--focus': song.focus }}>
                  <span className="case__art" /><span className="case__sheen" />
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <button className="music__play" type="button" aria-label="האזנה לשיר" data-cursor="link"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l11-6.5z" /></svg></button>

      <div className="music__cap" aria-live="polite">
        <div className="mask music__name" />
      </div>

      <button className="music__arrow music__arrow--prev" type="button" aria-label="השיר הקודם"><svg viewBox="0 0 18 10" aria-hidden="true"><path d="M13 1l4 4-4 4M17 5H1" /></svg></button>
      <button className="music__arrow music__arrow--next" type="button" aria-label="השיר הבא"><svg viewBox="0 0 18 10" aria-hidden="true"><path d="M5 1L1 5l4 4M1 5h16" /></svg></button>
      <div className="music__count" dir="ltr"><span className="music__idx">01</span> / <span className="music__total">{String(songs.length).padStart(2, '0')}</span></div>
    </section>
  );
}
