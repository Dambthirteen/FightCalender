import { neon } from '@neondatabase/serverless';
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { canViewProfile, getMyGroups } from '@/lib/groups';
import { getStreak } from '@/lib/streak';
import { earnedBadges, badgeById, ADMIN_BADGE, type BadgeDef } from '@/lib/badges';
import { createNotification } from '@/lib/notify';
import { grantStreakPoint, currentWeekRef, STREAK_POINT_CAP } from '@/lib/streak-points';

async function isGroupAdmin(user: string): Promise<boolean> {
  try {
    return (await getMyGroups(user)).some((g) => g.role === 'admin');
  } catch {
    return false;
  }
}

export const runtime = 'nodejs'; // verschickt Push beim Freischalten

function getSql() {
  return neon(process.env.DATABASE_URL!);
}

/** Streak, Wettkampfzahl, freigeschaltete + ausgestellte Abzeichen eines Profils. */
export async function GET(req: NextRequest) {
  try {
    const user = req.nextUrl.searchParams.get('user');
    if (!user) return NextResponse.json({ error: 'Missing user' }, { status: 400 });
    const me = await getCurrentUser();
    if (!(await canViewProfile(me, user))) return NextResponse.json({ private: true });
    const sql = getSql();

    const { days, weeks } = await getStreak(sql, user);
    await sql`UPDATE users SET longest_streak = GREATEST(longest_streak, ${days}) WHERE user_name = ${user}`;
    const compRows = (await sql`SELECT COUNT(*)::int AS n FROM competitions WHERE user_name = ${user}`) as { n: number }[];
    const competitions = compRows[0]?.n ?? 0;

    const earned: BadgeDef[] = earnedBadges(weeks, competitions);
    if (await isGroupAdmin(user)) earned.push(ADMIN_BADGE);

    // Neu freigeschaltete Abzeichen einmalig verleihen + benachrichtigen; Streak-Badge gibt einen Streak-Punkt.
    try {
      const awarded = (await sql`SELECT badge_id FROM badges_awarded WHERE user_name = ${user}`) as { badge_id: string }[];
      const known = new Set(awarded.map((r) => r.badge_id));
      for (const b of earned) {
        if (known.has(b.id)) continue;
        const ins = await sql`
          INSERT INTO badges_awarded (user_name, badge_id) VALUES (${user}, ${b.id})
          ON CONFLICT (user_name, badge_id) DO NOTHING RETURNING id
        `;
        if (ins.length === 0) continue; // Race: anderer Request war schneller
        if (b.kind === 'streak') await grantStreakPoint(sql, user, 'streak_badge', b.id);
        await createNotification(sql, {
          user,
          type: 'badge',
          actor: user,
          body: `Neues Abzeichen freigeschaltet: ${b.emoji} ${b.label}!`,
          link: `/profil/${encodeURIComponent(user)}`,
          push: { title: '🏅 Neues Abzeichen', body: `${b.label} freigeschaltet!` },
        });
      }
    } catch { /* badges_awarded evtl. noch nicht angelegt */ }

    const uRows = (await sql`SELECT displayed_badges, streak_points, longest_streak FROM users WHERE user_name = ${user}`) as
      { displayed_badges: string[]; streak_points: number; longest_streak: number }[];
    const earnedIds = new Set(earned.map((b) => b.id));
    const displayed = (uRows[0]?.displayed_badges ?? []).filter((id) => earnedIds.has(id)); // nur noch gültige

    let adAvailable = false;
    if (me === user) {
      const adClaimed = (await sql`
        SELECT 1 FROM streak_point_log WHERE user_name = ${user} AND kind = 'ad' AND ref = ${currentWeekRef()}
      `) as unknown[];
      adAvailable = (uRows[0]?.streak_points ?? 0) < STREAK_POINT_CAP && adClaimed.length === 0;
    }

    return NextResponse.json({
      streakDays: days,
      streakWeeks: weeks,
      longest: uRows[0]?.longest_streak ?? days,
      competitions,
      earned: earned.map((b) => ({ id: b.id, label: b.label, emoji: b.emoji, kind: b.kind, hint: b.hint })),
      displayed,
      points: me === user ? (uRows[0]?.streak_points ?? 0) : undefined,
      adAvailable,
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

/** Bis zu 4 freigeschaltete Abzeichen am eigenen Profil ausstellen. */
export async function POST(req: NextRequest) {
  try {
    const me = await getCurrentUser();
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { badges } = await req.json();
    if (!Array.isArray(badges)) return NextResponse.json({ error: 'Ungültig' }, { status: 400 });
    const sql = getSql();

    const { weeks } = await getStreak(sql, me);
    const compRows = (await sql`SELECT COUNT(*)::int AS n FROM competitions WHERE user_name = ${me}`) as { n: number }[];
    const earnedIds = new Set(earnedBadges(weeks, compRows[0]?.n ?? 0).map((b) => b.id));
    if (await isGroupAdmin(me)) earnedIds.add(ADMIN_BADGE.id);

    // Nur gültige IDs, nur freigeschaltete, max 4, ohne Duplikate.
    const clean: string[] = [];
    for (const id of badges) {
      if (typeof id === 'string' && badgeById(id) && earnedIds.has(id) && !clean.includes(id)) clean.push(id);
      if (clean.length >= 4) break;
    }
    await sql`UPDATE users SET displayed_badges = ${JSON.stringify(clean)}::jsonb WHERE user_name = ${me}`;
    return NextResponse.json({ ok: true, displayed: clean });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
