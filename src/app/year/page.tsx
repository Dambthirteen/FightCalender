'use client';

import { useEffect, useState } from 'react';

const MONTH_NAMES = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
const MEDALS = ['🥇', '🥈', '🥉'];

interface Entry { user_name: string; total: number; }
interface MonthlyEntry { user_name: string; month: number; count: number; }
interface YearData {
  year: number;
  macher: Entry[];
  bitch: Entry[];
  macherMonthly: MonthlyEntry[];
}

const PODEST_STYLES = [
  'bg-yellow-500/20 border-yellow-500/40 text-yellow-300',
  'bg-gray-400/10 border-gray-400/30 text-gray-300',
  'bg-orange-700/20 border-orange-700/40 text-orange-400',
];

function Podest({ data, title, icon, colorClass }: {
  data: Entry[]; title: string; icon: string; colorClass: (i: number) => string;
}) {
  if (data.length === 0) return (
    <div className="bg-[#111] border border-[#1a1a1a] rounded-2xl p-6 text-center text-gray-600 text-sm py-10">
      Noch keine Daten für dieses Jahr
    </div>
  );

  const top3 = data.slice(0, 3);
  const rest = data.slice(3);

  return (
    <div className="bg-[#111] border border-[#1a1a1a] rounded-2xl overflow-hidden">
      <div className="px-5 py-4 border-b border-[#1a1a1a] flex items-center gap-2">
        <span className="text-xl">{icon}</span>
        <h3 className="font-bold text-base">{title}</h3>
      </div>

      {/* Podest */}
      <div className="flex items-end justify-center gap-3 px-5 pt-6 pb-4">
        {/* Silver (2nd) */}
        {top3[1] && (
          <div className={`flex-1 rounded-xl border p-3 text-center ${PODEST_STYLES[1]}`} style={{ marginBottom: '0px', height: '110px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
            <div className="text-xl mb-1">{MEDALS[1]}</div>
            <div className="font-semibold text-sm leading-tight">{top3[1].user_name}</div>
            <div className="text-xs opacity-70 mt-0.5">{top3[1].total}×</div>
          </div>
        )}
        {/* Gold (1st) */}
        {top3[0] && (
          <div className={`flex-1 rounded-xl border p-3 text-center ${PODEST_STYLES[0]}`} style={{ height: '140px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
            <div className="text-2xl mb-1">{MEDALS[0]}</div>
            <div className="font-bold text-sm leading-tight">{top3[0].user_name}</div>
            <div className="text-xs opacity-70 mt-0.5">{top3[0].total}×</div>
          </div>
        )}
        {/* Bronze (3rd) */}
        {top3[2] && (
          <div className={`flex-1 rounded-xl border p-3 text-center ${PODEST_STYLES[2]}`} style={{ height: '90px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
            <div className="text-xl mb-1">{MEDALS[2]}</div>
            <div className="font-semibold text-sm leading-tight">{top3[2].user_name}</div>
            <div className="text-xs opacity-70 mt-0.5">{top3[2].total}×</div>
          </div>
        )}
      </div>

      {/* Rest of the list */}
      {rest.length > 0 && (
        <div className="border-t border-[#1a1a1a]">
          {rest.map((e, i) => (
            <div key={e.user_name} className={`flex items-center justify-between px-5 py-3 ${i < rest.length - 1 ? 'border-b border-[#1a1a1a]' : ''}`}>
              <div className="flex items-center gap-3">
                <span className="text-gray-600 text-sm w-5 text-right">#{i + 4}</span>
                <span className="text-sm text-gray-300">{e.user_name}</span>
              </div>
              <span className="text-sm text-gray-500">{e.total}×</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MiniBarChart({ data, users }: { data: MonthlyEntry[]; users: string[] }) {
  if (data.length === 0) return null;
  const currentMonth = new Date().getMonth() + 1;
  const colors = ['bg-red-500', 'bg-blue-500', 'bg-green-500', 'bg-orange-500', 'bg-purple-500'];

  const byUser: Record<string, Record<number, number>> = {};
  for (const d of data) {
    if (!byUser[d.user_name]) byUser[d.user_name] = {};
    byUser[d.user_name][d.month] = d.count;
  }

  const maxVal = Math.max(...data.map(d => d.count), 1);

  return (
    <div className="bg-[#111] border border-[#1a1a1a] rounded-2xl p-5">
      <h3 className="font-bold text-base mb-1">📈 Anwesenheit nach Monat</h3>
      <p className="text-xs text-gray-600 mb-4">Kumuliert seit Januar</p>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 mb-4">
        {users.slice(0, 5).map((u, i) => (
          <div key={u} className="flex items-center gap-1.5">
            <div className={`w-2.5 h-2.5 rounded-full ${colors[i % colors.length]}`} />
            <span className="text-xs text-gray-400">{u}</span>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="flex items-end gap-1 h-24">
        {MONTH_NAMES.map((m, mi) => {
          const monthNum = mi + 1;
          const isFuture = monthNum > currentMonth;
          return (
            <div key={m} className="flex-1 flex flex-col items-center gap-0.5">
              <div className="w-full flex items-end gap-0.5 h-20">
                {users.slice(0, 5).map((u, ui) => {
                  const val = byUser[u]?.[monthNum] ?? 0;
                  const pct = Math.round((val / maxVal) * 100);
                  return (
                    <div key={u} className="flex-1 flex flex-col justify-end">
                      {val > 0 && (
                        <div
                          className={`w-full rounded-t-sm ${colors[ui % colors.length]} ${isFuture ? 'opacity-20' : 'opacity-80'}`}
                          style={{ height: `${pct}%`, minHeight: val > 0 ? '3px' : '0' }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
              <span className={`text-[9px] ${isFuture ? 'text-gray-700' : 'text-gray-500'}`}>{m}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function YearPage() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [data, setData] = useState<YearData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/year?year=${year}`)
      .then(r => r.json())
      .then(d => setData(d))
      .finally(() => setLoading(false));
  }, [year]);

  const lastUpdate = (() => {
    const d = new Date();
    d.setDate(1);
    return d.toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' });
  })();

  const allUsers = data ? [...new Set([...data.macher.map(m => m.user_name), ...data.macherMonthly.map(m => m.user_name)])] : [];

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <header className="border-b border-[#1a1a1a] px-4 py-4 flex items-center justify-between max-w-2xl mx-auto">
        <a href="/" className="text-gray-500 hover:text-white transition-colors text-sm">← Zurück</a>
        <h1 className="font-bold text-lg">📊 Jahresauswertung</h1>
        <div className="flex items-center gap-1">
          <button onClick={() => setYear(y => y - 1)} className="p-1.5 hover:bg-[#1a1a1a] rounded text-gray-500 hover:text-white text-sm">←</button>
          <span className="text-sm font-semibold w-12 text-center">{year}</span>
          <button onClick={() => setYear(y => y + 1)} disabled={year >= currentYear} className="p-1.5 hover:bg-[#1a1a1a] rounded text-gray-500 hover:text-white text-sm disabled:opacity-30">→</button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        <div className="text-xs text-gray-600 text-center">Stand: {lastUpdate} · Aktualisiert sich jeden 1. des Monats</div>

        {loading ? (
          <div className="text-center text-gray-600 py-16">Laden...</div>
        ) : !data ? (
          <div className="text-center text-gray-600 py-16">Fehler beim Laden</div>
        ) : (
          <>
            <Podest data={data.macher} title="Macher des Jahres" icon="💪" colorClass={i => ''} />
            <Podest data={data.bitch} title="Bitch des Jahres" icon="🐔" colorClass={i => ''} />
            <MiniBarChart data={data.macherMonthly} users={allUsers} />

            <div className="bg-[#111] border border-[#1a1a1a] rounded-xl px-4 py-3 text-xs text-gray-600">
              <strong className="text-gray-500">Hinweis:</strong> Die Bitch-Punkte zählen nur wenn die Ausrede im Ausreden-Gericht abgelehnt wurde (Ende des jeweiligen Monats). Bis Monatsende können sich die Punkte noch ändern.
            </div>
          </>
        )}
      </main>
    </div>
  );
}
