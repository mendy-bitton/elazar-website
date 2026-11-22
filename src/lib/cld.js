/* =========================================================
   CLOUDINARY: the public video lists (by tag) and their URLs
   A new clip shows up on the site as soon as it is tagged
   "weddings" or "events" in Cloudinary (the list is cached for 60s).
   ========================================================= */
const CLOUD = 'dmdv4qylh';
const HOST = `https://res.cloudinary.com/${CLOUD}/video/`;
const enc = pid => pid.split('/').map(encodeURIComponent).join('/');

// a still from the 2nd second, sized for the card
const thumb = (r, w = 480) => `${HOST}upload/so_2,w_${w},c_limit,q_auto,f_auto/v${r.version}/${enc(r.public_id)}.jpg`;
// the phone clips are 1080x1920 .mov files of 20-50MB; this is a 720p H.264 copy, a fraction of the size
const video = r => `${HOST}upload/w_720,q_auto,vc_h264/v${r.version}/${enc(r.public_id)}.mp4`;
const original = r => `${HOST}upload/v${r.version}/${enc(r.public_id)}.${r.format}`;

// file names read: "<kind> - [place / set] - <song> - עם <musicians>"
// e.g. "חתונה - כפ"ח א - עושים תשובה - עם הקלידן מענדל גדסי"
function parse(r) {
  const file = r.public_id.split('/').pop().replace(/\s+\d+$/, '').trim();
  const parts = file.split(/\s+-\s+/).map(s => s.trim()).filter(Boolean);
  const kind = parts.shift() || '';
  const credit = parts.length && /^עם\s/.test(parts[parts.length - 1]) ? parts.pop() : '';
  const title = parts.pop() || kind;
  return { kind, title, meta: parts.join(' · '), credit };
}

// one clip, from its Cloudinary resource ({ public_id, version, format }), ready for the site
export const clipFrom = r => ({ id: r.public_id, ...parse(r), r, thumb: w => thumb(r, w), src: video(r), orig: original(r) });

// the raw resources tagged weddings / events; fresh=true skips the browser cache (the admin scan)
export function listResources(tag, { fresh = false } = {}) {
  const url = `${HOST}list/${encodeURIComponent(tag)}.json${fresh ? `?t=${Date.now()}` : ''}`;
  return fetch(url, fresh ? { cache: 'no-store' } : undefined)
    .then(res => (res.ok ? res.json() : { resources: [] }))
    .then(d => d.resources || []);
}

const cache = {};
export function listClips(tag) {
  if (!cache[tag]) cache[tag] = listResources(tag).then(rs => rs.map(clipFrom)).catch(() => []);
  return cache[tag];
}
