import { neon } from '@neondatabase/serverless';
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { canViewProfile, getMyGroups, getUserBundesland } from '@/lib/groups';
import { getStreak } from '@/lib/streak';
import { earnedBadges, earnedFightBadges, earnedTournamentBadges, badgeById, ADMIN_BADGE, DOPPELMORAL_BADGE, ALL_BADGES, type BadgeDef } from '@/lib/badges';
import { isTestAccount } from '@/lib/dev-override';
import { createNotification } from '@/lib/notify';
import { broadcastToGroup } from '@/lib/feed';
import { grantStreakPoint, currentWeekRef, STREAK_POINT_CAP } from '@/lib/streak-points';
import { getBitchCounts, CUTOVER } from '@/lib/bitch-scoring';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Sql = (strings: TemplateStringsArray, ...values: any[]) => Promise<any[]>;

async function isGroupAdmin(user: string): Promise<boolean> {
  try {
    return (await getMyGroups(user)).some((g) => g.role === 'admin');
  } catch {
    return false;
  }
}

/** Alle freigeschalteten Abzeichen eines Nutzers (inkl. Admin & geheimer Doppelmoral). */
async function computeEarned(sql: Sql, user: string, weeks: number): Promise<{ badges: BadgeDef[]; competitions: number }> {
  const compRows = (await sql`SELECT COUNT(*)::int AS n FROM competitions WHERE user_name = ${user}`) as { n: number }[];
  const competitions = compRows[0]?.n ?? 0;
  // Test-Account: alle Trophäen freigeschaltet (der Award-Loop im GET wird separat übersprungen).
  if (await isTestAccount(sql, user)) return { badges: [...ALL_BADGES], competitions };
  const judgedRows = (await sql`SELECT COUNT(*)::int AS n FROM excuse_votes WHERE voter_name = ${user}`) as { n: number }[];
  const judged = judgedRows[0]?.n ?? 0;

  const badges = earnedBadges(weeks, competitions, judged);
  // Kampf-Sieg-Badges aus den gewonnenen Wettkämpfen.
  const winRows = (await sql`SELECT DISTINCT method FROM competitions WHERE user_name = ${user} AND result = 'win' AND method IS NOT NULL`) as { method: string }[];
  badges.push(...earnedFightBadges(winRows.map((r) => r.method)));
  // Turnier-Platzierungs-Badges (Gold/Silber/Bronze).
  const placeRows = (await sql`SELECT DISTINCT placement FROM competitions WHERE user_name = ${user} AND placement IN ('gold','silver','bronze')`) as { placement: string }[];
  badges.push(...earnedTournamentBadges(placeRows.map((r) => r.placement)));
  if (await isGroupAdmin(user)) badges.push(ADMIN_BADGE);

  // Geheim „Doppelmoral": ≥10 Bitch-Punkte UND ≥20× gerichtet. Bitch-Berechnung nur bei Bedarf.
  if (judged >= 20) {
    let bitch = 0;
    for (const g of await getMyGroups(user)) {
      const counts = await getBitchCounts(sql, CUTOVER, '2999-01-01', g.id, g.bundesland);
      bitch += counts.find((cc) => cc.user_name === user)?.count ?? 0;
    }
    if (bitch >= 10) badges.push(DOPPELMORAL_BADGE);
  }
  return { badges, competitions };
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

    const { days, weeks } = await getStreak(sql, user, await getUserBundesland(user));
    await sql`UPDATE users SET longest_streak = GREATEST(longest_streak, ${days}) WHERE user_name = ${user}`;
    const { badges: earned, competitions } = await computeEarned(sql, user, weeks);

    // Neu freigeschaltete Abzeichen einmalig verleihen + benachrichtigen; Streak-Badge gibt einen Streak-Punkt.
    // Für Test-Accounts überspringen — sonst würde jede der ~24 Trophäen eine Benachrichtigung auslösen.
    if (!(await isTestAccount(sql, user))) try {
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
        // Streak-/Wettkampf-/Turnier-Trophäen zusätzlich an die Gruppe (soziale Anerkennung).
        if (b.kind === 'streak' || b.kind === 'competition' || b.kind === 'tournament') {
          for (const g of await getMyGroups(user)) {
            await broadcastToGroup(sql, {
              groupId: g.id, type: 'badge_feed', actor: user,
              body: `${user} hat das Abzeichen ${b.emoji} ${b.label} freigeschaltet`,
              link: `/profil/${encodeURIComponent(user)}`,
              reactable: true,
              dedupKey: `badge|${g.id}|${user}|${b.id}`,
              push: { title: '🏅 Abzeichen freigeschaltet', body: `${user}: ${b.label}` },
            });
          }
        }
      }
    } catch { /* badges_awarded evtl. noch nicht angelegt */ }

    const uRows = (await sql`SELECT displayed_badges, streak_points, longest_streak FROM users WHERE user_name = ${user}`) as
      { displayed_badges: string[]; streak_points: number; longest_streak: number }[];
    const earnedIds = new Set(earned.map((b) => b.id));
    const displayed = (uRows[0]?.displayed_badges ?? []).filter((id) => earnedIds.has(id)); // nur noch gültige

    const clanTag = (await getMyGroups(user))[0]?.clan_tag ?? null;

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
      clanTag,
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

    const { weeks } = await getStreak(sql, me, await getUserBundesland(me));
    const { badges: earnedList } = await computeEarned(sql, me, weeks);
    const earnedIds = new Set(earnedList.map((b) => b.id));

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
