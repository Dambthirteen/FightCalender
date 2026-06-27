import { neon } from '@neondatabase/serverless';
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { canViewProfile } from '@/lib/groups';
import { createNotification } from '@/lib/notify';

export const runtime = 'nodejs'; // POST verschickt Push (web-push braucht Node)

function getSql() {
  return neon(process.env.DATABASE_URL!);
}

/** Kommentare eines Profils (nur wenn sichtbar). */
export async function GET(req: NextRequest) {
  try {
    const user = req.nextUrl.searchParams.get('user');
    if (!user) return NextResponse.json({ error: 'Missing user' }, { status: 400 });
    const me = await getCurrentUser();
    if (!(await canViewProfile(me, user))) return NextResponse.json([]);
    const sql = getSql();
    const rows = await sql`
      SELECT id, author_name, body, created_at FROM profile_comments
      WHERE profile_name = ${user} ORDER BY created_at ASC
    `;
    return NextResponse.json(rows);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

/** Kommentar schreiben (benachrichtigt den Profil-Besitzer). */
export async function POST(req: NextRequest) {
  try {
    const me = await getCurrentUser();
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { profile, body } = await req.json();
    const text = String(body ?? '').trim();
    if (!profile || !text) return NextResponse.json({ error: 'Leerer Kommentar' }, { status: 400 });
    if (!(await canViewProfile(me, profile))) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 });
    const sql = getSql();
    const ins = await sql`
      INSERT INTO profile_comments (profile_name, author_name, body)
      VALUES (${profile}, ${me}, ${text.slice(0, 500)})
      RETURNING id, author_name, body, created_at
    `;
    if (me !== profile) {
      const preview = text.length > 80 ? `${text.slice(0, 80)}…` : text;
      await createNotification(sql, {
        user: profile,
        type: 'comment',
        actor: me,
        body: `${me} hat dein Profil kommentiert: „${preview}"`,
        link: `/profil/${encodeURIComponent(profile)}`,
        push: { title: '💬 Neuer Kommentar', body: `${me}: ${preview}` },
      });
    }
    return NextResponse.json(ins[0]);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

/** Kommentar löschen (Autor oder Profil-Besitzer). */
export async function DELETE(req: NextRequest) {
  try {
    const me = await getCurrentUser();
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    const sql = getSql();
    const row = await sql`SELECT profile_name, author_name FROM profile_comments WHERE id = ${id}`;
    if (!row[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (me !== row[0].author_name && me !== row[0].profile_name) {
      return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 });
    }
    await sql`DELETE FROM profile_comments WHERE id = ${id}`;
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
