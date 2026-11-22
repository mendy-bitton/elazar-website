/* LET'S TALK (בואו נדבר): the closing call. The mirrored figure faces the words,
   and the stage lights come up as the pointer reaches for a way to get in touch. */
import { useEffect, useRef } from 'react';
import { PhoneIcon, WhatsappLogoIcon, InstagramLogoIcon } from '@phosphor-icons/react';
import { gsap } from '../lib/motion';
import { reduce, $, $$ } from '../lib/env';
import { scope } from '../lib/scope';
import { stageLights } from '../lib/stageLights';
import { useContent, telHref, waHref, igHref, igHandle } from '../lib/content';

// the ways to get in touch (from the details saved in /admin); on hover each icon takes its own brand colour
const ways = c => [
  c.phone && { href: telHref(c.phone), label: 'טלפון', value: c.phone, ltr: true, Icon: PhoneIcon, brand: 'var(--gold-2)', ink: 'var(--on-gold)' },
  c.whatsapp && { href: waHref(c.whatsapp, c.whatsappText), label: 'וואטסאפ', value: 'שלחו הודעה', external: true, Icon: WhatsappLogoIcon, brand: '#25D366' },
  c.instagram && { href: igHref(c.instagram), label: 'אינסטגרם', value: '@' + igHandle(c.instagram), ltr: true, external: true, Icon: InstagramLogoIcon, brand: '#E4405F' }
].filter(Boolean);

const ARROW = <span className="cta__arrow" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M17 7 7 17M7 9.5V17h7.5" /></svg></span>;

export default function Cta() {
  const ref = useRef(null);
  const { texts, contact } = useContent();

  useEffect(() => {
    const sec = ref.current;
    const s = scope();
    let boost = 0, target = 0;
    stageLights($('.cta__lights', sec), s, { boost: () => boost, count: .9 });
    $$('.cta__item', sec).forEach(a => {
      s.on(a, 'pointerenter', () => { target = 1; });
      s.on(a, 'pointerleave', () => { target = 0; });
      s.on(a, 'focus', () => { target = 1; });
      s.on(a, 'blur', () => { target = 0; });
    });
    s.tick((t, dt) => { boost += (target - boost) * (1 - Math.exp(-dt / 1000 * 4)); });

    const ctx = gsap.context(() => {
      if (reduce) return;
      gsap.from('.cta__title .line__in', {
        yPercent: 110, duration: 1.3, ease: 'expo.out', stagger: .09,
        scrollTrigger: { trigger: sec, start: 'top 70%', once: true }
      });
      // he steps up into the light as the words come in
      gsap.from('.cta__figure', {
        yPercent: 7, opacity: 0, duration: 1.8, ease: 'expo.out',
        scrollTrigger: { trigger: sec, start: 'top 70%', once: true }
      });
      gsap.from('.cta__item', {
        y: 40, opacity: 0, duration: 1.2, ease: 'expo.out', stagger: .08,
        scrollTrigger: { trigger: $('.cta__links', sec), start: 'top 95%', once: true }
      });
    }, sec);

    return () => { s.dispose(); ctx.revert(); };
  }, []);

  return (
    <section className="cta" id="contact" aria-labelledby="cta-title" ref={ref}>
      <canvas className="cta__lights" aria-hidden="true" />
      <div className="cta__glow" aria-hidden="true" />
      <div className="cta__figure" aria-hidden="true"><img src="/assets/silhouette.svg" alt="" width="501" height="664" loading="lazy" decoding="async" /></div>
      <h2 className="cta__title" id="cta-title">
        <span className="line"><span className="line__in">{texts.ctaLine1}</span></span>
        {texts.ctaLine2 && <span className="line"><span className="line__in">{texts.ctaLine2}</span></span>}
        <span className="line"><span className="line__in"><span className="cta__gold">{texts.ctaLine3}</span></span></span>
      </h2>
      <div className="cta__links">
        {ways(contact).map(({ href, label, value, ltr, external, Icon, brand, ink }) => (
          <a key={label} className="cta__item" href={href} {...(external ? { target: '_blank', rel: 'noopener' } : {})}
            style={{ '--brand': brand, ...(ink ? { '--brand-ink': ink } : {}) }}>
            <span className="cta__icon" aria-hidden="true"><Icon weight="light" /></span>
            <span className="cta__text">
              <span className="cta__label">{label}</span>
              <span className="cta__value" dir={ltr ? 'ltr' : undefined}>{value}</span>
            </span>
            {ARROW}
          </a>
        ))}
      </div>
    </section>
  );
}
