import { neon } from '@neondatabase/serverless';
import { NextRequest, NextResponse } from 'next/server';

function getSql() {
  return neon(process.env.DATABASE_URL!);
}

export async function GET(req: NextRequest) {
  try {
    const sql = getSql();
    const monthParam = req.nextUrl.searchParams.get('month'); // "2026-06"
    const monthStart = monthParam
      ? `${monthParam}-01`
      : new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);

    const rows = await sql`
      SELECT user_name, COUNT(*)::int AS attend_count
      FROM attendance
      WHERE week_start >= ${monthStart}::date
        AND week_start < (${monthStart}::date + INTERVAL '1 month')
      GROUP BY user_name
      ORDER BY attend_count DESC
    `;
    return NextResponse.json(rows);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
