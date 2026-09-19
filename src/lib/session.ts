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

/**
 * Helper to extract device ID from cookie storage or cookie string.
 */
export function getDeviceIdFromCookie(
  cookieSource?: string | { get: (name: string) => { value: string } | undefined }
): string | null {
  if (cookieSource && typeof cookieSource === 'object' && 'get' in cookieSource) {
    for (const name of ['app_device_id', 'device_id', 'deviceId', 'driver_device_id']) {
      const val = cookieSource.get(name)?.value;
      if (val && val.trim()) return val.trim();
    }
    return null;
  }

  const cookieStr =
    typeof cookieSource === 'string'
      ? cookieSource
      : typeof window !== 'undefined'
      ? document.cookie
      : '';

  if (!cookieStr) return null;

  const cookies = cookieStr.split('; ');
  for (const name of ['app_device_id', 'device_id', 'deviceId', 'driver_device_id']) {
    const found = cookies.find((row) => row.startsWith(`${name}=`))?.split('=')[1];
    if (found) {
      const decoded = decodeURIComponent(found).trim();
      if (decoded) return decoded;
    }
  }
  return null;
}

/**
 * Helper to extract device ID from request headers (x-device-id) or cookies.
 */
export function getDeviceIdFromRequest(
  requestOrHeaders?: {
    headers?: { get: (name: string) => string | null };
    cookies?: { get: (name: string) => { value: string } | undefined };
  } | null
): string | null {
  if (!requestOrHeaders) return null;
  const headerDeviceId = requestOrHeaders.headers?.get('x-device-id');
  if (headerDeviceId && headerDeviceId.trim()) {
    return headerDeviceId.trim();
  }
  if (requestOrHeaders.cookies) {
    return getDeviceIdFromCookie(requestOrHeaders.cookies);
  }
  return null;
}

/**
 * Strict device binding validator:
 * - If session contains a deviceId:
 *   The request device ID must be present and must strictly match session.deviceId.
 * - If role is 'driver':
 *   A deviceId must be present in session and/or request, and if present in both, they must match.
 */
export function validateDeviceBinding(
  sessionDeviceId?: string | null,
  requestDeviceId?: string | null,
  role?: string | null
): boolean {
  const cleanSessionDevice = sessionDeviceId?.trim() || null;
  const cleanRequestDevice = requestDeviceId?.trim() || null;

  // 1. If token is explicitly bound to a device ID, the incoming request MUST match it
  if (cleanSessionDevice) {
    if (!cleanRequestDevice) return false;
    return cleanSessionDevice === cleanRequestDevice;
  }

  // 2. For driver role, a device ID is strictly required
  if ((role || '').toLowerCase() === 'driver') {
    if (!cleanRequestDevice && !cleanSessionDevice) return false;
  }

  return true;
}

/**
 * Validates driver device binding:
 * - When role is 'driver':
 *   1. A valid deviceId must be present in either the token/session or cookies.
 *   2. If deviceId is provided in both token and cookies, they must strictly match.
 * - Non-driver roles bypass device binding checks and always return true.
 */
export function validateDriverDevice(
  sessionOrRole: SessionPayload | { role?: string; deviceId?: string | null } | string | null | undefined,
  tokenOrCookieDeviceId?: string | null,
  cookieDeviceIdArg?: string | null
): boolean {
  let role: string | undefined;
  let tokenDeviceId: string | null | undefined;
  let cookieDeviceId: string | null | undefined;

  if (typeof sessionOrRole === 'string') {
    role = sessionOrRole;
    tokenDeviceId = tokenOrCookieDeviceId;
    cookieDeviceId = cookieDeviceIdArg;
  } else if (sessionOrRole && typeof sessionOrRole === 'object') {
    role = sessionOrRole.role;
    tokenDeviceId = sessionOrRole.deviceId;
    cookieDeviceId = tokenOrCookieDeviceId;
  }

  if ((role || '').toLowerCase() !== 'driver') {
    return true;
  }

  const cleanTokenDevice = tokenDeviceId?.trim();
  const cleanCookieDevice = cookieDeviceId?.trim();

  // 1. عدم وجود معرّف جهاز في التوكن ولا في الكوكيز
  if (!cleanTokenDevice && !cleanCookieDevice) {
    return false;
  }

  // 2. إذا وُجد المعرّف في الاثنين معاً ويختلفان -> جهاز غير مطابق
  if (cleanTokenDevice && cleanCookieDevice && cleanTokenDevice !== cleanCookieDevice) {
    return false;
  }

  return true;
}

export const isDriverDeviceValid = validateDriverDevice;

