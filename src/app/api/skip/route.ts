import { neon } from '@neondatabase/serverless';
import { NextRequest, NextResponse } from 'next/server';
import { berlinNow } from '@/lib/berlin-time';
import { getCurrentUser } from '@/lib/auth';
import { getCurrentGroupId } from '@/lib/groups';

function getSql() {
  return neon(process.env.DATABASE_URL!);
}

export async function GET(req: NextRequest) {
  try {
    const sql = getSql();
    const week = req.nextUrl.searchParams.get('week');
    if (!week) return NextResponse.json({ error: 'Missing week param' }, { status: 400 });
    const rows = await sql`
      SELECT * FROM skipping
      WHERE date >= ${week}::date AND date < (${week}::date + INTERVAL '7 days')
    `;
    return NextResponse.json(rows);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const sql = getSql();
    const { date, userName, excuse, useStreakPoint } = await req.json();
    if (!date || !userName?.trim()) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }
    const name = userName.trim();
    const existing = (await sql`
      SELECT id, streak_protected FROM skipping WHERE date = ${date} AND user_name = ${name}
    `) as { id: number; streak_protected: boolean }[];
    if (existing.length > 0) {
      // Toggle off — entfernen; geschützten Streak-Punkt zurückgeben.
      if (existing[0].streak_protected) {
        await sql`UPDATE users SET streak_points = streak_points + 1 WHERE user_name = ${name}`;
      }
      await sql`DELETE FROM skipping WHERE date = ${date} AND user_name = ${name}`;
      return NextResponse.json({ skipping: false });
    } else {
      // Toggle on — require excuse
      if (!excuse?.trim()) {
        return NextResponse.json({ error: 'Begründung fehlt' }, { status: 400 });
      }
      // Neues Modell: Ausrede nur innerhalb von 3 Tagen nach dem verpassten Tag.
      const diff = Math.round((Date.parse(berlinNow().date) - Date.parse(date)) / 86400000);
      if (diff > 3) {
        return NextResponse.json({ error: 'Frist abgelaufen — Ausrede nur bis 3 Tage nach dem Tag möglich.' }, { status: 400 });
      }
      const me = await getCurrentUser();
      const gid = me ? await getCurrentGroupId(me) : null;

      // Optional: Streak mit einem Streak-Punkt schützen (nur wenn vorhanden).
      let protectStreak = false;
      if (useStreakPoint) {
        const dec = await sql`
          UPDATE users SET streak_points = streak_points - 1
          WHERE user_name = ${name} AND streak_points > 0 RETURNING streak_points
        `;
        protectStreak = dec.length > 0;
      }

      await sql`
        INSERT INTO skipping (date, user_name, excuse, group_id, streak_protected)
        VALUES (${date}, ${name}, ${excuse.trim().slice(0, 500)}, ${gid}, ${protectStreak})
      `;
      return NextResponse.json({ skipping: true, streakProtected: protectStreak });
    }
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
