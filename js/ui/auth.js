/* Sign-up / sign-in, shown after the result.
 *
 * Deliberately a soft gate. The score, the full breakdown and the plan are all
 * visible without an account — gating them would be a bait-and-switch, and the
 * app's whole claim is that it measures honestly. What an account buys is the
 * thing an account is genuinely needed for: keeping the history so progress can
 * be tracked, on more than one device.
 */

import { isConfigured, sendMagicLink, currentUser, signOut, pushLocal, fetchAll } from '../lib/supabase.js';
import * as store from '../lib/store.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Renders into `mount`; returns a refresh fn for after an auth change. */
export function mountAuth(mount, { onChange } = {}) {
  const render = async () => {
    if (!isConfigured()) { mount.innerHTML = offlineNotice(); return; }

    const user = await currentUser();
    mount.innerHTML = user ? signedIn(user) : signedOut();

    if (user) {
      mount.querySelector('[data-signout]')?.addEventListener('click', async () => {
        await signOut();
        await render();
        onChange?.(null);
      });
      mount.querySelector('[data-sync]')?.addEventListener('click', (e) => sync(e.currentTarget, render));
      return;
    }

    const form = mount.querySelector('form');
    form?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const input = form.querySelector('input[type="email"]');
      const btn = form.querySelector('button[type="submit"]');
      const err = mount.querySelector('[data-err]');
      const email = input.value.trim();

      err.textContent = '';
      if (!EMAIL_RE.test(email)) { err.textContent = 'כתובת אימייל לא תקינה'; return; }

      btn.disabled = true;
      btn.textContent = 'שולח…';
      try {
        await sendMagicLink(email);
        mount.innerHTML = sent(email);
      } catch (ex) {
        err.textContent = ex.message;
        btn.disabled = false;
        btn.textContent = 'שליחת קישור כניסה';
      }
    });
  };

  render();
  return render;
}

/** Merge whatever is on this device with whatever is in the account. */
async function sync(btn, render) {
  const label = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'מסנכרן…';
  try {
    const s = store.get();
    await pushLocal({ answers: s.profile, history: s.history });
    const remote = await fetchAll();
    if (remote) {
      store.update(st => {
        // Union by timestamp; the cloud is a superset after the push above.
        const seen = new Set(st.history.map(h => h.at));
        for (const h of remote.history) if (!seen.has(h.at)) st.history.push(h);
        st.history.sort((a, b) => a.at - b.at);
        if (remote.answers && Object.keys(remote.answers).length) {
          st.profile = { ...remote.answers, ...st.profile };
        }
      });
    }
    btn.textContent = 'סונכרן ✓';
    setTimeout(() => render(), 1400);
  } catch (ex) {
    btn.textContent = label;
    btn.disabled = false;
    const err = btn.closest('[data-auth]')?.querySelector('[data-err]');
    if (err) err.textContent = ex.message;
  }
}

/* ───────────────────────────── markup ───────────────────────────── */

const offlineNotice = () => `
  <div data-auth>
    <div class="eyebrow">שמירה</div>
    <h2 style="margin:10px 0 8px">הנתונים שמורים במכשיר</h2>
    <p class="small">סנכרון ענן לא הוגדר בפרויקט הזה, ולכן ההיסטוריה נשמרת בדפדפן הזה בלבד —
      ניקוי נתוני הדפדפן ימחק אותה. אפשר לייצא JSON בכל רגע ממסך המעקב.</p>
  </div>`;

const signedOut = () => `
  <div data-auth>
    <div class="eyebrow">לשמור את התוצאה</div>
    <h2 style="margin:10px 0 8px">כדי לעקוב אחרי שיפור צריך נקודת השוואה</h2>
    <p class="small" style="margin-bottom:16px">
      הציון הזה כבר שלך — התוצאה והתוכנית פתוחות ללא הרשמה.
      חשבון שומר את ההיסטוריה כדי שהסריקה הבאה תוכל להראות מה השתנה, וגם מעביר אותה בין מכשירים.
    </p>

    <form class="authform" novalidate>
      <input type="email" inputmode="email" autocomplete="email" required
             placeholder="your@email.com" aria-label="כתובת אימייל">
      <button class="btn btn--primary" type="submit">שליחת קישור כניסה</button>
    </form>
    <p class="qfield__err" data-err role="alert"></p>

    <ul class="pledge__list" style="margin-top:18px">
      <li>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2 4 6v6c0 5 3.4 9.4 8 10 4.6-.6 8-5 8-10V6l-8-4Z"/><path d="m9 12 2 2 4-4"/></svg>
        <div><b>תמונות לעולם לא נשמרות.</b> עולים רק המספרים והשאלון. בטבלת הסריקות אין בכלל עמודה שיכולה להכיל תמונה.</div>
      </li>
      <li>
        <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>
        <div><b>בלי סיסמה.</b> נשלח קישור חד-פעמי לאימייל — אין סיסמה שתדלוף או שתצטרך לזכור.</div>
      </li>
      <li>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/></svg>
        <div><b>מחיקה מלאה בלחיצה.</b> מחיקת החשבון מוחקת את כל השורות מיידית, בלי לפנות לאף אחד.</div>
      </li>
    </ul>
  </div>`;

const sent = (email) => `
  <div data-auth class="center">
    <div class="eyebrow" style="justify-content:center">נשלח</div>
    <h2 style="margin:12px 0 8px">בדוק את תיבת הדואר</h2>
    <p class="small">שלחנו קישור כניסה ל־<b dir="ltr">${escapeHtml(email)}</b>.<br>
      לחיצה עליו תחזיר אותך לכאן מחובר. אפשר לסגור את החלון בינתיים.</p>
    <p class="xs" style="margin-top:14px">לא הגיע? כדאי לבדוק בספאם, ולוודא שהכתובת נכונה.</p>
  </div>`;

const signedIn = (user) => `
  <div data-auth>
    <div class="row-between" style="align-items:flex-start">
      <div class="grow">
        <div class="eyebrow">מחובר</div>
        <h2 style="margin:10px 0 4px">ההיסטוריה נשמרת</h2>
        <p class="small" dir="ltr" style="text-align:start">${escapeHtml(user.email ?? '')}</p>
      </div>
      <span class="chip chip--good"><i class="dot"></i>מסונכרן</span>
    </div>
    <div class="row" style="gap:10px;margin-top:16px">
      <button class="btn btn--ghost grow" data-sync>סנכרון עכשיו</button>
      <button class="btn btn--quiet" data-signout>התנתקות</button>
    </div>
    <p class="qfield__err" data-err role="alert"></p>
  </div>`;

const escapeHtml = (s = '') =>
  s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
