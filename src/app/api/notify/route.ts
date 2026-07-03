import { neon } from '@neondatabase/serverless';
import { NextRequest, NextResponse } from 'next/server';
import { ensurePushConfigured, sendPush } from '@/lib/push';
import { berlinNow, isoDayOfWeek, weekStartOf, hmToMinutes } from '@/lib/berlin-time';
import { isHoliday } from '@/lib/holidays';
import { CUTOVER } from '@/lib/bitch-scoring';
import { broadcastToGroup } from '@/lib/feed';
import { getMyGroups } from '@/lib/groups';

// web-push braucht Node-Crypto → kein Edge-Runtime.
export const runtime = 'nodejs';

const KIND = 'class_reminder_2h';
const LEAD_MAX = 120; // benachrichtigen ab spätestens 2 Std vor Beginn …
const LEAD_MIN = 60; // … bis frühestens 1 Std vorher (danach zu spät)

function getSql() {
  return neon(process.env.DATABASE_URL!);
}

/** Datum-String (yyyy-MM-dd) um n Tage verschieben. */
function addD(dateStr: string, n: number): string {
  const d = new Date(`${dateStr}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
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
  const ym = today.slice(0, 7);
  const dayOfMonth = parseInt(today.slice(8, 10), 10);
  const yr = parseInt(today.slice(0, 4), 10);
  const mo = parseInt(today.slice(5, 7), 10);
  const daysInMonth = new Date(Date.UTC(yr, mo, 0)).getUTCDate();

  // Abos einmal laden.
  const allSubs = (await sql`
    SELECT user_name, endpoint, p256dh, auth FROM push_subscriptions
  `) as SubRow[];

  // Benachrichtigungs-Einstellungen laden (tolerant, falls Tabelle fehlt).
  const classOut = new Set<string>();
  const courtOpenOut = new Set<string>();
  const courtResultOut = new Set<string>();
  const bitchRemindOut = new Set<string>();
  try {
    const prefs = (await sql`
      SELECT user_name, class_reminders, court_open, court_result, bitch_reminders FROM notification_prefs
    `) as { user_name: string; class_reminders: boolean; court_open: boolean; court_result: boolean; bitch_reminders: boolean }[];
    for (const p of prefs) {
      if (p.class_reminders === false) classOut.add(p.user_name);
      if (p.court_open === false) courtOpenOut.add(p.user_name);
      if (p.court_result === false) courtResultOut.add(p.user_name);
      if (p.bitch_reminders === false) bitchRemindOut.add(p.user_name);
    }
  } catch { /* notification_prefs / Spalte noch nicht vorhanden */ }

  let totalSent = 0;

  // Broadcast: einmal pro (Ereignis, Monat) an alle Abos außer Abgemeldete (class_id=0 = kein Kurs).
  async function broadcast(kind: string, notifyDate: string, optOut: Set<string>, payload: { title: string; body: string; url: string }): Promise<number> {
    const claim = await sql`
      INSERT INTO notification_log (class_id, notify_date, kind)
      VALUES (0, ${notifyDate}, ${kind})
      ON CONFLICT (class_id, notify_date, kind) DO NOTHING
      RETURNING id
    `;
    if (claim.length === 0) return 0;
    let sent = 0;
    for (const s of allSubs) {
      if (optOut.has(s.user_name)) continue;
      const r = await sendPush({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload);
      if (r.ok) sent++;
      else if (r.gone) await sql`DELETE FROM push_subscriptions WHERE endpoint = ${s.endpoint}`;
    }
    return sent;
  }

  // --- Gericht geöffnet (letzte 3 Tage des Monats), einmal pro Monat ---
  if (dayOfMonth >= daysInMonth - 2) {
    totalSent += await broadcast('court_open', `${ym}-01`, courtOpenOut, {
      title: '🗳️ Ausreden-Gericht offen',
      body: 'Die Ausreden des Monats können jetzt bewertet werden — stimme ab!',
      url: '/vote',
    });
  }

  // --- Gericht-Ergebnis (Monatsanfang, für den Vormonat), einmal ---
  if (dayOfMonth <= 3) {
    const pm = mo === 1 ? 12 : mo - 1;
    const py = mo === 1 ? yr - 1 : yr;
    const prevYm = `${py}-${String(pm).padStart(2, '0')}`;
    totalSent += await broadcast('court_result', `${prevYm}-01`, courtResultOut, {
      title: '⚖️ Gericht-Ergebnis',
      body: 'Die Ausreden vom letzten Monat sind ausgewertet — schau, ob dein Chicken-Punkt steht!',
      url: '/vote',
    });
  }

  // --- Per-User: „Nicht eingetragen / Ausrede-Frist"-Erinnerungen ---
  try {
    const winStart = addD(today, -3);
    const schedRows = (await sql`
      SELECT us.user_name, c.day_of_week::int AS dow, c.end_time
      FROM user_schedule us JOIN classes c ON c.id = us.class_id
    `) as { user_name: string; dow: number; end_time: string }[];
    const userDows = new Map<string, Set<number>>();
    const lastEnd = new Map<string, number>(); // `${user}|${dow}` → Minuten der spätesten geplanten Klasse
    for (const r of schedRows) {
      if (!userDows.has(r.user_name)) userDows.set(r.user_name, new Set());
      userDows.get(r.user_name)!.add(r.dow);
      const k = `${r.user_name}|${r.dow}`;
      lastEnd.set(k, Math.max(lastEnd.get(k) ?? 0, hmToMinutes(r.end_time)));
    }
    const presentRows = (await sql`
      SELECT a.user_name, (a.week_start + (c.day_of_week - 1) * INTERVAL '1 day')::date::text AS d
      FROM attendance a JOIN classes c ON c.id = a.class_id
      WHERE a.week_start >= ${weekStartOf(winStart)}::date
    `) as { user_name: string; d: string }[];
    const present = new Set(presentRows.map((r) => `${r.user_name}|${r.d}`));
    const skipRows = (await sql`
      SELECT user_name, date::text AS date, excuse FROM skipping
      WHERE date >= ${winStart}::date AND date <= ${today}::date
    `) as { user_name: string; date: string; excuse: string }[];
    const excused = new Set(skipRows.filter((s) => s.excuse !== '').map((s) => `${s.user_name}|${s.date}`));
    const statusRows = (await sql`
      SELECT user_name, start_date::text AS s, end_date::text AS e FROM user_status
      WHERE status_type IN ('sick', 'vacation') AND start_date <= ${today}::date AND end_date >= ${winStart}::date
    `) as { user_name: string; s: string; e: string }[];
    const exempt = (u: string, d: string) => statusRows.some((st) => st.user_name === u && d >= st.s && d <= st.e);

    const subUsers = [...new Set(allSubs.map((s) => s.user_name))];
    for (const user of subUsers) {
      if (bitchRemindOut.has(user)) continue;
      const dows = userDows.get(user);
      if (!dows) continue;
      for (let ds = 0; ds <= 3; ds++) {
        const D = addD(today, -ds);
        if (D < CUTOVER) continue;
        const dow = isoDayOfWeek(D);
        if (!dows.has(dow)) continue;
        if (isHoliday(D)) continue;
        if (exempt(user, D)) continue;
        if (present.has(`${user}|${D}`)) continue;     // war da → kein No-Show
        if (excused.has(`${user}|${D}`)) continue;      // Ausrede schon drin → keine Erinnerung
        // Zeitfenster: heute erst nach der letzten geplanten Klasse; Folgetage erst ab 10 Uhr.
        if (ds === 0) {
          if (nowMin < (lastEnd.get(`${user}|${dow}`) ?? 1440)) continue;
        } else if (nowMin < 600) {
          continue;
        }
        const claim = await sql`
          INSERT INTO user_notif_log (user_name, notify_date, kind)
          VALUES (${user}, ${today}, ${'bitch_' + D})
          ON CONFLICT (user_name, notify_date, kind) DO NOTHING
          RETURNING id
        `;
        if (claim.length === 0) continue;
        let title: string, body: string;
        if (ds === 0) { title = '🐔 Nicht eingetragen!'; body = 'Du warst heute bei keinem geplanten Kurs eingetragen. Warst du da? Dann eintragen! Sonst noch 3 Tage für deine Ausrede.'; }
        else if (ds === 1) { title = '🐔 Gestern verpasst'; body = 'Gestern nichts eingetragen — du hast noch 2 Tage, deine Ausrede einzutragen.'; }
        else if (ds === 2) { title = '⏳ Ausrede-Frist'; body = 'Noch 1 Tag, um deine Ausrede fürs Gericht einzutragen!'; }
        else { title = '⏳ Letzte Chance!'; body = 'Heute ist der letzte Tag, deine Ausrede einzutragen.'; }
        for (const s of allSubs) {
          if (s.user_name !== user) continue;
          const r = await sendPush({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, { title, body, url: '/' });
          if (r.ok) totalSent++;
          else if (r.gone) await sql`DELETE FROM push_subscriptions WHERE endpoint = ${s.endpoint}`;
        }
      }
    }
  } catch { /* user_notif_log / Spalten evtl. noch nicht vorhanden */ }

  // Harter Modus pro Gruppe: nur dort feuern die öffentlichen Shame-Mechaniken
  // (öffentliche No-Shows). Neue Crews starten entschärft.
  let hardSet = new Set<number>();
  try {
    const hg = (await sql`SELECT id FROM groups WHERE hard_mode = true`) as { id: number }[];
    hardSet = new Set(hg.map((g) => g.id));
  } catch { /* hard_mode-Spalte evtl. noch nicht da → alles entschärft behandeln */ }

  // --- Öffentliche No-Shows der Crew melden (Setup für die „Geschwänzt"-Broadcasts) ---
  // „Geschwänzt" = nicht da UND keine Ausrede eingetragen. Feiertage/krank/Urlaub
  // sind neutral. Nur in Crews im harten Modus.
  try {
    const LB = 28; // Tage zurückblicken (reicht für 3 Termine selbst bei 1×/Woche-Plänen)
    const since = addD(today, -LB);
    const sched = (await sql`
      SELECT us.user_name, c.day_of_week::int AS dow
      FROM user_schedule us JOIN classes c ON c.id = us.class_id
    `) as { user_name: string; dow: number }[];
    const dowsByUser = new Map<string, Set<number>>();
    for (const r of sched) {
      if (!dowsByUser.has(r.user_name)) dowsByUser.set(r.user_name, new Set());
      dowsByUser.get(r.user_name)!.add(r.dow);
    }
    // KW-Abweichungen (Wochenplan) — überschreiben pro (user, KW) den festen Plan.
    let wsAll: { user_name: string; w: string; dow: number }[] = [];
    try {
      wsAll = (await sql`
        SELECT ws.user_name, ws.week_start::text AS w, c.day_of_week::int AS dow
        FROM weekly_schedule ws JOIN classes c ON c.id = ws.class_id
      `) as { user_name: string; w: string; dow: number }[];
    } catch { /* Tabelle evtl. noch nicht da */ }
    const weekDowsByUser = new Map<string, Set<number>>();
    for (const r of wsAll) {
      const k = `${r.user_name}|${r.w}`;
      if (!weekDowsByUser.has(k)) weekDowsByUser.set(k, new Set());
      weekDowsByUser.get(k)!.add(r.dow);
    }
    const EMPTY_DOWS: Set<number> = new Set();
    const plannedDows = (u: string, dateStr: string): Set<number> =>
      weekDowsByUser.get(`${u}|${weekStartOf(dateStr)}`) ?? dowsByUser.get(u) ?? EMPTY_DOWS;
    const pres = (await sql`
      SELECT a.user_name, (a.week_start + (c.day_of_week - 1) * INTERVAL '1 day')::date::text AS d
      FROM attendance a JOIN classes c ON c.id = a.class_id
      WHERE a.week_start >= ${weekStartOf(since)}::date
    `) as { user_name: string; d: string }[];
    const presentSet = new Set(pres.map((r) => `${r.user_name}|${r.d}`));
    const sk = (await sql`
      SELECT user_name, date::text AS date, excuse FROM skipping
      WHERE date >= ${since}::date AND date <= ${today}::date
    `) as { user_name: string; date: string; excuse: string }[];
    const excusedSet = new Set(sk.filter((s) => s.excuse !== '').map((s) => `${s.user_name}|${s.date}`));
    const lstatus = (await sql`
      SELECT user_name, start_date::text AS s, end_date::text AS e FROM user_status
      WHERE status_type IN ('sick', 'vacation') AND start_date <= ${today}::date AND end_date >= ${since}::date
    `) as { user_name: string; s: string; e: string }[];
    const isExempt = (u: string, d: string) => lstatus.some((st) => st.user_name === u && d >= st.s && d <= st.e);

    // --- No-Show an die Gruppe melden (jüngster verpasster Trainingstag, einmal je Tag) ---
    const gmRows = (await sql`SELECT user_name, group_id FROM group_members WHERE status = 'active'`) as { user_name: string; group_id: number }[];
    const groupsByUser = new Map<string, number[]>();
    for (const r of gmRows) {
      if (!groupsByUser.has(r.user_name)) groupsByUser.set(r.user_name, []);
      groupsByUser.get(r.user_name)!.push(r.group_id);
    }
    for (const user of dowsByUser.keys()) {
      const groups = groupsByUser.get(user);
      if (!groups || groups.length === 0) continue;
      for (let ds = 1; ds <= 3; ds++) {
        const D = addD(today, -ds);
        if (D < CUTOVER) break;
        if (!plannedDows(user, D).has(isoDayOfWeek(D))) continue; // an dem Wochentag kein Training (KW-Plan)
        if (isHoliday(D)) continue;
        if (isExempt(user, D)) continue;
        // jüngsten realen Trainingstag gefunden → bewerten und stoppen
        if (!presentSet.has(`${user}|${D}`) && !excusedSet.has(`${user}|${D}`)) {
          for (const gid of groups) {
            if (!hardSet.has(gid)) continue; // öffentliche No-Shows nur im harten Modus
            await broadcastToGroup(sql, {
              groupId: gid, type: 'bitch', actor: user,
              body: `${user} hat ein Training geschwänzt 🐔`,
              link: '/statistik', reactable: false,
              dedupKey: `bitch|${gid}|${user}|${D}`,
              push: { title: '🐔 Geschwänzt', body: `${user} war nicht beim Training` },
            });
          }
        }
        break;
      }
    }
  } catch { /* Tabellen evtl. noch nicht vorhanden */ }

  // --- Wettkampf heute → Gruppe anfeuern ---
  try {
    const compRows = (await sql`
      SELECT id, user_name, name, location, group_id FROM competitions WHERE competition_date = ${today}
    `) as { id: number; user_name: string; name: string; location: string; group_id: number | null }[];
    for (const cmp of compRows) {
      const groupIds = cmp.group_id ? [cmp.group_id] : (await getMyGroups(cmp.user_name)).map((g) => g.id);
      const where = cmp.location ? ` in ${cmp.location}` : '';
      for (const gid of groupIds) {
        await broadcastToGroup(sql, {
          groupId: gid, type: 'competition', actor: cmp.user_name,
          body: `Heute: ${cmp.user_name} kämpft bei ${cmp.name}${where}`,
          link: '/competitions', reactable: true, excludeActor: false,
          dedupKey: `competition|${gid}|${cmp.id}`,
          push: { title: '🥊 Wettkampf heute!', body: `${cmp.user_name}: ${cmp.name}` },
        });
      }
    }
  } catch { /* competitions/feed evtl. nicht verfügbar */ }

  // An Feiertagen (NRW) keine KURS-Erinnerungen (Gericht-Pushes oben laufen trotzdem).
  const holiday = isHoliday(today);
  if (holiday) {
    return NextResponse.json({ ok: true, today, sent: totalSent, skipped: `Feiertag: ${holiday.name}` });
  }

  const isoDow = isoDayOfWeek(today);
  const weekStart = weekStartOf(today);

  // Alle Kurse, die heute (an diesem Wochentag) stattfinden.
  const classes = (await sql`
    SELECT id, name, start_time FROM classes WHERE day_of_week = ${isoDow}
  `) as ClassRow[];

  const summary: { class: string; start: string; attendees: number; sent: number }[] = [];

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
    const recipientSubs = allSubs.filter((s) => attendeeSet.has(s.user_name) && !classOut.has(s.user_name));
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
