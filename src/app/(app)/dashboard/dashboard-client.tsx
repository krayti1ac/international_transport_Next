'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Sidebar, SidebarGroup } from '@/components/sidebar';
import { ThemeToggle } from '@/components/theme-toggle';
import { LanguageToggle } from '@/components/language-toggle';
import { useLanguage } from '@/components/language-provider';
import { Button } from '@/components/ui/button';
import { useExpirationCounts } from '@/features/notifications/hooks/useExpirationCounts';
import {
  LayoutDashboard,
  TrendingUp,
  Route,
  BarChart3,
  BarChart2,
  Truck,
  Car,
  Landmark,
  Building2,
  Fuel,
  Users,
  Receipt,
  FileSpreadsheet,
  FileText,
  Wrench,
  Layers,
  Bell,
  MessageSquare,
  MessagesSquare,
  ShieldCheck,
  Settings,
  CheckSquare,
  CheckCircle2,
  Wallet,
  LogOut,
  Power,
  Menu,
  X,
  Shield,
  ChevronLeft,
  UserCheck,
  Calculator,
  AlertOctagon,
  AlertTriangle,
  Coins,
  GitFork,
  Calendar,
  Ship,
  FilePlus,
  ListChecks,
  Activity,
  CircleDollarSign,
  UserCog,
  Asterisk,
  PenTool,
  List,
  Scan,
  ScanText,
  CreditCard,
  FileSignature,
  Map,
  Sparkles,
  BookOpen,
  PieChart,
  Shapes,
} from 'lucide-react';
import type { User } from '@/types/database';
import { isRouteAllowed, ROLE_DEFAULT_REDIRECT } from '@/lib/rbac';

