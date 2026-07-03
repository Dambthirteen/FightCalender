'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { track } from '@/lib/analytics';

function JoinInner() {
  const code = (useSearchParams().get('code') ?? '').trim();
  const [state, setState] = useState<'checking' | 'need-login' | 'joining' | 'done' | 'error'>('checking');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (!code) { setState('error'); setMsg('Ungültiger Einladungslink.'); return; }
    (async () => {
      const loggedIn = await fetch('/api/auth/me').then((r) => r.ok).catch(() => false);
      if (!loggedIn) {
        // Code merken, nach Anmeldung/Registrierung wird der Beitritt fortgesetzt.
        document.cookie = `fightcal_invite=${encodeURIComponent(code)};path=/;max-age=1800;samesite=lax`;
        setState('need-login');
        return;
      }
      setState('joining');
      try {
        const res = await fetch('/api/groups/join', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code }),
        });
        const d = await res.json().catch(() => ({}));
        // Code wieder entfernen (erledigt).
        document.cookie = 'fightcal_invite=;path=/;max-age=0';
        if (res.ok) {
          track('invite_join_via_link', { status: d.status });
          setState('done');
          setMsg(d.status === 'active' ? `Du bist in „${d.group}".` : `Anfrage an „${d.group}" gesendet — ein Admin nimmt dich auf.`);
        } else {
          setState('error'); setMsg(d.error ?? 'Beitritt fehlgeschlagen.');
        }
      } catch {
        setState('error'); setMsg('Beitritt fehlgeschlagen.');
      }
    })();
  }, [code]);

  return (
    <div className="min-h-screen text-[var(--text)] flex items-center justify-center px-4">
      <div className="card p-7 w-full max-w-sm text-center">
        <div className="text-4xl mb-2">🥊</div>
        <h1 className="font-display text-2xl tracking-wide mb-1">Crew-Einladung</h1>

        {(state === 'checking' || state === 'joining') && <p className="text-[var(--muted)] text-sm mt-3">Einen Moment…</p>}

        {state === 'need-login' && (
          <>
            <p className="text-[var(--muted)] text-sm mt-2 mb-5">Melde dich an oder registriere dich — danach bist du automatisch dabei.</p>
            <a href="/login" className="block text-white font-bold py-3 rounded-xl" style={{ background: 'var(--accent)' }}>Anmelden / Registrieren</a>
          </>
        )}

        {state === 'done' && (
          <>
            <p className="text-[var(--good)] text-sm mt-2 mb-5">{msg}</p>
            <a href="/" className="block text-white font-bold py-3 rounded-xl" style={{ background: 'var(--accent)' }}>Zur App</a>
          </>
        )}

        {state === 'error' && (
          <>
            <p className="text-[var(--accent)] text-sm mt-2 mb-5">{msg}</p>
            <a href="/" className="block text-[var(--muted)] hover:text-white text-sm">Zur App</a>
          </>
        )}
      </div>
    </div>
  );
}

export default function JoinPage() {
  return <Suspense fallback={null}><JoinInner /></Suspense>;
}
