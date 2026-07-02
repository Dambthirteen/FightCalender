'use client';
import PageHeader from '@/components/PageHeader';

import { useEffect, useState } from 'react';
import { format, subMonths, addMonths } from 'date-fns';
import { de } from 'date-fns/locale';

interface Entry { user_name: string; skip_count: number; }

// Rang-Akzente für die Top 3 (Gold / Silber / Bronze).
const RANK = ['var(--gold)', '#c9ccd3', '#cd7f32'];

export default function BitchPage() {
  const [month, setMonth] = useState(new Date());
  const [data, setData] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [hardMode, setHardMode] = useState<boolean | null>(null); // null = noch unbekannt

  const monthKey = format(month, 'yyyy-MM');

  useEffect(() => {
    setLoading(true);
    fetch(`/api/bitch?month=${monthKey}`)
      .then((r) => r.json())
      .then((d) => setData(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false));
  }, [monthKey]);

  // Ist die Bitch-Liste in der aktuellen Gruppe überhaupt an (harter Modus)?
  useEffect(() => {
    fetch('/api/groups').then((r) => r.json()).then((d) => {
      const cur = (d.groups ?? []).find((g: { id: number; hard_mode?: boolean }) => g.id === d.current);
      setHardMode(cur ? !!cur.hard_mode : false);
    }).catch(() => {});
  }, []);

  const monthLabel = format(month, 'MMMM yyyy', { locale: de });
  const top = data[0];

  return (
    <div className="min-h-screen text-[var(--text)]">
      <PageHeader title="🐔 Bitch des Monats" />

      <main className="max-w-md mx-auto px-4 pb-24">
        {/* Monats-Navigation */}
        <div className="flex items-center justify-between mb-6">
          <button onClick={() => setMonth((m) => subMonths(m, 1))} className="seg-btn" aria-label="Vorheriger Monat">‹</button>
          <h2 className="font-display text-xl tracking-wide capitalize">{monthLabel}</h2>
          <button onClick={() => setMonth((m) => addMonths(m, 1))} className="seg-btn" aria-label="Nächster Monat">›</button>
        </div>

        {hardMode === false ? (
          <div className="card p-10 text-center anim-up">
            <div className="text-5xl mb-3">🕊️</div>
            <div className="text-[var(--muted)]">Die Bitch-Liste ist in dieser Crew aus.</div>
            <div className="text-[var(--faint)] text-sm mt-1">Ein Gruppen-Admin kann den „harten Modus“ aktivieren.</div>
          </div>
        ) : loading ? (
          <div className="text-center text-[var(--faint)] py-20">Lädt…</div>
        ) : data.length === 0 ? (
          <div className="card p-10 text-center anim-up">
            <div className="text-5xl mb-3">💪</div>
            <div className="text-[var(--muted)]">Niemand hat diesen Monat gefehlt.</div>
            <div className="text-[var(--faint)] text-sm mt-1">Respekt.</div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Sieger-Karte */}
            {top && (
              <div className="card p-6 text-center anim-up" style={{ borderColor: 'var(--bitch)' }}>
                <div className="text-5xl mb-2">🐔</div>
                <div className="section-label" style={{ color: 'var(--bitch)' }}>Bitch des Monats</div>
                <div className="font-display text-3xl tracking-wide mt-1">{top.user_name}</div>
                <div className="text-[var(--muted)] text-sm mt-1">{top.skip_count}× nicht da gewesen</div>
              </div>
            )}

            {/* Rangliste */}
            <div className="card overflow-hidden anim-up" style={{ animationDelay: '40ms' }}>
              {data.map((entry, i) => (
                <div key={entry.user_name}
                  className={`flex items-center justify-between gap-3 px-4 py-3.5 ${i < data.length - 1 ? 'border-b border-[var(--border-soft)]' : ''}`}>
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-7 h-7 shrink-0 grid place-items-center rounded-full text-xs font-bold tnum"
                      style={i < 3
                        ? { background: `${RANK[i]}1f`, color: RANK[i], border: `1px solid ${RANK[i]}` }
                        : { color: 'var(--faint)' }}>
                      {i + 1}
                    </span>
                    <span className="font-semibold truncate">{entry.user_name}</span>
                  </div>
                  <div className="flex items-baseline gap-1 shrink-0 tnum">
                    <span className="font-display text-lg" style={{ color: i === 0 ? 'var(--bitch)' : 'var(--text)' }}>{entry.skip_count}</span>
                    <span className="text-[var(--faint)] text-xs">×</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
