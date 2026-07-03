import { NextRequest, NextResponse } from 'next/server';
import { getAttendanceForWeek, toggleAttendance, classInGroup } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { getCurrentGroupId } from '@/lib/groups';

export async function GET(req: NextRequest) {
  try {
    const week = req.nextUrl.searchParams.get('week');
    if (!week) return NextResponse.json({ error: 'Missing week param' }, { status: 400 });
    const me = await getCurrentUser();
    const gid = me ? await getCurrentGroupId(me) : null;
    if (!gid) return NextResponse.json([]); // ohne Gruppe keine Anwesenheiten (nicht alle!)
    const attendance = await getAttendanceForWeek(week, gid);
    return NextResponse.json(attendance);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const me = await getCurrentUser();
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { classId, weekStart } = await req.json();
    if (!classId || !weekStart) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }
    const gid = await getCurrentGroupId(me);
    // Man kann sich nur für Kurse der EIGENEN aktuellen Gruppe und nur für sich selbst eintragen.
    if (!gid || !(await classInGroup(Number(classId), gid))) {
      return NextResponse.json({ error: 'Kurs nicht in deiner Gruppe' }, { status: 403 });
    }
    const result = await toggleAttendance(classId, weekStart, me);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
