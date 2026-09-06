'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Decimal from 'decimal.js';
import { createClient } from '@/lib/supabase/client';
import { useLanguage } from '@/components/language-provider';
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

Decimal.config({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

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

export default function FerryExpensesPage() {
  const { t, dir, locale } = useLanguage();
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

  const expenseTypes = useMemo(() => [
    { value: 'all', label: t('جميع الأنواع', 'Tous les types') },
    { value: 'ferry_ticket', label: t('تذكرة باخرة', 'Billet de ferry') },
    { value: 'port_inspection', label: t('تفتيش الميناء', 'Contrôle portuaire') },
    { value: 'customs_fee', label: t('رسوم جمركية', 'Frais de douane') },
    { value: 'terminal_fee', label: t('رسوم المحطة', 'Frais de terminal') },
    { value: 'port_parking', label: t('وقوف في الميناء', 'Parking portuaire') },
    { value: 'port_other', label: t('مصاريف موانئ أخرى', 'Autres frais de port') },
  ], [t]);

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
    let decAmount: InstanceType<typeof Decimal>;
    try {
      decAmount = new Decimal(formData.amount);
    } catch {
      toast({
        title: t('خطأ', 'Erreur'),
        description: t('يرجى إدخال مبلغ صحيح', 'Veuillez saisir un montant valide'),
        variant: 'destructive',
      });
      return;
    }

    if (decAmount.lte(0)) {
      toast({
        title: t('خطأ', 'Erreur'),
        description: t('يرجى إدخال مبلغ صحيح', 'Veuillez saisir un montant valide'),
        variant: 'destructive',
      });
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
        amount: decAmount.toNumber(),
        currency: formData.currency,
        description: formData.description || null,
        expense_date: formData.expense_date,
        receipt_url: receiptUrl,
        is_deleted: false,
      };

      const { error } = await supabase.from('ferry_expenses').insert(payload);
      if (error) throw error;

      toast({
        title: t('تم بنجاح', 'Succès'),
        description: t('تم تسجيل مصروف المعبر بنجاح', 'Frais de traversée enregistrés avec succès'),
      });
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
      toast({
        title: t('خطأ', 'Erreur'),
        description: t('فشل في حفظ المصروف', "Échec de l'enregistrement de la dépense"),
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm(t('هل أنت متأكد من حذف هذا المصروف؟', 'Êtes-vous sûr de vouloir supprimer cette dépense ?'))) return;
    try {
      const { error } = await supabase.from('ferry_expenses').update({ is_deleted: true }).eq('id', id);
      if (error) throw error;
      toast({
        title: t('تم الحذف', 'Supprimé'),
        description: t('تم حذف المصروف بنجاح', 'Dépense supprimée avec succès'),
      });
      loadData();
    } catch {
      toast({
        title: t('خطأ', 'Erreur'),
        description: t('فشل في حذف المصروف', 'Échec de la suppression de la dépense'),
        variant: 'destructive',
      });
    }
  };

  // Calculations using Decimal.js
  const totalEur = useMemo(() => {
    let sum = new Decimal(0);
    expenses.filter(e => e.currency === 'EUR').forEach(curr => {
      sum = sum.plus(new Decimal(curr.amount || 0));
    });
    return sum.toNumber();
  }, [expenses]);

  const totalMad = useMemo(() => {
    let sum = new Decimal(0);
    expenses.filter(e => e.currency === 'MAD').forEach(curr => {
      sum = sum.plus(new Decimal(curr.amount || 0));
    });
    return sum.toNumber();
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
    <div className="space-y-6" dir={dir}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-amiri text-foreground flex items-center gap-2">
            <Ship className="w-7 h-7 text-purple-400" />
            {t('مصاريف المعابر والعبارات والموانئ', 'Frais de Traversées, Ferries & Ports')}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t(
              'تسجيل ومتابعة تذاكر البواخر ورسوم التفتيش الجمركي والمحطات البحرية باليورو والدرهم.',
              'Enregistrement et suivi des billets de ferry, contrôles douaniers et frais portuaires en EUR et MAD.'
            )}
          </p>
        </div>
        <Button
          onClick={() => setIsModalOpen(true)}
          className="bg-purple-600 hover:bg-purple-700 text-white flex items-center gap-2 self-start sm:self-auto shadow-md cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>{t('تسجيل مصروف باخرة / ميناء', 'Enregistrer frais de traversée / port')}</span>
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-card/70 border-border/70 backdrop-blur-sm shadow-xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              {t('إجمالي المصاريف باليورو', 'Total Dépenses EUR')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-400 font-mono">
              € {totalEur.toLocaleString(locale === 'ar' ? 'ar-MA' : 'fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {t('تذاكر الباخرة والموانئ الأوروبية', 'Billets ferry et ports européens')}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card/70 border-border/70 backdrop-blur-sm shadow-xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              {t('إجمالي المصاريف بالدرهم', 'Total Dépenses MAD')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-400 font-mono">
              {totalMad.toLocaleString(locale === 'ar' ? 'ar-MA' : 'fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {t('د.م.', 'MAD')}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {t('رسوم الموانئ والمحطات المغربية', 'Frais portuaires marocains')}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card/70 border-border/70 backdrop-blur-sm shadow-xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              {t('عدد الحركات المسجلة', 'Nombre d\'opérations enregistrées')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-foreground">{expenses.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {t('عملية عبور وتذكرة موثقة', 'opérations de traversée')}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filter and Search */}
      <div className="flex flex-col sm:flex-row gap-3 bg-card/60 p-3 rounded-xl border border-border/60">
        <div className="relative flex-1">
          <Search className={`w-4 h-4 absolute ${dir === 'rtl' ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 text-muted-foreground`} />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('بحث بالوصف أو رقم الرحلة...', 'Recherche par description ou N° trajet...')}
            className={dir === 'rtl' ? 'pr-9' : 'pl-9'}
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="bg-background border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-hidden"
          >
            {expenseTypes.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>

          <select
            value={selectedCurrency}
            onChange={(e) => setSelectedCurrency(e.target.value)}
            className="bg-background border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-hidden"
          >
            <option value="all">{t('جميع العملات', 'Toutes devises')}</option>
            <option value="EUR">EUR (€)</option>
            <option value="MAD">MAD ({t('درهم', 'Dirham')})</option>
            <option value="USD">USD ($)</option>
          </select>
        </div>
      </div>

      {/* Data Table */}
      <Card className="bg-card border-border/80 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className={`w-full ${dir === 'rtl' ? 'text-right' : 'text-left'} text-xs`}>
            <thead className="bg-muted/50 border-b border-border text-muted-foreground font-semibold">
              <tr>
                <th className="p-3">{t('التاريخ', 'Date')}</th>
                <th className="p-3">{t('نوع المصروف', 'Type de frais')}</th>
                <th className="p-3">{t('رقم الرحلة / المسار', 'N° Trajet / Itinéraire')}</th>
                <th className="p-3">{t('المبلغ', 'Montant')}</th>
                <th className="p-3">{t('البيان / الوصف', 'Libellé / Description')}</th>
                <th className="p-3 text-center">{t('التذكرة / الإيصال', 'Billet / Justificatif')}</th>
                <th className="p-3 text-center">{t('الإجراءات', 'Actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground">
                    {t('جاري تحميل المصاريف...', 'Chargement des dépenses en cours...')}
                  </td>
                </tr>
              ) : filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground">
                    {t('لا توجد مصاريف معابر مسجلة', 'Aucune dépense de traversée enregistrée')}
                  </td>
                </tr>
              ) : (
                filteredExpenses.map((exp) => {
                  const typeObj = expenseTypes.find((item) => item.value === exp.expense_type);
                  const matchedTrip = trips.find((item) => item.id === exp.trip_order_id);

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
                          <span>{t('رحلة #', 'Trajet #')}{exp.trip_order_id}</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="p-3 font-bold font-mono">
                        <span className={exp.currency === 'EUR' ? 'text-purple-400' : 'text-emerald-400'}>
                          {new Decimal(exp.amount || 0).toFixed(2)} {exp.currency}
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
                            <span>{t('عرض', 'Voir')}</span>
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
                          title={t('حذف', 'Supprimer')}
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
                {t('تسجيل مصروف معبر / باخرة', 'Enregistrer une dépense traversée / ferry')}
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
                <label className="block text-muted-foreground mb-1 font-medium">
                  {t('الرحلة المرتبطة (اختياري)', 'Trajet associé (optionnel)')}
                </label>
                <select
                  value={formData.trip_order_id}
                  onChange={(e) => setFormData({ ...formData, trip_order_id: e.target.value })}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground focus:outline-hidden"
                >
                  <option value="">{t('-- بدون ربط برحلة --', '-- Non associé --')}</option>
                  {trips.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.cmr_number || `#${item.id}`} - {item.route}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-muted-foreground mb-1 font-medium">
                  {t('نوع المصروف', 'Type de frais')}
                </label>
                <select
                  value={formData.expense_type}
                  onChange={(e) => setFormData({ ...formData, expense_type: e.target.value })}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground focus:outline-hidden"
                >
                  {expenseTypes.filter(item => item.value !== 'all').map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-muted-foreground mb-1 font-medium">
                    {t('المبلغ', 'Montant')}
                  </label>
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
                  <label className="block text-muted-foreground mb-1 font-medium">
                    {t('العملة', 'Devise')}
                  </label>
                  <select
                    value={formData.currency}
                    onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground focus:outline-hidden h-9"
                  >
                    <option value="EUR">EUR (€)</option>
                    <option value="MAD">MAD ({t('درهم', 'Dirham')})</option>
                    <option value="USD">USD ($)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-muted-foreground mb-1 font-medium">
                  {t('تاريخ المصروف', 'Date de la dépense')}
                </label>
                <Input
                  type="date"
                  required
                  value={formData.expense_date}
                  onChange={(e) => setFormData({ ...formData, expense_date: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-muted-foreground mb-1 font-medium">
                  {t('ملاحظات / وصف التذكرة', 'Remarques / Description')}
                </label>
                <Input
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder={t('مثال: تذكرة باخرة طنجة - الجزيرة الخضراء FRS', 'Ex: Billet ferry Tanger - Algésiras FRS')}
                />
              </div>

              <div>
                <label className="block text-muted-foreground mb-1 font-medium">
                  {t('صورة التذكرة أو الإيصال', 'Photo du billet ou reçu')}
                </label>
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
                  {t('إلغاء', 'Annuler')}
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-purple-600 hover:bg-purple-700 text-white cursor-pointer"
                >
                  {isSubmitting ? t('جاري الحفظ...', 'Enregistrement...') : t('حفظ المصروف', 'Enregistrer la dépense')}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
