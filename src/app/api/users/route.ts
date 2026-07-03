import { neon } from '@neondatabase/serverless';
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getCurrentGroupId } from '@/lib/groups';

function getSql() {
  return neon(process.env.DATABASE_URL!);
}

/** Mitglieder der AKTUELLEN Gruppe (für eingeloggte Nutzer). Ohne Gruppe → leer. */
export async function GET(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const gid = await getCurrentGroupId(me);
    if (!gid) return NextResponse.json([]); // keine Gruppe → keine Mitglieder (nicht alle!)
    const sql = getSql();
    // Avatare (base64) nur auf Anfrage mitliefern (für die Mitgliederliste) — hält den Kalender-Aufruf leicht.
    const withAvatars = req.nextUrl.searchParams.get('avatars') === '1';
    const rows = withAvatars
      ? await sql`
          SELECT u.user_name, u.color, u.avatar
          FROM group_members gm JOIN users u ON u.user_name = gm.user_name
          WHERE gm.group_id = ${gid} AND gm.status = 'active'
          ORDER BY LOWER(u.user_name)`
      : await sql`
          SELECT u.user_name, u.color
          FROM group_members gm JOIN users u ON u.user_name = gm.user_name
          WHERE gm.group_id = ${gid} AND gm.status = 'active'
          ORDER BY LOWER(u.user_name)`;
    return NextResponse.json(rows);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
