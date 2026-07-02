import { neon } from '@neondatabase/serverless';
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getUserBundesland } from '@/lib/groups';
import { getStreak } from '@/lib/streak';
import { awardPerfectWeeks, currentWeekRef, STREAK_POINT_CAP } from '@/lib/streak-points';

function getSql() {
  return neon(process.env.DATABASE_URL!);
}

/** Streak (Tage + Wochen), Streak-Punkte, Rekord, Werbungs-Verfügbarkeit. */
export async function GET() {
  try {
    const me = await getCurrentUser();
    if (!me) return NextResponse.json({ days: 0, weeks: 0, points: 0, longest: 0, adAvailable: false });
    const sql = getSql();

    const bl = await getUserBundesland(me);
    await awardPerfectWeeks(sql, me, bl); // perfekte Wochen ggf. gutschreiben
    const { days, weeks } = await getStreak(sql, me, bl);
    await sql`UPDATE users SET longest_streak = GREATEST(longest_streak, ${days}) WHERE user_name = ${me}`;

    const rows = (await sql`SELECT streak_points, longest_streak FROM users WHERE user_name = ${me}`) as
      { streak_points: number; longest_streak: number }[];
    const points = rows[0]?.streak_points ?? 0;
    const adClaimed = (await sql`
      SELECT 1 FROM streak_point_log WHERE user_name = ${me} AND kind = 'ad' AND ref = ${currentWeekRef()}
    `) as unknown[];

    return NextResponse.json({
      days,
      weeks,
      points,
      longest: rows[0]?.longest_streak ?? days,
      adAvailable: points < STREAK_POINT_CAP && adClaimed.length === 0,
    });
  } catch (error) {
    return NextResponse.json({ days: 0, weeks: 0, points: 0, longest: 0, adAvailable: false, error: String(error) });
  }
}
