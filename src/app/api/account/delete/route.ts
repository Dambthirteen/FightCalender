import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getCurrentUser, clearSessionCookie } from '@/lib/auth';
import { getSql, deleteAllUserData } from '@/lib/account';

/** DSGVO-Löschung des eigenen Accounts. Passwort-Bestätigung erforderlich. */
export async function POST(req: NextRequest) {
  try {
    const me = await getCurrentUser();
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { password } = await req.json();
    if (typeof password !== 'string' || !password) {
      return NextResponse.json({ error: 'Passwort erforderlich' }, { status: 400 });
    }
    const sql = getSql();
    const rows = await sql`SELECT password_hash FROM users WHERE user_name = ${me}`;
    const hash = rows[0]?.password_hash as string | undefined;
    if (!hash || !(await bcrypt.compare(password, hash))) {
      return NextResponse.json({ error: 'Passwort falsch' }, { status: 403 });
    }
    await deleteAllUserData(sql, me);
    await clearSessionCookie();
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
