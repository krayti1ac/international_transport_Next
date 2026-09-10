import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { UserManagementView } from '@/features/users/components/UserManagementView';

export const metadata = {
  title: 'إدارة المستخدمين والصلاحيات | Trans Bodanon',
};

export default function UsersPage() {
  return (
    <div className="max-w-6xl mx-auto py-2">
      <Suspense
        fallback={
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-6 h-6 animate-spin text-primary ms-2" />
            <p className="text-muted-foreground">جاري التحميل...</p>
          </div>
        }
      >
        <UserManagementView />
      </Suspense>
    </div>
  );
}
