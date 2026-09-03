'use client';

import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  ChevronDown,
  ChevronLeft,
  Search,
  ChevronsUpDown,
  ChevronsDownUp,
  Sun,
  Settings,
  Users,
  Truck,
} from "lucide-react";
import React, { useState, useMemo, useCallback } from "react";
import { useTheme } from "@/components/theme-provider";

export interface SidebarItem {
  title: string;
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
  icon?: React.ReactNode;
  badge?: string | number;
  items: SidebarItem[];
  defaultOpen?: boolean;
}

interface SidebarProps {
  groups?: SidebarGroup[];
  items?: SidebarItem[];
  currentPath: string;
  userRole?: string | null;
  onItemClick?: () => void;
}

export function Sidebar({ groups, items, currentPath, userRole, onItemClick }: SidebarProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const { theme, setTheme } = useTheme();
  
  // Single active group ID (accordion behavior)
  const [activeGroupId, setActiveGroupId] = useState<string | null | undefined>(undefined);
  const [allExpanded, setAllExpanded] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Normalize items into groups if only items array is passed
  const normalizedGroups: SidebarGroup[] = useMemo(() => {
    if (groups && groups.length > 0) return groups;
    if (items && items.length > 0) return [{ id: 'default', label: 'الرئيسية', items }];
    return [];
  }, [groups, items]);

  // Helper to check if item is allowed for current user role
  const isItemAllowed = useCallback((item: SidebarItem): boolean => {
    if (!item.roles) return true;
    if (!userRole) return false;
    return item.roles.includes(userRole);
  }, [userRole]);

  // Filter groups and their items based on user role
  const filteredGroups = useMemo(() => {
    return normalizedGroups
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
  }, [normalizedGroups, isItemAllowed]);

  // Check if a group contains active route
  const isGroupActive = useCallback((group: SidebarGroup): boolean => {
    return group.items.some(
      (item) =>
        item.href === currentPath ||
        item.children?.some((child) => child.href === currentPath)
    );
  }, [currentPath]);

  // Find the group that contains the current active route or default to first group
  const defaultActiveGroupId = useMemo(() => {
    const matched = filteredGroups.find(isGroupActive);
    if (matched) return matched.id;
    return filteredGroups[0]?.id || null;
  }, [filteredGroups, isGroupActive]);

  // Determine effective open state for a group
  const isGroupOpen = (group: SidebarGroup): boolean => {
    if (searchQuery.trim() || allExpanded) return true;
    const currentOpenId = activeGroupId !== undefined ? activeGroupId : defaultActiveGroupId;
    return currentOpenId === group.id;
  };

  // Toggle group open/close with single-open accordion logic
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

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  // Filter groups and items when searching
  const searchedGroups = useMemo(() => {
    if (!searchQuery.trim()) return filteredGroups;

    const query = searchQuery.trim().toLowerCase();
    return filteredGroups
      .map((group) => {
        const matchingItems = group.items.filter((item) => {
          const titleMatches = item.title.toLowerCase().includes(query);
          const childMatches = item.children?.some((child) =>
            child.title.toLowerCase().includes(query)
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
      className="w-68 h-full bg-[#110e1b] text-[#f1ecf9] flex flex-col border-l border-[#221c33] select-none shadow-2xl relative z-20 transition-colors duration-200"
      dir="rtl"
    >
      {/* Brand Header */}
      <div className="p-3.5 border-b border-[#221c33] flex items-center justify-between bg-[#141021]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-600 via-indigo-600 to-violet-500 flex items-center justify-center text-white shadow-md shadow-purple-900/30">
            <Truck className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-sm font-bold font-amiri tracking-wide text-white leading-tight">
              ترانس بودانون
            </h1>
            <p className="text-[10px] text-[#a598c4] font-medium">المنظومة اللوجستية الدولية</p>
          </div>
        </div>
        <span className="flex h-2 w-2 relative">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
        </span>
      </div>

      {/* Search and Quick Controls */}
      <div className="px-2.5 pt-2.5 pb-1.5 space-y-1.5 border-b border-[#221c33] bg-[#141021]/60">
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8778a8]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="بحث سريع في القوائم..."
            className="w-full bg-[#181328] border border-[#2c2342] rounded-md pr-8 pl-3 py-1 text-xs text-[#f1ecf9] placeholder:text-[#8778a8] focus:outline-hidden focus:border-[#a78bfa]/80 focus:ring-1 focus:ring-[#a78bfa]/20 transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-[#8778a8] hover:text-white bg-[#2c2342] rounded-full w-3.5 h-3.5 flex items-center justify-center cursor-pointer"
            >
              ✕
            </button>
          )}
        </div>

        {/* Expand / Collapse Controls */}
        <div className="flex items-center justify-between text-[10px] text-[#8778a8] px-1">
          <span className="font-semibold text-[#8778a8] uppercase tracking-wider">
            الأقسام ({searchedGroups.length})
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={expandAll}
              title="توسيع الكل"
              className="flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-[#201833] hover:text-white transition-colors cursor-pointer"
            >
              <ChevronsUpDown className="w-2.5 h-2.5" />
              <span>توسيع</span>
            </button>
            <span className="text-[#322849]">•</span>
            <button
              type="button"
              onClick={collapseAll}
              title="طي الكل"
              className="flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-[#201833] hover:text-white transition-colors cursor-pointer"
            >
              <ChevronsDownUp className="w-2.5 h-2.5" />
              <span>طي</span>
            </button>
          </div>
        </div>
      </div>

      {/* Navigation Groups List */}
      <nav className="flex-1 p-2 space-y-1 overflow-y-auto scrollbar-thin scrollbar-thumb-[#2f2549] scrollbar-track-transparent">
        {searchedGroups.length === 0 ? (
          <div className="text-center py-6 text-xs text-[#8778a8]">
            لا توجد عناصر مطابقة للبحث
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
                    "w-full px-2.5 py-2 flex items-center justify-between text-right rounded-md transition-colors cursor-pointer group",
                    isOpen
                      ? "text-[#e9ddff] font-semibold"
                      : "text-[#c2b2df] hover:text-white hover:bg-[#1a142c]"
                  )}
                >
                  <span className="text-[13px] tracking-wide truncate">
                    {group.label}
                  </span>

                  <span className="text-[#a78bfa] transition-transform duration-200 shrink-0">
                    {isOpen ? (
                      <ChevronDown className="w-4 h-4 text-[#c4b5fd]" />
                    ) : (
                      <ChevronLeft className="w-4 h-4 text-[#8f7eaf] group-hover:text-[#c4b5fd]" />
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
                        const isActive = currentPath === item.href || (item.href !== '/dashboard' && currentPath.startsWith(item.href.split('?')[0]) && item.href.split('?')[0] !== '/fleet' && item.href.split('?')[0] !== '/treasury' && item.href.split('?')[0] !== '/invoices');
                        const isExact = currentPath === item.href;

                        return (
                          <Link
                            key={`${item.href}-${index}`}
                            href={item.href}
                            onClick={onItemClick}
                            className={cn(
                              "flex items-center justify-between px-2.5 py-1.5 rounded-md text-[12.5px] transition-colors group relative cursor-pointer",
                              isExact
                                ? "bg-[#271e3d] text-white font-semibold"
                                : isActive
                                ? "bg-[#1f1731] text-[#ece4fa]"
                                : "text-[#d6cbef] hover:bg-[#1e1730] hover:text-white"
                            )}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span
                                className={cn(
                                  "w-5 h-5 flex items-center justify-center shrink-0 transition-colors text-xs",
                                  isExact
                                    ? "text-[#c4b5fd]"
                                    : "text-[#bfa8ff] group-hover:text-[#d8ccff]"
                                )}
                              >
                                {item.icon}
                              </span>
                              <span className="truncate">{item.title}</span>
                            </div>

                            {item.badge !== undefined && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-[#8b5cf6]/20 text-[#c4b5fd] border border-[#8b5cf6]/30">
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

      {/* Footer Section: Dark Mode Toggle, Settings, Version */}
      <div className="border-t border-[#221c33] bg-[#141021] p-2 space-y-1">
        {/* Dark Mode Row */}
        <div className="flex items-center justify-between px-2.5 py-1.5 rounded-md text-[12.5px] text-[#cfc2e6]">
          <div className="flex items-center gap-2">
            <Sun className="w-4 h-4 text-[#8f7eaf]" />
            <span className="text-[12px] font-medium">الوضع الداكن</span>
          </div>
          {/* Custom iOS/Modern style toggle switch matching Image 11 */}
          <button
            type="button"
            onClick={toggleTheme}
            aria-label="تبديل الوضع الداكن"
            className={cn(
              "w-11 h-6 rounded-full transition-colors relative flex items-center p-0.5 cursor-pointer outline-hidden",
              theme === 'dark' ? "bg-[#c4b5fd]" : "bg-[#33284d]"
            )}
          >
            <div
              className={cn(
                "w-5 h-5 rounded-full transition-transform duration-200 shadow-sm",
                theme === 'dark'
                  ? "bg-[#352161] translate-x-0"
                  : "bg-[#8f7eaf] -translate-x-5"
              )}
            />
          </button>
        </div>

        {/* Collapsible Settings Group matching Image 11 */}
        <div className="pt-0.5">
          <button
            type="button"
            onClick={() => setSettingsOpen(!settingsOpen)}
            className="w-full flex items-center justify-between px-2.5 py-1.5 text-[12.5px] font-medium text-[#c2b2df] hover:text-white hover:bg-[#1a142c] rounded-md cursor-pointer transition-colors"
          >
            <span className="text-[12.5px] tracking-wide">الإعدادات</span>
            <span className="text-[#a78bfa] transition-transform duration-200">
              {settingsOpen ? (
                <ChevronDown className="w-4 h-4 text-[#c4b5fd]" />
              ) : (
                <ChevronLeft className="w-4 h-4 text-[#8f7eaf]" />
              )}
            </span>
          </button>

          {settingsOpen && (
            <div className="space-y-0.5 pr-2 pl-1 py-1">
              <Link
                href="/settings"
                onClick={onItemClick}
                className={cn(
                  "flex items-center justify-between px-2.5 py-1.5 rounded-md text-[12px] text-[#d6cbef] hover:bg-[#1e1730] hover:text-white transition-colors cursor-pointer",
                  currentPath === '/settings' && "bg-[#271e3d] text-white font-semibold"
                )}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="w-5 h-5 flex items-center justify-center shrink-0 text-[#bfa8ff]">
                    <Settings className="w-4 h-4" />
                  </span>
                  <span className="truncate">إعدادات الشركة</span>
                </div>
              </Link>

              <Link
                href="/settings?tab=users"
                onClick={onItemClick}
                className={cn(
                  "flex items-center justify-between px-2.5 py-1.5 rounded-md text-[12px] text-[#d6cbef] hover:bg-[#1e1730] hover:text-white transition-colors cursor-pointer",
                  currentPath.includes('tab=users') && "bg-[#271e3d] text-white font-semibold"
                )}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="w-5 h-5 flex items-center justify-center shrink-0 text-[#bfa8ff]">
                    <Users className="w-4 h-4" />
                  </span>
                  <span className="truncate">المستخدمين</span>
                </div>
              </Link>
            </div>
          )}
        </div>

        {/* System Version string matching Image 11 */}
        <div className="text-[10px] text-center text-[#7d7098] pt-1 pb-0.5 tracking-wider font-mono">
          إصدار المنظومة v1.0.0+1
        </div>
      </div>
    </aside>
  );
}

