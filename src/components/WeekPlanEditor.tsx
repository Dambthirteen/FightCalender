'use client';

import { useCallback, useEffect, useState } from 'react';
import { startOfWeek, format } from 'date-fns';
import type { GymClass } from '@/lib/db';

const COLOR_HEX: Record<string, string> = {
  red: '#ff8a80', blue: '#93b7f7', green: '#8fe0b0', orange: '#ffbf80', purple: '#c9a3f5',
};
const hex = (c: string) => COLOR_HEX[c] ?? COLOR_HEX.red;
const DAY_NAMES_FULL = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];

/**
 * Wochenplan-Editor: passt NUR die aktuelle KW an (überschreibt für diese Woche den festen
 * Plan). Entwurf lokal, ein „Speichern" = 1 Anpassung; max. 2 pro Woche, Zurücksetzen zählt nicht.
 */
export default function WeekPlanEditor({ classes }: { classes: GymClass[] }) {
  const weekMonday = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekStart = format(weekMonday, 'yyyy-MM-dd');
  const kw = format(weekMonday, 'w');

  const [draft, setDraft] = useState<Set<number>>(new Set());
  const [saved, setSaved] = useState<Set<number>>(new Set());
  const [isOverride, setIsOverride] = useState(false);
  const [editsUsed, setEditsUsed] = useState(0);
  const [maxEdits, setMaxEdits] = useState(2);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    const d = await fetch(`/api/weekly-schedule?week=${weekStart}`).then((r) => r.json()).catch(() => null);
    if (d && Array.isArray(d.classIds)) {
      setDraft(new Set(d.classIds));
      setSaved(new Set(d.classIds));
      setIsOverride(!!d.isOverride);
      setEditsUsed(d.editsUsed ?? 0);
      setMaxEdits(d.maxEdits ?? 2);
    }
    setLoaded(true);
  }, [weekStart]);
  useEffect(() => { load(); }, [load]);

  const locked = editsUsed >= maxEdits;
  const remaining = Math.max(0, maxEdits - editsUsed);
  const dirty = draft.size !== saved.size || [...draft].some((id) => !saved.has(id));
  const canSave = !locked && !busy && dirty && draft.size > 0;

  function toggle(id: number) {
    if (locked || busy) return;
    setDraft((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  async function save() {
    if (!canSave) return;
    setBusy(true); setMsg('');
    try {
      const res = await fetch('/api/weekly-schedule', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ week: weekStart, classIds: [...draft] }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok) {
        setSaved(new Set(draft)); setIsOverride(true);
        setEditsUsed(d.editsUsed ?? editsUsed + 1);
        setMsg('✓ Gespeichert.');
      } else {
        if (typeof d.editsUsed === 'number') setEditsUsed(d.editsUsed);
        setMsg(d.error ?? 'Konnte nicht speichern.');
      }
    } finally { setBusy(false); }
  }

  async function reset() {
    if (busy) return;
    setBusy(true); setMsg('');
    try {
      await fetch('/api/weekly-schedule', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ week: weekStart, reset: true }),
      }).catch(() => {});
      await load();
      setMsg('Auf festen Plan zurückgesetzt.');
    } finally { setBusy(false); }
  }

  const byDay: Record<number, GymClass[]> = {};
  for (let d = 1; d <= 7; d++) byDay[d] = classes.filter((c) => c.day_of_week === d);

  return (
    <div className="anim-up">
      <div className="mb-5">
        <h2 className="font-display text-2xl tracking-wide mb-1">Wochenplan · KW {kw}</h2>
        <p className="text-[var(--muted)] text-sm">
          Nur für diese Woche: welche Kurse für Streak &amp; Wertung zählen. Praktisch, wenn du mal tauschst
          (z.B. Di statt Mi) — dann bricht die Streak nicht und du kannst dich fair eintragen.
        </p>
      </div>

      {/* Lock-Status */}
      <div className="rounded-xl px-4 py-2.5 mb-5 text-xs" style={{ background: 'var(--surface-2)', border: '1px solid var(--border-soft)' }}>
        {locked ? (
          <span className="text-[var(--text)] font-semibold">🔒 Diese Woche {maxEdits}× angepasst — bis nächste Woche gesperrt.</span>
        ) : (
          <span className="text-[var(--muted)]">Noch <strong className="text-[var(--text)]">{remaining}</strong> von {maxEdits} Änderungen diese Woche.{isOverride ? ' Aktuell: angepasster Plan.' : ''}</span>
        )}
      </div>

      {classes.length === 0 ? (
        <div className="text-[var(--faint)] text-sm py-8 text-center">
          Noch keine Kurse — tritt einer Crew bei. <a href="/gruppen" className="text-[var(--accent)] hover:underline">Zu den Gruppen →</a>
        </div>
      ) : (
        <div className="space-y-4" style={locked ? { opacity: 0.55, pointerEvents: 'none' } : undefined}>
          {[1, 2, 3, 4, 5, 6, 7].map((day) => {
            const dc = byDay[day] ?? [];
            if (!dc.length) return null;
            return (
              <div key={day}>
                <div className="text-[10px] text-[var(--faint)] uppercase tracking-[0.16em] font-semibold mb-1.5">{DAY_NAMES_FULL[day - 1]}</div>
                <div className="flex flex-wrap gap-2">
                  {dc.map((cls) => {
                    const on = draft.has(cls.id);
                    const c = hex(cls.color);
                    return (
                      <button key={cls.id} onClick={() => toggle(cls.id)} disabled={locked || busy}
                        className="text-xs px-3 py-1.5 rounded-full border transition-colors"
                        style={{ borderColor: on ? c : 'var(--border)', background: on ? `${c}22` : 'transparent', color: on ? 'var(--text)' : 'var(--muted)' }}>
                        {cls.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {loaded && draft.size === 0 && dirty && (
        <p className="text-[11px] text-[var(--faint)] mt-3">Mind. 1 Kurs wählen. Für eine ganze Woche frei (krank/Urlaub) nutz „Mein Status".</p>
      )}
      {msg && <p className="text-xs mt-3" style={{ color: msg.startsWith('✓') ? 'var(--good)' : 'var(--accent)' }}>{msg}</p>}

      {classes.length > 0 && !locked && (
        <div className="flex gap-3 mt-5">
          <button onClick={save} disabled={!canSave}
            className="flex-1 text-white font-bold py-3 rounded-xl transition-all active:scale-[0.99] disabled:opacity-40"
            style={{ background: 'var(--accent)' }}>
            {busy ? 'Speichern…' : !dirty ? 'Gespeichert' : 'Wochenplan speichern'}
          </button>
          {isOverride && (
            <button onClick={reset} disabled={busy}
              className="px-4 py-3 rounded-xl border border-[var(--border)] text-[var(--muted)] hover:text-white text-sm transition-colors disabled:opacity-40">
              ↺ Fester Plan
            </button>
          )}
        </div>
      )}
      {locked && isOverride && (
        <button onClick={reset} disabled={busy}
          className="mt-4 text-xs text-[var(--faint)] hover:text-[var(--accent)] transition-colors">
          ↺ Auf festen Plan zurücksetzen (zählt nicht)
        </button>
      )}
    </div>
  );
}
