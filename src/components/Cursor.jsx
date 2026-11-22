/* CURSOR: transform-only, eased every frame. Its look follows data-cursor on what's under it
   (link, text, mic, view), or "link" for any link or button. */
import { useEffect, useRef } from 'react';
import { reduce, fine } from '../lib/env';
import { scope } from '../lib/scope';

export default function Cursor() {
  const ref = useRef(null);

  useEffect(() => {
    const cursor = ref.current;
    if (!fine || reduce || !cursor) return;
    const root = document.documentElement;
    const s = scope();
    root.classList.add('has-cursor');
    s.add(() => root.classList.remove('has-cursor'));

    const pointer = { x: innerWidth / 2, y: innerHeight / 2, seen: false };
    const cur = { x: pointer.x, y: pointer.y };
    s.on(window, 'pointermove', e => {
      pointer.x = e.clientX; pointer.y = e.clientY;
      if (!pointer.seen) { pointer.seen = true; cur.x = pointer.x; cur.y = pointer.y; }
    }, { passive: true });
    // frame-rate independent smoothing
    s.tick((t, dt) => {
      const k = 1 - Math.pow(1 - .28, dt / 16.67);
      cur.x += (pointer.x - cur.x) * k;
      cur.y += (pointer.y - cur.y) * k;
      cursor.style.transform = `translate3d(${cur.x.toFixed(2)}px,${cur.y.toFixed(2)}px,0)`;
    });
    s.on(document, 'pointerover', e => {
      const t = e.target.closest('[data-cursor], a, button');
      const st = t ? (t.dataset.cursor || 'link') : '';
      cursor.classList.remove('is-link', 'is-text', 'is-mic', 'is-view');
      if (st) cursor.classList.add('is-' + st);
    });
    s.on(root, 'mouseleave', () => cursor.classList.add('is-gone'));
    s.on(root, 'mouseenter', () => cursor.classList.remove('is-gone'));
    return () => s.dispose();
  }, []);

  return (
    <div className="cursor" ref={ref} aria-hidden="true">
      <div className="cursor__dot" />
      <span className="cursor__play"><svg viewBox="0 0 24 24"><path d="M8 5.5v13l11-6.5z" /></svg></span>
    </div>
  );
}

// the popup clears the cursor's state when it opens over whatever was under the pointer
export function resetCursor() {
  const c = document.querySelector('.cursor');
  c && c.classList.remove('is-view', 'is-link', 'is-text', 'is-mic');
}
