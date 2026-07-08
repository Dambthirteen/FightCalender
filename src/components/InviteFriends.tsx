'use client';

import { useEffect, useState } from 'react';
import { track } from '@/lib/analytics';

/**
 * „Freunde einladen" — für JEDES aktive Mitglied (nicht nur Admins).
 * Teilt den Crew-Einladungslink (`/join?code=…`). Wer die App noch nicht hat,
 * landet über /join automatisch auf der Anmelde-/Registrierungsseite und ist
 * nach dem Login direkt in der Crew.
 */
export default function InviteFriends() {
  const [code, setCode] = useState<string | null>(null);
  const [qr, setQr] = useState('');
  const [showQr, setShowQr] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    fetch('/api/groups/members').then((r) => r.json()).then((d) => setCode(d.inviteCode ?? null)).catch(() => {});
  }, []);

  function url() { return `${window.location.origin}/join?code=${code}`; }

  async function share() {
    if (!code) return;
    setMsg(''); track('invite_shared', { method: 'share', via: 'members' });
    if (typeof navigator !== 'undefined' && navigator.share) {
      try { await navigator.share({ title: 'Submit', text: 'Komm in unsere Crew auf Submit!', url: url() }); } catch { /* abgebrochen */ }
    } else {
      try { await navigator.clipboard.writeText(url()); setMsg('Link kopiert.'); } catch {}
    }
  }
  async function copy() {
    if (!code) return;
    track('invite_shared', { method: 'copy', via: 'members' });
    try { await navigator.clipboard.writeText(url()); setMsg('Link kopiert.'); } catch {}
  }
  async function toggleQr() {
    if (showQr) { setShowQr(false); return; }
    if (!code) return;
    track('invite_shared', { method: 'qr', via: 'members' });
    try {
      const QRCode = (await import('qrcode')).default;
      setQr(await QRCode.toDataURL(url(), { width: 240, margin: 1, color: { dark: '#0a0a0c', light: '#ffffff' } }));
      setShowQr(true);
    } catch { /* egal */ }
  }

  if (!code) return null; // ohne Gruppe kein Einladungslink

  return (
    <section className="card p-5">
      <h2 className="font-display text-xl tracking-wide mb-1">Freunde einladen</h2>
      <p className="text-sm text-[var(--muted)] mb-4">
        Teil den Link — wer noch kein Submit hat, landet direkt auf der Anmeldung und ist danach automatisch in eurer Crew.
      </p>
      <div className="flex gap-2">
        <button onClick={share} className="flex-1 text-white font-bold py-2.5 rounded-xl" style={{ background: 'var(--accent)' }}>Einladung teilen</button>
        <button onClick={copy} className="px-4 rounded-xl border border-[var(--border)] text-[var(--muted)] text-sm">Link kopieren</button>
      </div>
      <div className="text-center text-[11px] text-[var(--faint)] mt-3 font-mono tracking-widest">Code: {code}</div>
      <button onClick={toggleQr} className="w-full mt-2 text-xs text-[var(--muted)] hover:text-white transition-colors">
        {showQr ? 'QR-Code ausblenden' : 'QR-Code zum Scannen'}
      </button>
      {showQr && qr && (
        <div className="mt-3 flex justify-center">
          <img src={qr} alt="Einladungs-QR-Code" width={200} height={200} className="rounded-xl" style={{ background: '#fff', padding: 10 }} />
        </div>
      )}
      {msg && <p className="text-xs mt-2 text-center" style={{ color: 'var(--teal)' }}>{msg}</p>}
    </section>
  );
}
