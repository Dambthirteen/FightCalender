import { neon } from '@neondatabase/serverless';
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { canViewProfile } from '@/lib/groups';
import { computeXp, levelProgress, rankFor } from '@/lib/xp';

/** Level/XP einer Person (für Profil & Start). Respektiert die Profil-Sichtbarkeit. */
export async function GET(req: NextRequest) {
  const me = await getCurrentUser();
  const target = req.nextUrl.searchParams.get('user') || me;
  if (!target) return NextResponse.json({ error: 'Missing user' }, { status: 400 });

  if (target !== me && !(await canViewProfile(me, target))) {
    return NextResponse.json({ private: true });
  }

  const sql = neon(process.env.DATABASE_URL!);
  const { xp, breakdown } = await computeXp(sql, target);
  const p = levelProgress(xp);
  return NextResponse.json({ ...p, rank: rankFor(p.level), breakdown });
}
