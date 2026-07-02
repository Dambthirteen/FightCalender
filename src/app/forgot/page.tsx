'use client';

import { useState } from 'react';

const inputCls = 'w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-xl px-4 py-3 text-white placeholder-[var(--faint)] focus:outline-none focus:border-[var(--accent)] transition-colors';

export default function ForgotPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!email.trim()) return;
    setLoading(true);
    try {
      await fetch('/api/auth/forgot', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      setSent(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen text-[var(--text)] flex items-center justify-center px-4">
      <div className="card p-7 w-full max-w-sm">
        <h1 className="font-display text-2xl tracking-wide mb-1 text-center">Passwort vergessen</h1>
        {sent ? (
          <>
            <p className="text-[var(--muted)] text-sm my-5 text-center">
              Falls ein Konto mit dieser E-Mail existiert, ist ein Reset-Link unterwegs. Schau in dein Postfach.
            </p>
            <a href="/login" className="block text-center text-white font-bold py-3 rounded-xl" style={{ background: 'var(--accent)' }}>Zur Anmeldung</a>
          </>
        ) : (
          <>
            <p className="text-[var(--muted)] text-sm mb-5 text-center">Gib deine E-Mail ein — wir schicken dir einen Reset-Link.</p>
            <input type="email" className={inputCls} placeholder="du@example.com" value={email}
              onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} autoFocus />
            <button onClick={submit} disabled={loading || !email.trim()}
              className="w-full text-white font-bold py-3 rounded-xl mt-4 disabled:opacity-40" style={{ background: 'var(--accent)' }}>
              {loading ? '…' : 'Reset-Link senden'}
            </button>
            <a href="/login" className="block text-center text-xs text-[var(--faint)] hover:text-white transition-colors mt-4">← Zurück zur Anmeldung</a>
          </>
        )}
      </div>
    </div>
  );
}
