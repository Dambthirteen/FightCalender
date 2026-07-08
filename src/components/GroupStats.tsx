'use client';
import { useEffect, useState } from 'react';

/**
 * Gruppenstatistiken (unten auf /statistik): Aktivität je Person, Erscheinungsquote je Person
 * + Gruppenschnitt, Trainingspartner-Paare, Kurs-Könige, Lob (gegeben/bekommen), Gruppen-Heatmap.
 */

interface Member { user: string; total: number; ratePct: number | null; }
interface GS {
  group: boolean;
  hardMode?: boolean;
  avgRate?: number | null;
  since?: string;
  members?: Member[];
  partners?: { a: string; b: string; n: number }[];
  perCourse?: { course: string; color: string; user: string; n: number }[];
  lobReceived?: { user: string; n: number }[];
  lobGiven?: { user: string; n: number }[];
  heat?: { d: string; n: number }[];
}

const MEDAL = ['🥇', '🥈', '🥉'];
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
function heatColor(n: number): string {
  if (n <= 0) return 'var(--surface-2)';
  if (n <= 2) return 'rgba(255,111,97,0.30)';
  if (n <= 5) return 'rgba(255,111,97,0.60)';
  return 'rgba(255,111,97,0.92)';
}

function RankList({ rows, unit }: { rows: { name: string; n: number }[]; unit?: string }) {
  if (rows.length === 0) return <div className="text-[11px] text-[var(--faint)] py-2">noch leer</div>;
  return (
    <div className="divide-y" style={{ borderColor: 'var(--border-soft)' }}>
      {rows.map((r, i) => (
        <div key={r.name} className="flex items-center gap-2 py-1.5">
          <span className="w-5 text-center text-xs shrink-0">{MEDAL[i] ?? <span className="text-[var(--faint)]">{i + 1}</span>}</span>
          <span className="text-sm flex-1 min-w-0 truncate">{r.name}</span>
          <span className="font-display text-base tnum shrink-0 text-[var(--muted)]">{r.n}{unit ? <span className="text-[10px] ml-0.5">{unit}</span> : ''}</span>
        </div>
      ))}
    </div>
  );
}

