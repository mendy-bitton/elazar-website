/* =========================================================
   ADMIN: VIDEOS
   - the scan: YouTube (via the Netlify function) and Cloudinary → the "videos" table.
     It runs when the panel opens (if the last one is over 10 minutes old) and on "סרוק עכשיו".
   - the first scan imports what the site shows today, so nothing disappears.
   - per area, two lists: shown on the site (in order, drag to sort) and not shown.
     Nothing new reaches the site until Elazar moves it into the shown list and saves.
   ========================================================= */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DndContext, DragOverlay, MouseSensor, TouchSensor, KeyboardSensor, useSensor, useSensors, closestCenter, useDroppable
} from '@dnd-kit/core';
import { SortableContext, useSortable, arrayMove, verticalListSortingStrategy, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  DotsSixVerticalIcon, ArrowLeftIcon, ArrowRightIcon, EyeIcon, ArrowsClockwiseIcon, MagnifyingGlassIcon, PlusIcon,
  MusicNotesIcon, FilmStripIcon, HeartIcon, ConfettiIcon, BellRingingIcon, ClockIcon
} from '@phosphor-icons/react';
import { supabase } from './client';
import { listResources } from '../lib/cld';
import { AREAS, DEFAULT_SONGS, DEFAULT_SHORTS, displayName, thumbOf, youTubeId } from '../lib/videos';

const PHASE2_MISSING = 'טבלאות הסרטונים עוד לא קיימות. צריך להריץ ב־Supabase (SQL Editor) את הקובץ supabase/schema-2-videos.sql.';
const RESCAN_AFTER = 10 * 60 * 1000;
const EMPTY = { music: [], moments: [], weddings: [], events: [] };
const userError = msg => Object.assign(new Error(msg), { userFacing: true });
const errText = e => (e && e.userFacing ? e.message : (e && e.message) || 'שגיאה לא צפויה');

