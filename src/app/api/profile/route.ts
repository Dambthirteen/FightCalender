import { neon } from '@neondatabase/serverless';
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { canViewProfile } from '@/lib/groups';

function getSql() {
  return neon(process.env.DATABASE_URL!);
}

export async function GET(req: NextRequest) {
  try {
    const user = req.nextUrl.searchParams.get('user');
    if (!user) return NextResponse.json({ error: 'Missing user' }, { status: 400 });
    const me = await getCurrentUser();
    if (!(await canViewProfile(me, user))) return NextResponse.json([]); // nicht sichtbar → nichts
    const sql = getSql();
    const rows = await sql`SELECT class_id FROM user_schedule WHERE user_name = ${user}`;
    return NextResponse.json(rows.map((r) => r.class_id));
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const me = await getCurrentUser();
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { classIds } = await req.json();
    if (!Array.isArray(classIds)) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }
    const sql = getSql();
    // Immer nur den EIGENEN Stundenplan ändern — nie fremde Namen aus dem Body.
    await sql`DELETE FROM user_schedule WHERE user_name = ${me}`;
    for (const id of classIds) {
      await sql`INSERT INTO user_schedule (user_name, class_id) VALUES (${me}, ${id}) ON CONFLICT DO NOTHING`;
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
