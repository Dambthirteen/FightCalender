import { neon } from '@neondatabase/serverless';

function getSql() {
  return neon(process.env.DATABASE_URL!);
}

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

export async function getClasses(groupId?: number): Promise<GymClass[]> {
  const sql = getSql();
  const rows = groupId
    ? await sql`SELECT * FROM classes WHERE group_id = ${groupId} ORDER BY day_of_week, start_time`
    : await sql`SELECT * FROM classes ORDER BY day_of_week, start_time`;
  return rows as GymClass[];
}

export async function getAttendanceForWeek(weekStart: string, groupId: number): Promise<AttendanceRecord[]> {
  const sql = getSql();
  // Nur Anwesenheiten der Kurse DIESER Gruppe — sonst würde man fremde Crews sehen.
  const rows = await sql`
    SELECT a.* FROM attendance a JOIN classes c ON c.id = a.class_id
    WHERE a.week_start = ${weekStart} AND c.group_id = ${groupId}
  `;
  return rows as AttendanceRecord[];
}

/** Gehört der Kurs zur angegebenen Gruppe? (Zugriffsprüfung fürs Ein-/Austragen.) */
export async function classInGroup(classId: number, groupId: number): Promise<boolean> {
  const sql = getSql();
  const rows = await sql`SELECT 1 FROM classes WHERE id = ${classId} AND group_id = ${groupId}`;
  return rows.length > 0;
}

export async function toggleAttendance(
  classId: number,
  weekStart: string,
  userName: string
): Promise<{ attending: boolean }> {
  const sql = getSql();
  const existing = await sql`
    SELECT id FROM attendance
    WHERE class_id = ${classId} AND week_start = ${weekStart} AND user_name = ${userName}
  `;
  if (existing.length > 0) {
    await sql`
      DELETE FROM attendance
      WHERE class_id = ${classId} AND week_start = ${weekStart} AND user_name = ${userName}
    `;
    return { attending: false };
  } else {
    await sql`
      INSERT INTO attendance (class_id, week_start, user_name)
      VALUES (${classId}, ${weekStart}, ${userName})
    `;
    // Wer doch noch kommt, ist kein No-Show mehr → Ausrede/Skip für den Tag löschen
    // (entfernt damit auch die Ausrede aus dem Ausreden-Gericht; Votes cascaden).
    await sql`
      DELETE FROM skipping
      WHERE user_name = ${userName}
        AND date = (${weekStart}::date + (
          (SELECT day_of_week FROM classes WHERE id = ${classId}) - 1
        ) * INTERVAL '1 day')::date
    `;
    return { attending: true };
  }
}

export async function createClass(
  name: string,
  dayOfWeek: number,
  startTime: string,
  endTime: string,
  color: string,
  groupId?: number
): Promise<GymClass> {
  const sql = getSql();
  const rows = await sql`
    INSERT INTO classes (name, day_of_week, start_time, end_time, color, group_id)
    VALUES (${name}, ${dayOfWeek}, ${startTime}, ${endTime}, ${color}, ${groupId ?? null})
    RETURNING *
  `;
  return rows[0] as GymClass;
}

export async function deleteClass(id: number): Promise<void> {
  const sql = getSql();
  await sql`DELETE FROM classes WHERE id = ${id}`;
}
