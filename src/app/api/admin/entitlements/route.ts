import { neon } from '@neondatabase/serverless';
import { NextRequest, NextResponse } from 'next/server';

/** Admin: Supporter-Status (Entitlement) pro Nutzer vergeben/entziehen. */
export async function POST(req: NextRequest) {
  const pw = req.headers.get('x-admin-password');
  if (!process.env.ADMIN_PASSWORD || pw !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { userName, action } = (await req.json().catch(() => ({}))) as { userName?: string; action?: string };
  const name = String(userName ?? '').trim();
  if (!name || (action !== 'grant' && action !== 'revoke')) {
    return NextResponse.json({ error: 'Ungültige Anfrage' }, { status: 400 });
  }
  const sql = neon(process.env.DATABASE_URL!);
  if (action === 'grant') {
    await sql`
      INSERT INTO user_entitlements (user_name, sku, source)
      VALUES (${name}, 'supporter', 'admin')
      ON CONFLICT (user_name, sku) DO NOTHING
    `;
  } else {
    await sql`DELETE FROM user_entitlements WHERE user_name = ${name} AND sku = 'supporter'`;
  }
  return NextResponse.json({ ok: true, supporter: action === 'grant' });
}
