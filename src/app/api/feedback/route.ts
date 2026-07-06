import { neon } from '@neondatabase/serverless';
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';

function getSql() { return neon(process.env.DATABASE_URL!); }

/** Nutzer sendet Feedback oder einen Bug (von der Startseite). */
export async function POST(req: NextRequest) {
  const me = await getCurrentUser();
  const { kind, text } = (await req.json().catch(() => ({}))) as { kind?: string; text?: string };
  const k = kind === 'bug' ? 'bug' : 'feedback';
  const t = String(text ?? '').trim().slice(0, 2000);
  if (!t) return NextResponse.json({ error: 'Bitte etwas eintragen.' }, { status: 400 });
  const sql = getSql();
  await sql`INSERT INTO feedback (user_name, kind, text) VALUES (${me ?? null}, ${k}, ${t})`;
  return NextResponse.json({ ok: true });
}
