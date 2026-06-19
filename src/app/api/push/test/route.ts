import { neon } from '@neondatabase/serverless';
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { ensurePushConfigured, sendPush } from '@/lib/push';

// web-push braucht Node-Crypto.
export const runtime = 'nodejs';

function getSql() {
  return neon(process.env.DATABASE_URL!);
}

interface SubRow {
  endpoint: string;
  p256dh: string;
  auth: string;
}

/** Schickt eine Test-Benachrichtigung an alle Geräte des eingeloggten Nutzers. */
export async function POST() {
  const userName = await getCurrentUser();
  if (!userName) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!ensurePushConfigured()) {
    return NextResponse.json({ error: 'VAPID-Schlüssel fehlen' }, { status: 500 });
  }

  const sql = getSql();
  const subs = (await sql`
    SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_name = ${userName}
  `) as SubRow[];

  let sent = 0;
  for (const s of subs) {
    const result = await sendPush(
      { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
      { title: '🥊 Test', body: 'Push funktioniert — du bist startklar!', url: '/' }
    );
    if (result.ok) sent++;
    else if (result.gone) {
      await sql`DELETE FROM push_subscriptions WHERE endpoint = ${s.endpoint}`;
    }
  }

  return NextResponse.json({ ok: true, sent });
}
