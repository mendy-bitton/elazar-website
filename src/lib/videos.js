/* =========================================================
   VIDEOS: shared by the site and the admin panel.
   - the site's video lists as built (shown until the panel takes over,
     and imported into it the first time it runs)
   - turning a YouTube title into a short name + "with ..." credit
   - turning a stored video into what each section needs
   ========================================================= */
import { clipFrom } from './cld';

export const AREAS = {
  music: { label: 'המוזיקה שלי', kinds: ['song'], source: 'youtube' },
  moments: { label: 'רגעים מהשמחות', kinds: ['short'], source: 'youtube' },
  weddings: { label: 'חתונות', kinds: ['wedding'], source: 'cloudinary' },
  events: { label: 'אירועים', kinds: ['event'], source: 'cloudinary' }
};

/* ---------- the lists as built ---------- */
export const DEFAULT_SONGS = [
  { id: 'emjirOPaBeU', he: 'מי אדיר', meta: 'סינגל חופה' },
  { id: 'oSjW7A4DzdQ', he: 'דע', meta: 'סינגל' },
  { id: 'HixvdiyhRfg', he: 'ניגון מויטבסק', meta: 'סינגל' },
  { id: 'voHqIOp5ly4', he: 'מחרוזת רפאנו', meta: 'מחרוזת' },
  { id: 'eFRqLDcXvmE', he: 'והיא שעמדה', meta: 'סינגל' },
  { id: 'S1AgF-cnA6o', he: 'ביצוע שופט', meta: 'הופעה חיה, הקול החדש בדרכים · עם מענדי גדסי' }
];
export const DEFAULT_SHORTS = [
  { yt: '2en3jVyg6eg', name: 'לחי עולמים', meta: 'עם דוידי נחשון' },
  { yt: 'AWUDlcMMK4g', name: 'אנרגיות שיא', meta: 'עם לוי אוטינסקי' },
  { yt: 'Wp5a3oPxDzk', name: 'שמחת חתן וכלה', meta: 'חתונה בכפר חב״ד' },
  { yt: 'aIYqIRPpDTY', name: 'היי צמאה', meta: 'עם דוידי נחשון' },
  { yt: 'nWLEgu0GKjQ', name: 'אמר רבי עקיבא', meta: 'עם יוסף חיים, מתוך חתונה בכפר חב״ד' },
  { yt: 'dwYMi8xB1tQ', name: 'ככה מסיימים חתונה', meta: 'עם לוי אוטינסקי' }
].map(s => ({ ...s, title: [s.name, s.meta].filter(Boolean).join(' · ') }));

// each album case's colour band and cover crop; songs added later get a colour from the palette
const VISUALS = {
  emjirOPaBeU: { focus: '50%', tint: '#8fa7c4' },
  oSjW7A4DzdQ: { focus: '58%', tint: '#b98a4a' },
  HixvdiyhRfg: { focus: '100%', tint: '#b23a3a' },
  voHqIOp5ly4: { focus: '50%', tint: '#8b8a5a' },
  eFRqLDcXvmE: { focus: '46%', tint: '#6a4a8a' },
  'S1AgF-cnA6o': { focus: '52%', tint: '#3a5fa0' }
};
const PALETTE = ['#8fa7c4', '#b98a4a', '#b23a3a', '#8b8a5a', '#6a4a8a', '#3a5fa0', '#4f8a7a', '#a0566f'];
export const songVisual = (id, i) => VISUALS[id] || { focus: '50%', tint: PALETTE[i % PALETTE.length] };

/* ---------- YouTube title → short name + credit ----------
   "ביצוע שופט🎓 - אלעזר ביטון & מענדי גדסי - הקול החדש בדרכים - LIVE"
   → { title: 'ביצוע שופט', credit: 'עם מענדי גדסי', meta: 'הקול החדש בדרכים · LIVE' } */
