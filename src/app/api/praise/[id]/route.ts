import { neon } from '@neondatabase/serverless';
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';

function getSql() {
  return neon(process.env.DATABASE_URL!);
}

/** Empfänger stellt ein Lob/Gigalob im Profil aus (mit/ohne Kommentar) oder nimmt es zurück. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const me = await getCurrentUser();
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id } = await params;
    const { displayed, show_comment } = await req.json();
    const sql = getSql();
    const row = await sql`SELECT to_user FROM praises WHERE id = ${id}`;
    if (!row[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (me !== row[0].to_user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 });
    await sql`UPDATE praises SET displayed = ${!!displayed}, show_comment = ${!!show_comment} WHERE id = ${id}`;
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
