import { neon } from '@neondatabase/serverless';
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';

function getSql() {
  return neon(process.env.DATABASE_URL!);
}

/** Verleihungs-Popup als gesehen markieren (damit es nicht erneut erscheint). */
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { groupId, month, kind } = await req.json();
    if (!groupId || !month || (kind !== 'macher' && kind !== 'bitch')) {
      return NextResponse.json({ error: 'Ungültige Eingabe' }, { status: 400 });
    }
    const sql = getSql();
    await sql`
      INSERT INTO title_awards_seen (group_id, user_name, award_month, kind)
      VALUES (${Number(groupId)}, ${user}, ${month}, ${kind})
      ON CONFLICT (group_id, user_name, award_month, kind) DO NOTHING
    `;
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
