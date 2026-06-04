import { neon } from '@neondatabase/serverless';
import { NextRequest, NextResponse } from 'next/server';

function getSql() {
  return neon(process.env.DATABASE_URL!);
}

export async function GET(req: NextRequest) {
  try {
    const sql = getSql();
    const monthParam = req.nextUrl.searchParams.get('month');
    const voter = req.nextUrl.searchParams.get('voter') ?? '';
    const monthStart = monthParam
      ? `${monthParam}-01`
      : new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);

    const rows = await sql`
      SELECT
        s.id,
        s.user_name,
        s.date::text,
        s.excuse,
        EXTRACT(ISODOW FROM s.date)::int AS day_of_week,
        COUNT(CASE WHEN ev.vote = 'accept' THEN 1 END)::int AS accept_count,
        COUNT(CASE WHEN ev.vote = 'reject' THEN 1 END)::int AS reject_count,
        MAX(CASE WHEN ev.voter_name = ${voter} THEN ev.vote END) AS my_vote
      FROM skipping s
      LEFT JOIN excuse_votes ev ON ev.skip_id = s.id
      WHERE s.date >= ${monthStart}::date
        AND s.date < (${monthStart}::date + INTERVAL '1 month')
        AND s.excuse != ''
      GROUP BY s.id, s.user_name, s.date, s.excuse
      ORDER BY s.date DESC
    `;
    return NextResponse.json(rows);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const sql = getSql();
    const { skipId, voterName, vote } = await req.json();
    if (!skipId || !voterName || !['accept', 'reject'].includes(vote)) {
      return NextResponse.json({ error: 'Invalid data' }, { status: 400 });
    }
    const skip = await sql`SELECT user_name FROM skipping WHERE id = ${skipId}`;
    if (skip[0]?.user_name === voterName) {
      return NextResponse.json({ error: 'Cannot vote on own excuse' }, { status: 403 });
    }
    await sql`
      INSERT INTO excuse_votes (skip_id, voter_name, vote)
      VALUES (${skipId}, ${voterName}, ${vote})
      ON CONFLICT (skip_id, voter_name) DO UPDATE SET vote = ${vote}
    `;
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
