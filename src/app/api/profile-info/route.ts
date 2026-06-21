import { neon } from '@neondatabase/serverless';
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';

function getSql() {
  return neon(process.env.DATABASE_URL!);
}

/** Profil-Daten eines Nutzers (Bild, Bio, Farbe). */
export async function GET(req: NextRequest) {
  const user = req.nextUrl.searchParams.get('user');
  if (!user) return NextResponse.json({ error: 'Missing user' }, { status: 400 });
  const sql = getSql();
  const rows = await sql`
    SELECT user_name, avatar, COALESCE(bio, '') AS bio, color,
           COALESCE(martial_arts, '[]'::jsonb) AS martial_arts,
           COALESCE(skills, '{}'::jsonb) AS skills
    FROM users WHERE user_name = ${user}
  `;
  if (rows.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(rows[0]);
}

/** Eigenes Profil aktualisieren (nur gesetzte Felder). */
export async function POST(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const { avatar, bio, color, martial_arts, skills } = await req.json();
    const sql = getSql();
    if (avatar !== undefined) {
      if (avatar && String(avatar).length > 400_000) {
        return NextResponse.json({ error: 'Bild zu groß' }, { status: 400 });
      }
      await sql`UPDATE users SET avatar = ${avatar || null} WHERE user_name = ${me}`;
    }
    if (bio !== undefined) {
      await sql`UPDATE users SET bio = ${String(bio).slice(0, 300)} WHERE user_name = ${me}`;
    }
    if (color !== undefined) {
      await sql`UPDATE users SET color = ${color ? String(color).slice(0, 20) : null} WHERE user_name = ${me}`;
    }
    if (martial_arts !== undefined && Array.isArray(martial_arts)) {
      await sql`UPDATE users SET martial_arts = ${JSON.stringify(martial_arts.slice(0, 20))}::jsonb WHERE user_name = ${me}`;
    }
    if (skills !== undefined && typeof skills === 'object') {
      await sql`UPDATE users SET skills = ${JSON.stringify(skills)}::jsonb WHERE user_name = ${me}`;
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
