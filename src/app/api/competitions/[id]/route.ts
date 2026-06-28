import { neon } from '@neondatabase/serverless';
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';

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
    const { name, competitionDate, location, weightClass, notes } = await req.json();
    if (!name?.trim() || !competitionDate) {
      return NextResponse.json({ error: 'Name und Datum erforderlich' }, { status: 400 });
    }
    const rows = await sql`
      UPDATE competitions
      SET name = ${name.trim()}, competition_date = ${competitionDate},
          location = ${location ?? ''}, weight_class = ${weightClass ?? ''}, notes = ${notes ?? ''}
      WHERE id = ${parseInt(id)} AND user_name = ${userName}
      RETURNING *
    `;
    if (rows.length === 0) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 });
    return NextResponse.json(rows[0]);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
