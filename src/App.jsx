/* The app shell: shared parts around the routed pages.
   /admin is a separate world: its own chunk, no site chrome around it. */
import { lazy, Suspense, useState } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router';
import { markBooted } from './lib/ui';
import { ContentProvider } from './lib/content';
import SvgDefs from './components/SvgDefs';
import Cursor from './components/Cursor';
import Footer from './components/Footer';
import SitePopup from './components/SitePopup';
import { VideoProvider } from './components/VideoModal';
import Home from './pages/Home';
import Gallery from './pages/Gallery';

const AdminApp = lazy(() => import('./admin/AdminApp'));

function Shell() {
  const { pathname } = useLocation();
  // the loader is the home page's opening; arriving on another page skips it for the whole visit
  useState(() => { if (pathname !== '/') markBooted(); });

  if (pathname === '/admin' || pathname.startsWith('/admin/')) {
    return <Suspense fallback={null}><AdminApp /></Suspense>;
  }

  return (
    <VideoProvider>
      <SvgDefs />
      <Cursor />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/weddings" element={<Gallery tag="weddings" title="חתונות" kind="חתונה" />} />
        <Route path="/events" element={<Gallery tag="events" title="אירועים" />} />
        <Route path="*" element={<Home />} />
      </Routes>
      <Footer />
      <SitePopup />
    </VideoProvider>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ContentProvider>
        <Shell />
      </ContentProvider>
    </BrowserRouter>
  );
}
