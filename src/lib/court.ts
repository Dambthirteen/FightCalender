import { holidayMap } from './holidays';

// Ausreden-Gericht: gemeinsame, GRUPPENBASIERTE Logik für /api/vote und das
// „offen + noch nicht fertig"-Signal auf der Startseite. So stimmen Badge und
// Gericht-Seite immer exakt überein.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Sql = (strings: TemplateStringsArray, ...values: any[]) => Promise<any[]>;

export interface CourtExcuse {
  id: number;
  user_name: string;
  date: string;
  excuse: string;
  day_of_week: number;
  accept_count: number;
  reject_count: number;
  my_vote: 'accept' | 'reject' | null;
  user_status_type: string | null;
  streak_protected: boolean;
  holiday: string | null;
  is_exempt: boolean;
}

/** Alle Ausreden (Skips mit Text) eines Monats in EINER Gruppe, angereichert. */
export async function getCourtExcuses(
  sql: Sql,
  monthStart: string,
  voter: string,
  groupId: number
): Promise<CourtExcuse[]> {
  const rows = await sql`
    SELECT
      s.id, s.user_name, s.date::text, s.excuse,
      EXTRACT(ISODOW FROM s.date)::int AS day_of_week,
      COUNT(CASE WHEN ev.vote = 'accept' THEN 1 END)::int AS accept_count,
      COUNT(CASE WHEN ev.vote = 'reject' THEN 1 END)::int AS reject_count,
      MAX(CASE WHEN ev.voter_name = ${voter} THEN ev.vote END) AS my_vote,
      MAX(st.status_type) AS user_status_type,
      bool_or(s.streak_protected) AS streak_protected
    FROM skipping s
    LEFT JOIN excuse_votes ev ON ev.skip_id = s.id
    LEFT JOIN user_status st ON st.user_name = s.user_name
      AND s.date >= st.start_date AND s.date <= st.end_date
    WHERE s.date >= ${monthStart}::date
      AND s.date < (${monthStart}::date + INTERVAL '1 month')
      AND s.excuse != ''
      AND s.group_id = ${groupId}
    GROUP BY s.id, s.user_name, s.date, s.excuse
    ORDER BY s.date DESC
  `;

  const dates = rows.map((r) => r.date as string);
  const hMap = holidayMap(dates.length > 0 ? dates : [monthStart]);

  return rows.map((r) => ({
    ...r,
    holiday: hMap.get(r.date as string) ?? null,
    // injured ist NICHT automatisch befreit — muss weiter bewertet werden.
    is_exempt: !!hMap.get(r.date as string) || !!(r.user_status_type && r.user_status_type !== 'injured'),
  })) as CourtExcuse[];
}

/** Offene Stimmen für `voter`: fremde, nicht befreite Ausreden ohne eigene Stimme. */
export function pendingVoteCount(excuses: CourtExcuse[], voter: string): number {
  return excuses.filter((e) => e.user_name !== voter && !e.is_exempt && e.my_vote === null).length;
}
