import { NextRequest, NextResponse } from 'next/server';
import { getClasses, createClass } from '@/lib/db';

export async function GET() {
  try {
    const classes = await getClasses();
    return NextResponse.json(classes);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { name, dayOfWeek, startTime, endTime, color, adminPassword } = await req.json();
    if (adminPassword !== process.env.ADMIN_PASSWORD) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const gymClass = await createClass(name, dayOfWeek, startTime, endTime, color ?? 'red');
    return NextResponse.json(gymClass, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
