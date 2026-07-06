import { cookies } from 'next/headers';
import { neon } from '@neondatabase/serverless';
import { normalizeBundesland } from './holidays';

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
  hard_mode: boolean;
  bundesland: string;
  avatar: string | null;
  description: string;
}

/** Alle aktiven Gruppen des Nutzers. */
export async function getMyGroups(userName: string): Promise<MyGroup[]> {
  const sql = getSql();
  try {
    return (await sql`
      SELECT g.id, g.name, g.invite_code, g.clan_tag, g.hard_mode, g.bundesland, g.avatar, g.description, gm.role
      FROM group_members gm JOIN groups g ON g.id = gm.group_id
      WHERE gm.user_name = ${userName} AND gm.status = 'active'
      ORDER BY LOWER(g.name)
    `) as MyGroup[];
  } catch {
    // Nur avatar/description fehlen (DB Init nach dem Gruppen-Profil-Update noch nicht gelaufen)?
    // → clan_tag/hard_mode/bundesland trotzdem laden, damit z. B. der Clantag nicht verschwindet.
    try {
      const rows = await sql`
        SELECT g.id, g.name, g.invite_code, g.clan_tag, g.hard_mode, g.bundesland, gm.role
        FROM group_members gm JOIN groups g ON g.id = gm.group_id
        WHERE gm.user_name = ${userName} AND gm.status = 'active'
        ORDER BY LOWER(g.name)
      `;
      return rows.map((r) => ({ ...r, avatar: null, description: '' })) as MyGroup[];
    } catch {
      // Auch die älteren Spalten fehlen → nur das Nötigste laden.
      try {
        const rows = await sql`
          SELECT g.id, g.name, g.invite_code, gm.role
          FROM group_members gm JOIN groups g ON g.id = gm.group_id
          WHERE gm.user_name = ${userName} AND gm.status = 'active'
          ORDER BY LOWER(g.name)
        `;
        return rows.map((r) => ({ ...r, clan_tag: null, hard_mode: false, bundesland: 'NW', avatar: null, description: '' })) as MyGroup[];
      } catch {
        return []; // Tabellen evtl. noch nicht angelegt → App läuft ungescoped weiter
      }
    }
  }
}

/** Ist der harte Modus (öffentliche Shame-Mechaniken) in dieser Gruppe an? */
export async function isHardMode(groupId: number | null): Promise<boolean> {
  if (!groupId) return false;
  try {
    const sql = getSql();
    const rows = await sql`SELECT hard_mode FROM groups WHERE id = ${groupId}`;
    return !!rows[0]?.hard_mode;
  } catch {
    return false; // Spalte evtl. noch nicht da → entschärft (fail-safe) behandeln
  }
}

/** Bundesland einer Gruppe (für Feiertage). Default NW. */
export async function getGroupBundesland(groupId: number | null): Promise<string> {
  if (!groupId) return 'NW';
  try {
    const sql = getSql();
    const rows = await sql`SELECT bundesland FROM groups WHERE id = ${groupId}`;
    return normalizeBundesland(rows[0]?.bundesland as string | undefined);
  } catch {
    return 'NW'; // Spalte evtl. noch nicht da
  }
}

/** Bundesland des Nutzers = das seiner aktuellen Gruppe (für persönliche Wertung wie Streaks). */
export async function getUserBundesland(userName: string): Promise<string> {
  const gid = await getCurrentGroupId(userName);
  return getGroupBundesland(gid);
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

/** Gruppe endgültig löschen: alle gruppen-bezogenen Daten entfernen (Wettkämpfe bleiben
 *  als persönliche Historie erhalten). Nur nach Admin-Check aufrufen! */
export async function deleteGroup(groupId: number): Promise<void> {
  const sql = getSql();
  // Kurse zuerst → cascadet user_schedule / weekly_schedule / coach_schedule / attendance.
  await sql`DELETE FROM classes WHERE group_id = ${groupId}`;
  await sql`DELETE FROM skipping WHERE group_id = ${groupId}`;
  const safe = async (fn: () => Promise<unknown>) => { try { await fn(); } catch { /* Tabelle evtl. noch nicht angelegt */ } };
  await safe(() => sql`DELETE FROM best_excuse_votes WHERE group_id = ${groupId}`);
  await safe(() => sql`DELETE FROM monthly_titles WHERE group_id = ${groupId}`);
  await safe(() => sql`DELETE FROM title_votes WHERE group_id = ${groupId}`);
  await safe(() => sql`DELETE FROM title_awards_seen WHERE group_id = ${groupId}`);
  await safe(() => sql`DELETE FROM feed_events WHERE group_id = ${groupId}`); // cascadet feed_reactions
  await safe(() => sql`DELETE FROM message_reports WHERE message_id IN (SELECT id FROM messages WHERE group_id = ${groupId})`);
  await safe(() => sql`DELETE FROM messages WHERE group_id = ${groupId}`);
  await safe(() => sql`DELETE FROM chat_reads WHERE group_id = ${groupId}`);
  await safe(() => sql`DELETE FROM chat_push_throttle WHERE group_id = ${groupId}`);
  await sql`DELETE FROM group_members WHERE group_id = ${groupId}`;
  await sql`DELETE FROM groups WHERE id = ${groupId}`;
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

/** Harte Obergrenze: jeder darf höchstens so vielen Gruppen angehören. */
export const MAX_GROUPS = 3;

/** Anzahl Gruppen, denen der Nutzer angehört ODER beitreten möchte (active + pending). */
export async function countMyGroupMemberships(userName: string): Promise<number> {
  try {
    const sql = getSql();
    const rows = await sql`
      SELECT COUNT(*)::int AS n FROM group_members
      WHERE user_name = ${userName} AND status IN ('active', 'pending')
    `;
    return (rows[0]?.n as number) ?? 0;
  } catch {
    return 0;
  }
}

export function makeInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // ohne verwechselbare 0/O/1/I
  let s = '';
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}
