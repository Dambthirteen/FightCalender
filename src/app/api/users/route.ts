import { neon } from '@neondatabase/serverless';
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';

function getSql() {
  return neon(process.env.DATABASE_URL!);
}

/** Liste aller Mitglieder (für eingeloggte Nutzer). */
export async function GET(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const sql = getSql();
    // Avatare (base64) nur auf Anfrage mitliefern (für die Mitgliederliste) — hält den Kalender-Aufruf leicht.
    const withAvatars = req.nextUrl.searchParams.get('avatars') === '1';
    const rows = withAvatars
      ? await sql`SELECT user_name, color, avatar FROM users ORDER BY LOWER(user_name)`
      : await sql`SELECT user_name, color FROM users ORDER BY LOWER(user_name)`;
    return NextResponse.json(rows);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
