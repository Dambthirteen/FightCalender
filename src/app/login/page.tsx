'use client';

import { useState } from 'react';
import { track, identify } from '@/lib/analytics';

export default function LoginPage() {
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [userName, setUserName] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [email, setEmail] = useState('');
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit() {
    setError('');
    if (tab === 'register' && password !== confirm) {
      setError('Passwörter stimmen nicht überein.');
      return;
    }
    setLoading(true);
    try {
      const endpoint = tab === 'login' ? '/api/auth/login' : '/api/auth/register';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userName, password, consent, email }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Fehler'); return; }
      if (tab === 'register') { identify(userName); track('signup'); } else { track('login'); }
      // Offene Crew-Einladung? Dann Beitritt fortsetzen (Code liegt als Cookie vor).
      const invite = document.cookie.match(/(?:^|;\s*)fightcal_invite=([^;]+)/)?.[1] ?? '';
      if (invite) { window.location.href = `/join?code=${invite}`; return; }
      // Hard redirect so the browser sends the new session cookie fresh.
      // Neue Accounts zuerst in den Onboarding-Assistenten.
      window.location.href = tab === 'register' ? '/onboarding' : '/';
    } finally {
      setLoading(false);
    }
  }

  const inputCls =
    'w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-xl px-4 py-3 text-white placeholder-[var(--faint)] focus:outline-none focus:border-[var(--accent)] transition-colors';

  return (
    <div className="min-h-screen text-[var(--text)] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-7 anim-up">
          <img src="/icon-192.png" alt="Tap In"
            className="w-20 h-20 rounded-[22px] mx-auto mb-4 ring-1 ring-white/10 shadow-2xl shadow-black/50" />
          <h1 className="font-display text-4xl tracking-wide leading-none">Tap In</h1>
          <p className="text-[var(--muted)] text-[11px] mt-2 uppercase tracking-[0.22em]">Wer kommt diese Woche?</p>
        </div>

        <div className="card overflow-hidden shadow-2xl shadow-black/40 anim-up" style={{ animationDelay: '70ms' }}>
          {/* Tabs */}
          <div className="flex border-b border-[var(--border-soft)]">
            {(['login', 'register'] as const).map(t => (
              <button
                key={t}
                onClick={() => { setTab(t); setError(''); }}
                className="flex-1 py-3.5 text-sm font-semibold transition-colors"
                style={{
                  color: tab === t ? 'var(--text)' : 'var(--faint)',
                  boxShadow: tab === t ? 'inset 0 -2px 0 var(--accent)' : 'none',
                }}
              >
                {t === 'login' ? 'Anmelden' : 'Registrieren'}
              </button>
            ))}
          </div>

          <div className="p-6 space-y-4">
            <div>
              <label className="text-[10px] uppercase tracking-[0.16em] text-[var(--faint)] mb-1.5 block">Name</label>
              <input
                className={inputCls}
                placeholder="Dein Name…"
                value={userName}
                onChange={e => setUserName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && submit()}
                autoFocus
              />
            </div>
            {tab === 'register' && (
              <div>
                <label className="text-[10px] uppercase tracking-[0.16em] text-[var(--faint)] mb-1.5 block">E-Mail</label>
                <input
                  type="email"
                  className={inputCls}
                  placeholder="du@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && submit()}
                />
              </div>
            )}
            <div>
              <label className="text-[10px] uppercase tracking-[0.16em] text-[var(--faint)] mb-1.5 block">Passwort</label>
              <input
                type="password"
                className={inputCls}
                placeholder="Passwort…"
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && submit()}
              />
            </div>
            {tab === 'register' && (
              <div>
                <label className="text-[10px] uppercase tracking-[0.16em] text-[var(--faint)] mb-1.5 block">Passwort wiederholen</label>
                <input
                  type="password"
                  className={inputCls}
                  placeholder="Passwort wiederholen…"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && submit()}
                />
              </div>
            )}

            {tab === 'register' && (
              <label className="flex items-start gap-2.5 text-xs text-[var(--muted)] cursor-pointer">
                <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)}
                  className="mt-0.5 shrink-0" style={{ accentColor: 'var(--accent)' }} />
                <span>
                  Ich akzeptiere die <a href="/datenschutz" target="_blank" rel="noreferrer" className="underline text-[var(--text)]">Datenschutzerklärung</a>.
                </span>
              </label>
            )}

            {error && (
              <div className="rounded-xl px-4 py-2.5 text-sm" style={{ background: 'var(--accent-soft)', border: '1px solid rgba(255,59,48,0.3)', color: 'var(--accent)' }}>
                {error}
              </div>
            )}

            <button
              onClick={submit}
              disabled={loading || !userName.trim() || !password || (tab === 'register' && (!consent || !email.trim()))}
              className="w-full text-white font-bold py-3.5 rounded-xl transition-all active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: 'var(--accent)' }}
            >
              {loading ? '…' : tab === 'login' ? 'Anmelden' : 'Account erstellen'}
            </button>
            {tab === 'login' && (
              <a href="/forgot" className="block text-center text-xs text-[var(--faint)] hover:text-white transition-colors">Passwort vergessen?</a>
            )}
          </div>
        </div>

        <p className="text-center text-xs text-[var(--faint)] mt-4 anim-in" style={{ animationDelay: '140ms' }}>
          {tab === 'login' ? 'Noch kein Account?' : 'Schon registriert?'}{' '}
          <button onClick={() => { setTab(tab === 'login' ? 'register' : 'login'); setError(''); }} className="text-[var(--muted)] hover:text-white transition-colors underline">
            {tab === 'login' ? 'Registrieren' : 'Anmelden'}
          </button>
        </p>

        <p className="text-center text-[11px] text-[var(--faint)] mt-3 anim-in" style={{ animationDelay: '160ms' }}>
          <a href="/datenschutz" className="hover:text-[var(--muted)] transition-colors">Datenschutz</a>
          {' · '}
          <a href="/impressum" className="hover:text-[var(--muted)] transition-colors">Impressum</a>
        </p>
      </div>
    </div>
  );
}
