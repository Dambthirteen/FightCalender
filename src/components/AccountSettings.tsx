'use client';

import { useEffect, useState } from 'react';

/** Konto-Sektion in den Einstellungen: E-Mail ändern + (privates) Geburtsdatum. */
export default function AccountSettings() {
  const [email, setEmail] = useState('');
  const [verified, setVerified] = useState(false);
  const [birthdate, setBirthdate] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  useEffect(() => {
    fetch('/api/account/profile').then((r) => r.json()).then((d) => {
      if (d && !d.error) { setEmail(d.email ?? ''); setVerified(!!d.email_verified); setBirthdate(d.birthdate ?? ''); }
    }).catch(() => {}).finally(() => setLoaded(true));
  }, []);

  async function save() {
    setSaving(true); setMsg(''); setErr('');
    try {
      const res = await fetch('/api/account/profile', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, birthdate }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setErr(d.error ?? 'Konnte nicht speichern.'); return; }
      setMsg('Gespeichert.');
    } finally { setSaving(false); }
  }

  // min-w-0 verhindert, dass der native Date-Input breiter wird als das E-Mail-Feld.
  const field = 'w-full min-w-0 box-border bg-[var(--surface-2)] border border-[var(--border)] rounded-xl px-3 py-2.5 text-sm text-white placeholder-[var(--faint)] focus:outline-none focus:border-[var(--accent)]';

  return (
    <section className="card p-5">
      <h2 className="font-display text-xl tracking-wide mb-1">Konto</h2>
      <p className="text-sm text-[var(--muted)] mb-4">E-Mail und Geburtsdatum. Das Geburtsdatum ist <strong>nicht öffentlich</strong> — nur zur Zuordnung.</p>
      <div className="space-y-4">
        <div>
          <div className="section-label mb-1.5 flex items-center gap-2">
            E-Mail
            {loaded && email && (verified
              ? <span className="text-[10px] px-1.5 py-px rounded-[3px]" style={{ background: 'rgba(61,220,132,0.15)', color: 'var(--teal)' }}>verifiziert</span>
              : <span className="text-[10px] px-1.5 py-px rounded-[3px]" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>unbestätigt</span>)}
          </div>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="du@example.com" className={field} />
        </div>
        <div>
          <div className="section-label mb-1.5">Geburtsdatum (privat)</div>
          <input type="date" value={birthdate} onChange={(e) => setBirthdate(e.target.value)} className={field} />
        </div>
      </div>
      {err && <p className="text-[var(--accent)] text-xs mt-3">{err}</p>}
      {msg && <p className="text-xs mt-3" style={{ color: 'var(--teal)' }}>{msg}</p>}
      <button onClick={save} disabled={saving} className="btn btn-primary mt-4 w-full">
        {saving ? 'Speichern…' : 'Speichern'}
      </button>
    </section>
  );
}
