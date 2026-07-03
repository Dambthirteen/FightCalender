// Wochenplan-Auflösung: fester Plan (user_schedule) + optionale KW-Abweichungen
// (weekly_schedule). dowsFor(week) liefert die geplanten Wochentage (ISO 1–7) genau
// dieser KW — die Abweichung, falls vorhanden, sonst den festen Plan.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Sql = (strings: TemplateStringsArray, ...values: any[]) => Promise<any[]>;

export interface WeekPlan {
  defaultDows: Set<number>;
  overrides: Map<string, Set<number>>; // week_start (Montag) → geplante dows
  hasAny: boolean;
  dowsFor(weekStart: string): Set<number>;
}

export async function loadWeekPlan(sql: Sql, user: string): Promise<WeekPlan> {
  const def = (await sql`
    SELECT DISTINCT c.day_of_week::int AS dow
    FROM user_schedule us JOIN classes c ON c.id = us.class_id
    WHERE us.user_name = ${user}
  `) as { dow: number }[];
  const defaultDows = new Set(def.map((r) => r.dow));

  const overrides = new Map<string, Set<number>>();
  try {
    const ov = (await sql`
      SELECT ws.week_start::text AS w, c.day_of_week::int AS dow
      FROM weekly_schedule ws JOIN classes c ON c.id = ws.class_id
      WHERE ws.user_name = ${user}
    `) as { w: string; dow: number }[];
    for (const r of ov) {
      if (!overrides.has(r.w)) overrides.set(r.w, new Set());
      overrides.get(r.w)!.add(r.dow);
    }
  } catch { /* Tabelle evtl. noch nicht angelegt → nur fester Plan */ }

  return {
    defaultDows,
    overrides,
    hasAny: defaultDows.size > 0 || overrides.size > 0,
    dowsFor(weekStart: string) { return overrides.get(weekStart) ?? defaultDows; },
  };
}
