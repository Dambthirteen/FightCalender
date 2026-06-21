import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getRole, GROUP_COOKIE } from '@/lib/groups';

/** Aktuelle Gruppe umschalten (nur wenn aktives Mitglied). */
export async function POST(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { groupId } = await req.json();
  const gid = Number(groupId);
  if (!gid) return NextResponse.json({ error: 'groupId fehlt' }, { status: 400 });

  const role = await getRole(me, gid);
  if (!role) return NextResponse.json({ error: 'Kein Mitglied dieser Gruppe' }, { status: 403 });

  const res = NextResponse.json({ ok: true });
  res.cookies.set(GROUP_COOKIE, String(gid), { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' });
  return res;
}
