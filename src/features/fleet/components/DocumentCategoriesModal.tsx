'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import {
  FolderCog,
  Plus,
  Edit2,
  Trash2,
  Check,
  X,
  AlertTriangle,
  FileText,
  Search,
  RefreshCw,
  Truck,
  Layers,
  Lock,
} from 'lucide-react';
import type { DocumentCategory } from '@/types/database';
import {
  getDocumentCategories,
  saveDocumentCategory,
  toggleDocumentCategoryStatus,
  deleteDocumentCategory,
} from '@/features/fleet/services/fleet-documents.actions';
import { useLanguage } from '@/components/language-provider';

interface DocumentCategoriesViewProps {
  isModal?: boolean;
  onClose?: () => void;
  onCategoriesUpdated?: () => void;
}

export function DocumentCategoriesView({
  onCategoriesUpdated,
}: DocumentCategoriesViewProps) {
  const { locale, dir, t } = useLanguage();
  const [categories, setCategories] = useState<DocumentCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionLoading, setActionLoading] = useState<number | 'new' | null>(null);

  // New Category Form State
  const [newName, setNewName] = useState('');
  const [newNameFr, setNewNameFr] = useState('');
  const [newApplicableTo, setNewApplicableTo] = useState<'both' | 'truck' | 'trailer'>('both');
  const [newIsActive, setNewIsActive] = useState(true);
  const [isAddingOpen, setIsAddingOpen] = useState(false);

  // Edit Mode State
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editNameFr, setEditNameFr] = useState('');
  const [editApplicableTo, setEditApplicableTo] = useState<'both' | 'truck' | 'trailer'>('both');
  const [editIsActive, setEditIsActive] = useState(true);

  // Delete Confirmation State
  const [deletingCat, setDeletingCat] = useState<DocumentCategory | null>(null);

  const { toast } = useToast();

  const loadCategories = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getDocumentCategories();
      if (res.success) {
        setCategories(res.data);
      } else {
        toast({ title: t('خطأ', 'Erreur'), description: res.error, variant: 'destructive' });
      }
    } catch {
      toast({ title: t('خطأ', 'Erreur'), description: t('تعذر تحميل أنواع الوثائق', 'Impossible de charger les types de documents'), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast, t]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) {
      toast({ title: t('تنبيه', 'Attention'), description: t('يرجى إدخال اسم نوع الوثيقة', 'Veuillez saisir le nom du type de document'), variant: 'destructive' });
      return;
    }

    setActionLoading('new');
    try {
      const res = await saveDocumentCategory({
        name: newName.trim(),
        name_fr: newNameFr.trim() || undefined,
        applicable_to: newApplicableTo,
        is_active: newIsActive,
      });

      if (!res.success) throw new Error(res.error);

      toast({ title: t('تم إضافة نوع الوثيقة بنجاح', 'Type de document ajouté avec succès') });
      setNewName('');
      setNewNameFr('');
      setNewApplicableTo('both');
      setNewIsActive(true);
      setIsAddingOpen(false);
      await loadCategories();
      onCategoriesUpdated?.();
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('فشل في إضافة نوع الوثيقة', 'Échec de l\'ajout du type de document');
      toast({ title: t('خطأ', 'Erreur'), description: msg, variant: 'destructive' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleStartEdit = (cat: DocumentCategory) => {
    setEditingId(cat.id);
    setEditName(cat.name);
    setEditNameFr(cat.name_fr || '');
    setEditApplicableTo(cat.applicable_to);
    setEditIsActive(cat.is_active);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditName('');
    setEditNameFr('');
  };

  const handleSaveEdit = async (id: number) => {
    if (!editName.trim()) {
      toast({ title: t('تنبيه', 'Attention'), description: t('اسم الوثيقة لا يمكن أن يكون فارغاً', 'Le nom du document ne peut pas être vide'), variant: 'destructive' });
      return;
    }

    setActionLoading(id);
    try {
      const res = await saveDocumentCategory({
        id,
        name: editName.trim(),
        name_fr: editNameFr.trim() || undefined,
        applicable_to: editApplicableTo,
        is_active: editIsActive,
      });

      if (!res.success) throw new Error(res.error);

      toast({ title: t('تم تعديل نوع الوثيقة بنجاح', 'Type de document modifié avec succès') });
      setEditingId(null);
      await loadCategories();
      onCategoriesUpdated?.();
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('فشل في حفظ التعديل', 'Échec de la modification');
      toast({ title: t('خطأ', 'Erreur'), description: msg, variant: 'destructive' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleStatus = async (cat: DocumentCategory) => {
    setActionLoading(cat.id);
    try {
      const nextStatus = !cat.is_active;
      const res = await toggleDocumentCategoryStatus(cat.id, nextStatus);
      if (!res.success) throw new Error(res.error);

      toast({
        title: nextStatus
          ? t('تم تفعيل نوع الوثيقة', 'Type de document activé')
          : t('تم تعطيل نوع الوثيقة', 'Type de document désactivé'),
      });
      await loadCategories();
      onCategoriesUpdated?.();
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('فشل في تغيير الحالة', 'Échec du changement de statut');
      toast({ title: t('خطأ', 'Erreur'), description: msg, variant: 'destructive' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingCat) return;

    setActionLoading(deletingCat.id);
    try {
      const res = await deleteDocumentCategory(deletingCat.id);
      if (!res.success) throw new Error(res.error);

      toast({ title: t('تم حذف نوع الوثيقة بنجاح', 'Type de document supprimé avec succès') });
      setDeletingCat(null);
      await loadCategories();
      onCategoriesUpdated?.();
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('فشل في حذف نوع الوثيقة', 'Échec de la suppression du type de document');
      toast({ title: t('تعذر الحذف', 'Suppression impossible'), description: msg, variant: 'destructive' });
    } finally {
      setActionLoading(null);
    }
  };

  const filteredCategories = categories.filter((c) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      c.name.toLowerCase().includes(q) ||
      (c.name_fr && c.name_fr.toLowerCase().includes(q))
    );
  });

  const getApplicableBadge = (applicable: 'both' | 'truck' | 'trailer') => {
    switch (applicable) {
      case 'truck':
        return (
          <Badge variant="outline" className="bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-900/50 text-[10px] gap-1 py-0.5">
            <Truck className="w-3 h-3" />
            <span>{t('شاحنات فقط', 'Camions uniquement')}</span>
          </Badge>
        );
      case 'trailer':
        return (
          <Badge variant="outline" className="bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-900/50 text-[10px] gap-1 py-0.5">
            <Layers className="w-3 h-3" />
            <span>{t('مقطورات فقط', 'Remorques uniquement')}</span>
          </Badge>
        );
      case 'both':
      default:
        return (
          <Badge variant="outline" className="bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 text-[10px] gap-1 py-0.5">
            <span>{t('شاحنات ومقطورات', 'Camions et remorques')}</span>
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-4" dir={dir}>
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wide mb-1">
          <FolderCog className="w-4 h-4 text-blue-600" />
          <span>{t('إدارة أنواع وثائق الأسطول', 'Gestion des types de documents de flotte')}</span>
        </div>
        <h2 className="font-amiri text-xl font-bold text-foreground">
          {t('التحكم في أنواع الوثائق', 'Gestion des types de documents')}
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          {t(
            'إضافة وتعديل وحذف أنواع الوثائق وتحديد المركبات التي تنطبق عليها. تُحذف فقط الوثائق غير المرتبطة بسجلات سابقة للحفاظ على سلامة البيانات.',
            'Ajouter, modifier et supprimer des types de documents et définir leur applicabilité. Seuls les types non liés à des enregistrements existants peuvent être supprimés.'
          )}
        </p>
      </div>

      {/* Toolbar: Search + Add New Button */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 pt-1">
        <div className="relative w-full sm:w-72">
          <Search className="w-3.5 h-3.5 absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder={t('البحث في أنواع الوثائق...', 'Rechercher un type de document...')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="ps-9 h-9 rounded-xl text-xs bg-muted/20"
          />
        </div>

        <Button
          type="button"
          size="sm"
          onClick={() => setIsAddingOpen(!isAddingOpen)}
          className="rounded-xl h-9 text-xs w-full sm:w-auto font-medium gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs cursor-pointer"
        >
          {isAddingOpen ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
          <span>{isAddingOpen ? t('إلغاء الإضافة', 'Annuler') : t('إضافة نوع وثيقة جديد', 'Nouveau type de document')}</span>
        </Button>
      </div>

      {/* Collapsible Add New Form */}
      {isAddingOpen && (
        <form
          onSubmit={handleCreateCategory}
          className="p-4 rounded-2xl bg-muted/40 border border-primary/20 space-y-3 text-xs"
        >
          <div className="font-semibold text-foreground text-xs flex items-center gap-1.5">
            <Plus className="w-3.5 h-3.5 text-primary" />
            <span>{t('إدخال بيانات نوع الوثيقة الجديد', 'Nouveau type de document')}</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div className="space-y-1">
              <label className="font-medium text-foreground">{t('اسم نوع الوثيقة (بالعربية) *', 'Nom du type de document (Arabe) *')}</label>
              <Input
                type="text"
                placeholder={t('مثال: تصريح النقل الخاص', 'Ex: Permis de transport')}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="rounded-xl h-8 text-xs bg-background"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="font-medium text-muted-foreground">{t('الاسم بالفرنسية (اختياري)', 'Nom en français (Optionnel)')}</label>
              <Input
                type="text"
                placeholder="Ex: Permis Spécial"
                value={newNameFr}
                onChange={(e) => setNewNameFr(e.target.value)}
                className="rounded-xl h-8 text-xs bg-background font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 items-center">
            <div className="space-y-1">
              <label className="font-medium text-foreground">{t('ينطبق على', 'S\'applique à')}</label>
              <Select
                value={newApplicableTo}
                onValueChange={(val: 'both' | 'truck' | 'trailer') => setNewApplicableTo(val)}
              >
                <SelectTrigger className="rounded-xl h-8 text-xs bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="both">{t('🚛🚚 شاحنات ومقطورات', '🚛🚚 Camions et remorques')}</SelectItem>
                  <SelectItem value="truck">{t('🚛 شاحنات فقط', '🚛 Camions uniquement')}</SelectItem>
                  <SelectItem value="trailer">{t('🚚 مقطورات فقط', '🚚 Remorques uniquement')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between sm:justify-start gap-3 pt-4 sm:pt-5">
              <div className="flex items-center gap-2">
                <Switch
                  id="new-is-active"
                  checked={newIsActive}
                  onCheckedChange={setNewIsActive}
                />
                <label htmlFor="new-is-active" className="cursor-pointer font-medium">
                  {newIsActive ? t('نشط ومتاح', 'Actif et disponible') : t('معطل مؤقتاً', 'Désactivé temporairement')}
                </label>
              </div>

              <Button
                type="submit"
                size="sm"
                disabled={actionLoading === 'new'}
                className="rounded-xl h-8 text-xs font-semibold px-4 ms-auto bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer"
              >
                {actionLoading === 'new' ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Check className="w-3.5 h-3.5 me-1" />
                )}
                <span>{t('تأكيد الإضافة', 'Ajouter le type')}</span>
              </Button>
            </div>
          </div>
        </form>
      )}

      {/* Categories List */}
      <div className="space-y-2">
        {loading ? (
          <div className="py-12 text-center text-muted-foreground">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto text-primary mb-2" />
            <p className="text-xs">{t('جاري تحميل أنواع وثائق الأسطول...', 'Chargement des types de documents...')}</p>
          </div>
        ) : filteredCategories.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground border border-dashed rounded-2xl">
            <FileText className="w-8 h-8 mx-auto mb-1 text-muted-foreground/40" />
            <p className="text-sm font-semibold text-foreground">{t('لا توجد أنواع وثائق مطابقة', 'Aucun type de document correspondant')}</p>
            <p className="text-xs text-muted-foreground">{t('يمكنك إضافة نوع جديد بالنقر على الزر أعلاه.', 'Vous pouvez ajouter un nouveau type en cliquant sur le bouton ci-dessus.')}</p>
          </div>
        ) : (
          <div className="border border-border/80 rounded-2xl overflow-hidden divide-y divide-border/60">
            {filteredCategories.map((cat) => {
              const isEditing = editingId === cat.id;
              const isLinked = (cat.usage_count || 0) > 0;
              const primaryName = locale === 'fr' ? (cat.name_fr || cat.name) : cat.name;
              const secondaryName = locale === 'fr'
                ? (cat.name_fr ? `(${cat.name})` : null)
                : (cat.name_fr ? `(${cat.name_fr})` : null);

              if (isEditing) {
                return (
                  <div key={cat.id} className="p-3 bg-muted/30 space-y-2 text-xs">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="text-[11px] font-medium text-foreground">{t('الاسم بالعربية', 'Nom en arabe')}</label>
                        <Input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="rounded-xl h-8 text-xs bg-background"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-medium text-muted-foreground">{t('الاسم بالفرنسية', 'Nom en français')}</label>
                        <Input
                          type="text"
                          value={editNameFr}
                          onChange={(e) => setEditNameFr(e.target.value)}
                          className="rounded-xl h-8 text-xs bg-background font-mono"
                        />
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                      <div className="w-48">
                        <Select
                          value={editApplicableTo}
                          onValueChange={(v: 'both' | 'truck' | 'trailer') => setEditApplicableTo(v)}
                        >
                          <SelectTrigger className="rounded-xl h-8 text-xs bg-background">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="both">{t('🚛🚚 شاحنات ومقطورات', '🚛🚚 Camions et remorques')}</SelectItem>
                            <SelectItem value="truck">{t('🚛 شاحنات فقط', '🚛 Camions uniquement')}</SelectItem>
                            <SelectItem value="trailer">{t('🚚 مقطورات فقط', '🚚 Remorques uniquement')}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={handleCancelEdit}
                          disabled={actionLoading === cat.id}
                          className="rounded-xl h-8 text-xs"
                        >
                          {t('إلغاء', 'Annuler')}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => handleSaveEdit(cat.id)}
                          disabled={actionLoading === cat.id}
                          className="rounded-xl h-8 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
                        >
                          {actionLoading === cat.id ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Check className="w-3.5 h-3.5 me-1" />
                          )}
                          {t('حفظ التعديل', 'Enregistrer')}
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={cat.id}
                  className={`p-3 flex items-center justify-between gap-3 transition-colors ${
                    cat.is_active ? 'bg-card hover:bg-muted/20' : 'bg-muted/10 opacity-70'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-foreground truncate">
                        {primaryName}
                      </span>
                      {secondaryName && (
                        <span className="text-[11px] text-muted-foreground font-mono">
                          {secondaryName}
                        </span>
                      )}
                      {getApplicableBadge(cat.applicable_to)}
                      {isLinked ? (
                        <Badge
                          variant="secondary"
                          className="text-[10px] py-0 px-2 bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900/50"
                          title={t('عدد الوثائق المسجلة بهذا النوع في الأسطول', 'Nombre de documents enregistrés sous ce type')}
                        >
                          <FileText className="w-2.5 h-2.5 me-1" />
                          <span>{cat.usage_count} {t('وثيقة مسجلة', 'documents enregistrés')}</span>
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="text-[10px] py-0 px-1.5 text-muted-foreground border-dashed"
                        >
                          {t('غير مستخدم بعد', 'Non utilisé')}
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {/* Active Status Toggle */}
                    <div className="flex items-center gap-1" title={cat.is_active ? t('نشط ومتاح في القوائم', 'Actif et disponible') : t('معطل', 'Désactivé')}>
                      <Switch
                        checked={cat.is_active}
                        onCheckedChange={() => handleToggleStatus(cat)}
                        disabled={actionLoading === cat.id}
                      />
                    </div>

                    {/* Edit Button */}
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() => handleStartEdit(cat)}
                      disabled={actionLoading === cat.id}
                      className="h-8 w-8 rounded-xl text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/30 cursor-pointer"
                      title={t('تعديل هذا النوع', 'Modifier ce type')}
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </Button>

                    {/* Delete Button (Conditional: only enabled if usage_count == 0) */}
                    {isLinked ? (
                      <div
                        title={t(
                          `لا يمكن حذف هذا النوع لوجود ${cat.usage_count} وثيقة مسجلة مرتبطة به. يمكنك إلغاء تفعيله بدلاً من ذلك.`,
                          `Impossible de supprimer : ${cat.usage_count} document(s) associé(s). Vous pouvez le désactiver.`
                        )}
                      >
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          disabled
                          className="h-8 w-8 rounded-xl text-muted-foreground/40 cursor-not-allowed"
                        >
                          <Lock className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    ) : (
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={() => setDeletingCat(cat)}
                        disabled={actionLoading === cat.id}
                        className="h-8 w-8 rounded-xl text-destructive hover:text-destructive hover:bg-destructive/10 cursor-pointer"
                        title={t('حذف هذا النوع نهائياً (غير مرتبط بأي وثيقة)', 'Supprimer définitivement ce type (aucun document associé)')}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Delete Confirmation Alert Sub-dialog */}
      {deletingCat && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div
            className="bg-card p-5 rounded-2xl border border-destructive/30 max-w-md w-full shadow-xl space-y-3"
            dir={dir}
          >
            <div className="flex items-center gap-2 text-destructive font-bold text-sm">
              <AlertTriangle className="w-5 h-5" />
              <span>{t('تأكيد حذف نوع الوثيقة', 'Confirmer la suppression du type')}</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {locale === 'fr'
                ? `Êtes-vous sûr de vouloir supprimer le type de document "${deletingCat.name_fr || deletingCat.name}" ? Il a été vérifié qu'aucun document de flotte n'y est associé. Cette action est irréversible.`
                : `هل أنت متأكد من رغبتك في حذف نوع الوثيقة "${deletingCat.name}"؟ تم التأكد من عدم ارتباطه بأي وثائق أسطول حالية. لن تتمكن من التراجع عن هذه الخطوة.`}
            </p>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/60">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setDeletingCat(null)}
                disabled={actionLoading === deletingCat.id}
                className="rounded-xl text-xs cursor-pointer"
              >
                {t('إلغاء', 'Annuler')}
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleDeleteConfirm}
                disabled={actionLoading === deletingCat.id}
                className="rounded-xl text-xs bg-destructive text-destructive-foreground hover:bg-destructive/90 font-medium cursor-pointer"
              >
                {actionLoading === deletingCat.id ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin me-1" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5 me-1" />
                )}
                {t('تأكيد الحذف', 'Confirmer la suppression')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface DocumentCategoriesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCategoriesUpdated?: () => void;
}

export function DocumentCategoriesModal({
  isOpen,
  onClose,
  onCategoriesUpdated,
}: DocumentCategoriesModalProps) {
  const { dir } = useLanguage();
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[88vh] overflow-y-auto" dir={dir}>
        <DocumentCategoriesView
          isModal
          onClose={onClose}
          onCategoriesUpdated={onCategoriesUpdated}
        />
      </DialogContent>
    </Dialog>
  );
}

