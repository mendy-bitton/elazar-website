/* =========================================================
   SEO: each page's title and description, and what Google and link previews read.
   Used twice:
   - at build time, by vite.config.js: a real HTML file per page with its own tags
     (WhatsApp, Facebook and Google read them without running the site), plus
     sitemap.xml and robots.txt;
   - in the browser, by src/lib/pageHead.js: the same tags follow every page change.
   Plain data and functions only: no React, nothing from the browser.
   ========================================================= */
import site from '../../site.config.js';
import { PLATFORMS } from './platforms.js';
import { DEFAULT_TEXTS, DEFAULT_CONTACT, EVENT_TYPES } from './defaults.js';
import { DEFAULT_SONGS, DEFAULT_SHORTS } from './videos.js';

export const SITE_URL = site.url.replace(/\/+$/, '');
export const SITE_NAME = 'אלעזר ביטון';
export const GA_ID = site.gaId || '';

export const PAGES = [
  {
    path: '/', file: 'index.html',
    title: 'אלעזר ביטון · זמר חתונות ואירועים בסגנון חב״די וחסידי',
    description: 'אלעזר ביטון, זמר חתונות ואירועים בסגנון חב״די וחסידי. מניגוני החופה המרגשים ועד ריקודים סוערים שלא נגמרים, עם כל הלב, לשמחה שלכם.'
  },
  {
    path: '/weddings', file: 'weddings.html', crumb: 'חתונות',
    title: 'חתונות · סרטונים מהבמה · אלעזר ביטון',
    description: 'סרטונים מחתונות עם אלעזר ביטון, זמר חתונות בסגנון חב״די וחסידי: קבלת פנים, חופה וריקודים, כמו שזה נראה באמת מהבמה.'
  },
  {
    path: '/events', file: 'events.html', crumb: 'אירועים',
    title: 'אירועים · בר מצוות, שבע ברכות והתוועדויות · אלעזר ביטון',
    description: 'סרטונים מאירועים עם אלעזר ביטון, זמר בסגנון חב״די וחסידי: בר מצוות, שבע ברכות, התוועדויות ושמחות בית השואבה. השמחה, בלי פילטרים.'
  }
];

// an unknown address shows the home page, so it's described (and canonical) as the home page
export const pageFor = path => PAGES.find(p => p.path === path) || PAGES[0];
export const urlOf = path => SITE_URL + (path === '/' ? '/' : path);

// ?v=: WhatsApp and Facebook keep an image they've seen; a new number makes them fetch it again
const OG_IMAGE = { url: `${SITE_URL}/og-image.jpg?v=2`, width: 1200, height: 630, alt: 'הצללית של אלעזר ביטון מול אור במה זהוב, לצד הלוגו והכיתוב זמר חתונות ואירועים' };

