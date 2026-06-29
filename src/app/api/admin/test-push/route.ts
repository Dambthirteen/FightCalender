import { neon } from '@neondatabase/serverless';
import { NextRequest, NextResponse } from 'next/server';
import { ensurePushConfigured, sendPush } from '@/lib/push';
import { getCurrentUser } from '@/lib/auth';

// web-push braucht Node-Crypto → kein Edge-Runtime.
export const runtime = 'nodejs';

// Beispiel-Payloads für JEDEN Push-Typ der App — zum Testen aus dem Admin-Panel.
// Hält sich an die echten Texte/URLs aus /api/notify und lib/notify.
const SAMPLES: Record<string, { title: string; body: string; url: string }> = {
  loser_streak: { title: 'Guck dir diesen Loser an!', body: '3 Trainings am Stück geschwänzt. Tipp drauf. 📸', url: '/loser' },
  loser_2mo: { title: 'Guck dir diesen Loser an!', body: '2 Monate in Folge Bitch des Monats. Tipp drauf. 📸', url: '/loser' },
  class_reminder: { title: '🥊 BJJ heute um 18:00', body: 'Auch dabei: Tim und Max', url: '/' },
  court_open: { title: '🗳️ Ausreden-Gericht offen', body: 'Die Ausreden des Monats können jetzt bewertet werden — stimme ab!', url: '/vote' },
  court_result: { title: '⚖️ Gericht-Ergebnis', body: 'Die Ausreden vom letzten Monat sind ausgewertet — schau, ob dein Bitch-Punkt steht!', url: '/vote' },
  bitch_reminder: { title: '🐔 Nicht eingetragen!', body: 'Du warst bei keinem geplanten Kurs eingetragen. Trag dich ein oder schreib eine Ausrede!', url: '/' },
  comment: { title: '💬 Neuer Kommentar', body: 'Tim hat etwas auf deine Pinnwand geschrieben.', url: '/benachrichtigungen' },
  challenge: { title: '🌳 Skilltree angefochten', body: 'Max schlägt neue Werte für deinen Skilltree vor.', url: '/benachrichtigungen' },
  challenge_result: { title: '🌳 Skilltree-Anfechtung', body: 'Deine Anfechtung wurde bearbeitet.', url: '/benachrichtigungen' },
  praise: { title: '⭐ Lob erhalten', body: 'Angelo hat dir ein Lob gegeben!', url: '/benachrichtigungen' },
  badge: { title: '🏅 Neues Abzeichen', body: 'Du hast „Soldier" freigeschaltet!', url: '/benachrichtigungen' },
  skilltree: { title: '🌳 Skilltree-Update', body: 'Max hat den Skilltree angepasst', url: '/benachrichtigungen' },
  praise_feed: { title: '👏 Lob', body: 'Tim hat Max ein Lob gegeben', url: '/benachrichtigungen' },
  competition: { title: '🥊 Wettkampf heute!', body: 'Angelo: Rumble in Köln', url: '/competitions' },
  bitch: { title: '🐔 Geschwänzt', body: 'Niklas war nicht beim Training', url: '/statistik' },
  badge_feed: { title: '🏅 Abzeichen freigeschaltet', body: 'Max: Soldier', url: '/benachrichtigungen' },
};

export async function POST(req: NextRequest) {
  const pw = req.headers.get('x-admin-password');
  if (!process.env.ADMIN_PASSWORD || pw !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { kind, target } = (await req.json().catch(() => ({}))) as { kind?: string; target?: string };
  const sample = kind ? SAMPLES[kind] : undefined;
  if (!sample) return NextResponse.json({ error: 'Unbekannter Push-Typ.' }, { status: 400 });
  if (!ensurePushConfigured()) {
    return NextResponse.json({ error: 'Push nicht konfiguriert (VAPID-Schlüssel fehlen).' }, { status: 500 });
  }

  const recipient = (target && target.trim()) || (await getCurrentUser());
  if (!recipient) return NextResponse.json({ error: 'Kein Empfänger (nicht eingeloggt?).' }, { status: 400 });

  const sql = neon(process.env.DATABASE_URL!);
  const subs = (await sql`
    SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_name = ${recipient}
  `) as { endpoint: string; p256dh: string; auth: string }[];
  if (subs.length === 0) {
    return NextResponse.json(
      { error: `Keine Push-Abos für „${recipient}" — auf dem Zielgerät zuerst Benachrichtigungen aktivieren.` },
      { status: 400 }
    );
  }

  let sent = 0;
  for (const s of subs) {
    const r = await sendPush({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, sample);
    if (r.ok) sent++;
    else if (r.gone) await sql`DELETE FROM push_subscriptions WHERE endpoint = ${s.endpoint}`;
  }
  return NextResponse.json({ ok: true, sent, recipient });
}
