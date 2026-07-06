import { neon } from '@neondatabase/serverless';
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { computeXp, levelForXp } from '@/lib/xp';
import { COSMETICS, minLevelFor, skuFor, type CosmeticCategory } from '@/lib/cosmetics';
import { isMonetizationActive, getEntitlements } from '@/lib/entitlements';

function getSql() {
  return neon(process.env.DATABASE_URL!);
}

/** Eigener Spind: aktuelles Level + equippte Cosmetics. */
export async function GET() {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const sql = getSql();
  const { xp } = await computeXp(sql, me);
  const level = levelForXp(xp);
  let cosmetics: Record<string, string> = {};
  let color: string | null = null;
  try {
    const [row] = (await sql`SELECT cosmetics, color FROM users WHERE user_name = ${me}`) as { cosmetics: Record<string, string> | null; color: string | null }[];
    cosmetics = row?.cosmetics ?? {};
    color = row?.color ?? null;
  } catch { /* Spalte evtl. noch nicht angelegt */ }
  const owned = await getEntitlements(me);
  return NextResponse.json({ level, cosmetics, color, owned: [...owned], monetization: isMonetizationActive() });
}

/** Ein Cosmetic ausrüsten (nur wenn per Level freigeschaltet). */
export async function POST(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { category, itemId } = (await req.json().catch(() => ({}))) as { category?: string; itemId?: string };
  if (!category || !itemId || !(category in COSMETICS)) {
    return NextResponse.json({ error: 'Ungültige Auswahl' }, { status: 400 });
  }
  const min = minLevelFor(category, itemId);
  if (min < 0) return NextResponse.json({ error: 'Unbekanntes Item' }, { status: 400 });

  const sql = getSql();
  const { xp } = await computeXp(sql, me);
  const level = levelForXp(xp);
  // Freischaltung: per Level ODER (Premium-Item + Besitz des Entitlements). Ein Supporter
  // darf seine Premium-Cosmetics IMMER nutzen — unabhängig vom Verkaufs-Flag.
  const sku = skuFor(category, itemId);
  let allowed = level >= min;
  if (!allowed && sku) {
    allowed = (await getEntitlements(me)).has(sku);
  }
  if (!allowed) {
    return sku
      ? NextResponse.json({ error: 'Nur für Supporter.', upsell: 'supporter' }, { status: 402 })
      : NextResponse.json({ error: `Erst ab Level ${min} freigeschaltet.` }, { status: 403 });
  }

  let current: Record<string, string> = {};
  try {
    const [row] = (await sql`SELECT cosmetics FROM users WHERE user_name = ${me}`) as { cosmetics: Record<string, string> | null }[];
    current = row?.cosmetics ?? {};
  } catch {
    return NextResponse.json({ error: 'Bitte zuerst DB Init ausführen.' }, { status: 500 });
  }
  const next = { ...current, [category as CosmeticCategory]: itemId };
  await sql`UPDATE users SET cosmetics = ${JSON.stringify(next)}::jsonb WHERE user_name = ${me}`;
  return NextResponse.json({ ok: true, cosmetics: next });
}
