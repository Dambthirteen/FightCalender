import { neon } from '@neondatabase/serverless';
import { NextRequest, NextResponse } from 'next/server';

function getSql() {
  return neon(process.env.DATABASE_URL!);
}

export async function GET(req: NextRequest) {
  try {
    const sql = getSql();
    const user = req.nextUrl.searchParams.get('user');
    if (!user) return NextResponse.json({ error: 'Missing user' }, { status: 400 });
    const rows = await sql`
      SELECT class_id FROM user_schedule WHERE user_name = ${user}
    `;
    return NextResponse.json(rows.map((r) => r.class_id));
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const sql = getSql();
    const { userName, classIds } = await req.json();
    if (!userName || !Array.isArray(classIds)) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }
    await sql`DELETE FROM user_schedule WHERE user_name = ${userName}`;
    for (const id of classIds) {
      await sql`INSERT INTO user_schedule (user_name, class_id) VALUES (${userName}, ${id}) ON CONFLICT DO NOTHING`;
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
