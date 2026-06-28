import { neon } from '@neondatabase/serverless';
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { canViewProfile } from '@/lib/groups';
import { getStreakWeeks } from '@/lib/streak';
import { earnedBadges, badgeById } from '@/lib/badges';
import { createNotification } from '@/lib/notify';

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

    const weeks = await getStreakWeeks(sql, user);
    const compRows = (await sql`SELECT COUNT(*)::int AS n FROM competitions WHERE user_name = ${user}`) as { n: number }[];
    const competitions = compRows[0]?.n ?? 0;

    const earned = earnedBadges(weeks, competitions);

    // Neu freigeschaltete Abzeichen einmalig verleihen + benachrichtigen.
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

    const uRows = (await sql`SELECT displayed_badges, streak_points FROM users WHERE user_name = ${user}`) as
      { displayed_badges: string[]; streak_points: number }[];
    const earnedIds = new Set(earned.map((b) => b.id));
    const displayed = (uRows[0]?.displayed_badges ?? []).filter((id) => earnedIds.has(id)); // nur noch gültige

    return NextResponse.json({
      streakWeeks: weeks,
      competitions,
      earned: earned.map((b) => ({ id: b.id, label: b.label, emoji: b.emoji, kind: b.kind, hint: b.hint })),
      displayed,
      points: me === user ? (uRows[0]?.streak_points ?? 0) : undefined,
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

    const weeks = await getStreakWeeks(sql, me);
    const compRows = (await sql`SELECT COUNT(*)::int AS n FROM competitions WHERE user_name = ${me}`) as { n: number }[];
    const earnedIds = new Set(earnedBadges(weeks, compRows[0]?.n ?? 0).map((b) => b.id));

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
