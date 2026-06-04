import { neon } from '@neondatabase/serverless';
import { NextRequest, NextResponse } from 'next/server';

function getSql() {
  return neon(process.env.DATABASE_URL!);
}

export async function GET(req: NextRequest) {
  try {
    const sql = getSql();
    const monthParam = req.nextUrl.searchParams.get('month');
    const monthStart = monthParam
      ? `${monthParam}-01`
      : new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);

    // Count bitch points: skips where:
    // 1. User has a class in their schedule on that day_of_week
    // 2. Excuse was rejected (more rejects than accepts) OR no votes yet (end of month eval)
    const rows = await sql`
      SELECT
        s.user_name,
        COUNT(*)::int AS bitch_count
      FROM skipping s
      WHERE
        s.date >= ${monthStart}::date
        AND s.date < (${monthStart}::date + INTERVAL '1 month')
        AND s.excuse != ''
        AND EXISTS (
          SELECT 1 FROM user_schedule us
          JOIN classes c ON c.id = us.class_id
          WHERE us.user_name = s.user_name
            AND c.day_of_week = EXTRACT(ISODOW FROM s.date)::int
        )
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
