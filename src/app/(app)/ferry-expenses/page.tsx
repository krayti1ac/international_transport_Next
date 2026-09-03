'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  Ship,
  Plus,
  Search,
  Receipt,
  Trash2,
} from 'lucide-react';
import type { TripOrder } from '@/types/database';

interface FerryExpense {
  id: number;
  trip_order_id?: number | null;
  advance_id?: number | null;
  expense_type: string;
  amount: number;
  currency: string;
  description?: string | null;
  receipt_url?: string | null;
  expense_date: string;
  created_at?: string;
}

const EXPENSE_TYPES = [
  { value: 'all', label: 'جميع الأنواع' },
  { value: 'ferry_ticket', label: 'تذكرة باخرة' },
  { value: 'port_inspection', label: 'تفتيش الميناء' },
  { value: 'customs_fee', label: 'رسوم جمركية' },
  { value: 'terminal_fee', label: 'رسوم المحطة' },
  { value: 'port_parking', label: 'وقوف في الميناء' },
  { value: 'port_other', label: 'مصاريف موانئ أخرى' },
];

export default function FerryExpensesPage() {
  const [expenses, setExpenses] = useState<FerryExpense[]>([]);
  const [trips, setTrips] = useState<TripOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState('all');
  const [selectedCurrency, setSelectedCurrency] = useState('all');
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);

  const [formData, setFormData] = useState({
    trip_order_id: '',
    expense_type: 'ferry_ticket',
    amount: '',
    currency: 'EUR',
    description: '',
    expense_date: '',
  });

  const { toast } = useToast();
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    setFormData((prev) => ({
      ...prev,
      expense_date: new Date().toISOString().split('T')[0],
    }));
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [expRes, tripsRes] = await Promise.all([
        supabase.from('ferry_expenses').select('*').eq('is_deleted', false).order('expense_date', { ascending: false }),
        supabase.from('trip_orders').select('id, cmr_number, route').order('created_at', { ascending: false }),
      ]);

      if (expRes.data) {
        setExpenses(expRes.data as FerryExpense[]);
      }
      if (tripsRes.data) {
        setTrips(tripsRes.data as TripOrder[]);
      }
    } catch (err: unknown) {
      console.error('Error loading ferry expenses:', err);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(formData.amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      toast({ title: 'خطأ', description: 'يرجى إدخال مبلغ صحيح', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);
    try {
      let receiptUrl: string | null = null;
      if (receiptFile) {
        const ext = receiptFile.name.split('.').pop() || 'jpg';
        const path = `ferry_receipts/${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage.from('receipts').upload(path, receiptFile);
        if (!uploadError) {
          const { data } = supabase.storage.from('receipts').getPublicUrl(path);
          receiptUrl = data.publicUrl;
        }
      }

      const payload = {
        trip_order_id: formData.trip_order_id ? parseInt(formData.trip_order_id) : null,
        expense_type: formData.expense_type,
        amount: numAmount,
        currency: formData.currency,
        description: formData.description || null,
        expense_date: formData.expense_date,
        receipt_url: receiptUrl,
        is_deleted: false,
      };

      const { error } = await supabase.from('ferry_expenses').insert(payload);
      if (error) throw error;

      toast({ title: 'تم بنجاح', description: 'تم تسجيل مصروف المعبر بنجاح' });
      setIsModalOpen(false);
      setReceiptFile(null);
      setFormData({
        trip_order_id: '',
        expense_type: 'ferry_ticket',
        amount: '',
        currency: 'EUR',
        description: '',
        expense_date: new Date().toISOString().split('T')[0],
      });
      loadData();
    } catch {
      toast({ title: 'خطأ', description: 'فشل في حفظ المصروف', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('هل أنت متأكد من حذف هذا المصروف؟')) return;
    try {
      const { error } = await supabase.from('ferry_expenses').update({ is_deleted: true }).eq('id', id);
      if (error) throw error;
      toast({ title: 'تم الحذف', description: 'تم حذف المصروف بنجاح' });
      loadData();
    } catch {
      toast({ title: 'خطأ', description: 'فشل في حذف المصروف', variant: 'destructive' });
    }
  };

  // Calculations
  const totalEur = useMemo(() => {
    return expenses.filter(e => e.currency === 'EUR').reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
  }, [expenses]);

  const totalMad = useMemo(() => {
    return expenses.filter(e => e.currency === 'MAD').reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
  }, [expenses]);

  // Filtered
  const filteredExpenses = useMemo(() => {
    return expenses.filter((item) => {
      const matchSearch =
        searchQuery === '' ||
        (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (item.trip_order_id && item.trip_order_id.toString().includes(searchQuery));
      const matchType = selectedType === 'all' || item.expense_type === selectedType;
      const matchCurrency = selectedCurrency === 'all' || item.currency === selectedCurrency;
      return matchSearch && matchType && matchCurrency;
    });
  }, [expenses, searchQuery, selectedType, selectedCurrency]);

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-amiri text-foreground flex items-center gap-2">
            <Ship className="w-7 h-7 text-purple-400" />
            مصاريف المعابر والعبارات والموانئ
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            تسجيل ومتابعة تذاكر البواخر ورسوم التفتيش الجمركي والمحطات البحرية باليورو والدرهم.
          </p>
        </div>
        <Button
          onClick={() => setIsModalOpen(true)}
          className="bg-purple-600 hover:bg-purple-700 text-white flex items-center gap-2 self-start sm:self-auto shadow-md cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>تسجيل مصروف باخرة / ميناء</span>
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-card/70 border-border/70 backdrop-blur-sm shadow-xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">إجمالي المصاريف باليورو</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-400">
              € {totalEur.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground mt-1">تذاكر الباخرة والموانئ الإسبانية/الأوروبية</p>
          </CardContent>
        </Card>

        <Card className="bg-card/70 border-border/70 backdrop-blur-sm shadow-xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">إجمالي المصاريف بالدرهم</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-400">
              {totalMad.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MAD
            </div>
            <p className="text-xs text-muted-foreground mt-1">رسوم الموانئ والمحطات المغربية</p>
          </CardContent>
        </Card>

        <Card className="bg-card/70 border-border/70 backdrop-blur-sm shadow-xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">عدد الحركات المسجلة</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{expenses.length}</div>
            <p className="text-xs text-muted-foreground mt-1">عملية عبور وتذكرة موثقة</p>
          </CardContent>
        </Card>
      </div>

      {/* Filter and Search */}
      <div className="flex flex-col sm:flex-row gap-3 bg-card/60 p-3 rounded-xl border border-border/60">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="بحث بالوصف أو رقم الرحلة..."
            className="pr-9"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="bg-background border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-hidden"
          >
            {EXPENSE_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>

          <select
            value={selectedCurrency}
            onChange={(e) => setSelectedCurrency(e.target.value)}
            className="bg-background border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-hidden"
          >
            <option value="all">جميع العملات</option>
            <option value="EUR">EUR (€)</option>
            <option value="MAD">MAD (درهم)</option>
            <option value="USD">USD ($)</option>
          </select>
        </div>
      </div>

      {/* Data Table */}
      <Card className="bg-card border-border/80 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-muted/50 border-b border-border text-muted-foreground font-semibold">
              <tr>
                <th className="p-3">التاريخ</th>
                <th className="p-3">نوع المصروف</th>
                <th className="p-3">رقم الرحلة / المسار</th>
                <th className="p-3">المبلغ</th>
                <th className="p-3">البيان / الوصف</th>
                <th className="p-3 text-center">التذكرة / الإيصال</th>
                <th className="p-3 text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground">
                    جاري تحميل المصاريف...
                  </td>
                </tr>
              ) : filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground">
                    لا توجد مصاريف معابر مسجلة
                  </td>
                </tr>
              ) : (
                filteredExpenses.map((exp) => {
                  const typeObj = EXPENSE_TYPES.find((t) => t.value === exp.expense_type);
                  const matchedTrip = trips.find((t) => t.id === exp.trip_order_id);

                  return (
                    <tr key={exp.id} className="hover:bg-muted/30 transition-colors">
                      <td className="p-3 font-mono text-muted-foreground">{exp.expense_date}</td>
                      <td className="p-3">
                        <Badge variant="outline" className="bg-purple-500/10 text-purple-400 border-purple-500/30">
                          {typeObj?.label || exp.expense_type}
                        </Badge>
                      </td>
                      <td className="p-3">
                        {matchedTrip ? (
                          <span className="font-semibold text-foreground">
                            {matchedTrip.cmr_number || `#${matchedTrip.id}`} - {matchedTrip.route}
                          </span>
                        ) : exp.trip_order_id ? (
                          <span>رحلة #{exp.trip_order_id}</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="p-3 font-bold">
                        <span className={exp.currency === 'EUR' ? 'text-purple-400' : 'text-emerald-400'}>
                          {Number(exp.amount).toFixed(2)} {exp.currency}
                        </span>
                      </td>
                      <td className="p-3 max-w-[200px] truncate text-muted-foreground">
                        {exp.description || '—'}
                      </td>
                      <td className="p-3 text-center">
                        {exp.receipt_url ? (
                          <a
                            href={exp.receipt_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-purple-400 hover:text-purple-300 font-medium"
                          >
                            <Receipt className="w-4 h-4" />
                            <span>عرض</span>
                          </a>
                        ) : (
                          <span className="text-muted-foreground/60">—</span>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(exp.id)}
                          className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 w-7 h-7 cursor-pointer"
                          title="حذف"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Add Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md p-5 space-y-4 shadow-2xl animate-in fade-in-50 zoom-in-95">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="font-bold text-base text-foreground flex items-center gap-2">
                <Ship className="w-5 h-5 text-purple-400" />
                تسجيل مصروف معبر / باخرة
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-muted-foreground hover:text-foreground text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-3 text-xs">
              <div>
                <label className="block text-muted-foreground mb-1 font-medium">الرحلة المرتبطة (اختياري)</label>
                <select
                  value={formData.trip_order_id}
                  onChange={(e) => setFormData({ ...formData, trip_order_id: e.target.value })}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground focus:outline-hidden"
                >
                  <option value="">-- بدون ربط برحلة --</option>
                  {trips.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.cmr_number || `#${t.id}`} - {t.route}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-muted-foreground mb-1 font-medium">نوع المصروف</label>
                <select
                  value={formData.expense_type}
                  onChange={(e) => setFormData({ ...formData, expense_type: e.target.value })}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground focus:outline-hidden"
                >
                  {EXPENSE_TYPES.filter(t => t.value !== 'all').map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-muted-foreground mb-1 font-medium">المبلغ</label>
                  <Input
                    type="number"
                    step="0.01"
                    required
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-muted-foreground mb-1 font-medium">العملة</label>
                  <select
                    value={formData.currency}
                    onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground focus:outline-hidden h-9"
                  >
                    <option value="EUR">يورو (€)</option>
                    <option value="MAD">درهم مغربي (MAD)</option>
                    <option value="USD">دولار ($)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-muted-foreground mb-1 font-medium">تاريخ المصروف</label>
                <Input
                  type="date"
                  required
                  value={formData.expense_date}
                  onChange={(e) => setFormData({ ...formData, expense_date: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-muted-foreground mb-1 font-medium">ملاحظات / وصف التذكرة</label>
                <Input
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="مثال: تذكرة باخرة طنجة - الجزيرة الخضراء FRS"
                />
              </div>

              <div>
                <label className="block text-muted-foreground mb-1 font-medium">صورة التذكرة أو الإيصال</label>
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
                  className="w-full text-xs text-muted-foreground file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-xs file:bg-purple-600/20 file:text-purple-300 hover:file:bg-purple-600/30 cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border mt-4">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setIsModalOpen(false)}
                >
                  إلغاء
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-purple-600 hover:bg-purple-700 text-white cursor-pointer"
                >
                  {isSubmitting ? 'جاري الحفظ...' : 'حفظ المصروف'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
