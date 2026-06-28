import { neon } from '@neondatabase/serverless';
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getStreakWeeks } from '@/lib/streak';

function getSql() {
  return neon(process.env.DATABASE_URL!);
}

/** Aktuelle Streak (Wochen) + Streak-Punkte des eingeloggten Nutzers. */
export async function GET() {
  try {
    const me = await getCurrentUser();
    if (!me) return NextResponse.json({ weeks: 0, points: 0 });
    const sql = getSql();
    const weeks = await getStreakWeeks(sql, me);
    const rows = (await sql`SELECT streak_points FROM users WHERE user_name = ${me}`) as { streak_points: number }[];
    return NextResponse.json({ weeks, points: rows[0]?.streak_points ?? 0 });
  } catch (error) {
    return NextResponse.json({ weeks: 0, points: 0, error: String(error) });
  }
}
