import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ROLE_DEFAULT_REDIRECT } from '@/lib/rbac';
import type { UserRole } from '@/types/database';

export const instant = false;

export default async function Home() {
  await connection();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: userProfile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();

  const userRole = (userProfile?.role as UserRole) || 'driver';
  redirect(ROLE_DEFAULT_REDIRECT[userRole] || '/login');
}
