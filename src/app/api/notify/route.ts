import { neon } from '@neondatabase/serverless';
import { NextRequest, NextResponse } from 'next/server';
import { ensurePushConfigured, sendPush } from '@/lib/push';
import { berlinNow, isoDayOfWeek, weekStartOf, hmToMinutes } from '@/lib/berlin-time';
import { isHoliday } from '@/lib/holidays';

// web-push braucht Node-Crypto → kein Edge-Runtime.
export const runtime = 'nodejs';

const KIND = 'class_reminder_2h';
const LEAD_MAX = 120; // benachrichtigen ab spätestens 2 Std vor Beginn …
const LEAD_MIN = 60; // … bis frühestens 1 Std vorher (danach zu spät)

function getSql() {
  return neon(process.env.DATABASE_URL!);
}

/** ["A","B","C"] → "A, B und C" */
function joinNames(names: string[]): string {
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} und ${names[names.length - 1]}`;
}

interface ClassRow {
  id: number;
  name: string;
  start_time: string;
}
interface SubRow {
  user_name: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

async function handle(req: NextRequest): Promise<NextResponse> {
  // 1) Zugriff nur mit gültigem Secret (vom externen Cron-Dienst mitgeschickt).
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get('authorization');
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!ensurePushConfigured()) {
    return NextResponse.json({ error: 'VAPID-Schlüssel fehlen' }, { status: 500 });
  }

  const sql = getSql();
  const { date: today, minutes: nowMin } = berlinNow();

  // 2) An Feiertagen (NRW) keine Benachrichtigungen.
  const holiday = isHoliday(today);
  if (holiday) {
    return NextResponse.json({ ok: true, today, skipped: `Feiertag: ${holiday.name}` });
  }

  const isoDow = isoDayOfWeek(today);
  const weekStart = weekStartOf(today);

  // 3) Alle Kurse, die heute (an diesem Wochentag) stattfinden.
  const classes = (await sql`
    SELECT id, name, start_time FROM classes WHERE day_of_week = ${isoDow}
  `) as ClassRow[];

  // Abos einmal laden und im Speicher zuordnen (kleine Nutzerzahl).
  const allSubs = (await sql`
    SELECT user_name, endpoint, p256dh, auth FROM push_subscriptions
  `) as SubRow[];

  // Wer Kurs-Erinnerungen abgeschaltet hat (Tabelle evtl. noch nicht angelegt → tolerant).
  let optOut = new Set<string>();
  try {
    const rows = (await sql`SELECT user_name FROM notification_prefs WHERE class_reminders = false`) as { user_name: string }[];
    optOut = new Set(rows.map((r) => r.user_name));
  } catch { /* notification_prefs noch nicht vorhanden */ }

  const summary: { class: string; start: string; attendees: number; sent: number }[] = [];
  let totalSent = 0;

  for (const cls of classes) {
    const minutesUntil = hmToMinutes(cls.start_time) - nowMin;
    // Fenster: nur senden, wenn der Kurs in 1–2 Std beginnt.
    if (minutesUntil <= LEAD_MIN || minutesUntil > LEAD_MAX) continue;

    // 4) Zugesagte = Anwesenheit für diese Woche, abzüglich wer für HEUTE abgesagt hat
    //    (manuelle Absage oder Auto-Skip wegen krank/Urlaub).
    const attendees = (await sql`
      SELECT a.user_name FROM attendance a
      WHERE a.class_id = ${cls.id} AND a.week_start = ${weekStart}
        AND NOT EXISTS (
          SELECT 1 FROM skipping s
          WHERE s.user_name = a.user_name AND s.date = ${today}
        )
    `) as { user_name: string }[];
    const attendeeNames = attendees.map((r) => r.user_name);
    if (attendeeNames.length === 0) continue; // niemand zugesagt → nächster Lauf prüft erneut

    // 5) Empfänger = Zugesagte mit Push-Abo.
    const attendeeSet = new Set(attendeeNames);
    const recipientSubs = allSubs.filter((s) => attendeeSet.has(s.user_name) && !optOut.has(s.user_name));
    if (recipientSubs.length === 0) continue; // keiner abonniert → nächster Lauf prüft erneut

    // 6) Genau einmal pro Kurs/Tag "claimen": nur wenn der Log-Eintrag neu entsteht.
    const claim = await sql`
      INSERT INTO notification_log (class_id, notify_date, kind)
      VALUES (${cls.id}, ${today}, ${KIND})
      ON CONFLICT (class_id, notify_date, kind) DO NOTHING
      RETURNING id
    `;
    if (claim.length === 0) continue; // schon verschickt

    // 7) Personalisiert senden: jedem die jeweils anderen Zugesagten nennen.
    let sentForClass = 0;
    for (const s of recipientSubs) {
      const others = attendeeNames.filter((n) => n !== s.user_name);
      const body =
        others.length > 0
          ? `Auch dabei: ${joinNames(others)}`
          : 'Heute bist du allein am Start 🥲';
      const result = await sendPush(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        { title: `🥊 ${cls.name} heute um ${cls.start_time}`, body, url: '/' }
      );
      if (result.ok) {
        sentForClass++;
        totalSent++;
      } else if (result.gone) {
        // Totes Abo aufräumen.
        await sql`DELETE FROM push_subscriptions WHERE endpoint = ${s.endpoint}`;
      }
    }
    summary.push({
      class: cls.name,
      start: cls.start_time,
      attendees: attendeeNames.length,
      sent: sentForClass,
    });
  }

  return NextResponse.json({ ok: true, today, nowMin, sent: totalSent, classes: summary });
}

// GET (einfaches Anpingen) und POST funktionieren beide.
export async function GET(req: NextRequest) {
  return handle(req);
}
export async function POST(req: NextRequest) {
  return handle(req);
}
