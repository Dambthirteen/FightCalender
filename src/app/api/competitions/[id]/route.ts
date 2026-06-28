import { neon } from '@neondatabase/serverless';
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { cleanResult, cleanMethod } from '../route';

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sql = neon(process.env.DATABASE_URL!);
    const userName = await getCurrentUser();
    if (!userName) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id } = await params;
    await sql`DELETE FROM competitions WHERE id = ${parseInt(id)} AND user_name = ${userName}`;
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

/** Wettkampf bearbeiten — nur der Ersteller. */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sql = neon(process.env.DATABASE_URL!);
    const userName = await getCurrentUser();
    if (!userName) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id } = await params;
    const { name, competitionDate, location, weightClass, notes, result, method } = await req.json();
    if (!name?.trim() || !competitionDate) {
      return NextResponse.json({ error: 'Name und Datum erforderlich' }, { status: 400 });
    }
    const rows = await sql`
      UPDATE competitions
      SET name = ${name.trim().slice(0, 200)}, competition_date = ${competitionDate},
          location = ${String(location ?? '').slice(0, 200)}, weight_class = ${String(weightClass ?? '').slice(0, 100)},
          notes = ${String(notes ?? '').slice(0, 500)}, result = ${cleanResult(result)}, method = ${cleanMethod(method)}
      WHERE id = ${parseInt(id)} AND user_name = ${userName}
      RETURNING *
    `;
    if (rows.length === 0) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 });
    return NextResponse.json(rows[0]);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
