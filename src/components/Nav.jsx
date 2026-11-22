/* NAV + MENU (home page): the bar hides on the way down and returns on the way up;
   the menu opens as a circle growing out of its button. */
import { useEffect, useRef } from 'react';
import { Link } from 'react-router';
import { gsap, getLenis, lockScroll } from '../lib/motion';
import { $$ } from '../lib/env';
import { scope } from '../lib/scope';
import { ui } from '../lib/ui';

const LINKS = [
  ['#top', 'ראשי'],
  ['#moments', 'רגעים מהשמחות'],
  ['#music', 'המוזיקה שלי'],
  ['#stage', 'מהבמה'],
  ['#contact', 'בואו נדבר']
];

export default function Nav() {
  const navRef = useRef(null);
  const menuRef = useRef(null);
  const btnRef = useRef(null);

  useEffect(() => {
    const nav = navRef.current, menu = menuRef.current, menuBtn = btnRef.current;
    const s = scope();
    let origin = [0, 0];

    function openMenu() {
      ui.menuOpen = true;
      const r = menuBtn.getBoundingClientRect();
      origin = [r.left + r.width / 2, r.top + r.height / 2];
      menu.classList.add('is-open');
      menu.setAttribute('aria-hidden', 'false');
      menuBtn.setAttribute('aria-expanded', 'true');
      nav.classList.remove('is-hidden');
      lockScroll(true);
      gsap.killTweensOf(menu);
      gsap.fromTo(menu, { clipPath: `circle(0px at ${origin[0]}px ${origin[1]}px)` },
        { clipPath: `circle(${Math.hypot(innerWidth, innerHeight)}px at ${origin[0]}px ${origin[1]}px)`, duration: 1, ease: 'expo.inOut' });
      gsap.fromTo($$('.menu__label', menu), { yPercent: 110 }, { yPercent: 0, duration: 1.1, ease: 'expo.out', stagger: .06, delay: .35 });
    }
    function closeMenu() {
      if (!ui.menuOpen) return;
      ui.menuOpen = false;
      menu.setAttribute('aria-hidden', 'true');
      menuBtn.setAttribute('aria-expanded', 'false');
      gsap.killTweensOf(menu);
      gsap.to(menu, { clipPath: `circle(0px at ${origin[0]}px ${origin[1]}px)`, duration: .8, ease: 'expo.inOut', onComplete: () => menu.classList.remove('is-open') });
      lockScroll(false);
    }
    ui.closeMenu = closeMenu;
    s.add(() => { ui.closeMenu = () => {}; if (ui.menuOpen) { ui.menuOpen = false; lockScroll(false); } gsap.killTweensOf(menu); });
    s.on(menuBtn, 'click', () => (ui.menuOpen ? closeMenu() : openMenu()));
    s.on(document, 'keydown', e => { if (e.key === 'Escape') closeMenu(); });

    let lastY = 0;
    const onScrollNav = y => {
      nav.classList.toggle('is-scrolled', y > 24);
      const d = y - lastY;
      if (Math.abs(d) < 6) return;
      nav.classList.toggle('is-hidden', d > 0 && y > innerHeight * .5 && !ui.menuOpen);
      lastY = y;
    };
    const lenis = getLenis();
    if (lenis) s.add(lenis.on('scroll', ({ scroll }) => onScrollNav(scroll)));
    else s.on(window, 'scroll', () => onScrollNav(scrollY), { passive: true });

    return () => s.dispose();
  }, []);

  return (
    <>
      <header className="nav" ref={navRef}>
        <a className="nav__brand" href="#top" aria-label="אלעזר ביטון, לראש העמוד"><span className="logo-mark" /></a>
        <div className="nav__actions">
          <a className="pill pill--gold" href="#contact">בואו נדבר</a>
          <button className="pill pill--line nav__menu" ref={btnRef} type="button" aria-expanded="false" aria-controls="menu">
            <span className="nav__menu-label">תפריט</span><span className="burger" aria-hidden="true"><i /><i /></span>
          </button>
        </div>
      </header>

      <div className="menu" id="menu" ref={menuRef} aria-hidden="true">
        <div className="menu__inner">
          <nav className="menu__links" aria-label="ניווט ראשי">
            {LINKS.map(([href, label]) => <a key={href} href={href}><span className="menu__label">{label}</span></a>)}
          </nav>
        </div>
      </div>
    </>
  );
}

/* The gallery pages' bar: the logo home, and a way back to the "מהבמה" section */
export function SubNav() {
  return (
    <header className="nav">
      <Link className="nav__brand" to="/" aria-label="אלעזר ביטון, לדף הבית"><span className="logo-mark" /></Link>
      <div className="nav__actions">
        <Link className="pill pill--line subpage__back" to="/#stage">חזרה לדף הבית</Link>
      </div>
    </header>
  );
}
