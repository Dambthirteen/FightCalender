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

    // Get the status period dates before deleting
    const status = await sql`
      SELECT start_date, end_date FROM user_status WHERE id = ${parseInt(id)} AND user_name = ${userName}
    `;
    if (status.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const { start_date, end_date } = status[0];

    // Delete auto-generated skips in that date range
    await sql`
      DELETE FROM skipping
      WHERE user_name = ${userName}
        AND date >= ${start_date}::date
        AND date <= ${end_date}::date
        AND auto_generated = true
    `;

    // Delete the status itself
    await sql`DELETE FROM user_status WHERE id = ${parseInt(id)} AND user_name = ${userName}`;

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
