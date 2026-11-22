/* =========================================================
   ADMIN PANEL (/admin): Elazar signs in with Supabase and manages
   the contact details, the texts and the first-visit popup.
   Only a user listed in the "admins" table can change anything;
   the database rules (RLS) enforce it, not just this screen.
   ========================================================= */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase, BUCKET } from './client';
import { DEFAULTS, mergeContent, useContent, telHref, waHref, igHref } from '../lib/content';
import './admin.css';

export default function AdminApp() {
  const [session, setSession] = useState(undefined);         // undefined while checking
  const [isAdmin, setIsAdmin] = useState(null);
  const [aal, setAal] = useState(null);                      // { current, next }: has the authenticator code been entered?

  useEffect(() => {
    document.title = 'ניהול האתר · אלעזר ביטון';
    const meta = document.createElement('meta');
    meta.name = 'robots'; meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);
    return () => meta.remove();
  }, []);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) { setIsAdmin(null); setAal(null); return; }
    let alive = true;
    supabase.from('admins').select('user_id').eq('user_id', session.user.id).maybeSingle()
      .then(({ data, error }) => { if (alive) setIsAdmin(!error && !!data); });
    supabase.auth.mfa.getAuthenticatorAssuranceLevel()
      .then(({ data }) => { if (alive) setAal(data ? { current: data.currentLevel, next: data.nextLevel } : { current: 'aal1', next: 'aal1' }); });
    return () => { alive = false; };
  }, [session]);

  if (!supabase) return <Frame><p className="adm-note">החיבור ל־Supabase לא מוגדר (חסרים ערכים בקובץ ‎.env).</p></Frame>;
  if (session === undefined) return <Frame><p className="adm-note">טוען…</p></Frame>;
  if (!session) return <Login />;
  if (!aal) return <Frame><p className="adm-note">טוען…</p></Frame>;
  // second step: the code from the authenticator app (set it up once, then enter it every login)
  if (aal.current !== 'aal2') return aal.next === 'aal2' ? <MfaVerify /> : <MfaEnroll />;
  if (isAdmin === null) return <Frame><p className="adm-note">טוען…</p></Frame>;
  if (!isAdmin) {
    return (
      <Frame>
        <div className="adm-card adm-narrow">
          <h1 className="adm-h1">אין הרשאה</h1>
          <p className="adm-note">המשתמש {session.user.email} מחובר, אבל הוא לא מוגדר כמנהל האתר.</p>
          <button className="adm-btn adm-btn--ghost" type="button" onClick={() => supabase.auth.signOut()}>התנתקות</button>
        </div>
      </Frame>
    );
  }
  return <Panel session={session} />;
}

function Frame({ children, header }) {
  return (
    <div className="adm" dir="rtl">
      {header}
      <main className="adm-main">{children}</main>
    </div>
  );
}

/* ---------- sign in ---------- */
function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (!email.trim() || !password) { setError('צריך למלא אימייל וסיסמה.'); return; }
    setBusy(true); setError('');
    const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (err) setError(/invalid/i.test(err.message) ? 'האימייל או הסיסמה לא נכונים.' : 'לא הצלחנו להתחבר. נסו שוב בעוד רגע.');
  }

  return (
    <Frame>
      <form className="adm-card adm-narrow adm-login" onSubmit={submit} noValidate>
        <span className="logo-mark adm-logo" aria-hidden="true" />
        <h1 className="adm-h1">ניהול האתר</h1>
        <label className="adm-field">
          <span className="adm-label">אימייל</span>
          <input className="adm-input" type="email" dir="ltr" autoComplete="username" value={email}
            onChange={e => { setEmail(e.target.value); setError(''); }} />
        </label>
        <label className="adm-field">
          <span className="adm-label">סיסמה</span>
          <input className="adm-input" type="password" dir="ltr" autoComplete="current-password" value={password}
            onChange={e => { setPassword(e.target.value); setError(''); }} />
        </label>
        {error && <p className="adm-error" role="alert">{error}</p>}
        <button className="adm-btn" type="submit" disabled={busy}>{busy ? 'מתחבר…' : 'כניסה'}</button>
      </form>
    </Frame>
  );
}

/* ---------- second step: the authenticator app ---------- */
const BAD_CODE = 'הקוד לא נכון או שפג תוקפו. נסו את הקוד הבא שמופיע באפליקציה.';

