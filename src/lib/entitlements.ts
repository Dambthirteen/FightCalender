import { neon } from '@neondatabase/serverless';

// Monetarisierungs-Backbone („Submit Plus"). Alles hier ist rein additiv und
// schläft, bis die Flags gesetzt werden — ohne MONETIZATION_ACTIVE verhält sich
// die App exakt wie ohne Monetarisierung (alles frei).
function getSql() {
  return neon(process.env.DATABASE_URL!);
}

/** Aktuelle SKUs. Bislang nur „Supporter" (einmaliger Lifetime-Unlock pro Account). */
export const SKU_SUPPORTER = 'supporter';

/** Quelle eines Entitlements. 'grandfather' = Bestandsnutzer beim Umstieg. */
export type EntitlementSource = 'purchase' | 'referral' | 'gift' | 'admin' | 'grandfather';

/**
 * Bezahl-/Cap-Pipelines scharf? Steuert Cosmetics-Gate, Crew-Cap und Checkout.
 * Aus (Default) = App wie heute, alles frei.
 */
export function isMonetizationActive(): boolean {
  return process.env.MONETIZATION_ACTIVE === '1';
}

/** Referral-Werbephase aktiv? („Lade 2 Freunde ein → Plus gratis") */
export function isReferralPromoActive(): boolean {
  return process.env.PROMO_REFERRAL_ACTIVE === '1';
}

/** Wie viele verifizierte Geworbene es für den kostenlosen Plus braucht. */
export const REFERRAL_TARGET = 2;

/** Alle freigeschalteten SKUs eines Nutzers. Leeres Set, falls Tabelle fehlt. */
export async function getEntitlements(userName: string): Promise<Set<string>> {
  try {
    const sql = getSql();
    const rows = (await sql`
      SELECT sku FROM user_entitlements WHERE user_name = ${userName}
    `) as { sku: string }[];
    return new Set(rows.map((r) => r.sku));
  } catch {
    return new Set(); // Tabelle evtl. noch nicht angelegt → wie „nichts freigeschaltet"
  }
}

/** Hat der Nutzer den „Supporter"-Status? */
export async function hasSupporter(userName: string): Promise<boolean> {
  return (await getEntitlements(userName)).has(SKU_SUPPORTER);
}

/**
 * Entitlement vergeben — idempotent über UNIQUE (user_name, sku).
 * Gibt `true` zurück, wenn NEU vergeben (für einmalige Effekte/Analytics),
 * `false`, wenn es den Unlock schon gab.
 */
export async function grantEntitlement(
  userName: string,
  sku: string,
  source: EntitlementSource,
  meta: Record<string, unknown> = {},
): Promise<boolean> {
  const sql = getSql();
  const rows = (await sql`
    INSERT INTO user_entitlements (user_name, sku, source, meta)
    VALUES (${userName}, ${sku}, ${source}, ${JSON.stringify(meta)}::jsonb)
    ON CONFLICT (user_name, sku) DO NOTHING
    RETURNING id
  `) as { id: number }[];
  return rows.length > 0;
}
