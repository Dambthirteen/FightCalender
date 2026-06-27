import { neon } from '@neondatabase/serverless';
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { canViewProfile, getMyGroups } from '@/lib/groups';
import { resolveTitle, currentYm, ymNext } from '@/lib/awards';

function getSql() {
  return neon(process.env.DATABASE_URL!);
}

/** Profil-Statistik: X× Macher des Monats, X× Bitch des Monats, Tage ausgefallen. */
export async function GET(req: NextRequest) {
  try {
    const user = req.nextUrl.searchParams.get('user');
    if (!user) return NextResponse.json({ error: 'Missing user' }, { status: 400 });
    const me = await getCurrentUser();
    if (!(await canViewProfile(me, user))) return NextResponse.json({ private: true });
    const sql = getSql();

    // Tage ausgefallen (krank/verletzt)
    const daysRows = await sql`
      SELECT COALESCE(SUM((end_date - start_date) + 1), 0)::int AS days
      FROM user_status WHERE user_name = ${user} AND status_type IN ('sick', 'injured')
    `;
    const daysOut = daysRows[0]?.days ?? 0;

    // „des Monats"-Titel: gruppenbasiert über ALLE Gruppen des Nutzers und NUR für
    // abgeschlossene Monate (Gericht ausgewertet, am 1. verliehen; Gleichstand erst
    // nach dem Gruppen-Voting). resolveTitle ist die einzige Wahrheitsquelle.
    const rangeRows = await sql`
      SELECT to_char(MIN(d), 'YYYY-MM') AS first FROM (
        SELECT week_start AS d FROM attendance UNION ALL SELECT date FROM skipping
      ) t
    `;
    let macherTitles = 0;
    let bitchTitles = 0;
    const firstYm = rangeRows[0]?.first as string | null;
    if (firstYm) {
      const groups = await getMyGroups(user);
      const cur = currentYm();
      for (const g of groups) {
        let ym = firstYm;
        let guard = 0;
        while (ym < cur && guard < 120) {
          for (const kind of ['macher', 'bitch'] as const) {
            const st = await resolveTitle(sql, g.id, ym, kind);
            if (st.status === 'final' && st.winner === user) {
              if (kind === 'macher') macherTitles++; else bitchTitles++;
            }
          }
          ym = ymNext(ym);
          guard++;
        }
      }
    }

    return NextResponse.json({ daysOut, macherTitles, bitchTitles });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
