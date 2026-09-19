import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { isRouteAllowed, ROLE_DEFAULT_REDIRECT } from '@/lib/rbac';
import {
  verifySession,
  getDeviceIdFromRequest,
  validateDeviceBinding,
} from '@/lib/session';
import type { UserRole } from '@/types/database';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const pathname = request.nextUrl.pathname;

  // استخراج المسار الأساسي المجرد من بادئة اللغة إن وجدت (/ar/invoices -> /invoices)
  const pathSegments = pathname.split('/').filter(Boolean);
  const potentialLocale = pathSegments[0] || '';
  const isPrefixed = ['ar', 'fr', 'es'].includes(potentialLocale);
  const normalizedPath = isPrefixed ? '/' + pathSegments.slice(1).join('/') : pathname;
  const currentLocale = isPrefixed ? potentialLocale : 'ar';

  // 1. استثناء المسارات العامة والأصول الساكنة
  const isPublicRoute =
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/public') ||
    pathname.startsWith('/api/pod') ||
    pathname.includes('/favicon.ico') ||
    pathname.includes('/manifest.json') ||
    normalizedPath === '/' ||
    normalizedPath.startsWith('/login') ||
    normalizedPath.startsWith('/forgot-password') ||
    normalizedPath.startsWith('/signup') ||
    normalizedPath.startsWith('/track') ||
    normalizedPath.startsWith('/portal');

  if (isPublicRoute) {
    return response;
  }

  // 2. تهيئة عميل Supabase وإدارة الجلسات
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: Parameters<typeof response.cookies.set>[2] }>) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // فحص الجلسة الموقّعة مشفراً حصراً (Strict Signed JWT Verification)
  const userSessionCookie = request.cookies.get('app_user_session')?.value;
  let customSession: {
    sub: string;
    email?: string;
    name?: string;
    role: string;
    companyId?: number | null;
    deviceId?: string | null;
    isActive?: boolean;
  } | null = null;

  if (userSessionCookie) {
    try {
      const verified = await verifySession(decodeURIComponent(userSessionCookie));
      if (verified) {
        customSession = {
          sub: verified.sub,
          email: verified.email,
          name: verified.name,
          role: verified.role,
          companyId: verified.companyId,
          deviceId: verified.deviceId,
          isActive: verified.isActive,
        };
      } else {
        // فشل التحقق المشفر أو تم التلاعب بمحتوى الكوكي — إلغاء الجلسة فوراً وإعادة التوجيه
        const loginPath = isPrefixed ? `/${currentLocale}/login` : '/login';
        const redirectUrl = new URL(loginPath, request.url);
        redirectUrl.searchParams.set('error', 'invalid_session');
        const redirectResponse = NextResponse.redirect(redirectUrl);
        redirectResponse.cookies.delete('app_user_session');
        redirectResponse.cookies.delete('auth_token');
        return redirectResponse;
      }
    } catch {
      customSession = null;
      const loginPath = isPrefixed ? `/${currentLocale}/login` : '/login';
      const redirectUrl = new URL(loginPath, request.url);
      redirectUrl.searchParams.set('error', 'invalid_session');
      const redirectResponse = NextResponse.redirect(redirectUrl);
      redirectResponse.cookies.delete('app_user_session');
      redirectResponse.cookies.delete('auth_token');
      return redirectResponse;
    }
  }

  // 3. إعادة التوجيه لصفحة الدخول إذا لم توجد جلسة نشطة
  if (!user && !customSession) {
    const loginPath = isPrefixed ? `/${currentLocale}/login` : '/login';
    const loginUrl = new URL(loginPath, request.url);
    loginUrl.searchParams.set('redirect', pathname);
    const redirectResponse = NextResponse.redirect(loginUrl);
    redirectResponse.cookies.delete('app_user_session');
    redirectResponse.cookies.delete('auth_token');
    return redirectResponse;
  }

  // 4. استعلام دور المستخدم والتحقق من مصفوفة الصلاحيات (RBAC)
  let role: UserRole = 'driver';
  let isActive = true;

  if (user) {
    const { data: profile } = await supabase
      .from('users')
      .select('role, is_active')
      .eq('id', user.id)
      .maybeSingle();

    if (profile) {
      role = (profile.role as UserRole) || 'driver';
      if (profile.is_active === false) {
        isActive = false;
      }
    } else if (customSession) {
      role = (customSession.role as UserRole) || 'driver';
      if (customSession.isActive === false) {
        isActive = false;
      }
    }
  } else if (customSession) {
    role = (customSession.role as UserRole) || 'driver';
    if (customSession.isActive === false) {
      isActive = false;
    }
  }

  if (!isActive) {
    if (user) {
      await supabase.auth.signOut();
    }
    const disabledLoginPath = isPrefixed ? `/${currentLocale}/login` : '/login';
    const redirectResponse = NextResponse.redirect(new URL(`${disabledLoginPath}?error=account_disabled`, request.url));
    redirectResponse.cookies.delete('app_user_session');
    redirectResponse.cookies.delete('auth_token');
    return redirectResponse;
  }

  // 5. التحقق الصارم من بصمة الأجهزة المعتمدة (Strict Device Binding Guard)
  const requestDeviceId = getDeviceIdFromRequest(request);
  const tokenDeviceId = customSession?.deviceId?.trim() || null;
  const isDeviceValid = validateDeviceBinding(tokenDeviceId, requestDeviceId, role);

  if (!isDeviceValid) {
    if (user) {
      await supabase.auth.signOut();
    }

    // تسجيل محاولة وصول غير مصرح بها في سجل الأمان ومشاكل النظام
    try {
      await supabase.from('system_screen_issues').insert({
        screen_route: pathname,
        screen_name: 'Security Middleware (Device Binding)',
        error_message: `محاولة وصول غير مصرح بها: معرف جهاز الطلب (${requestDeviceId || 'غير متوفر'}) لا يتطابق مع معرف جهاز الجلسة الموقعة (${tokenDeviceId || 'غير متوفر'})`,
        device_id: requestDeviceId || tokenDeviceId || 'unknown',
        issue_type: 'device_unauthorized',
        severity: 'critical',
        status: 'open',
        user_name: customSession?.name || user?.email || 'Unknown',
        user_email: customSession?.email || user?.email || 'Unknown',
        user_role: role,
        company_id: customSession?.companyId || null,
        input_payload: {
          tokenDeviceId,
          requestDeviceId,
          ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
          userAgent: request.headers.get('user-agent') || 'unknown',
        },
      });
    } catch {
      // تجاوز أخطاء تسجيل السجل في بيئة الـ Edge
    }

    const unauthorizedLoginPath = isPrefixed ? `/${currentLocale}/login` : '/login';
    const redirectUrl = new URL(unauthorizedLoginPath, request.url);
    redirectUrl.searchParams.set('error', 'unauthorized_device');
    const redirectResponse = NextResponse.redirect(redirectUrl);
    redirectResponse.cookies.delete('app_user_session');
    redirectResponse.cookies.delete('auth_token');
    return redirectResponse;
  }

  // فحص إضافي: إذا كان الجهاز مسجلاً في قاعدة البيانات كمعطل (is_active = false)
  const targetDeviceId = tokenDeviceId || requestDeviceId;
  if (targetDeviceId) {
    try {
      const { data: deviceRecord } = await supabase
        .from('company_devices')
        .select('id, is_active')
        .eq('device_id', targetDeviceId)
        .maybeSingle();

      if (deviceRecord && deviceRecord.is_active === false) {
        if (user) {
          await supabase.auth.signOut();
        }

        try {
          await supabase.from('system_screen_issues').insert({
            screen_route: pathname,
            screen_name: 'Security Middleware (Deactivated Device)',
            error_message: `محاولة استخدام جهاز معطل من الإدارة: (${targetDeviceId}) للمستخدم (${customSession?.email || user?.email || 'Unknown'})`,
            device_id: targetDeviceId,
            issue_type: 'device_unauthorized',
            severity: 'high',
            status: 'open',
            user_name: customSession?.name || user?.email || 'Unknown',
            user_email: customSession?.email || user?.email || 'Unknown',
            user_role: role,
            company_id: customSession?.companyId || null,
          });
        } catch {}

        const unauthorizedLoginPath = isPrefixed ? `/${currentLocale}/login` : '/login';
        const redirectUrl = new URL(unauthorizedLoginPath, request.url);
        redirectUrl.searchParams.set('error', 'unauthorized_device');
        const redirectResponse = NextResponse.redirect(redirectUrl);
        redirectResponse.cookies.delete('app_user_session');
        redirectResponse.cookies.delete('auth_token');
        return redirectResponse;
      }
    } catch {
      // تجاوز خطأ الاستعلام في بيئة Edge أو عند انقطاع الاتصال
    }
  }

  // 6. حماية المسارات غير المصرح بها وتوجيه المستخدم لمساره الافتراضي
  if (!isRouteAllowed(role, normalizedPath) && !isRouteAllowed(role, pathname)) {
    const redirectTarget = ROLE_DEFAULT_REDIRECT[role] || '/dashboard';
    const localizedTarget = isPrefixed ? `/${currentLocale}${redirectTarget}` : redirectTarget;
    return NextResponse.redirect(new URL(localizedTarget, request.url));
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * مطابقة كافة المسارات عدا الملفات الساكنة والأيقونات
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
