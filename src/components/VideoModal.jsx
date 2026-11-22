/* VIDEO POPUP: one player for the whole site. It grows out of the card that was clicked.
   open({ yt, title, origin, wide })            a YouTube video (moments, music shelf)
   open({ clip, title, origin })                a Cloudinary clip (gallery pages)
   Any click outside the video itself closes it (the blur, the title row, the X). */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef } from 'react';
import { gsap, lockScroll } from '../lib/motion';
import { reduce } from '../lib/env';
import { ui } from '../lib/ui';
import { resetCursor } from './Cursor';

const VideoContext = createContext({ open: () => {} });
export const useVideo = () => useContext(VideoContext);

export function VideoProvider({ children }) {
  const modalRef = useRef(null);
  const boxRef = useRef(null);
  const backRef = useRef(null);
  const playerRef = useRef(null);
  const titleRef = useRef(null);
  const closeRef = useRef(null);
  const lastFocus = useRef(null);

  const open = useCallback(({ yt, clip, title = '', origin = null, wide = false }) => {
    if (ui.modalOpen) return;
    if (yt && !/^[\w-]{11}$/.test(yt)) return;
    if (!yt && !clip) return;
    const modal = modalRef.current, box = boxRef.current, back = backRef.current, player = playerRef.current;
    ui.modalOpen = true;
    lastFocus.current = document.activeElement;
    titleRef.current.textContent = title;
    modal.classList.toggle('is-wide', wide);

    if (yt) {
      const f = document.createElement('iframe');
      f.src = `https://www.youtube-nocookie.com/embed/${yt}?autoplay=1&playsinline=1&rel=0&modestbranding=1`;
      f.title = title || 'YouTube';
      f.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
      f.allowFullscreen = true;
      f.referrerPolicy = 'strict-origin-when-cross-origin';
      player.replaceChildren(f);
    } else {
      const v = document.createElement('video');
      v.controls = true; v.autoplay = true; v.playsInline = true; v.preload = 'auto';
      v.setAttribute('playsinline', '');
      v.poster = clip.thumb(720);
      const mp4 = document.createElement('source');
      mp4.src = clip.src; mp4.type = 'video/mp4';
      const orig = document.createElement('source');               // if Cloudinary hasn't made the 720p copy yet
      orig.src = clip.orig;
      v.append(mp4, orig);
      player.replaceChildren(v);
      const p = v.play && v.play();
      p && p.catch && p.catch(() => {});
    }

    modal.hidden = false;
    lockScroll(true);
    resetCursor();
    if (!reduce) {
      gsap.fromTo(back, { opacity: 0 }, { opacity: 1, duration: .5, ease: 'power2.out' });
      const to = box.getBoundingClientRect();
      const from = origin && origin.getBoundingClientRect ? origin.getBoundingClientRect() : null;
      if (from && from.width > 4) {
        gsap.fromTo(box,
          { x: (from.left + from.width / 2) - (to.left + to.width / 2), y: (from.top + from.height / 2) - (to.top + to.height / 2), scale: Math.min(from.width / to.width, from.height / to.height), opacity: .5 },
          { x: 0, y: 0, scale: 1, opacity: 1, duration: .9, ease: 'expo.out' });
      } else {
        gsap.fromTo(box, { scale: .92, opacity: 0 }, { scale: 1, opacity: 1, duration: .7, ease: 'expo.out' });
      }
    }
    closeRef.current.focus({ preventScroll: true });
  }, []);

  const close = useCallback(() => {
    if (!ui.modalOpen) return;
    ui.modalOpen = false;
    const modal = modalRef.current, box = boxRef.current, back = backRef.current;
    const done = () => {
      modal.hidden = true;
      playerRef.current.replaceChildren();                       // stops playback
      lockScroll(false);
      const f = lastFocus.current;
      f && f.focus && f.focus({ preventScroll: true });
    };
    if (reduce) { done(); return; }
    gsap.to(box, { scale: .94, opacity: 0, duration: .35, ease: 'power2.in' });
    gsap.to(back, { opacity: 0, duration: .4, ease: 'power2.in', onComplete: done });
  }, []);

  useEffect(() => {
    const onKey = e => {
      if (!ui.modalOpen) return;
      if (e.key === 'Escape') close();
      // keep the keyboard inside the popup: the X, and a gallery clip's own controls
      if (e.key === 'Tab') {
        e.preventDefault();
        const v = playerRef.current.querySelector('video');
        (document.activeElement === closeRef.current && v ? v : closeRef.current).focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [close]);

  const value = useMemo(() => ({ open, close }), [open, close]);

  return (
    <VideoContext.Provider value={value}>
      {children}
      <div className="modal" ref={modalRef} role="dialog" aria-modal="true" aria-label="נגן וידאו" hidden
        onClick={e => { if (!e.target.closest('.modal__frame')) close(); }}>
        <div className="modal__backdrop" ref={backRef} data-close data-cursor="link" />
        <div className="modal__box" ref={boxRef}>
          <div className="modal__frame"><div className="modal__player" ref={playerRef} /></div>
          <div className="modal__bar">
            <p className="modal__title" ref={titleRef} />
            <button className="modal__close" ref={closeRef} type="button" data-close aria-label="סגירה">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
            </button>
          </div>
        </div>
      </div>
    </VideoContext.Provider>
  );
}
