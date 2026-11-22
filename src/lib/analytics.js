/* GOOGLE ANALYTICS 4: what's counted.
   gtag itself is loaded in the page's <head> (only on a real build, and only once a Measurement ID
   is set in site.config.js); without it every function here quietly does nothing.
   - page_view: Google counts the page a visit starts on by itself; the site sends one for each
     move to another page inside the site, with the new page's title (so in GA, "Page changes based
     on browser history events" stays off, or those moves would count twice)
   - song_play / video_play: a song from the shelf, a moment, a clip from the galleries
   - contact_click: phone, WhatsApp, Instagram
   - platform_click: Spotify, Apple Music, YouTube... */
const send = (...args) => { if (typeof window !== 'undefined' && typeof window.gtag === 'function') window.gtag(...args); };

export const track = (name, params = {}) => send('event', name, params);

export const pageView = () => send('event', 'page_view', {
  page_location: location.href, page_path: location.pathname, page_title: document.title
});

// one listener for every contact and platform link on the site, wherever it is
export function trackClicks() {
  const onClick = e => {
    const a = e.target.closest && e.target.closest('a[href]');
    if (!a) return;
    const href = a.getAttribute('href');
    const where = a.closest('.popup') ? 'popup' : (a.closest('section[id]')?.id || '');   // contact, hero...
    if (href.startsWith('tel:')) track('contact_click', { method: 'phone', location: where });
    else if (href.includes('wa.me/')) track('contact_click', { method: 'whatsapp', location: where });
    else if (href.includes('instagram.com/')) track('contact_click', { method: 'instagram', location: where });
    else if (a.classList.contains('plat')) track('platform_click', { platform: a.querySelector('.plat__name')?.textContent || href });
  };
  document.addEventListener('click', onClick, true);
  return () => document.removeEventListener('click', onClick, true);
}
