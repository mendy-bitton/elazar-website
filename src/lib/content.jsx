/* =========================================================
   SITE CONTENT: texts, contact details and the popup.
   The defaults below are the site as built; whatever Elazar saves in /admin
   (Supabase table "settings") overrides them. The last answer is kept in the
   browser, so a returning visitor sees it at once, and if Supabase can't be
   reached the site simply shows the defaults.
   ========================================================= */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
export const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const DEFAULTS = {
  texts: {
    heroTitle1: 'עם כל הלב,',
    heroTitle2: 'לשמחה שלכם',
    heroLead1: 'אני אלעזר ביטון, זמר חתונות ואירועים בסגנון חב״די וחסידי. אני מאמין שכל שמחה צריכה נשמה, ולכן אני מגיע לכל אירוע עם כל הלב.',
    heroLead2: 'מניגוני הקבלת פנים והחופה המרגשים ועד ריקודים סוערים שלא נגמרים, אני בונה את הערב יחד אתכם, לפי הקהל, האווירה והרגע.',
    momentsTitle: 'רגעים מהשמחות',
    musicTitle: 'המוזיקה שלי',
    musicSub: 'בחרו שיר מהמדף, ולחצו על העטיפה כדי להאזין.',
    reelTitle: 'מהבמה',
    reelSub: 'השמחה, בלי פילטרים.',
    ctaLine1: 'חוגגים שמחה?',
    ctaLine2: 'אירוע?',
    ctaLine3: 'בואו נדבר.'
  },
  contact: {
    phone: '052.810.8100',
    whatsapp: '052.810.8100',
    whatsappText: 'שלום אלעזר, אשמח לקבל הצעת מחיר לאירוע.\nתאריך: \nמקום: ',
    instagram: 'elazar_bitton_official'
  },
  popup: {
    enabled: false,
    image: '',
    path: '',
    alt: '',
    link: '',
    linkLabel: 'לפרטים',
    startsAt: '',
    endsAt: '',
    version: 0,
    width: 0,                 // the image's size, so its frame is ready before it loads
    height: 0,
    blur: ''                  // a tiny version, shown blurred while the real one loads
  }
};

/* ---------- links built from the contact details ---------- */
// "052.810.8100" → "972528108100"
export const intlNumber = p => { const d = String(p || '').replace(/\D/g, ''); return d.startsWith('0') ? '972' + d.slice(1) : d; };
export const telHref = p => `tel:+${intlNumber(p)}`;
export const waHref = (p, text) => `https://wa.me/${intlNumber(p)}${text ? '?text=' + encodeURIComponent(text) : ''}`;
export const igHandle = h => String(h || '').trim().replace(/^@/, '').replace(/^https?:\/\/(www\.)?instagram\.com\//, '').replace(/\/.*$/, '');
export const igHref = h => `https://www.instagram.com/${igHandle(h)}/`;

/* ---------- reading ---------- */
const CACHE = 'elazar:content';
const readCache = () => { try { return JSON.parse(localStorage.getItem(CACHE)) || {}; } catch { return {}; } };
const writeCache = v => { try { localStorage.setItem(CACHE, JSON.stringify(v)); } catch { /* private mode */ } };

// a small direct request to Supabase's REST API: the public site doesn't need the full client
export async function fetchSettings() {
  if (!SUPABASE_URL || !SUPABASE_KEY) return null;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 5000);
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/settings?select=key,value`, { headers: { apikey: SUPABASE_KEY }, signal: ctrl.signal });
    if (!res.ok) return null;
    const rows = await res.json();
    const out = Object.fromEntries(rows.map(r => [r.key, r.value || {}]));
    // the approved videos, area by area, in order (missing before phase 2 is set up: then the built lists show)
    const pl = await fetch(`${SUPABASE_URL}/rest/v1/placements?select=area,position,videos(id,source,kind,title,data,gone)&order=area.asc,position.asc`,
      { headers: { apikey: SUPABASE_KEY }, signal: ctrl.signal }).catch(() => null);
    if (pl && pl.ok) out.__placements = await pl.json();
    return out;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

// once the panel has taken over the videos (its first scan), the site shows exactly what's placed;
// until then (or if Supabase can't be reached) each section keeps its built list
function groupVideos(raw) {
  if (!raw.videos || !raw.videos.initialized || !Array.isArray(raw.__placements)) return null;
  const by = { music: [], moments: [], weddings: [], events: [] };
  for (const p of raw.__placements) {
    if (p.videos && !p.videos.gone && by[p.area]) by[p.area].push(p.videos);
  }
  return by;
}

// saved values win; an emptied heading falls back to its default, while an emptied
// optional line (or contact detail) stays empty, which hides it on the site
const OPTIONAL_TEXTS = new Set(['heroLead2', 'ctaLine2']);
const fill = (defaults, saved = {}, keepEmpty = () => false) => {
  const out = { ...defaults };
  for (const k of Object.keys(defaults)) {
    const v = saved[k];
    if (v === undefined || v === null) continue;
    if (typeof v === 'string' && !v.trim() && !keepEmpty(k)) continue;
    out[k] = v;
  }
  return out;
};
export const mergeContent = (raw = {}) => ({
  texts: fill(DEFAULTS.texts, raw.texts, k => OPTIONAL_TEXTS.has(k)),
  contact: fill(DEFAULTS.contact, raw.contact, () => true),
  popup: { ...DEFAULTS.popup, ...(raw.popup || {}) },
  videos: groupVideos(raw)
});

const ContentContext = createContext({ ...mergeContent(), reload: () => {} });
export const useContent = () => useContext(ContentContext);

export function ContentProvider({ children }) {
  const [raw, setRaw] = useState(readCache);
  const reload = useCallback(async () => {
    const fresh = await fetchSettings();
    if (fresh) { setRaw(fresh); writeCache(fresh); }
  }, []);
  useEffect(() => { reload(); }, [reload]);
  const value = useMemo(() => ({ ...mergeContent(raw), reload }), [raw, reload]);
  return <ContentContext.Provider value={value}>{children}</ContentContext.Provider>;
}
