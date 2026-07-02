import { neon } from '@neondatabase/serverless';
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getCurrentGroupId, isHardMode, getGroupBundesland } from '@/lib/groups';
import { getCourtExcuses, pendingVoteCount } from '@/lib/court';
import { berlinNow } from '@/lib/berlin-time';

function getSql() {
  return neon(process.env.DATABASE_URL!);
}

/**
 * Wie viele Ausreden des laufenden Monats muss der eingeloggte Nutzer in seiner
 * aktuellen Gruppe noch bewerten? Treibt das Glühen/Wackeln des Gericht-Widgets.
 */
export async function GET() {
  try {
    const me = await getCurrentUser();
    if (!me) return NextResponse.json({ pending: 0 });
    const gid = await getCurrentGroupId(me);
    if (!gid) return NextResponse.json({ pending: 0 });
    if (!(await isHardMode(gid))) return NextResponse.json({ pending: 0 }); // Gericht aus → kein Glühen
    const sql = getSql();
    const monthStart = `${berlinNow().date.slice(0, 7)}-01`;
    const excuses = await getCourtExcuses(sql, monthStart, me, gid, await getGroupBundesland(gid));
    return NextResponse.json({ pending: pendingVoteCount(excuses, me) });
  } catch (error) {
    return NextResponse.json({ pending: 0, error: String(error) });
  }
}
