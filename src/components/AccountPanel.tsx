'use client';

import { useEffect, useState } from 'react';
import { Button } from './ui/Button';
import { Label } from './ui/Label';
import { isConfigured } from '@/lib/supabase/client';
import { currentUser, onAuthChange, sendMagicLink, signOut } from '@/lib/supabase/sync';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Account, shown under Progress.
 *
 * A soft gate by design: the read and the plan are fully usable without one.
 * What an account buys is keeping your history across devices, which is the
 * only thing an account is genuinely needed for here.
 */
export function AccountPanel() {
  const [email, setEmail] = useState('');
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [addr, setAddr] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isConfigured) { setSignedIn(false); return; }
    void currentUser().then((u) => { setSignedIn(Boolean(u)); setAddr(u?.email ?? null); });
    return onAuthChange((on) => {
      setSignedIn(on);
      void currentUser().then((u) => setAddr(u?.email ?? null));
    });
  }, []);

  if (!isConfigured) {
    return (
      <section className="mt-14 border-t border-hairline pt-8" aria-labelledby="acct-h">
        <Label>Saving</Label>
        <h2 id="acct-h" className="mt-2 text-h2 font-semibold text-ink">
          Stored on this device
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-muted">
          Cloud sync isn&rsquo;t set up for this deployment, so your history lives in this browser
          only. Clearing site data will remove it.
        </p>
      </section>
    );
  }

  if (signedIn === null) return null;

  if (signedIn) {
    return (
      <section className="mt-14 border-t border-hairline pt-8" aria-labelledby="acct-h">
        <Label>Account</Label>
        <h2 id="acct-h" className="mt-2 text-h2 font-semibold text-ink">
          Your history is saved
        </h2>
        {addr && <p className="mt-2 text-sm text-ink-muted" dir="ltr">{addr}</p>}
        <div className="mt-5">
          <Button variant="secondary" size="md" onClick={() => void signOut()}>
            Sign out
          </Button>
        </div>
      </section>
    );
  }

  if (sent) {
    return (
      <section className="mt-14 border-t border-hairline pt-8" aria-live="polite">
        <Label>Check your inbox</Label>
        <h2 className="mt-2 text-h2 font-semibold text-ink">Link sent</h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-muted">
          We sent a sign-in link to <strong className="text-ink" dir="ltr">{email}</strong>.
          Opening it brings you back here, signed in.
        </p>
      </section>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!EMAIL.test(email.trim())) { setError("That email address doesn't look right."); return; }
    setBusy(true);
    try {
      await sendMagicLink(email.trim());
      setSent(true);
    } catch (ex) {
      setError(ex instanceof Error ? ex.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mt-14 border-t border-hairline pt-8" aria-labelledby="acct-h">
      <Label>Optional</Label>
      <h2 id="acct-h" className="mt-2 text-h2 font-semibold text-balance text-ink">
        Keep your history across devices
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-ink-muted">
        Everything works without this. An account only means your reads follow you to another
        device — and only the words and numbers sync. Your photo never leaves this tab.
      </p>

      <form onSubmit={submit} className="mt-6 space-y-2" noValidate>
        <label htmlFor="acct-email" className="sr-only">Email address</label>
        <input
          id="acct-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          dir="ltr"
          value={email}
          onChange={(e) => { setEmail(e.target.value); setError(null); }}
          placeholder="you@example.com"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? 'acct-err' : undefined}
          className="h-13 w-full rounded-md border border-line-strong bg-surface px-4 text-base text-ink placeholder:text-ink-subtle focus:border-accent focus:outline-none"
        />
        <Button full type="submit" loading={busy}>Send sign-in link</Button>
      </form>

      {error && (
        <p id="acct-err" role="alert" className="mt-2 text-sm text-danger-ink">{error}</p>
      )}

      <p className="mt-4 text-xs leading-relaxed text-ink-subtle">
        No password — we email a one-time link. Deleting your data below removes it from the
        server too.
      </p>
    </section>
  );
}
