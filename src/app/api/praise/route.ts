import { neon } from '@neondatabase/serverless';
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { canViewProfile, getMyGroups } from '@/lib/groups';
import { createNotification } from '@/lib/notify';
import { broadcastToGroup } from '@/lib/feed';
import { berlinNow, weekStartOf } from '@/lib/berlin-time';
import { grantStreakPoint } from '@/lib/streak-points';

export const runtime = 'nodejs'; // POST verschickt Push

function getSql() {
  return neon(process.env.DATABASE_URL!);
}

/** Periode: Lob = Wochenstart-Datum, Gigalob = 'YYYY-MM'. */
function periodFor(kind: string): string {
  const today = berlinNow().date;
  return kind === 'gigalob' ? today.slice(0, 7) : weekStartOf(today);
}

/** Ausgestellte Lobe/Gigalobe eines Profils (Showcase). */
export async function GET(req: NextRequest) {
  try {
    const user = req.nextUrl.searchParams.get('user');
    if (!user) return NextResponse.json({ error: 'Missing user' }, { status: 400 });
    const me = await getCurrentUser();
    if (!(await canViewProfile(me, user))) return NextResponse.json([]);
    const sql = getSql();
    const rows = await sql`
      SELECT id, kind, from_user, reason, show_comment, created_at FROM praises
      WHERE to_user = ${user} AND displayed = true ORDER BY created_at DESC
    `;
    return NextResponse.json(rows);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

/** Lob (1×/Woche) bzw. Gigalob (1×/Monat) vergeben. */
export async function POST(req: NextRequest) {
  try {
    const me = await getCurrentUser();
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { to, kind, reason } = await req.json();
    if (!to || (kind !== 'lob' && kind !== 'gigalob')) return NextResponse.json({ error: 'Ungültig' }, { status: 400 });
    if (me === to) return NextResponse.json({ error: 'Nicht an dich selbst' }, { status: 400 });
    if (!(await canViewProfile(me, to))) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 });

    const sql = getSql();
    const period = periodFor(kind);
    // UNIQUE(from_user, kind, period) → bereits in dieser Periode vergeben?
    const ins = await sql`
      INSERT INTO praises (kind, from_user, to_user, reason, period)
      VALUES (${kind}, ${me}, ${to}, ${String(reason ?? '').slice(0, 300)}, ${period})
      ON CONFLICT (from_user, kind, period) DO NOTHING
      RETURNING id
    `;
    if (ins.length === 0) {
      return NextResponse.json(
        { error: kind === 'gigalob' ? 'Gigalob diesen Monat schon vergeben' : 'Lob diese Woche schon vergeben' },
        { status: 409 }
      );
    }
    const label = kind === 'gigalob' ? 'Gigalob' : 'Lob';
    const emoji = kind === 'gigalob' ? '🌟' : '👏';
    await createNotification(sql, {
      user: to,
      type: 'praise',
      actor: me,
      body: `${me} hat dir ein ${label} gegeben!`,
      link: '/benachrichtigungen',
      refId: ins[0].id as number,
      push: { title: `${emoji} ${label} erhalten!`, body: `${me} findet: du hast es verdient.` },
    });
    // Gruppe informieren: Namen (wer → wem) sind sichtbar. NUR die Begründung
    // bleibt verborgen, bis die gelobte Person das Lob im Profil ausstellt
    // (deshalb steht der `reason` NICHT im Broadcast). Geber + Empfänger nehmen
    // wir aus (Geber weiß es, Empfänger hat schon seine persönliche Nachricht).
    for (const g of await getMyGroups(to)) {
      await broadcastToGroup(sql, {
        groupId: g.id, type: 'praise_feed', actor: me, exclude: [to],
        body: `${me} hat ${to} ein ${label} gegeben`,
        link: `/profil/${encodeURIComponent(to)}`,
        reactable: true,
        push: { title: `${emoji} ${label}`, body: `${me} hat ${to} ein ${label} gegeben` },
      });
    }
    // Gigalob koppelt an die Streak-Ökonomie: Empfänger bekommt einen Streak-Punkt (gedeckelt).
    if (kind === 'gigalob') {
      await grantStreakPoint(sql, to, 'gigalob', String(ins[0].id));
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
