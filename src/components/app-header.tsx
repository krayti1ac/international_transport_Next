'use client';

import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/components/auth-provider';
import { useLanguage } from '@/components/language-provider';
import { createClient } from '@/lib/supabase/client';
import { navigationGroups } from '@/lib/navigation';
import { ThemeToggle } from '@/components/theme-toggle';
import { LanguageToggle } from '@/components/language-toggle';
import { Button } from '@/components/ui/button';
import { UserAvatar } from '@/components/users/UserAvatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  RotateCw,
  Power,
  Shield,
  Sun,
  Moon,
  Globe,
  PanelRightClose,
  PanelRightOpen,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';

interface AppHeaderProps {
  userRole?: string | null;
  sidebarOpen?: boolean;
  onToggleSidebar?: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

const ROLE_CONFIG: Record<string, { ar: string; fr: string; es: string; badgeClass: string; textClass: string }> = {
  super_admin: {
    ar: 'مدير عام',
    fr: 'Super Admin',
    es: 'Superadministrador',
    badgeClass: 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30',
    textClass: 'text-rose-600 dark:text-rose-400',
  },
  'super-admin': {
    ar: 'مدير عام',
    fr: 'Super Admin',
    es: 'Superadministrador',
    badgeClass: 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30',
    textClass: 'text-rose-600 dark:text-rose-400',
  },
  admin: {
    ar: 'مدير النظام',
    fr: 'Administrateur',
    es: 'Administrador del Sistema',
    badgeClass: 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30',
    textClass: 'text-purple-600 dark:text-purple-400',
  },
  secretary: {
    ar: 'سكرتارية وإدارة',
    fr: 'Secrétariat',
    es: 'Secretaría y Gestión',
    badgeClass: 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border-indigo-500/30',
    textClass: 'text-indigo-600 dark:text-indigo-400',
  },
  driver: {
    ar: 'كابتن / سائق',
    fr: 'Chauffeur',
    es: 'Conductor',
    badgeClass: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30',
    textClass: 'text-amber-600 dark:text-amber-400',
  },
};

export function AppHeader({
  userRole,
  sidebarOpen = false,
  onToggleSidebar,
  isCollapsed = false,
  onToggleCollapse,
}: AppHeaderProps) {
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
    textClass: 'text-muted-foreground',
  };

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const displayName = user?.name || user?.email?.split('@')[0] || '';

