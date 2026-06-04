import { neon } from '@neondatabase/serverless';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const pw = req.nextUrl.searchParams.get('adminPassword');
  if (pw !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const sql = neon(process.env.DATABASE_URL!);
  const rows = await sql`
    SELECT u.user_name, u.created_at,
      (SELECT COUNT(*)::int FROM attendance a WHERE a.user_name = u.user_name) AS attend_count,
      (SELECT COUNT(*)::int FROM skipping s WHERE s.user_name = u.user_name) AS skip_count,
      (SELECT COUNT(*)::int FROM user_schedule us WHERE us.user_name = u.user_name) AS schedule_count
    FROM users u
    ORDER BY u.created_at DESC
  `;
  return NextResponse.json(rows);
}

export async function DELETE(req: NextRequest) {
  const { adminPassword, userName } = await req.json();
  if (adminPassword !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const sql = neon(process.env.DATABASE_URL!);
  await sql`DELETE FROM users WHERE user_name = ${userName}`;
  return NextResponse.json({ ok: true });
}
