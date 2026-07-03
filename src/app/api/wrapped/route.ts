import { neon } from '@neondatabase/serverless';
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getCurrentGroupId, getMyGroups, getGroupBundesland, getUserBundesland } from '@/lib/groups';
import { getBitchCounts } from '@/lib/bitch-scoring';
import { getStreak } from '@/lib/streak';
import { currentYm, ymPrev, ymNext } from '@/lib/awards';
import { getHolidays } from '@/lib/holidays';

function getSql() {
  return neon(process.env.DATABASE_URL!);
}

/**
 * Monats-Rückblick („Wrapped") für den eingeloggten Nutzer in seiner Gruppe:
 * Gruppen-Highlights + persönliche Zahlen des Monats. Default = letzter
 * abgeschlossener Monat. `?seen=1`-Check über wrapped_seen (Auto-Popup einmalig).
 */
export async function GET(req: NextRequest) {
  try {
    const me = await getCurrentUser();
    if (!me) return NextResponse.json({ available: false });
    const sql = getSql();
    const gid = await getCurrentGroupId(me);
    if (!gid) return NextResponse.json({ available: false });

    const ym = req.nextUrl.searchParams.get('month') || ymPrev(currentYm());
    const start = `${ym}-01`;
    const end = `${ymNext(ym)}-01`;
    const bl = await getGroupBundesland(gid);
    const groups = await getMyGroups(me);
    const groupName = groups.find((g) => g.id === gid)?.name ?? 'Gruppe';

    // Gruppen-Highlights (alle gruppen-scoped über classes.group_id bzw. skipping.group_id) ---
    const macherRows = (await sql`
      SELECT a.user_name, COUNT(*)::int AS n
      FROM attendance a JOIN classes c ON c.id = a.class_id
      WHERE c.group_id = ${gid}
        AND (a.week_start + (c.day_of_week - 1) * INTERVAL '1 day')::date >= ${start}::date
        AND (a.week_start + (c.day_of_week - 1) * INTERVAL '1 day')::date < ${end}::date
      GROUP BY a.user_name ORDER BY n DESC LIMIT 1
    `) as { user_name: string; n: number }[];

    const bitchCounts = await getBitchCounts(sql, start, end, gid, bl);
    const topBitch = bitchCounts[0];

    // Beste Ausrede = meiste „Beste Ausrede des Monats"-Stimmen (best_excuse_votes),
    // vom Ausreden-Gericht gewählt. JOIN → nur Ausreden mit mind. einer Stimme.
    const bestRows = (await sql`
      SELECT s.user_name, s.excuse, COUNT(bev.id)::int AS votes
      FROM skipping s JOIN best_excuse_votes bev ON bev.skip_id = s.id
      WHERE s.group_id = ${gid} AND s.date >= ${start}::date AND s.date < ${end}::date AND s.excuse != ''
      GROUP BY s.id, s.user_name, s.excuse
      ORDER BY votes DESC LIMIT 1
    `) as { user_name: string; excuse: string; votes: number }[];

    const worstRows = (await sql`
      SELECT s.user_name, s.excuse,
        COUNT(CASE WHEN ev.vote = 'reject' THEN 1 END)::int AS reject
      FROM skipping s LEFT JOIN excuse_votes ev ON ev.skip_id = s.id
      WHERE s.group_id = ${gid} AND s.date >= ${start}::date AND s.date < ${end}::date AND s.excuse != ''
      GROUP BY s.id, s.user_name, s.excuse
      ORDER BY reject DESC LIMIT 1
    `) as { user_name: string; excuse: string; reject: number }[];

    const judgeRows = (await sql`
      SELECT ev.voter_name, COUNT(*)::int AS n
      FROM excuse_votes ev JOIN skipping s ON s.id = ev.skip_id
      WHERE s.group_id = ${gid} AND s.date >= ${start}::date AND s.date < ${end}::date
      GROUP BY ev.voter_name ORDER BY n DESC LIMIT 1
    `) as { voter_name: string; n: number }[];

    const lobRows = (await sql`
      SELECT to_user, COUNT(*)::int AS n FROM praises
      WHERE created_at >= ${start}::timestamptz AND created_at < ${end}::timestamptz
        AND to_user IN (SELECT user_name FROM group_members WHERE group_id = ${gid} AND status = 'active')
      GROUP BY to_user ORDER BY n DESC LIMIT 1
    `) as { to_user: string; n: number }[];

    // Persönliche Zahlen
    const myAtt = (await sql`
      SELECT COUNT(*)::int AS n FROM attendance a JOIN classes c ON c.id = a.class_id
      WHERE c.group_id = ${gid} AND a.user_name = ${me}
        AND (a.week_start + (c.day_of_week - 1) * INTERVAL '1 day')::date >= ${start}::date
        AND (a.week_start + (c.day_of_week - 1) * INTERVAL '1 day')::date < ${end}::date
    `) as { n: number }[];
    // „Geschwänzt" = echte Fehltage: Urlaub/Krank (user_status) und Feiertage zählen NICHT.
    const holidays = getHolidays(Number(ym.slice(0, 4)), bl).map((h) => h.date);
    const mySkips = (await sql`
      SELECT COUNT(*)::int AS n FROM skipping s
      WHERE s.group_id = ${gid} AND s.user_name = ${me}
        AND s.date >= ${start}::date AND s.date < ${end}::date
        AND NOT (s.date::text = ANY(${holidays}))
        AND NOT EXISTS (
          SELECT 1 FROM user_status st
          WHERE st.user_name = s.user_name AND s.date >= st.start_date AND s.date <= st.end_date
            AND st.status_type IN ('sick', 'vacation')
        )
    `) as { n: number }[];
    const myLob = (await sql`
      SELECT COUNT(*)::int AS n FROM praises WHERE to_user = ${me} AND created_at >= ${start}::timestamptz AND created_at < ${end}::timestamptz
    `) as { n: number }[];
    const myBitch = bitchCounts.find((c) => c.user_name === me)?.count ?? 0;

    const seenRows = (await sql`SELECT 1 FROM wrapped_seen WHERE user_name = ${me} AND month = ${ym}`) as unknown[];

    // Aktuelle Streak (für die Rückblick-Karte).
    let streak = { days: 0, weeks: 0 };
    try { streak = await getStreak(sql, me, await getUserBundesland(me)); } catch { /* egal */ }
    // Bemerkenswertes Lob mit Kommentar, das der Nutzer diesen Monat erhalten hat.
    const praiseRows = (await sql`
      SELECT from_user, reason, kind FROM praises
      WHERE to_user = ${me} AND created_at >= ${start}::timestamptz AND created_at < ${end}::timestamptz AND reason != ''
      ORDER BY (kind = 'gigalob') DESC, created_at DESC LIMIT 1
    `) as { from_user: string; reason: string; kind: string }[];
    // Trainingstage (distinct Tage) + meist besuchte Kampfsportart des Monats.
    const trainDaysRow = (await sql`
      SELECT COUNT(DISTINCT (a.week_start + (c.day_of_week - 1) * INTERVAL '1 day')::date)::int AS n
      FROM attendance a JOIN classes c ON c.id = a.class_id
      WHERE c.group_id = ${gid} AND a.user_name = ${me}
        AND (a.week_start + (c.day_of_week - 1) * INTERVAL '1 day')::date >= ${start}::date
        AND (a.week_start + (c.day_of_week - 1) * INTERVAL '1 day')::date < ${end}::date
    `) as { n: number }[];
    const topClassRow = (await sql`
      SELECT c.name, COUNT(*)::int AS n
      FROM attendance a JOIN classes c ON c.id = a.class_id
      WHERE c.group_id = ${gid} AND a.user_name = ${me}
        AND (a.week_start + (c.day_of_week - 1) * INTERVAL '1 day')::date >= ${start}::date
        AND (a.week_start + (c.day_of_week - 1) * INTERVAL '1 day')::date < ${end}::date
      GROUP BY c.name ORDER BY n DESC LIMIT 1
    `) as { name: string; n: number }[];

    const macher = macherRows[0] ? { user: macherRows[0].user_name, count: macherRows[0].n } : null;
    const bitch = topBitch ? { user: topBitch.user_name, count: topBitch.count } : null;
    const available = !!(macher || bitch || (myAtt[0]?.n ?? 0) > 0);

    return NextResponse.json({
      available,
      seen: seenRows.length > 0,
      month: ym,
      groupName,
      macher,
      bitch,
      bestExcuse: bestRows[0] ? { user: bestRows[0].user_name, excuse: bestRows[0].excuse, accept: bestRows[0].votes } : null,
      worstExcuse: worstRows[0] && worstRows[0].reject > 0 ? { user: worstRows[0].user_name, excuse: worstRows[0].excuse, reject: worstRows[0].reject } : null,
      topJudge: judgeRows[0] ? { user: judgeRows[0].voter_name, count: judgeRows[0].n } : null,
      lobKing: lobRows[0] ? { user: lobRows[0].to_user, count: lobRows[0].n } : null,
      me: { trainings: myAtt[0]?.n ?? 0, skips: mySkips[0]?.n ?? 0, lobe: myLob[0]?.n ?? 0, bitch: myBitch },
      trainingDays: trainDaysRow[0]?.n ?? 0,
      topClass: topClassRow[0] ? { name: topClassRow[0].name, count: topClassRow[0].n } : null,
      youMacher: !!(macher && macher.user === me),
      streak,
      praiseComment: praiseRows[0] ? { from: praiseRows[0].from_user, reason: praiseRows[0].reason, kind: praiseRows[0].kind } : null,
    });
  } catch (error) {
    return NextResponse.json({ available: false, error: String(error) });
  }
}
