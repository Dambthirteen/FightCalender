import { NextRequest, NextResponse } from 'next/server';
import { getClasses, createClass } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { getCurrentGroupId, getRole } from '@/lib/groups';

export async function GET() {
  try {
    const me = await getCurrentUser();
    const gid = me ? await getCurrentGroupId(me) : null;
    // Ohne aktive Gruppe KEINE Kurse zurückgeben (sonst würde man alle Crews sehen).
    const classes = gid ? await getClasses(gid) : [];
    return NextResponse.json(classes);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { name, dayOfWeek, startTime, endTime, color, adminPassword } = await req.json();
    const me = await getCurrentUser();
    const gid = me ? await getCurrentGroupId(me) : null;
    const isGroupAdmin = !!(me && gid && (await getRole(me, gid)) === 'admin');
    const isSuperAdmin = !!adminPassword && adminPassword === process.env.ADMIN_PASSWORD;
    if (!isGroupAdmin && !isSuperAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!gid) return NextResponse.json({ error: 'Keine Gruppe gewählt' }, { status: 400 });
    const gymClass = await createClass(name, dayOfWeek, startTime, endTime, color ?? 'red', gid);
    return NextResponse.json(gymClass, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
