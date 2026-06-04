import { NextRequest, NextResponse } from 'next/server';
import { getAttendanceForWeek, toggleAttendance } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const week = req.nextUrl.searchParams.get('week');
    if (!week) return NextResponse.json({ error: 'Missing week param' }, { status: 400 });
    const attendance = await getAttendanceForWeek(week);
    return NextResponse.json(attendance);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { classId, weekStart, userName } = await req.json();
    if (!classId || !weekStart || !userName?.trim()) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }
    const result = await toggleAttendance(classId, weekStart, userName.trim());
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
