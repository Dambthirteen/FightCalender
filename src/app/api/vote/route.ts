import { neon } from '@neondatabase/serverless';
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getCurrentGroupId, isHardMode, getGroupBundesland, getRole } from '@/lib/groups';
import { getCourtExcuses } from '@/lib/court';

function getSql() { return neon(process.env.DATABASE_URL!); }

export async function GET(req: NextRequest) {
  try {
    const sql = getSql();
    const me = await getCurrentUser();
    const gid = me ? await getCurrentGroupId(me) : null;
    if (!gid) return NextResponse.json([]); // alles gruppenbasiert: ohne Gruppe nichts
    if (!(await isHardMode(gid))) return NextResponse.json([]); // Gericht nur im harten Modus
    const monthParam = req.nextUrl.searchParams.get('month');
    const voter = req.nextUrl.searchParams.get('voter') ?? me ?? '';
    const monthStart = monthParam
      ? `${monthParam}-01`
      : new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);

    const enriched = await getCourtExcuses(sql, monthStart, voter, gid, await getGroupBundesland(gid));
    return NextResponse.json(enriched);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const sql = getSql();
    const me = await getCurrentUser();
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { skipId, vote } = await req.json();
    if (!skipId || !['accept', 'reject'].includes(vote)) {
      return NextResponse.json({ error: 'Invalid data' }, { status: 400 });
    }
    const skip = await sql`SELECT user_name, group_id FROM skipping WHERE id = ${skipId}`;
    if (!skip[0]) return NextResponse.json({ error: 'Skip not found' }, { status: 404 });
    // Nur MITGLIEDER der betroffenen Gruppe dürfen richten — und immer als sie selbst.
    if (!(await getRole(me, skip[0].group_id))) {
      return NextResponse.json({ error: 'Kein Mitglied dieser Gruppe' }, { status: 403 });
    }
    if (!(await isHardMode(skip[0].group_id))) {
      return NextResponse.json({ error: 'Gericht ist in dieser Gruppe deaktiviert' }, { status: 403 });
    }
    if (skip[0].user_name === me) {
      return NextResponse.json({ error: 'Cannot vote on own excuse' }, { status: 403 });
    }
    await sql`
      INSERT INTO excuse_votes (skip_id, voter_name, vote)
      VALUES (${skipId}, ${me}, ${vote})
      ON CONFLICT (skip_id, voter_name) DO UPDATE SET vote = ${vote}
    `;
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
