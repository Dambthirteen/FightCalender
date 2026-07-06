import { neon } from '@neondatabase/serverless';
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { canViewProfile, getMyGroups } from '@/lib/groups';
import { hasSupporter } from '@/lib/entitlements';
import { broadcastToGroup } from '@/lib/feed';
import { berlinNow } from '@/lib/berlin-time';
import { isCoach } from '@/lib/fighter';

export const runtime = 'nodejs'; // Skilltree-Broadcast verschickt Push

function getSql() {
  return neon(process.env.DATABASE_URL!);
}

const STANCES = ['orthodox', 'southpaw', 'switch'];

/** Nur bekannte Fighter-Felder übernehmen + Werte begrenzen. */
function sanitizeFighterInfo(input: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const str = (v: unknown, n: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, n) : undefined);
  const numIn = (v: unknown, lo: number, hi: number) => {
    const x = Number(v);
    return Number.isFinite(x) && x >= lo && x <= hi ? Math.round(x) : undefined;
  };
  const set = (k: string, v: unknown) => { if (v !== undefined) out[k] = v; };

  set('role', typeof input.role === 'string' && ['fighter', 'coach', 'both'].includes(input.role) ? input.role : undefined);
  set('athlete', typeof input.athlete === 'string' && ['hobby', 'competitor'].includes(input.athlete) ? input.athlete : undefined); // Hobby vs. Wettkämpfer
  set('gender', typeof input.gender === 'string' && ['m', 'f', 'd'].includes(input.gender) ? input.gender : undefined);
  set('trainingSince', str(input.trainingSince, 7));            // 'YYYY-MM'
  set('coachingSince', str(input.coachingSince, 7));            // 'YYYY-MM' (Trainer seit)
  set('coachingArts', Array.isArray(input.coachingArts) ? input.coachingArts.filter((a) => typeof a === 'string').slice(0, 12) : undefined);
  set('licenses', str(input.licenses, 200));                   // Trainerlizenzen/Zertifikate
  set('weightKg', numIn(input.weightKg, 20, 300));
  set('heightCm', numIn(input.heightCm, 100, 250));
  set('stance', typeof input.stance === 'string' && STANCES.includes(input.stance) ? input.stance : undefined);
  set('nickname', str(input.nickname, 40));
  set('gym', str(input.gym, 60));
  set('instagram', str(input.instagram, 40)?.replace(/^@/, ''));
  set('goal', str(input.goal, 200));
  return out;
}

/** Profil-Daten (Bild, Bio, Farbe, Arten, Skills) — abhängig von der Sichtbarkeit. */
export async function GET(req: NextRequest) {
  const user = req.nextUrl.searchParams.get('user');
  if (!user) return NextResponse.json({ error: 'Missing user' }, { status: 400 });
  const me = await getCurrentUser();
  const sql = getSql();

  let row;
  try {
    row = (await sql`
      SELECT user_name, avatar, COALESCE(bio, '') AS bio, color,
             COALESCE(martial_arts, '[]'::jsonb) AS martial_arts,
             COALESCE(skills, '{}'::jsonb) AS skills,
             COALESCE(fighter_info, '{}'::jsonb) AS fighter_info,
             COALESCE(cosmetics, '{}'::jsonb) AS cosmetics,
             COALESCE(profile_visibility, 'public') AS profile_visibility, profile_visibility_group
      FROM users WHERE user_name = ${user}
    `)[0];
  } catch {
    // Neuere Spalten (fighter_info / Sichtbarkeit) evtl. noch nicht angelegt → ohne sie laden.
    row = (await sql`
      SELECT user_name, avatar, COALESCE(bio, '') AS bio, color,
             COALESCE(martial_arts, '[]'::jsonb) AS martial_arts,
             COALESCE(skills, '{}'::jsonb) AS skills
      FROM users WHERE user_name = ${user}
    `)[0];
  }
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const supporter = await hasSupporter(user);
  if (!(await canViewProfile(me, user))) {
    return NextResponse.json({ user_name: row.user_name, avatar: row.avatar, color: row.color, supporter, private: true });
  }
  return NextResponse.json({ ...row, supporter, private: false });
}

/** Eigenes Profil aktualisieren (nur gesetzte Felder). */
export async function POST(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const { avatar, bio, color, martial_arts, skills, fighter_info, profile_visibility, profile_visibility_group } = await req.json();
    const sql = getSql();
    if (avatar !== undefined) {
      if (avatar && String(avatar).length > 400_000) {
        return NextResponse.json({ error: 'Bild zu groß' }, { status: 400 });
      }
      await sql`UPDATE users SET avatar = ${avatar || null} WHERE user_name = ${me}`;
    }
    if (bio !== undefined) {
      await sql`UPDATE users SET bio = ${String(bio).slice(0, 300)} WHERE user_name = ${me}`;
    }
    if (color !== undefined) {
      await sql`UPDATE users SET color = ${color ? String(color).slice(0, 20) : null} WHERE user_name = ${me}`;
    }
    if (martial_arts !== undefined && Array.isArray(martial_arts)) {
      await sql`UPDATE users SET martial_arts = ${JSON.stringify(martial_arts.slice(0, 20))}::jsonb WHERE user_name = ${me}`;
    }
    if (skills !== undefined && typeof skills === 'object') {
      await sql`UPDATE users SET skills = ${JSON.stringify(skills)}::jsonb WHERE user_name = ${me}`;
      // Gruppe informieren (max. 1×/Tag je Gruppe, sonst spammt jeder Balken-Tipp).
      const today = berlinNow().date;
      for (const g of await getMyGroups(me)) {
        await broadcastToGroup(sql, {
          groupId: g.id, type: 'skilltree', actor: me,
          body: `${me} hat den Skilltree angepasst`,
          link: `/profil/${encodeURIComponent(me)}`,
          reactable: true,
          dedupKey: `skilltree|${g.id}|${me}|${today}`,
          push: { title: '🌳 Skilltree-Update', body: `${me} hat den Skilltree angepasst` },
        });
      }
    }
    if (fighter_info !== undefined && fighter_info && typeof fighter_info === 'object') {
      // Wird jemand NEU zum Coach? → einmaliger Feed-Eintrag in seinen Gruppen.
      const prev = (await sql`SELECT fighter_info->>'role' AS role FROM users WHERE user_name = ${me}`) as { role: string | null }[];
      const wasCoach = isCoach(prev[0]?.role);
      const clean = sanitizeFighterInfo(fighter_info);
      await sql`UPDATE users SET fighter_info = ${JSON.stringify(clean)}::jsonb WHERE user_name = ${me}`;
      if (!wasCoach && isCoach(clean.role as string | undefined)) {
        const today = berlinNow().date;
        for (const g of await getMyGroups(me)) {
          await broadcastToGroup(sql, {
            groupId: g.id, type: 'coach', actor: me,
            body: `${me} ist jetzt Coach in der Crew 🎓`,
            link: `/profil/${encodeURIComponent(me)}`,
            reactable: true,
            dedupKey: `coach|${g.id}|${me}|${today}`,
            push: { title: '🎓 Neuer Coach', body: `${me} ist jetzt Coach` },
          });
        }
      }
    }
    if (profile_visibility !== undefined) {
      const v = ['private', 'group', 'public'].includes(profile_visibility) ? profile_visibility : 'public';
      await sql`UPDATE users SET profile_visibility = ${v} WHERE user_name = ${me}`;
    }
    if (profile_visibility_group !== undefined) {
      await sql`UPDATE users SET profile_visibility_group = ${profile_visibility_group ? Number(profile_visibility_group) : null} WHERE user_name = ${me}`;
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
