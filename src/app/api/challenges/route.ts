import { neon } from '@neondatabase/serverless';
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { canViewProfile } from '@/lib/groups';
import { createNotification } from '@/lib/notify';
import { SKILLS } from '@/lib/fighter';

export const runtime = 'nodejs'; // POST verschickt Push

function getSql() {
  return neon(process.env.DATABASE_URL!);
}
const SKILL_KEYS = new Set<string>(SKILLS.map((s) => s.key));

/** Offene Anfechtungen eines Profils. */
export async function GET(req: NextRequest) {
  try {
    const user = req.nextUrl.searchParams.get('user');
    if (!user) return NextResponse.json({ error: 'Missing user' }, { status: 400 });
    const me = await getCurrentUser();
    if (!(await canViewProfile(me, user))) return NextResponse.json([]);
    const sql = getSql();
    const rows = await sql`
      SELECT id, challenger_name, proposal, note, created_at FROM skill_challenges
      WHERE profile_name = ${user} AND status = 'open' ORDER BY created_at DESC
    `;
    return NextResponse.json(rows);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

/** Skilltree anfechten (Vorschlag neuer Level 0–5 je Skill + Begründung). */
export async function POST(req: NextRequest) {
  try {
    const me = await getCurrentUser();
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { profile, proposal, note } = await req.json();
    if (!profile) return NextResponse.json({ error: 'Missing profile' }, { status: 400 });
    if (me === profile) return NextResponse.json({ error: 'Eigenes Profil' }, { status: 400 });
    if (!(await canViewProfile(me, profile))) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 });

    const clean: Record<string, number> = {};
    for (const [k, v] of Object.entries(proposal ?? {})) {
      if (SKILL_KEYS.has(k)) clean[k] = Math.max(0, Math.min(5, Math.round(Number(v) || 0)));
    }
    if (Object.keys(clean).length === 0) return NextResponse.json({ error: 'Kein Vorschlag' }, { status: 400 });

    const sql = getSql();
    // Pro Anfechter nur eine offene Anfechtung je Profil.
    await sql`DELETE FROM skill_challenges WHERE profile_name = ${profile} AND challenger_name = ${me} AND status = 'open'`;
    await sql`
      INSERT INTO skill_challenges (profile_name, challenger_name, proposal, note)
      VALUES (${profile}, ${me}, ${JSON.stringify(clean)}::jsonb, ${String(note ?? '').slice(0, 300)})
    `;
    await createNotification(sql, {
      user: profile,
      type: 'challenge',
      actor: me,
      body: `${me} fechtet deinen Skilltree an.`,
      link: `/profil/${encodeURIComponent(profile)}`,
      push: { title: '⚔️ Skilltree angefochten', body: `${me} schlägt andere Skill-Werte vor.` },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
