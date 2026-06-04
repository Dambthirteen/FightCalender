import { neon } from '@neondatabase/serverless';
import { NextRequest, NextResponse } from 'next/server';
import { getNRWHolidays } from '@/lib/holidays';

function getSql() { return neon(process.env.DATABASE_URL!); }

export async function GET(req: NextRequest) {
  try {
    const sql = getSql();
    const monthParam = req.nextUrl.searchParams.get('month');
    const monthStart = monthParam
      ? `${monthParam}-01`
      : new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);

    const year = parseInt(monthStart.slice(0, 4));
    const nextYear = parseInt(new Date(new Date(monthStart).getTime() + 32 * 86400000).toISOString().slice(0, 4));
    const holidays = [
      ...getNRWHolidays(year),
      ...(nextYear !== year ? getNRWHolidays(nextYear) : []),
    ].map(h => h.date);

    const rows = await sql`
      SELECT s.user_name, COUNT(*)::int AS bitch_count
      FROM skipping s
      WHERE
        s.date >= ${monthStart}::date
        AND s.date < (${monthStart}::date + INTERVAL '1 month')
        AND s.excuse != ''
        -- Only count if user has a class scheduled for that day
        AND EXISTS (
          SELECT 1 FROM user_schedule us
          JOIN classes c ON c.id = us.class_id
          WHERE us.user_name = s.user_name
            AND c.day_of_week = EXTRACT(ISODOW FROM s.date)::int
        )
        -- Skip if NRW holiday
        AND NOT (s.date::text = ANY(${holidays}))
        -- Skip if user has sick or vacation status (NOT injured — that still needs voting)
        AND NOT EXISTS (
          SELECT 1 FROM user_status st
          WHERE st.user_name = s.user_name
            AND s.date >= st.start_date AND s.date <= st.end_date
            AND st.status_type IN ('sick', 'vacation')
        )
        -- Only count if excuse was rejected
        AND (
          SELECT COUNT(*) FROM excuse_votes ev WHERE ev.skip_id = s.id AND ev.vote = 'reject'
        ) > (
          SELECT COUNT(*) FROM excuse_votes ev WHERE ev.skip_id = s.id AND ev.vote = 'accept'
        )
      GROUP BY s.user_name
      ORDER BY bitch_count DESC
    `;
    return NextResponse.json(rows);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
