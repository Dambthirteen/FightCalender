import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';

const getSecret = () =>
  new TextEncoder().encode(process.env.JWT_SECRET ?? 'fight-calender-dev-secret');

export const COOKIE_NAME = 'fightcal_session';
export const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export async function signToken(userName: string): Promise<string> {
  return new SignJWT({ userName })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('30d')
    .sign(getSecret());
}

export async function verifyToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return payload.userName as string;
  } catch {
    return null;
  }
}

export async function getCurrentUser(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyToken(token);
}

export async function setSessionCookie(userName: string) {
  const token = await signToken(userName);
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: COOKIE_MAX_AGE,
    path: '/',
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}
