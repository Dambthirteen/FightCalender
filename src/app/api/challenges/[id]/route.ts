import { neon } from '@neondatabase/serverless';
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createNotification } from '@/lib/notify';

export const runtime = 'nodejs'; // verschickt Push

function getSql() {
  return neon(process.env.DATABASE_URL!);
}

/** Anfechtung auflösen — nur der Profil-Besitzer: 'accept' übernimmt die Werte, 'reject' verwirft. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const me = await getCurrentUser();
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id } = await params;
    const { action } = await req.json();
    if (action !== 'accept' && action !== 'reject') {
      return NextResponse.json({ error: 'Bad action' }, { status: 400 });
    }
    const sql = getSql();
    const ch = (await sql`
      SELECT profile_name, challenger_name, proposal, status FROM skill_challenges WHERE id = ${id}
    `) as { profile_name: string; challenger_name: string; proposal: Record<string, number>; status: string }[];
    if (!ch[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (me !== ch[0].profile_name) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 });
    if (ch[0].status !== 'open') return NextResponse.json({ ok: true, already: true });

    if (action === 'accept') {
      const u = (await sql`SELECT skills FROM users WHERE user_name = ${me}`) as { skills: Record<string, number> }[];
      const merged: Record<string, number> = { ...(u[0]?.skills ?? {}) };
      for (const [k, v] of Object.entries(ch[0].proposal)) merged[k] = Math.max(0, Math.min(5, Number(v))) * 20;
      await sql`UPDATE users SET skills = ${JSON.stringify(merged)}::jsonb WHERE user_name = ${me}`;
      await sql`UPDATE skill_challenges SET status = 'accepted', resolved_at = NOW() WHERE id = ${id}`;
      await createNotification(sql, {
        user: ch[0].challenger_name,
        type: 'challenge_result',
        actor: me,
        body: `${me} hat deine Skilltree-Anfechtung übernommen ✅`,
        link: `/profil/${encodeURIComponent(me)}`,
        push: { title: '✅ Anfechtung übernommen', body: `${me} hat deine Skill-Werte übernommen.` },
      });
    } else {
      await sql`UPDATE skill_challenges SET status = 'rejected', resolved_at = NOW() WHERE id = ${id}`;
      await createNotification(sql, {
        user: ch[0].challenger_name,
        type: 'challenge_result',
        actor: me,
        body: `${me} hat deine Skilltree-Anfechtung abgelehnt ❌`,
        link: `/profil/${encodeURIComponent(me)}`,
        push: { title: '❌ Anfechtung abgelehnt', body: `${me} bleibt bei den eigenen Werten.` },
      });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
