'use client';

/**
 * Trans Bodanon TMS — Unloading Docks & Auto-Dispatch Audit Log Dashboard
 * Real-time monitoring of vehicle arrivals at unloading docks and automated WhatsApp GDP dispatch
 * Standards: EN 12830 / ATP Treaty (FRC / FRA) / EU GDP 2013/C 343/01
 */

import React, { useState, useTransition, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import {
  Activity,
  AlertCircle,
  Building2,
  CheckCircle2,
  Clock,
  Download,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  Filter,
  MessageSquare,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Snowflake,
  Thermometer,
  Truck,
  Zap,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import {
  fetchDockArrivalsAuditAction,
  resendTargetedDispatchAction,
} from '../services/dock-dispatch-audit.actions';
import {
  exportMonthlyDockArrivalsExcelAction,
  exportMonthlyDockArrivalsPdfAction,
} from '../services/dock-export.actions';
import type {
  DockArrivalDispatchItem,
  DockDispatchStats,
} from '../types/dock-dispatch-audit.types';

interface DockArrivalsAuditViewProps {
  initialItems?: DockArrivalDispatchItem[];
  initialStats?: DockDispatchStats;
  compactMode?: boolean;
}

export function DockArrivalsAuditView({
  initialItems = [],
  initialStats,
  compactMode = false,
}: DockArrivalsAuditViewProps) {
  const t = useTranslations('reefer');
  const { toast } = useToast();

  const [items, setItems] = useState<DockArrivalDispatchItem[]>(initialItems);
  const [stats, setStats] = useState<DockDispatchStats>(
    initialStats || {
      totalArrivals: initialItems.length,
      totalDispatches: initialItems.length,
      successfulDispatches: initialItems.length,
      cooldownProtected: 0,
      successRatePct: 100,
      topDocks: [],
      activeCompartmentsCount: { C1: 0, C2: 0, C3: 0 },
    }
  );

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCompartment, setSelectedCompartment] = useState<'ALL' | 'C1' | 'C2' | 'C3'>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedMonth, setSelectedMonth] = useState<string>('2026-10');
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  const [isPending, startTransition] = useTransition();
  const [resendingId, setResendingId] = useState<string | null>(null);

  // Load audit data
  const loadData = useCallback(() => {
    startTransition(async () => {
      const res = await fetchDockArrivalsAuditAction({
        searchQuery: searchQuery || undefined,
        compartmentCode: selectedCompartment,
        dispatchStatus: selectedStatus as any,
      });

      if (res.success) {
        setItems(res.items);
        setStats(res.stats);
      } else {
        toast({
          title: 'خطأ في تحديث البيانات',
          description: res.error || 'تعذر تحميل سجلات وصول الأرصفة',
          variant: 'destructive',
        });
      }
    });
  }, [searchQuery, selectedCompartment, selectedStatus, toast]);

  // Initial load if empty
  useEffect(() => {
    if (initialItems.length === 0) {
      loadData();
    }
  }, [initialItems.length, loadData]);

  // Handle immediate manual resend
  const handleResend = async (item: DockArrivalDispatchItem) => {
    setResendingId(item.id);
    try {
      const res = await resendTargetedDispatchAction({
        tripId: item.tripId,
        compartmentCode: item.compartmentCode,
        receiverName: item.receiverName,
        receiverPhone: item.receiverPhone,
        zoneName: item.zoneName,
        forceBypassCooldown: true,
      });

      if (res.success) {
        toast({
          title: 'تم إعادة الإرسال بنجاح',
          description: `تم إرسال شهادة الحجرة ${item.compartmentCode} إلى ${item.receiverName} فوراً`,
        });
        loadData();
      } else {
        toast({
          title: 'تعذر إعادة الإرسال',
          description: res.error || 'حدث خطأ في بوابة الواتساب',
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: 'خطأ تقني',
        description: 'حدث خطأ غير متوقع أثناء معالجة الطلب',
        variant: 'destructive',
      });
    } finally {
      setResendingId(null);
    }
  };

  // Handle Monthly Excel Export
  const handleExportExcel = async () => {
    setIsExportingExcel(true);
    try {
      const res = await exportMonthlyDockArrivalsExcelAction({
        month: selectedMonth,
        compartmentCode: selectedCompartment,
        dispatchStatus: selectedStatus as any,
        locale: 'ar',
        format: 'excel',
      });
      if (res.success && res.content) {
        const blob = new Blob([res.content], { type: 'application/vnd.ms-excel;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = res.filename || `dock_arrivals_${selectedMonth}.xls`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast({
          title: 'تم تصدير المصنف بنجاح',
          description: `تم حفظ كشف حركة وصول الأرصفة لشهر ${selectedMonth} بصيغة Excel متعددة الأوراق`,
        });
      } else {
        toast({
          title: 'فشل تصدير Excel',
          description: res.error || 'حدث خطأ أثناء إنشاء المصنف',
          variant: 'destructive',
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'حدث خطأ غير متوقع';
      toast({
        title: 'خطأ في التصدير',
        description: msg,
        variant: 'destructive',
      });
    } finally {
      setIsExportingExcel(false);
    }
  };

  // Handle Monthly PDF / Printable Report Export
  const handleExportPdf = async () => {
    setIsExportingPdf(true);
    try {
      const res = await exportMonthlyDockArrivalsPdfAction({
        month: selectedMonth,
        compartmentCode: selectedCompartment,
        dispatchStatus: selectedStatus as any,
        locale: 'ar',
        format: 'pdf',
      });
      if (res.success && res.content) {
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          printWindow.document.write(res.content);
          printWindow.document.close();
          printWindow.focus();
        }
        toast({
          title: 'تم تجهيز كشف PDF بنجاح',
          description: `تم فتح تقرير الامتثال والتبريد المعتمد لشهر ${selectedMonth} للطباعة والأرشفة الجمركية`,
        });
      } else {
        toast({
          title: 'فشل تصدير PDF',
          description: res.error || 'حدث خطأ أثناء توليد التقرير',
          variant: 'destructive',
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'حدث خطأ غير متوقع';
      toast({
        title: 'خطأ في التصدير',
        description: msg,
        variant: 'destructive',
      });
    } finally {
      setIsExportingPdf(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'delivered':
      case 'read':
        return (
          <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 gap-1 px-2.5 py-0.5">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>مستلم</span>
          </Badge>
        );
      case 'sent':
        return (
          <Badge className="bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30 gap-1 px-2.5 py-0.5">
            <Send className="w-3.5 h-3.5" />
            <span>مرسل</span>
          </Badge>
        );
      case 'simulated':
        return (
          <Badge className="bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30 gap-1 px-2.5 py-0.5">
            <Zap className="w-3.5 h-3.5" />
            <span>تجريبي 🧪</span>
          </Badge>
        );
      case 'cooldown_skipped':
        return (
          <Badge className="bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/30 gap-1 px-2.5 py-0.5">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>محمي بالتهدئة</span>
          </Badge>
        );
      case 'failed':
      default:
        return (
          <Badge className="bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30 gap-1 px-2.5 py-0.5">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>فشل الإرسال</span>
          </Badge>
        );
    }
  };

  const getCompartmentBadge = (code: string, cargo?: string) => {
    if (code === 'C1') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
          <Snowflake className="w-3 h-3" />
          <span>C1 (تجميد عميق)</span>
        </span>
      );
    }
    if (code === 'C2') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
          <Thermometer className="w-3 h-3" />
          <span>C2 (تبريد طازج)</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
        <Activity className="w-3 h-3" />
        <span>{code} {cargo ? `(${cargo})` : ''}</span>
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* 1. Header & Bento KPI Cards */}
      {!compactMode && (
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-4">
          <div>
            <div className="flex items-center gap-2">
              <Building2 className="w-6 h-6 text-primary" />
              <h1 className="text-2xl font-bold tracking-tight">
                سجل وصول الأرصفة وبث الشهادات التلقائي
              </h1>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              مراقبة لحظية لوصول شاحنات الأسطول المبرد لمستودعات ومراكز التفريغ (Mercamadrid, Perpignan...) مع أتمتة بث شهادات الحجرات للمستلمين
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 bg-background border border-border rounded-lg px-2 py-1">
              <span className="text-xs text-muted-foreground font-medium">الشهر:</span>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                aria-label="اختر الشهر المحاسبي"
                className="bg-transparent text-xs font-semibold text-foreground focus:outline-hidden cursor-pointer"
              />
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleExportExcel}
              disabled={isExportingExcel || isPending}
              className="gap-1.5 text-xs border-emerald-500/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10"
              title="تصدير مصنف Excel متعدد الأوراق"
            >
              <FileSpreadsheet className={`w-3.5 h-3.5 ${isExportingExcel ? 'animate-bounce' : ''}`} />
              <span>{isExportingExcel ? 'جاري التصدير...' : 'تصدير Excel'}</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleExportPdf}
              disabled={isExportingPdf || isPending}
              className="gap-1.5 text-xs border-sky-500/40 text-sky-600 dark:text-sky-400 hover:bg-sky-500/10"
              title="تصدير وثيقة PDF رسمية موثقة برمز QR"
            >
              <FileText className={`w-3.5 h-3.5 ${isExportingPdf ? 'animate-pulse' : ''}`} />
              <span>{isExportingPdf ? 'جاري التجهيز...' : 'تقرير PDF'}</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={loadData}
              disabled={isPending}
              className="gap-1.5 text-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isPending ? 'animate-spin' : ''}`} />
              <span>تحديث</span>
            </Button>
          </div>
        </div>
      )}

      {/* KPI Bento Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-card/50 border border-border/80 shadow-xs">
          <CardHeader className="p-4 pb-2">
            <CardDescription className="text-xs flex items-center justify-between">
              <span>إجمالي عمليات الوصول</span>
              <Truck className="w-4 h-4 text-primary/70" />
            </CardDescription>
            <CardTitle className="text-2xl font-black mt-1">
              {stats.totalArrivals}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 text-xs text-muted-foreground">
            دخول مؤكد للأرصفة والمستودعات
          </CardContent>
        </Card>

        <Card className="bg-card/50 border border-border/80 shadow-xs">
          <CardHeader className="p-4 pb-2">
            <CardDescription className="text-xs flex items-center justify-between">
              <span>الشهادات المبثوثة</span>
              <MessageSquare className="w-4 h-4 text-emerald-500" />
            </CardDescription>
            <CardTitle className="text-2xl font-black mt-1 text-emerald-600 dark:text-emerald-400">
              {stats.successfulDispatches}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 text-xs text-muted-foreground">
            عبر WhatsApp Cloud API
          </CardContent>
        </Card>

        <Card className="bg-card/50 border border-border/80 shadow-xs">
          <CardHeader className="p-4 pb-2">
            <CardDescription className="text-xs flex items-center justify-between">
              <span>نسبة نجاح التسليم</span>
              <CheckCircle2 className="w-4 h-4 text-sky-500" />
            </CardDescription>
            <CardTitle className="text-2xl font-black mt-1 text-sky-600 dark:text-sky-400">
              {stats.successRatePct}%
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 text-xs text-muted-foreground">
            تسليم مؤكد لمسؤولي الاستلام
          </CardContent>
        </Card>

        <Card className="bg-card/50 border border-border/80 shadow-xs">
          <CardHeader className="p-4 pb-2">
            <CardDescription className="text-xs flex items-center justify-between">
              <span>محمي برادار التهدئة</span>
              <ShieldCheck className="w-4 h-4 text-purple-500" />
            </CardDescription>
            <CardTitle className="text-2xl font-black mt-1 text-purple-600 dark:text-purple-400">
              {stats.cooldownProtected}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 text-xs text-muted-foreground">
            منع الإرسال المكرر (مهلة 60 دقيقة)
          </CardContent>
        </Card>
      </div>

      {/* 2. Filters & Search Toolbar */}
      <Card className="bg-card/40 border border-border/70 shadow-xs">
        <CardContent className="p-4 flex flex-col md:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 absolute start-3 top-3 text-muted-foreground" />
            <Input
              placeholder="بحث بالشاحنة، الرحلة، الرصيف، أو المستلم..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && loadData()}
              className="ps-9 h-10 w-full"
            />
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            {/* Compartment filter */}
            <div className="flex items-center rounded-lg border border-border p-1 bg-background text-xs">
              {(['ALL', 'C1', 'C2', 'C3'] as const).map((code) => (
                <button
                  key={code}
                  onClick={() => setSelectedCompartment(code)}
                  className={`px-3 py-1 rounded font-medium transition-colors ${
                    selectedCompartment === code
                      ? 'bg-primary text-primary-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {code === 'ALL' ? 'كافة الحجرات' : code}
                </button>
              ))}
            </div>

            {/* Status filter */}
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              aria-label="تصفية حالة الإرسال"
              className="h-10 px-3 rounded-lg border border-border bg-background text-xs font-medium focus:ring-2 focus:ring-primary focus:outline-hidden"
            >
              <option value="ALL">كافة الحالات</option>
              <option value="delivered">مستلم</option>
              <option value="sent">مرسل</option>
              <option value="cooldown_skipped">محمي بالتهدئة</option>
              <option value="simulated">وضع تجريبي</option>
              <option value="failed">فشل</option>
            </select>

            <Button
              variant="default"
              size="sm"
              onClick={loadData}
              disabled={isPending}
              className="h-10 px-4 gap-1.5"
            >
              <Filter className="w-3.5 h-3.5" />
              <span>تطبيق</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 3. Main Timeline & Table of Dock Arrivals */}
      <Card className="border border-border/80 shadow-xs">
        <CardHeader className="p-4 border-b border-border/70 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" />
              <span>سجل الوصول اللحظي وتاريخ البث المخصص</span>
            </CardTitle>
            <CardDescription className="text-xs">
              يوثق لحظة اجتياز السياج الجغرافي وتفاصيل الشهادات المرسلة لمستلم كل حجرة
            </CardDescription>
          </div>
          <Badge variant="outline" className="text-xs">
            {items.length} سجل
          </Badge>
        </CardHeader>
        <CardContent className="p-0">
          {items.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <Building2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="font-semibold">لا توجد سجلات وصول أو إرسال مطابقة للبحث</p>
              <p className="text-xs mt-1">تأكد من شروط الفلترة أو قم بإعادة تحميل البيانات</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-start text-xs border-collapse">
                <thead>
                  <tr className="bg-muted/40 border-b border-border/60 text-muted-foreground font-semibold">
                    <th className="p-3 text-start">توقيت الوصول</th>
                    <th className="p-3 text-start">الشاحنة / الرحلة</th>
                    <th className="p-3 text-start">رصيف / موقع التفريغ</th>
                    <th className="p-3 text-start">الحجرة المبردة</th>
                    <th className="p-3 text-start">مستلم الشحنة (WhatsApp)</th>
                    <th className="p-3 text-center">حالة الإرسال</th>
                    <th className="p-3 text-center">مهلة التهدئة</th>
                    <th className="p-3 text-end">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {items.map((item) => (
                    <tr
                      key={item.id}
                      className="hover:bg-muted/30 transition-colors"
                    >
                      {/* 1. Time */}
                      <td className="p-3 whitespace-nowrap">
                        <div className="font-medium text-foreground">
                          {new Date(item.arrivedAt).toLocaleTimeString('ar-MA', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          {new Date(item.arrivedAt).toLocaleDateString('ar-MA')}
                        </div>
                      </td>

                      {/* 2. Truck / Trip */}
                      <td className="p-3 whitespace-nowrap">
                        <div className="font-bold text-foreground flex items-center gap-1.5">
                          <Truck className="w-3.5 h-3.5 text-primary" />
                          <span>{item.truckPlate}</span>
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {item.tripNumber} {item.cmrNumber ? `• ${item.cmrNumber}` : ''}
                        </div>
                      </td>

                      {/* 3. Dock / Zone */}
                      <td className="p-3">
                        <div className="font-medium text-foreground flex items-center gap-1">
                          <Building2 className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                          <span className="line-clamp-1">{item.zoneName}</span>
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          {item.zoneType || 'نطاق استلام معتمد'}
                        </div>
                      </td>

                      {/* 4. Compartment */}
                      <td className="p-3 whitespace-nowrap">
                        <div>{getCompartmentBadge(item.compartmentCode, item.cargoCategory)}</div>
                        {item.mktTempC !== undefined && (
                          <div className="text-[10px] text-muted-foreground mt-0.5">
                            MKT: <span className="font-mono font-medium">{item.mktTempC.toFixed(1)}°C</span>
                          </div>
                        )}
                      </td>

                      {/* 5. Receiver */}
                      <td className="p-3">
                        <div className="font-medium text-foreground line-clamp-1">
                          {item.receiverName}
                        </div>
                        <div className="text-[11px] font-mono text-muted-foreground flex items-center gap-1 mt-0.5">
                          <MessageSquare className="w-3 h-3 text-emerald-500 shrink-0" />
                          <span dir="ltr">{item.receiverPhone}</span>
                        </div>
                      </td>

                      {/* 6. Dispatch Status */}
                      <td className="p-3 text-center whitespace-nowrap">
                        {getStatusBadge(item.dispatchStatus)}
                      </td>

                      {/* 7. Cooldown Status */}
                      <td className="p-3 text-center whitespace-nowrap">
                        {item.isCooldownActive ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-purple-600 dark:text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-full">
                            <Clock className="w-3 h-3" />
                            <span>باقي {item.cooldownRemainingMinutes} دقيقة</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>متاح للإرسال</span>
                          </span>
                        )}
                      </td>

                      {/* 8. Actions */}
                      <td className="p-3 text-end whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {item.verificationUrl && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              title="معاينة شهادة الامتثال"
                              onClick={() => window.open(item.verificationUrl, '_blank')}
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </Button>
                          )}

                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 px-2.5 text-xs gap-1 border-primary/30 hover:bg-primary/10"
                            disabled={resendingId === item.id}
                            onClick={() => handleResend(item)}
                          >
                            <Send className={`w-3 h-3 ${resendingId === item.id ? 'animate-pulse' : ''}`} />
                            <span>{resendingId === item.id ? 'جاري الإرسال...' : 'إعادة إرسال'}</span>
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

