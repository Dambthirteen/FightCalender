import { neon } from '@neondatabase/serverless';
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { berlinNow, weekStartOf } from '@/lib/berlin-time';

function getSql() {
  return neon(process.env.DATABASE_URL!);
}

/** Hat der eingeloggte Nutzer sein Lob (Woche) / Gigalob (Monat) noch frei? */
export async function GET() {
  try {
    const me = await getCurrentUser();
    if (!me) return NextResponse.json({ lob: false, gigalob: false });
    const sql = getSql();
    const today = berlinNow().date;
    const week = weekStartOf(today);
    const month = today.slice(0, 7);
    const rows = (await sql`
      SELECT kind FROM praises
      WHERE from_user = ${me} AND (
        (kind = 'lob' AND period = ${week}) OR (kind = 'gigalob' AND period = ${month})
      )
    `) as { kind: string }[];
    return NextResponse.json({
      lob: !rows.some((r) => r.kind === 'lob'),
      gigalob: !rows.some((r) => r.kind === 'gigalob'),
    });
  } catch (error) {
    return NextResponse.json({ lob: false, gigalob: false, error: String(error) });
  }
}
