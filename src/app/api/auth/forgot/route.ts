import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { createToken } from '@/lib/auth-tokens';
import { sendEmail, resetPasswordHtml } from '@/lib/email';

/** „Passwort vergessen": Reset-Link per Mail. Antwort ist IMMER ok (kein E-Mail-Enumeration-Leak). */
export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    const mail = String(email ?? '').trim().toLowerCase();
    if (mail) {
      const sql = neon(process.env.DATABASE_URL!);
      const rows = await sql`SELECT user_name FROM users WHERE LOWER(email) = ${mail}`;
      // Nur bei genau einem Treffer (bei geteilter Mail wäre das Ziel mehrdeutig).
      if (rows.length === 1) {
        const user = rows[0].user_name as string;
        const token = await createToken(sql, user, 'reset', 60); // 1 Stunde
        const { subject, html } = resetPasswordHtml(req.nextUrl.origin, token);
        await sendEmail({ to: mail, subject, html });
      }
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true }); // bewusst kein Fehler-Leak
  }
}
