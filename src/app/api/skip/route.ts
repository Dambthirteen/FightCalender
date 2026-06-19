import { neon } from '@neondatabase/serverless';
import { NextRequest, NextResponse } from 'next/server';
import { berlinNow } from '@/lib/berlin-time';

function getSql() {
  return neon(process.env.DATABASE_URL!);
}

export async function GET(req: NextRequest) {
  try {
    const sql = getSql();
    const week = req.nextUrl.searchParams.get('week');
    if (!week) return NextResponse.json({ error: 'Missing week param' }, { status: 400 });
    const rows = await sql`
      SELECT * FROM skipping
      WHERE date >= ${week}::date AND date < (${week}::date + INTERVAL '7 days')
    `;
    return NextResponse.json(rows);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const sql = getSql();
    const { date, userName, excuse } = await req.json();
    if (!date || !userName?.trim()) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }
    const existing = await sql`
      SELECT id FROM skipping WHERE date = ${date} AND user_name = ${userName.trim()}
    `;
    if (existing.length > 0) {
      // Toggle off — remove
      await sql`DELETE FROM skipping WHERE date = ${date} AND user_name = ${userName.trim()}`;
      return NextResponse.json({ skipping: false });
    } else {
      // Toggle on — require excuse
      if (!excuse?.trim()) {
        return NextResponse.json({ error: 'Begründung fehlt' }, { status: 400 });
      }
      // Neues Modell: Ausrede nur innerhalb von 3 Tagen nach dem verpassten Tag.
      const diff = Math.round((Date.parse(berlinNow().date) - Date.parse(date)) / 86400000);
      if (diff > 3) {
        return NextResponse.json({ error: 'Frist abgelaufen — Ausrede nur bis 3 Tage nach dem Tag möglich.' }, { status: 400 });
      }
      await sql`
        INSERT INTO skipping (date, user_name, excuse) VALUES (${date}, ${userName.trim()}, ${excuse.trim()})
      `;
      return NextResponse.json({ skipping: true });
    }
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
