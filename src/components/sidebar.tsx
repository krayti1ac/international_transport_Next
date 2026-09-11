'use client';

import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  ChevronDown,
  ChevronLeft,
  Search,
  ChevronsUpDown,
  ChevronsDownUp,
  PanelRightClose,
  PanelRightOpen,
  PanelLeftClose,
  PanelLeftOpen,
  ShieldCheck,
} from "lucide-react";
import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useLanguage } from "@/components/language-provider";
import { useAuth } from "@/components/auth-provider";
import { useCompanyBranding } from "@/hooks/use-company-branding";

export interface SidebarItem {
  title: string;
  titleFr?: string;
  titleEs?: string;
  href: string;
  icon?: React.ReactNode;
  roles?: string[];
  badge?: string | number;
  badgeColor?: string;
  children?: SidebarItem[];
}

export interface SidebarGroup {
  id?: string;
  label: string;
  labelFr?: string;
  labelEs?: string;
  icon?: React.ReactNode;
  badge?: string | number;
  items: SidebarItem[];
  defaultOpen?: boolean;
  roles?: string[];
}

interface SidebarProps {
  groups?: SidebarGroup[];
  items?: SidebarItem[];
  currentPath: string;
  userRole?: string | null;
  onItemClick?: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

const emptySubscribe = () => () => {};

export function Sidebar({
  groups,
  items,
  currentPath,
  userRole,
  onItemClick,
  isCollapsed = false,
  onToggleCollapse,
}: SidebarProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const { dir, locale, t } = useLanguage();
  const { user, role: authRole } = useAuth();
  const effectiveRole = userRole || authRole || user?.role || '';
  const isSuperAdmin = effectiveRole === 'super_admin' || effectiveRole === 'super-admin';
  const { companyName, logoUrl } = useCompanyBranding();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const isClient = React.useSyncExternalStore(emptySubscribe, () => true, () => false);

  const [activeGroupId, setActiveGroupId] = useState<string | null | undefined>(undefined);
  const [allExpanded, setAllExpanded] = useState(false);

  // State for collapsed mode flyouts & tooltips using event target rects (no ref access during render)
  const [activeFlyout, setActiveFlyout] = useState<{ groupId: string; rect: DOMRect; pinned?: boolean } | null>(null);
  const [hoveredTooltip, setHoveredTooltip] = useState<{ id: string; title: string; rect: DOMRect } | null>(null);
  const flyoutCloseTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Close flyout on click outside or escape key
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest('[data-sidebar-flyout]') || target?.closest('[data-sidebar-trigger]')) {
        return;
      }
      setActiveFlyout(null);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActiveFlyout(null);
        setHoveredTooltip(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Collapsed mode flyout handlers
  const handleMouseEnterGroup = (groupId: string, e: React.MouseEvent<HTMLElement>) => {
    if (flyoutCloseTimerRef.current) {
      clearTimeout(flyoutCloseTimerRef.current);
    }
    const rect = e.currentTarget.getBoundingClientRect();
    setActiveFlyout((prev) => (prev?.pinned ? prev : { groupId, rect, pinned: false }));
  };

  const handleMouseLeaveGroup = () => {
    flyoutCloseTimerRef.current = setTimeout(() => {
      setActiveFlyout((prev) => (prev?.pinned ? prev : null));
    }, 180);
  };

  const handleMouseEnterFlyout = () => {
    if (flyoutCloseTimerRef.current) {
      clearTimeout(flyoutCloseTimerRef.current);
    }
  };

  const handleMouseLeaveFlyout = () => {
    flyoutCloseTimerRef.current = setTimeout(() => {
      setActiveFlyout((prev) => (prev?.pinned ? prev : null));
    }, 150);
  };

  const handleClickGroup = (groupId: string, e: React.MouseEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setActiveFlyout((prev) =>
      prev?.groupId === groupId && prev.pinned
        ? null
        : { groupId, rect, pinned: true }
    );
  };
  const normalizedGroups: SidebarGroup[] = useMemo(() => {
    if (groups && groups.length > 0) return groups;
    if (items && items.length > 0) return [{ id: 'default', label: t('الرئيسية', 'Accueil', 'Home'), items }];
    return [];
  }, [groups, items, t]);

  const isItemAllowed = useCallback((item: SidebarItem): boolean => {
    if (!item.roles) return true;
    if (!userRole) return false;
    const normalizedRole = userRole === 'super-admin' ? 'super_admin' : userRole;
    return item.roles.includes(normalizedRole);
  }, [userRole]);

  const isGroupAllowed = useCallback((group: SidebarGroup): boolean => {
    if (!group.roles || group.roles.length === 0) return true;
    if (!userRole) return false;
    const normalizedRole = userRole === 'super-admin' ? 'super_admin' : userRole;
    return group.roles.includes(normalizedRole);
  }, [userRole]);

  const filteredGroups = useMemo(() => {
    return normalizedGroups
      .filter(isGroupAllowed)
      .map((group, gIdx) => {
        const groupId = group.id || `group-${gIdx}-${group.label}`;
        const filteredItems = group.items
          .filter(isItemAllowed)
          .map((item) => ({
            ...item,
            children: item.children ? item.children.filter(isItemAllowed) : undefined,
          }));

        return {
          ...group,
          id: groupId,
          items: filteredItems,
        };
      })
      .filter((group) => group.items.length > 0);
  }, [normalizedGroups, isGroupAllowed, isItemAllowed]);

  const isGroupActive = useCallback((group: SidebarGroup): boolean => {
    const currentBase = currentPath.split('?')[0];
    return group.items.some(
      (item) => {
        const itemBase = item.href.split('?')[0];
        return (
          item.href === currentPath ||
          (itemBase !== '/dashboard' && currentBase === itemBase) ||
          item.children?.some((child) => child.href === currentPath || (child.href.split('?')[0] !== '/dashboard' && currentBase === child.href.split('?')[0]))
        );
      }
    );
  }, [currentPath]);

  // Keep active route's group opened automatically when navigating
  useEffect(() => {
    const matched = filteredGroups.find(isGroupActive);
    if (matched?.id) {
      setActiveGroupId(matched.id);
    }
  }, [currentPath, filteredGroups, isGroupActive]);

  const defaultActiveGroupId = useMemo(() => {
    const matched = filteredGroups.find(isGroupActive);
    if (matched) return matched.id;
    return filteredGroups[0]?.id || null;
  }, [filteredGroups, isGroupActive]);

  const isGroupOpen = (group: SidebarGroup): boolean => {
    if (searchQuery.trim() || allExpanded) return true;
    const currentOpenId = activeGroupId !== undefined ? activeGroupId : defaultActiveGroupId;
    return currentOpenId === group.id;
  };

  const handleToggleGroup = (groupId: string) => {
    setAllExpanded(false);
    const currentOpenId = activeGroupId !== undefined ? activeGroupId : defaultActiveGroupId;
    if (currentOpenId === groupId) {
      setActiveGroupId(null);
    } else {
      setActiveGroupId(groupId);
    }
  };

  const expandAll = () => {
    setAllExpanded(true);
    setActiveGroupId(null);
  };

  const collapseAll = () => {
    setAllExpanded(false);
    setActiveGroupId(null);
  };
  const searchedGroups = useMemo(() => {
    if (!searchQuery.trim()) return filteredGroups;

    const query = searchQuery.trim().toLowerCase();
    return filteredGroups
      .map((group) => {
        const matchingItems = group.items.filter((item) => {
          const titleMatches =
            item.title.toLowerCase().includes(query) ||
            (item.titleFr ? item.titleFr.toLowerCase().includes(query) : false) ||
            (item.titleEs ? item.titleEs.toLowerCase().includes(query) : false);
          const childMatches = item.children?.some((child) =>
            child.title.toLowerCase().includes(query) ||
            (child.titleFr ? child.titleFr.toLowerCase().includes(query) : false) ||
            (child.titleEs ? child.titleEs.toLowerCase().includes(query) : false)
          );
          return titleMatches || childMatches;
        });

        return {
          ...group,
          items: matchingItems,
        };
      })
      .filter((group) => group.items.length > 0);
  }, [filteredGroups, searchQuery]);

  return (
    <aside
      className={cn(
        "h-full bg-[var(--sidebar-bg)] text-[var(--sidebar-fg)] flex flex-col select-none shadow-2xl relative z-20 transition-all duration-300 ease-in-out",
        dir === 'rtl' ? 'border-l' : 'border-r',
        'border-[var(--sidebar-border)]',
        isCollapsed ? "w-68 lg:w-[72px]" : "w-68"
      )}
      dir={dir}
    >
      {/* ========================================================
          1. COLLAPSED VIEW (Desktop only when isCollapsed is true)
          ======================================================== */}
      {isCollapsed && (
        <div className="hidden lg:flex flex-col h-full w-full">
          {/* Collapsed Brand Header */}
          <div className="p-3 border-b border-[var(--sidebar-border)] flex flex-col items-center gap-2.5 bg-[var(--sidebar-header-bg)] transition-colors duration-200">
            <div
              className="relative cursor-pointer group/brand"
              onClick={onToggleCollapse}
              title={isSuperAdmin ? t('لوحة الإشراف العام', 'Supervision Centrale', 'Super Admin') : companyName}
            >
              {isSuperAdmin ? (
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-rose-600 via-purple-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-rose-900/30 transition-transform group-hover/brand:scale-105">
                  <ShieldCheck className="w-5 h-5" />
                </div>
              ) : logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={logoUrl}
                  alt={`${t('شعار', 'Logo', 'Logo')} ${companyName}`}
                  className="w-9 h-9 rounded-xl object-contain bg-[var(--sidebar-bg)] border border-[var(--sidebar-border)] shadow-xs transition-transform group-hover/brand:scale-105"
                />
              ) : (
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-600 via-indigo-600 to-violet-500 flex items-center justify-center text-white shadow-md shadow-purple-900/30 transition-transform group-hover/brand:scale-105">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 32 32"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="w-5 h-5"
                    aria-hidden="true"
                  >
                    <path d="M2 18.5a2 2 0 0 1 2-2h11.5v6H4a2 2 0 0 1-2-2v-2Z" />
                    <path d="M15.5 12h6l3.5 4.5h-2v3h-7.5v-7.5Z" />
                    <circle cx="7" cy="22" r="1.6" fill="currentColor" stroke="none" />
                    <circle cx="20" cy="22" r="1.6" fill="currentColor" stroke="none" />
                    <circle cx="26.5" cy="22" r="1.6" fill="currentColor" stroke="none" />
                  </svg>
                </div>
              )}
              <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500 border-2 border-[var(--sidebar-bg)]"></span>
              </span>
            </div>

            {/* Toggle Expand Button */}
            {onToggleCollapse && (
              <button
                type="button"
                onClick={onToggleCollapse}
                title={t('توسيع القائمة الجانبية', 'Déplier le menu', 'Expand sidebar')}
                aria-label={t('توسيع القائمة الجانبية', 'Déplier le menu', 'Expand sidebar')}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--sidebar-fg-muted)] hover:text-[var(--sidebar-fg)] hover:bg-[var(--sidebar-hover-bg)] transition-colors cursor-pointer border border-[var(--sidebar-border)]/60"
              >
                {dir === 'rtl' ? <PanelRightOpen className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
              </button>
            )}
          </div>

          {/* Quick Search trigger in collapsed mode */}
          <div className="p-2 border-b border-[var(--sidebar-border)] flex justify-center bg-[var(--sidebar-header-bg)]/60">
            <button
              type="button"
              onClick={() => {
                onToggleCollapse?.();
                setTimeout(() => searchInputRef.current?.focus(), 200);
              }}
              title={t('بحث سريع في القوائم...', 'Recherche rapide...', 'Quick search...')}
              className="w-9 h-9 rounded-xl flex items-center justify-center bg-[var(--sidebar-input-bg)] border border-[var(--sidebar-border)] text-[var(--sidebar-fg-muted)] hover:text-[var(--sidebar-fg)] hover:bg-[var(--sidebar-hover-bg)] transition-all cursor-pointer shadow-2xs"
            >
              <Search className="w-4 h-4" />
            </button>
          </div>

          {/* Collapsed Icon-Only Navigation List */}
          <nav className="flex-1 py-3 px-2 space-y-1.5 overflow-y-auto scrollbar-thin scrollbar-thumb-[var(--sidebar-border)] scrollbar-track-transparent">
            {searchedGroups.map((group) => {
              const hasActiveChild = isGroupActive(group);
              const isSingleItem = group.items.length === 1;
              const singleItem = isSingleItem ? group.items[0] : null;

              if (isSingleItem && singleItem) {
                const itemBase = singleItem.href.split('?')[0];
                const currentBase = currentPath.split('?')[0];
                const isExact = currentPath === singleItem.href;
                const isBaseMatch = itemBase !== '/dashboard' && (currentPath === itemBase || currentBase === itemBase);
                const isCurrent = isExact || isBaseMatch;
                const itemTitle = locale === 'es'
                  ? (singleItem.titleEs || singleItem.titleFr || singleItem.title)
                  : locale === 'fr'
                  ? (singleItem.titleFr || singleItem.title)
                  : singleItem.title;

                return (
                  <div
                    key={group.id}
                    className="relative flex justify-center"
                    onMouseEnter={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      setHoveredTooltip({ id: group.id!, title: itemTitle, rect });
                    }}
                    onMouseLeave={() => setHoveredTooltip(null)}
                  >
                    <Link
                      href={singleItem.href}
                      prefetch={true}
                      onClick={onItemClick}
                      className={cn(
                        "w-11 h-11 rounded-xl flex items-center justify-center relative transition-all duration-150 cursor-pointer group",
                        isCurrent
                          ? "bg-[var(--sidebar-active-bg)] text-primary font-bold shadow-xs border border-primary/30 ring-1 ring-primary/20"
                          : "text-[var(--sidebar-fg-muted)] hover:text-[var(--sidebar-fg)] hover:bg-[var(--sidebar-hover-bg)]"
                      )}
                    >
                      <span className={cn("w-5 h-5 flex items-center justify-center transition-transform group-hover:scale-110", isCurrent ? "text-primary" : "")}>
                        {singleItem.icon || group.icon}
                      </span>

                      {/* Active indicator bar */}
                      {isCurrent && (
                        <span
                          className={cn(
                            "absolute top-2 bottom-2 w-1 bg-primary rounded-full",
                            dir === 'rtl' ? "-right-2" : "-left-2"
                          )}
                        />
                      )}

                      {/* Badge dot */}
                      {singleItem.badge !== undefined && (
                        <span className="absolute top-1.5 end-1.5 w-2 h-2 rounded-full bg-primary" />
                      )}
                    </Link>
                  </div>
                );
              }

              // Multi-item group
              const isFlyoutOpen = activeFlyout?.groupId === group.id;

              return (
                <div
                  key={group.id}
                  data-sidebar-trigger={group.id}
                  className="relative flex justify-center"
                  onMouseEnter={(e) => handleMouseEnterGroup(group.id!, e)}
                  onMouseLeave={handleMouseLeaveGroup}
                >
                  <button
                    type="button"
                    onClick={(e) => handleClickGroup(group.id!, e)}
                    className={cn(
                      "w-11 h-11 rounded-xl flex items-center justify-center relative transition-all duration-150 cursor-pointer group",
                      hasActiveChild
                        ? "bg-[var(--sidebar-active-bg)] text-primary font-bold shadow-xs border border-primary/30 ring-1 ring-primary/20"
                        : isFlyoutOpen
                        ? "bg-[var(--sidebar-hover-bg)] text-[var(--sidebar-fg)]"
                        : "text-[var(--sidebar-fg-muted)] hover:text-[var(--sidebar-fg)] hover:bg-[var(--sidebar-hover-bg)]"
                    )}
                  >
                    <span className={cn("w-5 h-5 flex items-center justify-center transition-transform group-hover:scale-110", hasActiveChild ? "text-primary" : "")}>
                      {group.icon || group.items[0]?.icon}
                    </span>

                    {/* Active indicator bar */}
                    {hasActiveChild && (
                      <span
                        className={cn(
                          "absolute top-2 bottom-2 w-1 bg-primary rounded-full",
                          dir === 'rtl' ? "-right-2" : "-left-2"
                        )}
                      />
                    )}

                    {/* Group has badge / counter dot */}
                    {group.badge !== undefined && (
                      <span className="absolute top-1.5 end-1.5 w-2 h-2 rounded-full bg-primary" />
                    )}
                  </button>
                </div>
              );
            })}
          </nav>

          {/* Collapsed Group Flyout Portal */}
          {isClient && activeFlyout && (
            (() => {
              const currentFlyoutGroup = filteredGroups.find((g) => g.id === activeFlyout.groupId);
              if (!currentFlyoutGroup) return null;
              return (
                <CollapsedGroupFlyout
                  group={currentFlyoutGroup}
                  rect={activeFlyout.rect}
                  onClose={() => setActiveFlyout(null)}
                  currentPath={currentPath}
                  onItemClick={onItemClick}
                  dir={dir}
                  locale={locale}
                  onMouseEnter={handleMouseEnterFlyout}
                  onMouseLeave={handleMouseLeaveFlyout}
                />
              );
            })()
          )}

          {/* Single Item Tooltip Portal */}
          {isClient && hoveredTooltip && (
            <CollapsedTooltip
              title={hoveredTooltip.title}
              rect={hoveredTooltip.rect}
              dir={dir}
            />
          )}

          {/* Collapsed Footer */}
          <div className="border-t border-[var(--sidebar-border)] bg-[var(--sidebar-header-bg)] p-2 transition-colors duration-200 flex flex-col items-center">
            <span
              className="text-[9px] text-[var(--sidebar-fg-muted)] font-mono font-bold tracking-tight cursor-default"
              title={t('إصدار المنظومة v1.0.0+1', 'Version système v1.0.0+1', 'Versión del sistema v1.0.0+1')}
            >
              v1.0
            </span>
          </div>
        </div>
      )}

      {/* ========================================================
          2. EXPANDED VIEW (Mobile drawer always, Desktop when !isCollapsed)
          ======================================================== */}
      <div className={cn("flex flex-col h-full w-full", isCollapsed && "lg:hidden")}>
        {/* Brand Header */}
        <div className="p-3.5 border-b border-[var(--sidebar-border)] flex items-center justify-between bg-[var(--sidebar-header-bg)] transition-colors duration-200">
          <div className="flex items-center gap-2.5 min-w-0">
            {isSuperAdmin ? (
              <>
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-rose-600 via-purple-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-rose-900/30 shrink-0">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h1 className="text-sm font-bold font-amiri tracking-wide text-[var(--sidebar-fg)] leading-tight truncate">
                    {t('لوحة الإشراف العام', 'Supervision Centrale', 'Super Admin')}
                  </h1>
                  <p className="text-[10px] text-[var(--sidebar-fg-muted)] font-medium truncate">
                    {t('إدارة المنصة والشركات', 'Gestion Multi-Entreprises', 'Platform Management')}
                  </p>
                </div>
              </>
            ) : (
              <>
                {logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={logoUrl}
                    alt={`${t('شعار', 'Logo', 'Logo')} ${companyName}`}
                    className="w-8 h-8 rounded-lg object-contain bg-[var(--sidebar-bg)] border border-[var(--sidebar-border)] shrink-0"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-600 via-indigo-600 to-violet-500 flex items-center justify-center text-white shadow-md shadow-purple-900/30 shrink-0">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 32 32"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="w-5 h-5"
                      aria-hidden="true"
                    >
                      <path d="M2 18.5a2 2 0 0 1 2-2h11.5v6H4a2 2 0 0 1-2-2v-2Z" />
                      <path d="M15.5 12h6l3.5 4.5h-2v3h-7.5v-7.5Z" />
                      <circle cx="7" cy="22" r="1.6" fill="currentColor" stroke="none" />
                      <circle cx="20" cy="22" r="1.6" fill="currentColor" stroke="none" />
                      <circle cx="26.5" cy="22" r="1.6" fill="currentColor" stroke="none" />
                    </svg>
                  </div>
                )}
                <div className="min-w-0">
                  <h1 className="text-sm font-bold font-amiri tracking-wide text-[var(--sidebar-fg)] leading-tight truncate">
                    {companyName}
                  </h1>
                  <p className="text-[10px] text-[var(--sidebar-fg-muted)] font-medium truncate">
                    {t('المنظومة اللوجستية الدولية', 'Plateforme Logistique Internationale', 'International Logistics Platform')}
                  </p>
                </div>
              </>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="flex h-2 w-2 relative shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>

            {/* Desktop Collapse Button */}
            {onToggleCollapse && (
              <button
                type="button"
                onClick={onToggleCollapse}
                title={t('طي القائمة الجانبية', 'Replier le menu', 'Collapse sidebar')}
                aria-label={t('طي القائمة الجانبية', 'Replier le menu', 'Collapse sidebar')}
                className="hidden lg:flex p-1 rounded-md text-[var(--sidebar-fg-muted)] hover:text-[var(--sidebar-fg)] hover:bg-[var(--sidebar-hover-bg)] transition-colors cursor-pointer"
              >
                {dir === 'rtl' ? <PanelRightClose className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
              </button>
            )}
          </div>
        </div>

        {/* Search and Quick Controls */}
        <div className="px-2.5 pt-2.5 pb-1.5 space-y-1.5 border-b border-[var(--sidebar-border)] bg-[var(--sidebar-header-bg)]/60 transition-colors duration-200">
          <div className="relative">
            <Search className={`w-3.5 h-3.5 absolute ${dir === 'rtl' ? 'right-2.5' : 'left-2.5'} top-1/2 -translate-y-1/2 text-[var(--sidebar-fg-muted)]`} />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('بحث سريع في القوائم...', 'Recherche rapide...', 'Quick search...')}
              className={`w-full bg-[var(--sidebar-input-bg)] border border-[var(--sidebar-border)] rounded-md ${dir === 'rtl' ? 'pr-8 pl-3' : 'pl-8 pr-3'} py-1 text-xs text-[var(--sidebar-fg)] placeholder:text-[var(--sidebar-fg-muted)] focus:outline-hidden focus:border-[var(--sidebar-fg-muted)] focus:ring-1 focus:ring-[var(--sidebar-fg-muted)]/20 transition-all`}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className={`absolute ${dir === 'rtl' ? 'left-2' : 'right-2'} top-1/2 -translate-y-1/2 text-[10px] text-[var(--sidebar-fg-muted)] hover:text-[var(--sidebar-fg)] bg-[var(--sidebar-border)] rounded-full w-3.5 h-3.5 flex items-center justify-center cursor-pointer`}
              >
                ✕
              </button>
            )}
          </div>

          {/* Expand / Collapse Controls */}
          <div className="flex items-center justify-between text-[10px] text-[var(--sidebar-fg-muted)] px-1">
            <span className="font-semibold text-[var(--sidebar-fg-muted)] uppercase tracking-wider">
              {t(`الأقسام (${searchedGroups.length})`, `Sections (${searchedGroups.length})`, `Sections (${searchedGroups.length})`)}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={expandAll}
                title={t('توسيع الكل', 'Tout déplier', 'Expand all')}
                className="flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-[var(--sidebar-hover-bg)] hover:text-[var(--sidebar-fg)] transition-colors cursor-pointer"
              >
                <ChevronsUpDown className="w-2.5 h-2.5" />
                <span>{t('توسيع', 'Déplier', 'Expand')}</span>
              </button>
              <span className="text-[var(--sidebar-fg-muted)]">•</span>
              <button
                type="button"
                onClick={collapseAll}
                title={t('طي الكل', 'Tout replier', 'Collapse all')}
                className="flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-[var(--sidebar-hover-bg)] hover:text-[var(--sidebar-fg)] transition-colors cursor-pointer"
              >
                <ChevronsDownUp className="w-2.5 h-2.5" />
                <span>{t('طي', 'Replier', 'Collapse')}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Navigation Groups List */}
        <nav className="flex-1 p-2 space-y-1 overflow-y-auto scrollbar-thin scrollbar-thumb-[var(--sidebar-border)] scrollbar-track-transparent">
          {searchedGroups.length === 0 ? (
            <div className="text-center py-6 text-xs text-[var(--sidebar-fg-muted)]">
              {t('لا توجد عناصر مطابقة للبحث', 'Aucun résultat', 'No matching items')}
            </div>
          ) : (
            searchedGroups.map((group) => {
              const isOpen = isGroupOpen(group);
              const hasActiveChild = isGroupActive(group);

              return (
                <div key={group.id} className="transition-all duration-150">
                  {/* Group Header */}
                  <button
                    type="button"
                    onClick={() => handleToggleGroup(group.id!)}
                    className={cn(
                      "w-full px-2.5 py-2 flex items-center justify-between text-start rounded-md transition-colors cursor-pointer group",
                      isOpen
                        ? "text-[var(--sidebar-fg)] font-semibold"
                        : hasActiveChild
                        ? "text-[var(--sidebar-fg)] font-medium bg-[var(--sidebar-hover-bg)]/50"
                        : "text-[var(--sidebar-fg-muted)] hover:text-[var(--sidebar-fg)] hover:bg-[var(--sidebar-hover-bg)]"
                    )}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {hasActiveChild && !isOpen && (
                        <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                      )}
                      <span className="text-[13px] tracking-wide truncate">
                        {locale === 'es' ? (group.labelEs || group.labelFr || group.label) : locale === 'fr' ? (group.labelFr || group.label) : group.label}
                      </span>
                    </div>

                    <span className="text-[var(--sidebar-fg-muted)] transition-transform duration-200 shrink-0">
                      {isOpen ? (
                        <ChevronDown className="w-4 h-4 text-[var(--sidebar-fg-muted)]" />
                      ) : (
                        <ChevronLeft className={`w-4 h-4 text-[var(--sidebar-fg-muted)] group-hover:text-[var(--sidebar-fg)] ${dir === 'ltr' ? 'rotate-180' : ''}`} />
                      )}
                    </span>
                  </button>

                  {/* Group Sub-Items */}
                  <div
                    className={cn(
                      "grid transition-all duration-200 ease-in-out",
                      isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                    )}
                  >
                    <div className="overflow-hidden">
                      <div className="pt-0.5 pb-1 space-y-0.5 pr-1 pl-1">
                        {group.items.map((item, index) => {
                          const itemBase = item.href.split('?')[0];
                          const currentBase = currentPath.split('?')[0];
                          const isExact = currentPath === item.href;
                          const isBaseMatch = itemBase !== '/dashboard' && (currentPath === itemBase || currentBase === itemBase);
                          const isCurrent = isExact || isBaseMatch;
                          const itemTitle = locale === 'es' ? (item.titleEs || item.titleFr || item.title) : locale === 'fr' ? (item.titleFr || item.title) : item.title;

                          return (
                            <Link
                              key={`${item.href}-${index}`}
                              href={item.href}
                              prefetch={true}
                              onClick={onItemClick}
                              className={cn(
                                "flex items-center justify-between px-2.5 py-1.5 rounded-md text-[12.5px] transition-all group relative cursor-pointer",
                                isCurrent
                                  ? cn(
                                      "bg-[var(--sidebar-active-bg)] text-[var(--sidebar-fg)] font-semibold shadow-2xs",
                                      dir === 'rtl' ? "border-r-2 border-primary" : "border-l-2 border-primary"
                                    )
                                  : "text-[var(--sidebar-fg-muted)] hover:bg-[var(--sidebar-hover-bg)] hover:text-[var(--sidebar-fg)]"
                              )}
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <span
                                  className={cn(
                                    "w-5 h-5 flex items-center justify-center shrink-0 transition-colors text-xs",
                                    isCurrent
                                      ? "text-primary"
                                      : "text-[var(--sidebar-fg-muted)] group-hover:text-[var(--sidebar-fg)]"
                                  )}
                                >
                                  {item.icon}
                                </span>
                                <span className="truncate">{itemTitle}</span>
                              </div>

                              {item.badge !== undefined && (
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-[var(--sidebar-badge-bg)] text-[var(--sidebar-badge-fg)] border border-[var(--sidebar-border)]">
                                  {item.badge}
                                </span>
                              )}
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </nav>

        {/* Footer Section: Version */}
        <div className="border-t border-[var(--sidebar-border)] bg-[var(--sidebar-header-bg)] p-2 transition-colors duration-200">
          <div className="text-[10px] text-center text-[var(--sidebar-fg-muted)] py-0.5 tracking-wider font-mono">
            {t('إصدار المنظومة v1.0.0+1', 'Version système v1.0.0+1', 'Versión del sistema v1.0.0+1')}
          </div>
        </div>
      </div>
    </aside>
  );
}

// =========================================================================
// Helper Component: Collapsed Group Flyout Menu (Portaled to document.body)
// =========================================================================
function CollapsedGroupFlyout({
  group,
  rect,
  onClose,
  currentPath,
  onItemClick,
  dir,
  locale,
  onMouseEnter,
  onMouseLeave,
}: {
  group: SidebarGroup;
  rect: DOMRect;
  onClose: () => void;
  currentPath: string;
  onItemClick?: () => void;
  dir: 'rtl' | 'ltr';
  locale: string;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}) {
  if (typeof document === 'undefined') return null;

  const isRtl = dir === 'rtl';
  const gap = 10;

  // In RTL, sidebar is on the right, flyout goes to the left of it
  const right = isRtl ? window.innerWidth - rect.left + gap : undefined;
  // In LTR, sidebar is on the left, flyout goes to the right of it
  const left = !isRtl ? rect.right + gap : undefined;

  const top = Math.max(12, Math.min(rect.top - 8, window.innerHeight - 380));

  const groupLabel = locale === 'es'
    ? (group.labelEs || group.labelFr || group.label)
    : locale === 'fr'
    ? (group.labelFr || group.label)
    : group.label;

  return createPortal(
    <div
      data-sidebar-flyout={group.id}
      style={{
        top: `${top}px`,
        ...(isRtl ? { right: `${right}px` } : { left: `${left}px` }),
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={cn(
        "fixed z-[9999] w-60 bg-[var(--sidebar-bg)] text-[var(--sidebar-fg)] rounded-2xl shadow-2xl border border-[var(--sidebar-border)] p-2 animate-in fade-in-0 zoom-in-95 duration-150 select-none",
        isRtl ? "text-right" : "text-left"
      )}
      dir={dir}
    >
      {/* Invisible hover bridge towards trigger */}
      <div
        className={cn(
          "absolute top-0 bottom-0 w-3",
          isRtl ? "-right-3" : "-left-3"
        )}
      />

      {/* Flyout Header */}
      <div className="px-2.5 py-2 border-b border-[var(--sidebar-border)] mb-1 flex items-center justify-between">
        <span className="text-xs font-bold font-amiri tracking-wide text-[var(--sidebar-fg)]">
          {groupLabel}
        </span>
        <span className="text-[10px] text-[var(--sidebar-fg-muted)] px-1.5 py-0.5 rounded-full bg-[var(--sidebar-hover-bg)] font-medium">
          {group.items.length}
        </span>
      </div>

      {/* Flyout Items List */}
      <div className="space-y-0.5 max-h-72 overflow-y-auto scrollbar-thin scrollbar-thumb-[var(--sidebar-border)]">
        {group.items.map((item, index) => {
          const itemBase = item.href.split('?')[0];
          const currentBase = currentPath.split('?')[0];
          const isExact = currentPath === item.href;
          const isBaseMatch = itemBase !== '/dashboard' && (currentPath === itemBase || currentBase === itemBase);
          const isCurrent = isExact || isBaseMatch;
          const itemTitle = locale === 'es'
            ? (item.titleEs || item.titleFr || item.title)
            : locale === 'fr'
            ? (item.titleFr || item.title)
            : item.title;

          return (
            <Link
              key={`${item.href}-${index}`}
              href={item.href}
              prefetch={true}
              onClick={() => {
                onClose();
                onItemClick?.();
              }}
              className={cn(
                "flex items-center justify-between px-2.5 py-2 rounded-xl text-xs transition-all cursor-pointer group",
                isCurrent
                  ? cn(
                      "bg-[var(--sidebar-active-bg)] text-[var(--sidebar-fg)] font-semibold shadow-2xs",
                      isRtl ? "border-r-2 border-primary" : "border-l-2 border-primary"
                    )
                  : "text-[var(--sidebar-fg-muted)] hover:bg-[var(--sidebar-hover-bg)] hover:text-[var(--sidebar-fg)]"
              )}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span
                  className={cn(
                    "w-4 h-4 flex items-center justify-center shrink-0 transition-colors",
                    isCurrent ? "text-primary" : "text-[var(--sidebar-fg-muted)] group-hover:text-[var(--sidebar-fg)]"
                  )}
                >
                  {item.icon}
                </span>
                <span className="truncate">{itemTitle}</span>
              </div>

              {item.badge !== undefined && (
                <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-[var(--sidebar-badge-bg)] text-[var(--sidebar-badge-fg)] border border-[var(--sidebar-border)]">
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </div>,
    document.body
  );
}

// =========================================================================
// Helper Component: Collapsed Single Item Tooltip
// =========================================================================
function CollapsedTooltip({
  title,
  rect,
  dir,
}: {
  title: string;
  rect: DOMRect;
  dir: 'rtl' | 'ltr';
}) {
  if (typeof document === 'undefined') return null;

  const isRtl = dir === 'rtl';
  const gap = 10;

  const right = isRtl ? window.innerWidth - rect.left + gap : undefined;
  const left = !isRtl ? rect.right + gap : undefined;
  const top = rect.top + rect.height / 2 - 14;

  return createPortal(
    <div
      style={{
        top: `${top}px`,
        ...(isRtl ? { right: `${right}px` } : { left: `${left}px` }),
      }}
      className="fixed z-[9999] px-2.5 py-1 bg-[var(--sidebar-fg)] text-[var(--sidebar-bg)] text-xs font-medium rounded-lg shadow-xl pointer-events-none whitespace-nowrap animate-in fade-in-0 zoom-in-95 duration-100"
      dir={dir}
    >
      {title}
    </div>,
    document.body
  );
}
