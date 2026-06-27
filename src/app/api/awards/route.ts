import { neon } from '@neondatabase/serverless';
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getMyGroups } from '@/lib/groups';
import { resolveTitle, currentYm, ymPrev, KINDS } from '@/lib/awards';

function getSql() {
  return neon(process.env.DATABASE_URL!);
}

interface VoteItem { groupId: number; groupName: string; month: string; kind: string; candidates: string[]; }
interface CongratItem { groupId: number; groupName: string; month: string; kind: string; }

/**
 * Offene Auszeichnungen für den eingeloggten Nutzer im LETZTEN abgeschlossenen
 * Monat — über alle seine Gruppen:
 *  - votes:    Gleichstände, bei denen er noch nicht abgestimmt hat (Pflicht-Popup)
 *  - congrats: Titel, die er gewonnen hat und deren Popup er noch nicht gesehen hat
 */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ votes: [], congrats: [] });
    const sql = getSql();
    const ym = ymPrev(currentYm()); // letzter abgeschlossener Monat
    const groups = await getMyGroups(user);

    const votes: VoteItem[] = [];
    const congrats: CongratItem[] = [];

    for (const g of groups) {
      for (const kind of KINDS) {
        const st = await resolveTitle(sql, g.id, ym, kind);
        // Nur NICHT-Kandidaten stimmen ab — Betroffene entscheiden nicht über ihren eigenen Titel.
        if (st.status === 'voting' && !st.candidates.includes(user)) {
          const voted = await sql`
            SELECT 1 FROM title_votes
            WHERE group_id = ${g.id} AND month = ${ym} AND kind = ${kind} AND voter_name = ${user}
          `;
          if (voted.length === 0) {
            votes.push({ groupId: g.id, groupName: g.name, month: ym, kind, candidates: st.candidates });
          }
        } else if (st.status === 'final' && st.winner === user) {
          const seen = await sql`
            SELECT 1 FROM title_awards_seen
            WHERE group_id = ${g.id} AND user_name = ${user} AND award_month = ${ym} AND kind = ${kind}
          `;
          if (seen.length === 0) {
            congrats.push({ groupId: g.id, groupName: g.name, month: ym, kind });
          }
        }
      }
    }

    return NextResponse.json({ votes, congrats });
  } catch (error) {
    return NextResponse.json({ votes: [], congrats: [], error: String(error) });
  }
}
