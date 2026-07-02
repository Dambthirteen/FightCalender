import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { consumeToken } from '@/lib/auth-tokens';

/** E-Mail-Verifizierung: Token einlösen → email_verified = true. */
export async function POST(req: NextRequest) {
  try {
    const { token } = await req.json();
    const sql = neon(process.env.DATABASE_URL!);
    const user = await consumeToken(sql, 'verify', token);
    if (!user) return NextResponse.json({ error: 'Link ungültig oder abgelaufen.' }, { status: 400 });
    await sql`UPDATE users SET email_verified = true WHERE user_name = ${user}`;
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