function CodeInput({ value, onChange, onComplete }) {
  return (
    <input className="adm-input adm-code" dir="ltr" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]*" maxLength={6}
      aria-label="קוד בן 6 ספרות" autoFocus value={value}
      onChange={e => {
        const v = e.target.value.replace(/\D/g, '').slice(0, 6);
        onChange(v);
        if (v.length === 6) onComplete(v);
      }} />
  );
}

// first login: scan a QR code into the authenticator app, then confirm with its code
function MfaEnroll() {
  const [factor, setFactor] = useState(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      // clear a half-finished setup from an earlier visit, then start a fresh one
      const { data: list } = await supabase.auth.mfa.listFactors();
      for (const f of (list && list.all) || []) {
        if (f.status === 'unverified') await supabase.auth.mfa.unenroll({ factorId: f.id });
      }
      const { data, error: err } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'ניהול האתר', issuer: 'Elazar Bitton' });
      if (!alive) return;
      if (err) { setError('לא הצלחנו להתחיל את ההגדרה: ' + err.message); return; }
      setFactor({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
    })();
    return () => { alive = false; };
  }, []);

  async function confirm(v = code) {
    if (v.length !== 6 || !factor) { setError('צריך להזין את 6 הספרות מהאפליקציה.'); return; }
    setBusy(true); setError('');
    const { error: err } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code: v });
    setBusy(false);
    if (err) { setError(BAD_CODE); setCode(''); }
    // on success Supabase upgrades the session and the panel opens by itself
  }

  return (
    <Frame>
      <div className="adm-card adm-narrow">
        <h1 className="adm-h1">הגנה בשני שלבים</h1>
        <p className="adm-note">פעם אחת בלבד: מחברים את הכניסה לאפליקציית אימות בטלפון. מעכשיו כל כניסה תבקש גם סיסמה וגם קוד מהאפליקציה.</p>
        <ol className="adm-steps">
          <li>מתקינים בטלפון אפליקציית אימות: Google Authenticator או Microsoft Authenticator.</li>
          <li>באפליקציה לוחצים על "+" ובוחרים בסריקת קוד QR.</li>
          <li>סורקים את הקוד ומזינים כאן את 6 הספרות שמופיעות.</li>
        </ol>
        <div className="adm-qr">{factor ? <img src={factor.qr} alt="קוד QR לחיבור אפליקציית האימות" /> : <span className="adm-hint">מכין קוד…</span>}</div>
        {factor && (
          <details className="adm-details">
            <summary>אי אפשר לסרוק? מקלידים את הקוד הזה באפליקציה</summary>
            <code className="adm-secret" dir="ltr">{factor.secret}</code>
          </details>
        )}
        <p className="adm-hint">טיפ: אפשר לסרוק את אותו קוד QR גם בטלפון נוסף, כגיבוי למקרה שהטלפון אובד.</p>
        <CodeInput value={code} onChange={v => { setCode(v); setError(''); }} onComplete={confirm} />
        {error && <p className="adm-error" role="alert">{error}</p>}
        <button className="adm-btn" type="button" onClick={() => confirm()} disabled={busy || !factor}>{busy ? 'בודק…' : 'אישור'}</button>
        <button className="adm-btn adm-btn--ghost" type="button" onClick={() => supabase.auth.signOut()}>התנתקות</button>
      </div>
    </Frame>
  );
}

// every later login: the 6-digit code from the app
function MfaVerify() {
  const [factorId, setFactorId] = useState(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.mfa.listFactors().then(({ data }) => setFactorId(data && data.totp && data.totp[0] ? data.totp[0].id : null));
  }, []);

  async function confirm(v = code) {
    if (v.length !== 6 || !factorId) { setError('צריך להזין את 6 הספרות מהאפליקציה.'); return; }
    setBusy(true); setError('');
    const { error: err } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: v });
    setBusy(false);
    if (err) { setError(BAD_CODE); setCode(''); }
  }

  return (
    <Frame>
      <div className="adm-card adm-narrow adm-login">
        <span className="logo-mark adm-logo" aria-hidden="true" />
        <h1 className="adm-h1">קוד אימות</h1>
        <p className="adm-note">פותחים את אפליקציית האימות בטלפון ומזינים את הקוד של "Elazar Bitton".</p>
        <CodeInput value={code} onChange={v => { setCode(v); setError(''); }} onComplete={confirm} />
        {error && <p className="adm-error" role="alert">{error}</p>}
        <button className="adm-btn" type="button" onClick={() => confirm()} disabled={busy || !factorId}>{busy ? 'בודק…' : 'כניסה'}</button>
        <button className="adm-btn adm-btn--ghost" type="button" onClick={() => supabase.auth.signOut()}>התנתקות</button>
      </div>
    </Frame>
  );
}

