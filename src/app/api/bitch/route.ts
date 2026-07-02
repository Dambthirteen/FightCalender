import { neon } from '@neondatabase/serverless';
import { NextRequest, NextResponse } from 'next/server';
import { getBitchCounts } from '@/lib/bitch-scoring';
import { berlinNow } from '@/lib/berlin-time';
import { getCurrentUser } from '@/lib/auth';
import { getCurrentGroupId, isHardMode } from '@/lib/groups';

function getSql() {
  return neon(process.env.DATABASE_URL!);
}

function nextMonthStart(monthStart: string): string {
  const [y, m] = monthStart.split('-').map(Number);
  const ny = m === 12 ? y + 1 : y;
  const nm = m === 12 ? 1 : m + 1;
  return `${ny}-${String(nm).padStart(2, '0')}-01`;
}

export async function GET(req: NextRequest) {
  try {
    const sql = getSql();
    const me = await getCurrentUser();
    const gid = me ? await getCurrentGroupId(me) : null;
    if (!gid) return NextResponse.json([]); // alles gruppenbasiert: ohne Gruppe nichts
    if (!(await isHardMode(gid))) return NextResponse.json([]); // Bitch-Liste nur im harten Modus
    const monthParam = req.nextUrl.searchParams.get('month'); // "2026-06"
    const monthStr = monthParam ?? berlinNow().date.slice(0, 7);
    const monthStart = `${monthStr}-01`;

    const counts = await getBitchCounts(sql, monthStart, nextMonthStart(monthStart), gid);
    // beide Feldnamen mitliefern (Seiten nutzen teils skip_count, teils bitch_count)
    return NextResponse.json(
      counts.map((c) => ({ user_name: c.user_name, bitch_count: c.count, skip_count: c.count }))
    );
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
