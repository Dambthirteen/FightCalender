import { neon } from '@neondatabase/serverless';
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getCurrentGroupId, getRole } from '@/lib/groups';

function getSql() {
  return neon(process.env.DATABASE_URL!);
}

interface MemberRow { user_name: string; role: string; status: string }

/** Mitglieder der aktuellen Gruppe (Pending nur für Admins sichtbar). */
export async function GET() {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const gid = await getCurrentGroupId(me);
  if (!gid) return NextResponse.json({ group: null, members: [], myRole: null });

  const sql = getSql();
  const myRole = await getRole(me, gid);
  const g = (await sql`SELECT id, name, invite_code, created_by FROM groups WHERE id = ${gid}`)[0];
  const all = (await sql`
    SELECT user_name, role, status FROM group_members WHERE group_id = ${gid}
    ORDER BY (status = 'pending') DESC, (role = 'admin') DESC, LOWER(user_name)
  `) as MemberRow[];
  const members = myRole === 'admin' ? all : all.filter((m) => m.status === 'active');

  return NextResponse.json({
    group: { id: g.id, name: g.name },
    inviteCode: myRole === 'admin' ? g.invite_code : null,
    myRole,
    members,
  });
}

/** Aktionen: approve | reject | promote | demote | remove | leave. */
export async function POST(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const gid = await getCurrentGroupId(me);
  if (!gid) return NextResponse.json({ error: 'Keine Gruppe' }, { status: 400 });

  const { action, user_name } = await req.json();
  const sql = getSql();
  const myRole = await getRole(me, gid);

  // Selbst verlassen (kein Admin nötig) — letzter Admin darf nicht raus.
  if (action === 'leave') {
    if (myRole === 'admin') {
      const admins = await sql`SELECT COUNT(*)::int AS n FROM group_members WHERE group_id = ${gid} AND role = 'admin' AND status = 'active'`;
      if (admins[0].n <= 1) return NextResponse.json({ error: 'Du bist der letzte Admin — ernenne erst jemanden.' }, { status: 400 });
    }
    await sql`DELETE FROM group_members WHERE group_id = ${gid} AND user_name = ${me}`;
    return NextResponse.json({ ok: true });
  }

  if (myRole !== 'admin') return NextResponse.json({ error: 'Nur Admins' }, { status: 403 });
  if (!user_name) return NextResponse.json({ error: 'user_name fehlt' }, { status: 400 });

  if (action === 'approve') {
    await sql`UPDATE group_members SET status = 'active' WHERE group_id = ${gid} AND user_name = ${user_name} AND status = 'pending'`;
  } else if (action === 'reject' || action === 'remove') {
    // letzten Admin nicht entfernen
    const tgt = await sql`SELECT role FROM group_members WHERE group_id = ${gid} AND user_name = ${user_name}`;
    if (tgt[0]?.role === 'admin') {
      const admins = await sql`SELECT COUNT(*)::int AS n FROM group_members WHERE group_id = ${gid} AND role = 'admin' AND status = 'active'`;
      if (admins[0].n <= 1) return NextResponse.json({ error: 'Letzter Admin kann nicht entfernt werden.' }, { status: 400 });
    }
    await sql`DELETE FROM group_members WHERE group_id = ${gid} AND user_name = ${user_name}`;
  } else if (action === 'promote') {
    await sql`UPDATE group_members SET role = 'admin' WHERE group_id = ${gid} AND user_name = ${user_name} AND status = 'active'`;
  } else if (action === 'demote') {
    const admins = await sql`SELECT COUNT(*)::int AS n FROM group_members WHERE group_id = ${gid} AND role = 'admin' AND status = 'active'`;
    if (admins[0].n <= 1) return NextResponse.json({ error: 'Es muss mindestens ein Admin bleiben.' }, { status: 400 });
    await sql`UPDATE group_members SET role = 'member' WHERE group_id = ${gid} AND user_name = ${user_name}`;
  } else {
    return NextResponse.json({ error: 'Unbekannte Aktion' }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
