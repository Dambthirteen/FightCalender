import { neon } from '@neondatabase/serverless';
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getUserBundesland } from '@/lib/groups';
import { getStreak } from '@/lib/streak';
import { awardPerfectWeeks, currentWeekRef, STREAK_POINT_CAP } from '@/lib/streak-points';
import { refreshShields } from '@/lib/streak-shields';

export const runtime = 'nodejs'; // consumeShieldIfNeeded verschickt ggf. eine Push

function getSql() {
  return neon(process.env.DATABASE_URL!);
}

/** Streak (Tage + Wochen), Streak-Punkte, Schilde, Rekord, Werbungs-Verfügbarkeit. */
export async function GET() {
  try {
    const me = await getCurrentUser();
    if (!me) return NextResponse.json({ days: 0, weeks: 0, points: 0, longest: 0, adAvailable: false });
    const sql = getSql();

    const bl = await getUserBundesland(me);
    await awardPerfectWeeks(sql, me, bl); // perfekte Wochen ggf. gutschreiben
    // Schild ggf. verdienen (aus Wochen-Meilensteinen) und bei einem Bruch automatisch einlösen.
    const { days, weeks } = await refreshShields(sql, me, bl, await getStreak(sql, me, bl));
    await sql`UPDATE users SET longest_streak = GREATEST(longest_streak, ${days}) WHERE user_name = ${me}`;

    const rows = (await sql`SELECT streak_points, longest_streak FROM users WHERE user_name = ${me}`) as
      { streak_points: number; longest_streak: number }[];
    const points = rows[0]?.streak_points ?? 0;
    const adClaimed = (await sql`
      SELECT 1 FROM streak_point_log WHERE user_name = ${me} AND kind = 'ad' AND ref = ${currentWeekRef()}
    `) as unknown[];

    // Schild-Vorrat + „zuletzt eingelöst?" separat & tolerant lesen — falls /api/setup (neue Spalte
    // /Tabelle) noch nicht lief, bleibt die Streak-Antwort intakt statt komplett zu scheitern.
    let shields = 0;
    let shieldUsedRecently = false;
    try {
      const sr = (await sql`SELECT streak_shields FROM users WHERE user_name = ${me}`) as { streak_shields: number }[];
      shields = sr[0]?.streak_shields ?? 0;
      const su = (await sql`
        SELECT 1 FROM streak_shield_use WHERE user_name = ${me} AND until_date >= (CURRENT_DATE - INTERVAL '7 days') LIMIT 1
      `) as unknown[];
      shieldUsedRecently = su.length > 0;
    } catch { /* Spalte/Tabelle evtl. noch nicht angelegt */ }

    return NextResponse.json({
      days,
      weeks,
      points,
      shields,
      shieldUsedRecently,
      longest: rows[0]?.longest_streak ?? days,
      adAvailable: points < STREAK_POINT_CAP && adClaimed.length === 0,
    });
  } catch (error) {
    return NextResponse.json({ days: 0, weeks: 0, points: 0, longest: 0, adAvailable: false, error: String(error) });
  }
}
