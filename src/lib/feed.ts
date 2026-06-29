import { ensurePushConfigured, sendPush } from './push';

/**
 * Gruppen-Feed: ein soziales Ereignis an ALLE aktiven Mitglieder einer Gruppe
 * senden (In-App-Eintrag pro Person + best-effort Web-Push) und dabei ein
 * geteiltes feed_event anlegen, an dem Reaktionen (Daumen hoch) aggregiert werden.
 *
 * Nur im Node-Runtime nutzbar (web-push) → aufrufende Routen brauchen
 * `export const runtime = 'nodejs'`.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Sql = (strings: TemplateStringsArray, ...values: any[]) => Promise<any[]>;

export interface BroadcastOpts {
  groupId: number;
  type: string;                 // 'skilltree' | 'praise_feed' | 'competition' | 'bitch' | 'badge_feed'
  actor: string;                // Person, um die es geht
  body: string;
  link?: string;
  reactable?: boolean;          // nur „gute" Ereignisse → Daumen hoch
  excludeActor?: boolean;       // Default: true (Auslöser bekommt es nicht selbst)
  exclude?: string[];           // weitere Empfänger ausnehmen (z. B. der Gelobte)
  dedupKey?: string;            // wenn gesetzt: nur EINMAL (ON CONFLICT)
  push?: { title: string; body: string };
}

/** Sendet ein Ereignis an die Gruppe. Gibt die event_id zurück (oder null bei Dedup-Treffer). */
export async function broadcastToGroup(sql: Sql, o: BroadcastOpts): Promise<number | null> {
  // 1) Geteiltes Ereignis anlegen (mit optionaler Entdopplung).
  let eventId: number;
  if (o.dedupKey) {
    const ins = await sql`
      INSERT INTO feed_events (group_id, type, actor, reactable, dedup_key)
      VALUES (${o.groupId}, ${o.type}, ${o.actor}, ${o.reactable ?? false}, ${o.dedupKey})
      ON CONFLICT (dedup_key) DO NOTHING RETURNING id
    `;
    if (ins.length === 0) return null; // schon gesendet
    eventId = ins[0].id as number;
  } else {
    const ins = await sql`
      INSERT INTO feed_events (group_id, type, actor, reactable)
      VALUES (${o.groupId}, ${o.type}, ${o.actor}, ${o.reactable ?? false}) RETURNING id
    `;
    eventId = ins[0].id as number;
  }

  // 2) Empfänger = aktive Mitglieder (Auslöser standardmäßig ausgenommen).
  const members = (await sql`
    SELECT user_name FROM group_members WHERE group_id = ${o.groupId} AND status = 'active'
  `) as { user_name: string }[];
  const excludeActor = o.excludeActor !== false;
  const extra = new Set(o.exclude ?? []);
  const recipients = members.map((m) => m.user_name).filter((u) => !(excludeActor && u === o.actor) && !extra.has(u));
  if (recipients.length === 0) return eventId;

  // 3) In-App-Eintrag je Empfänger.
  for (const u of recipients) {
    await sql`
      INSERT INTO notifications (user_name, type, actor, body, link, event_id, reactable)
      VALUES (${u}, ${o.type}, ${o.actor}, ${o.body}, ${o.link ?? ''}, ${eventId}, ${o.reactable ?? false})
    `;
  }

  // 4) Web-Push (optional, best effort).
  if (o.push && ensurePushConfigured()) {
    try {
      const subs = (await sql`
        SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_name = ANY(${recipients})
      `) as { endpoint: string; p256dh: string; auth: string }[];
      for (const s of subs) {
        const r = await sendPush(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          { title: o.push.title, body: o.push.body, url: o.link || '/benachrichtigungen' }
        );
        if (!r.ok && r.gone) await sql`DELETE FROM push_subscriptions WHERE endpoint = ${s.endpoint}`;
      }
    } catch { /* Push optional */ }
  }
  return eventId;
}
