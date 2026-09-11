'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Bug,
  Sparkles,
  Copy,
  Check,
  Download,
  AlertTriangle,
  Laptop,
  Smartphone,
  Tablet,
  RefreshCw,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  PlayCircle,
  ShieldCheck,
  Eye,
  MessageSquare,
  FileSpreadsheet,
  Trash2,
  CheckSquare,
  Square,
  CheckCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { exportToCSV } from '@/lib/export';
import type {
  SystemScreenIssue,
  ScreenIssueSeverity,
  ScreenIssueStatus,
} from '@/types/database';
import {
  getScreenIssuesAction,
  updateScreenIssueStatusAction,
  deleteScreenIssueAction,
  simulateTestIssueAction,
  diagnoseIssueWithGeminiAction,
  sendIssueWhatsAppAlertAction,
  bulkUpdateScreenIssuesStatusAction,
  bulkDeleteScreenIssuesAction,
} from '../services/screen-issues.actions';

const SEVERITY_CONFIG: Record<ScreenIssueSeverity, { label: string; badge: string }> = {
  critical: { label: 'حرجة جداً', badge: 'bg-rose-500/15 text-rose-600 border-rose-500/30' },
  high: { label: 'عالية', badge: 'bg-orange-500/15 text-orange-600 border-orange-500/30' },
  medium: { label: 'متوسطة', badge: 'bg-amber-500/15 text-amber-600 border-amber-500/30' },
  low: { label: 'منخفضة', badge: 'bg-slate-500/15 text-slate-600 border-slate-500/30' },
};

