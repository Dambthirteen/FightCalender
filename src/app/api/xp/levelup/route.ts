import { neon } from '@neondatabase/serverless';
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { computeXp, levelForXp, rankFor } from '@/lib/xp';
import { COSMETICS, type CosmeticCategory } from '@/lib/cosmetics';
import { createNotification } from '@/lib/notify';

export const runtime = 'nodejs'; // Cosmetic-Freischaltung verschickt Push

function getSql() {
  return neon(process.env.DATABASE_URL!);
}

/** Neu per Level freigeschaltete Cosmetics als Benachrichtigung melden (einmalig je Item). */
async function notifyNewCosmetics(sql: ReturnType<typeof getSql>, me: string, level: number): Promise<void> {
  try {
    const [cr] = (await sql`SELECT cosmetic_notified_level AS l FROM users WHERE user_name = ${me}`) as { l: number | null }[];
    const notified = cr?.l ?? null;
    if (notified === null) {
      // Basis setzen — kein Spam für bereits Freigeschaltetes.
      await sql`UPDATE users SET cosmetic_notified_level = ${level} WHERE user_name = ${me}`;
      return;
    }
    if (level <= notified) return;
    for (const catKey of Object.keys(COSMETICS) as CosmeticCategory[]) {
      const cat = COSMETICS[catKey];
      for (const item of cat.items) {
        if (item.sku) continue; // Premium/Supporter-Items lösen hier nichts aus
        if (item.minLevel > notified && item.minLevel <= level) {
          await createNotification(sql, {
            user: me, type: 'cosmetic', actor: me,
            body: `${cat.label} „${item.label}" · ab Level ${item.minLevel}`,
            link: '/spind',
            meta: { category: catKey, itemId: item.id, label: item.label, minLevel: item.minLevel },
            push: { title: '✨ Neues Design freigeschaltet', body: `${item.label} — im Spind ausrüsten` },
          });
        }
      }
    }
    await sql`UPDATE users SET cosmetic_notified_level = ${level} WHERE user_name = ${me}`;
  } catch { /* Spalte evtl. noch nicht angelegt */ }
}

/**
 * Prüft, ob der aktuelle Nutzer seit dem letzten Mal ein Level aufgestiegen ist.
 * Beim allerersten Mal wird das aktuelle Level als Basis gesetzt (kein Popup),
 * danach meldet jeder Anstieg leveledUp:true bis er per POST quittiert wird.
 */
export async function GET() {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ leveledUp: false });
  const sql = getSql();
  const { xp } = await computeXp(sql, me);
  const level = levelForXp(xp);

  await notifyNewCosmetics(sql, me, level);

  let seen: number | null = null;
  try {
    const [row] = (await sql`SELECT xp_level_seen FROM users WHERE user_name = ${me}`) as { xp_level_seen: number | null }[];
    seen = row?.xp_level_seen ?? null;
  } catch {
    return NextResponse.json({ leveledUp: false, level }); // Spalte evtl. noch nicht angelegt
  }

  if (seen === null) {
    // Basis still setzen — kein Popup für bereits vorhandenen Fortschritt.
    await sql`UPDATE users SET xp_level_seen = ${level} WHERE user_name = ${me}`;
    return NextResponse.json({ leveledUp: false, level });
  }
  if (level > seen) {
    return NextResponse.json({ leveledUp: true, from: seen, level, rank: rankFor(level) });
  }
  return NextResponse.json({ leveledUp: false, level });
}

/** Quittieren: aktuelles Level als gesehen markieren. */
export async function POST() {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const sql = getSql();
  const { xp } = await computeXp(sql, me);
  const level = levelForXp(xp);
  await sql`UPDATE users SET xp_level_seen = ${level} WHERE user_name = ${me}`;
  return NextResponse.json({ ok: true, level });
}
