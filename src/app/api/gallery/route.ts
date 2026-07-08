import { neon } from '@neondatabase/serverless';
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { canViewProfile } from '@/lib/groups';
import { hasSupporter } from '@/lib/entitlements';

/**
 * Profil-Bildergalerie: Wettkampffotos, Trophäen, Medaillen.
 * Bilder werden clientseitig komprimiert (siehe ProfileGallery) und als data-URL gespeichert.
 * Cap: Free 4, Supporter 6.
 */

function getSql() {
  return neon(process.env.DATABASE_URL!);
}

const FREE_MAX = 4;
const SUPPORTER_MAX = 6;
const MAX_IMAGE_CHARS = 700_000; // ~0,5 MB als data-URL — harte Obergrenze pro Bild

export async function GET(req: NextRequest) {
  const user = req.nextUrl.searchParams.get('user');
  if (!user) return NextResponse.json({ error: 'Missing user' }, { status: 400 });
  const me = await getCurrentUser();
  if (!(await canViewProfile(me, user))) return NextResponse.json({ images: [], max: FREE_MAX, private: true });
  const sql = getSql();
  try {
    const rows = (await sql`
      SELECT id, image FROM profile_gallery WHERE user_name = ${user} ORDER BY position ASC, id ASC
    `) as { id: number; image: string }[];
    const max = (await hasSupporter(user)) ? SUPPORTER_MAX : FREE_MAX;
    return NextResponse.json({ images: rows, max });
  } catch {
    return NextResponse.json({ images: [], max: FREE_MAX }); // Tabelle evtl. noch nicht angelegt
  }
}

export async function POST(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { image } = (await req.json().catch(() => ({}))) as { image?: string };
  if (typeof image !== 'string' || !image.startsWith('data:image')) {
    return NextResponse.json({ error: 'Ungültiges Bild' }, { status: 400 });
  }
  if (image.length > MAX_IMAGE_CHARS) {
    return NextResponse.json({ error: 'Bild zu groß — bitte kleineres wählen.' }, { status: 400 });
  }
  const sql = getSql();
  const max = (await hasSupporter(me)) ? SUPPORTER_MAX : FREE_MAX;
  const cntRows = (await sql`SELECT COUNT(*)::int AS n FROM profile_gallery WHERE user_name = ${me}`) as { n: number }[];
  const cnt = cntRows[0]?.n ?? 0;
  if (cnt >= max) return NextResponse.json({ error: `Maximal ${max} Bilder`, cap: true, max }, { status: 409 });
  const ins = (await sql`
    INSERT INTO profile_gallery (user_name, image, position) VALUES (${me}, ${image}, ${cnt}) RETURNING id
  `) as { id: number }[];
  return NextResponse.json({ ok: true, id: ins[0]?.id });
}

export async function DELETE(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const id = Number(req.nextUrl.searchParams.get('id'));
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  const sql = getSql();
  await sql`DELETE FROM profile_gallery WHERE id = ${id} AND user_name = ${me}`;
  return NextResponse.json({ ok: true });
}
