import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { isRouteAllowed, ROLE_DEFAULT_REDIRECT } from '@/lib/rbac';
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

  // فحص الجلسة المحلية/الاحتياطية إن وجدت (للتوافق مع وضع الأوفلاين وبيئات العمل المشتركة)
  const userSessionCookie = request.cookies.get('app_user_session')?.value;
  let customSession: { id: string; email: string; name?: string; role: string; is_active?: boolean } | null = null;
  if (userSessionCookie) {
    try {
      customSession = JSON.parse(decodeURIComponent(userSessionCookie));
    } catch {
      try {
        customSession = JSON.parse(userSessionCookie);
      } catch {}
    }
  }

  // 3. إعادة التوجيه لصفحة الدخول إذا لم توجد جلسة نشطة
  if (!user && !customSession) {
    const loginPath = isPrefixed ? `/${currentLocale}/login` : '/login';
    const loginUrl = new URL(loginPath, request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
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
      if (customSession.is_active === false) {
        isActive = false;
      }
    }
  } else if (customSession) {
    role = (customSession.role as UserRole) || 'driver';
    if (customSession.is_active === false) {
      isActive = false;
    }
  }

  if (!isActive) {
    if (user) {
      await supabase.auth.signOut();
    }
    const disabledLoginPath = isPrefixed ? `/${currentLocale}/login` : '/login';
    return NextResponse.redirect(new URL(`${disabledLoginPath}?error=account_disabled`, request.url));
  }

  // 5. حماية المسارات غير المصرح بها وتوجيه المستخدم لمساره الافتراضي
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

