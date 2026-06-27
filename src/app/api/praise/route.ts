import { neon } from '@neondatabase/serverless';
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { canViewProfile } from '@/lib/groups';
import { createNotification } from '@/lib/notify';
import { berlinNow, weekStartOf } from '@/lib/berlin-time';

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
    const label = kind === 'gigalob' ? '🌟 Gigalob' : '👏 Lob';
    await createNotification(sql, {
      user: to,
      type: 'praise',
      actor: me,
      body: `${me} hat dir ein ${label} gegeben!`,
      link: '/benachrichtigungen',
      refId: ins[0].id as number,
      push: { title: `${label} erhalten!`, body: `${me} findet: du hast es verdient.` },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
