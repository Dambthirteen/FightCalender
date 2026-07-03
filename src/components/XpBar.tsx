'use client';

import type { ReactNode } from 'react';

interface Rank { name: string; color: string }
export interface XpData { level: number; into: number; span: number; pct: number; rank: Rank }

/** Schlanke XP-Fortschrittsleiste (Start & Profil).
 *  `right` ersetzt die XP-Zahl rechts (z. B. um die Streak einzublenden).
 *  `color` überschreibt die Balkenfarbe (Premium-Cosmetic „XP-Leiste"). */
export default function XpBar({ data, compact = false, right, color }: { data: XpData; compact?: boolean; right?: ReactNode; color?: string | null }) {
  const fill = color
    ? `linear-gradient(90deg, ${color}, ${color})`
    : `linear-gradient(90deg, ${data.rank.color}, var(--accent))`;
  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-bold" style={{ color: color ?? data.rank.color }}>
          Lvl {data.level} · {data.rank.name}
        </span>
        {right ?? (!compact && (
          <span className="text-[10px] text-[var(--faint)] tnum">{data.into} / {data.span} XP</span>
        ))}
      </div>
      <div className="h-2.5 rounded-full overflow-hidden" style={{ background: 'var(--surface-2)' }}>
        <div className="h-full rounded-full"
          style={{
            width: `${Math.max(3, Math.round(data.pct * 100))}%`,
            background: fill,
            transition: 'width .6s ease',
          }} />
      </div>
    </div>
  );
}
