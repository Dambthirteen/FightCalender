import { neon } from '@neondatabase/serverless';
import { NextRequest, NextResponse } from 'next/server';
import { getBitchCounts } from '@/lib/bitch-scoring';
import { berlinNow } from '@/lib/berlin-time';

function getSql() {
  return neon(process.env.DATABASE_URL!);
}

function nextMonth(ym: string): string {
  let [y, m] = ym.split('-').map(Number);
  m++;
  if (m > 12) { m = 1; y++; }
  return `${y}-${String(m).padStart(2, '0')}`;
}

/** Profil-Statistik: X× Macher des Monats, X× Bitch des Monats, Tage ausgefallen. */
export async function GET(req: NextRequest) {
  try {
    const user = req.nextUrl.searchParams.get('user');
    if (!user) return NextResponse.json({ error: 'Missing user' }, { status: 400 });
    const sql = getSql();

    // Tage ausgefallen (krank/verletzt)
    const daysRows = await sql`
      SELECT COALESCE(SUM((end_date - start_date) + 1), 0)::int AS days
      FROM user_status WHERE user_name = ${user} AND status_type IN ('sick', 'injured')
    `;
    const daysOut = daysRows[0]?.days ?? 0;

    // Macher-Titel: Monate als #1 nach Anwesenheit
    const macherRows = await sql`
      WITH m AS (
        SELECT user_name, to_char(week_start, 'YYYY-MM') AS ym, COUNT(*) AS n,
          RANK() OVER (PARTITION BY to_char(week_start, 'YYYY-MM') ORDER BY COUNT(*) DESC) AS r
        FROM attendance GROUP BY user_name, to_char(week_start, 'YYYY-MM')
      )
      SELECT COUNT(*)::int AS titles FROM m WHERE user_name = ${user} AND r = 1
    `;
    const macherTitles = macherRows[0]?.titles ?? 0;

    // Bitch-Titel: Monate als #1 in der neuen Hybrid-Wertung
    const rangeRows = await sql`
      SELECT to_char(MIN(d), 'YYYY-MM') AS first FROM (
        SELECT week_start AS d FROM attendance UNION ALL SELECT date FROM skipping
      ) t
    `;
    let bitchTitles = 0;
    const firstYm = rangeRows[0]?.first as string | null;
    if (firstYm) {
      const current = berlinNow().date.slice(0, 7);
      let ym = firstYm;
      let guard = 0;
      while (ym <= current && guard < 60) {
        const counts = await getBitchCounts(sql, `${ym}-01`, `${nextMonth(ym)}-01`);
        const max = counts[0]?.count ?? 0;
        if (max > 0 && counts.some((c) => c.user_name === user && c.count === max)) bitchTitles++;
        ym = nextMonth(ym);
        guard++;
      }
    }

    return NextResponse.json({ daysOut, macherTitles, bitchTitles });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
