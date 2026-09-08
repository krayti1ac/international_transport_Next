'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Building2,
  Plus,
  ShieldCheck,
  CheckCircle2,
  Loader2,
  Power,
  Layers,
  Coins,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { createClient } from '@/lib/supabase/client';
import {
  getCompaniesAction,
  createCompanyAction,
  toggleCompanyStatusAction,
} from '../services/company.actions';
import type { Company } from '@/types/database';

export function SuperAdminCompaniesView() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [ice, setIce] = useState('');
  const [currency, setCurrency] = useState('MAD');
  const [submitting, setSubmitting] = useState(false);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const { toast } = useToast();

  const fetchCompanies = useCallback(async () => {
    setLoading(true);
    // 1. Try Server Action first
    const res = await getCompaniesAction();
    if (res.success && res.data) {
      setCompanies(res.data);
      setLoading(false);
      return;
    }

    // 2. Client-side fallback if server action had an issue
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .order('id', { ascending: true });
      if (!error && data) {
        setCompanies(data as Company[]);
      }
    } catch {
      // ignore fallback error
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCompanies();
  }, [fetchCompanies]);

  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setSubmitting(true);
    const res = await createCompanyAction({
      name: name.trim(),
      ice: ice.trim() || null,
      currency,
    });

    setSubmitting(false);

    if (!res.success) {
      toast({
        title: 'خطأ أثناء تأسيس الشركة',
        description: res.error || 'حدث خطأ غير متوقع',
        variant: 'destructive',
      });
    } else {
      toast({
        title: '✅ تمت إضافة الشركة بنجاح',
        description: `تم تسجيل "${name.trim()}" بنجاح وتفعيل بيئة العمل المستقلة.`,
      });
      setName('');
      setIce('');
      setCurrency('MAD');
      setModalOpen(false);
      fetchCompanies();
    }
  };

  const handleToggleStatus = async (comp: Company) => {
    setTogglingId(comp.id);
    const newStatus = !comp.is_active;
    const res = await toggleCompanyStatusAction(comp.id, newStatus);
    setTogglingId(null);

    if (res.success) {
      setCompanies((prev) =>
        prev.map((c) => (c.id === comp.id ? { ...c, is_active: newStatus } : c))
      );
      toast({
        title: newStatus ? 'تم تفعيل الشركة' : 'تم تعطيل الشركة',
        description: `تم تحديث حالة شركة ${comp.name} بنجاح`,
      });
    } else {
      toast({
        title: 'خطأ',
        description: res.error || 'فشل تحديث الحالة',
        variant: 'destructive',
      });
    }
  };

  const activeCompaniesCount = companies.filter((c) => c.is_active).length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-6" dir="rtl">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-card border border-border p-6 rounded-2xl shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold font-amiri text-foreground">
                إدارة الشركات والاشتراكات (Super Admin)
              </h1>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>مزود رئيسي</span>
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              التحكم المركزي بالشركات المستأجرة وعزل البيانات في المنظومة
            </p>
          </div>
        </div>
        <Button onClick={() => setModalOpen(true)} className="rounded-xl gap-2 font-semibold">
          <Plus className="w-4 h-4" />
          <span>تأسيس شركة جديدة</span>
        </Button>
      </div>

      {/* Stats Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-border shadow-xs bg-card">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">إجمالي المستأجرين (Tenants)</p>
              <h3 className="text-2xl font-bold font-mono text-foreground mt-1">
                {companies.length}
              </h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <Layers className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border shadow-xs bg-card">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">الشركات النشطة</p>
              <h3 className="text-2xl font-bold font-mono text-emerald-600 mt-1">
                {activeCompaniesCount}
              </h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border shadow-xs bg-card">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">العملات المعتمدة</p>
              <h3 className="text-2xl font-bold font-mono text-foreground mt-1">
                {Array.from(new Set(companies.map((c) => c.currency))).join(' / ') || 'MAD'}
              </h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-sky-500/10 text-sky-600 flex items-center justify-center">
              <Coins className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Companies Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-3 text-center py-16 flex flex-col items-center justify-center gap-3 text-muted-foreground">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
            <p className="text-sm">جاري تحميل بيانات الشركات...</p>
          </div>
        ) : companies.length === 0 ? (
          <div className="col-span-3 text-center py-16 bg-card rounded-2xl border border-dashed border-border p-8">
            <Building2 className="w-12 h-12 mx-auto text-muted-foreground mb-3 opacity-50" />
            <h3 className="font-bold text-foreground">لا توجد شركات مسجلة بعد</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
              ابدأ الآن بتسجيل أول شركة في المنظومة لتمكين عزل البيانات والعمليات التشغيلية.
            </p>
            <Button onClick={() => setModalOpen(true)} className="mt-4 rounded-xl gap-2 text-xs">
              <Plus className="w-4 h-4" />
              <span>تأسيس شركة الآن</span>
            </Button>
          </div>
        ) : (
          companies.map((comp) => (
            <Card key={comp.id} className="border-border shadow-xs bg-card flex flex-col justify-between hover:border-primary/40 transition-colors">
              <div>
                <CardHeader className="pb-3 border-b flex flex-row items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                      <Building2 className="w-4 h-4" />
                    </div>
                    <CardTitle className="text-base font-bold text-foreground">{comp.name}</CardTitle>
                  </div>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                      comp.is_active
                        ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                        : 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {comp.is_active ? 'نشطة' : 'متوقفة'}
                  </span>
                </CardHeader>
                <CardContent className="pt-4 space-y-2.5 text-xs">
                  <div className="flex justify-between items-center text-muted-foreground">
                    <span>المعرف (Tenant ID):</span>
                    <span className="font-mono font-bold text-foreground bg-muted px-2 py-0.5 rounded-md">
                      #{comp.id}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-muted-foreground">
                    <span>رقم ICE:</span>
                    <span className="font-mono text-foreground">{comp.ice || 'غير محدد'}</span>
                  </div>
                  <div className="flex justify-between items-center text-muted-foreground">
                    <span>العملة الافتراضية:</span>
                    <span className="font-mono font-bold text-primary">{comp.currency}</span>
                  </div>
                </CardContent>
              </div>

              <div className="p-4 pt-2 border-t border-border mt-3 flex items-center justify-between">
                <span className="text-[11px] text-muted-foreground">
                  {comp.is_active ? 'البيئة تعمل بكفاءة' : 'معطلة عن التشغيل'}
                </span>
                <Button
                  size="sm"
                  variant={comp.is_active ? 'outline' : 'default'}
                  disabled={togglingId === comp.id}
                  onClick={() => handleToggleStatus(comp)}
                  className="rounded-lg h-7 text-xs gap-1.5 px-2.5"
                >
                  {togglingId === comp.id ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Power className="w-3 h-3" />
                  )}
                  <span>{comp.is_active ? 'تعطيل' : 'تفعيل'}</span>
                </Button>
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Modal to create new company */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <Card className="w-full max-w-md border-border shadow-xl bg-card">
            <CardHeader className="border-b pb-3">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-primary" />
                <CardTitle className="text-base font-bold font-amiri">
                  تسجيل شركة جديدة في المنظومة
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              <form onSubmit={handleCreateCompany} className="space-y-4 text-xs">
                <div className="space-y-1.5">
                  <label className="font-semibold text-foreground">اسم الشركة التجارية *</label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="مثال: أطلس للتنقل الدولي"
                    required
                    className="rounded-xl h-10"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="font-semibold text-foreground">رقم التعريف الموحد (ICE)</label>
                  <Input
                    value={ice}
                    onChange={(e) => setIce(e.target.value)}
                    placeholder="001928374000082"
                    className="rounded-xl h-10 font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="font-semibold text-foreground">العملة الافتراضية</label>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="w-full h-10 px-3 border border-input rounded-xl bg-card text-foreground font-bold"
                  >
                    <option value="MAD">MAD (درهم مغربي)</option>
                    <option value="EUR">EUR (يورو)</option>
                    <option value="USD">USD (دولار أمريكي)</option>
                  </select>
                </div>
                <div className="flex justify-end gap-2 pt-3 border-t">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setModalOpen(false)}
                    className="rounded-xl"
                  >
                    إلغاء
                  </Button>
                  <Button type="submit" disabled={submitting} className="rounded-xl gap-2">
                    {submitting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4" />
                    )}
                    <span>حفظ وتأسيس البيئة</span>
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
