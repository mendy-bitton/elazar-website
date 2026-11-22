/* =========================================================
   YOUTUBE FEED (Netlify Function): the channel's newest uploads,
   read from YouTube's public feeds, for the admin panel's scan.
   Browsers can't read those feeds directly (no CORS), so this does it.
   No keys: the feeds are public. Locked to Elazar's channel.

   GET /.netlify/functions/youtube-feed            → { songs: [...], shorts: [...] }
   GET /.netlify/functions/youtube-feed?oembed=ID  → { id, title } for any one video (adding by link)
   ========================================================= */
const CHANNEL = 'UC0X36fnilo2jdZ8hl9tegNw';
// YouTube keeps two automatic playlists per channel: long videos (UULF…) and shorts (UUSH…)
const LONG = 'UULF' + CHANNEL.slice(2);
const SHORTS = 'UUSH' + CHANNEL.slice(2);

const decode = s => s
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
  .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

async function feed(playlist) {
  const res = await fetch(`https://www.youtube.com/feeds/videos.xml?playlist_id=${playlist}`, { headers: { 'user-agent': 'Mozilla/5.0 (site feed reader)' } });
  if (!res.ok) throw new Error(`YouTube feed ${playlist}: ${res.status}`);
  const xml = await res.text();
  return [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].map(([, e]) => ({
    id: (e.match(/<yt:videoId>(.*?)<\/yt:videoId>/) || [])[1],
    title: decode((e.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || ''),
    published: (e.match(/<published>(.*?)<\/published>/) || [])[1] || null
  })).filter(v => v.id);
}

const json = (body, status = 200, maxAge = 0) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': maxAge ? `public, max-age=${maxAge}` : 'no-store' }
});

export default async function handler(req) {
  const url = new URL(req.url);
  try {
    const one = url.searchParams.get('oembed');
    if (one !== null) {
      if (!/^[\w-]{11}$/.test(one)) return json({ error: 'bad video id' }, 400);
      const res = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent('https://www.youtube.com/watch?v=' + one)}`);
      if (!res.ok) return json({ error: 'video not found' }, 404);
      const d = await res.json();
      return json({ id: one, title: d.title || '', author: d.author_name || '' }, 200, 3600);
    }
    const [songs, shorts] = await Promise.all([feed(LONG), feed(SHORTS)]);
    return json({ songs, shorts, at: new Date().toISOString() }, 200, 120);
  } catch (e) {
    return json({ error: String(e && e.message || e) }, 502);
  }
}
