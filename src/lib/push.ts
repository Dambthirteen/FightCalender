import webpush from 'web-push';

/**
 * Web-Push-Konfiguration (VAPID) + Versand-Helfer.
 *
 * Läuft nur im Node-Runtime (web-push nutzt Node-Crypto) — Routen, die das hier
 * importieren, müssen `export const runtime = 'nodejs'` setzen.
 */

// Form, in der wir ein Abo in der DB speichern (entspricht der Browser-PushSubscription).
export interface StoredSubscription {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

let configured = false;

/** VAPID einmalig konfigurieren. Gibt false zurück, wenn Schlüssel fehlen. */
export function ensurePushConfigured(): boolean {
  if (configured) return true;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return false;
  webpush.setVapidDetails('mailto:office@everyco.de', publicKey, privateKey);
  configured = true;
  return true;
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
}

export type SendResult =
  | { ok: true }
  | { ok: false; gone: boolean; error: string };

/**
 * Schickt eine Benachrichtigung an ein Abo.
 * `gone: true` bedeutet, das Abo ist tot (404/410) und sollte gelöscht werden.
 */
export async function sendPush(
  sub: StoredSubscription,
  payload: PushPayload
): Promise<SendResult> {
  try {
    await webpush.sendNotification(sub, JSON.stringify(payload));
    return { ok: true };
  } catch (err: unknown) {
    const statusCode =
      typeof err === 'object' && err !== null && 'statusCode' in err
        ? (err as { statusCode?: number }).statusCode
        : undefined;
    const gone = statusCode === 404 || statusCode === 410;
    return { ok: false, gone, error: String(err) };
  }
}
