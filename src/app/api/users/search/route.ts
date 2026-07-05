import { neon } from '@neondatabase/serverless';
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';

function getSql() { return neon(process.env.DATABASE_URL!); }

/**
 * Öffentliche Profile per Namen suchen (für den „Alle"-Tab der Mitglieder).
 * Nur Profile mit profile_visibility = 'public'. Bewusst NICHT „alle auflisten" —
 * nur Treffer zur Suchanfrage (max 15), Prefix-Treffer zuerst.
 */
export async function GET(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const q = (req.nextUrl.searchParams.get('q') ?? '').trim();
  if (q.length < 1) return NextResponse.json([]);
  // %/_ neutralisieren, damit sie nicht als Platzhalter wirken.
  const safe = q.replace(/[%_\\]/g, '\\$&');
  try {
    const sql = getSql();
    const rows = await sql`
      SELECT user_name, avatar, color
      FROM users
      WHERE COALESCE(profile_visibility, 'public') = 'public'
        AND user_name ILIKE ${'%' + safe + '%'} ESCAPE '\\'
      ORDER BY (user_name ILIKE ${safe + '%'} ESCAPE '\\') DESC, LOWER(user_name)
      LIMIT 15
    `;
    return NextResponse.json(rows);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
