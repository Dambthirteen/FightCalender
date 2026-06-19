import { neon } from '@neondatabase/serverless';
import { NextRequest, NextResponse } from 'next/server';
import { getBitchCounts } from '@/lib/bitch-scoring';

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

    // --- Bitch des Jahres (neue Hybrid-Wertung; vor dem Stichtag unverändert) ---
    const bitchCounts = await getBitchCounts(sql, `${year}-01-01`, `${year + 1}-01-01`);
    const bitch = bitchCounts.map((c) => ({ user_name: c.user_name, total: c.count }));

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
