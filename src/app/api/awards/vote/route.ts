import { neon } from '@neondatabase/serverless';
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getRole, isHardMode } from '@/lib/groups';
import { resolveTitle } from '@/lib/awards';

function getSql() {
  return neon(process.env.DATABASE_URL!);
}

/** Stimme bei einem Gleichstand abgeben (eine pro Nutzer/Gruppe/Monat/Art). */
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { groupId, month, kind, choice } = await req.json();
    if (!groupId || !month || (kind !== 'macher' && kind !== 'bitch') || !choice) {
      return NextResponse.json({ error: 'Ungültige Eingabe' }, { status: 400 });
    }
    // Nur Gruppenmitglieder dürfen über ihren Titel abstimmen.
    if (!(await getRole(user, Number(groupId)))) {
      return NextResponse.json({ error: 'Kein Mitglied dieser Gruppe' }, { status: 403 });
    }
    // Bitch-Titel gibt es nur im harten Modus (Macher-Titel bleibt immer erlaubt).
    if (kind === 'bitch' && !(await isHardMode(Number(groupId)))) {
      return NextResponse.json({ error: 'Bitch-Titel ist in dieser Gruppe deaktiviert' }, { status: 403 });
    }
    const sql = getSql();
    const st = await resolveTitle(sql, Number(groupId), month, kind);
    if (st.status !== 'voting') {
      return NextResponse.json({ ok: true, closed: true }); // bereits entschieden / kein Voting (mehr)
    }
    // Betroffene Kandidaten stimmen nicht über ihren eigenen Titel ab.
    if (st.candidates.includes(user)) {
      return NextResponse.json({ error: 'Kandidaten stimmen nicht mit ab' }, { status: 403 });
    }
    if (!st.candidates.includes(choice)) {
      return NextResponse.json({ error: 'Kandidat nicht gültig' }, { status: 400 });
    }
    await sql`
      INSERT INTO title_votes (group_id, month, kind, voter_name, choice)
      VALUES (${Number(groupId)}, ${month}, ${kind}, ${user}, ${choice})
      ON CONFLICT (group_id, month, kind, voter_name) DO NOTHING
    `;
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
