import { neon } from '@neondatabase/serverless';
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { canViewProfile } from '@/lib/groups';

function getSql() { return neon(process.env.DATABASE_URL!); }

const EXCUSE_TEXT: Record<string, string> = {
  sick: '🤒 Krank',
  injured: '🩹 Verletzt',
  vacation: '🏖️ Urlaub',
};

export async function GET(req: NextRequest) {
  try {
    const me = await getCurrentUser();
    const user = req.nextUrl.searchParams.get('user') ?? me;
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    // Fremden Status (inkl. Notiz, evtl. medizinisch) nur gemäß Profil-Sichtbarkeit zeigen.
    if (user !== me && !(await canViewProfile(me, user))) return NextResponse.json([]);
    const sql = getSql();
    const rows = await sql`
      SELECT * FROM user_status WHERE user_name = ${user} ORDER BY start_date DESC
    `;
    return NextResponse.json(rows);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const sql = getSql();
    const userName = await getCurrentUser();
    if (!userName) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { statusType, startDate, endDate, note } = await req.json();
    if (!['sick', 'injured', 'vacation'].includes(statusType) || !startDate || !endDate) {
      return NextResponse.json({ error: 'Ungültige Daten' }, { status: 400 });
    }

    // Save status
    const rows = await sql`
      INSERT INTO user_status (user_name, status_type, start_date, end_date, note)
      VALUES (${userName}, ${statusType}, ${startDate}, ${endDate}, ${note ?? ''})
      RETURNING *
    `;
    const status = rows[0];

    // Get user's scheduled days
    const schedule = await sql`
      SELECT DISTINCT c.day_of_week
      FROM user_schedule us
      JOIN classes c ON c.id = us.class_id
      WHERE us.user_name = ${userName}
    `;
    const scheduledDays = new Set(schedule.map((r) => Number(r.day_of_week)));

    // Auto-create skip entries for each day in period where user has classes
    const excuse = EXCUSE_TEXT[statusType];
    const start = new Date(startDate + 'T12:00:00');
    const end = new Date(endDate + 'T12:00:00');

    for (const d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const jsDay = d.getDay(); // 0=Sun, 1=Mon ... 6=Sat
      const isoDay = jsDay === 0 ? 7 : jsDay; // 1=Mon, 7=Sun
      if (scheduledDays.size === 0 || scheduledDays.has(isoDay)) {
        const dateStr = d.toISOString().slice(0, 10);
        await sql`
          INSERT INTO skipping (date, user_name, excuse, auto_generated)
          VALUES (${dateStr}, ${userName}, ${excuse}, true)
          ON CONFLICT (date, user_name) DO NOTHING
        `;
      }
    }

    return NextResponse.json(status, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
