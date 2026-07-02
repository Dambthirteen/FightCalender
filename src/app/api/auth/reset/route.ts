import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { neon } from '@neondatabase/serverless';
import { consumeToken } from '@/lib/auth-tokens';

/** Passwort-Reset: Token einlösen + neues Passwort setzen. */
export async function POST(req: NextRequest) {
  try {
    const { token, password } = await req.json();
    if (typeof password !== 'string' || password.length < 6 || password.length > 72) {
      return NextResponse.json({ error: 'Passwort muss 6–72 Zeichen lang sein.' }, { status: 400 });
    }
    const sql = neon(process.env.DATABASE_URL!);
    const user = await consumeToken(sql, 'reset', token);
    if (!user) return NextResponse.json({ error: 'Link ungültig oder abgelaufen.' }, { status: 400 });
    const hash = await bcrypt.hash(password, 10);
    await sql`UPDATE users SET password_hash = ${hash} WHERE user_name = ${user}`;
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
