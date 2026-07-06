'use client';

import { useState } from 'react';

/** Custom-Push an alle aktiven Mitglieder der aktuellen Gruppe (für Gruppen-Admins & Coaches). */
export default function GroupBroadcast({ heading = 'Nachricht an die Crew', hint }: { heading?: string; hint?: string }) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [ok, setOk] = useState(false);

  const input = 'w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-xl px-3 py-2.5 text-sm text-white placeholder-[var(--faint)] focus:outline-none focus:border-[var(--accent)]';

  async function send() {
    if (!body.trim() || busy) return;
    if (!confirm('Push jetzt an alle aktiven Mitglieder dieser Gruppe senden?')) return;
    setBusy(true); setMsg('');
    try {
      const res = await fetch('/api/groups/broadcast', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), body: body.trim() }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok) { setOk(true); setMsg(`✓ Gesendet an ${d.recipients} Mitglied${d.recipients === 1 ? '' : 'er'}.`); setTitle(''); setBody(''); }
      else { setOk(false); setMsg(d.error ?? 'Konnte nicht senden.'); }
    } catch { setOk(false); setMsg('Netzwerkfehler'); }
    finally { setBusy(false); }
  }

  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--faint)] mb-2.5">{heading}</div>
      {hint && <p className="text-[11px] text-[var(--faint)] mb-3 leading-relaxed">{hint}</p>}
      <div className="space-y-2.5">
        <input value={title} onChange={(e) => setTitle(e.target.value.slice(0, 80))} placeholder="Titel (optional)" className={input} />
        <textarea value={body} onChange={(e) => setBody(e.target.value.slice(0, 300))} rows={3} placeholder="Nachricht…" className={`${input} resize-none`} />
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-[var(--faint)] tnum">{body.length}/300</span>
          <button onClick={send} disabled={busy || !body.trim()}
            className="text-white font-bold px-4 py-2 rounded-xl text-sm disabled:opacity-40" style={{ background: 'var(--accent)' }}>
            {busy ? 'Senden…' : 'Push senden'}
          </button>
        </div>
        {msg && <p className="text-xs" style={{ color: ok ? 'var(--good)' : 'var(--accent)' }}>{msg}</p>}
      </div>
    </div>
  );
}
