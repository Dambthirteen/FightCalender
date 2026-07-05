import { neon } from '@neondatabase/serverless';
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getCurrentGroupId } from '@/lib/groups';

function getSql() { return neon(process.env.DATABASE_URL!); }

const RESULTS = ['win', 'loss'];
const METHODS = ['points', 'tko', 'ko'];
const PLACEMENTS = ['gold', 'silver', 'bronze', 'part']; // Turnier-Platzierung (Teilnahme = 'part')
export function cleanResult(v: unknown): string | null { return typeof v === 'string' && RESULTS.includes(v) ? v : null; }
export function cleanMethod(v: unknown): string | null { return typeof v === 'string' && METHODS.includes(v) ? v : null; }
export function cleanPlacement(v: unknown): string | null { return typeof v === 'string' && PLACEMENTS.includes(v) ? v : null; }

export async function GET() {
  try {
    const me = await getCurrentUser();
    const gid = me ? await getCurrentGroupId(me) : null;
    if (!gid) return NextResponse.json([]); // ohne Gruppe keine Wettkämpfe (nicht alle Crews!)
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
        comp.result,
        comp.method,
        comp.placement,
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
      LEFT JOIN classes cl ON cl.id = us.class_id AND cl.group_id = ${gid}
      WHERE comp.group_id = ${gid}
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
    const gid = await getCurrentGroupId(userName); // Wettkampf gehört zur aktuellen Gruppe
    const { name, competitionDate, location, weightClass, notes, result, method, placement } = await req.json();
    if (!name?.trim() || !competitionDate) {
      return NextResponse.json({ error: 'Name und Datum erforderlich' }, { status: 400 });
    }
    const rows = await sql`
      INSERT INTO competitions (user_name, name, competition_date, location, weight_class, notes, result, method, placement, group_id)
      VALUES (${userName}, ${name.trim().slice(0, 200)}, ${competitionDate},
              ${String(location ?? '').slice(0, 200)}, ${String(weightClass ?? '').slice(0, 100)}, ${String(notes ?? '').slice(0, 500)},
              ${cleanResult(result)}, ${cleanMethod(method)}, ${cleanPlacement(placement)}, ${gid})
      RETURNING *
    `;
    return NextResponse.json(rows[0], { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
