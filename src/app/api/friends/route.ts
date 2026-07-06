import { neon } from '@neondatabase/serverless';
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createNotification } from '@/lib/notify';

export const runtime = 'nodejs'; // Freundschaftsanfrage kann Push auslösen

function getSql() { return neon(process.env.DATABASE_URL!); }

interface Person { user_name: string; color: string | null; avatar: string | null; role: string | null }

/** Eigene Freunde + offene Anfragen (rein & raus). */
export async function GET() {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const sql = getSql();
  try {
    const friends = (await sql`
      SELECT u.user_name, u.color, u.avatar, u.fighter_info->>'role' AS role
      FROM friendships f
      JOIN users u ON u.user_name = CASE WHEN f.requester = ${me} THEN f.addressee ELSE f.requester END
      WHERE f.status = 'accepted' AND (f.requester = ${me} OR f.addressee = ${me})
      ORDER BY u.user_name
    `) as Person[];
    const incoming = (await sql`
      SELECT u.user_name, u.color, u.avatar, u.fighter_info->>'role' AS role
      FROM friendships f JOIN users u ON u.user_name = f.requester
      WHERE f.status = 'pending' AND f.addressee = ${me}
      ORDER BY f.created_at DESC
    `) as Person[];
    const outRows = (await sql`SELECT addressee FROM friendships WHERE status = 'pending' AND requester = ${me}`) as { addressee: string }[];
    return NextResponse.json({ friends, incoming, outgoing: outRows.map((r) => r.addressee) });
  } catch {
    return NextResponse.json({ friends: [], incoming: [], outgoing: [] });
  }
}

/** action: 'request' | 'accept' | 'reject' | 'remove' (target = anderer Nutzer). */
export async function POST(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { action, user } = (await req.json().catch(() => ({}))) as { action?: string; user?: string };
  const other = String(user ?? '').trim();
  if (!other || other === me) return NextResponse.json({ error: 'Ungültig' }, { status: 400 });
  const sql = getSql();

  const exists = await sql`SELECT 1 FROM users WHERE user_name = ${other}`;
  if (exists.length === 0) return NextResponse.json({ error: 'Unbekannter Nutzer' }, { status: 404 });

  if (action === 'request') {
    // Hat der andere MICH schon angefragt? → beidseitiger Wunsch → direkt bestätigen.
    const reverse = await sql`SELECT 1 FROM friendships WHERE requester = ${other} AND addressee = ${me} AND status = 'pending'`;
    if (reverse.length > 0) {
      await sql`UPDATE friendships SET status = 'accepted' WHERE requester = ${other} AND addressee = ${me}`;
      return NextResponse.json({ ok: true, status: 'accepted' });
    }
    await sql`
      INSERT INTO friendships (requester, addressee, status) VALUES (${me}, ${other}, 'pending')
      ON CONFLICT (requester, addressee) DO NOTHING
    `;
    await createNotification(sql, {
      user: other, type: 'friend', actor: me,
      body: `${me} möchte mit dir befreundet sein.`,
      link: '/mitglieder?tab=friends',
      push: { title: '👋 Freundschaftsanfrage', body: `${me} möchte dein Freund sein` },
    }).catch(() => {});
    return NextResponse.json({ ok: true, status: 'pending' });
  }

  if (action === 'accept') {
    const upd = await sql`
      UPDATE friendships SET status = 'accepted'
      WHERE requester = ${other} AND addressee = ${me} AND status = 'pending' RETURNING id
    `;
    if (upd.length === 0) return NextResponse.json({ error: 'Keine offene Anfrage' }, { status: 400 });
    await createNotification(sql, {
      user: other, type: 'friend', actor: me,
      body: `${me} hat deine Freundschaftsanfrage angenommen.`,
      link: `/profil/${encodeURIComponent(me)}`,
      push: { title: '🤝 Neue Freundschaft', body: `${me} ist jetzt dein Freund` },
    }).catch(() => {});
    return NextResponse.json({ ok: true, status: 'accepted' });
  }

  if (action === 'reject') {
    await sql`DELETE FROM friendships WHERE requester = ${other} AND addressee = ${me} AND status = 'pending'`;
    return NextResponse.json({ ok: true, status: 'none' });
  }

  if (action === 'remove') {
    // Freundschaft ODER eigene offene Anfrage in beliebiger Richtung entfernen.
    await sql`
      DELETE FROM friendships
      WHERE (requester = ${me} AND addressee = ${other}) OR (requester = ${other} AND addressee = ${me})
    `;
    return NextResponse.json({ ok: true, status: 'none' });
  }

  return NextResponse.json({ error: 'Unbekannte Aktion' }, { status: 400 });
}
