import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { neon } from '@neondatabase/serverless';
import { setSessionCookie } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const { userName, password } = await req.json();
    const name = userName?.trim();
    if (!name || !password) {
      return NextResponse.json({ error: 'Name und Passwort erforderlich.' }, { status: 400 });
    }
    const sql = neon(process.env.DATABASE_URL!);
    const rows = await sql`SELECT password_hash FROM users WHERE user_name = ${name}`;
    if (rows.length === 0) {
      return NextResponse.json({ error: 'Unbekannter Benutzer.' }, { status: 401 });
    }
    const valid = await bcrypt.compare(password, rows[0].password_hash);
    if (!valid) {
      return NextResponse.json({ error: 'Falsches Passwort.' }, { status: 401 });
    }
    await setSessionCookie(name);
    return NextResponse.json({ ok: true, userName: name });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
