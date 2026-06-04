'use client';

import { useEffect, useState } from 'react';
import { format, subMonths, addMonths, getDaysInMonth } from 'date-fns';
import { de } from 'date-fns/locale';
import { useUser } from '@/components/UserProvider';

const DAY_NAMES = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

interface Excuse {
  id: number;
  user_name: string;
  date: string;
  excuse: string;
  day_of_week: number;
  accept_count: number;
  reject_count: number;
  my_vote: 'accept' | 'reject' | null;
}

function isVotingWindow(date: Date): boolean {
  const daysInMonth = getDaysInMonth(date);
  return date.getDate() >= daysInMonth - 2;
}

function isPastMonth(date: Date): boolean {
  const now = new Date();
  return date.getFullYear() < now.getFullYear() ||
    (date.getFullYear() === now.getFullYear() && date.getMonth() < now.getMonth());
}

export default function VotePage() {
  const { userName } = useUser();
  const [month, setMonth] = useState(new Date());
  const [excuses, setExcuses] = useState<Excuse[]>([]);
  const [loading, setLoading] = useState(true);
  const [voting, setVoting] = useState<number | null>(null);

  const monthKey = format(month, 'yyyy-MM');
  const monthLabel = format(month, 'MMMM yyyy', { locale: de });
  const votingOpen = isVotingWindow(month) || isPastMonth(month);
  const isPast = isPastMonth(month);

  const now = new Date();
  const daysInCurrentMonth = getDaysInMonth(month);
  const votingStartDay = daysInCurrentMonth - 2;

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
        const wasAccept = e.my_vote === 'accept';
        const wasReject = e.my_vote === 'reject';
        return {
          ...e,
          my_vote: v,
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

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <header className="border-b border-[#1a1a1a] px-4 py-4 flex items-center justify-between max-w-2xl mx-auto">
        <a href="/" className="text-gray-500 hover:text-white transition-colors text-sm">← Zurück</a>
        <h1 className="font-bold text-lg">🗳️ Ausreden-Gericht</h1>
        <div className="w-16" />
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        {/* Month nav */}
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => setMonth(m => subMonths(m, 1))} className="p-2 hover:bg-[#1a1a1a] rounded-lg text-gray-400 hover:text-white text-sm">← Vorheriger</button>
          <h2 className="font-semibold capitalize">{monthLabel}</h2>
          <button onClick={() => setMonth(m => addMonths(m, 1))} className="p-2 hover:bg-[#1a1a1a] rounded-lg text-gray-400 hover:text-white text-sm">Nächster →</button>
        </div>

        {/* Voting window info */}
        {!votingOpen && !isPast && (
          <div className="bg-[#111] border border-[#1a1a1a] rounded-xl px-4 py-4 mb-6 text-center">
            <div className="text-2xl mb-1">⏳</div>
            <div className="text-sm text-gray-400">Voting öffnet am <span className="text-white font-semibold">{votingStartDay}. {format(month, 'MMMM', { locale: de })}</span></div>
            <div className="text-xs text-gray-600 mt-1">Die letzten 3 Tage des Monats</div>
          </div>
        )}
        {votingOpen && !isPast && (
          <div className="bg-yellow-500/10 border border-yellow-600/30 rounded-xl px-4 py-3 mb-6 text-center">
            <div className="text-sm text-yellow-400 font-semibold">🗳️ Voting läuft — stimme jetzt ab!</div>
            <div className="text-xs text-yellow-600 mt-0.5">Endet am 1. {format(addMonths(month, 1), 'MMMM', { locale: de })}</div>
          </div>
        )}
        {isPast && (
          <div className="bg-[#111] border border-[#1a1a1a] rounded-xl px-4 py-3 mb-6 text-center">
            <div className="text-sm text-gray-400">Abgeschlossen — Ergebnis steht fest</div>
          </div>
        )}

        {loading ? (
          <div className="text-center text-gray-600 py-16">Laden...</div>
        ) : excuses.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-4xl mb-2">🏅</div>
            <div className="text-gray-500 text-sm">Keine Ausreden diesen Monat.</div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Others' excuses — votable */}
            {othersExcuses.length > 0 && (
              <section>
                <h3 className="text-xs text-gray-500 uppercase tracking-widest mb-3">Ausreden der anderen</h3>
                <div className="space-y-3">
                  {othersExcuses.map(e => {
                    const rejected = e.reject_count > e.accept_count;
                    const total = e.accept_count + e.reject_count;
                    return (
                      <div key={e.id} className={`bg-[#111] border rounded-xl p-4 ${rejected && isPast ? 'border-red-900/40' : 'border-[#1a1a1a]'}`}>
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div>
                            <span className="font-semibold text-sm">{e.user_name}</span>
                            <span className="text-gray-600 text-xs ml-2">
                              {DAY_NAMES[e.day_of_week - 1]}, {format(new Date(e.date), 'd. MMM', { locale: de })}
                            </span>
                          </div>
                          {isPast && (
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${rejected ? 'bg-red-600/20 text-red-400' : 'bg-green-600/20 text-green-400'}`}>
                              {rejected ? '❌ Abgelehnt' : '✅ Angenommen'}
                            </span>
                          )}
                        </div>
                        <p className="text-gray-300 text-sm italic mb-3">&ldquo;{e.excuse}&rdquo;</p>
                        <div className="flex items-center gap-2">
                          {votingOpen && (
                            <>
                              <button
                                onClick={() => vote(e.id, 'accept')}
                                disabled={voting === e.id}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${e.my_vote === 'accept' ? 'bg-green-600/30 text-green-400 border border-green-600/40' : 'bg-[#1a1a1a] text-gray-400 border border-[#333] hover:border-green-600/40 hover:text-green-400'}`}
                              >
                                ✅ Gilt <span className="opacity-60">({e.accept_count})</span>
                              </button>
                              <button
                                onClick={() => vote(e.id, 'reject')}
                                disabled={voting === e.id}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${e.my_vote === 'reject' ? 'bg-red-600/30 text-red-400 border border-red-600/40' : 'bg-[#1a1a1a] text-gray-400 border border-[#333] hover:border-red-600/40 hover:text-red-400'}`}
                              >
                                ❌ Gilt nicht <span className="opacity-60">({e.reject_count})</span>
                              </button>
                            </>
                          )}
                          {!votingOpen && total > 0 && (
                            <div className="flex gap-3 text-xs text-gray-500">
                              <span className="text-green-600">✅ {e.accept_count}</span>
                              <span className="text-red-600">❌ {e.reject_count}</span>
                            </div>
                          )}
                          {!votingOpen && total === 0 && (
                            <span className="text-xs text-gray-700">Noch keine Votes</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Own excuses — read-only */}
            {ownExcuses.length > 0 && (
              <section>
                <h3 className="text-xs text-gray-500 uppercase tracking-widest mb-3">Deine Ausreden</h3>
                <div className="space-y-3">
                  {ownExcuses.map(e => {
                    const rejected = e.reject_count > e.accept_count;
                    const total = e.accept_count + e.reject_count;
                    return (
                      <div key={e.id} className={`bg-[#111] border rounded-xl p-4 ${rejected && isPast ? 'border-red-900/40' : 'border-[#1a1a1a]'}`}>
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div>
                            <span className="text-xs text-gray-500">
                              {DAY_NAMES[e.day_of_week - 1]}, {format(new Date(e.date), 'd. MMM', { locale: de })}
                            </span>
                          </div>
                          {isPast && (
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${rejected ? 'bg-red-600/20 text-red-400' : 'bg-green-600/20 text-green-400'}`}>
                              {rejected ? '❌ Abgelehnt' : '✅ Angenommen'}
                            </span>
                          )}
                        </div>
                        <p className="text-gray-300 text-sm italic mb-2">&ldquo;{e.excuse}&rdquo;</p>
                        {total > 0 && (
                          <div className="flex gap-3 text-xs text-gray-500">
                            <span className="text-green-600">✅ {e.accept_count}</span>
                            <span className="text-red-600">❌ {e.reject_count}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