// the contact details at build time; in the browser, the ones saved in /admin replace them
const BUILD_CONTACT = DEFAULT_CONTACT;
const intlPhone = p => { const d = String(p || '').replace(/\D/g, ''); return d ? '+' + (d.startsWith('0') ? '972' + d.slice(1) : d) : ''; };
const igUrl = h => { const n = String(h || '').trim().replace(/^@/, '').replace(/^https?:\/\/(www\.)?instagram\.com\//, '').replace(/\/.*$/, ''); return n ? `https://www.instagram.com/${n}/` : ''; };

/* ---------- structured data (JSON-LD): who this site is about ---------- */
export function structuredData(path, contact = BUILD_CONTACT) {
  const page = pageFor(path);
  const url = urlOf(page.path);
  const website = `${SITE_URL}/#website`, artist = `${SITE_URL}/#artist`;
  const phone = intlPhone(contact.phone);
  const graph = [
    // the site's name, which Google shows above the address in results
    { '@type': 'WebSite', '@id': website, url: `${SITE_URL}/`, name: SITE_NAME, alternateName: ['Elazar Bitton', 'אלעזר ביטון זמר'], inLanguage: 'he-IL', publisher: { '@id': artist } },
    // the singer (schema.org's MusicGroup covers a solo artist too)
    {
      '@type': 'MusicGroup', '@id': artist, name: SITE_NAME, alternateName: 'Elazar Bitton',
      description: 'זמר חתונות ואירועים בסגנון חב״די וחסידי',
      url: `${SITE_URL}/`, image: OG_IMAGE.url,
      genre: ['מוזיקה חסידית', 'מוזיקה יהודית', 'Hasidic music', 'Jewish music'],
      ...(phone ? { telephone: phone } : {}),
      areaServed: { '@type': 'Country', name: 'ישראל' },
      sameAs: [...PLATFORMS.map(p => p.href), igUrl(contact.instagram)].filter(Boolean)
    },
    {
      '@type': page.crumb ? 'CollectionPage' : 'WebPage', '@id': `${url}#webpage`, url, name: page.title, description: page.description,
      inLanguage: 'he-IL', isPartOf: { '@id': website }, about: { '@id': artist }, primaryImageOfPage: OG_IMAGE.url,
      ...(page.crumb ? { breadcrumb: { '@id': `${url}#breadcrumb` } } : {})
    }
  ];
  // "home › weddings" under the result instead of a bare address
  if (page.crumb) graph.push({
    '@type': 'BreadcrumbList', '@id': `${url}#breadcrumb`,
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'דף הבית', item: `${SITE_URL}/` },
      { '@type': 'ListItem', position: 2, name: page.crumb, item: url }
    ]
  });
  return { '@context': 'https://schema.org', '@graph': graph };
}
// safe inside a <script> tag
export const ldJson = data => JSON.stringify(data).replace(/</g, '\\u003c');

/* ---------- the <head> tags of one page, as HTML (for the build) ---------- */
const esc = s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function headHtml(path, { analytics = false } = {}) {
  const p = pageFor(path), url = urlOf(p.path);
  return [
    `<title>${esc(p.title)}</title>`,
    `<meta name="description" content="${esc(p.description)}">`,
    `<link rel="canonical" href="${url}">`,
    `<meta name="robots" content="index, follow, max-image-preview:large">`,
    site.googleVerification && `<meta name="google-site-verification" content="${esc(site.googleVerification)}">`,
    // the card shown when the link is shared (WhatsApp, Facebook, Instagram messages...)
    `<meta property="og:type" content="website">`,
    `<meta property="og:locale" content="he_IL">`,
    `<meta property="og:site_name" content="${esc(SITE_NAME)}">`,
    `<meta property="og:title" content="${esc(p.title)}">`,
    `<meta property="og:description" content="${esc(p.description)}">`,
    `<meta property="og:url" content="${url}">`,
    `<meta property="og:image" content="${OG_IMAGE.url}">`,
    `<meta property="og:image:width" content="${OG_IMAGE.width}">`,
    `<meta property="og:image:height" content="${OG_IMAGE.height}">`,
    `<meta property="og:image:alt" content="${esc(OG_IMAGE.alt)}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<script type="application/ld+json" id="ld">${ldJson(structuredData(p.path))}</script>`,
    // Google Analytics 4, in Google's standard form (Search Console verifies the site through it, so keep
    // it as is). Google counts the page a visit starts on; the site counts each move after it (analytics.js)
    analytics && GA_ID && `<script async src="https://www.googletagmanager.com/gtag/js?id=${esc(GA_ID)}"></script>`,
    analytics && GA_ID && `<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config',${JSON.stringify(GA_ID)});</script>`
  ].filter(Boolean).join('\n');
}

/* ---------- the page's text, written into its HTML file ----------
   For bots that read the file without running the site (ChatGPT's, Claude's, Perplexity's...):
   the same text the page shows, as plain headings, paragraphs and links. Visitors never see it:
   it's hidden from the first moment (index.html) and the site replaces it as soon as it starts.
   It's the site as built (the defaults); texts Elazar changes in /admin show here after the next deploy. */