const EMOJI = /[\p{Extended_Pictographic}\u{FE0F}\u{200D}\u{20E3}\u{1F3FB}-\u{1F3FF}]/gu;
const ARTIST = /אלעזר\s*ביטון/;
const names = list => list.length < 2 ? list.join('') : list.slice(0, -1).join(', ') + ' ו' + list[list.length - 1];

export function cleanYouTubeTitle(raw) {
  let t = String(raw || '').replace(EMOJI, ' ').replace(/\s+/g, ' ').trim();
  t = t.split('|')[0].trim();                                         // the Hebrew half of "עברית | English"
  const notes = [];
  t = t.replace(/\(([^)]*)\)/g, (_, inner) => { if (inner.trim()) notes.push(inner.trim()); return ' '; }).replace(/\s+/g, ' ').trim();

  const pieces = [], with_ = [];
  for (let part of t.split(/\s+-\s*|\s*-\s+/)) {
    part = part.trim();
    if (!part) continue;
    const m = part.match(ARTIST);
    if (m) {
      const before = part.slice(0, m.index).trim();
      // "לחי עולמים! אלעזר ביטון & דוידי נחשון": a title glued in front of the artists
      if (before && !/[&,]$/.test(before)) { pieces.push(before); part = part.slice(m.index); }
      part.replace(ARTIST, '').split(/[&,]/).map(s => s.trim()).filter(Boolean).forEach(n => with_.push(n));
      continue;
    }
    // "להודות ולהלל! עם מענדל גדסי": the credit inside the title
    const w = part.match(/^(.*?)\s+עם\s+(.+)$/);
    if (w && w[1].trim()) { pieces.push(w[1].trim()); with_.push(w[2].trim()); continue; }
    pieces.push(part);
  }
  const strip = s => s.replace(/[\s!?.…,:]+$/u, '').trim();
  // a title that is only the artists ("אלעזר ביטון & דוידי נחשון") becomes his name, with the rest as the credit
  const title = strip(pieces.shift() || '') || (with_.length ? 'אלעזר ביטון' : strip(t)) || 'אלעזר ביטון';
  return {
    title,
    credit: with_.length ? 'עם ' + names(with_) : '',
    meta: [...pieces.map(strip).filter(Boolean), ...notes].join(' · ')
  };
}

/* ---------- a stored video → what each section needs ---------- */
export function toSong(v, i) {
  const id = v.data.ytId;
  const c = cleanYouTubeTitle(v.title);
  return { id, he: c.title, meta: [c.meta, c.credit].filter(Boolean).join(' · ') || 'סינגל', ...songVisual(id, i) };
}
export function toShort(v) {
  const c = cleanYouTubeTitle(v.title);
  const meta = [c.credit, c.meta].filter(Boolean).join(', ');
  return { yt: v.data.ytId, name: c.title, meta, title: [c.title, c.credit].filter(Boolean).join(' · ') };
}
export const toClip = v => clipFrom(v.data);

// a small thumbnail for the admin lists
export const thumbOf = v => v.source === 'youtube'
  ? `https://i.ytimg.com/vi/${v.data.ytId}/mqdefault.jpg`
  : clipFrom(v.data).thumb(160);

// the name the site shows for a video (YouTube titles cleaned, Cloudinary names parsed)
export function displayName(v) {
  if (v.source === 'youtube') { const c = cleanYouTubeTitle(v.title); return { title: c.title, sub: [c.credit, c.meta].filter(Boolean).join(' · ') }; }
  const c = clipFrom(v.data);
  return { title: c.title, sub: [c.meta, c.credit].filter(Boolean).join(' · ') };
}

// a YouTube link (watch, youtu.be, shorts, embed) or a bare id → the 11-character id
export function youTubeId(input) {
  const s = String(input || '').trim();
  if (/^[\w-]{11}$/.test(s)) return s;
  const m = s.match(/(?:youtu\.be\/|[?&]v=|\/shorts\/|\/embed\/|\/live\/)([\w-]{11})/);
  return m ? m[1] : null;
}
