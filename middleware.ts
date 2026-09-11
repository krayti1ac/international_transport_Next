import createMiddleware from 'next-intl/middleware';
import {routing} from '@/i18n/routing';
import {createServerClient} from '@supabase/ssr';
import {NextResponse} from 'next/server';
import type {NextRequest} from 'next/server';

export async function middleware(request: NextRequest) {
  const intlMiddleware = createMiddleware(routing);
  const intlResponse = intlMiddleware(request);
  if (intlResponse) return intlResponse;

  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {data: {session}} = await supabase.auth.getSession();

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

  const hasSession = !!session || !!customSession;

  const protectedPaths = [
    '/dashboard', '/trips', '/fleet', '/truck-tracking', '/treasury',
    '/clients', '/invoices', '/advanced-reports', '/whatsapp-notifications',
    '/chat', '/audit-logs', '/settings', '/fuel-receipt', '/driver-tasks',
    '/users', '/driver-advances', '/documents', '/reports', '/emergency-advance-requests',
    '/geofence-zones', '/geofence-alerts', '/trip-profitability', '/maintenance',
    '/driver-settlements', '/super-admin'
  ];

  const pathname = request.nextUrl.pathname;
  const pathSegments = pathname.split('/').filter(Boolean);
  const potentialLocale = pathSegments[0] || '';
  const isPrefixed = routing.locales.includes(potentialLocale as any);
  const locale = isPrefixed ? potentialLocale : routing.defaultLocale;
  const relativePath = isPrefixed ? '/' + pathSegments.slice(1).join('/') : '/' + pathSegments.join('/');

  if (isPrefixed && !['/login', '/signup', '/super-admin', '/track'].some(p => relativePath === p || relativePath.startsWith(`${p}/`))) {
    const url = request.nextUrl.clone();
    url.pathname = relativePath;
    return NextResponse.redirect(url);
  }

  const isProtectedPath = protectedPaths.some(path => relativePath.startsWith(path));

  if (isProtectedPath && !hasSession) {
    const url = request.nextUrl.clone();
    url.pathname = locale === routing.defaultLocale ? '/login' : `/${locale}/login`;
    return NextResponse.redirect(url);
  }

  if ((relativePath === '/login' || relativePath === '/signup') && hasSession) {
    let effectiveRole = customSession?.role;
    let isActive = customSession?.is_active !== false;

    if (session) {
      const {data: userProfile} = await supabase
        .from('users')
        .select('role')
        .eq('id', session.user.id)
        .maybeSingle();

      if (userProfile) {
        effectiveRole = userProfile.role;
        if ((userProfile as any).is_active === false) {
          isActive = false;
        }
      }
    }

    if (!isActive) {
      const url = request.nextUrl.clone();
      url.pathname = locale === routing.defaultLocale ? '/login' : `/${locale}/login`;
      url.searchParams.set('deactivated', 'true');
      return NextResponse.redirect(url);
    }

    let targetPath = '/dashboard';
    if (effectiveRole === 'super_admin') {
      targetPath = '/super-admin/companies';
    } else if (effectiveRole === 'driver') {
      targetPath = '/driver-tasks';
    }

    const url = request.nextUrl.clone();
    url.pathname = locale === routing.defaultLocale ? targetPath : `/${locale}${targetPath}`;
    return NextResponse.redirect(url);
  }

  if (isProtectedPath && hasSession) {
    let userRole = customSession?.role;
    let isActive = customSession?.is_active !== false;

    if (session) {
      const {data: userProfile} = await supabase
        .from('users')
        .select('role')
        .eq('id', session.user.id)
        .maybeSingle();

      if (userProfile) {
        userRole = userProfile.role;
        if ((userProfile as any).is_active === false) {
          isActive = false;
        }
      } else if (!customSession) {
        const url = request.nextUrl.clone();
        url.pathname = locale === routing.defaultLocale ? '/login' : `/${locale}/login`;
        return NextResponse.redirect(url);
      }
    }

if (!isActive) {
      const url = request.nextUrl.clone();
      url.pathname = locale === routing.defaultLocale ? '/login' : `/${locale}/login`;
      url.searchParams.set('deactivated', 'true');
      return NextResponse.redirect(url);
    }

    if (userRole === 'admin') {
      // Tenant admins cannot access super-admin paths
      if (relativePath.startsWith('/super-admin')) {
        const url = request.nextUrl.clone();
        url.pathname = locale === routing.defaultLocale ? '/dashboard' : `/${locale}/dashboard`;
        return NextResponse.redirect(url);
      }
      return response;
    }

    if (userRole === 'super_admin') {
      const isAllowed = relativePath.startsWith('/super-admin');
      if (!isAllowed) {
        const url = request.nextUrl.clone();
        url.pathname = locale === routing.defaultLocale ? '/super-admin/companies' : `/${locale}/super-admin/companies`;
        return NextResponse.redirect(url);
      }
      return response;
    }

    const secretaryAllowedPaths = [
      '/dashboard', '/trips', '/truck-tracking',
      '/fleet', '/fuel-receipt', '/treasury', '/clients', '/invoices', '/maintenance',
      '/driver-settlements', '/geofence-zones', '/geofence-alerts',
      '/whatsapp-notifications', '/chat', '/documents', '/emergency-advance-requests',
      '/users', '/forex', '/ferry-expenses',
    ];
    const driverAllowedPaths = [
      '/driver-tasks', '/driver-advances', '/fuel-receipt',
      '/emergency-advance-requests', '/chat',
    ];

    const allowedPaths = userRole === 'secretary' ? secretaryAllowedPaths : driverAllowedPaths;
    const isAllowed = allowedPaths.some(path => path === relativePath || relativePath.startsWith(`${path}/`));

    if (!isAllowed) {
      const fallbackTarget = userRole === 'driver' ? '/driver-tasks' : '/dashboard';
      const url = request.nextUrl.clone();
      url.pathname = locale === routing.defaultLocale ? fallbackTarget : `/${locale}${fallbackTarget}`;
      return NextResponse.redirect(url);
    }
  }

  return response;
}

export const config = {
  matcher: ['/', '/(ar|fr|es)/:path*'],
};
