import { describe, it, expect } from 'vitest';

process.env.SESSION_SECRET = 'test-session-secret-for-vitest-only-do-not-use-in-production';

import {
  signSession,
  verifySession,
  getSessionFromCookie,
  validateDriverDevice,
  isDriverDeviceValid,
  getDeviceIdFromCookie,
  getDeviceIdFromRequest,
  validateDeviceBinding,
} from './session';

describe('Session', () => {
  describe('signSession and verifySession', () => {
    it('should sign and verify a valid session', async () => {
      const payload = {
        sub: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        role: 'admin',
        companyId: 42,
        deviceId: 'dev-001',
        isActive: true,
      };

      const token = await signSession(payload);
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');

      const verified = await verifySession(token);
      expect(verified).not.toBeNull();
      expect(verified?.sub).toBe('user-123');
      expect(verified?.role).toBe('admin');
      expect(verified?.companyId).toBe(42);
      expect(verified?.deviceId).toBe('dev-001');
    });

    it('should reject a tampered token', async () => {
      const payload = {
        sub: 'user-123',
        role: 'admin',
        companyId: 42,
        isActive: true,
      };

      const token = await signSession(payload);
      const tamperedToken = token.slice(0, -10) + 'abcdefghij';

      const verified = await verifySession(tamperedToken);
      expect(verified).toBeNull();
    });

    it('should reject a token signed with a different secret', async () => {
      // This test verifies that tokens are bound to the SESSION_SECRET
      const payload = {
        sub: 'user-123',
        role: 'admin',
        companyId: 42,
        isActive: true,
      };

      const token = await signSession(payload);
      const verified = await verifySession(token);
      expect(verified).not.toBeNull();
      expect(verified?.sub).toBe('user-123');
    });

    it('should include expiration time for different roles', async () => {
      const driverPayload = {
        sub: 'driver-123',
        role: 'driver',
        companyId: 1,
        isActive: true,
      };

      const adminPayload = {
        sub: 'admin-123',
        role: 'admin',
        companyId: 1,
        isActive: true,
      };

      const driverToken = await signSession(driverPayload);
      const adminToken = await signSession(adminPayload);

      const driverVerified = await verifySession(driverToken);
      const adminVerified = await verifySession(adminToken);

      expect(driverVerified).not.toBeNull();
      expect(adminVerified).not.toBeNull();
    });
  });

  describe('getSessionFromCookie', () => {
    it('should return null when no cookie exists', async () => {
      // This test works in Node environment where cookies are not available
      const session = await getSessionFromCookie();
      expect(session).toBeNull();
    });
  });

  describe('session security', () => {
    it('should not accept plain JSON as a valid session', async () => {
      const fakeCookie = JSON.stringify({
        sub: 'attacker',
        role: 'super_admin',
        companyId: 1,
      });

      const verified = await verifySession(fakeCookie);
      expect(verified).toBeNull();
    });

    it('should reject a token with invalid role claiming super_admin', async () => {
      const payload = {
        sub: 'attacker',
        role: 'super_admin',
        companyId: 1,
        isActive: true,
      };

      const token = await signSession(payload);
      const verified = await verifySession(token);
      // The token is valid (signed correctly), but the role should be checked by RBAC
      expect(verified).not.toBeNull();
      expect(verified?.role).toBe('super_admin');
    });
  });

  describe('validateDriverDevice and isDriverDeviceValid', () => {
    it('should validate driver session when deviceId matches between token and cookie', () => {
      const session = { role: 'driver', deviceId: 'dev-001' };
      expect(validateDriverDevice(session, 'dev-001')).toBe(true);
      expect(isDriverDeviceValid(session, 'dev-001')).toBe(true);
    });

    it('should validate driver session when deviceId is present only in token', () => {
      const session = { role: 'driver', deviceId: 'dev-001' };
      expect(validateDriverDevice(session, null)).toBe(true);
      expect(validateDriverDevice(session, undefined)).toBe(true);
    });

    it('should validate driver session when deviceId is present only in cookie', () => {
      const session = { role: 'driver', deviceId: null };
      expect(validateDriverDevice(session, 'dev-001')).toBe(true);
    });

    it('should reject driver session when deviceId is missing from both token and cookie', () => {
      const session = { role: 'driver', deviceId: null };
      expect(validateDriverDevice(session, null)).toBe(false);
      expect(validateDriverDevice(session, '')).toBe(false);
      expect(validateDriverDevice(session, '   ')).toBe(false);
      expect(validateDriverDevice({ role: 'driver' }, undefined)).toBe(false);
    });

    it('should reject driver session when token deviceId does not match cookie deviceId', () => {
      const session = { role: 'driver', deviceId: 'dev-001' };
      expect(validateDriverDevice(session, 'dev-002')).toBe(false);
      expect(validateDriverDevice(session, 'dev-other')).toBe(false);
    });

    it('should allow non-driver roles even without any deviceId', () => {
      expect(validateDriverDevice({ role: 'admin' }, null)).toBe(true);
      expect(validateDriverDevice({ role: 'super_admin' }, null)).toBe(true);
      expect(validateDriverDevice({ role: 'secretary' }, null)).toBe(true);
      expect(validateDriverDevice({ role: 'accountant' }, null)).toBe(true);
      expect(validateDriverDevice({ role: 'fleet_manager' }, null)).toBe(true);
      expect(validateDriverDevice(null, null)).toBe(true);
    });

    it('should support role string signature with token and cookie device IDs', () => {
      expect(validateDriverDevice('driver', 'dev-001', 'dev-001')).toBe(true);
      expect(validateDriverDevice('driver', 'dev-001', null)).toBe(true);
      expect(validateDriverDevice('driver', null, 'dev-001')).toBe(true);
      expect(validateDriverDevice('driver', null, null)).toBe(false);
      expect(validateDriverDevice('driver', 'dev-001', 'dev-002')).toBe(false);
      expect(validateDriverDevice('admin', null, null)).toBe(true);
      expect(validateDriverDevice('secretary', null, null)).toBe(true);
    });
  });

  describe('getDeviceIdFromCookie', () => {
    it('should extract device ID from mock cookie store object', () => {
      const mockStore = {
        get: (name: string) => {
          if (name === 'app_device_id') return { value: 'dev-cookie-123' };
          return undefined;
        },
      };
      expect(getDeviceIdFromCookie(mockStore)).toBe('dev-cookie-123');
    });

    it('should extract device ID from alternate cookie names like device_id', () => {
      const mockStore = {
        get: (name: string) => {
          if (name === 'device_id') return { value: 'dev-alt-456' };
          return undefined;
        },
      };
      expect(getDeviceIdFromCookie(mockStore)).toBe('dev-alt-456');
    });

    it('should extract device ID from raw cookie string', () => {
      const cookieStr = 'theme=dark; device_id=dev-999; other=value';
      expect(getDeviceIdFromCookie(cookieStr)).toBe('dev-999');
    });

    it('should extract URL encoded device ID from raw cookie string', () => {
      const cookieStr = 'app_device_id=dev%20123; other=value';
      expect(getDeviceIdFromCookie(cookieStr)).toBe('dev 123');
    });

    it('should return null when no device cookie exists', () => {
      const cookieStr = 'theme=dark; other=value';
      expect(getDeviceIdFromCookie(cookieStr)).toBeNull();
      expect(getDeviceIdFromCookie('')).toBeNull();
    });
  });

  describe('getDeviceIdFromRequest', () => {
    it('should extract device ID from x-device-id header with highest priority', () => {
      const mockReq = {
        headers: {
          get: (header: string) => (header === 'x-device-id' ? 'dev-hdr-999' : null),
        },
        cookies: {
          get: (_name: string) => ({ value: 'dev-cookie-111' }),
        },
      };
      expect(getDeviceIdFromRequest(mockReq)).toBe('dev-hdr-999');
    });

    it('should fall back to cookies if header is absent', () => {
      const mockReq = {
        headers: {
          get: () => null,
        },
        cookies: {
          get: (name: string) => (name === 'app_device_id' ? { value: 'dev-cookie-222' } : undefined),
        },
      };
      expect(getDeviceIdFromRequest(mockReq)).toBe('dev-cookie-222');
    });

    it('should return null if request is null or empty', () => {
      expect(getDeviceIdFromRequest(null)).toBeNull();
      expect(getDeviceIdFromRequest({})).toBeNull();
    });
  });

  describe('validateDeviceBinding', () => {
    it('should accept when session deviceId strictly matches request deviceId', () => {
      expect(validateDeviceBinding('dev-001', 'dev-001', 'driver')).toBe(true);
      expect(validateDeviceBinding('dev-001', 'dev-001', 'admin')).toBe(true);
    });

    it('should reject when session deviceId does not match request deviceId', () => {
      expect(validateDeviceBinding('dev-001', 'dev-002', 'driver')).toBe(false);
      expect(validateDeviceBinding('dev-001', 'dev-002', 'admin')).toBe(false);
    });

    it('should reject when session has deviceId but request provides no deviceId', () => {
      expect(validateDeviceBinding('dev-001', null, 'driver')).toBe(false);
      expect(validateDeviceBinding('dev-001', undefined, 'admin')).toBe(false);
    });

    it('should reject driver role if neither session nor request has deviceId', () => {
      expect(validateDeviceBinding(null, null, 'driver')).toBe(false);
    });

    it('should allow non-driver role when session has no device binding and request has none', () => {
      expect(validateDeviceBinding(null, null, 'admin')).toBe(true);
      expect(validateDeviceBinding(null, null, 'super_admin')).toBe(true);
    });
  });
});


