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
