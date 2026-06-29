'use client';

interface Rank { name: string; color: string }
export interface XpData { level: number; into: number; span: number; pct: number; rank: Rank }

/** Schlanke XP-Fortschrittsleiste (Start & Profil). */
export default function XpBar({ data, compact = false }: { data: XpData; compact?: boolean }) {
  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-bold" style={{ color: data.rank.color }}>
          Lvl {data.level} · {data.rank.name}
        </span>
        {!compact && (
          <span className="text-[10px] text-[var(--faint)] tnum">{data.into} / {data.span} XP</span>
        )}
      </div>
      <div className="h-2.5 rounded-full overflow-hidden" style={{ background: 'var(--surface-2)' }}>
        <div className="h-full rounded-full"
          style={{
            width: `${Math.max(3, Math.round(data.pct * 100))}%`,
            background: `linear-gradient(90deg, ${data.rank.color}, var(--accent))`,
            transition: 'width .6s ease',
          }} />
      </div>
    </div>
  );
}
