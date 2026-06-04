import { neon } from '@neondatabase/serverless';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const { adminPassword } = await req.json();
  if (adminPassword !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const sql = neon(process.env.DATABASE_URL!);
  await sql`DELETE FROM excuse_votes`;
  await sql`DELETE FROM skipping`;
  await sql`DELETE FROM attendance`;
  await sql`DELETE FROM user_schedule`;
  await sql`DELETE FROM users`;
  return NextResponse.json({ ok: true, message: 'Alle Nutzerdaten gelöscht.' });
}