/* ---------- the panel ---------- */
const TABS =[['contact', 'פרטי קשר'], ['texts', 'טקסטים'], ['popup', 'פופאפ']];

function Panel({ session }) {
  const { reload } = useContent();
  const [tab, setTab] = useState('contact');
  const [raw, setRaw] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [toast, setToast] = useState('');
  const toastTimer = useRef(0);

  useEffect(() => {
    supabase.from('settings').select('key,value').then(({ data, error }) => {
      if (error) { setLoadError('לא הצלחנו לטעון את ההגדרות. בדקו שהרצתם את קובץ ההגדרה של מסד הנתונים.'); setRaw({}); return; }
      setRaw(Object.fromEntries(data.map(r => [r.key, r.value || {}])));
    });
  }, []);

  const notify = msg => { setToast(msg); clearTimeout(toastTimer.current); toastTimer.current = setTimeout(() => setToast(''), 3200); };

  // save one area and refresh what the site shows
  const save = useCallback(async (key, value) => {
    const { error } = await supabase.from('settings').upsert({ key, value });
    if (error) throw error;
    setRaw(r => ({ ...r, [key]: value }));
    reload();
    notify('נשמר. האתר כבר מעודכן.');
  }, [reload]);

  const content = useMemo(() => (raw ? mergeContent(raw) : null), [raw]);

  const header = (
    <header className="adm-top">
      <a className="adm-brand" href="/" target="_blank" rel="noopener" aria-label="לאתר, בכרטיסייה חדשה"><span className="logo-mark" /></a>
      <span className="adm-title">ניהול האתר</span>
      <span className="adm-user" dir="ltr">{session.user.email}</span>
      <a className="adm-btn adm-btn--ghost adm-btn--sm" href="/" target="_blank" rel="noopener">לצפייה באתר</a>
      <button className="adm-btn adm-btn--ghost adm-btn--sm" type="button" onClick={() => supabase.auth.signOut()}>התנתקות</button>
    </header>
  );

  return (
    <Frame header={header}>
      <nav className="adm-tabs" aria-label="אזורי ניהול">
        {TABS.map(([id, label]) => (
          <button key={id} type="button" className={`adm-tab${tab === id ? ' is-on' : ''}`} aria-pressed={tab === id} onClick={() => setTab(id)}>{label}</button>
        ))}
      </nav>
      {loadError && <p className="adm-error" role="alert">{loadError}</p>}
      {!content ? <p className="adm-note">טוען…</p> : (
        <>
          {tab === 'contact' && <ContactForm initial={content.contact} onSave={v => save('contact', v)} />}
          {tab === 'texts' && <TextsForm initial={content.texts} onSave={v => save('texts', v)} />}
          {tab === 'popup' && <PopupForm initial={content.popup} onSave={v => save('popup', v)} />}
        </>
      )}
      <div className={`adm-toast${toast ? ' is-on' : ''}`} role="status" aria-live="polite">{toast}</div>
    </Frame>
  );
}

/* ---------- shared form bits ---------- */
function useForm(initial) {
  const [v, setV] = useState(initial);
  const set = (k, val) => setV(o => ({ ...o, [k]: val }));
  const dirty = JSON.stringify(v) !== JSON.stringify(initial);
  return [v, set, dirty, setV];
}

function Field({ label, hint, children }) {
  return (
    <label className="adm-field">
      <span className="adm-label">{label}</span>
      {children}
      {hint && <span className="adm-hint">{hint}</span>}
    </label>
  );
}

function SaveBar({ dirty, busy, error, onSave }) {
  return (
    <div className="adm-savebar">
      {error && <p className="adm-error" role="alert">{error}</p>}
      <button className="adm-btn" type="button" onClick={onSave} disabled={busy}>{busy ? 'שומר…' : dirty ? 'שמירה' : 'שמירה (אין שינויים)'}</button>
    </div>
  );
}

// a problem worth showing as is (not as a technical failure)
const fail = msg => { throw Object.assign(new Error(msg), { userFacing: true }); };

// run a save, showing errors in the form instead of failing silently
function useSaver(task) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const run = async value => {
    setBusy(true); setError('');
    try { await task(value); } catch (e) { setError(e && e.userFacing ? e.message : 'השמירה נכשלה: ' + (e && e.message ? e.message : 'נסו שוב.')); }
    setBusy(false);
  };
  return [run, busy, error, setError];
}

