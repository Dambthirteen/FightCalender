import { neon } from '@neondatabase/serverless';
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { canViewProfile } from '@/lib/groups';

function getSql() { return neon(process.env.DATABASE_URL!); }

/** Vergangene Wettkämpfe eines Nutzers fürs Profil (mit Platzierung/Ergebnis). */
export async function GET(req: NextRequest) {
  try {
    const user = req.nextUrl.searchParams.get('user');
    if (!user) return NextResponse.json({ error: 'Missing user' }, { status: 400 });
    const me = await getCurrentUser();
    if (!(await canViewProfile(me, user))) return NextResponse.json([]);
    const sql = getSql();
    const rows = await sql`
      SELECT id, name, competition_date::text AS competition_date, location, weight_class, result, method, placement
      FROM competitions
      WHERE user_name = ${user} AND competition_date <= CURRENT_DATE
      ORDER BY competition_date DESC
      LIMIT 50
    `;
    return NextResponse.json(rows);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
