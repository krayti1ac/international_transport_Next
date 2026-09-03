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
            request.cookies.set(name, value)
          );
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {data: {session}} = await supabase.auth.getSession();

  const protectedPaths = [
    '/dashboard', '/trips', '/fleet', '/truck-tracking', '/treasury',
    '/clients', '/invoices', '/advanced-reports', '/whatsapp-notifications',
    '/chat', '/audit-logs', '/settings', '/fuel-receipt', '/driver-tasks',
    '/driver-advances', '/documents', '/reports', '/emergency-advance-requests',
    '/geofence-zones', '/geofence-alerts', '/trip-profitability', '/maintenance',
    '/driver-settlements'
  ];

  const pathname = request.nextUrl.pathname;
  const locale = pathname.split('/')[1];
  const relativePath = '/' + pathname.split('/').slice(2).join('/');

  const isProtectedPath = protectedPaths.some(path => relativePath.startsWith(path));

  if (isProtectedPath && !session) {
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}/login`;
    return NextResponse.redirect(url);
  }

  if ((relativePath === '/login' || relativePath === '/signup') && session) {
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}/dashboard`;
    return NextResponse.redirect(url);
  }

  if (isProtectedPath && session) {
    const {data: userProfile} = await supabase
      .from('users')
      .select('role')
      .eq('id', session.user.id)
      .single();

    const userRole = userProfile?.role;

    if (userRole === 'admin') return response;

    const secretaryAllowedPaths = [
      '/dashboard', '/trips', '/trip-profitability', '/truck-tracking',
      '/fleet', '/treasury', '/clients', '/invoices', '/reports', '/maintenance',
      '/driver-settlements', '/geofence-zones', '/geofence-alerts',
      '/whatsapp-notifications', '/chat', '/documents', '/emergency-advance-requests',
    ];
    const driverAllowedPaths = [
      '/driver-tasks', '/driver-advances', '/fuel-receipt',
      '/emergency-advance-requests', '/chat',
    ];

    const allowedPaths = userRole === 'secretary' ? secretaryAllowedPaths : driverAllowedPaths;
    const isAllowed = allowedPaths.some(path => relativePath === path || relativePath.startsWith(`${path}/`));

    if (!isAllowed) {
      const url = request.nextUrl.clone();
      url.pathname = `/${locale}/login`;
      return NextResponse.redirect(url);
    }
  }

  return response;
}

export const config = {
  matcher: ['/', '/(ar|fr|en)/:path*'],
};
