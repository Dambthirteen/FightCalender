'use client';

import { useEffect, useState } from 'react';
import { format, subMonths, addMonths } from 'date-fns';
import { de } from 'date-fns/locale';

interface Entry { user_name: string; skip_count: number; }

const MEDALS = ['🥇', '🥈', '🥉'];
const CROWNS = ['👑', '💩', '🤡'];

export default function BitchPage() {
  const [month, setMonth] = useState(new Date());
  const [data, setData] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);

  const monthKey = format(month, 'yyyy-MM');

  useEffect(() => {
    setLoading(true);
    fetch(`/api/bitch?month=${monthKey}`)
      .then(r => r.json())
      .then(d => setData(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false));
  }, [monthKey]);

  const monthLabel = format(month, 'MMMM yyyy', { locale: de });
  const topBitch = data[0];

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Header */}
      <header className="border-b border-[#1a1a1a] px-4 py-4 flex items-center justify-between max-w-2xl mx-auto">
        <div className="flex items-center gap-3">
          <a href="/" className="text-gray-500 hover:text-white transition-colors text-sm">← Zurück</a>
        </div>
        <div className="text-center">
          <h1 className="font-bold text-lg">🐔 Bitch des Monats</h1>
        </div>
        <div className="w-16" />
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
        {/* Month navigation */}
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={() => setMonth(m => subMonths(m, 1))}
            className="p-2 hover:bg-[#1a1a1a] rounded-lg transition-colors text-gray-400 hover:text-white text-sm"
          >
            ← Vorheriger
          </button>
          <h2 className="font-semibold capitalize">{monthLabel}</h2>
          <button
            onClick={() => setMonth(m => addMonths(m, 1))}
            className="p-2 hover:bg-[#1a1a1a] rounded-lg transition-colors text-gray-400 hover:text-white text-sm"
          >
            Nächster →
          </button>
        </div>

        {loading ? (
          <div className="text-center text-gray-600 py-20">Laden...</div>
        ) : data.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-5xl mb-3">💪</div>
            <div className="text-gray-500">Niemand hat diesen Monat gefehlt.</div>
            <div className="text-gray-600 text-sm mt-1">Respekt.</div>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Top Bitch highlight */}
            {topBitch && (
              <div className="bg-yellow-500/10 border border-yellow-600/30 rounded-2xl p-6 text-center mb-6">
                <div className="text-4xl mb-2">🐔</div>
                <div className="text-xs text-yellow-600 uppercase tracking-widest font-semibold mb-1">Bitch des Monats</div>
                <div className="text-2xl font-bold text-yellow-400">{topBitch.user_name}</div>
                <div className="text-yellow-600 text-sm mt-1">{topBitch.skip_count}× nicht da gewesen</div>
              </div>
            )}

            {/* Full leaderboard */}
            <div className="bg-[#111] border border-[#1a1a1a] rounded-2xl overflow-hidden">
              {data.map((entry, i) => (
                <div
                  key={entry.user_name}
                  className={`flex items-center justify-between px-5 py-4 ${i < data.length - 1 ? 'border-b border-[#1a1a1a]' : ''}`}
                >
                  <div className="flex items-center gap-4">
                    <span className="text-xl w-8 text-center">
                      {i < 3 ? CROWNS[i] : <span className="text-gray-600 text-sm font-mono">#{i + 1}</span>}
                    </span>
                    <span className={`font-medium ${i === 0 ? 'text-yellow-400' : 'text-white'}`}>
                      {entry.user_name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-bold ${i === 0 ? 'text-yellow-400' : 'text-gray-400'}`}>
                      {entry.skip_count}×
                    </span>
                    <span className="text-gray-600 text-xs">gefehlt</span>
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
