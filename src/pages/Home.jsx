/* The home page: loader (first visit only), nav, and the sections in order */
import { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router';
import { goTo, ScrollTrigger } from '../lib/motion';
import { isBooted, ui } from '../lib/ui';
import Loader from '../components/Loader';
import Nav from '../components/Nav';
import Hero from '../sections/Hero';
import EventsStrip from '../sections/EventsStrip';
import Moments from '../sections/Moments';
import Music from '../sections/Music';
import Platforms from '../sections/Platforms';
import Reel from '../sections/Reel';
import Cta from '../sections/Cta';

export default function Home() {
  const [loading, setLoading] = useState(() => !isBooted());
  const onGone = useCallback(() => setLoading(false), []);
  const { hash } = useLocation();

  // in-page links (#music, #contact...) glide to their section, closing the menu first
  useEffect(() => {
    const onClick = e => {
      const a = e.target.closest('a[href^="#"]');
      if (!a) return;
      e.preventDefault();
      const id = a.getAttribute('href');
      const el = id.length > 1 ? document.querySelector(id) : null;
      const wasOpen = ui.menuOpen;
      if (wasOpen) ui.closeMenu();
      if (el) setTimeout(() => goTo(el), wasOpen ? 380 : 0);
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);

  // arriving from another page: start at the top, or jump straight to the #section asked for
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      ScrollTrigger.refresh();
      const el = hash ? document.querySelector(hash) : null;
      goTo(el || 0, { immediate: true });
    });
    return () => cancelAnimationFrame(raf);
    // only when the page opens
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      {loading && <Loader onGone={onGone} />}
      <Nav />
      <main>
        <Hero />
        <EventsStrip />
        <Moments />
        <Music />
        <Platforms />
        <Reel />
        <Cta />
      </main>
    </>
  );
}
