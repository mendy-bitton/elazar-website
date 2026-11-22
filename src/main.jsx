import { createRoot } from 'react-dom/client';
import './styles/style.css';
import { initLenis, ScrollTrigger } from './lib/motion';
import App from './App';

if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
// smooth scrolling exists before any component looks for it
initLenis();
window.scrollTo(0, 0);
addEventListener('load', () => ScrollTrigger.refresh());

createRoot(document.getElementById('root')).render(<App />);
