/* The <head> follows the page: on every page change, the title, description, canonical link,
   link-preview tags and structured data switch to the new page's (from seo.js), and the
   visit is counted. The build already wrote each page's own tags; this keeps them right
   while moving around the site without reloading. /admin is kept out of Google. */
import { useEffect } from 'react';
import { useLocation } from 'react-router';
import { pageFor, urlOf, structuredData, ldJson } from './seo';
import { pageView, trackClicks } from './analytics';

function setTag(selector, make, attr, value) {
  let el = document.head.querySelector(selector);
  if (!el) { el = make(); document.head.appendChild(el); }
  el.setAttribute(attr, value);
}
let firstPage = true;                          // Google counts the page the visit starts on itself

const meta = (key, value, by = 'name') => setTag(`meta[${by}="${key}"]`, () => {
  const m = document.createElement('meta'); m.setAttribute(by, key); return m;
}, 'content', value);

export function usePageHead(contact) {
  const { pathname } = useLocation();
  const admin = pathname === '/admin' || pathname.startsWith('/admin/');

  useEffect(() => trackClicks(), []);

  useEffect(() => {
    if (admin) { meta('robots', 'noindex, nofollow'); return; }
    const p = pageFor(pathname), url = urlOf(p.path);
    document.title = p.title;
    meta('description', p.description);
    meta('robots', 'index, follow, max-image-preview:large');
    setTag('link[rel="canonical"]', () => { const l = document.createElement('link'); l.rel = 'canonical'; return l; }, 'href', url);
    meta('og:title', p.title, 'property');
    meta('og:description', p.description, 'property');
    meta('og:url', url, 'property');
    if (firstPage) firstPage = false; else pageView();
  }, [pathname, admin]);

  // the structured data carries the contact details saved in /admin
  useEffect(() => {
    if (admin) return;
    const ld = document.getElementById('ld');
    if (ld) ld.textContent = ldJson(structuredData(pathname, contact));
  }, [pathname, admin, contact]);
}
