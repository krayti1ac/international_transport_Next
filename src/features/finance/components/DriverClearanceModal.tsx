'use client';

import React, { useRef } from 'react';
import { useLanguage } from '@/components/language-provider';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/forex';
import type { DriverSettlementStatement } from '../types/fiscal-settlements.types';
import { getDriverClearanceExportAction } from '../services/financial-export.actions';
import {
  FileText,
  Printer,
  CheckCircle2,
  AlertCircle,
  Truck,
  User,
  Calendar,
  ShieldCheck,
  Building,
  Receipt,
  Download,
  Loader2,
} from 'lucide-react';

interface DriverClearanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  statement: (DriverSettlementStatement & { driver?: { name: string; phone?: string; matricule?: string } }) | null;
}

export function DriverClearanceModal({
  isOpen,
  onClose,
  statement,
}: DriverClearanceModalProps) {
  const { t, dir, locale } = useLanguage();
  const printRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = React.useState(false);

  const handleExportPdf = async () => {
    if (!statement) return;
    setIsExporting(true);
    try {
      const res = await getDriverClearanceExportAction(statement.id, locale);
      if (res.success && res.htmlContent) {
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          printWindow.document.write(res.htmlContent);
          printWindow.document.close();
          printWindow.focus();
          setTimeout(() => {
            printWindow.print();
          }, 350);
        }
      }
    } finally {
      setIsExporting(false);
    }
  };

  if (!statement) return null;

  const handlePrint = () => {
    window.print();
  };

  const isPositiveVariance = statement.expenses_advances_balance_mad >= 0;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-6 bg-background text-foreground">
        <DialogHeader className="border-b pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-primary/10 rounded-xl text-primary">
                <FileText className="w-6 h-6" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold flex items-center gap-2">
                  {t('كشف تصفية مصاريف الطريق وإبراء ذمة سائق', 'Décompte de Frais de Route & Décharge', 'Liquidación de Gastos y Finiquito')}
                  <Badge variant="outline" className="font-mono text-xs uppercase ms-2">
                    {statement.statement_number}
                  </Badge>
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  {t(
                    'وثيقة إدارية ومالية رسمية معتمدة لتسوية العهدة والمستحقات التشغيلية الدولية',
                    'Document officiel de régularisation et apurement des frais de transport international',
                    'Documento oficial de regularización y liquidación de transporte internacional'
                  )}
                </DialogDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge
                className={
                  statement.status === 'settled'
                    ? 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30'
                    : statement.status === 'approved'
                    ? 'bg-purple-500/15 text-purple-600 border-purple-500/30'
                    : statement.status === 'audited'
                    ? 'bg-blue-500/15 text-blue-600 border-blue-500/30'
                    : 'bg-amber-500/15 text-amber-600 border-amber-500/30'
                }
              >
                {statement.status.toUpperCase()}
              </Badge>
            </div>
          </div>
        </DialogHeader>

        {/* Printable Clearance Sheet Body */}
        <div ref={printRef} className="space-y-6 py-2 print:p-8 print:text-black">
          {/* Header Info Block */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-xl bg-muted/40 border">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-primary mb-2">
                <Building className="w-4 h-4" />
                <span>{t('شركة ترانس بودانون ش.م.م', 'Trans Bodanon S.A.R.L.', 'Trans Bodanon S.L.')}</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {t('النقل الدولي للبضائع واللوجستيك المبرد', 'Transport International Routier & Logistique', 'Transporte Internacional de Mercancías')}
                <br />
                ICE: 002938475000084 | RC: 104928 | Patente: 492019
                <br />
                Tanger Med Port Free Zone, Maroc
              </p>
            </div>

            <div className="border-t md:border-t-0 md:border-s md:ps-4 pt-2 md:pt-0 space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5" />
                  {t('السائق المكلف', 'Chauffeur', 'Chofer')}:
                </span>
                <span className="font-bold text-foreground">
                  {statement.driver?.name || `#${statement.driver_id}`}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  {t('الفترة التشغيلية', 'Période', 'Período')}:
                </span>
                <span className="font-mono font-medium">
                  {statement.period_start} ➔ {statement.period_end}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Truck className="w-3.5 h-3.5" />
                  {t('الرحلات المنجزة', 'Voyages Réalisés', 'Viajes Realizados')}:
                </span>
                <span className="font-semibold">
                  {statement.trips_count} {t('رحلة', 'voyages', 'viajes')} ({statement.total_distance_km} km)
                </span>
              </div>
            </div>
          </div>

          {/* 3-Column Accounting Reconciliation Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Box 1: Driver Compensation */}
            <div className="p-3.5 rounded-xl border bg-card/60 space-y-2">
              <div className="text-xs font-semibold text-muted-foreground uppercase flex items-center justify-between">
                <span>{t('1. مستحقات السائق', '1. Rémunération', '1. Retribución')}</span>
                <ShieldCheck className="w-4 h-4 text-primary" />
              </div>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('الراتب الأساسي', 'Salaire de Base', 'Salario Base')}:</span>
                  <span className="font-mono">{formatCurrency(statement.base_salary_mad, 'MAD')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('عمولة الرحلات', 'Primes Missions', 'Primas Viaje')}:</span>
                  <span className="font-mono text-emerald-600 font-medium">
                    +{formatCurrency(statement.mission_bonuses_mad, 'MAD')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('مكافأة السلامة', 'Prime Sécurité', 'Bono Seguridad')}:</span>
                  <span className="font-mono text-emerald-600 font-medium">
                    +{formatCurrency(statement.safety_bonus_mad, 'MAD')}
                  </span>
                </div>
                <div className="pt-1.5 border-t flex justify-between font-bold text-sm">
                  <span>{t('الإجمالي', 'Brut', 'Total Bruto')}:</span>
                  <span className="font-mono text-primary">
                    {formatCurrency(statement.gross_driver_earnings_mad, 'MAD')}
                  </span>
                </div>
              </div>
            </div>

            {/* Box 2: Advances vs Legitimate Expenses */}
            <div className="p-3.5 rounded-xl border bg-card/60 space-y-2">
              <div className="text-xs font-semibold text-muted-foreground uppercase flex items-center justify-between">
                <span>{t('2. موازنة نفقات الطريق', '2. Balance Frais / Avances', '2. Balance Gastos')}</span>
                <Receipt className="w-4 h-4 text-blue-500" />
              </div>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('السلف المسلمة', 'Avances Reçues', 'Anticipos')}:</span>
                  <span className="font-mono text-amber-600 font-medium">
                    {formatCurrency(statement.total_advances_mad, 'MAD')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('المصاريف الموثقة', 'Frais Justifiés', 'Gastos Ruta')}:</span>
                  <span className="font-mono text-blue-600 font-medium">
                    {formatCurrency(statement.total_driver_expenses_mad, 'MAD')}
                  </span>
                </div>
                <div className="text-[10px] text-muted-foreground ps-2">
                  • {t('وقود', 'Carburant', 'Combustible')}: {formatCurrency(statement.total_fuel_expenses_mad, 'MAD')} | {t('طرق', 'Péages', 'Peajes')}: {formatCurrency(statement.total_toll_expenses_mad, 'MAD')}
                </div>
                <div className="pt-1.5 border-t flex justify-between font-bold text-sm">
                  <span>{t('فارق العهدة', 'Solde Avance', 'Saldo Anticipo')}:</span>
                  <span
                    className={`font-mono ${
                      isPositiveVariance ? 'text-emerald-600' : 'text-amber-600'
                    }`}
                  >
                    {isPositiveVariance ? '+' : ''}
                    {formatCurrency(statement.expenses_advances_balance_mad, 'MAD')}
                  </span>
                </div>
              </div>
            </div>

            {/* Box 3: Net Final Clearance */}
            <div className="p-3.5 rounded-xl border bg-primary/5 border-primary/20 space-y-2">
              <div className="text-xs font-semibold text-primary uppercase flex items-center justify-between">
                <span>{t('3. صافي الصرف وإبراء الذمة', '3. Net à Payer & Décharge', '3. Neto a Liquidar')}</span>
                <CheckCircle2 className="w-4 h-4 text-primary" />
              </div>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('مستحقات العمل', 'Rémunération', 'Retribución')}:</span>
                  <span className="font-mono">{formatCurrency(statement.gross_driver_earnings_mad, 'MAD')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('تسوية المصاريف', 'Régul. Frais', 'Ajuste Gastos')}:</span>
                  <span className={`font-mono ${isPositiveVariance ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {isPositiveVariance ? '+' : ''}
                    {formatCurrency(statement.expenses_advances_balance_mad, 'MAD')}
                  </span>
                </div>
                {statement.total_fines_mad > 0 && (
                  <div className="flex justify-between text-destructive">
                    <span>{t('خصم المخالفات', 'Retenue Amendes', 'Retención Multas')}:</span>
                    <span className="font-mono font-medium">
                      -{formatCurrency(statement.total_fines_mad, 'MAD')}
                    </span>
                  </div>
                )}
                <div className="pt-1.5 border-t border-primary/20 flex justify-between font-black text-base text-primary">
                  <span>{t('صافي التحويل', 'Net Virement', 'Neto Vía Banco')}:</span>
                  <span className="font-mono">
                    {formatCurrency(statement.net_payout_mad, 'MAD')}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Itemized Expenses Breakdown Table */}
          <div className="border rounded-xl overflow-hidden bg-card">
            <div className="px-4 py-2.5 bg-muted/60 border-b flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {t(
                  'تفاصيل الإيصالات والمصاريف المعتمدة بالفترة',
                  'Détail des Pièces Justificatives & Frais Engagés',
                  'Detalle de Comprobantes y Gastos Incurridos'
                )}
              </h4>
              <span className="text-xs text-muted-foreground font-mono">
                {statement.itemized_expenses?.length || 0} {t('بند', 'lignes', 'líneas')}
              </span>
            </div>

            <div className="max-h-56 overflow-y-auto">
              <table className="w-full text-xs text-start">
                <thead className="bg-muted/30 border-b text-muted-foreground sticky top-0">
                  <tr>
                    <th className="py-2 px-3 text-start">{t('التاريخ', 'Date', 'Fecha')}</th>
                    <th className="py-2 px-3 text-start">{t('النوع', 'Catégorie', 'Categoría')}</th>
                    <th className="py-2 px-3 text-start">{t('المرجع / البيان', 'Réf & Libellé', 'Ref y Detalle')}</th>
                    <th className="py-2 px-3 text-end">{t('المبلغ', 'Montant', 'Importe')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {statement.itemized_expenses && statement.itemized_expenses.length > 0 ? (
                    statement.itemized_expenses.map((item: any, idx: number) => (
                      <tr key={idx} className="hover:bg-muted/20">
                        <td className="py-2 px-3 font-mono text-muted-foreground">{item.date}</td>
                        <td className="py-2 px-3">
                          <Badge variant="outline" className="text-[10px] capitalize">
                            {item.category}
                          </Badge>
                        </td>
                        <td className="py-2 px-3">
                          <div className="font-medium text-foreground">{item.description}</div>
                          <div className="text-[10px] text-muted-foreground font-mono">{item.reference}</div>
                        </td>
                        <td className="py-2 px-3 text-end font-mono font-semibold">
                          {formatCurrency(item.amount, item.currency || 'MAD')}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-muted-foreground">
                        {t('لا توجد مصاريف تفصيلية مسجلة', 'Aucun frais détaillé', 'Sin gastos detallados')}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Legal Clearance & Dual Signature Block */}
          <div className="p-4 rounded-xl border bg-muted/20 space-y-4">
            <div className="text-xs text-muted-foreground leading-relaxed text-justify">
              <p>
                {t(
                  'أقر أنا السائق الموقع أسفله باستلامي لكافة مستحقاتي عن الفترة المذكورة أعلاه وبمطابقة كافة السلف التشغيلية المسلمة لي مع مصاريف الطريق المبررة بالإيصالات، وأقر بإبراء ذمة الشركة إبراءً تاماً ونهائياً لا رجعة فيه من أي مطالبات مالية تخص هذه الفترة.',
                  'Je soussigné, chauffeur mentionné ci-dessus, atteste avoir perçu l\'intégralité de mes droits et émoluments pour la période désignée, après apurement régulier de toutes les avances opérationnelles et justificatifs de route, et donne par la présente quitus entier et définitif à la société Trans Bodanon.',
                  'Yo, el abajo firmante, chofer indicado arriba, reconozco haber recibido la totalidad de mis emolumentos por el período indicado, tras la conciliación regular de anticipos y gastos de ruta justificados, otorgando el correspondiente finiquito y descargo total a la empresa Trans Bodanon.'
                )}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-8 pt-4 border-t">
              <div className="text-center space-y-12">
                <div className="text-xs font-bold text-foreground">
                  {t('توقيع وإبراء ذمة السائق', 'Signature & Décharge Chauffeur', 'Firma y Finiquito Chofer')}
                </div>
                <div className="text-[11px] text-muted-foreground border-b border-dashed pb-1">
                  {statement.driver?.name || 'Chauffeur Titulaire'}
                </div>
              </div>

              <div className="text-center space-y-12">
                <div className="text-xs font-bold text-foreground">
                  {t('تأشيرة ومصادقة الإدارة المالية', 'Visa & Cachet Direction Financière', 'Visto Bueno Dirección Financiera')}
                </div>
                <div className="text-[11px] text-muted-foreground border-b border-dashed pb-1">
                  Trans Bodanon TMS — Contrôle de Gestion
                </div>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="border-t pt-4 flex sm:justify-between items-center">
          <div className="text-xs text-muted-foreground hidden sm:block">
            {t('المصادقة الإلكترونية محفوظة في سجلات التدقيق', 'Archivage sécurisé dans le journal d\'audit', 'Registro seguro en auditoría')}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="default"
              size="sm"
              onClick={handleExportPdf}
              disabled={isExporting}
              className="gap-2 bg-primary text-primary-foreground font-bold"
            >
              {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              <span>{t('تصدير PDF معتمد برمز QR', 'Télécharger PDF Certifié (QR)', 'Exportar PDF Certificado')}</span>
            </Button>
            <Button variant="outline" size="sm" onClick={handlePrint} className="gap-2">
              <Printer className="w-4 h-4" />
              {t('طباعة سريعة', 'Imprimer', 'Imprimir')}
            </Button>
            <Button size="sm" variant="ghost" onClick={onClose}>
              {t('إغلاق', 'Fermer', 'Cerrar')}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