export function bodyHtml(path) {
  const p = pageFor(path), t = DEFAULT_TEXTS, c = DEFAULT_CONTACT;
  const li = items => `<ul>${items.map(i => `<li>${i}</li>`).join('')}</ul>`;
  const a = (href, text) => `<a href="${esc(href)}">${esc(text)}</a>`;
  const nav = `<header>${a('/', SITE_NAME)}<nav aria-label="ניווט ראשי">${li([a('/', 'דף הבית'), a('/weddings', 'חתונות'), a('/events', 'אירועים'), a('/#contact', 'יצירת קשר')])}</nav></header>`;
  const phone = intlPhone(c.phone), wa = intlPhone(c.whatsapp).slice(1), ig = igUrl(c.instagram);
  const contact = `<section id="contact"><h2>${esc([t.ctaLine1, t.ctaLine2, t.ctaLine3].filter(Boolean).join(' '))}</h2>${li([
    phone && `טלפון: ${a('tel:' + phone, c.phone)}`,
    wa && `וואטסאפ: ${a('https://wa.me/' + wa, 'שלחו הודעה')}`,
    ig && `אינסטגרם: ${a(ig, '@' + ig.split('/').filter(Boolean).pop())}`
  ].filter(Boolean))}</section>`;
  let main;
  if (p.crumb) {
    main = `<h1>${esc(p.crumb)} עם ${esc(SITE_NAME)}</h1><p>${esc(p.description)}</p>${li([a('/', 'חזרה לדף הבית'), p.path === '/weddings' ? a('/events', 'אירועים') : a('/weddings', 'חתונות')])}`;
  } else {
    main = [
      `<h1>${esc(SITE_NAME)}, זמר חתונות ואירועים: ${esc(t.heroTitle1)} ${esc(t.heroTitle2)}</h1>`,
      `<p>${esc(t.heroLead1)}</p>`, t.heroLead2 && `<p>${esc(t.heroLead2)}</p>`,
      `<section><h2>סוגי אירועים</h2>${li(EVENT_TYPES.map(([name]) => esc(name)))}</section>`,
      `<section><h2>${esc(t.momentsTitle)}</h2>${li(DEFAULT_SHORTS.map(s => `${a('https://www.youtube.com/shorts/' + s.yt, s.name)}${s.meta ? ' · ' + esc(s.meta) : ''}`))}</section>`,
      `<section><h2>${esc(t.musicTitle)}</h2>${li(DEFAULT_SONGS.map(s => `${a('https://www.youtube.com/watch?v=' + s.id, s.he)}${s.meta ? ' · ' + esc(s.meta) : ''}`))}</section>`,
      `<section><h2>להאזנה בכל פלטפורמות המוזיקה</h2>${li(PLATFORMS.map(pl => a(pl.href, pl.label)))}</section>`,
      `<section><h2>${esc(t.reelTitle)}</h2><p>${esc(t.reelSub)}</p>${li([a('/weddings', 'סרטונים מחתונות'), a('/events', 'סרטונים מאירועים')])}</section>`
    ].filter(Boolean).join('');
  }
  return `<div class="static-page">${nav}<main>${main}${contact}</main></div>`;
}

// the admin panel's own page: out of Google, and without Analytics (Elazar's visits aren't counted)
export const adminHeadHtml = () => `<title>ניהול · ${esc(SITE_NAME)}</title>\n<meta name="robots" content="noindex, nofollow">`;

/* ---------- sitemap.xml and robots.txt ---------- */
export function sitemapXml(date = new Date().toISOString().slice(0, 10)) {
  const urls = PAGES.map(p => `  <url><loc>${urlOf(p.path)}</loc><lastmod>${date}</lastmod></url>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}
export const robotsTxt = () => `User-agent: *\nDisallow: /admin\n\nSitemap: ${SITE_URL}/sitemap.xml\n`;
