import { neon } from '@neondatabase/serverless';
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { currentWeekRef, STREAK_POINT_CAP } from '@/lib/streak-points';

function getSql() {
  return neon(process.env.DATABASE_URL!);
}

/**
 * PLATZHALTER: „Werbung ansehen → 1 Streak-Punkt", max. 1×/Woche.
 * Aktuell ohne echte Ad-Integration — später hier die Rewarded-Ad-Bestätigung
 * (AdMob/AppLovin via Capacitor) prüfen, bevor der Punkt vergeben wird.
 */
export async function POST() {
  try {
    const me = await getCurrentUser();
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const sql = getSql();

    const rows = (await sql`SELECT streak_points FROM users WHERE user_name = ${me}`) as { streak_points: number }[];
    const points = rows[0]?.streak_points ?? 0;
    if (points >= STREAK_POINT_CAP) {
      return NextResponse.json({ granted: false, reason: 'full', points });
    }
    const week = currentWeekRef();
    const ins = await sql`
      INSERT INTO streak_point_log (user_name, kind, ref) VALUES (${me}, 'ad', ${week})
      ON CONFLICT (user_name, kind, ref) DO NOTHING RETURNING id
    `;
    if (ins.length === 0) {
      return NextResponse.json({ granted: false, reason: 'weekly', points });
    }
    const upd = (await sql`
      UPDATE users SET streak_points = LEAST(${STREAK_POINT_CAP}, streak_points + 1)
      WHERE user_name = ${me} RETURNING streak_points
    `) as { streak_points: number }[];
    return NextResponse.json({ granted: true, points: upd[0]?.streak_points ?? points + 1 });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
