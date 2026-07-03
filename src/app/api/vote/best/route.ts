import { neon } from '@neondatabase/serverless';
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { isHardMode, getRole } from '@/lib/groups';

function getSql() { return neon(process.env.DATABASE_URL!); }

/**
 * „Beste Ausrede des Monats"-Vote. Jeder darf pro Gruppe/Monat genau EINE Ausrede
 * wählen (nicht die eigene). Meinung ändern = erst abwählen (unset), dann neu setzen.
 * Monat und Gruppe werden aus dem gewählten Skip abgeleitet.
 */
export async function POST(req: NextRequest) {
  try {
    const sql = getSql();
    const me = await getCurrentUser();
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { skipId, action } = await req.json();
    if (!skipId || !['set', 'unset'].includes(action)) {
      return NextResponse.json({ error: 'Invalid data' }, { status: 400 });
    }

    const skip = await sql`SELECT user_name, group_id, date::text AS date FROM skipping WHERE id = ${skipId}`;
    if (!skip[0]) return NextResponse.json({ error: 'Skip not found' }, { status: 404 });
    const { user_name: owner, group_id: groupId, date } = skip[0];
    // Nur Mitglieder der Gruppe dürfen wählen — und immer als sie selbst.
    if (!(await getRole(me, groupId))) {
      return NextResponse.json({ error: 'Kein Mitglied dieser Gruppe' }, { status: 403 });
    }
    if (!(await isHardMode(groupId))) {
      return NextResponse.json({ error: 'Gericht ist in dieser Gruppe deaktiviert' }, { status: 403 });
    }
    const month = (date as string).slice(0, 7);

    if (action === 'unset') {
      await sql`
        DELETE FROM best_excuse_votes
        WHERE voter_name = ${me} AND group_id = ${groupId} AND month = ${month} AND skip_id = ${skipId}
      `;
      return NextResponse.json({ ok: true });
    }

    // action === 'set'
    if (owner === me) {
      return NextResponse.json({ error: 'Cannot pick your own excuse' }, { status: 403 });
    }
    const existing = await sql`
      SELECT skip_id FROM best_excuse_votes
      WHERE voter_name = ${me} AND group_id = ${groupId} AND month = ${month}
    `;
    if (existing[0] && existing[0].skip_id !== skipId) {
      return NextResponse.json(
        { error: 'already_picked', message: 'Du hast schon eine beste Ausrede gewählt – erst abwählen.' },
        { status: 409 }
      );
    }
    await sql`
      INSERT INTO best_excuse_votes (skip_id, voter_name, group_id, month)
      VALUES (${skipId}, ${me}, ${groupId}, ${month})
      ON CONFLICT (voter_name, group_id, month) DO NOTHING
    `;
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
