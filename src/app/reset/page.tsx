'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';

const inputCls = 'w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-xl px-4 py-3 text-white placeholder-[var(--faint)] focus:outline-none focus:border-[var(--accent)] transition-colors';

function ResetInner() {
  const token = useSearchParams().get('token');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [state, setState] = useState<'idle' | 'busy' | 'ok'>('idle');
  const [error, setError] = useState('');

  async function submit() {
    setError('');
    if (!token) { setError('Link ungültig.'); return; }
    if (password.length < 6) { setError('Passwort muss mind. 6 Zeichen haben.'); return; }
    if (password !== confirm) { setError('Passwörter stimmen nicht überein.'); return; }
    setState('busy');
    try {
      const res = await fetch('/api/auth/reset', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      if (res.ok) { setState('ok'); return; }
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? 'Fehler'); setState('idle');
    } catch {
      setError('Fehler'); setState('idle');
    }
  }

  return (
    <div className="min-h-screen text-[var(--text)] flex items-center justify-center px-4">
      <div className="card p-7 w-full max-w-sm">
        <h1 className="font-display text-2xl tracking-wide mb-1 text-center">Neues Passwort</h1>
        {state === 'ok' ? (
          <>
            <p className="text-[var(--muted)] text-sm mb-5 text-center">Passwort geändert. Du kannst dich jetzt anmelden.</p>
            <a href="/login" className="block text-center text-white font-bold py-3 rounded-xl" style={{ background: 'var(--accent)' }}>Zur Anmeldung</a>
          </>
        ) : (
          <>
            <p className="text-[var(--muted)] text-sm mb-5 text-center">Setz dein neues Passwort.</p>
            <div className="space-y-3">
              <input type="password" className={inputCls} placeholder="Neues Passwort…" value={password} onChange={(e) => setPassword(e.target.value)} />
              <input type="password" className={inputCls} placeholder="Wiederholen…" value={confirm} onChange={(e) => setConfirm(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} />
              {error && <p className="text-[var(--accent)] text-xs">{error}</p>}
              <button onClick={submit} disabled={state === 'busy' || !password || !confirm}
                className="w-full text-white font-bold py-3 rounded-xl disabled:opacity-40" style={{ background: 'var(--accent)' }}>
                {state === 'busy' ? '…' : 'Passwort setzen'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function ResetPage() {
  return <Suspense fallback={null}><ResetInner /></Suspense>;
}
