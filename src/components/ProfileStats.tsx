'use client';
import { useEffect, useState } from 'react';

/**
 * Persönliche Trainings-Statistik im Profil-Stats-Tab: Kennzahl-Kacheln, Kurs-Aufteilung (Donut),
 * Status-Heatmap (trainiert/verpasst/Urlaub/krank/Wettkampf), Monats-/Wochen-Trend und
 * (für Wettkämpfer) Sieg/Niederlage/Unentschieden. Daten von /api/profile/analytics.
 */

interface Course { name: string; color: string; n: number; }
interface Analytics {
  total: number;
  thisMonth: number;
  lastMonth: number;
  bestMonth: { m: string; n: number } | null;
  bestWeek: { w: string; n: number } | null;
  days: { d: string; status: string }[];
  since: string;
  weeks: { w: string; n: number }[];
  byCourse: Course[];
  rate: { planned: number; attended: number; pct: number } | null;
  rateWeeks: number;
}

const MONTHS = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

// Status-Farben der Heatmap.
const STATUS: Record<string, { color: string; label: string }> = {
  attended:    { color: '#3ddc84', label: 'Trainiert' },
  missed:      { color: '#ff453a', label: 'Verpasst' },
  vacation:    { color: '#3b82f6', label: 'Urlaub' },
  sick:        { color: '#a855f7', label: 'Krank/Verletzt' },
  competition: { color: '#ffc24b', label: 'Wettkampf' },
};
const STATUS_ORDER = ['attended', 'missed', 'vacation', 'sick', 'competition'];

// Kursfarben (pastell, wie im Rest der App).
const COURSE_HEX: Record<string, string> = { red: '#ff8a80', blue: '#93b7f7', green: '#8fe0b0', orange: '#ffbf80', purple: '#c9a3f5' };
const courseColor = (c: string) => COURSE_HEX[c] ?? '#8a8a94';

