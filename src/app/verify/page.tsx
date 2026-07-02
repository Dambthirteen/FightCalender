'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

function VerifyInner() {
  const token = useSearchParams().get('token');
  const [state, setState] = useState<'loading' | 'ok' | 'error'>('loading');

  useEffect(() => {
    if (!token) { setState('error'); return; }
    fetch('/api/auth/verify', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    }).then((r) => setState(r.ok ? 'ok' : 'error')).catch(() => setState('error'));
  }, [token]);

  return (
    <div className="min-h-screen text-[var(--text)] flex items-center justify-center px-4">
      <div className="card p-7 w-full max-w-sm text-center">
        {state === 'loading' && <p className="text-[var(--muted)]">Wird bestätigt…</p>}
        {state === 'ok' && (
          <>
            <div className="text-4xl mb-2">✅</div>
            <h1 className="font-display text-2xl tracking-wide mb-1">E-Mail bestätigt</h1>
            <p className="text-[var(--muted)] text-sm mb-5">Danke! Deine E-Mail ist jetzt verifiziert.</p>
            <a href="/" className="inline-block text-white font-bold px-5 py-2.5 rounded-xl" style={{ background: 'var(--accent)' }}>Zur App</a>
          </>
        )}
        {state === 'error' && (
          <>
            <div className="text-4xl mb-2">⚠️</div>
            <h1 className="font-display text-2xl tracking-wide mb-1">Link ungültig</h1>
            <p className="text-[var(--muted)] text-sm mb-5">Der Bestätigungslink ist ungültig oder abgelaufen.</p>
            <a href="/" className="inline-block text-[var(--muted)] hover:text-white text-sm">Zur App</a>
          </>
        )}
      </div>
    </div>
  );
}

export default function VerifyPage() {
  return <Suspense fallback={null}><VerifyInner /></Suspense>;
}
