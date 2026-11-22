/* The app shell: shared parts around the routed pages */
import { useState } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router';
import { markBooted } from './lib/ui';
import SvgDefs from './components/SvgDefs';
import Cursor from './components/Cursor';
import Footer from './components/Footer';
import { VideoProvider } from './components/VideoModal';
import Home from './pages/Home';
import Gallery from './pages/Gallery';

function Shell() {
  const { pathname } = useLocation();
  // the loader is the home page's opening; arriving on another page skips it for the whole visit
  useState(() => { if (pathname !== '/') markBooted(); });

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
    </VideoProvider>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Shell />
    </BrowserRouter>
  );
}
