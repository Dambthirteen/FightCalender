'use client';
import PageHeader from '@/components/PageHeader';

import { useEffect, useState } from 'react';
import { useUser } from '@/components/UserProvider';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

const STATUS_CONFIG = {
  sick:     { label: 'Krank',    icon: '🤒', color: 'border-orange-500/40 bg-orange-500/10 text-orange-400' },
  injured:  { label: 'Verletzt', icon: '🩹', color: 'border-red-500/40 bg-red-500/10 text-red-400' },
  vacation: { label: 'Urlaub',   icon: '🏖️', color: 'border-blue-500/40 bg-blue-500/10 text-blue-400' },
} as const;
type StatusType = keyof typeof STATUS_CONFIG;

interface StatusEntry {
  id: number;
  status_type: StatusType;
  start_date: string;
  end_date: string;
  note: string;
}

function today() { return new Date().toISOString().slice(0, 10); }

export default function AccountPage() {
  const { userName } = useUser();
  const [statuses, setStatuses] = useState<StatusEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ statusType: 'sick' as StatusType, startDate: today(), endDate: today(), note: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!userName) return;
    fetch('/api/status')
      .then(r => r.json())
      .then(d => setStatuses(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false));
  }, [userName]);

  async function addStatus() {
    if (form.endDate < form.startDate) { setError('Enddatum vor Startdatum'); return; }
    setSaving(true); setError('');
    try {
      const res = await fetch('/api/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ statusType: form.statusType, startDate: form.startDate, endDate: form.endDate, note: form.note }),
      });
      if (!res.ok) { const d = await res.json(); setError(d.error); return; }
      const newEntry = await res.json();
      setStatuses(prev => [newEntry, ...prev]);
      setForm(f => ({ ...f, note: '' }));
    } finally {
      setSaving(false);
    }
  }

  async function deleteStatus(id: number) {
    await fetch(`/api/status/${id}`, { method: 'DELETE' });
    setStatuses(prev => prev.filter(s => s.id !== id));
  }

  const now = today();
  const active = statuses.filter(s => s.end_date.slice(0, 10) >= now);
  const past = statuses.filter(s => s.end_date.slice(0, 10) < now);

  function fmtDate(d: string) {
    return format(new Date(d.slice(0, 10) + 'T12:00'), 'd. MMM yyyy', { locale: de });
  }

  return (
    <div className="min-h-screen text-[var(--text)]">
      <PageHeader title="🏥 Mein Status" />

      <main className="max-w-md mx-auto px-4 pb-24 space-y-6">
        {/* Info */}
        <div className="card px-4 py-3 text-sm text-[var(--muted)]">
          Status-Zeiträume werden automatisch von der Bitch-Wertung ausgenommen und im Ausreden-Gericht markiert.
        </div>

        {/* Active statuses */}
        {active.length > 0 && (
          <section>
            <h2 className="section-label mb-3">Aktuell / Bevorstehend</h2>
            <div className="space-y-2">
              {active.map(s => {
                const cfg = STATUS_CONFIG[s.status_type];
                return (
                  <div key={s.id} className={`border rounded-xl px-4 py-3 flex items-center gap-3 ${cfg.color}`}>
                    <span className="text-xl">{cfg.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm">{cfg.label}</div>
                      <div className="text-xs opacity-70">{fmtDate(s.start_date)} – {fmtDate(s.end_date)}</div>
                      {s.note && <div className="text-xs opacity-60 mt-0.5 truncate">{s.note}</div>}
                    </div>
                    <button onClick={() => deleteStatus(s.id)} className="text-current opacity-40 hover:opacity-100 transition-opacity text-sm px-2">✕</button>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Add form */}
        <section className="card p-5">
          <h2 className="font-display text-xl tracking-wide mb-4">Status eintragen</h2>
          <div className="space-y-4">
            <div>
              <label className="section-label mb-2 block">Typ</label>
              <div className="flex gap-2">
                {(Object.entries(STATUS_CONFIG) as [StatusType, typeof STATUS_CONFIG[StatusType]][]).map(([key, cfg]) => (
                  <button
                    key={key}
                    onClick={() => setForm(f => ({ ...f, statusType: key }))}
                    className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-all ${form.statusType === key ? cfg.color : 'border-[var(--border)] bg-[var(--surface-2)] text-[var(--muted)]'}`}
                  >
                    {cfg.icon} {cfg.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="section-label mb-1.5 block">Von</label>
                <input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} className="field" />
              </div>
              <div>
                <label className="section-label mb-1.5 block">Bis</label>
                <input type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} className="field" />
              </div>
            </div>
            <div>
              <label className="section-label mb-1.5 block">Notiz (optional)</label>
              <input value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                className="field" placeholder="z.B. Grippe, Knieprobleme…" />
            </div>
          </div>
          {error && <p className="text-[var(--accent)] text-xs mt-3">{error}</p>}
          <button onClick={addStatus} disabled={saving} className="btn btn-primary mt-5 w-full">
            {saving ? 'Speichern…' : 'Status eintragen'}
          </button>
        </section>

        {/* Past statuses */}
        {!loading && past.length > 0 && (
          <section>
            <h2 className="section-label mb-3">Vergangene Einträge</h2>
            <div className="space-y-2">
              {past.map(s => {
                const cfg = STATUS_CONFIG[s.status_type];
                return (
                  <div key={s.id} className="card px-4 py-3 flex items-center gap-3 opacity-70">
                    <span className="text-lg opacity-50">{cfg.icon}</span>
                    <div className="flex-1 text-[var(--muted)]">
                      <div className="text-sm">{cfg.label}</div>
                      <div className="text-xs text-[var(--faint)]">{fmtDate(s.start_date)} – {fmtDate(s.end_date)}</div>
                    </div>
                    <button onClick={() => deleteStatus(s.id)} className="text-[var(--faint)] hover:text-[var(--accent)] transition-colors text-sm px-2">✕</button>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
