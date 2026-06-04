import { sql } from '@vercel/postgres';

export { sql };

export interface GymClass {
  id: number;
  name: string;
  day_of_week: number; // 1=Mon, 7=Sun (ISO)
  start_time: string;
  end_time: string;
  color: string;
}

export interface AttendanceRecord {
  id: number;
  class_id: number;
  week_start: string;
  user_name: string;
}

export async function getClasses(): Promise<GymClass[]> {
  const result = await sql`SELECT * FROM classes ORDER BY day_of_week, start_time`;
  return result.rows as GymClass[];
}

export async function getAttendanceForWeek(weekStart: string): Promise<AttendanceRecord[]> {
  const result = await sql`
    SELECT * FROM attendance WHERE week_start = ${weekStart}
  `;
  return result.rows as AttendanceRecord[];
}

export async function toggleAttendance(
  classId: number,
  weekStart: string,
  userName: string
): Promise<{ attending: boolean }> {
  const existing = await sql`
    SELECT id FROM attendance
    WHERE class_id = ${classId} AND week_start = ${weekStart} AND user_name = ${userName}
  `;
  if (existing.rows.length > 0) {
    await sql`
      DELETE FROM attendance WHERE class_id = ${classId} AND week_start = ${weekStart} AND user_name = ${userName}
    `;
    return { attending: false };
  } else {
    await sql`
      INSERT INTO attendance (class_id, week_start, user_name) VALUES (${classId}, ${weekStart}, ${userName})
    `;
    return { attending: true };
  }
}

export async function createClass(
  name: string,
  dayOfWeek: number,
  startTime: string,
  endTime: string,
  color: string
): Promise<GymClass> {
  const result = await sql`
    INSERT INTO classes (name, day_of_week, start_time, end_time, color)
    VALUES (${name}, ${dayOfWeek}, ${startTime}, ${endTime}, ${color})
    RETURNING *
  `;
  return result.rows[0] as GymClass;
}

export async function deleteClass(id: number): Promise<void> {
  await sql`DELETE FROM classes WHERE id = ${id}`;
}