export default function GroupStats() {
  const [d, setD] = useState<GS | null>(null);

  useEffect(() => {
    fetch('/api/group-stats').then((r) => r.json()).then((x) => setD(x)).catch(() => {});
  }, []);

  if (!d || !d.group) return null;
  const members = d.members ?? [];
  if (members.length === 0) return null;

  const byTotal = [...members].sort((x, y) => y.total - x.total);
  const active = byTotal.filter((m) => m.total > 0);
  const inactive = [...members].sort((x, y) => x.total - y.total).slice(0, 5);
  const rated = members.filter((m) => m.ratePct !== null).sort((x, y) => (y.ratePct ?? 0) - (x.ratePct ?? 0));

  // Heatmap ab Gruppen-Start, max 53 Wochen.
  const today = new Date().toISOString().slice(0, 10);
  const heatMap = new Map((d.heat ?? []).map((h) => [h.d, h.n]));
  const curMon = mondayOf(today);
  const span = Math.round((Date.parse(curMon) - Date.parse(mondayOf(d.since ?? today))) / (7 * 86400000));
  const numCols = Math.min(53, Math.max(1, span + 1));
  const start = addDays(curMon, -(numCols - 1) * 7);
  const cols = Array.from({ length: numCols }, (_, c) => {
    const wk = addDays(start, c * 7);
    return Array.from({ length: 7 }, (_, r) => {
      const day = addDays(wk, r);
      if (day > today) return 'transparent';
      return heatColor(heatMap.get(day) ?? 0);
    });
  });

  return (
    <section className="anim-up space-y-4" style={{ animationDelay: '160ms' }}>
      <div className="text-[11px] uppercase tracking-[0.2em] text-[var(--faint)]">Gruppe</div>

      {/* Aktivität */}
      <div className="card px-4 py-4">
        <div className="section-label mb-2">Aktivste Mitglieder</div>
        <RankList rows={active.slice(0, 8).map((m) => ({ name: m.user, n: m.total }))} unit="×" />
        {d.hardMode && inactive.length > 0 && (
          <>
            <div className="section-label mb-2 mt-4" style={{ color: 'var(--bitch)' }}>Am inaktivsten</div>
            <RankList rows={inactive.map((m) => ({ name: m.user, n: m.total }))} unit="×" />
          </>
        )}
      </div>

      {/* Erscheinungsquote je Person + Schnitt */}
      {rated.length > 0 && (
        <div className="card px-4 py-4">
          <div className="flex items-center justify-between mb-3">
            <div className="section-label">Erscheinungsquote</div>
            {d.avgRate !== null && d.avgRate !== undefined && (
              <span className="text-xs text-[var(--muted)]">Schnitt <strong className="text-[var(--text)] tnum">{d.avgRate}%</strong></span>
            )}
          </div>
          <div className="space-y-2">
            {rated.map((m) => (
              <div key={m.user} className="flex items-center gap-2.5">
                <span className="text-sm w-24 shrink-0 truncate">{m.user}</span>
                <div className="flex-1 h-2 rounded-[2px] overflow-hidden" style={{ background: 'var(--surface-2)' }}>
                  <div className="h-full rounded-[2px]" style={{ width: `${m.ratePct}%`, background: (m.ratePct ?? 0) >= (d.avgRate ?? 0) ? 'var(--good)' : 'var(--accent)' }} />
                </div>
                <span className="text-xs tnum w-9 text-right shrink-0" style={{ color: 'var(--muted)' }}>{m.ratePct}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Trainingspartner */}
      {(d.partners ?? []).length > 0 && (
        <div className="card px-4 py-4">
          <div className="section-label mb-2">Trainingspartner</div>
          <div className="divide-y" style={{ borderColor: 'var(--border-soft)' }}>
            {d.partners!.map((p, i) => (
              <div key={`${p.a}|${p.b}`} className="flex items-center gap-2 py-1.5">
                <span className="w-5 text-center text-xs shrink-0">{MEDAL[i] ?? <span className="text-[var(--faint)]">{i + 1}</span>}</span>
                <span className="text-sm flex-1 min-w-0 truncate">{p.a} <span className="text-[var(--faint)]">&amp;</span> {p.b}</span>
                <span className="font-display text-base tnum shrink-0 text-[var(--muted)]">{p.n}<span className="text-[10px] ml-0.5">×</span></span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Kurs-Könige */}
      {(d.perCourse ?? []).length > 0 && (
        <div className="card px-4 py-4">
          <div className="section-label mb-2">Kurs-Könige</div>
          <div className="divide-y" style={{ borderColor: 'var(--border-soft)' }}>
            {d.perCourse!.map((csr) => (
              <div key={csr.course} className="flex items-center gap-2.5 py-1.5">
                <span className="w-2.5 h-2.5 rounded-[2px] shrink-0" style={{ background: courseColor(csr.color) }} />
                <span className="text-sm flex-1 min-w-0 truncate">{csr.course}</span>
                <span className="text-sm font-semibold shrink-0">{csr.user}</span>
                <span className="text-xs tnum shrink-0 text-[var(--muted)]">{csr.n}×</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Lob */}
      {((d.lobReceived ?? []).length > 0 || (d.lobGiven ?? []).length > 0) && (
        <div className="card px-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="section-label mb-1.5">Lob bekommen</div>
              <RankList rows={(d.lobReceived ?? []).slice(0, 5).map((r) => ({ name: r.user, n: r.n }))} />
            </div>
            <div>
              <div className="section-label mb-1.5">Lob gegeben</div>
              <RankList rows={(d.lobGiven ?? []).slice(0, 5).map((r) => ({ name: r.user, n: r.n }))} />
            </div>
          </div>
        </div>
      )}

      {/* Gruppen-Heatmap */}
      <div className="card px-4 py-4">
        <div className="flex items-center justify-between mb-2.5">
          <div className="section-label">Gruppen-Aktivität</div>
          <span className="text-[10px] text-[var(--faint)]">seit Start</span>
        </div>
        <div className="overflow-x-auto [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: 'none' }}>
          <div className="inline-flex gap-[2px]">
            {cols.map((col, ci) => (
              <div key={ci} className="flex flex-col gap-[2px]">
                {col.map((color, ri) => <div key={ri} className="w-[11px] h-[11px] rounded-[2px]" style={{ background: color }} />)}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
