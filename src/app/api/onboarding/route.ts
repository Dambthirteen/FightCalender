import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { getCurrentUser } from '@/lib/auth';

/** Onboarding-Assistent abgeschlossen markieren. */
export async function POST(req: Request) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { referrerEmail } = (await req.json().catch(() => ({}))) as { referrerEmail?: string };
  try {
    const sql = neon(process.env.DATABASE_URL!);
    await sql`UPDATE users SET onboarding_completed = true WHERE user_name = ${me}`;
    // Werber-Tracking: gemeldete E-Mail speichern + (falls auffindbar) den Werber-Account verknüpfen.
    const email = String(referrerEmail ?? '').trim().toLowerCase();
    if (email && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      try {
        await sql`UPDATE users SET referred_by_email = ${email} WHERE user_name = ${me}`;
        const r = await sql`SELECT user_name FROM users WHERE lower(email) = ${email} AND user_name <> ${me} LIMIT 1`;
        if (r[0]?.user_name) await sql`UPDATE users SET referred_by = ${r[0].user_name} WHERE user_name = ${me}`;
      } catch { /* Referral-Spalten evtl. noch nicht angelegt → egal */ }
    }
  } catch { /* Spalte evtl. noch nicht angelegt → egal, Assistent gilt trotzdem als fertig */ }
  return NextResponse.json({ ok: true });
}
