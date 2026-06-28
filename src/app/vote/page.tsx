'use client';
import PageHeader from '@/components/PageHeader';

import { useEffect, useState } from 'react';
import { format, subMonths, addMonths, getDaysInMonth } from 'date-fns';
import { de } from 'date-fns/locale';
import { useUser } from '@/components/UserProvider';

const DAY_NAMES = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

const STATUS_LABELS: Record<string, { icon: string; label: string; color: string }> = {
  sick:     { icon: '🤒', label: 'Krank',    color: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
  injured:  { icon: '🩹', label: 'Verletzt', color: 'bg-red-500/20 text-red-400 border-red-500/30' },
  vacation: { icon: '🏖️', label: 'Urlaub',  color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
};

interface Excuse {
  id: number;
  user_name: string;
  date: string;
  excuse: string;
  day_of_week: number;
  accept_count: number;
  reject_count: number;
  my_vote: 'accept' | 'reject' | null;
  holiday: string | null;
  user_status_type: string | null;
  streak_protected: boolean;
  is_exempt: boolean;
}

function getMonthInfo(date: Date) {
  const now = new Date();
  const daysInMonth = getDaysInMonth(date);
  const votingStartDay = daysInMonth - 2; // last 3 days
  const isCurrentMonth =
    date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
  const isPast =
    date.getFullYear() < now.getFullYear() ||
    (date.getFullYear() === now.getFullYear() && date.getMonth() < now.getMonth());
  const todayDay = isCurrentMonth ? now.getDate() : (isPast ? daysInMonth : 1);
  const votingOpen = isPast || (isCurrentMonth && todayDay >= votingStartDay);
  const daysUntilVoting = isCurrentMonth ? Math.max(0, votingStartDay - todayDay) : 0;
  const progressPct = Math.min(100, Math.round((todayDay / daysInMonth) * 100));
  const votingPct = Math.round(((votingStartDay - 1) / daysInMonth) * 100);
  return { daysInMonth, votingStartDay, isPast, votingOpen, daysUntilVoting, progressPct, votingPct, todayDay, isCurrentMonth };
}

export default function VotePage() {
  const { userName } = useUser();
  const [month, setMonth] = useState(new Date());
  const [excuses, setExcuses] = useState<Excuse[]>([]);
  const [loading, setLoading] = useState(true);
  const [voting, setVoting] = useState<number | null>(null);

  const monthKey = format(month, 'yyyy-MM');
  const monthLabel = format(month, 'MMMM yyyy', { locale: de });
  const info = getMonthInfo(month);

  useEffect(() => {
    if (!userName) return;
    setLoading(true);
    fetch(`/api/vote?month=${monthKey}&voter=${encodeURIComponent(userName)}`)
      .then(r => r.json())
      .then(d => setExcuses(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false));
  }, [monthKey, userName]);

  async function vote(skipId: number, v: 'accept' | 'reject') {
    if (!userName) return;
    setVoting(skipId);
    try {
      await fetch('/api/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skipId, voterName: userName, vote: v }),
      });
      setExcuses(prev => prev.map(e => {
        if (e.id !== skipId) return e;
        const wasAccept = e.my_vote === 'accept', wasReject = e.my_vote === 'reject';
        return { ...e, my_vote: v,
          accept_count: e.accept_count + (v === 'accept' ? 1 : 0) - (wasAccept ? 1 : 0),
          reject_count: e.reject_count + (v === 'reject' ? 1 : 0) - (wasReject ? 1 : 0),
        };
      }));
    } finally {
      setVoting(null);
    }
  }

  const ownExcuses = excuses.filter(e => e.user_name === userName);
  const othersExcuses = excuses.filter(e => e.user_name !== userName);

  function ExcuseCard({ e, canVote }: { e: Excuse; canVote: boolean }) {
    const accepted = e.accept_count > e.reject_count; // Punkt nur weg, wenn mehr „gilt" als „gilt nicht"
    const total = e.accept_count + e.reject_count;
    const statusCfg = e.user_status_type ? STATUS_LABELS[e.user_status_type] : null;
    const isOwn = e.user_name === userName;

    return (
      <div className="card p-4" style={!e.is_exempt && !accepted && info.isPast ? { borderColor: 'rgba(239,68,68,0.4)' } : undefined}>
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
          <div>
            <span className="font-semibold text-sm">{e.user_name}</span>
            <span className="text-[var(--faint)] text-xs ml-2">
              {DAY_NAMES[e.day_of_week - 1]}, {format(new Date(e.date), 'd. MMM', { locale: de })}
            </span>
          </div>
          <div className="flex flex-wrap gap-1">
            {e.holiday && (
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400 border border-purple-500/30">
                🎄 {e.holiday}
              </span>
            )}
            {statusCfg && (
              <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${statusCfg.color}`}>
                {statusCfg.icon} {statusCfg.label}
              </span>
            )}
            {e.is_exempt && (
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-green-600/20 text-green-400 border border-green-500/30">
                ✓ Befreit
              </span>
            )}
            {e.streak_protected && (
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full" style={{ background: 'var(--accent-soft)', color: 'var(--accent-2)', border: '1px solid rgba(255,106,61,0.3)' }}>
                🔥 Streak gerettet
              </span>
            )}
            {!e.is_exempt && info.isPast && (
              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${!accepted ? 'bg-red-600/20 text-red-400' : 'bg-green-600/20 text-green-400'}`}>
                {accepted ? '✅ Ausrede gilt' : '❌ Bitch bleibt'}
              </span>
            )}
          </div>
        </div>

        {/* Excuse text */}
        <p className="text-[var(--muted)] text-sm italic mb-3">&ldquo;{e.excuse}&rdquo;</p>

        {/* Voting or result */}
        {!e.is_exempt && (
          <div className="flex items-center gap-2">
            {canVote && !isOwn ? (
              <>
                <button onClick={() => vote(e.id, 'accept')} disabled={voting === e.id}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${e.my_vote === 'accept' ? 'bg-green-600/30 text-green-400 border border-green-600/40' : 'bg-[var(--surface-2)] text-[var(--muted)] border border-[var(--border)] hover:border-green-600/40 hover:text-green-400'}`}>
                  ✅ Gilt <span className="opacity-60">({e.accept_count})</span>
                </button>
                <button onClick={() => vote(e.id, 'reject')} disabled={voting === e.id}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${e.my_vote === 'reject' ? 'bg-red-600/30 text-red-400 border border-red-600/40' : 'bg-[var(--surface-2)] text-[var(--muted)] border border-[var(--border)] hover:border-red-600/40 hover:text-red-400'}`}>
                  ❌ Gilt nicht <span className="opacity-60">({e.reject_count})</span>
                </button>
              </>
            ) : (
              total > 0 ? (
                <div className="flex gap-3 text-xs text-[var(--muted)]">
                  <span className="text-green-500">✅ {e.accept_count}</span>
                  <span className="text-red-500">❌ {e.reject_count}</span>
                </div>
              ) : !info.isPast ? (
                <span className="text-xs text-[var(--faint)]">Wird im Voting bewertet</span>
              ) : (
                <span className="text-xs text-[var(--faint)]">Keine Votes — Bitch bleibt</span>
              )
            )}
          </div>
        )}
      </div>
    );
  }

  function RedactedCard({ e }: { e: Excuse }) {
    const statusCfg = e.user_status_type ? STATUS_LABELS[e.user_status_type] : null;
    return (
      <div className="card p-4">
        <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
          <div>
            <span className="font-semibold text-sm">{e.user_name}</span>
            <span className="text-[var(--faint)] text-xs ml-2">
              {DAY_NAMES[e.day_of_week - 1]}, {format(new Date(e.date), 'd. MMM', { locale: de })}
            </span>
          </div>
          <div className="flex gap-1">
            {e.holiday && (
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400 border border-purple-500/30">🎄 {e.holiday}</span>
            )}
            {statusCfg && (
              <span className={`text-[11px] px-2 py-0.5 rounded-full border ${statusCfg.color}`}>{statusCfg.icon} {statusCfg.label}</span>
            )}
            {e.is_exempt && (
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-green-600/20 text-green-400 border border-green-500/30">✓ Befreit</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 py-2 px-3 rounded-lg bg-[var(--surface-2)]">
          <span className="text-[var(--faint)] text-xs">🔒</span>
          <span className="text-[var(--faint)] text-xs italic">Ausrede wird am {info.votingStartDay}. {format(month, 'MMMM', { locale: de })} aufgedeckt</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-[var(--text)]">
      <PageHeader title="🗳️ Ausreden-Gericht" />

      <main className="max-w-md mx-auto px-4 pb-24 pt-1">
        {/* Monats-Navigation */}
        <div className="flex items-center justify-between mb-5">
          <button onClick={() => setMonth(m => subMonths(m, 1))} className="seg-btn" aria-label="Vorheriger Monat">‹</button>
          <h2 className="font-display text-xl tracking-wide capitalize">{monthLabel}</h2>
          <button onClick={() => setMonth(m => addMonths(m, 1))} className="seg-btn" aria-label="Nächster Monat">›</button>
        </div>

        {/* Progress bar / status banner */}
        {info.isCurrentMonth && !info.votingOpen && (
          <div className="card p-5 mb-6">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold">Voting öffnet in</span>
              <span className="font-display text-2xl" style={{ color: 'var(--accent)' }}>{info.daysUntilVoting} {info.daysUntilVoting === 1 ? 'Tag' : 'Tagen'}</span>
            </div>

            <div className="relative h-3 rounded-full overflow-hidden mb-2 bg-[var(--surface-2)]">
              <div className="absolute top-0 h-full bg-yellow-600/20 rounded-r-full" style={{ left: `${info.votingPct}%`, right: 0 }} />
              <div className="absolute top-0 left-0 h-full rounded-full transition-all" style={{ width: `${info.progressPct}%`, background: 'var(--accent)' }} />
              <div className="absolute top-0 h-full w-0.5 bg-yellow-500" style={{ left: `${info.votingPct}%` }} />
            </div>

            <div className="flex justify-between text-[11px] text-[var(--faint)] mt-1">
              <span>1. {format(month, 'MMM', { locale: de })}</span>
              <span className="text-yellow-600/80">🗳️ {info.votingStartDay}. {format(month, 'MMM', { locale: de })}</span>
              <span>{info.daysInMonth}. {format(month, 'MMM', { locale: de })}</span>
            </div>

            {excuses.length > 0 && (
              <div className="mt-3 pt-3 border-t border-[var(--border-soft)] text-center text-xs text-[var(--muted)]">
                {excuses.length} {excuses.length === 1 ? 'Ausrede wartet' : 'Ausreden warten'} — Inhalt bleibt bis zum {info.votingStartDay}. versteckt
              </div>
            )}
          </div>
        )}

        {info.isCurrentMonth && info.votingOpen && (
          <div className="rounded-xl px-4 py-3 mb-6 text-center bg-yellow-500/10 border border-yellow-600/30">
            <div className="text-sm text-yellow-400 font-semibold">🗳️ Voting läuft — stimme jetzt ab!</div>
            <div className="text-xs text-yellow-600 mt-0.5">Endet am 1. {format(addMonths(month, 1), 'MMMM', { locale: de })}</div>
          </div>
        )}

        {info.isPast && (
          <div className="card px-4 py-3 mb-6 text-center text-sm text-[var(--muted)]">
            Abgeschlossen — Ergebnis steht fest
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className="text-center text-[var(--faint)] py-16">Lädt…</div>
        ) : excuses.length === 0 ? (
          <div className="card p-10 text-center">
            <div className="text-4xl mb-2">🏅</div>
            <div className="text-[var(--muted)] text-sm">Keine Ausreden diesen Monat.</div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Others' excuses */}
            {othersExcuses.length > 0 && (
              <section>
                <h3 className="section-label mb-3">Ausreden der anderen</h3>
                <div className="space-y-3">
                  {othersExcuses.map(e =>
                    info.votingOpen || info.isPast
                      ? <ExcuseCard key={e.id} e={e} canVote={info.votingOpen && !info.isPast} />
                      : <RedactedCard key={e.id} e={e} />
                  )}
                </div>
              </section>
            )}

            {/* Own excuses — always visible to yourself */}
            {ownExcuses.length > 0 && (
              <section>
                <h3 className="section-label mb-3">Deine Ausreden</h3>
                <div className="space-y-3">
                  {ownExcuses.map(e => <ExcuseCard key={e.id} e={e} canVote={false} />)}
                </div>
              </section>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
