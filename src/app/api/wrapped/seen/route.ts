import { neon } from '@neondatabase/serverless';
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';

function getSql() {
  return neon(process.env.DATABASE_URL!);
}

/** Monats-Wrapped als gesehen markieren (Auto-Popup einmalig). */
export async function POST(req: NextRequest) {
  try {
    const me = await getCurrentUser();
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { month } = await req.json();
    if (!month) return NextResponse.json({ error: 'Missing month' }, { status: 400 });
    const sql = getSql();
    await sql`
      INSERT INTO wrapped_seen (user_name, month) VALUES (${me}, ${month})
      ON CONFLICT (user_name, month) DO NOTHING
    `;
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