/* ---------- the video library: what's known, what's placed, the scan ---------- */
export function useLibrary(onChanged) {
  const [videos, setVideos] = useState(null);
  const [placements, setPlacements] = useState(null);
  const [meta, setMeta] = useState({});
  const [error, setError] = useState('');
  const [scanning, setScanning] = useState(false);
  const [scanMsg, setScanMsg] = useState('');

  const load = useCallback(async () => {
    const [v, p, m] = await Promise.all([
      supabase.from('videos').select('*'),
      supabase.from('placements').select('area,video_id,position').order('position'),
      supabase.from('settings').select('value').eq('key', 'videos').maybeSingle()
    ]);
    if (v.error || p.error) { setError(PHASE2_MISSING); setVideos([]); setPlacements(EMPTY); return null; }
    const by = { music: [], moments: [], weddings: [], events: [] };
    p.data.forEach(r => by[r.area] && by[r.area].push(r.video_id));
    setVideos(v.data); setPlacements(by); setMeta((m.data && m.data.value) || {}); setError('');
    return (m.data && m.data.value) || {};
  }, []);

  const saveMeta = async value => {
    const { error: e } = await supabase.from('settings').upsert({ key: 'videos', value });
    if (e) throw e;
    setMeta(value);
  };

  // one YouTube video by its id, with its name from YouTube (adding by link, and the first import)
  const putYouTube = async (id, kind) => {
    const res = await fetch(`/.netlify/functions/youtube-feed?oembed=${id}`);
    const d = await res.json().catch(() => ({}));
    if (!res.ok) throw userError('הסרטון לא נמצא ביוטיוב. אולי הוא פרטי או שהקישור שגוי.');
    const { error: e } = await supabase.from('videos').upsert({
      id: 'yt:' + id, source: 'youtube', kind, title: d.title || id, data: { ytId: id }, last_seen: new Date().toISOString(), gone: false
    }, { onConflict: 'id' });
    if (e) throw e;
  };

  const savePlacements = async (area, ids, seen = []) => {
    const { error: e } = await supabase.rpc('save_placements', { p_area: area, p_ids: ids, p_seen: seen });
    if (e) throw e;
  };

  const scan = useCallback(async () => {
    setScanning(true); setScanMsg('');
    try {
      const [feedRes, wed, ev] = await Promise.all([
        fetch('/.netlify/functions/youtube-feed', { cache: 'no-store' }),
        listResources('weddings', { fresh: true }),
        listResources('events', { fresh: true })
      ]);
      const feed = await feedRes.json().catch(() => ({}));
      if (!feedRes.ok || feed.error) throw userError('לא הצלחנו לקרוא את יוטיוב כרגע. נסו שוב בעוד דקה.');
      const now = new Date().toISOString();
      const yt = (list, kind) => list.map(x => ({ id: 'yt:' + x.id, source: 'youtube', kind, title: x.title, data: { ytId: x.id, published: x.published }, last_seen: now, gone: false }));
      const cl = (list, kind) => list.map(r => ({
        id: 'cld:' + r.public_id, source: 'cloudinary', kind, title: r.public_id.split('/').pop(),
        data: { public_id: r.public_id, version: r.version, format: r.format, created_at: r.created_at }, last_seen: now, gone: false
      }));
      const seenIds = new Set();
      const rows = [...yt(feed.songs || [], 'song'), ...yt(feed.shorts || [], 'short'), ...cl(wed, 'wedding'), ...cl(ev, 'event')]
        .filter(r => !seenIds.has(r.id) && seenIds.add(r.id));
      for (let i = 0; i < rows.length; i += 200) {
        const { error: e } = await supabase.from('videos').upsert(rows.slice(i, i + 200), { onConflict: 'id' });
        if (e) throw e;
      }
      const { error: e2 } = await supabase.rpc('mark_gone', { p_source: 'cloudinary', p_present: [...wed, ...ev].map(r => 'cld:' + r.public_id) });
      if (e2) throw e2;

      const current = await load() || {};
      // the very first scan: put on the panel exactly what the site shows today
      if (!current.initialized) {
        for (const [id, kind] of [...DEFAULT_SONGS.map(s => [s.id, 'song']), ...DEFAULT_SHORTS.map(s => [s.yt, 'short'])]) {
          if (!seenIds.has('yt:' + id)) await putYouTube(id, kind);
        }
        await savePlacements('music', DEFAULT_SONGS.map(s => 'yt:' + s.id));
        await savePlacements('moments', DEFAULT_SHORTS.map(s => 'yt:' + s.yt));
        await savePlacements('weddings', wed.map(r => 'cld:' + r.public_id));
        await savePlacements('events', ev.map(r => 'cld:' + r.public_id));
      }
      await saveMeta({ ...current, initialized: true, lastScan: now });
      await load();
      onChanged && onChanged();
      setScanMsg(current.initialized ? 'הסריקה הסתיימה.' : 'הסריקה הראשונה הסתיימה: כל מה שמוצג היום באתר נכנס לפאנל.');
    } catch (e) {
      setScanMsg('הסריקה נכשלה: ' + errText(e));
    } finally {
      setScanning(false);
    }
  }, [load, onChanged]);

  const addByLink = async (input, kind) => {
    const id = youTubeId(input);
    if (!id) throw userError('לא זיהינו קישור של יוטיוב.');
    await putYouTube(id, kind);
    await load();
    return 'yt:' + id;
  };

  const save = async (area, ids, seen) => {
    await savePlacements(area, ids, seen);
    await load();
    onChanged && onChanged();
  };

  // open the panel → scan, if the last scan is old (or there was never one)
  const opened = useRef(false);
  useEffect(() => {
    if (opened.current) return;
    opened.current = true;
    load().then(m => {
      if (m && (!m.lastScan || Date.now() - new Date(m.lastScan).getTime() > RESCAN_AFTER)) scan();
    });
  }, [load, scan]);

  return { videos, placements, meta, error, scanning, scanMsg, scan, addByLink, save };
}

const ago = iso => {
  if (!iso) return 'עוד לא נסרק';
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return 'הרגע';
  if (m < 60) return `לפני ${m} דקות`;
  const h = Math.round(m / 60);
  if (h < 24) return h === 1 ? 'לפני שעה' : `לפני ${h} שעות`;
  const d = Math.round(h / 24);
  return d === 1 ? 'אתמול' : `לפני ${d} ימים`;
};

function ScanBar({ lib }) {
  return (
    <div className="adm-scan">
      <button className="adm-btn adm-btn--ghost adm-btn--sm" type="button" onClick={lib.scan} disabled={lib.scanning}>
        <ArrowsClockwiseIcon className={lib.scanning ? 'adm-spin' : ''} aria-hidden="true" /> {lib.scanning ? 'סורק…' : 'סרוק עכשיו'}
      </button>
      <span className="adm-hint">סריקה אחרונה: {ago(lib.meta.lastScan)}</span>
      {lib.scanMsg && <span className={/נכשלה/.test(lib.scanMsg) ? 'adm-error adm-inline' : 'adm-hint'}>{lib.scanMsg}</span>}
    </div>
  );
}

