'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/components/language-provider';
import { formatCurrency } from '@/lib/forex';
import {
  runPreClosingAudit,
  executeFiscalYearClosing,
} from '../services/fiscal-closing.actions';
import { generateAccountingExport } from '../services/accounting-export.actions';
import type { PreClosingAuditResult } from '../types';
import {
  Lock,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  Calendar,
  DollarSign,
  Coins,
  Download,
  RefreshCw,
  FileSpreadsheet,
  Layers,
  Sparkles,
  ShieldCheck,
} from 'lucide-react';

interface YearEndClosingWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function YearEndClosingWizard({
  isOpen,
  onClose,
  onSuccess,
}: YearEndClosingWizardProps) {
  const { t, dir } = useLanguage();
  const { toast } = useToast();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [exportingType, setExportingType] = useState<'sage100' | 'odoo' | null>(null);
  const [auditResult, setAuditResult] = useState<PreClosingAuditResult | null>(null);
  const [isCompleted, setIsCompleted] = useState(false);

  // حقول السنة المالية الجديدة
  const [nextYearName, setNextYearName] = useState('');
  const [nextStartDate, setNextStartDate] = useState('');
  const [nextEndDate, setNextEndDate] = useState('');

  // استدعاء فحص التدقيق المسبق عند فتح المعالج
  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setIsCompleted(false);
      loadAudit();
    }
  }, [isOpen]);

  const loadAudit = async () => {
    setLoadingAudit(true);
    try {
      const result = await runPreClosingAudit();
      setAuditResult(result);

      // ضبط القيم الافتراضية للسنة التالية تلقائياً بناءً على نهاية السنة الحالية
      const currentEndYear = new Date(result.endDate).getFullYear();
      const nextYearNum = currentEndYear + 1;
      setNextYearName(
        t(
          `السنة المالية ${nextYearNum}`,
          `Exercice Fiscal ${nextYearNum}`,
          `Ejercicio Fiscal ${nextYearNum}`
        )
      );
      setNextStartDate(`${nextYearNum}-01-01`);
      setNextEndDate(`${nextYearNum}-12-31`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t('خطأ غير متوقع', 'Erreur inattendue');
      toast({ title: t('خطأ في التدقيق', 'Erreur d\'audit'), description: msg, variant: 'destructive' });
    } finally {
      setLoadingAudit(false);
    }
  };

  // تنفيذ الإقفال والترحيل
  const handleExecuteClosing = async () => {
    if (!auditResult) return;
    setExecuting(true);

    try {
      const res = await executeFiscalYearClosing({
        fiscalYearId: auditResult.fiscalYearId,
        nextYearName,
        nextStartDate,
        nextEndDate,
      });

      if (!res.success) {
        throw new Error(res.error || t('فشل إقفال السنة المالية', 'Échec de clôture de l\'exercice'));
      }

      setIsCompleted(true);
      toast({
        title: t('✅ تم إقفال السنة المالية بنجاح', '✅ Exercice fiscal clôturé avec succès'),
        description: t(
          `تم تجميد السنة وتوليد الأرصدة الافتتاحية للسنة الجديدة: ${nextYearName}`,
          `L'exercice est verrouillé et les soldes initiaux ont été reportés pour : ${nextYearName}`
        ),
      });

      onSuccess?.();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t('حدث خطأ أثناء الإقفال', 'Erreur lors de la clôture');
      toast({ title: t('خطأ', 'Erreur'), description: msg, variant: 'destructive' });
    } finally {
      setExecuting(false);
    }
  };

  // تصدير فوري لقيود اليومية لـ Sage 100 أو Odoo
  const handleExportERP = async (software: 'sage100' | 'odoo') => {
    if (!auditResult) return;
    setExportingType(software);

    try {
      const res = await generateAccountingExport({
        startDate: auditResult.startDate,
        endDate: auditResult.endDate,
        journalTypes: ['sales', 'treasury'],
        software,
      });

      if (!res.success || !res.content) {
        throw new Error(res.error || t('فشل التصدير', 'Échec de l\'export'));
      }

      const blob = new Blob([res.content], { type: res.mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = res.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: t('تم تحميل ملف القيود بنجاح', 'Export ERP téléchargé avec succès'),
        description: `${res.filename} (${res.totalEntries} ${t('قيد متوازن', 'écritures équilibrées')})`,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t('خطأ في التصدير', 'Erreur d\'exportation');
      toast({ title: t('خطأ', 'Erreur'), description: msg, variant: 'destructive' });
    } finally {
      setExportingType(null);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto" dir={dir}>
        <DialogHeader className="text-start pb-2 border-b border-border/60">
          <div className="flex items-center gap-2 text-primary font-semibold text-xs mb-1">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>{t('إدارة الدورات المحاسبية', 'Gestion des cycles comptables', 'Accounting Cycles')}</span>
          </div>
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <Lock className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            {t(
              'معالج الإقفال السنوي الرسمي (Year-End Closing Wizard)',
              'Assistant de clôture d\'exercice annuel (Year-End Closing)',
              'Asistente de Cierre Anual de Ejercicio'
            )}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {t(
              'تجميد السجلات المحاسبية للسنة المنتهية، منع التعديلات بأثر رجعي، وترحيل الأرصدة الافتتاحية بدقة.',
              'Verrouillage des registres, prévention des modifications rétroactives et report des soldes initiaux.',
              'Bloqueo de registros contables, prevención de modificaciones retroactivas y traslado de saldos iniciales.'
            )}
          </DialogDescription>

          {/* Stepper Navigation */}
          <div className="flex items-center justify-between pt-3 text-xs">
            <div
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-all ${
                step === 1 ? 'bg-primary text-primary-foreground shadow-xs' : 'bg-muted text-muted-foreground'
              }`}
            >
              <span className="w-5 h-5 rounded-full bg-background/20 flex items-center justify-center text-[10px]">1</span>
              <span>{t('1. التدقيق المسبق', '1. Audit préalable', '1. Auditoría Previa')}</span>
            </div>

            <div className="h-0.5 w-6 bg-border mx-1" />

            <div
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-all ${
                step === 2 ? 'bg-primary text-primary-foreground shadow-xs' : 'bg-muted text-muted-foreground'
              }`}
            >
              <span className="w-5 h-5 rounded-full bg-background/20 flex items-center justify-center text-[10px]">2</span>
              <span>{t('2. ترحيل الأرصدة', '2. Report des soldes', '2. Traslado de Saldos')}</span>
            </div>

            <div className="h-0.5 w-6 bg-border mx-1" />

            <div
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-all ${
                step === 3 ? 'bg-primary text-primary-foreground shadow-xs' : 'bg-muted text-muted-foreground'
              }`}
            >
              <span className="w-5 h-5 rounded-full bg-background/20 flex items-center justify-center text-[10px]">3</span>
              <span>{t('3. التجميد والاعتماد', '3. Verrouillage', '3. Cierre y Bloqueo')}</span>
            </div>
          </div>
        </DialogHeader>

        {/* STEP 1: PRE-CLOSING AUDIT */}
        {step === 1 && (
          <div className="space-y-4 py-3">
            {loadingAudit ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground">
                <RefreshCw className="w-8 h-8 animate-spin text-primary" />
                <span className="text-xs font-semibold">
                  {t('جاري تدقيق قيود ومطابقات السنة المالية...', 'Audit en cours des écritures et rapprochements...')}
                </span>
              </div>
            ) : auditResult ? (
              <>
                <div className="bg-muted/40 p-3.5 rounded-xl border border-border/80 flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-foreground">{auditResult.fiscalYearName}</h4>
                    <p className="text-xs text-muted-foreground font-mono">
                      {auditResult.startDate} ⬅ {auditResult.endDate}
                    </p>
                  </div>
                  <Badge variant={auditResult.canClose ? 'default' : 'secondary'} className="gap-1">
                    {auditResult.canClose ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                        <span>{t('جاهز للإقفال', 'Prêt pour la clôture', 'Listo para el cierre')}</span>
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                        <span>{t('تنبيهات تدقيق', 'Avertissements d\'audit', 'Alertas de auditoría')}</span>
                      </>
                    )}
                  </Badge>
                </div>

                {/* Audit Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Unpaid Invoices */}
                  <div className="p-3.5 rounded-xl bg-card border border-border shadow-2xs space-y-1">
                    <span className="text-xs text-muted-foreground font-semibold">
                      {t('فواتير غير مسددة', 'Factures non soldées', 'Facturas pendientes')}
                    </span>
                    <div className="text-lg font-bold text-foreground">
                      {auditResult.unpaidInvoicesCount}{' '}
                      <span className="text-xs font-normal text-muted-foreground">
                        ({formatCurrency(auditResult.unpaidInvoicesTotalMAD, 'MAD')})
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      {t('ستبقى في كشوفات العملاء كأرصدة مستحقة.', 'Reportées dans les comptes clients.', 'Se trasladan como saldos pendientes.')}
                    </p>
                  </div>

                  {/* Active Trips */}
                  <div
                    className={`p-3.5 rounded-xl border shadow-2xs space-y-1 ${
                      auditResult.activeTripsCount > 0
                        ? 'bg-amber-500/5 border-amber-500/30'
                        : 'bg-card border-border'
                    }`}
                  >
                    <span className="text-xs text-muted-foreground font-semibold">
                      {t('رحلات تشغيلية غير مقفلة', 'Trajets non achevés', 'Viajes en curso')}
                    </span>
                    <div className="text-lg font-bold text-foreground">{auditResult.activeTripsCount}</div>
                    <p className="text-[11px] text-muted-foreground">
                      {auditResult.activeTripsCount > 0
                        ? t('يُفضل إقفال مصاريف الرحلات قبل قفل السنة.', 'Il est conseillé de clôturer les trajets avant.', 'Recomendable cerrar viajes antes del cierre.')
                        : t('كافة رحلات الفترة منتهية أو ملغاة.', 'Tous les trajets de la période sont terminés.', 'Todos los viajes están cerrados.')}
                    </p>
                  </div>

                  {/* Unreconciled Bank Transactions */}
                  <div className="p-3.5 rounded-xl bg-card border border-border shadow-2xs space-y-1">
                    <span className="text-xs text-muted-foreground font-semibold">
                      {t('معاملات بنكية معلقة', 'Transactions non rapprochées', 'Transacciones pendientes')}
                    </span>
                    <div className="text-lg font-bold text-foreground">{auditResult.unreconciledTransactionsCount}</div>
                    <p className="text-[11px] text-muted-foreground">
                      {t('حركات لم يتم اعتماد مطابقتها البنكية.', 'En attente de rapprochement bancaire.', 'Pendientes de conciliación bancaria.')}
                    </p>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-900 dark:text-blue-200 flex items-start gap-2">
                  <Sparkles className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
                  <span>
                    {t(
                      'التدقيق المسبق يضمن صحة الأرصدة المنقولة ومطابقتها لميزان المراجعة الرسمي دون التأثير على التزامات العملاء والموردين.',
                      'L\'audit garantit l\'exactitude des soldes reportés sans impacter les créances clients et dettes fournisseurs.',
                      'La auditoría garantiza la exactitud de los saldos trasladados sin afectar las cuentas por cobrar ni por pagar.'
                    )}
                  </span>
                </div>
              </>
            ) : null}
          </div>
        )}

        {/* STEP 2: CLOSING BALANCES & NEW YEAR SETUP */}
        {step === 2 && auditResult && (
          <div className="space-y-4 py-3">
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-foreground">
                {t('صافي الأرصدة الختامية المنقولة للخزينة', 'Soldes de clôture à reporter (Trésorerie)', 'Saldos de Cierre a Trasladar')}
              </h4>
              <p className="text-xs text-muted-foreground">
                {t(
                  'يتم ترحيل هذه الأرصدة بدقة متناهية (Decimal.js) لتكون الرصيد الافتتاحي المنقول للسنة الجديدة.',
                  'Ces montants constitueront le solde d\'ouverture (Opening Balance) du nouvel exercice.',
                  'Estos importes constituirán el saldo inicial del nuevo ejercicio fiscal.'
                )}
              </p>
            </div>

            {/* Calculated Balances */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-4 rounded-xl bg-card border border-border border-s-4 border-s-blue-600 shadow-2xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground">
                    {t('رصيد الخزينة بالدرهم (MAD)', 'Solde Trésorerie (MAD)', 'Saldo Tesorería (MAD)')}
                  </span>
                  <Coins className="w-4 h-4 text-blue-600" />
                </div>
                <div className="text-xl font-bold font-mono text-foreground">
                  {formatCurrency(auditResult.closingBalanceMAD, 'MAD')}
                </div>
                <span className="text-[10px] text-muted-foreground block">
                  {t('الرصيد الافتتاحي المنقول: MAD', 'Report à nouveau : MAD', 'Saldo Inicial: MAD')}
                </span>
              </div>

              <div className="p-4 rounded-xl bg-card border border-border border-s-4 border-s-emerald-600 shadow-2xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground">
                    {t('رصيد الخزينة باليورو (EUR)', 'Solde Trésorerie (EUR)', 'Saldo Tesorería (EUR)')}
                  </span>
                  <DollarSign className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="text-xl font-bold font-mono text-foreground">
                  {formatCurrency(auditResult.closingBalanceEUR, 'EUR')}
                </div>
                <span className="text-[10px] text-muted-foreground block">
                  {t('الرصيد الافتتاحي المنقول: EUR', 'Report à nouveau : EUR', 'Saldo Inicial: EUR')}
                </span>
              </div>
            </div>

            {/* Next Fiscal Year Form */}
            <div className="p-4 rounded-xl bg-muted/40 border border-border/80 space-y-3">
              <h5 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-primary" />
                <span>{t('إعدادات السنة المالية الجديدة التالية:', 'Configuration du nouvel exercice fiscal :', 'Configuración del Nuevo Ejercicio Fiscal :')}</span>
              </h5>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">
                  {t('اسم السنة المالية الجديدة:', 'Nom de l\'exercice :', 'Nombre del Ejercicio :')}
                </label>
                <Input
                  value={nextYearName}
                  onChange={(e) => setNextYearName(e.target.value)}
                  className="h-9 text-xs rounded-xl"
                  placeholder={t('السنة المالية 2027', 'Exercice 2027', 'Ejercicio 2027')}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">
                    {t('تاريخ البداية:', 'Date de début :', 'Fecha de Inicio :')}
                  </label>
                  <Input
                    type="date"
                    value={nextStartDate}
                    onChange={(e) => setNextStartDate(e.target.value)}
                    className="h-9 text-xs font-mono rounded-xl"
                    dir="ltr"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">
                    {t('تاريخ النهاية:', 'Date de fin :', 'Fecha de Fin :')}
                  </label>
                  <Input
                    type="date"
                    value={nextEndDate}
                    onChange={(e) => setNextEndDate(e.target.value)}
                    className="h-9 text-xs font-mono rounded-xl"
                    dir="ltr"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: LOCK & FINAL CONFIRMATION */}
        {step === 3 && auditResult && (
          <div className="space-y-4 py-3">
            {!isCompleted ? (
              <>
                <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive space-y-2">
                  <div className="flex items-center gap-2 font-bold text-sm">
                    <AlertTriangle className="w-5 h-5 shrink-0" />
                    <span>
                      {t(
                        'تحذير تجميد القيود المحاسبية الرسمية',
                        'Avertissement de verrouillage comptable',
                        'Advertencia de Bloqueo Contable'
                      )}
                    </span>
                  </div>
                  <p className="text-xs leading-relaxed text-destructive/90">
                    {t(
                      `بمجرد تأكيد الإقفال، سيتم تغيير حالة (${auditResult.fiscalYearName}) إلى مغلقة (is_closed = true) وتجميد كافة الفواتير وحركات الخزينة المنتمية لهذه الفترة لمنع أي تعديل أو حذف بأثر رجعي. ستصبح السنة للقراءة والتدقيق فقط.`,
                      `Une fois validée, l'exercice (${auditResult.fiscalYearName}) sera clôturé. Toutes les écritures seront figées en lecture seule pour éviter toute altération rétroactive.`,
                      `Una vez confirmado, el ejercicio (${auditResult.fiscalYearName}) quedará cerrado. Todos los asientos quedarán protegidos en modo solo lectura.`
                    )}
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-muted/40 border border-border/80 text-xs space-y-2">
                  <div className="font-semibold text-foreground">
                    {t('ملخص إجراءات الإقفال الآلية:', 'Résumé des actions :', 'Resumen de Acciones :')}
                  </div>
                  <ul className="space-y-1.5 list-disc list-inside text-muted-foreground">
                    <li>
                      {t(
                        `تجميد قيود الفترة: ${auditResult.startDate} إلى ${auditResult.endDate}.`,
                        `Verrouillage de la période du ${auditResult.startDate} au ${auditResult.endDate}.`,
                        `Bloqueo del período del ${auditResult.startDate} al ${auditResult.endDate}.`
                      )}
                    </li>
                    <li>
                      {t(
                        `ترحيل رصيد افتتاحي: ${formatCurrency(auditResult.closingBalanceMAD, 'MAD')} و ${formatCurrency(auditResult.closingBalanceEUR, 'EUR')}.`,
                        `Report des soldes à nouveau : ${formatCurrency(auditResult.closingBalanceMAD, 'MAD')} et ${formatCurrency(auditResult.closingBalanceEUR, 'EUR')}.`,
                        `Traslado de saldos iniciales : ${formatCurrency(auditResult.closingBalanceMAD, 'MAD')} y ${formatCurrency(auditResult.closingBalanceEUR, 'EUR')}.`
                      )}
                    </li>
                    <li>
                      {t(
                        `تفعيل السنة المالية الجديدة: ${nextYearName}.`,
                        `Activation du nouvel exercice : ${nextYearName}.`,
                        `Activación del nuevo ejercicio : ${nextYearName}.`
                      )}
                    </li>
                    <li>
                      {t(
                        'توثيق العملية في سجل التدقيق الأمني (Audit Logs) باسم وتاريخ المستخدم المعتمد.',
                        'Enregistrement de l\'opération dans les logs d\'audit sécurisés.',
                        'Registro de la operación en los registros de auditoría de seguridad.'
                      )}
                    </li>
                  </ul>
                </div>
              </>
            ) : (
              <div className="space-y-4 py-4 text-center">
                <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-600 mx-auto flex items-center justify-center">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-lg font-bold text-foreground">
                    {t('تم إقفال السنة المالية بنجاح تام', 'Exercice fiscal clôturé avec succès', 'Ejercicio Cerrado Exitosamente')}
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    {t(
                      'تم تجميد الدفاتر وحفظ الأرصدة الافتتاحية للسنة المالية الجديدة.',
                      'Les écritures ont été figées et les soldes reportés sur le nouvel exercice.',
                      'Los libros han sido cerrados y los saldos iniciales han sido registrados.'
                    )}
                  </p>
                </div>

                {/* Export Options */}
                <div className="p-4 rounded-xl bg-muted/40 border border-border text-start space-y-3">
                  <div className="text-xs font-bold text-foreground flex items-center gap-2">
                    <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                    <span>
                      {t(
                        'تصدير القيود لمحاسب الشركة الخارجي (Sage / Odoo):',
                        'Exporter les écritures pour le comptable externe (Sage / Odoo) :',
                        'Exportar Asientos para Contabilidad Externa (Sage / Odoo) :'
                      )}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleExportERP('sage100')}
                      disabled={exportingType !== null}
                      className="rounded-xl text-xs gap-1.5 h-9"
                    >
                      {exportingType === 'sage100' ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Download className="w-3.5 h-3.5 text-indigo-600" />
                      )}
                      <span>Sage 100 (.txt tabulé)</span>
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleExportERP('odoo')}
                      disabled={exportingType !== null}
                      className="rounded-xl text-xs gap-1.5 h-9"
                    >
                      {exportingType === 'odoo' ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Download className="w-3.5 h-3.5 text-emerald-600" />
                      )}
                      <span>Odoo Accounting (.csv)</span>
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-3 border-t border-border/60">
          <div>
            {step > 1 && !isCompleted && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setStep((s) => (s - 1) as 1 | 2)}
                disabled={executing}
                className="rounded-xl text-xs gap-1.5"
              >
                {dir === 'rtl' ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
                <span>{t('السابق', 'Précédent', 'Anterior')}</span>
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={executing}
              className="rounded-xl text-xs"
            >
              {isCompleted ? t('إغلاق', 'Fermer', 'Cerrar') : t('إلغاء', 'Annuler', 'Cancelar')}
            </Button>

            {step === 1 && (
              <Button
                size="sm"
                onClick={() => setStep(2)}
                disabled={loadingAudit || !auditResult}
                className="rounded-xl text-xs gap-1.5 font-bold"
              >
                <span>{t('متابعة لترحيل الأرصدة', 'Continuer vers le report', 'Continuar')}</span>
                {dir === 'rtl' ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
              </Button>
            )}

            {step === 2 && (
              <Button
                size="sm"
                onClick={() => setStep(3)}
                disabled={!nextYearName.trim() || !nextStartDate || !nextEndDate}
                className="rounded-xl text-xs gap-1.5 font-bold"
              >
                <span>{t('متابعة للاعتماد والتجميد', 'Passer à la confirmation', 'Continuar')}</span>
                {dir === 'rtl' ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
              </Button>
            )}

            {step === 3 && !isCompleted && (
              <Button
                size="sm"
                onClick={handleExecuteClosing}
                disabled={executing}
                className="rounded-xl text-xs gap-1.5 bg-destructive hover:bg-destructive/90 text-white font-bold"
              >
                {executing ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Lock className="w-4 h-4" />
                )}
                <span>{t('تأكيد وإقفال السنة نهائياً', 'Confirmer la clôture définitive', 'Confirmar Cierre Definitivo')}</span>
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

