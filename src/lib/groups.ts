import { cookies } from 'next/headers';
import { neon } from '@neondatabase/serverless';

// Multi-Gruppen-Helfer: aktuelle Gruppe (Cookie), Mitgliedschaften, Rollen.
function getSql() {
  return neon(process.env.DATABASE_URL!);
}

export const GROUP_COOKIE = 'fightcal_group';

export interface MyGroup {
  id: number;
  name: string;
  invite_code: string;
  role: string;
  clan_tag: string | null;
}

/** Alle aktiven Gruppen des Nutzers. */
export async function getMyGroups(userName: string): Promise<MyGroup[]> {
  const sql = getSql();
  try {
    return (await sql`
      SELECT g.id, g.name, g.invite_code, g.clan_tag, gm.role
      FROM group_members gm JOIN groups g ON g.id = gm.group_id
      WHERE gm.user_name = ${userName} AND gm.status = 'active'
      ORDER BY LOWER(g.name)
    `) as MyGroup[];
  } catch {
    // clan_tag-Spalte evtl. noch nicht angelegt → ohne sie laden.
    try {
      const rows = await sql`
        SELECT g.id, g.name, g.invite_code, gm.role
        FROM group_members gm JOIN groups g ON g.id = gm.group_id
        WHERE gm.user_name = ${userName} AND gm.status = 'active'
        ORDER BY LOWER(g.name)
      `;
      return rows.map((r) => ({ ...r, clan_tag: null })) as MyGroup[];
    } catch {
      return []; // Tabellen evtl. noch nicht angelegt → App läuft ungescoped weiter
    }
  }
}

/** Aktuelle Gruppe = Cookie (falls Mitglied), sonst erste Gruppe. */
export async function getCurrentGroupId(userName: string): Promise<number | null> {
  const groups = await getMyGroups(userName);
  if (groups.length === 0) return null;
  const cookieStore = await cookies();
  const want = parseInt(cookieStore.get(GROUP_COOKIE)?.value ?? '');
  if (!Number.isNaN(want) && groups.some((g) => g.id === want)) return want;
  return groups[0].id;
}

/** Rolle des Nutzers in einer Gruppe ('admin' | 'member') oder null, wenn kein aktives Mitglied. */
export async function getRole(userName: string, groupId: number): Promise<string | null> {
  try {
    const sql = getSql();
    const rows = await sql`
      SELECT role FROM group_members
      WHERE user_name = ${userName} AND group_id = ${groupId} AND status = 'active'
    `;
    return (rows[0]?.role as string) ?? null;
  } catch {
    return null;
  }
}

/** Darf `viewer` das Profil von `target` sehen? (private | group | public) */
export async function canViewProfile(viewer: string | null, target: string): Promise<boolean> {
  if (!viewer) return false;
  if (viewer === target) return true;
  try {
    const sql = getSql();
    const u = await sql`SELECT profile_visibility AS v, profile_visibility_group AS g FROM users WHERE user_name = ${target}`;
    const vis = (u[0]?.v as string) ?? 'public';
    if (vis === 'public') return true;
    if (vis === 'private') return false;
    if (vis === 'group') {
      const gid = u[0]?.g as number | null;
      if (!gid) return false;
      const m = await sql`SELECT 1 FROM group_members WHERE group_id = ${gid} AND user_name = ${viewer} AND status = 'active'`;
      return m.length > 0;
    }
    return false;
  } catch {
    return true; // Spalten evtl. noch nicht angelegt → öffentlich behandeln
  }
}

export function makeInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // ohne verwechselbare 0/O/1/I
  let s = '';
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}
