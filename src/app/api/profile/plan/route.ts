import { neon } from '@neondatabase/serverless';
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { canViewProfile } from '@/lib/groups';

function getSql() { return neon(process.env.DATABASE_URL!); }

/**
 * Fester Trainingsplan eines Nutzers fürs Profil: seine belegten Kurse (user_schedule)
 * je Gruppe. Gruppen-Liste für das Auswahl-Untermenü, wenn er in mehreren Crews ist.
 * Sichtbarkeit wie das restliche Profil (canViewProfile).
 */
export async function GET(req: NextRequest) {
  try {
    const user = req.nextUrl.searchParams.get('user');
    if (!user) return NextResponse.json({ error: 'Missing user' }, { status: 400 });
    const me = await getCurrentUser();
    if (!(await canViewProfile(me, user))) return NextResponse.json({ groups: [], classes: [] });

    const sql = getSql();
    const groups = (await sql`
      SELECT g.id, g.name
      FROM group_members gm JOIN groups g ON g.id = gm.group_id
      WHERE gm.user_name = ${user} AND gm.status = 'active'
      ORDER BY LOWER(g.name)
    `) as { id: number; name: string }[];

    const classes = (await sql`
      SELECT c.id, c.name, c.day_of_week, c.start_time, c.end_time, c.color, c.group_id
      FROM user_schedule us JOIN classes c ON c.id = us.class_id
      WHERE us.user_name = ${user}
      ORDER BY c.day_of_week, c.start_time
    `) as { id: number; name: string; day_of_week: number; start_time: string; end_time: string; color: string; group_id: number }[];

    return NextResponse.json({ groups, classes });
  } catch (error) {
    return NextResponse.json({ error: String(error), groups: [], classes: [] }, { status: 500 });
  }
}