const STATUS_CONFIG: Record<ScreenIssueStatus, { label: string; badge: string; icon: React.ComponentType<{ className?: string }> }> = {
  open: { label: 'جديدة / مفتوحة', badge: 'bg-red-500/15 text-red-600 border-red-500/30', icon: AlertTriangle },
  investigating: { label: 'قيد التشخيص', badge: 'bg-amber-500/15 text-amber-600 border-amber-500/30', icon: Clock },
  resolved: { label: 'تم الحل', badge: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30', icon: CheckCircle2 },
  ignored: { label: 'مستبعدة', badge: 'bg-slate-500/15 text-slate-500 border-slate-500/30', icon: XCircle },
};

export function SuperAdminScreenIssuesView() {
  const [issues, setIssues] = useState<SystemScreenIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');

  // Modal State
  const [activeIssue, setActiveIssue] = useState<SystemScreenIssue | null>(null);
  const [copiedPromptId, setCopiedPromptId] = useState<string | null>(null);
  const [aiNotes, setAiNotes] = useState('');
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [diagnosingId, setDiagnosingId] = useState<string | null>(null);
  const [sendingWhatsAppId, setSendingWhatsAppId] = useState<string | null>(null);

  // Bulk Selection & Tool State
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkLoading, setIsBulkLoading] = useState(false);
  const [showSimMenu, setShowSimMenu] = useState(false);

  const { toast } = useToast();

  const fetchIssues = useCallback(async () => {
    setLoading(true);
    const res = await getScreenIssuesAction();
    if (res.success && res.data) {
      setIssues(res.data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchIssues();
  }, [fetchIssues]);

  const filteredIssues = useMemo(() => {
    return issues.filter((i) => {
      if (statusFilter !== 'all' && i.status !== statusFilter) return false;
      if (severityFilter !== 'all' && i.severity !== severityFilter) return false;
      if (typeFilter !== 'all' && i.issue_type !== typeFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchRoute = i.screen_route?.toLowerCase().includes(q);
        const matchName = i.screen_name?.toLowerCase().includes(q);
        const matchErr = i.error_message?.toLowerCase().includes(q);
        const matchDev = i.device_id?.toLowerCase().includes(q);
        const matchUser = i.user_name?.toLowerCase().includes(q) || i.user_email?.toLowerCase().includes(q);
        if (!matchRoute && !matchName && !matchErr && !matchDev && !matchUser) return false;
      }
      return true;
    });
  }, [issues, statusFilter, severityFilter, typeFilter, search]);

  const stats = useMemo(() => {
    const total = issues.length;
    const open = issues.filter((i) => i.status === 'open').length;
    const critical = issues.filter((i) => i.severity === 'critical' || i.severity === 'high').length;
    const resolved = issues.filter((i) => i.status === 'resolved').length;
    const resolutionRate = total > 0 ? Math.round((resolved / total) * 100) : 100;
    const devices = new Set(issues.map((i) => i.device_id)).size;
    return { total, open, critical, resolved, resolutionRate, devices };
  }, [issues]);

  const handleCopyPrompt = async (promptText?: string | null, issueId?: string) => {
    if (!promptText) return;
    try {
      await navigator.clipboard.writeText(promptText);
      if (issueId) {
        setCopiedPromptId(issueId);
        setTimeout(() => setCopiedPromptId(null), 2500);
      }
      toast({
        title: '📋 تم نسخ البرومبت بنجاح',
        description: 'يمكنك الآن لصقه مباشرة في نموذج الذكاء الاصطناعي لتحليله.',
      });
    } catch {
      toast({ title: 'خطأ', description: 'تعذر النسخ إلى الحافظة', variant: 'destructive' });
    }
  };

  const handleDownloadPrompt = (issue: SystemScreenIssue) => {
    const blob = new Blob([issue.ai_diagnostic_prompt || issue.error_message], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ai-issue-${issue.id.slice(0, 8)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSimulate = async (scenario: 'fuel' | 'trip' | 'invoice') => {
    setSimulating(true);
    try {
      const res = await simulateTestIssueAction(scenario);
      if (res.success) {
        toast({ title: '🧪 تمت المحاكاة بنجاح', description: 'تم إنشاء مشكلة إدخال تجريبية وتوليد البرومبت.' });
        fetchIssues();
      } else {
        toast({ title: 'خطأ', description: res.error, variant: 'destructive' });
      }
    } finally {
      setSimulating(false);
      setShowSimMenu(false);
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleToggleSelectAll = () => {
    if (selectedIds.size === filteredIssues.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredIssues.map((i) => i.id)));
    }
  };

  const handleBulkStatusChange = async (newStatus: ScreenIssueStatus) => {
    if (selectedIds.size === 0) return;
    setIsBulkLoading(true);
    try {
      const idsArray = Array.from(selectedIds);
      const res = await bulkUpdateScreenIssuesStatusAction(idsArray, newStatus);
      if (res.success) {
        toast({
          title: '✅ تم التحديث المجمع بنجاح',
          description: `تم نقل ${res.count || idsArray.length} سجل إلى: ${STATUS_CONFIG[newStatus].label}`,
        });
        setSelectedIds(new Set());
        fetchIssues();
      } else {
        toast({ title: 'خطأ', description: res.error, variant: 'destructive' });
      }
    } finally {
      setIsBulkLoading(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`هل أنت متأكد من حذف ${selectedIds.size} سجل بشكل نهائي؟`)) return;
    setIsBulkLoading(true);
    try {
      const idsArray = Array.from(selectedIds);
      const res = await bulkDeleteScreenIssuesAction(idsArray);
      if (res.success) {
        toast({
          title: '🗑️ تم الحذف المجمع بنجاح',
          description: `تم حذف ${res.count || idsArray.length} سجل من قاعدة البيانات.`,
        });
        setSelectedIds(new Set());
        fetchIssues();
      } else {
        toast({ title: 'خطأ', description: res.error, variant: 'destructive' });
      }
    } finally {
      setIsBulkLoading(false);
    }
  };

  const handleExportCSV = () => {
    if (filteredIssues.length === 0) {
      toast({ title: 'تنبيه', description: 'لا توجد سجلات لتصديرها حالياً.' });
      return;
    }

    exportToCSV(
      filteredIssues,
      [
        { header: 'المعرف', key: (i) => i.id.slice(0, 8) },
        { header: 'تاريخ التسجيل', key: (i) => new Date(i.created_at).toLocaleString('ar-MA') },
        { header: 'الشاشة', key: 'screen_name' },
        { header: 'المسار', key: 'screen_route' },
        { header: 'الخطأ', key: 'error_message' },
        { header: 'الحقل', key: (i) => i.field_name || '' },
        { header: 'المستخدم', key: (i) => i.user_name || i.user_email || '' },
        { header: 'الشركة', key: (i) => i.company_name || '' },
        { header: 'الأهمية', key: (i) => SEVERITY_CONFIG[i.severity]?.label || i.severity },
        { header: 'الحالة', key: (i) => STATUS_CONFIG[i.status]?.label || i.status },
        { header: 'نوع الجهاز', key: 'device_type' },
        { header: 'معرف الجهاز', key: 'device_id' },
        { header: 'حل الذكاء الاصطناعي', key: (i) => i.ai_solution_notes || '' },
      ],
      'system_screen_issues_report'
    );
    toast({ title: '📊 تم تصدير التقرير بنجاح' });
  };

  const handleRunGeminiDiagnosis = async (issueId: string) => {
    setDiagnosingId(issueId);
    try {
      const res = await diagnoseIssueWithGeminiAction(issueId);
      if (res.success && res.notes) {
        toast({
          title: '✨ تم إكمال التشخيص الذكي بنجاح',
          description: 'تم تحليل سبب الخطأ وتوليد الحل البرمجي والتوجيهات من Gemini.',
        });
        setAiNotes(res.notes);
        if (activeIssue && activeIssue.id === issueId) {
          setActiveIssue((prev) =>
            prev
              ? {
                  ...prev,
                  ai_solution_notes: res.notes,
                  status: prev.status === 'open' ? 'investigating' : prev.status,
                }
              : null
          );
        }
        setIssues((prev) =>
          prev.map((i) =>
            i.id === issueId
              ? {
                  ...i,
                  ai_solution_notes: res.notes,
                  status: i.status === 'open' ? 'investigating' : i.status,
                }
              : i
          )
        );
      } else {
        toast({
          title: 'تعذر إتمام التشخيص الذكي',
          description: res.error || 'حدث خطأ أثناء التواصل مع نموذج Gemini',
          variant: 'destructive',
        });
      }
    } finally {
      setDiagnosingId(null);
    }
  };

  const handleSendWhatsAppAlert = async (issueId: string) => {
    setSendingWhatsAppId(issueId);
    try {
      const res = await sendIssueWhatsAppAlertAction(issueId);
      if (res.success) {
        toast({
          title: '📱 تم إرسال تنبيه الواتساب',
          description: 'تم إرسال إشعار فوري بكافة تفاصيل الخطأ إلى هاتف الإدارة المعتمد.',
        });
      } else {
        toast({
          title: 'تعذر إرسال الواتساب',
          description: res.error || 'حدث خطأ أثناء التواصل مع بوابة الواتساب',
          variant: 'destructive',
        });
      }
    } finally {
      setSendingWhatsAppId(null);
    }
  };

  const handleStatusChange = async (issueId: string, newStatus: ScreenIssueStatus) => {
    setUpdatingStatus(true);
    try {
      const res = await updateScreenIssueStatusAction(issueId, newStatus, aiNotes || undefined);
      if (res.success) {
        toast({ title: 'تم التحديث', description: `تم نقل الحالة إلى: ${STATUS_CONFIG[newStatus].label}` });
        if (activeIssue && activeIssue.id === issueId) {
          setActiveIssue({ ...activeIssue, status: newStatus, ai_solution_notes: aiNotes || activeIssue.ai_solution_notes });
        }
        fetchIssues();
      }
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('هل أنت متأكد من حذف سجل هذه المشكلة؟')) return;
    const res = await deleteScreenIssueAction(id);
    if (res.success) {
      toast({ title: 'تم الحذف' });
      if (activeIssue?.id === id) setActiveIssue(null);
      fetchIssues();
    }
  };

  const renderDeviceIcon = (type?: string | null) => {
    if (type === 'mobile') return <Smartphone className="w-3.5 h-3.5 text-blue-500" />;
    if (type === 'tablet') return <Tablet className="w-3.5 h-3.5 text-purple-500" />;
    return <Laptop className="w-3.5 h-3.5 text-emerald-500" />;
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 sm:p-6" dir="rtl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-card border border-border p-5 rounded-2xl shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
            <Bug className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-foreground">
                تتبع مشاكل الإدخال والشاشات (AI Diagnostic Tracker)
              </h1>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/30">
                <Sparkles className="w-3 h-3" />
                <span>AI-Ready</span>
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              مراقبة وتوثيق أخطاء إدخال البيانات عبر الشاشات والأجهزة وتوليد برومبتات تشخيص فورية
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchIssues}
            disabled={loading}
            className="rounded-xl gap-1.5 h-9 text-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>تحديث</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            className="rounded-xl gap-1.5 h-9 text-xs border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10"
            title="تصدير السجلات إلى ملف Excel / CSV"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>تصدير CSV</span>
          </Button>

          {/* Test Simulation Controls Menu */}
          <div className="relative inline-flex">
            <Button
              variant="outline"
              size="sm"
              disabled={simulating}
              onClick={() => setShowSimMenu(!showSimMenu)}
              className="rounded-xl gap-1.5 h-9 text-xs border-dashed border-amber-500/40 text-amber-600 hover:bg-amber-500/10"
              title="محاكاة تسجيل أخطاء تجريبية"
            >
              <PlayCircle className="w-3.5 h-3.5" />
              <span>محاكاة خطأ تجريبي</span>
            </Button>

            {showSimMenu && (
              <div className="absolute left-0 top-full mt-1.5 z-50 w-52 bg-card border border-border rounded-xl shadow-xl p-1.5 space-y-1 animate-in fade-in zoom-in-95 text-xs">
                <p className="text-[10px] font-bold text-muted-foreground px-2 py-1">اختر سيناريو المحاكاة:</p>
                <button
                  type="button"
                  onClick={() => handleSimulate('fuel')}
                  className="w-full text-start px-2.5 py-1.5 rounded-lg hover:bg-muted text-foreground flex items-center justify-between"
                >
                  <span>⛽ وصل وقود (OCR)</span>
                  <span className="text-[10px] text-amber-600 font-bold">متوسط</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSimulate('trip')}
                  className="w-full text-start px-2.5 py-1.5 rounded-lg hover:bg-muted text-foreground flex items-center justify-between"
                >
                  <span>🚚 تكرار رقم الـ CMR</span>
                  <span className="text-[10px] text-orange-600 font-bold">عالي</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSimulate('invoice')}
                  className="w-full text-start px-2.5 py-1.5 rounded-lg hover:bg-muted text-foreground flex items-center justify-between"
                >
                  <span>🧾 تعارض حساب الضريبة TTC</span>
                  <span className="text-[10px] text-rose-600 font-bold">حرج</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5">
        <Card className="border-border shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] text-muted-foreground font-semibold">إجمالي المشاكل</p>
              <h3 className="text-2xl font-bold font-mono text-foreground mt-0.5">{stats.total}</h3>
            </div>
            <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <Bug className="w-4 h-4" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] text-muted-foreground font-semibold">المشاكل المفتوحة</p>
              <h3 className="text-2xl font-bold font-mono text-rose-600 mt-0.5">{stats.open}</h3>
            </div>
            <div className="w-9 h-9 rounded-xl bg-rose-500/10 text-rose-600 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] text-muted-foreground font-semibold">حرجة / عالية</p>
              <h3 className="text-2xl font-bold font-mono text-orange-600 mt-0.5">{stats.critical}</h3>
            </div>
            <div className="w-9 h-9 rounded-xl bg-orange-500/10 text-orange-600 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] text-muted-foreground font-semibold">معدل الحل</p>
              <h3 className="text-2xl font-bold font-mono text-emerald-600 mt-0.5">{stats.resolutionRate}%</h3>
            </div>
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
              <CheckCheck className="w-4 h-4" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border shadow-xs col-span-2 sm:col-span-1">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] text-muted-foreground font-semibold">الأجهزة المتأثرة</p>
              <h3 className="text-2xl font-bold font-mono text-blue-600 mt-0.5">{stats.devices}</h3>
            </div>
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center">
              <Laptop className="w-4 h-4" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Floating Bulk Actions Bar */}
      {selectedIds.size > 0 && (
        <div className="sticky top-4 z-40 bg-card border-2 border-primary/40 rounded-2xl p-3.5 shadow-xl flex flex-wrap items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-xl bg-primary text-primary-foreground flex items-center justify-center font-bold text-xs">
              {selectedIds.size}
            </span>
            <div>
              <p className="text-xs font-bold text-foreground">
                تم تحديد {selectedIds.size} سجل مشكلة
              </p>
              <p className="text-[10px] text-muted-foreground">
                تطبيق إجراء مجمع فوري على كافة المشاكل المحددة
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="default"
              size="sm"
              disabled={isBulkLoading}
              onClick={() => handleBulkStatusChange('resolved')}
              className="h-8 text-xs rounded-xl gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>إغلاق وحل المحدد</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              disabled={isBulkLoading}
              onClick={() => handleBulkStatusChange('investigating')}
              className="h-8 text-xs rounded-xl gap-1.5 text-amber-600 border-amber-500/30 hover:bg-amber-500/10"
            >
              <Clock className="w-3.5 h-3.5" />
              <span>نقل لقيد التشخيص</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              disabled={isBulkLoading}
              onClick={() => handleBulkStatusChange('ignored')}
              className="h-8 text-xs rounded-xl gap-1.5"
            >
              <XCircle className="w-3.5 h-3.5" />
              <span>استبعاد</span>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              disabled={isBulkLoading}
              onClick={handleBulkDelete}
              className="h-8 text-xs rounded-xl gap-1.5 text-rose-600 hover:bg-rose-500/10"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>حذف المحدد</span>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedIds(new Set())}
              className="h-8 text-xs rounded-xl text-muted-foreground"
            >
              إلغاء التحديد
            </Button>
          </div>
        </div>
      )}

      {/* Filters Bar */}
      <Card className="border-border shadow-xs">
        <CardContent className="p-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[280px]">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="بحث بالشاشة، الخطأ، الجهاز، المستخدم..."
                className="h-9 pr-9 text-xs rounded-xl"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-9 rounded-xl border border-input bg-background px-3 text-xs"
            >
              <option value="all">كافة الحالات</option>
              <option value="open">مفتوحة (Open)</option>
              <option value="investigating">قيد التشخيص</option>
              <option value="resolved">تم الحل</option>
              <option value="ignored">مستبعدة</option>
            </select>

            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="h-9 rounded-xl border border-input bg-background px-3 text-xs"
            >
              <option value="all">كافة المستويات</option>
              <option value="critical">حرجة جداً</option>
              <option value="high">عالية</option>
              <option value="medium">متوسطة</option>
              <option value="low">منخفضة</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 border border-border rounded-xl p-0.5 bg-muted/30">
            <Button
              variant={viewMode === 'cards' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('cards')}
              className="h-7 text-xs rounded-lg px-2.5"
            >
              بطاقات
            </Button>
            <Button
              variant={viewMode === 'table' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('table')}
              className="h-7 text-xs rounded-lg px-2.5"
            >
              جدول
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Main Content Area */}
      {loading ? (
        <div className="py-20 text-center flex flex-col items-center justify-center gap-3 text-muted-foreground">
          <RefreshCw className="w-8 h-8 animate-spin text-primary" />
          <p className="text-xs">جاري فحص وتجميع أخطاء الإدخال والشاشات...</p>
        </div>
      ) : filteredIssues.length === 0 ? (
        <div className="py-16 text-center border border-dashed rounded-2xl bg-card/50">
          <CheckCircle2 className="w-12 h-12 text-emerald-500/60 mx-auto mb-2" />
          <h4 className="text-sm font-bold text-foreground">لا توجد أخطاء مسجلة تطابق الفلاتر</h4>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
            النظام لم يسجل أي تعارضات أو أخطاء إدخال، أو يمكنك تجربة زر &quot;محاكاة خطأ تجريبي&quot; لاختبار الآلية.
          </p>
        </div>
      ) : viewMode === 'cards' ? (
        /* Cards Grid Mode */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredIssues.map((issue) => {
            const sev = SEVERITY_CONFIG[issue.severity] || SEVERITY_CONFIG.medium;
            const sta = STATUS_CONFIG[issue.status] || STATUS_CONFIG.open;
            return (
              <Card
                key={issue.id}
                className="border-border hover:border-primary/40 transition-all shadow-xs flex flex-col justify-between overflow-hidden group"
              >
                <div className="p-4 space-y-3">
                  {/* Card Header Tags */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleToggleSelect(issue.id)}
                        className="text-muted-foreground hover:text-primary transition-colors"
                        title={selectedIds.has(issue.id) ? 'إلغاء التحديد' : 'تحديد'}
                      >
                        {selectedIds.has(issue.id) ? (
                          <CheckSquare className="w-4 h-4 text-primary" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>
                      <span className="flex items-center gap-1 text-[11px] font-mono text-muted-foreground">
                        {renderDeviceIcon(issue.device_type)}
                        <span>{issue.device_id.slice(0, 12)}...</span>
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Badge variant="outline" className={`text-[10px] font-bold ${sev.badge}`}>
                        {sev.label}
                      </Badge>
                      <Badge variant="outline" className={`text-[10px] font-bold ${sta.badge}`}>
                        {sta.label}
                      </Badge>
                    </div>
                  </div>

                  {/* Route & Screen */}
                  <div>
                    <h3 className="text-sm font-bold text-foreground group-hover:text-primary transition-colors flex items-center gap-1.5">
                      <span>{issue.screen_name}</span>
                    </h3>
                    <p className="text-[11px] font-mono text-muted-foreground mt-0.5 truncate" dir="ltr">
                      {issue.screen_route}
                    </p>
                  </div>

                  {/* Error Snippet */}
                  <div className="p-2.5 rounded-xl bg-muted/50 border border-border/80 text-xs">
                    <p className="font-semibold text-rose-600 line-clamp-2 leading-relaxed">
                      {issue.error_message}
                    </p>
                    {issue.field_name && (
                      <p className="text-[10px] text-muted-foreground mt-1 font-mono">
                        الحقل المتأثر: <span className="text-foreground font-bold">{issue.field_name}</span>
                      </p>
                    )}
                  </div>

                  {/* User & Company Info */}
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-border/50">
                    <span className="truncate max-w-[140px]">
                      {issue.user_name || issue.user_email || 'مستخدم غير محدد'}
                    </span>
                    <span className="font-mono text-[10px]">
                      {new Date(issue.created_at).toLocaleDateString('ar-MA')}
                    </span>
                  </div>
                </div>

                {/* Card Footer Actions */}
                <div className="p-3 bg-muted/20 border-t border-border flex items-center justify-between gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setActiveIssue(issue);
                      setAiNotes(issue.ai_solution_notes || '');
                    }}
                    className="rounded-xl text-xs h-8 gap-1 flex-1 font-semibold"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>تشخيص ومعاينة</span>
                  </Button>

                  <Button
                    variant="default"
                    size="sm"
                    disabled={diagnosingId === issue.id}
                    onClick={() => handleRunGeminiDiagnosis(issue.id)}
                    className="rounded-xl text-xs h-8 gap-1 font-bold bg-purple-600 hover:bg-purple-700 text-white"
                    title="تشخيص فوري باستخدام Gemini 2.5 Flash"
                  >
                    {diagnosingId === issue.id ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="w-3.5 h-3.5" />
                    )}
                    <span>Gemini</span>
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    disabled={sendingWhatsAppId === issue.id}
                    onClick={() => handleSendWhatsAppAlert(issue.id)}
                    className="rounded-xl text-xs h-8 px-2 font-semibold text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/10"
                    title="إرسال تنبيه عبر الواتساب للمشرف"
                  >
                    {sendingWhatsAppId === issue.id ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <MessageSquare className="w-3.5 h-3.5" />
                    )}
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleCopyPrompt(issue.ai_diagnostic_prompt, issue.id)}
                    className="rounded-xl text-xs h-8 px-2.5 font-semibold"
                    title="نسخ تقرير الذكاء الاصطناعي"
                  >
                    {copiedPromptId === issue.id ? (
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        /* Table Mode */
        <Card className="border-border overflow-hidden">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-muted-foreground">
                    <th className="py-3 px-3.5 text-center w-10">
                      <button
                        type="button"
                        onClick={handleToggleSelectAll}
                        className="text-muted-foreground hover:text-primary transition-colors inline-flex items-center justify-center"
                        title={selectedIds.size === filteredIssues.length ? 'إلغاء تحديد الكل' : 'تحديد الكل'}
                      >
                        {selectedIds.size > 0 && selectedIds.size === filteredIssues.length ? (
                          <CheckSquare className="w-4 h-4 text-primary" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>
                    </th>
                    <th className="py-3 px-3.5 text-start font-semibold">الشاشة والمسار</th>
                    <th className="py-3 px-3.5 text-start font-semibold">نوع ومستوى الخطأ</th>
                    <th className="py-3 px-3.5 text-start font-semibold">رسالة الخطأ</th>
                    <th className="py-3 px-3.5 text-start font-semibold">الجهاز والمستخدم</th>
                    <th className="py-3 px-3.5 text-start font-semibold">الحالة</th>
                    <th className="py-3 px-3.5 text-end font-semibold">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filteredIssues.map((issue) => {
                    const sev = SEVERITY_CONFIG[issue.severity] || SEVERITY_CONFIG.medium;
                    const sta = STATUS_CONFIG[issue.status] || STATUS_CONFIG.open;
                    const isSelected = selectedIds.has(issue.id);
                    return (
                      <tr key={issue.id} className={`transition-colors ${isSelected ? 'bg-primary/5' : 'hover:bg-muted/30'}`}>
                        <td className="py-3 px-3.5 text-center">
                          <button
                            type="button"
                            onClick={() => handleToggleSelect(issue.id)}
                            className="text-muted-foreground hover:text-primary transition-colors inline-flex items-center justify-center"
                          >
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-primary" />
                            ) : (
                              <Square className="w-4 h-4" />
                            )}
                          </button>
                        </td>
                        <td className="py-3 px-3.5">
                          <p className="font-bold text-foreground">{issue.screen_name}</p>
                          <p className="text-[10px] text-muted-foreground font-mono" dir="ltr">{issue.screen_route}</p>
                        </td>
                        <td className="py-3 px-3.5 space-y-1">
                          <Badge variant="outline" className={`text-[10px] font-bold ${sev.badge}`}>
                            {sev.label}
                          </Badge>
                          <p className="text-[10px] text-muted-foreground font-mono">{issue.issue_type}</p>
                        </td>
                        <td className="py-3 px-3.5 max-w-xs">
                          <p className="truncate text-rose-600 font-semibold">{issue.error_message}</p>
                          {issue.field_name && (
                            <span className="text-[10px] text-muted-foreground font-mono">حقل: {issue.field_name}</span>
                          )}
                        </td>
                        <td className="py-3 px-3.5">
                          <div className="flex items-center gap-1 text-[11px] font-bold text-foreground">
                            {renderDeviceIcon(issue.device_type)}
                            <span>{issue.user_name || 'غير محدد'}</span>
                          </div>
                          <p className="text-[10px] text-muted-foreground font-mono">{issue.device_id.slice(0, 10)}</p>
                        </td>
                        <td className="py-3 px-3.5">
                          <Badge variant="outline" className={`text-[10px] font-bold ${sta.badge}`}>
                            {sta.label}
                          </Badge>
                        </td>
                        <td className="py-3 px-3.5 text-end space-x-1.5 space-x-reverse whitespace-nowrap">
                          <Button
                            variant="default"
                            size="sm"
                            disabled={diagnosingId === issue.id}
                            onClick={() => handleRunGeminiDiagnosis(issue.id)}
                            className="h-7 text-xs rounded-lg gap-1 bg-purple-600 hover:bg-purple-700 text-white font-bold"
                          >
                            {diagnosingId === issue.id ? (
                              <RefreshCw className="w-3 h-3 animate-spin" />
                            ) : (
                              <Sparkles className="w-3 h-3" />
                            )}
                            <span>Gemini</span>
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={sendingWhatsAppId === issue.id}
                            onClick={() => handleSendWhatsAppAlert(issue.id)}
                            className="h-7 text-xs rounded-lg gap-1 text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/10"
                            title="إرسال تنبيه عبر الواتساب للمشرف"
                          >
                            {sendingWhatsAppId === issue.id ? (
                              <RefreshCw className="w-3 h-3 animate-spin" />
                            ) : (
                              <MessageSquare className="w-3 h-3" />
                            )}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleCopyPrompt(issue.ai_diagnostic_prompt, issue.id)}
                            className="h-7 text-xs rounded-lg gap-1"
                          >
                            <Copy className="w-3 h-3" />
                            <span>نسخ</span>
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setActiveIssue(issue);
                              setAiNotes(issue.ai_solution_notes || '');
                            }}
                            className="h-7 text-xs rounded-lg gap-1"
                          >
                            <Eye className="w-3 h-3" />
                            <span>معاينة</span>
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Detailed Diagnostic & AI Modal */}
      {activeIssue && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
          <Card className="w-full max-w-3xl border-border shadow-2xl my-auto">
            <CardHeader className="border-b border-border py-4 px-5 flex flex-row items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <CardTitle className="text-base font-bold">
                    تشخيص المشكلة وتوليد حل الذكاء الاصطناعي
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {activeIssue.screen_name} • {activeIssue.screen_route}
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setActiveIssue(null)}
                className="rounded-xl text-xs h-8"
              >
                إغلاق
              </Button>
            </CardHeader>

            <CardContent className="p-5 space-y-4 max-h-[75vh] overflow-y-auto text-xs">
              {/* Quick Info Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-2.5 rounded-xl bg-muted/40 border border-border">
                  <span className="text-[10px] text-muted-foreground block">نوع المشكلة</span>
                  <span className="font-bold text-foreground font-mono">{activeIssue.issue_type}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-muted/40 border border-border">
                  <span className="text-[10px] text-muted-foreground block">مستوى الأهمية</span>
                  <span className="font-bold text-foreground">{SEVERITY_CONFIG[activeIssue.severity]?.label}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-muted/40 border border-border">
                  <span className="text-[10px] text-muted-foreground block">الجهاز ونظامه</span>
                  <span className="font-bold text-foreground font-mono">
                    {activeIssue.device_type} / {((activeIssue.device_info as Record<string, unknown>)?.os as string) || 'OS'}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-muted/40 border border-border">
                  <span className="text-[10px] text-muted-foreground block">الحالة الحالية</span>
                  <span className="font-bold text-foreground">{STATUS_CONFIG[activeIssue.status]?.label}</span>
                </div>
              </div>

              {/* Error Message */}
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-400">
                <p className="font-bold">نص رسالة الخطأ:</p>
                <p className="mt-1 font-mono text-xs whitespace-pre-wrap">{activeIssue.error_message}</p>
              </div>

              {/* AI Diagnostic Prompt Box */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-foreground flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-amber-500" />
                    <span>التقرير الجاهز للذكاء الاصطناعي (AI Diagnostic Prompt):</span>
                  </label>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="default"
                      size="sm"
                      disabled={diagnosingId === activeIssue.id}
                      onClick={() => handleRunGeminiDiagnosis(activeIssue.id)}
                      className="h-7 text-xs rounded-lg gap-1.5 bg-purple-600 hover:bg-purple-700 text-white font-bold"
                    >
                      {diagnosingId === activeIssue.id ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="w-3.5 h-3.5" />
                      )}
                      <span>تشخيص مباشر عبر Gemini</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={sendingWhatsAppId === activeIssue.id}
                      onClick={() => handleSendWhatsAppAlert(activeIssue.id)}
                      className="h-7 text-xs rounded-lg gap-1.5 border-emerald-600/40 text-emerald-600 hover:bg-emerald-500/10 font-bold"
                      title="إرسال إشعار فوري بكافة تفاصيل الخطأ عبر الواتساب للإدارة"
                    >
                      {sendingWhatsAppId === activeIssue.id ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <MessageSquare className="w-3.5 h-3.5" />
                      )}
                      <span>تنبيه واتساب</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownloadPrompt(activeIssue)}
                      className="h-7 text-xs rounded-lg gap-1"
                    >
                      <Download className="w-3 h-3" />
                      <span>تنزيل .md</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCopyPrompt(activeIssue.ai_diagnostic_prompt, activeIssue.id)}
                      className="h-7 text-xs rounded-lg gap-1"
                    >
                      {copiedPromptId === activeIssue.id ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                      <span>نسخ البرومبت</span>
                    </Button>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-900 text-slate-100 font-mono text-[11px] max-h-52 overflow-y-auto leading-relaxed border border-slate-800" dir="ltr">
                  <pre className="whitespace-pre-wrap">
                    {activeIssue.ai_diagnostic_prompt || 'No AI prompt pre-formatted.'}
                  </pre>
                </div>
              </div>

              {/* AI Solution & Resolution Notes */}
              <div className="space-y-2 pt-2 border-t border-border">
                <label className="font-bold text-foreground block">
                  ملاحظات الحل ورد الذكاء الاصطناعي (AI Solution Notes):
                </label>
                <textarea
                  value={aiNotes}
                  onChange={(e) => setAiNotes(e.target.value)}
                  placeholder="ألصق هنا الرد البرمجي أو التوصيات المستلمة من الذكاء الاصطناعي لحفظها كمرجع للحل..."
                  rows={3}
                  className="w-full rounded-xl border border-input bg-background p-3 text-xs focus:ring-1 focus:ring-primary outline-hidden"
                />
              </div>

              {/* Status Action Buttons */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-border">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(activeIssue.id)}
                  className="text-rose-600 hover:bg-rose-500/10 text-xs rounded-xl h-8"
                >
                  حذف السجل
                </Button>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={updatingStatus}
                    onClick={() => handleStatusChange(activeIssue.id, 'investigating')}
                    className="text-xs rounded-xl h-8 text-amber-600"
                  >
                    قيد التشخيص
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={updatingStatus}
                    onClick={() => handleStatusChange(activeIssue.id, 'ignored')}
                    className="text-xs rounded-xl h-8"
                  >
                    استبعاد
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    disabled={updatingStatus}
                    onClick={() => handleStatusChange(activeIssue.id, 'resolved')}
                    className="text-xs rounded-xl h-8 bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                  >
                    تم الحل بنجاح
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
