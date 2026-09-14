import { SignJWT, jwtVerify } from 'jose';

export type SessionPayload = {
  sub: string;
  email?: string;
  name?: string;
  role: string;
  companyId?: number | null;
  deviceId?: string | null;
  isActive?: boolean;
};

function getSessionSecret(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error('SESSION_SECRET environment variable is required for signed offline sessions');
  }
  return new TextEncoder().encode(secret);
}

export async function signSession(payload: SessionPayload): Promise<string> {
  const role = (payload.role || 'driver').toUpperCase();
  const maxAge = role === 'DRIVER' ? '7d' : role === 'SUPER_ADMIN' ? '12h' : '24h';

  return await new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(maxAge)
    .sign(getSessionSecret());
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSessionSecret(), {
      algorithms: ['HS256'],
    });

    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export async function getSessionFromCookie(): Promise<SessionPayload | null> {
  if (typeof window === 'undefined') {
    try {
      const { cookies } = await import('next/headers');
      const cookieStore = await cookies();
      const token = cookieStore.get('app_user_session')?.value;
      if (!token) return null;
      return verifySession(token);
    } catch {
      return null;
    }
  }

  const token = document.cookie
    .split('; ')
    .find((row) => row.startsWith('app_user_session='))
    ?.split('=')[1];

  if (!token) return null;
  return verifySession(decodeURIComponent(token));
}