/* ---------- dashboard ---------- */
export function Dashboard({ lib, popup, goVideos }) {
  if (!lib.videos) return <p className="adm-note">טוען…</p>;
  const byId = Object.fromEntries(lib.videos.map(v => [v.id, v]));
  const placed = new Set(Object.values(lib.placements).flat());
  const count = area => lib.placements[area].filter(id => byId[id] && !byId[id].gone).length;
  const pending = lib.videos.filter(v => v.is_new && !v.gone && !placed.has(v.id));
  const cards = [
    ['music', MusicNotesIcon, 'שירים מוצגים'],
    ['moments', FilmStripIcon, 'שורטים מוצגים'],
    ['weddings', HeartIcon, 'סרטוני חתונות מוצגים'],
    ['events', ConfettiIcon, 'סרטוני אירועים מוצגים']
  ];
  const popupLive = popup.enabled && popup.image;
  return (
    <section className="adm-card">
      <h2 className="adm-h2">דשבורד</h2>
      {lib.error ? <p className="adm-error">{lib.error}</p> : <ScanBar lib={lib} />}
      <div className="adm-stats">
        {cards.map(([area, Icon, label]) => (
          <button key={area} type="button" className="adm-stat" onClick={() => goVideos(area)}>
            <Icon className="adm-stat__icon" aria-hidden="true" />
            <span className="adm-stat__num">{count(area)}</span>
            <span className="adm-stat__label">{label}</span>
            <span className="adm-stat__area">{AREAS[area].label}</span>
          </button>
        ))}
        <button type="button" className={`adm-stat${pending.length ? ' is-hot' : ''}`}
          onClick={() => goVideos((Object.keys(AREAS).find(a => pending.some(v => AREAS[a].kinds.includes(v.kind)))) || 'music')}>
          <BellRingingIcon className="adm-stat__icon" aria-hidden="true" />
          <span className="adm-stat__num">{pending.length}</span>
          <span className="adm-stat__label">סרטונים חדשים מחכים לאישור</span>
        </button>
        <div className="adm-stat adm-stat--static">
          <ClockIcon className="adm-stat__icon" aria-hidden="true" />
          <span className="adm-stat__num adm-stat__num--sm">{popupLive ? 'פעיל' : 'כבוי'}</span>
          <span className="adm-stat__label">הפופאפ{popupLive && popup.endsAt ? ` (עד ${popup.endsAt.split('-').reverse().join('.')})` : ''}</span>
        </div>
      </div>
    </section>
  );
}

/* ---------- the two lists ---------- */
const linkOf = v => v.source === 'youtube' ? `https://www.youtube.com/watch?v=${v.data.ytId}` : `https://res.cloudinary.com/dmdv4qylh/video/upload/v${v.data.version}/${v.data.public_id.split('/').map(encodeURIComponent).join('/')}.${v.data.format}`;
const dateOf = v => new Date(v.data.published || v.data.created_at || v.first_seen).getTime() || 0;

// a row in a list, draggable by its handle
function Row(props) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: props.v.id });
  return (
    <RowView {...props} rowRef={setNodeRef} gripRef={setActivatorNodeRef} grip={{ ...listeners, ...attributes }}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? .35 : 1 }} />
  );
}

// how a row looks (also the floating copy while dragging)
function RowView({ v, index, shown, onMove, overlay = false, rowRef, gripRef, grip = {}, style }) {
  const d = displayName(v);
  return (
    <li ref={rowRef} style={style} className={`vrow${overlay ? ' is-overlay' : ''}${v.gone ? ' is-gone' : ''}`}>
      <button type="button" className="vrow__grip" ref={gripRef} {...grip} aria-label={`גרירה: ${d.title}`}>
        <DotsSixVerticalIcon aria-hidden="true" />
      </button>
      {shown && <span className="vrow__num">{index + 1}</span>}
      <img className="vrow__thumb" src={thumbOf(v)} alt="" loading="lazy" />
      <span className="vrow__text">
        <span className="vrow__title">{d.title}</span>
        <span className="vrow__sub">{d.sub || ' '}</span>
      </span>
      {v.is_new && !shown && <span className="vrow__tag">חדש</span>}
      {v.gone && <span className="vrow__tag vrow__tag--gone">הוסר מהמקור</span>}
      <a className="vrow__btn" href={linkOf(v)} target="_blank" rel="noopener" aria-label={`צפייה: ${d.title}`}><EyeIcon aria-hidden="true" /></a>
      <button type="button" className="vrow__btn vrow__btn--move" onClick={onMove} aria-label={shown ? `הסרה מהאתר: ${d.title}` : `הוספה לאתר: ${d.title}`}>
        {shown ? <ArrowLeftIcon aria-hidden="true" /> : <ArrowRightIcon aria-hidden="true" />}
      </button>
    </li>
  );
}

