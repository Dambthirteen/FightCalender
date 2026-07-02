import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getSql, exportUserData } from '@/lib/account';

/** DSGVO-Auskunft: eigene Daten als JSON-Download. */
export async function GET() {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const data = await exportUserData(getSql(), me);
  const safeName = me.replace(/[^a-zA-Z0-9_-]/g, '_');
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="tapin-daten-${safeName}.json"`,
    },
  });
}
