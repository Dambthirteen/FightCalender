import { neon } from '@neondatabase/serverless';
import { NextRequest, NextResponse } from 'next/server';
import { getBitchCounts } from '@/lib/bitch-scoring';
import { getCurrentUser } from '@/lib/auth';
import { getCurrentGroupId, getGroupBundesland } from '@/lib/groups';

function getSql() { return neon(process.env.DATABASE_URL!); }

export async function GET(req: NextRequest) {
  try {
    const sql = getSql();
    const me = await getCurrentUser();
    const gid = me ? await getCurrentGroupId(me) : null;
    const yearParam = req.nextUrl.searchParams.get('year') ?? String(new Date().getFullYear());
    const year = parseInt(yearParam);
    if (!gid) return NextResponse.json({ year, macher: [], bitch: [], macherMonthly: [] });

    // Nur aktuelle Mitglieder ranken (Anwesenheiten Ausgetretener bleiben in der DB).
    const memberRows = (await sql`SELECT user_name FROM group_members WHERE group_id = ${gid} AND status = 'active'`) as { user_name: string }[];
    const members = memberRows.map((r) => r.user_name);
    if (members.length === 0) return NextResponse.json({ year, macher: [], bitch: [], macherMonthly: [] });

    // --- Macher des Jahres: total attendance per user for the year (nur diese Gruppe) ---
    const macher = await sql`
      SELECT a.user_name, COUNT(*)::int AS total
      FROM attendance a JOIN classes c ON c.id = a.class_id
      WHERE c.group_id = ${gid} AND a.user_name = ANY(${members}::text[])
        AND EXTRACT(YEAR FROM (a.week_start + (c.day_of_week - 1) * INTERVAL '1 day')) = ${year}
      GROUP BY a.user_name
      ORDER BY total DESC
    `;

    // --- Bitch des Jahres (neue Hybrid-Wertung; vor dem Stichtag unverändert) ---
    const bitchCounts = await getBitchCounts(sql, `${year}-01-01`, `${year + 1}-01-01`, gid, await getGroupBundesland(gid));
    const bitch = bitchCounts.map((c) => ({ user_name: c.user_name, total: c.count }));

    // Monthly breakdown for charts (nur diese Gruppe)
    const macherMonthly = await sql`
      SELECT
        a.user_name,
        EXTRACT(MONTH FROM (a.week_start + (c.day_of_week - 1) * INTERVAL '1 day'))::int AS month,
        COUNT(*)::int AS count
      FROM attendance a JOIN classes c ON c.id = a.class_id
      WHERE c.group_id = ${gid} AND a.user_name = ANY(${members}::text[])
        AND EXTRACT(YEAR FROM (a.week_start + (c.day_of_week - 1) * INTERVAL '1 day')) = ${year}
      GROUP BY a.user_name, month
      ORDER BY a.user_name, month
    `;

    return NextResponse.json({ year, macher, bitch, macherMonthly });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
