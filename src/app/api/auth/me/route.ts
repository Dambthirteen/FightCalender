import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';

export async function GET() {
  const userName = await getCurrentUser();
  if (!userName) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  return NextResponse.json({ userName });
}
