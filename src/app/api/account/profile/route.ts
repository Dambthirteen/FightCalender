import { neon } from '@neondatabase/serverless';
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createToken } from '@/lib/auth-tokens';
import { sendEmail, verifyEmailHtml } from '@/lib/email';

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
function getSql() { return neon(process.env.DATABASE_URL!); }

/** Konto-Einstellungen des eingeloggten Nutzers: E-Mail (+ Status) und Geburtsdatum. */
export async function GET() {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const sql = getSql();
    const [row] = (await sql`
      SELECT email, email_verified, birthdate FROM users WHERE user_name = ${me}
    `) as { email: string | null; email_verified: boolean; birthdate: string | null }[];
    return NextResponse.json({
      email: row?.email ?? '',
      email_verified: !!row?.email_verified,
      birthdate: row?.birthdate ? String(row.birthdate).slice(0, 10) : '',
    });
  } catch {
    return NextResponse.json({ email: '', email_verified: false, birthdate: '' });
  }
}

/** E-Mail und/oder Geburtsdatum ändern (nur gesetzte Felder). */
export async function POST(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { email, birthdate } = (await req.json().catch(() => ({}))) as { email?: string; birthdate?: string };
  const sql = getSql();

  if (email !== undefined) {
    const mail = String(email).trim().toLowerCase();
    if (!EMAIL_RE.test(mail) || mail.length > 255) {
      return NextResponse.json({ error: 'Bitte eine gültige E-Mail-Adresse angeben.' }, { status: 400 });
    }
    const [cur] = (await sql`SELECT email FROM users WHERE user_name = ${me}`) as { email: string | null }[];
    if ((cur?.email ?? '').toLowerCase() !== mail) {
      // Bei Änderung: neu verifizieren lassen.
      await sql`UPDATE users SET email = ${mail}, email_verified = false WHERE user_name = ${me}`;
      try {
        const token = await createToken(sql, me, 'verify', 60 * 24); // 24h
        const { subject, html } = verifyEmailHtml(req.nextUrl.origin, token);
        await sendEmail({ to: mail, subject, html }); // No-Op ohne RESEND_API_KEY
      } catch { /* Mail-Versand darf das Speichern nicht blockieren */ }
    }
  }

  if (birthdate !== undefined) {
    const bd = String(birthdate).trim();
    if (bd === '') {
      await sql`UPDATE users SET birthdate = NULL WHERE user_name = ${me}`;
    } else if (/^\d{4}-\d{2}-\d{2}$/.test(bd)) {
      await sql`UPDATE users SET birthdate = ${bd}::date WHERE user_name = ${me}`;
    } else {
      return NextResponse.json({ error: 'Ungültiges Geburtsdatum.' }, { status: 400 });
    }
  }

  return NextResponse.json({ ok: true });
}