/* ---------- contact details ---------- */
function ContactForm({ initial, onSave }) {
  const [v, set, dirty] = useForm(initial);
  const [run, busy, error, setError] = useSaver(onSave);
  const digits = s => String(s || '').replace(/\D/g, '').length;

  const submit = () => {
    if (v.phone && digits(v.phone) < 9) { setError('מספר הטלפון קצר מדי.'); return; }
    if (v.whatsapp && digits(v.whatsapp) < 9) { setError('מספר הוואטסאפ קצר מדי.'); return; }
    run(v);
  };

  return (
    <section className="adm-card">
      <h2 className="adm-h2">פרטי קשר</h2>
      <p className="adm-note">מופיעים בחלק "בואו נדבר" בתחתית האתר. שדה ריק מסתיר את השורה שלו.</p>
      <div className="adm-grid">
        <Field label="טלפון" hint="כך הוא יוצג באתר, למשל 052.810.8100">
          <input className="adm-input" dir="ltr" inputMode="tel" value={v.phone} onChange={e => set('phone', e.target.value)} />
        </Field>
        <Field label="מספר וואטסאפ" hint="המספר שאליו נפתחת השיחה">
          <input className="adm-input" dir="ltr" inputMode="tel" value={v.whatsapp} onChange={e => set('whatsapp', e.target.value)} />
        </Field>
      </div>
      <Field label="ההודעה שנכתבת מראש בוואטסאפ" hint="המבקר יכול לערוך אותה לפני השליחה">
        <textarea className="adm-input" rows={4} value={v.whatsappText} onChange={e => set('whatsappText', e.target.value)} />
      </Field>
      <Field label="אינסטגרם" hint="שם המשתמש, עם או בלי @">
        <input className="adm-input" dir="ltr" value={v.instagram} onChange={e => set('instagram', e.target.value)} />
      </Field>
      <div className="adm-links">
        {v.phone && <a href={telHref(v.phone)}>בדיקת טלפון</a>}
        {v.whatsapp && <a href={waHref(v.whatsapp, v.whatsappText)} target="_blank" rel="noopener">בדיקת וואטסאפ</a>}
        {v.instagram && <a href={igHref(v.instagram)} target="_blank" rel="noopener">בדיקת אינסטגרם</a>}
      </div>
      <SaveBar dirty={dirty} busy={busy} error={error} onSave={submit} />
    </section>
  );
}

/* ---------- texts ---------- */
const TEXT_GROUPS = [
  ['ראש העמוד', [
    ['heroTitle1', 'כותרת, שורה ראשונה'],
    ['heroTitle2', 'כותרת, שורה שנייה (המיקרופון בסופה)'],
    ['heroLead1', 'פסקה ראשונה', true],
    ['heroLead2', 'פסקה שנייה (אפשר להשאיר ריק)', true]
  ]],
  ['רגעים מהשמחות', [['momentsTitle', 'כותרת']]],
  ['המוזיקה שלי', [['musicTitle', 'כותרת'], ['musicSub', 'שורה מתחת לכותרת']]],
  ['מהבמה', [['reelTitle', 'כותרת'], ['reelSub', 'שורה מתחת לכותרת']]],
  ['בואו נדבר', [['ctaLine1', 'שורה ראשונה'], ['ctaLine2', 'שורה שנייה (אפשר להשאיר ריק)'], ['ctaLine3', 'שורה שלישית, בזהב']]]
];
const OPTIONAL = new Set(['heroLead2', 'ctaLine2']);

function TextsForm({ initial, onSave }) {
  const [v, set, dirty] = useForm(initial);
  const [run, busy, error] = useSaver(onSave);
  return (
    <section className="adm-card">
      <h2 className="adm-h2">טקסטים</h2>
      <p className="adm-note">שדה שמשאירים ריק חוזר לטקסט המקורי (מוצג באפור בתוך השדה), חוץ משדות שמסומנים "אפשר להשאיר ריק", שפשוט לא יוצגו.</p>
      {TEXT_GROUPS.map(([group, fields]) => (
        <fieldset key={group} className="adm-group">
          <legend className="adm-legend">{group}</legend>
          {fields.map(([k, label, long]) => (
            <Field key={k} label={label}>
              {long
                ? <textarea className="adm-input" rows={3} placeholder={OPTIONAL.has(k) ? '' : DEFAULTS.texts[k]} value={v[k]} onChange={e => set(k, e.target.value)} />
                : <input className="adm-input" placeholder={DEFAULTS.texts[k]} value={v[k]} onChange={e => set(k, e.target.value)} />}
            </Field>
          ))}
        </fieldset>
      ))}
      <SaveBar dirty={dirty} busy={busy} error={error} onSave={() => run(v)} />
    </section>
  );
}

