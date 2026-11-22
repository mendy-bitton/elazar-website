/* FIRST-VISIT POPUP: an image Elazar sets in /admin (an announcement, an ad).
   Each visitor sees each popup once: not on every refresh. A new popup
   (a new "version", set when he swaps the image) is shown once again. */
import { useEffect, useRef, useState } from 'react';
import { gsap, lockScroll } from '../lib/motion';
import { reduce } from '../lib/env';
import { whenBooted } from '../lib/ui';
import { useContent } from '../lib/content';

const seenKey = v => `elazar:popup:${v}`;
const wasSeen = v => { try { return !!localStorage.getItem(seenKey(v)); } catch { return false; } };
const markSeen = v => { try { localStorage.setItem(seenKey(v), '1'); } catch { /* private mode */ } };

// within the dates he set (either may be empty)
const inWindow = p => {
  const now = Date.now();
  if (p.startsAt && now < new Date(p.startsAt).getTime()) return false;
  if (p.endsAt && now > new Date(p.endsAt).getTime() + 864e5 - 1) return false;   // the end date counts as a whole day
  return true;
};

export default function SitePopup() {
  const { popup } = useContent();
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const cardRef = useRef(null);
  const backRef = useRef(null);
  const closeRef = useRef(null);

  const [readySrc, setReadySrc] = useState('');    // which image is downloaded and decoded (or we stopped waiting for it)
  const [due, setDue] = useState(false);           // the intro is over and the pause after it has passed
  const [loaded, setLoaded] = useState(false);     // the full image is painted over its blurred stand-in
  const [failedSrc, setFailedSrc] = useState('');  // which image didn't load: then no popup at all

  const eligible = popup.enabled && popup.image && inWindow(popup) && !wasSeen(popup.version);
  const framed = !!(popup.width && popup.height);  // saved with its size (and blur), so it can open before the image arrives
  const src = popup.image;
  const ready = !!src && readySrc === src, failed = !!src && failedSrc === src;

  // start downloading the image right away, in the background, while the visitor watches the intro
  useEffect(() => {
    if (!eligible) return;
    let alive = true;
    const img = new Image();
    img.decoding = 'async';
    img.src = src;
    (img.decode ? img.decode() : new Promise((res, rej) => { img.onload = res; img.onerror = rej; }))
      .then(() => { if (alive) setReadySrc(src); }, () => { if (alive) setFailedSrc(src); });
    return () => { alive = false; };
  }, [eligible, src]);

  // it's due after the intro and a short pause; on a very slow connection a framed popup opens anyway
  // 4 seconds later, showing the blurred stand-in until the image arrives
  useEffect(() => {
    if (!eligible) return;
    let t = 0, giveUp = 0;
    const off = whenBooted(() => {
      t = setTimeout(() => { setDue(true); if (framed) giveUp = setTimeout(() => setReadySrc(src), 4000); }, 1600);
    });
    return () => { off(); clearTimeout(t); clearTimeout(giveUp); };
  }, [eligible, framed, src]);

  useEffect(() => { if (due && ready && !failed && eligible) setOpen(true); }, [due, ready, failed, eligible]);

  useEffect(() => {
    if (!open) return;
    markSeen(popup.version);                       // counted as seen once shown, even if the page is refreshed
    lockScroll(true);
    if (!reduce) {
      gsap.fromTo(backRef.current, { opacity: 0 }, { opacity: 1, duration: .5, ease: 'power2.out' });
      gsap.fromTo(cardRef.current, { opacity: 0, y: 26, scale: .94 }, { opacity: 1, y: 0, scale: 1, duration: .9, ease: 'expo.out' });
    }
    closeRef.current && closeRef.current.focus({ preventScroll: true });
    const onKey = e => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function close() {
    const done = () => { setOpen(false); lockScroll(false); };
    if (reduce) { done(); return; }
    gsap.to(cardRef.current, { opacity: 0, y: 14, scale: .96, duration: .3, ease: 'power2.in' });
    gsap.to(backRef.current, { opacity: 0, duration: .35, ease: 'power2.in', onComplete: done });
  }

  if (!open) return null;
  // the frame takes the image's exact proportions before it loads (popups saved with its size);
  // the blurred stand-in fills it, and the real image fades in on top
  const ar = framed ? popup.width / popup.height : 0;
  const media = (
    <span className={`popup__media${ar ? ' has-frame' : ''}${loaded ? ' is-loaded' : ''}`} style={ar ? { '--ar': ar } : undefined}>
      {popup.blur && <span className="popup__blur" style={{ backgroundImage: `url(${popup.blur})` }} aria-hidden="true" />}
      <img className="popup__img" src={popup.image} alt={popup.alt || ''} decoding="async"
        width={popup.width || undefined} height={popup.height || undefined} onLoad={() => setLoaded(true)} />
    </span>
  );
  return (
    <div className="popup" ref={rootRef} role="dialog" aria-modal="true" aria-label={popup.alt || 'הודעה'}
      onClick={e => { if (!e.target.closest('.popup__media, .popup__bar')) close(); }}>
      <div className="popup__backdrop" ref={backRef} data-cursor="link" />
      <div className="popup__card" ref={cardRef}>
        {popup.link ? <a href={popup.link} target="_blank" rel="noopener" onClick={close}>{media}</a> : media}
        <div className="popup__bar">
          {popup.link && (
            <a className="btn btn--gold" href={popup.link} target="_blank" rel="noopener" onClick={close}>
              <span className="btn__label">{popup.linkLabel || 'לפרטים'}</span>
              <span className="btn__icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M17 7 7 17M7 9.5V17h7.5" /></svg></span>
            </a>
          )}
          <button className="modal__close" ref={closeRef} type="button" aria-label="סגירה" onClick={close}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
          </button>
        </div>
      </div>
    </div>
  );
}
