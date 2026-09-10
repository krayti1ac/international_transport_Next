'use client';

import React, { useMemo } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/components/auth-provider';
import { useLanguage } from '@/components/language-provider';
import { createClient } from '@/lib/supabase/client';
import { navigationGroups } from '@/lib/navigation';
import { ThemeToggle } from '@/components/theme-toggle';
import { LanguageToggle } from '@/components/language-toggle';
import { Button } from '@/components/ui/button';
import { UserAvatar } from '@/components/users/UserAvatar';
import {
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  Power,
  Shield,
} from 'lucide-react';

interface AppHeaderProps {
  userRole?: string | null;
  sidebarOpen?: boolean;
  onToggleSidebar?: () => void;
}

const ROLE_CONFIG: Record<string, { ar: string; fr: string; es: string; badgeClass: string }> = {
  super_admin: {
    ar: 'مدير عام',
    fr: 'Super Admin',
    es: 'Superadministrador',
    badgeClass: 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30',
  },
  'super-admin': {
    ar: 'مدير عام',
    fr: 'Super Admin',
    es: 'Superadministrador',
    badgeClass: 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30',
  },
  admin: {
    ar: 'مدير النظام',
    fr: 'Administrateur',
    es: 'Administrador del Sistema',
    badgeClass: 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30',
  },
  secretary: {
    ar: 'سكرتارية وإدارة',
    fr: 'Secrétariat',
    es: 'Secretaría y Gestión',
    badgeClass: 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border-indigo-500/30',
  },
  driver: {
    ar: 'كابتن / سائق',
    fr: 'Chauffeur',
    es: 'Conductor',
    badgeClass: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30',
  },
};

export function AppHeader({ userRole, sidebarOpen = false, onToggleSidebar }: AppHeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, role: authRole, signOut } = useAuth();
  const { t, dir, locale } = useLanguage();

  const effectiveRole = userRole || authRole || user?.role || '';

  const { currentItem, currentGroup } = useMemo(() => {
    for (const group of navigationGroups) {
      for (const item of group.items) {
        if (item.href === pathname) {
          return { currentItem: item, currentGroup: group };
        }
        if (item.href !== '/dashboard' && pathname.startsWith(item.href)) {
          return { currentItem: item, currentGroup: group };
        }
      }
    }
    return { currentItem: null, currentGroup: null };
  }, [pathname]);

  const pageTitle = useMemo(() => {
    if (currentItem) {
      return locale === 'es'
        ? currentItem.titleEs || currentItem.titleFr || currentItem.title
        : locale === 'fr'
        ? currentItem.titleFr || currentItem.title
        : currentItem.title;
    }
    return t('لوحة التحكم', 'Tableau de bord', 'Panel de control');
  }, [currentItem, locale, t]);

  const groupLabel = useMemo(() => {
    if (currentGroup) {
      return locale === 'es'
        ? currentGroup.labelEs || currentGroup.labelFr || currentGroup.label
        : locale === 'fr'
        ? currentGroup.labelFr || currentGroup.label
        : currentGroup.label;
    }
    return t('الرئيسية', 'Accueil', 'Inicio');
  }, [currentGroup, locale, t]);

  const handleSignOut = async () => {
    try {
      if (signOut) {
        await signOut();
      } else {
        const supabase = createClient();
        await supabase.auth.signOut();
      }
    } catch {
      const supabase = createClient();
      await supabase.auth.signOut();
    }
    router.push('/login');
    router.refresh();
  };

  const roleInfo = ROLE_CONFIG[effectiveRole] || {
    ar: effectiveRole || 'مستخدم',
    fr: effectiveRole || 'Utilisateur',
    es: effectiveRole || 'Usuario',
    badgeClass: 'bg-slate-500/15 text-slate-600 dark:text-slate-400 border-slate-500/30',
  };

  const displayName = user?.name || user?.email?.split('@')[0] || '';
  const initial = (displayName || 'U').charAt(0).toUpperCase();

  return (
    <header
      className="bg-card/90 backdrop-blur-md border-b border-border h-16 shrink-0 flex items-center justify-between px-3.5 sm:px-6 shadow-2xs z-30 transition-colors"
      dir={dir}
    >
      {/* Start side: Mobile hamburger & Breadcrumbs */}
      <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
        {onToggleSidebar && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="lg:hidden text-foreground hover:bg-muted shrink-0 w-9 h-9 rounded-xl border border-border/50"
            onClick={onToggleSidebar}
            aria-label={sidebarOpen ? t('إغلاق القائمة', 'Fermer le menu', 'Cerrar menú') : t('فتح القائمة', 'Ouvrir le menu', 'Abrir menú')}
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </Button>
        )}

        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
          <span className="text-xs text-muted-foreground hidden md:inline-block font-medium truncate">
            {groupLabel}
          </span>
          <span className="hidden md:inline-block text-muted-foreground/60">
            {dir === 'rtl' ? (
              <ChevronLeft className="w-3.5 h-3.5" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5" />
            )}
          </span>
          <h2 className="text-sm sm:text-base font-bold font-amiri text-foreground truncate">
            {pageTitle}
          </h2>
        </div>
      </div>

      {/* End side: Controls (Language, Theme, Logout, User Info) */}
      <div className="flex items-center gap-1.5 sm:gap-2.5">
        {/* Language Switcher */}
        <LanguageToggle
          userKey={user?.id || user?.email || undefined}
          showIcon={false}
          className="scale-95 sm:scale-100"
        />

        {/* Theme Toggle (Dark / Light) */}
        <ThemeToggle className="scale-95 sm:scale-100" />

        {/* Logout / Close Button */}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={handleSignOut}
          title={t('تسجيل الخروج', 'Déconnexion', 'Cerrar sesión')}
          aria-label={t('تسجيل الخروج', 'Déconnexion', 'Cerrar sesión')}
          className="w-9 h-9 rounded-xl border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 transition-all shadow-2xs flex items-center justify-center cursor-pointer scale-95 sm:scale-100"
        >
          <Power className="w-4 h-4 stroke-[2.5]" />
        </Button>

        {/* User Role Badge */}
        {effectiveRole && (
          <span
            className={`hidden xl:inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${roleInfo.badgeClass}`}
          >
            <Shield className="w-3 h-3" />
            {locale === 'es' ? roleInfo.es : locale === 'fr' ? roleInfo.fr : roleInfo.ar}
          </span>
        )}

        {/* User Profile Pill */}
        {displayName && (
          <div className="hidden sm:flex items-center gap-2 bg-muted/60 hover:bg-muted px-2.5 py-1.5 rounded-xl border border-border/60 transition-colors">
            <div className="w-6 h-6 rounded-lg bg-primary/20 text-primary flex items-center justify-center font-bold text-xs">
              {initial}
            </div>
            <UserAvatar
              name={displayName}
              email={user?.email}
              avatarUrl={(user as any)?.avatar_url}
              userId={user?.id}
              size="xs"
              shape="rounded"
            />
            <span className="text-xs font-semibold text-foreground max-w-[100px] lg:max-w-[140px] truncate">
              {displayName}
            </span>
          </div>
        )}
      </div>
    </header>
  );
}
