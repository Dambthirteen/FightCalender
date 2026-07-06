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
  const members = (myRole === 'admin' || myRole === 'moderator') ? all : all.filter((m) => m.status === 'active');

  return NextResponse.json({
    group: { id: g.id, name: g.name },
    inviteCode: myRole ? g.invite_code : null, // jedes aktive Mitglied darf einladen
    myRole,
    members,
  });
}

/**
 * Aktionen:
 *  - leave (self)
 *  - approve | reject | remove  → Admin ODER Moderator (Moderator darf keine Admins entfernen)
 *  - promote (→Admin) | demote (Admin→Member) | make_mod (→Moderator) | unmod (Moderator→Member) → nur Admin
 * `groupId` optional (z. B. Aktion aus einer Benachrichtigung); sonst aktuelle Gruppe.
 */
export async function POST(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { action, user_name, groupId } = await req.json();
  const gid = Number(groupId) || (await getCurrentGroupId(me));
  if (!gid) return NextResponse.json({ error: 'Keine Gruppe' }, { status: 400 });

  const sql = getSql();
  const myRole = await getRole(me, gid);
  const countAdmins = async () => ((await sql`SELECT COUNT(*)::int AS n FROM group_members WHERE group_id = ${gid} AND role = 'admin' AND status = 'active'`) as { n: number }[])[0].n;

  // Selbst verlassen — letzter Admin darf nicht raus.
  if (action === 'leave') {
    if (myRole === 'admin' && (await countAdmins()) <= 1) {
      return NextResponse.json({ error: 'Du bist der letzte Admin — ernenne erst jemanden.' }, { status: 400 });
    }
    await sql`DELETE FROM group_members WHERE group_id = ${gid} AND user_name = ${me}`;
    await sql`DELETE FROM coach_schedule WHERE user_name = ${me} AND class_id IN (SELECT id FROM classes WHERE group_id = ${gid})`.catch(() => {});
    return NextResponse.json({ ok: true });
  }

  if (!myRole) return NextResponse.json({ error: 'Kein Mitglied' }, { status: 403 });
  if (!user_name) return NextResponse.json({ error: 'user_name fehlt' }, { status: 400 });

  const isAdmin = myRole === 'admin';
  const canModerate = isAdmin || myRole === 'moderator'; // rein-/rauslassen

  if (action === 'approve') {
    if (!canModerate) return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 });
    await sql`UPDATE group_members SET status = 'active' WHERE group_id = ${gid} AND user_name = ${user_name} AND status = 'pending'`;
  } else if (action === 'reject' || action === 'remove') {
    if (!canModerate) return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 });
    const tgt = (await sql`SELECT role FROM group_members WHERE group_id = ${gid} AND user_name = ${user_name}`) as { role: string }[];
    if (tgt[0]?.role === 'admin') {
      if (!isAdmin) return NextResponse.json({ error: 'Moderatoren können keine Admins entfernen.' }, { status: 403 });
      if ((await countAdmins()) <= 1) return NextResponse.json({ error: 'Letzter Admin kann nicht entfernt werden.' }, { status: 400 });
    }
    await sql`DELETE FROM group_members WHERE group_id = ${gid} AND user_name = ${user_name}`;
    await sql`DELETE FROM coach_schedule WHERE user_name = ${user_name} AND class_id IN (SELECT id FROM classes WHERE group_id = ${gid})`.catch(() => {});
  } else if (action === 'promote') {
    if (!isAdmin) return NextResponse.json({ error: 'Nur Admins' }, { status: 403 });
    await sql`UPDATE group_members SET role = 'admin' WHERE group_id = ${gid} AND user_name = ${user_name} AND status = 'active'`;
  } else if (action === 'make_mod') {
    if (!isAdmin) return NextResponse.json({ error: 'Nur Admins' }, { status: 403 });
    await sql`UPDATE group_members SET role = 'moderator' WHERE group_id = ${gid} AND user_name = ${user_name} AND status = 'active' AND role = 'member'`;
  } else if (action === 'unmod') {
    if (!isAdmin) return NextResponse.json({ error: 'Nur Admins' }, { status: 403 });
    await sql`UPDATE group_members SET role = 'member' WHERE group_id = ${gid} AND user_name = ${user_name} AND role = 'moderator'`;
  } else if (action === 'demote') {
    if (!isAdmin) return NextResponse.json({ error: 'Nur Admins' }, { status: 403 });
    if ((await countAdmins()) <= 1) return NextResponse.json({ error: 'Es muss mindestens ein Admin bleiben.' }, { status: 400 });
    await sql`UPDATE group_members SET role = 'member' WHERE group_id = ${gid} AND user_name = ${user_name}`;
  } else {
    return NextResponse.json({ error: 'Unbekannte Aktion' }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
