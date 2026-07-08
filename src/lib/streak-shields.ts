import { getStreak } from './streak';
import { createNotification } from './notify';
import { SHIELD_STREAK_BADGES } from './badges';

/**
 * Streak-Schilde: automatischer Schutz aus Streak-Meilensteinen.
 *  - Verdienen: jeder zweite Streak-Meilenstein (SHIELD_STREAK_BADGES: 3/8/26 Wo) verleiht 1× ein Schild.
 *  - Vorrat: höchstens 1 (users.streak_shields) — kein Horten.
 *  - Einlösen: vollautomatisch, sobald ein geplantes Training die Streak bräche. Ein Schild deckt
 *    ein 3-Tage-Fenster ab (der Fehltag + die 2 Tage davor), gespeichert in streak_shield_use;
 *    getStreak wertet dieses Fenster als neutral. So bleibt die Streak trotz Fehltag erhalten.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Sql = (strings: TemplateStringsArray, ...values: any[]) => Promise<any[]>;

export const SHIELD_CAP = 1;         // höchstens so viele horten
export const SHIELD_WINDOW_DAYS = 3; // ein Schild schützt ein 3-Tage-Fenster

function addDaysStr(dateStr: string, n: number): string {
  const d = new Date(`${dateStr}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Verleiht für erreichte Schild-Meilensteine je genau einmal ein Schild (gedeckelt auf SHIELD_CAP). */
export async function grantStreakShields(sql: Sql, user: string, weeks: number): Promise<void> {
  for (const b of SHIELD_STREAK_BADGES) {
    if (weeks < b.threshold) continue;
    const ins = await sql`
      INSERT INTO streak_shield_log (user_name, ref) VALUES (${user}, ${b.id})
      ON CONFLICT (user_name, ref) DO NOTHING RETURNING id
    `;
    if (ins.length === 0) continue; // dieser Meilenstein hat schon ein Schild verliehen
    await sql`UPDATE users SET streak_shields = LEAST(${SHIELD_CAP}, streak_shields + 1) WHERE user_name = ${user}`;
  }
}

/**
 * Löst automatisch ein Schild ein, wenn die Streak gerade an einem verpassten Training bricht
 * (`blockedAt`) und ein Schild vorrätig ist: legt ein 3-Tage-Schutzfenster an, zieht das Schild ab
 * und benachrichtigt. Gibt true zurück, wenn ein Schild eingelöst wurde (Caller sollte dann neu rechnen).
 */
export async function consumeShieldIfNeeded(sql: Sql, user: string, blockedAt: string | null): Promise<boolean> {
  if (!blockedAt) return false; // aktuell kein bestätigter Bruch → Schild bleibt in Reserve
  const rows = (await sql`SELECT streak_shields FROM users WHERE user_name = ${user}`) as { streak_shields: number }[];
  if ((rows[0]?.streak_shields ?? 0) <= 0) return false;

  const from = addDaysStr(blockedAt, -(SHIELD_WINDOW_DAYS - 1));
  const ins = await sql`
    INSERT INTO streak_shield_use (user_name, from_date, until_date) VALUES (${user}, ${from}, ${blockedAt})
    ON CONFLICT (user_name, until_date) DO NOTHING RETURNING id
  `;
  if (ins.length === 0) return false; // Race: dieser Tag ist schon geschützt
  await sql`UPDATE users SET streak_shields = GREATEST(0, streak_shields - 1) WHERE user_name = ${user}`;

  await createNotification(sql, {
    user,
    type: 'badge',
    actor: user,
    body: '🛡️ Dein Streak-Schild hat deine Streak gerettet — du hast ein Training verpasst, aber die Streak läuft weiter.',
    link: '/start',
    push: { title: '🛡️ Streak gerettet', body: 'Dein Schild hat deine Streak geschützt.' },
  });
  return true;
}

/**
 * Bequemer Rundumschlag für die eigene Streak-Aktualisierung: Schild verdienen (aus Wochen),
 * bei Bruch automatisch einlösen und danach ggf. neu rechnen. Gibt die endgültige Streak zurück.
 */
export async function refreshShields(
  sql: Sql,
  user: string,
  bundesland: string,
  streak: { days: number; weeks: number; blockedAt: string | null },
): Promise<{ days: number; weeks: number; blockedAt: string | null }> {
  try {
    await grantStreakShields(sql, user, streak.weeks);
    const used = await consumeShieldIfNeeded(sql, user, streak.blockedAt);
    if (used) return await getStreak(sql, user, bundesland); // Schutz greift → Streak neu berechnen
  } catch { /* Schild-Tabellen evtl. noch nicht angelegt → Streak unverändert */ }
  return streak;
}
