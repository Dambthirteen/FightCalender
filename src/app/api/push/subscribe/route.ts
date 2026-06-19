import { neon } from '@neondatabase/serverless';
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';

function getSql() {
  return neon(process.env.DATABASE_URL!);
}

/** Abo speichern (ein Gerät des eingeloggten Nutzers). */
export async function POST(req: NextRequest) {
  try {
    const userName = await getCurrentUser();
    if (!userName) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const sub = await req.json();
    const endpoint: string | undefined = sub?.endpoint;
    const p256dh: string | undefined = sub?.keys?.p256dh;
    const auth: string | undefined = sub?.keys?.auth;
    if (!endpoint || !p256dh || !auth) {
      return NextResponse.json({ error: 'Ungültiges Abo' }, { status: 400 });
    }

    const sql = getSql();
    // Endpoint ist eindeutig; bei erneutem Abonnieren (oder Gerätewechsel des
    // Nutzers) den Eintrag aktualisieren statt zu duplizieren.
    await sql`
      INSERT INTO push_subscriptions (user_name, endpoint, p256dh, auth)
      VALUES (${userName}, ${endpoint}, ${p256dh}, ${auth})
      ON CONFLICT (endpoint) DO UPDATE
        SET user_name = ${userName}, p256dh = ${p256dh}, auth = ${auth}
    `;
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

/** Abo löschen (Gerät abmelden). */
export async function DELETE(req: NextRequest) {
  try {
    const userName = await getCurrentUser();
    if (!userName) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { endpoint } = await req.json();
    if (!endpoint) return NextResponse.json({ error: 'Endpoint fehlt' }, { status: 400 });

    const sql = getSql();
    await sql`DELETE FROM push_subscriptions WHERE endpoint = ${endpoint} AND user_name = ${userName}`;
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