const adminNavGroups: SidebarGroup[] = [
  {
    id: 'lists-management',
    label: 'إدارة القوائم والبيانات',
    items: [
      { title: 'قائمة المركبات', href: '/fleet', icon: <Car className="w-4 h-4" /> },
      { title: 'قائمة المسارات', href: '/transport-routes', icon: <Route className="w-4 h-4" /> },
      { title: 'المناطق الجغرافية', href: '/geofence-zones', icon: <Map className="w-4 h-4" /> },
      { title: 'قائمة العملاء', href: '/clients', icon: <Users className="w-4 h-4" /> },
      { title: 'قائمة الموردين', href: '/providers', icon: <Wrench className="w-4 h-4" /> },
      { title: 'قائمة السائقين', href: '/drivers', icon: <UserCheck className="w-4 h-4" /> },
      { title: 'أنواع وثائق الأسطول', href: '/fleet/documents', icon: <Shapes className="w-4 h-4" /> },
    ],
  },
  {
    id: 'trips-travel',
    label: 'الرحلات والسفر الدولي',
    items: [
      { title: 'إدارة الرحلات', href: '/trips', icon: <GitFork className="w-4 h-4" /> },
      { title: 'مهام اليوم للسائقين', href: '/driver-tasks', icon: <Calendar className="w-4 h-4" /> },
      { title: 'مصاريف المعابر والموانئ', href: '/ferry-expenses', icon: <Ship className="w-4 h-4" /> },
    ],
  },
  {
    id: 'invoices-mgmt',
    label: 'إدارة الفواتير والتحصيل',
    items: [
      { title: 'سجل وإدارة الفواتير', href: '/invoices', icon: <Receipt className="w-4 h-4" /> },
      { title: 'إشعارات وتذكيرات الدفع (واتساب)', href: '/whatsapp-reminders', icon: <ListChecks className="w-4 h-4" /> },
    ],
  },
  {
    id: 'finance-treasury',
    label: 'المالية والخزينة',
    items: [
      { title: 'إدارة الخزينة والسيولة', href: '/treasury', icon: <Wallet className="w-4 h-4" /> },
      { title: 'التسوية والمطابقة البنكية', href: '/bank-reconciliation', icon: <Landmark className="w-4 h-4" /> },
      { title: 'أسعار وفروقات الصرف', href: '/forex', icon: <CircleDollarSign className="w-4 h-4" /> },
    ],
  },
  {
    id: 'drivers-mgmt',
    label: 'شؤون السائقين',
    items: [
      { title: 'رواتب ومستحقات السائقين', href: '/driver-settlements', icon: <Calculator className="w-4 h-4" /> },
      { title: 'طلبات العُهد الطارئة', href: '/emergency-advance-requests', icon: <AlertOctagon className="w-4 h-4" /> },
      { title: 'شاشة العُهد والمصروفات', href: '/driver-advances', icon: <Wallet className="w-4 h-4" /> },
      { title: 'تأكيد وتوقيع التسليم (POD)', href: '/driver-delivery', icon: <CheckCircle2 className="w-4 h-4" /> },
    ],
  },
  {
    id: 'fleet-vehicles',
    label: 'الأسطول والصيانة',
    items: [
      { title: 'صيانة وإصلاحات الأسطول', href: '/maintenance', icon: <Wrench className="w-4 h-4" /> },
      { title: 'مسح إيصالات الوقود (AI)', href: '/fuel-receipt', icon: <ScanText className="w-4 h-4" /> },
      { title: 'أرشيف الوثائق العام', href: '/documents', icon: <FileText className="w-4 h-4" /> },
    ],
  },
  {
    id: 'tracking-ops',
    label: 'التتبع والمراقبة الحية',
    items: [
      { title: 'شاشة التتبع والخرائط الحية', href: '/truck-tracking', icon: <Map className="w-4 h-4" /> },
      { title: 'تنبيهات المناطق الجغرافية', href: '/geofence-alerts', icon: <AlertTriangle className="w-4 h-4" /> },
    ],
  },
  {
    id: 'analytics-reports',
    label: 'التحليلات والتقارير',
    items: [
      { title: 'لوحة التحكم العامة', href: '/dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
      { title: 'اللوحة التنفيذية المتقدمة', href: '/executive-dashboard', icon: <BarChart3 className="w-4 h-4" /> },
      { title: 'تقرير أرباح الرحلات', href: '/trip-profitability', icon: <PieChart className="w-4 h-4" /> },
      { title: 'تحليلات استهلاك الوقود (AI)', href: '/fuel-analytics', icon: <Sparkles className="w-4 h-4" /> },
      { title: 'التقارير الشاملة', href: '/reports', icon: <BookOpen className="w-4 h-4" /> },
      { title: 'سجل تدقيق العمليات', href: '/audit-logs', icon: <ShieldCheck className="w-4 h-4" /> },
    ],
  },
  {
    id: 'communication',
    label: 'التواصل والمراسلات',
    items: [
      { title: 'دردشة العمل الداخلية', href: '/chat', icon: <MessageSquare className="w-4 h-4" /> },
      { title: 'مركز إشعارات الواتساب', href: '/whatsapp-notifications', icon: <Bell className="w-4 h-4" /> },
    ],
  },
];

const secretaryNavGroups: SidebarGroup[] = adminNavGroups;

const driverNavGroups: SidebarGroup[] = [
  {
    id: 'driver-tasks',
    label: 'السائقين ومهامي الميدانية',
    icon: <UserCheck className="w-4 h-4 text-amber-500" />,
    items: [
      { title: 'مهامي الحالية', href: '/driver-tasks', icon: <CheckSquare className="w-4 h-4" /> },
      { title: 'تأكيد وتوقيع التسليم (POD)', href: '/driver-delivery', icon: <CheckCircle2 className="w-4 h-4 text-emerald-500" /> },
      { title: 'شاشة العهدة والمصروفات', href: '/driver-advances', icon: <Wallet className="w-4 h-4 text-indigo-500" /> },
      { title: 'طلبات العُهد الطارئة', href: '/emergency-advance-requests', icon: <AlertOctagon className="w-4 h-4 text-rose-500" /> },
      { title: 'تقريري المالي وأرباحي', href: '/driver-settlements', icon: <Coins className="w-4 h-4 text-emerald-500" /> },
      { title: 'إيصالات الوقود', href: '/fuel-receipt', icon: <Fuel className="w-4 h-4" /> },
      { title: 'دردشة داخلية', href: '/chat', icon: <MessagesSquare className="w-4 h-4" /> },
    ],
  },
];

const roleLabels: Record<string, { label: string; badgeClass: string }> = {
  admin: { label: 'مدير النظام', badgeClass: 'bg-purple-500/15 text-purple-400 border-purple-500/30' },
  secretary: { label: 'سكرتارية وإدارة', badgeClass: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30' },
  driver: { label: 'كابتن / سائق', badgeClass: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
};

export function DashboardClient({ user, children }: { user: User; children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const expirationCounts = useExpirationCounts();
  const { locale, dir } = useLanguage();

  useEffect(() => {
    if (user?.role && !isRouteAllowed(user.role, pathname)) {
      router.replace(ROLE_DEFAULT_REDIRECT[user.role]);
    }
  }, [user?.role, pathname, router]);

  const navGroups =
    user.role === 'admin'
      ? adminNavGroups
      : user.role === 'secretary'
      ? secretaryNavGroups
      : driverNavGroups;

  // Find current active item title
  const currentItem =
    navGroups
      .flatMap((g) => g.items)
      .find((item) => item.href === pathname) ||
    navGroups
      .flatMap((g) => g.items)
      .find((item) => {
        const base = item.href.split('?')[0];
        return base !== '/dashboard' && (pathname === base || pathname.startsWith(`${base}/`));
      });

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
  };

  const userRoleInfo = roleLabels[user.role || ''] || {
    label: user.role || 'مستخدم',
    badgeClass: 'bg-slate-500/15 text-slate-400 border-slate-500/30',
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background" dir={dir}>
      {/* Mobile Backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 lg:hidden transition-opacity"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar (Fixed on Mobile, Static on Desktop) */}
      <div
        className={`fixed lg:static inset-y-0 ${dir === 'rtl' ? 'right-0' : 'left-0'} z-50 transform transition-transform duration-300 ease-in-out ${
          sidebarOpen ? 'translate-x-0' : (dir === 'rtl' ? 'translate-x-full lg:translate-x-0' : '-translate-x-full lg:translate-x-0')
        }`}
      >
        <Sidebar
          groups={navGroups}
          currentPath={pathname}
          userRole={user.role}
          onItemClick={() => setSidebarOpen(false)}
        />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Top Navbar matching Image 12 */}
        <header className="bg-card/80 backdrop-blur-md border-b border-border/80 h-16 flex items-center justify-between px-4 lg:px-6 shadow-2xs z-10 transition-colors">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden text-foreground hover:bg-muted"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>

            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground hidden sm:inline-block">
                {locale === 'ar' ? 'الرئيسية' : 'Accueil'}
              </span>
              <ChevronLeft className={`w-3.5 h-3.5 text-muted-foreground/60 hidden sm:inline-block ${dir === 'ltr' ? 'rotate-180' : ''}`} />
              <h2 className="text-base sm:text-lg font-bold font-amiri text-foreground flex items-center gap-2">
                {currentItem ? currentItem.title : (locale === 'ar' ? 'لوحة التحكم' : 'Tableau de bord')}
              </h2>
            </div>
          </div>

          {/* Controls matching Image 12: Language Switcher, Notification Bell, Theme Toggle, Power/Logout */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Language Switcher Toggle (Bascule Ar / Fr) */}
            <LanguageToggle userKey={user.id} />

            {/* Notification Bell with dynamic Badge */}
            <div className="relative">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => router.push('/notifications/expiration')}
                className="text-muted-foreground hover:text-foreground relative w-9 h-9 rounded-lg hover:bg-muted/80"
                title={locale === 'ar' ? 'تنبيهات الانتهاء' : "Alertes d'expiration"}
              >
                <Bell className="w-5 h-5 text-zinc-400" />
                {expirationCounts.total > 0 && (
                  <span className="absolute -top-1 -left-1 bg-red-600 text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full shadow-xs ring-2 ring-background flex items-center justify-center min-w-[18px] h-[18px]">
                    {expirationCounts.total > 99 ? '99+' : expirationCounts.total}
                  </span>
                )}
              </Button>
            </div>

            {/* Theme Toggle Button (Sun icon matching Image 12) */}
            <ThemeToggle />

            {/* Logout / Power Button (Golden/Amber outline matching Image 12) */}
            <Button
              variant="ghost"
              size="icon"
              onClick={handleSignOut}
              title={locale === 'ar' ? 'تسجيل الخروج' : 'Déconnexion'}
              className="w-9 h-9 rounded-full border border-amber-600/60 hover:bg-amber-500/10 text-amber-500 hover:text-amber-400 transition-colors"
            >
              <Power className="w-4 h-4 stroke-[2.5]" />
            </Button>

            {/* Role Badge */}
            <span
              className={`hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${userRoleInfo.badgeClass}`}
            >
              <Shield className="w-3 h-3" />
              {userRoleInfo.label}
            </span>

            {/* User Pill */}
            <div className="flex items-center gap-2.5 bg-muted/60 hover:bg-muted px-2.5 py-1.5 rounded-xl border border-border/60 transition-colors">
              <div className="w-7 h-7 rounded-lg bg-primary/20 text-primary flex items-center justify-center font-bold text-xs">
                {(user.name || user.email || 'U').charAt(0).toUpperCase()}
              </div>
              <span className="text-xs font-semibold text-foreground hidden sm:block max-w-[120px] truncate">
                {user.name || user.email?.split('@')[0]}
              </span>
            </div>
          </div>
        </header>

        {/* Scrollable Page Body */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6 bg-background text-foreground transition-colors scrollbar-thin">
          <div className="max-w-7xl mx-auto space-y-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}


