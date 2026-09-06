'use client';

import { useState, useCallback, useEffect } from 'react';
import { renewFleetDocument } from '@/features/fleet/services/fleet-documents.actions';
import { DOCUMENT_TYPE_LABELS } from '@/features/fleet/services/fleet-documents.constants';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Calendar, DollarSign, RefreshCw, Landmark, ArrowRight, ShieldCheck } from 'lucide-react';
import type { FleetDocument, CashBox } from '@/types/database';
import { DEFAULT_CASH_BOXES, fallbackArray } from '@/lib/default-data';
import { useLanguage } from '@/components/language-provider';

interface QuickRenewDialogProps {
  document: FleetDocument | null;
  vehicleName: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function QuickRenewDialog({ document, vehicleName, isOpen, onClose, onSuccess }: QuickRenewDialogProps) {
  const { locale, dir, t } = useLanguage();
  const [cost, setCost] = useState('');
  const [currency, setCurrency] = useState('MAD');
  const [cashBoxId, setCashBoxId] = useState<number | ''>('');
  const [newExpiryDate, setNewExpiryDate] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [cashBoxes, setCashBoxes] = useState<CashBox[]>(DEFAULT_CASH_BOXES);

  const { toast } = useToast();

  useEffect(() => {
    if (isOpen) {
      const fetchCashBoxes = async () => {
        try {
          const supabase = createClient();
          const { data } = await supabase.from('cash_boxes').select('*').order('name');
          if (data && data.length > 0) {
            setCashBoxes(fallbackArray(data, DEFAULT_CASH_BOXES));
          }
        } catch {
          setCashBoxes(DEFAULT_CASH_BOXES);
        }
      };
      fetchCashBoxes();
    }
  }, [isOpen]);

  // Pre-calculate +365 days when document is selected
  useEffect(() => {
    if (document) {
      const baseDate = document.expiry_date ? new Date(document.expiry_date) : new Date();
      // If baseDate is far in the past, renew from today, otherwise from expiryDate + 1 year
      const now = new Date();
      const targetDate = baseDate < now ? now : baseDate;
      const nextYear = new Date(targetDate);
      nextYear.setFullYear(nextYear.getFullYear() + 1);

      setNewExpiryDate(nextYear.toISOString().split('T')[0]);
      setCost(document.cost ? String(document.cost) : '');
      setCurrency(document.currency || 'MAD');
    }
  }, [document]);

  // Set default cash box when cash boxes load
  useEffect(() => {
    if (cashBoxes.length > 0 && !cashBoxId) {
      const madBox = cashBoxes.find((c) => c.currency === 'MAD') || cashBoxes[0];
      if (madBox) setCashBoxId(madBox.id);
    }
  }, [cashBoxes, cashBoxId]);

  const handleClose = useCallback(() => {
    setCost('');
    setNotes('');
    onClose();
  }, [onClose]);

  const handleRenew = async () => {
    if (!document) return;
    if (!newExpiryDate) {
      toast({ title: 'يرجى تحديد تاريخ الانتهاء الجديد', variant: 'destructive' });
      return;
    }

    const numCost = parseFloat(cost) || 0;
    if (numCost > 0 && !cashBoxId) {
      toast({ title: 'يرجى اختيار الحساب / الصندوق المالي لتسجيل المصروف', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      const result = await renewFleetDocument({
        docId: document.id,
        newExpiryDate,
        cost: numCost,
        currency,
        cashBoxId: cashBoxId ? Number(cashBoxId) : undefined,
        notes,
      });

      if (!result.success) {
        throw new Error(result.error);
      }

      toast({
        title: 'تم تجديد الوثيقة بنجاح',
        description: `تم تحديث الصلاحية إلى ${newExpiryDate} ${numCost > 0 ? `وتسجيل المصروف (${numCost} ${currency})` : ''}`,
      });

      if (onSuccess) onSuccess();
      handleClose();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'حدث خطأ غير متوقع';
      toast({
        title: t('خطأ في التجديد', 'Erreur de renouvellement'),
        description: message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  if (!document) return null;

  const docLabel =
    locale === 'fr'
      ? DOCUMENT_TYPE_LABELS[document.document_type]?.label_fr || document.document_type
      : DOCUMENT_TYPE_LABELS[document.document_type]?.label_ar || document.document_type;
  const currentExpiry = document.expiry_date
    ? new Date(document.expiry_date).toLocaleDateString('fr-MA')
    : (locale === 'fr' ? 'Non enregistré' : 'غير مسجل');

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg" dir={dir}>
        <DialogHeader>
          <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wide mb-1">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span>{t('نظام التجديد السريع والربط المالي', 'Renouvellement rapide & Trésorerie')}</span>
          </div>
          <DialogTitle className="font-amiri text-xl">
            {t('تجديد وثيقة: ', 'Renouvellement du document : ')}{docLabel}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {t('المركبة: ', 'Véhicule : ')}<span className="font-semibold text-foreground font-mono">{vehicleName}</span> — {t('تاريخ الانتهاء الحالي: ', 'Expiration actuelle : ')}<span className="font-semibold text-foreground font-mono">{currentExpiry}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-3 text-sm">
          {/* New Expiry Date */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-blue-500" />
              {t('تاريخ الصلاحية الجديد (+365 يوماً مقترح)', "Nouvelle date d'expiration (+365 j suggérés)")}
            </label>
            <Input
              type="date"
              value={newExpiryDate}
              onChange={(e) => setNewExpiryDate(e.target.value)}
              className="rounded-xl font-mono text-sm"
            />
          </div>

          {/* Renewal Cost & Currency */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-emerald-500" />
                {t('تكلفة التجديد', 'Coût de renouvellement')}
              </label>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
                className="rounded-xl font-mono text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">{t('العملة', 'Devise')}</label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder={t('اختر العملة', 'Choisir la devise')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MAD">MAD ({t('درهم', 'Dirham')})</SelectItem>
                  <SelectItem value="EUR">EUR ({t('يورو', 'Euro')})</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Treasury Account Selection (if cost > 0) */}
          {parseFloat(cost) > 0 && (
            <div className="space-y-1.5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
              <label className="text-xs font-semibold text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
                <Landmark className="w-3.5 h-3.5 text-amber-600" />
                {t('خصم المصروف تلقائياً من الصندوق / الحساب', 'Débit automatique de la caisse / compte')}
              </label>
              <Select
                value={cashBoxId ? String(cashBoxId) : ''}
                onValueChange={(val) => setCashBoxId(Number(val))}
              >
                <SelectTrigger className="rounded-xl bg-background border-amber-300 dark:border-amber-700">
                  <SelectValue placeholder={t('اختر صندوق الخزينة أو البنك', 'Choisir la caisse ou banque')} />
                </SelectTrigger>
                <SelectContent>
                  {cashBoxes.map((cb) => (
                    <SelectItem key={cb.id} value={String(cb.id)}>
                      {cb.name} ({cb.currency})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-amber-600/90 dark:text-amber-400 mt-1">
                {t('سيقوم النظام بإنشاء حركة قيد في الخزينة تلقائياً باسم الوثيقة والمركبة.', 'Une transaction de trésorerie sera générée automatiquement.')}
              </p>
            </div>
          )}

          {/* Notes */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground">{t('ملاحظات التجديد (اختياري)', 'Notes de renouvellement (optionnel)')}</label>
            <Input
              type="text"
              placeholder={t('مثال: تم التجديد عبر وكالة التأمين - وصل رقم #9921', 'Ex: Reçu agence #9921')}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="rounded-xl text-xs"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-border/50">
          <Button variant="ghost" onClick={handleClose} disabled={loading} className="rounded-xl">
            {t('إلغاء', 'Annuler')}
          </Button>
          <Button
            onClick={handleRenew}
            disabled={loading}
            className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-md font-medium"
          >
            {loading ? (
              <RefreshCw className={`w-4 h-4 ${dir === 'rtl' ? 'ml-1.5' : 'mr-1.5'} animate-spin`} />
            ) : (
              <ArrowRight className={`w-4 h-4 ${dir === 'rtl' ? 'ml-1.5' : 'mr-1.5'} ${dir === 'ltr' ? 'rotate-180' : ''}`} />
            )}
            {t('تأكيد التجديد وتحديث السجل', 'Confirmer le renouvellement')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
