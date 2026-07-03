import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { consumeToken } from '@/lib/auth-tokens';
import { isReferralPromoActive, grantEntitlement, hasSupporter, SKU_SUPPORTER, REFERRAL_TARGET } from '@/lib/entitlements';

/** E-Mail-Verifizierung: Token einlösen → email_verified = true. */
export async function POST(req: NextRequest) {
  try {
    const { token } = await req.json();
    const sql = neon(process.env.DATABASE_URL!);
    const user = await consumeToken(sql, 'verify', token);
    if (!user) return NextResponse.json({ error: 'Link ungültig oder abgelaufen.' }, { status: 400 });
    await sql`UPDATE users SET email_verified = true WHERE user_name = ${user}`;

    // Referral-Werbephase: der frisch verifizierte Geworbene zählt für seinen Werber.
    // Schläft ohne PROMO_REFERRAL_ACTIVE; blockiert die Verifizierung nie.
    if (isReferralPromoActive()) {
      try {
        const rows = (await sql`
          SELECT referred_by FROM users
          WHERE user_name = ${user} AND referred_by IS NOT NULL AND referral_credited = false
        `) as { referred_by: string }[];
        const referrer = rows[0]?.referred_by;
        if (referrer) {
          await sql`UPDATE users SET referral_credited = true WHERE user_name = ${user}`;
          const cnt = (await sql`
            SELECT COUNT(*)::int AS n FROM users
            WHERE referred_by = ${referrer} AND email_verified = true AND referral_credited = true
          `) as { n: number }[];
          if ((cnt[0]?.n ?? 0) >= REFERRAL_TARGET && !(await hasSupporter(referrer))) {
            await grantEntitlement(referrer, SKU_SUPPORTER, 'referral', { via: user });
          }
        }
      } catch { /* Referral optional */ }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
