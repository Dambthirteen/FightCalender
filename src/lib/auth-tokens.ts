import { randomBytes } from 'crypto';

// Einmal-Tokens für E-Mail-Verifizierung und Passwort-Reset (Tabelle auth_tokens).

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Sql = (strings: TemplateStringsArray, ...values: any[]) => Promise<any[]>;

export type TokenKind = 'verify' | 'reset';

/** Erzeugt ein neues Token mit Ablaufzeit (Minuten) und gibt es zurück. */
export async function createToken(sql: Sql, userName: string, kind: TokenKind, ttlMinutes: number): Promise<string> {
  const token = randomBytes(32).toString('hex'); // 64 Hex-Zeichen
  await sql`
    INSERT INTO auth_tokens (user_name, kind, token, expires_at)
    VALUES (${userName}, ${kind}, ${token}, NOW() + (${ttlMinutes} * INTERVAL '1 minute'))
  `;
  return token;
}

/**
 * Löst ein Token atomar ein: markiert es als benutzt und gibt den user_name zurück,
 * nur wenn es gültig, unbenutzt und nicht abgelaufen ist (sonst null).
 */
export async function consumeToken(sql: Sql, kind: TokenKind, token: string): Promise<string | null> {
  if (!token || typeof token !== 'string') return null;
  const rows = await sql`
    UPDATE auth_tokens SET used_at = NOW()
    WHERE token = ${token} AND kind = ${kind} AND used_at IS NULL AND expires_at > NOW()
    RETURNING user_name
  `;
  return (rows[0]?.user_name as string) ?? null;
}
