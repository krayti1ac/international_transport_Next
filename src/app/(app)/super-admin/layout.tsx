import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { ROLE_DEFAULT_REDIRECT } from '@/lib/rbac';
import { verifySession } from '@/lib/session';
import type { UserRole } from '@/types/database';

export const metadata = {
  title: 'الإشراف العام | Trans Bodanon TMS',
  description: 'لوحة التحكم المركزية للمشرف العام',
};

export default async function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let role: UserRole | null = null;
  let isActive = true;

  if (user) {
    const { data: userProfile } = await supabase
      .from('users')
      .select('role, is_active')
      .eq('id', user.id)
      .maybeSingle();

    if (userProfile) {
      role = userProfile.role as UserRole;
      if (userProfile.is_active === false) {
        isActive = false;
      }
    }
  }

  // Fallback to app_user_session cookie if needed (e.g. offline dev mode)
  // Verify signed session if Supabase user is not found
  if (!role) {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('app_user_session')?.value;
    if (sessionCookie) {
      try {
        const verified = await verifySession(decodeURIComponent(sessionCookie));
        if (verified) {
          role = (verified.role as UserRole) || null;
          if (verified.isActive === false) {
            isActive = false;
          }
        }
      } catch {}
    }
  }

  // If no authenticated session exists, redirect to login
  if (!user && !role) {
    redirect('/login');
  }

  // If the account is disabled, reject
  if (!isActive) {
    redirect('/login?error=account_disabled');
  }

  // Strictly enforce super_admin role
  if (role !== 'super_admin') {
    const redirectTarget = (role && ROLE_DEFAULT_REDIRECT[role]) || '/dashboard';
    redirect(redirectTarget);
  }

  return <>{children}</>;
}

