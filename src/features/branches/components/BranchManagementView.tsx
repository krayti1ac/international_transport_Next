'use client';

import { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '@/components/language-provider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  Building2,
  Plus,
  Edit2,
  Trash2,
  Globe,
  Phone,
  Mail,
  ShieldCheck,
  AlertCircle,
  X,
  Wallet,
} from 'lucide-react';
import {
  getCompanyBranches,
  createBranch,
  updateBranch,
  deleteBranch,
} from '../services/branches.actions';
import type { CompanyBranch, CashBox } from '@/types/database';
import type { BranchFormData } from '../schemas/branch.schema';
import { createClient } from '@/lib/supabase/client';
import { useBranchStore } from '@/lib/stores/branch-store';

const COUNTRY_FLAGS: Record<string, string> = {
  MA: '🇲🇦',
  ES: '🇪🇸',
  FR: '🇫🇷',
};

export function BranchManagementView() {
  const { t, dir } = useLanguage();
  const { toast } = useToast();

  const [branches, setBranches] = useState<CompanyBranch[]>([]);
  const [cashBoxes, setCashBoxes] = useState<CashBox[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<CompanyBranch | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [country, setCountry] = useState<'MA' | 'ES' | 'FR'>('MA');
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [isHq, setIsHq] = useState(false);
  const [defaultCashBoxId, setDefaultCashBoxId] = useState<number | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const loadBranches = useCallback(async () => {
    try {
      const supabase = createClient();
      const [res, cbRes] = await Promise.all([
        getCompanyBranches(),
        supabase.from('cash_boxes').select('*').order('name'),
      ]);
      if (res.success && res.branches) {
        setBranches(res.branches);
        useBranchStore.getState().setAvailableBranches(res.branches);
      }
      if (cbRes.data) {
        setCashBoxes(cbRes.data as CashBox[]);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBranches();
  }, [loadBranches]);

  const openCreateModal = () => {
    setEditingBranch(null);
    setName('');
    setCode('');
    setCountry('MA');
    setCity('');
    setAddress('');
    setPhone('');
    setEmail('');
    setIsHq(branches.length === 0);
    setDefaultCashBoxId(null);
    setFormError(null);
    setModalOpen(true);
  };

  const openEditModal = (b: CompanyBranch) => {
    setEditingBranch(b);
    setName(b.name);
    setCode(b.code);
    setCountry((b.country as 'MA' | 'ES' | 'FR') || 'MA');
    setCity(b.city);
    setAddress(b.address || '');
    setPhone(b.phone || '');
    setEmail(b.email || '');
    setIsHq(b.is_headquarters);
    setDefaultCashBoxId(b.default_cash_box_id ?? null);
    setFormError(null);
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);

    const payload: BranchFormData = {
      name,
      code,
      country,
      city,
      address: address || null,
      phone: phone || null,
      email: email || null,
      is_headquarters: isHq,
      is_active: true,
      default_cash_box_id: defaultCashBoxId,
    };

    try {
      if (editingBranch) {
        const res = await updateBranch(editingBranch.id, payload);
        if (res.success) {
          toast({
            title: t('تم تحديث بيانات الفرع', 'Agence mise à jour'),
            description: t('تم حفظ التعديلات بنجاح', 'Modifications enregistrées'),
          });
          setModalOpen(false);
          await loadBranches();
        } else {
          setFormError(res.error || t('فشل تحديث الفرع', 'Échec de mise à jour'));
        }
      } else {
        const res = await createBranch(payload);
        if (res.success) {
          toast({
            title: t('تم إنشاء الفرع بنجاح', 'Agence créée avec succès'),
            description: t('أصبح الفرع متاحاً لكافة العمليات التشغيلية', 'L’agence est désormais opérationnelle'),
          });
          setModalOpen(false);
          await loadBranches();
        } else {
          setFormError(res.error || t('فشل إنشاء الفرع', 'Échec de création'));
        }
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (b: CompanyBranch) => {
    if (b.is_headquarters) {
      toast({
        title: t('غير مسموح', 'Action interdite'),
        description: t('لا يمكن حذف المقر الرئيسي للشركة', 'Impossible de supprimer le siège'),
        variant: 'destructive',
      });
      return;
    }

    if (!confirm(t(`هل أنت متأكد من حذف الفرع "${b.name}"؟`, `Supprimer l'agence "${b.name}" ?`))) {
      return;
    }

    const res = await deleteBranch(b.id);
    if (res.success) {
      toast({
        title: t('تم حذف الفرع', 'Agence supprimée'),
      });
      await loadBranches();
    } else {
      toast({
        title: t('تعذر حذف الفرع', 'Échec de suppression'),
        description: res.error,
        variant: 'destructive',
      });
    }
  };

  const hqBranch = branches.find((b) => b.is_headquarters);
  const internationalCount = branches.filter((b) => b.country !== 'MA').length;
  const linkedCashBoxesCount = branches.filter((b) => Boolean(b.default_cash_box_id)).length;

  return (
    <div className="space-y-6 pb-12" dir={dir}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-amiri text-foreground flex items-center gap-2.5">
            <Building2 className="w-6 h-6 text-primary" />
            {t('إدارة الفروع والمقرات اللوجستية (Multi-Branch Hubs)', 'Gestion Multi-Agences')}
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t(
              'توزيع عمليات الشحن، عزل صناديق الخزينة، وربط الشاحنات والسائقين بمقراتهم التشغيلية',
              'Distribution des opérations, isolation des caisses et affectation des camions aux agences'
            )}
          </p>
        </div>

        <Button
          type="button"
          onClick={openCreateModal}
          className="rounded-xl text-xs font-semibold h-10 px-4 gap-2 bg-primary text-primary-foreground shadow-xs"
        >
          <Plus className="w-4 h-4" />
          {t('إضافة فرع / مقر جديد', 'Ajouter une agence')}
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <Card className="border-border">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">{t('إجمالي الفروع النشطة', 'Total agences actives')}</p>
              <p className="text-xl font-bold font-mono text-foreground mt-1">{branches.length}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <Building2 className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">{t('المقر الرئيسي (Siège)', 'Siège social')}</p>
              <p className="text-sm font-bold text-foreground mt-1 truncate max-w-[150px]">
                {hqBranch ? hqBranch.name : t('غير محدد', 'Non défini')}
              </p>
              <p className="text-[10px] text-muted-foreground font-mono">
                {hqBranch ? `${hqBranch.city} • ${hqBranch.code}` : ''}
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">{t('المقرات الدولية (إسبانيا/أوروبا)', 'Agences internationales')}</p>
              <p className="text-xl font-bold font-mono text-blue-600 mt-1">{internationalCount}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center">
              <Globe className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">{t('الصناديق النقدية المربوطة', 'Caisses associées')}</p>
              <p className="text-xl font-bold font-mono text-amber-600 mt-1">
                {linkedCashBoxesCount} <span className="text-xs font-normal text-muted-foreground">/ {branches.length}</span>
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
              <Wallet className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Branches Table */}
      <Card className="border border-border shadow-xs overflow-hidden">
        <CardHeader className="py-3.5 px-5 border-b border-border">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Building2 className="w-4 h-4 text-primary" />
            <span>{t('قائمة الفروع والمراكز اللوجستية', 'Liste des Agences et Hubs')}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="py-12 text-center text-xs text-muted-foreground">
              {t('جاري تحميل الفروع...', 'Chargement des agences...')}
            </div>
          ) : branches.length === 0 ? (
            <div className="py-12 text-center text-xs text-muted-foreground">
              {t('لا توجد فروع مسجلة حالياً.', 'Aucune agence enregistrée.')}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-muted-foreground">
                    <th className="py-3 px-4 text-start font-semibold">{t('الفرع / المركز', 'Agence')}</th>
                    <th className="py-3 px-4 text-start font-semibold">{t('الرمز والكود', 'Code')}</th>
                    <th className="py-3 px-4 text-start font-semibold">{t('المدينة والدولة', 'Ville & Pays')}</th>
                    <th className="py-3 px-4 text-start font-semibold">{t('الصندوق الافتراضي', 'Caisse')}</th>
                    <th className="py-3 px-4 text-start font-semibold">{t('بيانات التواصل', 'Contact')}</th>
                    <th className="py-3 px-4 text-center font-semibold">{t('الصفة', 'Statut')}</th>
                    <th className="py-3 px-4 text-end font-semibold">{t('الإجراءات', 'Actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {branches.map((b) => {
                    const flag = COUNTRY_FLAGS[b.country] || '🏢';
                    return (
                      <tr key={b.id} className="hover:bg-muted/30 transition-colors">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5">
                            <span className="text-base shrink-0">{flag}</span>
                            <div>
                              <p className="font-semibold text-foreground">{b.name}</p>
                              {b.address && (
                                <p className="text-[10px] text-muted-foreground line-clamp-1">
                                  {b.address}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <Badge variant="outline" className="font-mono text-[11px]">
                            {b.code}
                          </Badge>
                        </td>
                        <td className="py-3 px-4">
                          <p className="font-medium text-foreground">{b.city}</p>
                          <p className="text-[10px] text-muted-foreground uppercase">{b.country}</p>
                        </td>
                        <td className="py-3 px-4">
                          {b.default_cash_box_id ? (
                            <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 flex items-center gap-1 w-fit">
                              <Wallet className="w-3 h-3 text-amber-500 shrink-0" />
                              <span className="truncate max-w-[120px]">{cashBoxes.find((c) => c.id === b.default_cash_box_id)?.name || `#${b.default_cash_box_id}`}</span>
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-[11px]">—</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <div className="space-y-0.5 text-[11px] text-muted-foreground">
                            {b.phone && (
                              <p className="flex items-center gap-1">
                                <Phone className="w-3 h-3" />
                                <span dir="ltr">{b.phone}</span>
                              </p>
                            )}
                            {b.email && (
                              <p className="flex items-center gap-1">
                                <Mail className="w-3 h-3" />
                                <span>{b.email}</span>
                              </p>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-center">
                          {b.is_headquarters ? (
                            <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-500/30 text-[10px]">
                              {t('المقر الرئيسي', 'Siège')}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px]">
                              {t('فرع تشغيلي', 'Agence')}
                            </Badge>
                          )}
                        </td>
                        <td className="py-3 px-4 text-end">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => openEditModal(b)}
                              className="h-8 w-8 p-0 rounded-lg text-muted-foreground hover:text-foreground"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </Button>
                            {!b.is_headquarters && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(b)}
                                className="h-8 w-8 p-0 rounded-lg text-rose-600 hover:bg-rose-500/10"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create / Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-background border border-border w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-primary" />
                <h3 className="font-bold text-sm font-amiri text-foreground">
                  {editingBranch
                    ? t('تعديل بيانات الفرع', 'Modifier l’agence')
                    : t('إضافة فرع / مقر تشغيلي جديد', 'Nouvelle agence')}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
              {formError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1 sm:col-span-2">
                  <label className="font-semibold text-muted-foreground block">
                    {t('اسم الفرع', 'Nom de l’agence')} *
                  </label>
                  <Input
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t('مثال: فرع طنجة المتوسط', 'Ex: Agence Tanger Med')}
                    className="h-9 text-xs rounded-xl"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-muted-foreground block">
                    {t('رمز الفرع (Code)', 'Code Agence')} *
                  </label>
                  <Input
                    required
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    placeholder="TNG-HQ, CAS-HUB..."
                    className="h-9 text-xs font-mono uppercase rounded-xl"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-muted-foreground block">
                    {t('الدولة', 'Pays')} *
                  </label>
                  <select
                    value={country}
                    onChange={(e) => setCountry(e.target.value as 'MA' | 'ES' | 'FR')}
                    className="w-full h-9 rounded-xl border border-input bg-background px-3 text-xs"
                  >
                    <option value="MA">🇲🇦 المغرب (Maroc)</option>
                    <option value="ES">🇪🇸 إسبانيا (Espagne)</option>
                    <option value="FR">🇫🇷 فرنسا (France)</option>
                  </select>
                </div>

                <div className="space-y-1 sm:col-span-2">
                  <label className="font-semibold text-muted-foreground block">
                    {t('المدينة', 'Ville')} *
                  </label>
                  <Input
                    required
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Tanger, Casablanca, Agadir, Algeciras..."
                    className="h-9 text-xs rounded-xl"
                  />
                </div>

                <div className="space-y-1 sm:col-span-2">
                  <label className="font-semibold text-muted-foreground block">
                    {t('العنوان الفعلي', 'Adresse')}
                  </label>
                  <Input
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder={t('المنطقة اللوجستية، الميناء...', 'Zone logistique, port...')}
                    className="h-9 text-xs rounded-xl"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-muted-foreground block">
                    {t('الهاتف', 'Téléphone')}
                  </label>
                  <Input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+212 5..."
                    className="h-9 text-xs rounded-xl"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-muted-foreground block">
                    {t('البريد الإلكتروني', 'Email')}
                  </label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="branch@company.com"
                    className="h-9 text-xs rounded-xl"
                  />
                </div>

                <div className="space-y-1 sm:col-span-2">
                  <label className="font-semibold text-muted-foreground flex items-center gap-1.5">
                    <Wallet className="w-3.5 h-3.5 text-amber-500" />
                    <span>{t('الصندوق النقدي الافتراضي للفرع', 'Caisse par défaut')}</span>
                  </label>
                  <select
                    value={defaultCashBoxId || ''}
                    onChange={(e) => setDefaultCashBoxId(e.target.value ? Number(e.target.value) : null)}
                    className="w-full h-9 rounded-xl border border-input bg-background px-3 text-xs"
                  >
                    <option value="">{t('-- بدون صندوق نقدي افتراضي --', '-- Aucune caisse par défaut --')}</option>
                    {cashBoxes.map((cb) => (
                      <option key={cb.id} value={cb.id}>
                        {cb.name || cb.code} ({cb.currency || 'MAD'})
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-muted-foreground">
                    {t('يتم ربط سلف السائقين ومصروفات العمليات لهذا الفرع بهذا الصندوق تلقائياً', 'Associe les dépenses et avances de cette agence à cette caisse')}
                  </p>
                </div>
              </div>

              <div className="pt-2 flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_hq"
                  checked={isHq}
                  onChange={(e) => setIsHq(e.target.checked)}
                  className="rounded border-input text-primary accent-primary"
                />
                <label htmlFor="is_hq" className="font-semibold text-foreground cursor-pointer">
                  {t('تعيين هذا الفرع كمقر رئيسي للشركة (Headquarters)', 'Définir comme siège social')}
                </label>
              </div>

              <div className="pt-3 border-t border-border flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setModalOpen(false)}
                  className="rounded-xl text-xs h-9 px-4"
                >
                  {t('إلغاء', 'Annuler')}
                </Button>

                <Button
                  type="submit"
                  disabled={submitting}
                  size="sm"
                  className="rounded-xl text-xs h-9 px-5 bg-primary text-primary-foreground"
                >
                  {submitting
                    ? t('جاري الحفظ...', 'Enregistrement...')
                    : editingBranch
                    ? t('حفظ التعديلات', 'Enregistrer')
                    : t('تأكيد وإنشاء', 'Créer l’agence')}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

