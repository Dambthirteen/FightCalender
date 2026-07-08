'use client';

import { useEffect, useState, type ReactNode } from 'react';
import LoadingScreen from '@/components/LoadingScreen';
import GroupStats from '@/components/GroupStats';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

interface Row { user_name: string; n: number }
const MEDAL = ['🥇', '🥈', '🥉'];

// Kleines textloses Logo (ersetzt das 🐔-Emoji in Titeln/Boards).
function ChickenMark({ size = 20 }: { size?: number }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/logo-chicken.png" alt="" style={{ width: size, height: size }} className="object-contain shrink-0" />;
}

function Board({ title, color, rows, unit }: { title: ReactNode; color: string; rows: Row[]; unit: string }) {
  return (
    <div className="card overflow-hidden flex-1 min-w-0">
      <div className="px-3 py-2 border-b text-center font-display text-lg tracking-wide flex items-center justify-center gap-1.5"
        style={{ borderColor: 'var(--border-soft)', color }}>{title}</div>
      <div className="divide-y" style={{ borderColor: 'var(--border-soft)' }}>
        {rows.length === 0 && <div className="px-3 py-5 text-center text-[11px] text-[var(--faint)]">noch leer</div>}
        {rows.slice(0, 8).map((r, i) => (
          <div key={r.user_name} className="flex items-center gap-2 px-3 py-2" style={{ borderColor: 'var(--border-soft)' }}>
            <span className="w-5 text-center text-xs shrink-0">{MEDAL[i] ?? <span className="text-[var(--faint)]">{i + 1}</span>}</span>
            <span className="text-sm font-medium flex-1 min-w-0 truncate">{r.user_name}</span>
            <span className="font-display text-lg tnum shrink-0" style={{ color }}>{r.n}</span>
          </div>
        ))}
      </div>
      {rows.length > 0 && <div className="px-3 py-1.5 text-[10px] text-center text-[var(--faint)] uppercase tracking-wider">{unit}</div>}
    </div>
  );
}

export default function StatistikPage() {
  const now = new Date();
  const monthKey = format(now, 'yyyy-MM');
  const year = now.getFullYear();

  const [macherM, setMacherM] = useState<Row[]>([]);
  const [bitchM, setBitchM] = useState<Row[]>([]);
  const [macherY, setMacherY] = useState<Row[]>([]);
  const [bitchY, setBitchY] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`/api/macher?month=${monthKey}`).then((r) => r.json()),
      fetch(`/api/bitch?month=${monthKey}`).then((r) => r.json()),
      fetch(`/api/year?year=${year}`).then((r) => r.json()),
    ])
      .then(([m, b, y]) => {
        setMacherM(Array.isArray(m) ? m.map((x) => ({ user_name: x.user_name, n: x.attend_count })) : []);
        setBitchM(Array.isArray(b) ? b.map((x) => ({ user_name: x.user_name, n: x.bitch_count })) : []);
        setMacherY(Array.isArray(y.macher) ? y.macher.map((x: { user_name: string; total: number }) => ({ user_name: x.user_name, n: x.total })) : []);
        setBitchY(Array.isArray(y.bitch) ? y.bitch.map((x: { user_name: string; total: number }) => ({ user_name: x.user_name, n: x.total })) : []);
      })
      .finally(() => setLoading(false));
  }, [monthKey, year]);

  return (
    <div className="min-h-screen text-[var(--text)]">
      <header className="max-w-md mx-auto px-4 pt-5 pb-3 flex items-center justify-between anim-in">
        <a href="/start" className="w-11 h-11 grid place-items-center rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] text-[var(--muted)] hover:text-white active:scale-95 transition-all">←</a>
        <h1 className="font-display text-2xl tracking-wide flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/tile-statistics.png" alt="" className="w-7 h-7 object-contain" />
          Statistiken
        </h1>
        <span className="w-11" />
      </header>

      <main className="max-w-md mx-auto px-4 pb-16 space-y-6">
        {loading ? (
          <LoadingScreen inline />
        ) : (
          <>
            <section className="anim-up">
              <div className="text-[11px] uppercase tracking-[0.2em] text-[var(--faint)] mb-2">{format(now, 'MMMM yyyy', { locale: de })}</div>
              <div className="flex gap-3">
                <Board title="💪 Macher" color="var(--gold)" rows={macherM} unit="Trainings" />
                <Board title={<><ChickenMark size={18} /> Chicken</>} color="var(--bitch)" rows={bitchM} unit="Fehltage" />
              </div>
            </section>

            <section className="anim-up" style={{ animationDelay: '80ms' }}>
              <div className="text-[11px] uppercase tracking-[0.2em] text-[var(--faint)] mb-2">Jahr {year}</div>
              <div className="flex gap-3">
                <Board title="💪 Macher" color="var(--gold)" rows={macherY} unit="Trainings" />
                <Board title={<><ChickenMark size={18} /> Chicken</>} color="var(--bitch)" rows={bitchY} unit="Fehltage" />
              </div>
            </section>

            <GroupStats />
          </>
        )}
      </main>
    </div>
  );
}
