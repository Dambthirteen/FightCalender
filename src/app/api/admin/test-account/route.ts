import { neon } from '@neondatabase/serverless';
import { NextRequest, NextResponse } from 'next/server';

/**
 * Admin: einen Account als Test-/Dev-Account markieren (Level 99, Streak 500, alle Trophäen).
 * Beim Aktivieren wird das Profil auf privat gestellt und Level-/Cosmetic-„gesehen" hochgesetzt,
 * damit nicht sofort ein Schwung Level-up-/Freischalt-Benachrichtigungen ausgelöst wird.
 */
export async function POST(req: NextRequest) {
  const pw = req.headers.get('x-admin-password');
  if (!process.env.ADMIN_PASSWORD || pw !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { userName, action } = (await req.json().catch(() => ({}))) as { userName?: string; action?: string };
  const name = String(userName ?? '').trim();
  if (!name || (action !== 'enable' && action !== 'disable')) {
    return NextResponse.json({ error: 'Ungültige Anfrage' }, { status: 400 });
  }
  const sql = neon(process.env.DATABASE_URL!);
  const exists = await sql`SELECT 1 FROM users WHERE user_name = ${name}`;
  if (exists.length === 0) return NextResponse.json({ error: 'Unbekannter Nutzer' }, { status: 404 });

  if (action === 'enable') {
    await sql`
      UPDATE users
      SET is_test = true,
          profile_visibility = 'private',
          xp_level_seen = 99,
          cosmetic_notified_level = 99
      WHERE user_name = ${name}
    `;
  } else {
    await sql`UPDATE users SET is_test = false WHERE user_name = ${name}`;
  }
  return NextResponse.json({ ok: true, isTest: action === 'enable' });
}
