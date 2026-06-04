import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { neon } from '@neondatabase/serverless';
import { setSessionCookie } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const { userName, password } = await req.json();
    const name = userName?.trim();
    if (!name || !password || password.length < 4) {
      return NextResponse.json({ error: 'Name und Passwort (mind. 4 Zeichen) erforderlich.' }, { status: 400 });
    }
    const sql = neon(process.env.DATABASE_URL!);
    const existing = await sql`SELECT id FROM users WHERE user_name = ${name}`;
    if (existing.length > 0) {
      return NextResponse.json({ error: 'Dieser Name ist bereits vergeben.' }, { status: 409 });
    }
    const hash = await bcrypt.hash(password, 10);
    await sql`INSERT INTO users (user_name, password_hash) VALUES (${name}, ${hash})`;
    await setSessionCookie(name);
    return NextResponse.json({ ok: true, userName: name });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
