import { neon } from '@neondatabase/serverless';

// DSGVO-Helfer: vollständige Löschung + Datenauskunft (Export) eines Nutzers.
// Bewusst zentral, damit Self-Service (/api/account/*) und Admin dieselbe,
// vollständige Kaskade nutzen — sonst bleiben verwaiste personenbezogene Daten.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Sql = (strings: TemplateStringsArray, ...values: any[]) => Promise<any[]>;

export function getSql(): Sql {
  return neon(process.env.DATABASE_URL!) as unknown as Sql;
}

/**
 * DSGVO-Löschung: entfernt ALLE personenbezogenen Daten eines Nutzers restlos.
 * Reihenfolge: erst eigene/abhängige Zeilen, ganz zuletzt der users-Eintrag.
 * Gruppen bleiben bestehen (gehören evtl. anderen) — nur die Urheber-Spur wird entfernt.
 */
export async function deleteAllUserData(sql: Sql, userName: string): Promise<void> {
  await sql`DELETE FROM excuse_votes WHERE voter_name = ${userName}`;      // abgegebene Gericht-Stimmen
  await sql`DELETE FROM best_excuse_votes WHERE voter_name = ${userName}`;
  await sql`DELETE FROM skipping WHERE user_name = ${userName}`;           // eigene Ausreden (cascadet Votes darauf)
  await sql`DELETE FROM attendance WHERE user_name = ${userName}`;
  await sql`DELETE FROM competitions WHERE user_name = ${userName}`;
  await sql`DELETE FROM user_status WHERE user_name = ${userName}`;
  await sql`DELETE FROM user_schedule WHERE user_name = ${userName}`;
  await sql`DELETE FROM push_subscriptions WHERE user_name = ${userName}`;
  await sql`DELETE FROM notification_prefs WHERE user_name = ${userName}`;
  await sql`DELETE FROM user_notif_log WHERE user_name = ${userName}`;
  await sql`DELETE FROM title_votes WHERE voter_name = ${userName}`;
  await sql`DELETE FROM title_awards_seen WHERE user_name = ${userName}`;
  await sql`UPDATE monthly_titles SET winner = NULL WHERE winner = ${userName}`;
  await sql`DELETE FROM profile_comments WHERE profile_name = ${userName} OR author_name = ${userName}`;
  await sql`DELETE FROM skill_challenges WHERE profile_name = ${userName} OR challenger_name = ${userName}`;
  await sql`DELETE FROM notifications WHERE user_name = ${userName} OR actor = ${userName}`;
  await sql`DELETE FROM feed_reactions WHERE user_name = ${userName}`;      // eigene Reaktionen auf fremde Events
  await sql`DELETE FROM feed_events WHERE actor = ${userName}`;             // cascadet zugehörige Reaktionen
  await sql`DELETE FROM praises WHERE from_user = ${userName} OR to_user = ${userName}`;
  await sql`DELETE FROM streak_point_log WHERE user_name = ${userName}`;
  await sql`DELETE FROM badges_awarded WHERE user_name = ${userName}`;
  await sql`DELETE FROM wrapped_seen WHERE user_name = ${userName}`;
  // Chat + Freundschaften + Coach-Plan (best effort — Tabellen evtl. noch nicht angelegt).
  try { await sql`DELETE FROM messages WHERE user_name = ${userName}`; } catch {}
  try { await sql`DELETE FROM chat_reads WHERE user_name = ${userName}`; } catch {}
  try { await sql`DELETE FROM chat_blocks WHERE blocker = ${userName} OR blocked = ${userName}`; } catch {}
  try { await sql`DELETE FROM message_reports WHERE reporter = ${userName}`; } catch {}
  try { await sql`DELETE FROM friendships WHERE requester = ${userName} OR addressee = ${userName}`; } catch {}
  try { await sql`DELETE FROM coach_schedule WHERE user_name = ${userName}`; } catch {}
  await sql`DELETE FROM group_members WHERE user_name = ${userName}`;
  await sql`DELETE FROM auth_tokens WHERE user_name = ${userName}`;
  await sql`UPDATE groups SET created_by = NULL WHERE created_by = ${userName}`;
  await sql`DELETE FROM users WHERE user_name = ${userName}`;
}

/**
 * DSGVO-Auskunft: alle eigenen Daten als JSON-Objekt (ohne Passwort-Hash).
 */
export async function exportUserData(sql: Sql, userName: string): Promise<Record<string, unknown>> {
  const [
    user, attendance, skipping, excuseVotes, bestExcuseVotes, competitions,
    status, schedule, memberships, praisesGiven, praisesReceived, comments,
    notifications, badges,
  ] = await Promise.all([
    sql`SELECT user_name, created_at, email, email_verified, avatar, bio, color, martial_arts, skills, fighter_info,
        cosmetics, profile_visibility, streak_points, longest_streak, displayed_badges
        FROM users WHERE user_name = ${userName}`,
    sql`SELECT * FROM attendance WHERE user_name = ${userName}`,
    sql`SELECT * FROM skipping WHERE user_name = ${userName}`,
    sql`SELECT * FROM excuse_votes WHERE voter_name = ${userName}`,
    sql`SELECT * FROM best_excuse_votes WHERE voter_name = ${userName}`,
    sql`SELECT * FROM competitions WHERE user_name = ${userName}`,
    sql`SELECT * FROM user_status WHERE user_name = ${userName}`,
    sql`SELECT * FROM user_schedule WHERE user_name = ${userName}`,
    sql`SELECT * FROM group_members WHERE user_name = ${userName}`,
    sql`SELECT * FROM praises WHERE from_user = ${userName}`,
    sql`SELECT * FROM praises WHERE to_user = ${userName}`,
    sql`SELECT * FROM profile_comments WHERE profile_name = ${userName} OR author_name = ${userName}`,
    sql`SELECT * FROM notifications WHERE user_name = ${userName}`,
    sql`SELECT * FROM badges_awarded WHERE user_name = ${userName}`,
  ]);
  return {
    exported_at: new Date().toISOString(),
    user: user[0] ?? null,
    attendance,
    skipping,
    excuse_votes: excuseVotes,
    best_excuse_votes: bestExcuseVotes,
    competitions,
    user_status: status,
    user_schedule: schedule,
    group_members: memberships,
    praises_given: praisesGiven,
    praises_received: praisesReceived,
    profile_comments: comments,
    notifications,
    badges_awarded: badges,
  };
}
