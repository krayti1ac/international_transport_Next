'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Sidebar, SidebarGroup } from '@/components/sidebar';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';
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
    label: 'ادارة القوائم',
    items: [
      { title: 'قائمة المركبات', href: '/fleet', icon: <Car className="w-4 h-4" /> },
      { title: 'قائمة المسارات', href: '/transport-routes', icon: <Route className="w-4 h-4" /> },
      { title: 'المناطق الجغرافية', href: '/geofence-zones', icon: <Map className="w-4 h-4" /> },
      { title: 'قائمة العملاء', href: '/clients', icon: <Users className="w-4 h-4" /> },
      { title: 'قائمة الموردين', href: '/providers', icon: <Wrench className="w-4 h-4" /> },
      { title: 'قائمة السائقين', href: '/drivers', icon: <Users className="w-4 h-4" /> },
      { title: 'أنواع وثائق الأسطول', href: '/fleet/documents', icon: <Shapes className="w-4 h-4" /> },
    ],
  },
  {
    id: 'trips-travel',
    label: 'الرحلات والسفر الدولي',
    items: [
      { title: 'إدارة الرحلات', href: '/trips', icon: <GitFork className="w-4 h-4" /> },
      { title: 'مهام اليوم', href: '/driver-tasks', icon: <Calendar className="w-4 h-4" /> },
      { title: 'مصاريف المعابر والموانئ', href: '/trips?tab=expenses', icon: <Ship className="w-4 h-4" /> },
    ],
  },
  {
    id: 'invoices-mgmt',
    label: 'إدارة الفواتير',
    items: [
      { title: 'إنشاء فاتورة للرحلات', href: '/invoices?action=new', icon: <FilePlus className="w-4 h-4" /> },
      { title: 'إنشاء طلب الدفع', href: '/invoices?action=payment_request', icon: <Receipt className="w-4 h-4" /> },
      { title: 'إشعارات طلبات الدفع', href: '/invoices?tab=payment_notifications', icon: <ListChecks className="w-4 h-4" /> },
      { title: 'قائمة الفواتير المتأخرة', href: '/invoices?status=overdue', icon: <Activity className="w-4 h-4" /> },
      { title: 'كشف الفواتير المدفوعة', href: '/invoices?status=paid', icon: <BarChart2 className="w-4 h-4" /> },
    ],
  },
  {
    id: 'forex-finance',
    label: 'الصرف والمالية',
    items: [
      { title: 'لوحة أسعار الصرف وفروقات الصرف', href: '/forex', icon: <CircleDollarSign className="w-4 h-4" /> },
    ],
  },
  {
    id: 'bank-accounts',
    label: 'الحسابات البنكية',
    items: [
      { title: 'قائمة الحسابات البنكية', href: '/bank-reconciliation', icon: <Landmark className="w-4 h-4" /> },
      { title: 'كشف الحسابات البنكية', href: '/bank-reconciliation?tab=statement', icon: <Receipt className="w-4 h-4" /> },
      { title: 'أسعار الصرف', href: '/treasury?tab=exchange_rates', icon: <CircleDollarSign className="w-4 h-4" /> },
      { title: 'فروق الصرف المحققة', href: '/treasury?tab=fx_gain_loss', icon: <TrendingUp className="w-4 h-4" /> },
    ],
  },
  {
    id: 'cash-accounts',
    label: 'الحسابات النقدية',
    items: [
      { title: 'كشف الحسابات النقدية', href: '/treasury?tab=cash_statement', icon: <UserCog className="w-4 h-4" /> },
      { title: 'قائمة الحسابات النقدية', href: '/treasury', icon: <Wallet className="w-4 h-4" /> },
    ],
  },
  {
    id: 'drivers-mgmt',
    label: 'السائقين',
    items: [
      { title: 'أجور وبونص السائقين الدوليين', href: '/driver-settlements?tab=bonus', icon: <Coins className="w-4 h-4" /> },
      { title: 'كشف راتب شهري (PDF)', href: '/driver-settlements?tab=salary_pdf', icon: <FileText className="w-4 h-4" /> },
      { title: 'تسوية أرباح السائق بالرحلة', href: '/driver-settlements', icon: <Calculator className="w-4 h-4" /> },
      { title: 'طلبات العُهد الطارئة', href: '/emergency-advance-requests', icon: <Asterisk className="w-4 h-4" /> },
      { title: 'شاشة العهدة الخاصة بي', href: '/driver-advances', icon: <Wallet className="w-4 h-4" /> },
      { title: 'تقريري المالي', href: '/driver-settlements?tab=financial_report', icon: <Wallet className="w-4 h-4" /> },
      { title: 'تتبع صلاحية الفيزا', href: '/drivers?tab=visas', icon: <ShieldCheck className="w-4 h-4" /> },
      { title: 'توقيع التسليم الإلكتروني', href: '/driver-delivery', icon: <PenTool className="w-4 h-4" /> },
    ],
  },
  {
    id: 'fleet-vehicles',
    label: 'الأسطول والمركبات',
    items: [
      { title: 'وثائق الأسطول', href: '/fleet/documents', icon: <FileText className="w-4 h-4" /> },
      { title: 'قائمة فواتير الإصلاح', href: '/maintenance?tab=repair_invoices', icon: <List className="w-4 h-4" /> },
      { title: 'الصيانة الدورية للأسطول', href: '/maintenance', icon: <Wrench className="w-4 h-4" /> },
      { title: 'كشف مصاريف الصيانة', href: '/maintenance?tab=expenses', icon: <Receipt className="w-4 h-4" /> },
      { title: '⚠️ تنبيهات الصيانة الوقائية', href: '/maintenance?tab=alerts', icon: <AlertTriangle className="w-4 h-4" /> },
      { title: '⛽ مسح تذاكر الوقود (AI)', href: '/fuel-receipt', icon: <Scan className="w-4 h-4" /> },
    ],
  },
  {
    id: 'suppliers-mgmt',
    label: 'إدارة الموردين',
    items: [
      { title: 'كشف حساب المورد', href: '/providers', icon: <CreditCard className="w-4 h-4" /> },
      { title: 'نموذج فاتورة مورد', href: '/providers?action=invoice', icon: <FileSignature className="w-4 h-4" /> },
      { title: 'تسوية الديون', href: '/providers?tab=settlement', icon: <CreditCard className="w-4 h-4" /> },
    ],
  },
  {
    id: 'tracking-ai',
    label: 'التتبع والذكاء الاصطناعي',
    items: [
      { title: 'شاشة التتبع والخرائط الحية', href: '/truck-tracking', icon: <Map className="w-4 h-4" /> },
      { title: 'تنبيهات المناطق الجغرافية', href: '/geofence-alerts', icon: <AlertTriangle className="w-4 h-4" /> },
      { title: 'مسح تذاكر المازوت (AI OCR)', href: '/fuel-receipt', icon: <ScanText className="w-4 h-4" /> },
    ],
  },
  {
    id: 'communication',
    label: 'التواصل',
    items: [
      { title: 'دردشة داخلية', href: '/chat', icon: <MessageSquare className="w-4 h-4" /> },
      { title: 'مركز إشعارات الواتساب', href: '/whatsapp-notifications', icon: <MessageSquare className="w-4 h-4" /> },
      { title: 'تذكيرات الفواتير المتأخرة (واتساب)', href: '/whatsapp-reminders', icon: <Bell className="w-4 h-4" /> },
    ],
  },
  {
    id: 'fleet-vehicles',
    label: 'الأسطول والمركبات',
    items: [
      { title: 'وثائق الأسطول', href: '/fleet/documents', icon: <FileText className="w-4 h-4" /> },
      { title: 'أرشيف الوثائق العام', href: '/documents', icon: <FileText className="w-4 h-4" /> },
      { title: 'حجوزات وتذاكر العبّارات', href: '/ferry-expenses', icon: <Ship className="w-4 h-4" /> },
      { title: 'قائمة فواتير الإصلاح', href: '/maintenance?tab=repair_invoices', icon: <List className="w-4 h-4" /> },
      { title: 'الصيانة الدورية للأسطول', href: '/maintenance', icon: <Wrench className="w-4 h-4" /> },
      { title: 'كشف مصاريف الصيانة', href: '/maintenance?tab=expenses', icon: <Receipt className="w-4 h-4" /> },
      { title: '⚠️ تنبيهات الصيانة الوقائية', href: '/maintenance?tab=alerts', icon: <AlertTriangle className="w-4 h-4" /> },
      { title: '⛽ مسح تذاكر الوقود (AI)', href: '/fuel-receipt', icon: <Scan className="w-4 h-4" /> },
    ],
  },
  {
    id: 'analytics-reports',
    label: 'التحليلات والتقارير',
    items: [
      { title: 'تقارير ذكية (AI)', href: '/advanced-reports', icon: <Sparkles className="w-4 h-4" /> },
      { title: 'دفتر السكرتيرة الموحد', href: '/reports?tab=secretary', icon: <BookOpen className="w-4 h-4" /> },
      { title: 'تقريري المالي', href: '/reports?tab=personal_finance', icon: <Wallet className="w-4 h-4" /> },
      { title: 'لوحة التحكم والتحليلات', href: '/dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
      { title: 'لوحة التحليلات المتقدمة', href: '/executive-dashboard', icon: <BarChart3 className="w-4 h-4" /> },
      { title: '📊 التحليلات الذكية (AI)', href: '/fuel-analytics', icon: <Sparkles className="w-4 h-4" /> },
      { title: 'تقرير أرباح الشركة', href: '/trip-profitability', icon: <PieChart className="w-4 h-4" /> },
      { title: 'تقرير ربحية الأسطول', href: '/trip-profitability?tab=fleet', icon: <TrendingUp className="w-4 h-4" /> },
      { title: 'تقرير السجل المالي للتدقيق والحذف', href: '/audit-logs', icon: <ShieldCheck className="w-4 h-4" /> },
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
  const currentItem = navGroups
    .flatMap((g) => g.items)
    .find((item) => item.href === pathname || pathname.startsWith(item.href.split('?')[0]));

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
    <div className="flex h-screen overflow-hidden bg-background" dir="rtl">
      {/* Mobile Backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 lg:hidden transition-opacity"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar (Fixed on Mobile, Static on Desktop) */}
      <div
        className={`fixed lg:static inset-y-0 right-0 z-50 transform transition-transform duration-300 ease-in-out ${
          sidebarOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'
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
              <span className="text-xs text-muted-foreground hidden sm:inline-block">الرئيسية</span>
              <ChevronLeft className="w-3.5 h-3.5 text-muted-foreground/60 hidden sm:inline-block" />
              <h2 className="text-base sm:text-lg font-bold font-amiri text-foreground flex items-center gap-2">
                {currentItem ? currentItem.title : 'لوحة التحكم'}
              </h2>
            </div>
          </div>

          {/* Controls matching Image 12: Notification Bell (34 badge), Theme Toggle, Power/Logout */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Notification Bell with 34 Badge (matching Image 12) */}
            <div className="relative">
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-foreground relative w-9 h-9 rounded-lg hover:bg-muted/80"
                title="التنبيهات والإشعارات"
              >
                <Bell className="w-5 h-5 text-zinc-400" />
                <span className="absolute -top-1 -left-1 bg-red-600 text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full shadow-xs ring-2 ring-background flex items-center justify-center min-w-[18px] h-[18px]">
                  34
                </span>
              </Button>
            </div>

            {/* Theme Toggle Button (Sun icon matching Image 12) */}
            <ThemeToggle />

            {/* Logout / Power Button (Golden/Amber outline matching Image 12) */}
            <Button
              variant="ghost"
              size="icon"
              onClick={handleSignOut}
              title="تسجيل الخروج"
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


