import { neon } from '@neondatabase/serverless';
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';

const LOCK_DAYS = 7;
function getSql() { return neon(process.env.DATABASE_URL!); }

/** Ist der feste Stundenplan gerade gesperrt? lockedUntil = null → jetzt änderbar. */
export async function GET() {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const sql = getSql();
    const row = (await sql`SELECT schedule_changed_at AS t FROM users WHERE user_name = ${me}`) as { t: string | null }[];
    const last = row[0]?.t ? new Date(row[0].t) : null;
    if (last) {
      const until = new Date(last.getTime() + LOCK_DAYS * 86400000);
      if (Date.now() < until.getTime()) return NextResponse.json({ lockedUntil: until.toISOString() });
    }
    return NextResponse.json({ lockedUntil: null });
  } catch {
    return NextResponse.json({ lockedUntil: null });
  }
}
