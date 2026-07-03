'use client';
import PageHeader from '@/components/PageHeader';

import { useState } from 'react';

/** DSGVO-Selbstbedienung: Datenexport + Konto-Löschung (eigene Unterseite). */
export default function MeineDatenPage() {
  const [delOpen, setDelOpen] = useState(false);
  const [delPw, setDelPw] = useState('');
  const [delBusy, setDelBusy] = useState(false);
  const [delErr, setDelErr] = useState('');

  async function deleteAccount() {
    if (!delPw) { setDelErr('Passwort erforderlich'); return; }
    if (!confirm('Konto und ALLE deine Daten unwiderruflich löschen?')) return;
    setDelBusy(true); setDelErr('');
    try {
      const res = await fetch('/api/account/delete', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: delPw }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); setDelErr(d.error ?? 'Fehler'); return; }
      window.location.href = '/login';
    } finally { setDelBusy(false); }
  }

  return (
    <div className="min-h-screen text-[var(--text)]">
      <PageHeader title="🗂️ Meine Daten" />

      <main className="max-w-md mx-auto px-4 pb-24 space-y-6">
        <section className="card p-5">
          <h2 className="font-display text-xl tracking-wide mb-1">Datenexport</h2>
          <p className="text-[var(--muted)] text-xs mb-4">Lade alle zu deinem Konto gespeicherten Daten als JSON herunter (DSGVO-Auskunft).</p>
          <a href="/api/account/export"
            className="block w-full text-center border border-[var(--border)] rounded-xl py-2.5 text-sm font-semibold text-[var(--text)] hover:border-[var(--accent)] transition-colors">
            Meine Daten exportieren (JSON)
          </a>
        </section>

        <section className="card p-5">
          <h2 className="font-display text-xl tracking-wide mb-1">Konto löschen</h2>
          <p className="text-[var(--muted)] text-xs mb-4">Löscht dein Konto und ALLE deine Daten unwiderruflich.</p>
          {!delOpen ? (
            <button onClick={() => setDelOpen(true)} className="text-sm font-semibold" style={{ color: 'var(--accent)' }}>
              Konto löschen
            </button>
          ) : (
            <div className="space-y-2.5">
              <p className="text-xs text-[var(--muted)]">Zur Bestätigung dein Passwort:</p>
              <input type="password" value={delPw} onChange={(e) => setDelPw(e.target.value)} placeholder="Passwort" className="field" />
              {delErr && <p className="text-[var(--accent)] text-xs">{delErr}</p>}
              <div className="flex gap-2">
                <button onClick={deleteAccount} disabled={delBusy}
                  className="flex-1 text-white font-bold py-2.5 rounded-xl disabled:opacity-40" style={{ background: 'var(--accent)' }}>
                  {delBusy ? 'Löschen…' : 'Endgültig löschen'}
                </button>
                <button onClick={() => { setDelOpen(false); setDelPw(''); setDelErr(''); }}
                  className="px-4 rounded-xl border border-[var(--border)] text-[var(--muted)] text-sm">Abbrechen</button>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
