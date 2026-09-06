import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { DashboardClient } from '@/app/(app)/dashboard/dashboard-client';

export default async function AppLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{locale: string}>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: userProfile } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single();

  if (!userProfile) {
    redirect('/login');
  }

  return <DashboardClient user={userProfile}>{children}</DashboardClient>;
}
