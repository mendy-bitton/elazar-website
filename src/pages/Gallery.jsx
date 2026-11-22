/* GALLERY PAGES (/weddings, /events): every clip for one Cloudinary tag, played in the popup */
import { useEffect, useMemo, useRef, useState } from 'react';
import { goTo } from '../lib/motion';
import { reduce } from '../lib/env';
import { listClips } from '../lib/cld';
import { SubNav } from '../components/Nav';
import { useVideo } from '../components/VideoModal';
import { useContent } from '../lib/content';
import { toClip } from '../lib/videos';
import { track } from '../lib/analytics';

const PLAY = <span className="clip__play" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M8 5.5v13l11-6.5z" /></svg></span>;

export default function Gallery({ tag, title, kind = '' }) {
  const { open } = useVideo();
  const { videos } = useContent();
  const [fetched, setFetched] = useState(null);             // straight from Cloudinary, until the panel takes over
  // the clips Elazar approved for this page, in his order; before the panel, everything tagged
  const items = useMemo(() => (videos ? (videos[tag] || []).map(toClip) : fetched), [videos, tag, fetched]);
  const gridRef = useRef(null);

  useEffect(() => {
    document.body.classList.add('subpage');
    goTo(0, { immediate: true });
    return () => document.body.classList.remove('subpage');
    // again when moving between the galleries (the same page, another title)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title]);

  useEffect(() => {
    if (videos) return;
    let alive = true;
    setFetched(null);
    listClips(tag).then(list => { if (alive) setFetched(list); });
    return () => { alive = false; };
  }, [tag, videos]);

  // cards rise in row by row, each row in reading order
  useEffect(() => {
    if (!items || !items.length) return;
    const grid = gridRef.current;
    const lis = [...grid.children];
    const cols = Math.max(1, getComputedStyle(grid).gridTemplateColumns.split(' ').length);
    lis.forEach((li, i) => { li.style.transitionDelay = `${(i % cols) * 70}ms`; });
    if (reduce || !('IntersectionObserver' in window)) { lis.forEach(li => li.classList.add('is-in')); return; }
    const io = new IntersectionObserver(entries => entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
    }), { rootMargin: '0px 0px -8% 0px' });
    lis.forEach(li => io.observe(li));
    return () => io.disconnect();
  }, [items]);

  return (
    <>
      <SubNav />
      <main className="gallery">
        <header className="gallery__head">
          <div>
            <p className="gallery__kicker">מהבמה</p>
            <h1 className="gallery__title">{title}<span className="sr-only"> עם אלעזר ביטון</span></h1>
          </div>
          <p className="gallery__count" aria-live="polite">{items && items.length ? `${items.length} סרטונים` : ''}</p>
        </header>

        <ul className="gallery__grid" ref={gridRef} aria-label={`סרטונים מ${title}`}>
          {items === null
            ? Array.from({ length: 8 }, (_, i) => (
              <li key={i} className="clip-item clip-item--ghost" aria-hidden="true">
                <span className="clip__media" /><span className="clip__cap"><span className="ghost-line" /><span className="ghost-line ghost-line--short" /></span>
              </li>
            ))
            : items.map(it => {
              // "חתונה" on the weddings page says nothing new
              const kicker = [it.kind !== kind ? it.kind : '', it.meta].filter(Boolean).join(' · ');
              return (
                <li key={it.id} className="clip-item">
                  <button className="clip" type="button" data-cursor="view"
                    aria-label={`צפייה: ${[it.title, it.meta, it.credit].filter(Boolean).join(', ')}`}
                    onClick={e => { track('video_play', { video_title: it.title, area: tag }); open({ clip: it, title: [it.title, it.credit].filter(Boolean).join(' · '), origin: e.currentTarget.querySelector('.clip__media') }); }}>
                    <span className="clip__media"><img src={it.thumb(480)} alt={[it.title, it.meta, 'אלעזר ביטון'].filter(Boolean).join(' · ')} loading="lazy" decoding="async" />{PLAY}</span>
                    <span className="clip__cap">
                      {kicker && <span className="clip__kicker">{kicker}</span>}
                      <span className="clip__title">{it.title}</span>
                      {it.credit && <span className="clip__credit">{it.credit}</span>}
                    </span>
                  </button>
                </li>
              );
            })}
        </ul>
        {items && !items.length && <p className="gallery__empty">{videos ? 'עוד אין כאן סרטונים.' : 'הסרטונים לא נטענו כרגע. נסו לרענן את העמוד.'}</p>}
      </main>
    </>
  );
}
