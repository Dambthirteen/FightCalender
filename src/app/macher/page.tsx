'use client';
import PageHeader from '@/components/PageHeader';
import LoadingScreen from '@/components/LoadingScreen';

import { useEffect, useState } from 'react';
import { format, subMonths, addMonths } from 'date-fns';
import { de } from 'date-fns/locale';

interface Entry { user_name: string; attend_count: number; }

// Rang-Akzente für die Top 3 (Gold / Silber / Bronze).
const RANK = ['var(--gold)', '#c9ccd3', '#cd7f32'];

export default function MacherPage() {
  const [month, setMonth] = useState(new Date());
  const [data, setData] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);

  const monthKey = format(month, 'yyyy-MM');

  useEffect(() => {
    setLoading(true);
    fetch(`/api/macher?month=${monthKey}`)
      .then((r) => r.json())
      .then((d) => setData(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false));
  }, [monthKey]);

  const monthLabel = format(month, 'MMMM yyyy', { locale: de });
  const top = data[0];

  return (
    <div className="min-h-screen text-[var(--text)]">
      <PageHeader title="💪 Macher des Monats" />

      <main className="max-w-md mx-auto px-4 pb-24">
        {/* Monats-Navigation */}
        <div className="flex items-center justify-between mb-6">
          <button onClick={() => setMonth((m) => subMonths(m, 1))} className="seg-btn" aria-label="Vorheriger Monat">‹</button>
          <h2 className="font-display text-xl tracking-wide capitalize">{monthLabel}</h2>
          <button onClick={() => setMonth((m) => addMonths(m, 1))} className="seg-btn" aria-label="Nächster Monat">›</button>
        </div>

        {loading ? (
          <LoadingScreen inline />
        ) : data.length === 0 ? (
          <div className="card p-10 text-center anim-up">
            <div className="text-5xl mb-3">🥊</div>
            <div className="text-[var(--muted)]">Noch keine Einträge diesen Monat.</div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Sieger-Karte */}
            {top && (
              <div className="card p-6 text-center anim-up" style={{ borderColor: 'var(--gold)' }}>
                <div className="text-5xl mb-2">🏆</div>
                <div className="section-label" style={{ color: 'var(--gold)' }}>Macher des Monats</div>
                <div className="font-display text-3xl tracking-wide mt-1">{top.user_name}</div>
                <div className="text-[var(--muted)] text-sm mt-1">{top.attend_count}× im Gym gewesen</div>
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
                    <span className="font-display text-lg" style={{ color: i === 0 ? 'var(--gold)' : 'var(--text)' }}>{entry.attend_count}</span>
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
