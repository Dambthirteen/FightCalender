import { neon } from '@neondatabase/serverless';
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { computeXp, levelForXp, rankFor } from '@/lib/xp';

function getSql() {
  return neon(process.env.DATABASE_URL!);
}

/**
 * Prüft, ob der aktuelle Nutzer seit dem letzten Mal ein Level aufgestiegen ist.
 * Beim allerersten Mal wird das aktuelle Level als Basis gesetzt (kein Popup),
 * danach meldet jeder Anstieg leveledUp:true bis er per POST quittiert wird.
 */
export async function GET() {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ leveledUp: false });
  const sql = getSql();
  const { xp } = await computeXp(sql, me);
  const level = levelForXp(xp);

  let seen: number | null = null;
  try {
    const [row] = (await sql`SELECT xp_level_seen FROM users WHERE user_name = ${me}`) as { xp_level_seen: number | null }[];
    seen = row?.xp_level_seen ?? null;
  } catch {
    return NextResponse.json({ leveledUp: false, level }); // Spalte evtl. noch nicht angelegt
  }

  if (seen === null) {
    // Basis still setzen — kein Popup für bereits vorhandenen Fortschritt.
    await sql`UPDATE users SET xp_level_seen = ${level} WHERE user_name = ${me}`;
    return NextResponse.json({ leveledUp: false, level });
  }
  if (level > seen) {
    return NextResponse.json({ leveledUp: true, from: seen, level, rank: rankFor(level) });
  }
  return NextResponse.json({ leveledUp: false, level });
}

/** Quittieren: aktuelles Level als gesehen markieren. */
export async function POST() {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const sql = getSql();
  const { xp } = await computeXp(sql, me);
  const level = levelForXp(xp);
  await sql`UPDATE users SET xp_level_seen = ${level} WHERE user_name = ${me}`;
  return NextResponse.json({ ok: true, level });
}
