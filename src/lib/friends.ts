// Gegenseitige Freundschaften. Eine Zeile je Anfrage (requester → addressee);
// „Freund" = Zeile mit status 'accepted' in einer der beiden Richtungen.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Sql = (strings: TemplateStringsArray, ...values: any[]) => Promise<any[]>;

/** Namen aller bestätigten Freunde eines Nutzers. */
export async function friendsOf(sql: Sql, user: string): Promise<string[]> {
  try {
    const rows = (await sql`
      SELECT CASE WHEN requester = ${user} THEN addressee ELSE requester END AS friend
      FROM friendships
      WHERE status = 'accepted' AND (requester = ${user} OR addressee = ${user})
    `) as { friend: string }[];
    return rows.map((r) => r.friend);
  } catch {
    return []; // Tabelle evtl. noch nicht angelegt
  }
}

/** Vollständiger Freundschaftsgraph (nur bestätigt) — für den Cron. */
export async function loadFriendGraph(sql: Sql): Promise<Map<string, Set<string>>> {
  const m = new Map<string, Set<string>>();
  try {
    const rows = (await sql`SELECT requester, addressee FROM friendships WHERE status = 'accepted'`) as { requester: string; addressee: string }[];
    for (const r of rows) {
      if (!m.has(r.requester)) m.set(r.requester, new Set());
      if (!m.has(r.addressee)) m.set(r.addressee, new Set());
      m.get(r.requester)!.add(r.addressee);
      m.get(r.addressee)!.add(r.requester);
    }
  } catch { /* Tabelle evtl. noch nicht angelegt */ }
  return m;
}