/* ---------- the first-visit popup ---------- */
function PopupForm({ initial, onSave }) {
  const [v, set, dirty] = useForm(initial);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState('');
  const [showAgain, setShowAgain] = useState(false);
  const [run, busy, error, setError] = useSaver(async () => {
    if (v.enabled && !file && !v.image) fail('כדי להפעיל את הפופאפ צריך לבחור תמונה.');
    if (v.startsAt && v.endsAt && v.endsAt < v.startsAt) fail('תאריך הסיום לפני תאריך ההתחלה.');
    let next = { ...v };
    if (file) {
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
      const path = `popup/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, { cacheControl: '31536000', upsert: false, contentType: file.type });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
      if (v.path) await supabase.storage.from(BUCKET).remove([v.path]).catch(() => {});   // the old image is no longer needed
      next = { ...next, image: data.publicUrl, path };
    }
    if (showAgain || !next.version) next.version = Date.now();         // a new version is shown once more to everyone
    await onSave(next);
    setFile(null); setShowAgain(false);
  });

  useEffect(() => {
    if (!file) { setPreview(''); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const pick = e => {
    const f = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!f) return;
    if (!/^image\/(jpeg|png|webp|gif)$/.test(f.type)) { setError('אפשר להעלות רק תמונה (JPG, PNG, WEBP או GIF).'); return; }
    if (f.size > 10 * 1024 * 1024) { setError('התמונה גדולה מ־10MB. נסו קובץ קטן יותר.'); return; }
    setError(''); setFile(f); setShowAgain(true);
  };

  const submit = () => run();

  const removeImage = () => { setFile(null); set('image', ''); set('enabled', false); };
  const shown = preview || v.image;

  return (
    <section className="adm-card">
      <h2 className="adm-h2">פופאפ בכניסה לאתר</h2>
      <p className="adm-note">תמונה שקופצת לכל מבקר פעם אחת, בכניסה הראשונה, ולא בכל רענון.</p>

      <label className="adm-switch">
        <input type="checkbox" checked={!!v.enabled} onChange={e => set('enabled', e.target.checked)} />
        <span className="adm-switch__track" aria-hidden="true"><span /></span>
        <span>{v.enabled ? 'הפופאפ פעיל' : 'הפופאפ כבוי'}</span>
      </label>

      <div className="adm-popup">
        <div className="adm-popup__img">
          {shown ? <img src={shown} alt="" /> : <span className="adm-hint">עוד לא נבחרה תמונה</span>}
        </div>
        <div className="adm-popup__actions">
          <label className="adm-btn adm-btn--ghost">
            {shown ? 'החלפת תמונה' : 'בחירת תמונה'}
            <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={pick} hidden />
          </label>
          {shown && <button className="adm-btn adm-btn--ghost" type="button" onClick={removeImage}>הסרת התמונה</button>}
        </div>
      </div>

      <Field label="תיאור התמונה" hint="לנגישות: מה רואים בתמונה, במשפט קצר">
        <input className="adm-input" value={v.alt} onChange={e => set('alt', e.target.value)} />
      </Field>
      <div className="adm-grid">
        <Field label="קישור (לא חובה)" hint="לחיצה על התמונה או על הכפתור פותחת אותו">
          <input className="adm-input" dir="ltr" type="url" placeholder="https://" value={v.link} onChange={e => set('link', e.target.value)} />
        </Field>
        <Field label="הטקסט על הכפתור">
          <input className="adm-input" placeholder="לפרטים" value={v.linkLabel} onChange={e => set('linkLabel', e.target.value)} />
        </Field>
      </div>
      <div className="adm-grid">
        <Field label="מתאריך (לא חובה)"><input className="adm-input" type="date" value={v.startsAt} onChange={e => set('startsAt', e.target.value)} /></Field>
        <Field label="עד תאריך (לא חובה)"><input className="adm-input" type="date" value={v.endsAt} onChange={e => set('endsAt', e.target.value)} /></Field>
      </div>
      <label className="adm-check">
        <input type="checkbox" checked={showAgain} onChange={e => setShowAgain(e.target.checked)} />
        <span>להציג שוב גם למי שכבר ראה את הפופאפ</span>
      </label>

      <SaveBar dirty={dirty || !!file || showAgain} busy={busy} error={error} onSave={submit} />
    </section>
  );
}
