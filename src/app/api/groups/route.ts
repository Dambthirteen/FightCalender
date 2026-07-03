import { neon } from '@neondatabase/serverless';
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getMyGroups, getCurrentGroupId, getRole, makeInviteCode, GROUP_COOKIE } from '@/lib/groups';
import { hasPlus, isMonetizationActive } from '@/lib/entitlements';
import { normalizeBundesland } from '@/lib/holidays';

function getSql() {
  return neon(process.env.DATABASE_URL!);
}

/** Meine Gruppen + aktuelle Gruppe. */
export async function GET() {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const groups = await getMyGroups(me);
  const current = await getCurrentGroupId(me);
  return NextResponse.json({ groups, current });
}

/** Neue Gruppe erstellen → Ersteller wird Admin, wird zur aktuellen Gruppe. */
export async function POST(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { name } = await req.json();
  if (!name || !String(name).trim()) return NextResponse.json({ error: 'Name fehlt' }, { status: 400 });

  const sql = getSql();

  // Multi-Crew-Cap (schläft ohne MONETIZATION_ACTIVE): Non-Plus dürfen genau 1 eigene Crew
  // gründen. Nur Erstellen wird gedeckelt — Beitreten bleibt frei. Bestehende Crews bleiben.
  if (isMonetizationActive() && !(await hasPlus(me))) {
    const owned = (await sql`
      SELECT COUNT(*)::int AS n FROM group_members
      WHERE user_name = ${me} AND role = 'admin' AND status = 'active'
    `) as { n: number }[];
    if ((owned[0]?.n ?? 0) >= 1) {
      return NextResponse.json(
        { error: 'Mit Tap In Plus kannst du weitere eigene Crews gründen.', upsell: 'plus', reason: 'multi_crew' },
        { status: 402 },
      );
    }
  }

  let code = makeInviteCode();
  for (let i = 0; i < 6; i++) {
    const ex = await sql`SELECT 1 FROM groups WHERE invite_code = ${code}`;
    if (ex.length === 0) break;
    code = makeInviteCode();
  }
  const rows = await sql`
    INSERT INTO groups (name, invite_code, created_by)
    VALUES (${String(name).trim().slice(0, 100)}, ${code}, ${me}) RETURNING id
  `;
  const gid = rows[0].id as number;
  await sql`INSERT INTO group_members (group_id, user_name, role, status) VALUES (${gid}, ${me}, 'admin', 'active')`;

  const res = NextResponse.json({ ok: true, id: gid, invite_code: code });
  res.cookies.set(GROUP_COOKIE, String(gid), { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' });
  return res;
}

/** Gruppen-Einstellungen ändern (Clantag / harter Modus) — nur Admin der Gruppe. */
export async function PATCH(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { groupId, clanTag, hardMode, bundesland } = await req.json();
  const gid = Number(groupId);
  if (!gid) return NextResponse.json({ error: 'Gruppe fehlt' }, { status: 400 });
  if ((await getRole(me, gid)) !== 'admin') return NextResponse.json({ error: 'Nur Admins' }, { status: 403 });

  const sql = getSql();

  // Harter Modus: schaltet die öffentlichen Shame-Mechaniken für die ganze Crew frei.
  if (typeof hardMode === 'boolean') {
    await sql`UPDATE groups SET hard_mode = ${hardMode} WHERE id = ${gid}`;
    return NextResponse.json({ ok: true, hardMode });
  }

  // Bundesland (für Feiertage in der Wertung).
  if (typeof bundesland === 'string') {
    const bl = normalizeBundesland(bundesland);
    await sql`UPDATE groups SET bundesland = ${bl} WHERE id = ${gid}`;
    return NextResponse.json({ ok: true, bundesland: bl });
  }

  const tag = String(clanTag ?? '').replace(/[^A-Za-z]/g, '').toUpperCase().slice(0, 4);
  await sql`UPDATE groups SET clan_tag = ${tag || null} WHERE id = ${gid}`;
  return NextResponse.json({ ok: true, clanTag: tag });
}
