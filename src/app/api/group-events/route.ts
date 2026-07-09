import { neon } from '@neondatabase/serverless';
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getCurrentGroupId, getRole } from '@/lib/groups';
import { broadcastToGroup } from '@/lib/feed';

/**
 * Einmalige Sondertermine (Special-Tage, z. B. Seminare) einer Gruppe.
 * Anlegen/Löschen nur durch den Gruppen-Admin; sichtbar für alle im Kalender.
 */

export const runtime = 'nodejs'; // Broadcast beim Anlegen verschickt Push

function getSql() {
  return neon(process.env.DATABASE_URL!);
}

/** Kommende (+ diese Woche vergangene) Events der aktuellen Gruppe. */
export async function GET() {
  try {
    const me = await getCurrentUser();
    const gid = me ? await getCurrentGroupId(me) : null;
    if (!gid) return NextResponse.json([]);
    const sql = getSql();
    const rows = await sql`
      SELECT ge.id, ge.event_date::text AS date, ge.title, ge.note,
        COALESCE(array_agg(ea.user_name) FILTER (WHERE ea.user_name IS NOT NULL), '{}') AS attendees
      FROM group_events ge LEFT JOIN event_attendance ea ON ea.event_id = ge.id
      WHERE ge.group_id = ${gid} AND ge.event_date >= (CURRENT_DATE - INTERVAL '7 days')
      GROUP BY ge.id ORDER BY ge.event_date ASC
    `;
    return NextResponse.json(rows);
  } catch {
    return NextResponse.json([]); // Tabelle evtl. noch nicht angelegt
  }
}

export async function POST(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const gid = await getCurrentGroupId(me);
  if (!gid) return NextResponse.json({ error: 'Keine aktive Gruppe' }, { status: 400 });
  if ((await getRole(me, gid)) !== 'admin') return NextResponse.json({ error: 'Nur Admins' }, { status: 403 });

  const { date, title, note } = (await req.json().catch(() => ({}))) as { date?: string; title?: string; note?: string };
  const d = String(date ?? '').slice(0, 10);
  const t = String(title ?? '').trim().slice(0, 120);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || !t) return NextResponse.json({ error: 'Datum und Titel nötig.' }, { status: 400 });

  const sql = getSql();
  const ins = (await sql`
    INSERT INTO group_events (group_id, event_date, title, note, created_by)
    VALUES (${gid}, ${d}::date, ${t}, ${String(note ?? '').trim().slice(0, 500)}, ${me})
    RETURNING id, event_date::text AS date, title, note
  `) as { id: number; date: string; title: string; note: string }[];

  // Crew benachrichtigen (best effort).
  try {
    const dLabel = new Date(`${d}T12:00:00Z`).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' });
    await broadcastToGroup(sql, {
      groupId: gid, type: 'announcement', actor: me,
      body: `📣 Neuer Termin: ${t} — ${dLabel}`,
      link: '/',
      push: { title: '📣 Neuer Termin', body: `${t} · ${dLabel}` },
    });
  } catch { /* Broadcast optional */ }

  return NextResponse.json(ins[0]);
}

/** An-/Abmelden zu einem Sondertermin (jedes Gruppenmitglied). */
export async function PUT(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { eventId } = (await req.json().catch(() => ({}))) as { eventId?: number };
  if (!eventId) return NextResponse.json({ error: 'Missing eventId' }, { status: 400 });
  const sql = getSql();
  const ev = (await sql`SELECT group_id FROM group_events WHERE id = ${eventId}`) as { group_id: number }[];
  if (ev.length === 0) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 });
  if (!(await getRole(me, ev[0].group_id))) return NextResponse.json({ error: 'Kein Mitglied' }, { status: 403 });
  const existing = (await sql`SELECT 1 FROM event_attendance WHERE event_id = ${eventId} AND user_name = ${me}`) as unknown[];
  if (existing.length > 0) {
    await sql`DELETE FROM event_attendance WHERE event_id = ${eventId} AND user_name = ${me}`;
    return NextResponse.json({ attending: false });
  }
  await sql`INSERT INTO event_attendance (event_id, user_name) VALUES (${eventId}, ${me}) ON CONFLICT DO NOTHING`;
  return NextResponse.json({ attending: true });
}

export async function DELETE(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const gid = await getCurrentGroupId(me);
  if (!gid) return NextResponse.json({ error: 'Keine aktive Gruppe' }, { status: 400 });
  if ((await getRole(me, gid)) !== 'admin') return NextResponse.json({ error: 'Nur Admins' }, { status: 403 });
  const id = Number(req.nextUrl.searchParams.get('id'));
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  const sql = getSql();
  await sql`DELETE FROM group_events WHERE id = ${id} AND group_id = ${gid}`;
  return NextResponse.json({ ok: true });
}
