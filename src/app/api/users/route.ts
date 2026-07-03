import { neon } from '@neondatabase/serverless';
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getCurrentGroupId, getGroupBundesland } from '@/lib/groups';
import { getStreak } from '@/lib/streak';

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
    if (withAvatars) {
      // Mitgliederliste: Avatare + aktuelle Streak je Mitglied (getStreak wie im Profil).
      const rows = (await sql`
          SELECT u.user_name, u.color, u.avatar
          FROM group_members gm JOIN users u ON u.user_name = gm.user_name
          WHERE gm.group_id = ${gid} AND gm.status = 'active'
          ORDER BY LOWER(u.user_name)`) as { user_name: string; color: string | null; avatar: string | null }[];
      const bl = await getGroupBundesland(gid);
      const withStreak = await Promise.all(rows.map(async (u) => {
        let streak = 0;
        try { streak = (await getStreak(sql, u.user_name, bl)).days; } catch { /* Streak optional */ }
        return { ...u, streak };
      }));
      return NextResponse.json(withStreak);
    }
    const rows = await sql`
          SELECT u.user_name, u.color
          FROM group_members gm JOIN users u ON u.user_name = gm.user_name
          WHERE gm.group_id = ${gid} AND gm.status = 'active'
          ORDER BY LOWER(u.user_name)`;
    return NextResponse.json(rows);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