function addDays(s: string, n: number): string {
  const d = new Date(`${s}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function mondayOf(s: string): string {
  const d = new Date(`${s}T12:00:00Z`);
  const dow = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - dow);
  return d.toISOString().slice(0, 10);
}
function monthLabel(ym: string): string {
  return `${MONTHS[Number(ym.slice(5, 7)) - 1]} ${ym.slice(2, 4)}`;
}

function Tile({ value, label, sub }: { value: React.ReactNode; label: string; sub?: string }) {
  return (
    <div className="card px-2.5 py-3 flex-1 text-center min-w-0">
      <div className="font-display text-2xl tnum leading-none" style={{ color: 'var(--accent-2)' }}>{value}</div>
      <div className="text-[10px] text-[var(--muted)] uppercase tracking-wider mt-1 leading-tight">{label}</div>
      {sub && <div className="text-[10px] text-[var(--faint)] mt-0.5 truncate">{sub}</div>}
    </div>
  );
}

export default function ProfileStats({ user, comps }: { user: string; comps: { result: string | null }[] }) {
  const [a, setA] = useState<Analytics | null>(null);

  useEffect(() => {
    fetch(`/api/profile/analytics?user=${encodeURIComponent(user)}`).then((r) => r.json())
      .then((d) => { if (d && !d.error && !d.private) setA(d); }).catch(() => {});
  }, [user]);

  if (!a) return null;

  const today = new Date().toISOString().slice(0, 10);
  const statusMap = new Map(a.days.map((x) => [x.d, x.status]));

  // Heatmap ab Tracking-Start (a.since) bis heute; max. 53 Wochen. Kein leeres Vorjahr.
  const curMon = mondayOf(today);
  const weeksSpan = Math.round((Date.parse(curMon) - Date.parse(mondayOf(a.since))) / (7 * 86400000));
  const numCols = Math.min(53, Math.max(1, weeksSpan + 1));
  const start = addDays(curMon, -(numCols - 1) * 7);
  const cols = Array.from({ length: numCols }, (_, c) => {
    const wk = addDays(start, c * 7);
    const days = Array.from({ length: 7 }, (_, r) => {
      const d = addDays(wk, r);
      if (d > today) return { color: 'transparent' };
      const st = statusMap.get(d);
      return { color: st ? STATUS[st].color : 'var(--surface-2)' };
    });
    const label = Number(wk.slice(8, 10)) <= 7 ? MONTHS[Number(wk.slice(5, 7)) - 1] : '';
    return { days, label };
  });

  // Kurs-Donut.
  const courses = a.byCourse.filter((cs) => cs.n > 0);
  const cTotal = courses.reduce((s, cs) => s + cs.n, 0);
  let acc = 0;

  // Trend: 12 Wochenwerte + 4-Wochen-Schnitt.
  const ws = a.weeks;
  const maxN = Math.max(1, ...ws.map((w) => w.n));
  const xy = (n: number, i: number) => `${(i / (ws.length - 1)) * 100},${32 - (n / maxN) * 28 - 2}`;
  const line = ws.map((w, i) => xy(w.n, i)).join(' ');
  const avg = ws.map((_, i) => { const sl = ws.slice(Math.max(0, i - 3), i + 1); return sl.reduce((s, w) => s + w.n, 0) / sl.length; });
  const avgLine = avg.map((v, i) => xy(v, i)).join(' ');
  const delta = a.lastMonth > 0 ? Math.round(((a.thisMonth - a.lastMonth) / a.lastMonth) * 100) : null;

  // Wettkämpfe
  const wins = comps.filter((c) => c.result === 'win').length;
  const losses = comps.filter((c) => c.result === 'loss').length;
  const draws = comps.filter((c) => c.result === 'draw').length;
  const wld = wins + losses + draws;
  const winRate = wld > 0 ? Math.round((wins / wld) * 100) : 0;

  return (
    <div className="space-y-5 anim-in">
      {/* Kennzahl-Kacheln */}
      <div className="flex gap-2.5">
        <Tile value={a.total} label="Trainings" />
        <Tile value={a.rate ? `${a.rate.pct}%` : '–'} label="Quote" sub={a.rate ? `${a.rate.attended}/${a.rate.planned} · ${a.rateWeeks} Wo` : undefined} />
        <Tile value={a.bestMonth?.n ?? '–'} label="Bester Monat" sub={a.bestMonth ? monthLabel(a.bestMonth.m) : undefined} />
      </div>

      {/* Kurs-Aufteilung (Donut) */}
      {courses.length > 0 && (
        <div className="card px-4 py-4">
          <div className="section-label mb-3">Kurs-Aufteilung</div>
          <div className="flex items-center gap-4">
            <svg viewBox="0 0 36 36" className="w-24 h-24 shrink-0">
              <circle cx={18} cy={18} r={15.9155} fill="none" stroke="var(--surface-2)" strokeWidth={4.5} />
              {courses.map((cs) => {
                const pct = cTotal ? (cs.n / cTotal) * 100 : 0;
                const el = (
                  <circle key={cs.name} cx={18} cy={18} r={15.9155} fill="none" stroke={courseColor(cs.color)} strokeWidth={4.5}
                    strokeDasharray={`${pct} ${100 - pct}`} strokeDashoffset={`${25 - acc}`} />
                );
                acc += pct;
                return el;
              })}
              <text x={18} y={19} textAnchor="middle" style={{ fill: 'var(--muted)', fontSize: '6px' }}>{cTotal}×</text>
            </svg>
            <div className="flex-1 min-w-0 space-y-1.5">
              {courses.slice(0, 6).map((cs) => (
                <div key={cs.name} className="flex items-center gap-2 text-xs">
                  <span className="w-2.5 h-2.5 rounded-[2px] shrink-0" style={{ background: courseColor(cs.color) }} />
                  <span className="flex-1 min-w-0 truncate">{cs.name}</span>
                  <span className="tnum text-[var(--muted)] shrink-0">{cs.n}× · {Math.round((cs.n / cTotal) * 100)}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Status-Heatmap */}
      <div className="card px-4 py-4">
        <div className="flex items-center justify-between mb-2.5">
          <div className="section-label">Aktivität</div>
          <span className="text-[10px] text-[var(--faint)]">seit Start</span>
        </div>
        <div className="overflow-x-auto [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: 'none' }}>
          <div className="inline-flex flex-col gap-[3px]">
            <div className="flex gap-[2px] h-3">
              {cols.map((col, ci) => (
                <div key={ci} className="w-[11px] text-[8px] text-[var(--faint)] whitespace-nowrap overflow-visible">{col.label}</div>
              ))}
            </div>
            <div className="flex gap-[2px]">
              {cols.map((col, ci) => (
                <div key={ci} className="flex flex-col gap-[2px]">
                  {col.days.map((cell, ri) => (
                    <div key={ri} className="w-[11px] h-[11px] rounded-[2px]" style={{ background: cell.color }} />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2.5 text-[10px] text-[var(--muted)]">
          {STATUS_ORDER.map((k) => (
            <span key={k} className="inline-flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-[2px]" style={{ background: STATUS[k].color }} />
              {STATUS[k].label}
            </span>
          ))}
        </div>
      </div>

      {/* Trend */}
      <div className="card px-4 py-4">
        <div className="flex items-center justify-between mb-1">
          <div className="section-label">Trend</div>
          {delta !== null ? (
            <span className="text-xs font-bold tnum" style={{ color: delta >= 0 ? 'var(--good)' : 'var(--accent)' }}>
              {delta >= 0 ? '▲' : '▼'} {Math.abs(delta)}%
            </span>
          ) : a.thisMonth > 0 ? <span className="text-xs font-bold" style={{ color: 'var(--good)' }}>neu</span> : null}
        </div>
        <div className="text-[11px] text-[var(--muted)] mb-2">Diesen Monat <strong className="text-[var(--text)] tnum">{a.thisMonth}</strong> · Vormonat <span className="tnum">{a.lastMonth}</span></div>
        <svg viewBox="0 0 100 34" preserveAspectRatio="none" className="w-full h-16">
          <polyline points={line} fill="none" stroke="var(--faint)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
          <polyline points={avgLine} fill="none" stroke="var(--accent)" strokeWidth={1.75} vectorEffect="non-scaling-stroke" />
        </svg>
        <div className="flex items-center justify-between mt-1 text-[9px] text-[var(--faint)]">
          <span>vor 12 Wo</span>
          <span><span style={{ color: 'var(--accent)' }}>—</span> 4-Wochen-Schnitt · aktivste Woche {a.bestWeek?.n ?? 0}×</span>
        </div>
      </div>

      {/* Wettkämpfe (nur wenn vorhanden) */}
      {wld > 0 && (
        <div className="card px-4 py-4">
          <div className="flex items-center justify-between mb-2.5">
            <div className="section-label">Wettkampf-Bilanz</div>
            <span className="text-xs font-bold tnum" style={{ color: 'var(--good)' }}>{winRate}% Siege</span>
          </div>
          <div className="flex h-3 rounded-[3px] overflow-hidden">
            {wins > 0 && <div style={{ width: `${(wins / wld) * 100}%`, background: 'var(--good)' }} />}
            {draws > 0 && <div style={{ width: `${(draws / wld) * 100}%`, background: 'var(--muted)' }} />}
            {losses > 0 && <div style={{ width: `${(losses / wld) * 100}%`, background: 'var(--accent)' }} />}
          </div>
          <div className="flex justify-between mt-2 text-xs">
            <span style={{ color: 'var(--good)' }}>{wins} Siege</span>
            <span className="text-[var(--muted)]">{draws} Unent.</span>
            <span style={{ color: 'var(--accent)' }}>{losses} Niederl.</span>
          </div>
        </div>
      )}
    </div>
  );
}
