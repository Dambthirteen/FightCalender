import { neon } from '@neondatabase/serverless';
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';

function getSql() {
  return neon(process.env.DATABASE_URL!);
}

/** Liste aller Mitglieder (für eingeloggte Nutzer). */
export async function GET() {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const sql = getSql();
  const rows = await sql`SELECT user_name FROM users ORDER BY LOWER(user_name)`;
  return NextResponse.json(rows);
}
