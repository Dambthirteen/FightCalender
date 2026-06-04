import { neon } from '@neondatabase/serverless';
import { NextRequest, NextResponse } from 'next/server';

function getSql() {
  return neon(process.env.DATABASE_URL!);
}

const SCHEDULE = [
  // Montag (1)
  { name: 'BJJ Minis 3-5 Jahre', day: 1, start: '15:45', end: '16:30', color: 'green' },
  { name: 'BJJ Minis 6-9 Jahre', day: 1, start: '16:45', end: '17:30', color: 'green' },
  { name: 'Jugend BJJ',          day: 1, start: '17:30', end: '18:30', color: 'green' },
  { name: 'BJJ NoGi',            day: 1, start: '18:30', end: '19:45', color: 'blue' },
  { name: 'Boxen',               day: 1, start: '18:30', end: '19:45', color: 'purple' },
  { name: 'BJJ Gi',              day: 1, start: '20:00', end: '21:15', color: 'blue' },
  { name: 'MMA',                 day: 1, start: '20:00', end: '21:15', color: 'red' },
  // Dienstag (2)
  { name: 'Kikibo 3-5 Jahre',          day: 2, start: '15:45', end: '16:30', color: 'green' },
  { name: 'Kikibo 6-9 Jahre',          day: 2, start: '16:45', end: '17:30', color: 'green' },
  { name: 'Jugend Kickboxen',          day: 2, start: '17:45', end: '18:45', color: 'green' },
  { name: 'Kick-/Thaiboxen Basics',    day: 2, start: '18:30', end: '19:45', color: 'orange' },
  { name: 'Lady Kickboxen',            day: 2, start: '18:45', end: '20:00', color: 'purple' },
  { name: 'Kick-/Thaiboxen Advanced',  day: 2, start: '20:00', end: '21:15', color: 'orange' },
  // Mittwoch (3)
  { name: 'MMA Minis 3-5 Jahre',       day: 3, start: '15:45', end: '16:30', color: 'green' },
  { name: 'MMA Minis 6-9 Jahre',       day: 3, start: '16:45', end: '17:30', color: 'green' },
  { name: 'Jugend BJJ',                day: 3, start: '17:30', end: '18:30', color: 'green' },
  { name: 'BJJ Gi',                    day: 3, start: '18:30', end: '19:45', color: 'blue' },
  { name: 'Kick-/Thaiboxen All Levels',day: 3, start: '18:30', end: '19:45', color: 'orange' },
  { name: 'BJJ NoGi',                  day: 3, start: '20:00', end: '21:15', color: 'blue' },
  // Donnerstag (4)
  { name: 'Kikibo 3-5 Jahre',          day: 4, start: '15:45', end: '16:30', color: 'green' },
  { name: 'Kikibo 6-9 Jahre',          day: 4, start: '16:45', end: '17:30', color: 'green' },
  { name: 'Jugend MMA',                day: 4, start: '17:45', end: '18:45', color: 'green' },
  { name: 'Kick-/Thaiboxen All Levels',day: 4, start: '18:30', end: '19:45', color: 'orange' },
  { name: 'Lady Kickboxen',            day: 4, start: '18:45', end: '20:00', color: 'purple' },
  { name: 'MMA Wrestling',             day: 4, start: '20:00', end: '21:15', color: 'red' },
  // Freitag (5)
  { name: 'Kikibo 3-5 Jahre',   day: 5, start: '15:00', end: '15:45', color: 'green' },
  { name: 'Kikibo 6-9 Jahre',   day: 5, start: '16:00', end: '16:45', color: 'green' },
  { name: 'Jugend Kickboxen',   day: 5, start: '17:00', end: '17:45', color: 'green' },
  { name: 'BJJ Gi',             day: 5, start: '17:00', end: '18:15', color: 'blue' },
  { name: 'Boxen',              day: 5, start: '18:30', end: '19:45', color: 'purple' },
  { name: 'BJJ NoGi',          day: 5, start: '18:30', end: '19:45', color: 'blue' },
  { name: 'MMA',                day: 5, start: '20:00', end: '21:15', color: 'red' },
  // Samstag (6)
  { name: 'Kickboxen All Levels', day: 6, start: '12:00', end: '13:00', color: 'orange' },
  { name: 'Sparring',             day: 6, start: '13:00', end: '14:00', color: 'red' },
];

export async function POST(req: NextRequest) {
  try {
    const { adminPassword } = await req.json();
    if (adminPassword !== process.env.ADMIN_PASSWORD) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const sql = getSql();
    await sql`DELETE FROM classes`;
    for (const c of SCHEDULE) {
      await sql`
        INSERT INTO classes (name, day_of_week, start_time, end_time, color)
        VALUES (${c.name}, ${c.day}, ${c.start}, ${c.end}, ${c.color})
      `;
    }
    return NextResponse.json({ ok: true, inserted: SCHEDULE.length });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
