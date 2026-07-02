import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { getCurrentUser } from '@/lib/auth';

/** Onboarding-Assistent abgeschlossen markieren. */
export async function POST() {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const sql = neon(process.env.DATABASE_URL!);
    await sql`UPDATE users SET onboarding_completed = true WHERE user_name = ${me}`;
  } catch { /* Spalte evtl. noch nicht angelegt → egal, Assistent gilt trotzdem als fertig */ }
  return NextResponse.json({ ok: true });
}
