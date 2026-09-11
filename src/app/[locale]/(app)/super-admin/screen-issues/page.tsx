'use client';

import { SuperAdminScreenIssuesView } from '@/features/super-admin/components/SuperAdminScreenIssuesView';

export { SuperAdminScreenIssuesView };
export const metadata = {
  title: 'تتبع مشاكل الشاشات والإدخال | Trans Bodanon Super Admin',
};

export default function SuperAdminScreenIssuesPage() {
  return <SuperAdminScreenIssuesView />;
}

