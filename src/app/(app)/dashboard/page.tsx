import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import ReportsPage from '../reports/page';
import { DashboardSkeleton } from '@/components/skeletons';

export const instant = false;

export default async function DashboardPage() {
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

  if (!userProfile) {
    redirect('/login');
  }

  if (userProfile.role === 'driver') {
    redirect('/driver-tasks');
  }

  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <ReportsPage />
    </Suspense>
  );
}
