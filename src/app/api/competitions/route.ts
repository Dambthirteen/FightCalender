import { neon } from '@neondatabase/serverless';
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';

function getSql() { return neon(process.env.DATABASE_URL!); }

export async function GET() {
  try {
    const sql = getSql();
    const rows = await sql`
      SELECT
        comp.id,
        comp.user_name,
        comp.name,
        comp.competition_date::text,
        comp.location,
        comp.weight_class,
        comp.notes,
        comp.created_at,
        COALESCE(
          json_agg(
            json_build_object('name', cl.name, 'day_of_week', cl.day_of_week)
            ORDER BY cl.day_of_week, cl.start_time
          ) FILTER (WHERE cl.id IS NOT NULL),
          '[]'::json
        ) AS user_classes
      FROM competitions comp
      LEFT JOIN user_schedule us ON us.user_name = comp.user_name
      LEFT JOIN classes cl ON cl.id = us.class_id
      GROUP BY comp.id
      ORDER BY comp.competition_date ASC
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
    const { name, competitionDate, location, weightClass, notes } = await req.json();
    if (!name?.trim() || !competitionDate) {
      return NextResponse.json({ error: 'Name und Datum erforderlich' }, { status: 400 });
    }
    const rows = await sql`
      INSERT INTO competitions (user_name, name, competition_date, location, weight_class, notes)
      VALUES (${userName}, ${name.trim()}, ${competitionDate}, ${location ?? ''}, ${weightClass ?? ''}, ${notes ?? ''})
      RETURNING *
    `;
    return NextResponse.json(rows[0], { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
