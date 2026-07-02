import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { neon } from '@neondatabase/serverless';
import { setSessionCookie } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const { userName, password, consent } = await req.json();
    const name = String(userName ?? '').trim();
    if (name.length < 2 || name.length > 100) {
      return NextResponse.json({ error: 'Name muss 2–100 Zeichen lang sein.' }, { status: 400 });
    }
    if (typeof password !== 'string' || password.length < 6 || password.length > 72) {
      return NextResponse.json({ error: 'Passwort muss 6–72 Zeichen lang sein.' }, { status: 400 });
    }
    // DSGVO: Einwilligung in die Datenschutzerklärung ist Pflicht.
    if (consent !== true) {
      return NextResponse.json({ error: 'Bitte akzeptiere die Datenschutzerklärung.' }, { status: 400 });
    }
    const sql = neon(process.env.DATABASE_URL!);
    const existing = await sql`SELECT id FROM users WHERE user_name = ${name}`;
    if (existing.length > 0) {
      return NextResponse.json({ error: 'Dieser Name ist bereits vergeben.' }, { status: 409 });
    }
    const hash = await bcrypt.hash(password, 10);
    await sql`INSERT INTO users (user_name, password_hash) VALUES (${name}, ${hash})`;
    // Einwilligungs-Zeitstempel festhalten (Nachweis). Spalte evtl. noch nicht da → egal.
    try { await sql`UPDATE users SET privacy_accepted_at = NOW() WHERE user_name = ${name}`; } catch {}
    await setSessionCookie(name);
    return NextResponse.json({ ok: true, userName: name });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
