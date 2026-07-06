// Test-/Dev-Account: ein einzelnes Konto zum Durchtesten aller Zustände.
// Ist users.is_test gesetzt, erzwingen die drei Berechnungs-Chokepoints feste
// Maximalwerte: Level 99 (getStreak → xp), Streak 500 Tage und alle Trophäen.
// Beim Aktivieren wird das Profil zusätzlich auf privat gestellt (Admin-Route).

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Sql = (strings: TemplateStringsArray, ...values: any[]) => Promise<any[]>;

export const TEST_LEVEL = 99;
export const TEST_STREAK_DAYS = 500;
export const TEST_STREAK_WEEKS = Math.floor(TEST_STREAK_DAYS / 7); // 71

export async function isTestAccount(sql: Sql, user: string): Promise<boolean> {
  try {
    const [row] = (await sql`SELECT is_test FROM users WHERE user_name = ${user}`) as { is_test: boolean }[];
    return row?.is_test === true;
  } catch {
    return false; // Spalte evtl. noch nicht angelegt
  }
}