function Zone({ id, title, hint, children, empty }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div className={`vzone${isOver ? ' is-over' : ''}`}>
      <div className="vzone__head"><span className="vzone__title">{title}</span><span className="adm-hint">{hint}</span></div>
      <ul ref={setNodeRef} className="vzone__list">
        {children}
        {empty && <li className="vzone__empty">{empty}</li>}
      </ul>
    </div>
  );
}

export function VideosTab({ lib, notify, startArea }) {
  const [area, setArea] = useState(startArea || 'music');
  const [shown, setShown] = useState([]);
  const [dirty, setDirty] = useState(false);
  const [q, setQ] = useState('');
  const [kind, setKind] = useState(null);           // null = the area's own kind
  const [activeId, setActiveId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [link, setLink] = useState('');
  const [linkBusy, setLinkBusy] = useState(false);
  const dirtyRef = useRef(false);
  dirtyRef.current = dirty;

  // the saved list of this area (unless there are unsaved changes to keep)
  useEffect(() => {
    if (lib.placements && !dirtyRef.current) setShown(lib.placements[area] || []);
  }, [area, lib.placements]);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const byId = useMemo(() => Object.fromEntries((lib.videos || []).map(v => [v.id, v])), [lib.videos]);
  const cfg = AREAS[area];
  const kinds = kind ? [kind] : cfg.kinds;
  const shownSet = new Set(shown);
  const shownVideos = shown.map(id => byId[id]).filter(Boolean);
  const needle = q.trim();
  const pool = (lib.videos || [])
    .filter(v => !shownSet.has(v.id) && !v.gone && v.source === cfg.source && kinds.includes(v.kind))
    .filter(v => !needle || (v.title + ' ' + displayName(v).title).includes(needle))
    .sort((a, b) => (b.is_new - a.is_new) || (dateOf(b) - dateOf(a)));

  const change = next => { setShown(next); setDirty(true); setError(''); };
  const switchArea = next => {
    if (next === area) return;
    if (dirty && !window.confirm('יש שינויים שלא נשמרו ברשימה הזו. לעבור בלי לשמור?')) return;
    setDirty(false); setKind(null); setQ(''); setError('');
    setShown(lib.placements ? lib.placements[next] || [] : []);
    setArea(next);
  };

  const onDragEnd = ({ active, over }) => {
    setActiveId(null);
    if (!over) return;
    const fromShown = shownSet.has(active.id);
    const overShown = over.id === 'shown-zone' || shownSet.has(over.id);
    if (fromShown && overShown) {
      if (over.id !== 'shown-zone' && over.id !== active.id) change(arrayMove(shown, shown.indexOf(active.id), shown.indexOf(over.id)));
    } else if (!fromShown && overShown) {
      const at = over.id === 'shown-zone' ? shown.length : shown.indexOf(over.id);
      const next = [...shown]; next.splice(at, 0, active.id); change(next);
    } else if (fromShown && !overShown) {
      change(shown.filter(id => id !== active.id));
    }
  };

  const save = async () => {
    setBusy(true); setError('');
    try {
      await lib.save(area, shown, pool.map(v => v.id));
      setDirty(false);
      notify('נשמר. האתר כבר מעודכן.');
    } catch (e) { setError('השמירה נכשלה: ' + errText(e)); }
    setBusy(false);
  };

  const addLink = async () => {
    setLinkBusy(true); setError('');
    try {
      const id = await lib.addByLink(link, cfg.kinds[0]);
      setLink('');
      notify(shownSet.has(id) ? 'הסרטון כבר מוצג באתר.' : 'הסרטון נוסף לרשימת "לא מוצג". אפשר להעביר אותו לאתר.');
    } catch (e) { setError(errText(e)); }
    finally { setLinkBusy(false); }
  };

  if (!lib.videos) return <section className="adm-card"><p className="adm-note">טוען…</p></section>;
  const active = activeId ? byId[activeId] : null;

  return (
    <section className="adm-card">
      <h2 className="adm-h2">סרטונים</h2>
      {lib.error ? <p className="adm-error">{lib.error}</p> : <ScanBar lib={lib} />}
      <p className="adm-note">מה שברשימה "מוצג באתר" מופיע באתר לפי הסדר. גוררים מהידית כדי לסדר, או משתמשים בחצים כדי להעביר בין הרשימות. סרטון חדש לא יופיע באתר עד שמעבירים אותו ושומרים.</p>

      <nav className="adm-tabs adm-tabs--sub" aria-label="אזורים באתר">
        {Object.entries(AREAS).map(([id, a]) => (
          <button key={id} type="button" className={`adm-tab${area === id ? ' is-on' : ''}`} aria-pressed={area === id} onClick={() => switchArea(id)}>
            {a.label} <span className="adm-tab__n">{(lib.placements[id] || []).length}</span>
          </button>
        ))}
      </nav>

      <DndContext sensors={sensors} collisionDetection={closestCenter}
        onDragStart={({ active: a }) => setActiveId(a.id)} onDragCancel={() => setActiveId(null)} onDragEnd={onDragEnd}>
        <div className="vgrid">
          <SortableContext id="shown" items={shown} strategy={verticalListSortingStrategy}>
            <Zone id="shown-zone" title="מוצג באתר" hint="לפי הסדר באתר" empty={!shownVideos.length && 'שום דבר לא מוצג כאן. גררו לכאן סרטונים מהרשימה השנייה.'}>
              {shownVideos.map((v, i) => <Row key={v.id} v={v} index={i} shown onMove={() => change(shown.filter(id => id !== v.id))} />)}
            </Zone>
          </SortableContext>

          <div className="vside">
            <div className="vtools">
              <label className="vsearch">
                <MagnifyingGlassIcon aria-hidden="true" />
                <input className="adm-input" type="search" placeholder="חיפוש" value={q} onChange={e => setQ(e.target.value)} aria-label="חיפוש סרטון" />
              </label>
              {cfg.source === 'youtube' && (
                <div className="vchips" role="group" aria-label="סינון">
                  {[[null, cfg.kinds[0] === 'song' ? 'שירים' : 'שורטים'], [cfg.kinds[0] === 'song' ? 'short' : 'song', cfg.kinds[0] === 'song' ? 'שורטים' : 'שירים']].map(([k, label]) => (
                    <button key={label} type="button" className={`vchip${kind === k ? ' is-on' : ''}`} onClick={() => setKind(k)}>{label}</button>
                  ))}
                </div>
              )}
            </div>
            <SortableContext id="pool" items={pool.map(v => v.id)} strategy={verticalListSortingStrategy}>
              <Zone id="pool-zone" title="לא מוצג" hint="חדשים למעלה" empty={!pool.length && (needle ? 'לא נמצא סרטון כזה.' : 'אין כרגע סרטונים נוספים.')}>
                {pool.map(v => <Row key={v.id} v={v} onMove={() => change([...shown, v.id])} />)}
              </Zone>
            </SortableContext>
            {cfg.source === 'youtube' && (
              <div className="vadd">
                <input className="adm-input" dir="ltr" placeholder="הדבקת קישור מיוטיוב" value={link} onChange={e => { setLink(e.target.value); setError(''); }} aria-label="קישור לסרטון ביוטיוב" />
                <button type="button" className="adm-btn adm-btn--ghost adm-btn--sm" onClick={addLink} disabled={linkBusy || !link.trim()}>
                  <PlusIcon aria-hidden="true" /> {linkBusy ? 'מוסיף…' : 'הוספה'}
                </button>
              </div>
            )}
          </div>
        </div>
        <DragOverlay>{active ? <ul className="vzone__list"><RowView v={active} shown={shownSet.has(active.id)} index={shown.indexOf(active.id)} overlay onMove={() => {}} /></ul> : null}</DragOverlay>
      </DndContext>

      <div className="adm-savebar">
        {error && <p className="adm-error" role="alert">{error}</p>}
        <button className="adm-btn" type="button" onClick={save} disabled={busy || !!lib.error}>{busy ? 'שומר…' : dirty ? 'שמירה' : 'שמירה (אין שינויים)'}</button>
        {dirty && <button className="adm-btn adm-btn--ghost" type="button" onClick={() => { setDirty(false); setShown(lib.placements[area] || []); }}>ביטול השינויים</button>}
      </div>
    </section>
  );
}
