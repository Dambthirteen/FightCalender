import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { getCurrentUser } from '@/lib/auth';

export async function GET() {
  const userName = await getCurrentUser();
  if (!userName) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  // Fail-safe: im Zweifel als „fertig" behandeln, damit niemand fälschlich ins Onboarding gezwungen wird.
  let onboardingCompleted = true;
  try {
    const sql = neon(process.env.DATABASE_URL!);
    const rows = await sql`SELECT onboarding_completed FROM users WHERE user_name = ${userName}`;
    if (rows[0] && rows[0].onboarding_completed === false) onboardingCompleted = false;
  } catch { /* Spalte evtl. noch nicht angelegt → als fertig behandeln */ }
  return NextResponse.json({ userName, onboardingCompleted });
}
