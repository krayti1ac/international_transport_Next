import type { Metadata } from 'next';
import { SuperAdminScreenIssuesView } from '@/features/super-admin/components/SuperAdminScreenIssuesView';

export const metadata: Metadata = {
  title: 'تتبع مشاكل الشاشات والإدخال | Trans Bodanon Super Admin',
};

export default function SuperAdminScreenIssuesPage() {
  return <SuperAdminScreenIssuesView />;
}

