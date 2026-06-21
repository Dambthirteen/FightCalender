import { neon } from '@neondatabase/serverless';
import { NextRequest, NextResponse } from 'next/server';
import { deleteClass } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { getRole } from '@/lib/groups';

function getSql() {
  return neon(process.env.DATABASE_URL!);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { adminPassword } = await req.json().catch(() => ({}));
    const { id } = await params;
    const classId = parseInt(id, 10);

    const sql = getSql();
    const rows = await sql`SELECT group_id FROM classes WHERE id = ${classId}`;
    const groupId = (rows[0]?.group_id as number | null) ?? null;

    const me = await getCurrentUser();
    const isGroupAdmin = !!(me && groupId && (await getRole(me, groupId)) === 'admin');
    const isSuperAdmin = !!adminPassword && adminPassword === process.env.ADMIN_PASSWORD;
    if (!isGroupAdmin && !isSuperAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await deleteClass(classId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
