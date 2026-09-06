'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { getProviderLedger, recordProviderPayment } from '@/features/providers/services/provider.actions';
import { Wrench, Truck, DollarSign, ArrowUpRight, Wallet, Calendar } from 'lucide-react';
import { formatCurrency } from '@/lib/forex';
import { DEFAULT_CASH_BOXES, fallbackArray } from '@/lib/default-data';
import { useLanguage } from '@/components/language-provider';
import Decimal from 'decimal.js';

interface LedgerEntry {
  id: number;
  source: 'repair_invoice' | 'truck_maintenance' | 'payment';
  date: string;
  description: string;
  debit: number;
  credit: number;
  currency: string;
  runningBalance: number;
}

interface ProviderLedgerData {
  provider: { id: number; name: string };
  entries: LedgerEntry[];
  totalDebt: number;
  balances: Record<string, number>;
}

interface CashBox {
  id: number;
  code: string;
  created_at: string;
}

export default function ProviderLedgerScreen({ providerId }: { providerId: number }) {
  const { t, dir, locale } = useLanguage();
  const [ledger, setLedger] = useState<ProviderLedgerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [selectedCashBoxId, setSelectedCashBoxId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cashBoxes, setCashBoxes] = useState<CashBox[]>([]);

  const { toast } = useToast();
  const supabase = useMemo(() => createClient(), []);

  const fetchLedger = useCallback(async () => {
    setLoading(true);
    const result = await getProviderLedger(providerId);
    if (result.success && result.data) {
      setLedger(result.data as ProviderLedgerData);
    } else {
      toast({
        title: t('خطأ', 'Erreur'),
        description: result.error || t('فشل في جلب البيانات', 'Échec du chargement des données'),
        variant: 'destructive',
      });
    }
    setLoading(false);
  }, [providerId, toast, t]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchLedger();

      let cancelled = false;
      const fetchCashBoxes = async () => {
        try {
          const { data } = await supabase.from('cash_boxes').select('id, code, created_at');
          if (!cancelled) {
            setCashBoxes(fallbackArray(data, DEFAULT_CASH_BOXES as any));
          }
        } catch {
          if (!cancelled) {
            setCashBoxes(DEFAULT_CASH_BOXES as any);
          }
        }
      };
      fetchCashBoxes();
      return () => {
        cancelled = true;
      };
    }, 0);

    return () => clearTimeout(timer);
  }, [fetchLedger, supabase]);

  const handleSettleDebt = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const decAmount = new Decimal(paymentAmount || '0');
      if (decAmount.isZero() || decAmount.isNegative()) {
        toast({ title: t('خطأ', 'Erreur'), description: t('المبلغ غير صحيح', 'Montant invalide'), variant: 'destructive' });
        setIsSubmitting(false);
        return;
      }

      const result = await recordProviderPayment(providerId, decAmount.toNumber(), parseInt(selectedCashBoxId));
      if (result.success) {
        toast({ title: t('تم تسجيل الدفعة بنجاح', 'Paiement enregistré avec succès') });
        setShowPaymentModal(false);
        setPaymentAmount('');
        setSelectedCashBoxId('');
        fetchLedger();
      } else {
        toast({ title: t('خطأ', 'Erreur'), description: result.error || t('فشل تسجيل الدفعة', 'Échec de l\'enregistrement du paiement'), variant: 'destructive' });
      }
    } catch {
      toast({ title: t('خطأ', 'Erreur'), description: t('المبلغ غير صحيح', 'Montant invalide'), variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const availableCashBoxes = cashBoxes.filter((cb) => cb.code !== 'secretary_cash');

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96" dir={dir}>
        <p className="text-muted-foreground">{t('جاري تحميل دفتر الأستاذ...', 'Chargement du grand livre...')}</p>
      </div>
    );
  }

  if (!ledger) {
    return (
      <div className="text-center py-12" dir={dir}>
        <p className="text-muted-foreground">{t('لا توجد بيانات متاحة', 'Aucune donnée disponible')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6" dir={dir}>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-amiri text-foreground">
            {t('دفتر الأستاذ - ', 'Grand Livre - ')}{ledger.provider.name}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {t('سجل الديون والمدفوعات للمزود', 'Historique des créances, dettes et règlements du prestataire')}
          </p>
        </div>
        <Button onClick={() => setShowPaymentModal(true)}>
          <Wallet className={`w-4 h-4 ${dir === 'rtl' ? 'ml-2' : 'mr-2'}`} />
          {t('تسوية دين', 'Régler la dette')}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-r-4 border-r-amber-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-amber-500" />
              {t('إجمالي الدين', 'Dette Totale')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-foreground">
              {formatCurrency(ledger.totalDebt, 'MAD')}
            </div>
          </CardContent>
        </Card>

        <Card className="border-r-4 border-r-blue-600">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Wrench className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              {t('فواتير الصيانة', 'Factures d\'Atelier')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-foreground">
              {ledger.entries.filter((e) => e.source === 'repair_invoice').length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">{t('فاتورة مسجلة', 'facture(s) enregistrée(s)')}</p>
          </CardContent>
        </Card>

        <Card className="border-r-4 border-r-emerald-600">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Truck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              {t('مصاريف الشاحنات', 'Frais Véhicules')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-foreground">
              {ledger.entries.filter((e) => e.source === 'truck_maintenance').length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">{t('عملية صيانة / وقود', 'opération(s) entretien / carburant')}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-amiri text-foreground">{t('الخط الزمني للمعاملات', 'Chronologie des Opérations')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {ledger.entries.map((entry) => (
              <div
                key={`${entry.source}-${entry.id}`}
                className="flex items-center justify-between p-4 bg-muted/40 hover:bg-muted/70 transition-colors rounded-lg border-r-4"
                style={{
                  borderRightColor: entry.credit > 0 ? '#10b981' : entry.source === 'repair_invoice' ? '#f59e0b' : '#3b82f6',
                }}
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${entry.credit > 0 ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'}`}>
                    {entry.credit > 0 ? <ArrowUpRight className="w-5 h-5" /> : entry.source === 'repair_invoice' ? <Wrench className="w-5 h-5" /> : <Truck className="w-5 h-5" />}
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{entry.description}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                      <Calendar className="w-3 h-3" />
                      <span>{new Date(entry.date).toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'ar-MA')}</span>
                      <span className="px-2 py-0.5 bg-muted rounded-full text-[10px] font-bold uppercase">
                        {entry.source === 'repair_invoice' ? t('فاتورة', 'Facture') : entry.source === 'truck_maintenance' ? t('صيانة', 'Entretien') : t('دفعة', 'Règlement')}
                      </span>
                    </div>
                  </div>
                </div>
                <div className={dir === 'rtl' ? 'text-left' : 'text-right'}>
                  {entry.debit > 0 && (
                    <p className="font-bold font-mono text-rose-600 dark:text-rose-400">
                      -{formatCurrency(entry.debit, entry.currency)}
                    </p>
                  )}
                  {entry.credit > 0 && (
                    <p className="font-bold font-mono text-emerald-600 dark:text-emerald-400">
                      +{formatCurrency(entry.credit, entry.currency)}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {t('الرصيد: ', 'Solde : ')}{formatCurrency(entry.runningBalance, entry.currency)}
                  </p>
                </div>
              </div>
            ))}
            {ledger.entries.length === 0 && (
              <div className="text-center py-8">
                <p className="text-muted-foreground">{t('لا توجد معاملات مسجلة لهذا المزود', 'Aucune transaction enregistrée pour ce prestataire')}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {showPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" dir={dir}>
          <Card className="w-full max-w-lg shadow-2xl">
            <CardHeader>
              <CardTitle className="font-amiri">{t('تسوية دين - ', 'Règlement Dette - ')}{ledger.provider.name}</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSettleDebt} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t('المبلغ', 'Montant')}</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    placeholder="0.00"
                    required
                    dir="ltr"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">{t('صندوق الدفع', 'Caisse de paiement')}</label>
                  <select
                    value={selectedCashBoxId}
                    onChange={(e) => setSelectedCashBoxId(e.target.value)}
                    className="w-full h-10 px-3 py-2 border border-input bg-card text-foreground rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring shadow-2xs transition-colors [color-scheme:light] dark:[color-scheme:dark]"
                    required
                  >
                    <option value="">{t('-- اختر الصندوق --', '-- Sélectionner la caisse --')}</option>
                    {availableCashBoxes.map((cb) => (
                      <option key={cb.id} value={cb.id}>
                        {cb.code || `${t('صندوق', 'Caisse')} #${cb.id}`}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground">{t('يُمنع استخدام صندوق Secretary لهذه العملية', 'La caisse Secretary est exclue pour cette opération')}</p>
                </div>

                <div className="flex gap-2 pt-2 border-t border-border">
                  <Button type="submit" disabled={isSubmitting} className="flex-1">
                    {isSubmitting ? t('جاري الحفظ...', 'Enregistrement...') : t('تسوية الدين', 'Régler la dette')}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setShowPaymentModal(false)}>
                    {t('إلغاء', 'Annuler')}
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