  const handleRefresh = useCallback(async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      await queryClient.invalidateQueries();
      router.refresh();
      toast({
        title: t('تم تحديث البيانات بنجاح', 'Données actualisées avec succès', 'Datos actualizados con éxito'),
      });
    } catch {
      router.refresh();
    } finally {
      setTimeout(() => setIsRefreshing(false), 700);
    }
  }, [isRefreshing, queryClient, router, t, toast]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F5' && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
        e.preventDefault();
        handleRefresh();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleRefresh]);

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

        {onToggleCollapse && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="hidden lg:flex text-foreground hover:bg-muted shrink-0 w-9 h-9 rounded-xl border border-border/50 cursor-pointer transition-colors"
            onClick={onToggleCollapse}
            title={
              isCollapsed
                ? t('توسيع القائمة الجانبية', 'Déplier le menu', 'Expand sidebar')
                : t('طي القائمة الجانبية', 'Replier le menu', 'Collapse sidebar')
            }
            aria-label={
              isCollapsed
                ? t('توسيع القائمة الجانبية', 'Déplier le menu', 'Expand sidebar')
                : t('طي القائمة الجانبية', 'Replier le menu', 'Collapse sidebar')
            }
          >
            {dir === 'rtl' ? (
              isCollapsed ? (
                <PanelRightOpen className="w-4 h-4 text-muted-foreground hover:text-foreground" />
              ) : (
                <PanelRightClose className="w-4 h-4 text-muted-foreground hover:text-foreground" />
              )
            ) : isCollapsed ? (
              <PanelLeftOpen className="w-4 h-4 text-muted-foreground hover:text-foreground" />
            ) : (
              <PanelLeftClose className="w-4 h-4 text-muted-foreground hover:text-foreground" />
            )}
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

      {/* End side: Controls */}
      <div className="flex items-center gap-1.5 sm:gap-2.5">
        {/* Refresh / F5 Data Button */}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={handleRefresh}
          disabled={isRefreshing}
          title={t('تحديث البيانات (F5)', 'Actualiser les données (F5)', 'Actualizar datos (F5)')}
          aria-label={t('تحديث البيانات (F5)', 'Actualiser les données (F5)', 'Actualizar datos (F5)')}
          className="w-9 h-9 rounded-xl border border-primary/30 bg-primary/10 hover:bg-primary/20 text-primary transition-all shadow-2xs flex items-center justify-center cursor-pointer scale-95 sm:scale-100 disabled:opacity-60"
        >
          <RotateCw className={`w-4 h-4 stroke-[2.3] transition-transform duration-700 ${isRefreshing ? 'animate-spin' : ''}`} />
        </Button>

        {/* User Profile Pill Trigger with Dropdown containing Mode and Language */}
        {displayName && (
          <DropdownMenu dir={dir} open={dropdownOpen} onOpenChange={setDropdownOpen}>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-2 sm:gap-2.5 bg-muted/50 hover:bg-muted/80 data-[state=open]:bg-muted/80 px-2 sm:px-2.5 py-1 rounded-xl border border-border/60 transition-all cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring select-none group"
                aria-label={t('قائمة المستخدم والإعدادات', 'Menu utilisateur et paramètres', 'Menú de usuario y configuración')}
                aria-expanded={dropdownOpen}
              >
                <UserAvatar
                  name={displayName}
                  email={user?.email}
                  avatarUrl={user?.avatar_url}
                  userId={user?.id}
                  size="sm"
                  shape="rounded"
                />
                <div className="flex flex-col text-start min-w-0">
                  <span className="text-xs font-semibold text-foreground leading-tight max-w-[90px] sm:max-w-[120px] lg:max-w-[150px] truncate">
                    {displayName}
                  </span>
                  {effectiveRole && (
                    <span className={`text-[10px] font-medium leading-tight hidden sm:flex items-center gap-1 mt-0.5 ${roleInfo.textClass}`}>
                      <Shield className="w-2.5 h-2.5 shrink-0" />
                      <span className="truncate max-w-[95px] lg:max-w-[130px]">
                        {locale === 'es' ? roleInfo.es : locale === 'fr' ? roleInfo.fr : roleInfo.ar}
                      </span>
                    </span>
                  )}
                </div>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground transition-transform duration-200 shrink-0 ${
                    dropdownOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>
            </DropdownMenuTrigger>

            <DropdownMenuContent
              align="end"
              sideOffset={8}
              className="w-72 sm:w-80 p-3 rounded-2xl bg-card/95 backdrop-blur-xl border border-border shadow-xl z-50 space-y-2.5"
              onCloseAutoFocus={(e) => e.preventDefault()}
            >
              {/* Header: User Profile Details */}
              <div className="flex items-center gap-3 p-2 rounded-xl bg-muted/40 border border-border/40">
                <UserAvatar
                  name={displayName}
                  email={user?.email}
                  avatarUrl={user?.avatar_url}
                  userId={user?.id}
                  size="md"
                  shape="rounded"
                />
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="text-sm font-bold text-foreground leading-tight truncate">
                    {displayName}
                  </span>
                  {user?.email && (
                    <span className="text-[11px] text-muted-foreground truncate leading-snug mt-0.5">
                      {user.email}
                    </span>
                  )}
                  {effectiveRole && (
                    <div className="mt-1.5 flex items-center">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold border ${roleInfo.badgeClass}`}>
                        <Shield className="w-2.5 h-2.5 shrink-0" />
                        <span>{locale === 'es' ? roleInfo.es : locale === 'fr' ? roleInfo.fr : roleInfo.ar}</span>
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <DropdownMenuSeparator className="my-1 bg-border/60" />

              {/* Mode (Dark / Light Theme) */}
              <div
                className="flex items-center justify-between px-2 py-1.5 rounded-xl hover:bg-muted/40 transition-colors"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                    <Sun className="w-4 h-4 dark:hidden" />
                    <Moon className="w-4 h-4 hidden dark:block text-sky-400" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-semibold text-foreground leading-tight">
                      {t('الوضع', 'Mode', 'Modo')}
                    </span>
                    <span className="text-[10px] text-muted-foreground leading-tight mt-0.5">
                      {t('الوضع الداكن والفاتح', 'Mode sombre et clair', 'Modo oscuro y claro')}
                    </span>
                  </div>
                </div>
                <ThemeToggle className="scale-95 shrink-0" />
              </div>

              {/* Language (AR / FR / ES) */}
              <div
                className="flex items-center justify-between px-2 py-1.5 rounded-xl hover:bg-muted/40 transition-colors"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                    <Globe className="w-4 h-4" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-semibold text-foreground leading-tight">
                      {t('اللغة', 'Langue', 'Idioma')}
                    </span>
                    <span className="text-[10px] text-muted-foreground leading-tight mt-0.5">
                      {locale === 'ar' ? 'العربية' : locale === 'fr' ? 'Français' : 'Español'}
                    </span>
                  </div>
                </div>
                <LanguageToggle
                  userKey={user?.id}
                  showIcon={false}
                  className="scale-95 shrink-0"
                />
              </div>

              <DropdownMenuSeparator className="my-1 bg-border/60" />

              {/* Sign Out Option */}
              <DropdownMenuItem
                onClick={handleSignOut}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 hover:text-rose-700 dark:hover:text-rose-300 cursor-pointer transition-colors"
              >
                <Power className="w-4 h-4 stroke-[2.2]" />
                <span>{t('تسجيل الخروج', 'Déconnexion', 'Cerrar sesión')}</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </header>
  );
}
