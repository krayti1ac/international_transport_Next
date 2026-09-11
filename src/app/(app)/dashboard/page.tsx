import { Suspense } from 'react';
import { createClient } from '@/lib/supabase/server';
import GeneralDashboard from '@/features/analytics/components/GeneralDashboard';
import SecretaryDashboard from '@/features/secretary/components/SecretaryDashboard';
import { DashboardSkeleton } from '@/components/skeletons';

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let role: string | null = null;
  if (user) {
    const { data: userProfile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();
    role = userProfile?.role || null;
  }

  return (
    <Suspense fallback={<DashboardSkeleton />}>
      {role === 'secretary' ? <SecretaryDashboard /> : <GeneralDashboard />}
    </Suspense>
  );
}
