'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { Sidebar } from '@/components/sidebar';
import { AppHeader } from '@/components/app-header';
import { OfflineSyncBadge } from '@/components/offline-sync-badge';
import { PwaInstallPrompt } from '@/components/pwa-install-prompt';
import { navigationGroups } from '@/lib/navigation';
import { useLanguage } from '@/components/language-provider';

export function AppShell({
  children,
  userRole,
}: {
  children: React.ReactNode;
  userRole?: string | null;
}) {
  const pathname = usePathname();
  const { dir } = useLanguage();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('tms_sidebar_collapsed');
      if (saved === 'true') {
        setIsCollapsed(true);
      }
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  const handleToggleCollapse = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('tms_sidebar_collapsed', String(next));
      } catch {
        // Ignore localStorage errors
      }
      return next;
    });
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background" dir={dir}>
      {/* Mobile Drawer Backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 lg:hidden transition-opacity"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar (Responsive drawer on mobile, static on desktop) */}
      <div
        className={`fixed lg:static inset-y-0 ${
          dir === 'rtl' ? 'right-0' : 'left-0'
        } z-50 transform transition-transform duration-300 ease-in-out ${
          sidebarOpen
            ? 'translate-x-0'
            : dir === 'rtl'
            ? 'translate-x-full lg:translate-x-0'
            : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <Sidebar
          groups={navigationGroups}
          currentPath={pathname}
          userRole={userRole}
          onItemClick={() => setSidebarOpen(false)}
          isCollapsed={isCollapsed}
          onToggleCollapse={handleToggleCollapse}
        />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        <AppHeader
          userRole={userRole}
          sidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen((prev) => !prev)}
          isCollapsed={isCollapsed}
          onToggleCollapse={handleToggleCollapse}
        />
        <main className="flex-1 overflow-y-auto">
          <div className="p-3 sm:p-5 lg:p-6 max-w-[1920px] w-full mx-auto">{children}</div>
        </main>
      </div>

      {/* Offline sync status floating indicator */}
      <OfflineSyncBadge />

      {/* PWA install prompt */}
      <PwaInstallPrompt />
    </div>
  );
}
