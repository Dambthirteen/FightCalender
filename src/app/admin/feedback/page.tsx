'use client';

import { useEffect, useState } from 'react';
import PageHeader from '@/components/PageHeader';

interface Fb { id: number; user_name: string | null; kind: string; text: string; resolved: boolean; created_at: string }

export default function AdminFeedbackPage() {
  const [pw, setPw] = useState<string | null>(null);
  const [items, setItems] = useState<Fb[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'open' | 'all'>('open');

  useEffect(() => {
    const stored = typeof window !== 'undefined' ? sessionStorage.getItem('fightcal_admin_pw') : null;
    setPw(stored);
    if (!stored) { setLoading(false); return; }
    fetch('/api/admin/feedback', { headers: { 'x-admin-password': stored } })
      .then((r) => r.json()).then((d) => setItems(Array.isArray(d) ? d : [])).finally(() => setLoading(false));
  }, []);

  async function act(id: number, action: string) {
    if (!pw) return;
    setItems((prev) => action === 'delete' ? prev.filter((x) => x.id !== id) : prev.map((x) => x.id === id ? { ...x, resolved: action === 'resolve' } : x));
    await fetch('/api/admin/feedback', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-admin-password': pw }, body: JSON.stringify({ action, id }) }).catch(() => {});
  }

  const shown = filter === 'open' ? items.filter((i) => !i.resolved) : items;
  const openCount = items.filter((i) => !i.resolved).length;

  return (
    <div className="min-h-screen text-[var(--text)]">
      <PageHeader title="Feedback" />
      <main className="max-w-md mx-auto px-4 pb-16">
        {!pw ? (
          <div className="card p-6 text-center anim-up">
            <p className="text-sm text-[var(--muted)] mb-4">Bitte zuerst im Admin-Bereich einloggen.</p>
            <a href="/admin" className="btn btn-primary inline-block">Zum Admin-Bereich</a>
          </div>
        ) : (
          <>
            <div className="flex gap-2 mb-4">
              {([['open', `Offen (${openCount})`], ['all', 'Alle']] as const).map(([key, label]) => (
                <button key={key} onClick={() => setFilter(key)}
                  className="flex-1 py-2 rounded-xl text-sm font-semibold transition-colors"
                  style={filter === key ? { background: 'var(--accent-soft)', color: 'var(--accent)', border: '1px solid rgba(255,59,48,0.35)' } : { background: 'var(--surface-2)', color: 'var(--muted)', border: '1px solid var(--border-soft)' }}>
                  {label}
                </button>
              ))}
            </div>
            {loading ? (
              <div className="py-16 text-center text-[var(--faint)] text-sm">Laden…</div>
            ) : shown.length === 0 ? (
              <div className="py-16 text-center text-[var(--faint)] text-sm">Nichts hier.</div>
            ) : (
              <div className="space-y-2">
                {shown.map((f) => (
                  <div key={f.id} className="card p-4" style={f.resolved ? { opacity: 0.6 } : undefined}>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded"
                        style={f.kind === 'bug' ? { background: 'var(--accent-soft)', color: 'var(--accent)' } : { background: 'rgba(45,212,191,0.14)', color: 'var(--teal)' }}>
                        {f.kind === 'bug' ? '🐞 Bug' : '💡 Feedback'}
                      </span>
                      <span className="text-[11px] text-[var(--faint)] tnum">
                        {f.user_name ?? 'anonym'} · {new Date(f.created_at).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap break-words">{f.text}</p>
                    <div className="flex gap-3 mt-2.5 text-xs">
                      {f.resolved
                        ? <button onClick={() => act(f.id, 'reopen')} className="text-[var(--muted)] hover:text-white">↩ Wieder öffnen</button>
                        : <button onClick={() => act(f.id, 'resolve')} className="font-semibold" style={{ color: 'var(--good)' }}>✓ Erledigt</button>}
                      <button onClick={() => act(f.id, 'delete')} className="text-[var(--faint)] hover:text-[var(--accent)] ml-auto">Löschen</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
