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
 * Trainingsplan der Coaches: welche Kurse man DIESE Woche gibt. Entwurf lokal, ein
 * „Speichern". Kein Lock — Coaches brauchen Flexibilität. Nur die aktuelle KW.
 */
export default function CoachPlanEditor({ classes }: { classes: GymClass[] }) {
  const weekMonday = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekStart = format(weekMonday, 'yyyy-MM-dd');
  const kw = format(weekMonday, 'w');

  const [draft, setDraft] = useState<Set<number>>(new Set());
  const [saved, setSaved] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    const d = await fetch(`/api/coach-schedule?week=${weekStart}`).then((r) => r.json()).catch(() => null);
    if (d && Array.isArray(d.classIds)) { setDraft(new Set(d.classIds)); setSaved(new Set(d.classIds)); }
  }, [weekStart]);
  useEffect(() => { load(); }, [load]);

  const dirty = draft.size !== saved.size || [...draft].some((id) => !saved.has(id));

  function toggle(id: number) {
    if (busy) return;
    setDraft((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  async function save() {
    if (!dirty || busy) return;
    setBusy(true); setMsg('');
    try {
      const res = await fetch('/api/coach-schedule', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ week: weekStart, classIds: [...draft] }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok) { setSaved(new Set(draft)); setMsg('✓ Gespeichert.'); }
      else setMsg(d.error ?? 'Konnte nicht speichern.');
    } finally { setBusy(false); }
  }

  const byDay: Record<number, GymClass[]> = {};
  for (let d = 1; d <= 7; d++) byDay[d] = classes.filter((c) => c.day_of_week === d);

  return (
    <div className="anim-up">
      <div className="mb-5">
        <h2 className="font-display text-2xl tracking-wide mb-1">Trainingsplan · KW {kw}</h2>
        <p className="text-[var(--muted)] text-sm">
          Welche Kurse gibst du diese Woche? Dein Name erscheint dann im Kalender ganz vorne bei der Klasse,
          und du bekommst ~2&nbsp;Std vorher eine Erinnerung mit den Angemeldeten.
        </p>
      </div>

      {classes.length === 0 ? (
        <div className="text-[var(--faint)] text-sm py-8 text-center">
          Noch keine Kurse — tritt einer Crew bei. <a href="/gruppen" className="text-[var(--accent)] hover:underline">Zu den Gruppen →</a>
        </div>
      ) : (
        <div className="space-y-4">
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
                      <button key={cls.id} onClick={() => toggle(cls.id)} disabled={busy}
                        className="text-xs px-3 py-1.5 rounded-full border transition-colors"
                        style={{ borderColor: on ? c : 'var(--border)', background: on ? `${c}22` : 'transparent', color: on ? 'var(--text)' : 'var(--muted)' }}>
                        {on ? '🎓 ' : ''}{cls.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {msg && <p className="text-xs mt-3" style={{ color: msg.startsWith('✓') ? 'var(--good)' : 'var(--accent)' }}>{msg}</p>}

      {classes.length > 0 && (
        <button onClick={save} disabled={!dirty || busy}
          className="mt-5 w-full text-white font-bold py-3 rounded-xl transition-all active:scale-[0.99] disabled:opacity-40"
          style={{ background: 'var(--accent)' }}>
          {busy ? 'Speichern…' : !dirty ? 'Gespeichert' : 'Trainingsplan speichern'}
        </button>
      )}
    </div>
  );
}
