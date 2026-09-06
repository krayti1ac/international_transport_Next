'use client';

import { usePathname } from 'next/navigation';
import { Sidebar } from '@/components/sidebar';
import { navigationGroups } from '@/lib/navigation';

export function AppShell({
  children,
  userRole,
}: {
  children: React.ReactNode;
  userRole?: string | null;
}) {
  const pathname = usePathname();

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar groups={navigationGroups} currentPath={pathname} userRole={userRole} />
      <main className="flex-1 overflow-y-auto">
        <div className="p-4 sm:p-6">{children}</div>
      </main>
    </div>
  );
}
