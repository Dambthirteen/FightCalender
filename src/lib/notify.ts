import { ensurePushConfigured, sendPush } from './push';

/**
 * In-App-Benachrichtigung anlegen + (best effort) sofortige Web-Push an alle
 * Geräte des Empfängers. Routen, die das nutzen, müssen `runtime = 'nodejs'`
 * setzen (web-push braucht Node-Crypto).
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Sql = (strings: TemplateStringsArray, ...values: any[]) => Promise<any[]>;

export type NotifType = 'comment' | 'challenge' | 'challenge_result' | 'praise' | 'badge' | 'cosmetic' | 'join_request' | 'friend';

export async function createNotification(
  sql: Sql,
  opts: {
    user: string; // Empfänger
    type: NotifType;
    actor: string;
    body: string;
    link?: string;
    refId?: number; // z. B. praise.id für Ausstellen-Aktionen
    meta?: Record<string, unknown>; // z. B. { category, itemId } für Cosmetic-Vorschau
    push?: { title: string; body: string };
  }
): Promise<void> {
  // 1) In-App-Eintrag (immer). meta nur benennen, wenn gesetzt — so bricht nichts,
  // falls die Spalte auf einer Alt-DB noch fehlt (bestehende Notifs nutzen kein meta).
  if (opts.meta) {
    await sql`
      INSERT INTO notifications (user_name, type, actor, body, link, ref_id, meta)
      VALUES (${opts.user}, ${opts.type}, ${opts.actor}, ${opts.body}, ${opts.link ?? ''}, ${opts.refId ?? null}, ${JSON.stringify(opts.meta)}::jsonb)
    `;
  } else {
    await sql`
      INSERT INTO notifications (user_name, type, actor, body, link, ref_id)
      VALUES (${opts.user}, ${opts.type}, ${opts.actor}, ${opts.body}, ${opts.link ?? ''}, ${opts.refId ?? null})
    `;
  }

  // 2) Web-Push an alle Geräte (optional)
  if (!opts.push || !ensurePushConfigured()) return;
  try {
    const subs = (await sql`
      SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_name = ${opts.user}
    `) as { endpoint: string; p256dh: string; auth: string }[];
    for (const s of subs) {
      const r = await sendPush(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        { title: opts.push.title, body: opts.push.body, url: opts.link || '/benachrichtigungen' }
      );
      if (!r.ok && r.gone) await sql`DELETE FROM push_subscriptions WHERE endpoint = ${s.endpoint}`;
    }
  } catch { /* Push ist optional — In-App-Eintrag steht bereits */ }
}
