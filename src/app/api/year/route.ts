import { neon } from '@neondatabase/serverless';
import { NextRequest, NextResponse } from 'next/server';
import { getNRWHolidays } from '@/lib/holidays';

function getSql() { return neon(process.env.DATABASE_URL!); }

export async function GET(req: NextRequest) {
  try {
    const sql = getSql();
    const yearParam = req.nextUrl.searchParams.get('year') ?? String(new Date().getFullYear());
    const year = parseInt(yearParam);

    // --- Macher des Jahres: total attendance per user for the year ---
    const macher = await sql`
      SELECT user_name, COUNT(*)::int AS total
      FROM attendance
      WHERE EXTRACT(YEAR FROM week_start) = ${year}
      GROUP BY user_name
      ORDER BY total DESC
    `;

    // --- Bitch des Jahres: count rejected, non-exempt skips per user ---
    const holidays = getNRWHolidays(year).map(h => h.date);

    const bitch = await sql`
      SELECT s.user_name, COUNT(*)::int AS total
      FROM skipping s
      WHERE
        EXTRACT(YEAR FROM s.date) = ${year}
        AND s.excuse != ''
        AND NOT (s.date::text = ANY(${holidays}))
        AND NOT EXISTS (
          SELECT 1 FROM user_status st
          WHERE st.user_name = s.user_name
            AND s.date >= st.start_date AND s.date <= st.end_date
            AND st.status_type IN ('sick', 'vacation')
        )
        AND (
          SELECT COUNT(*) FROM excuse_votes ev WHERE ev.skip_id = s.id AND ev.vote = 'reject'
        ) > (
          SELECT COUNT(*) FROM excuse_votes ev WHERE ev.skip_id = s.id AND ev.vote = 'accept'
        )
        AND EXISTS (
          SELECT 1 FROM user_schedule us
          JOIN classes c ON c.id = us.class_id
          WHERE us.user_name = s.user_name
            AND c.day_of_week = EXTRACT(ISODOW FROM s.date)::int
        )
      GROUP BY s.user_name
      ORDER BY total DESC
    `;

    // Monthly breakdown for charts
    const macherMonthly = await sql`
      SELECT
        user_name,
        EXTRACT(MONTH FROM week_start)::int AS month,
        COUNT(*)::int AS count
      FROM attendance
      WHERE EXTRACT(YEAR FROM week_start) = ${year}
      GROUP BY user_name, month
      ORDER BY user_name, month
    `;

    return NextResponse.json({ year, macher, bitch, macherMonthly });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
