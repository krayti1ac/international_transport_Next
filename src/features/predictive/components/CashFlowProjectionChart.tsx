'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/components/language-provider';
import type {
  CashFlowHorizonProjection,
  ClientPaymentVelocity,
} from '../types/predictive-engine.types';
import {
  TrendingUp,
  DollarSign,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';

interface Props {
  projections: CashFlowHorizonProjection[];
  clientVelocities: ClientPaymentVelocity[];
}

export function CashFlowProjectionChart({ projections, clientVelocities }: Props) {
  const { t, dir } = useLanguage();

  const getHorizonLabel = (p: CashFlowHorizonProjection) => {
    return p.labelAr;
  };

  return (
    <div className="space-y-6" dir={dir}>
      {/* 1. HORIZON CARDS (30 / 60 / 90 DAYS) */}
      <Card className="border-border shadow-sm">
        <CardHeader className="pb-4 border-b border-border/50">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                {t('جدول استشراف السيولة النقدية (30 / 60 / 90 يوماً)', 'Prévisions de Trésorerie (30 / 60 / 90 Jours)', 'Proyecciones de Flujo de Caja (30 / 60 / 90 Días)')}
              </CardTitle>
              <CardDescription className="text-xs mt-1">
                {t(
                  'احتساب التدفقات الداخلة المعدلة بسرعة سداد كل عميل (PVI) مقابل الالتزامات الإلزامية للمحروقات والموانئ بدقة Decimal.js',
                  'Encaissements ajustés selon l’indice PVI client vs dépenses incompressibles en Decimal.js',
                  'Cobros ajustados según índice PVI del cliente vs gastos obligatorios en Decimal.js'
                )}
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-4 sm:p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {projections.map((p) => {
              const isSurplus = p.liquidityStatus === 'surplus';
              const isDeficit = p.liquidityStatus === 'deficit_warning';
              const netCashNumber = parseFloat(p.projectedNetCashMad);

              return (
                <div
                  key={`horizon-${p.horizonDays}`}
                  className={`p-5 rounded-2xl border flex flex-col justify-between transition-all ${
                    isDeficit
                      ? 'border-rose-500/40 bg-rose-500/5'
                      : isSurplus
                      ? 'border-emerald-500/30 bg-emerald-500/5'
                      : 'border-border/60 bg-card'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-primary" />
                        <span className="font-bold text-sm text-foreground">
                          {getHorizonLabel(p)}
                        </span>
                      </div>
                      <Badge
                        variant={isDeficit ? 'destructive' : 'outline'}
                        className={`text-[11px] font-semibold ${
                          isSurplus
                            ? 'border-emerald-500/40 text-emerald-700 dark:text-emerald-400'
                            : !isDeficit
                            ? 'border-border text-muted-foreground'
                            : ''
                        }`}
                      >
                        {isDeficit
                          ? t('تحذير عجز نقدي', 'Risque Déficit', 'Riesgo Déficit')
                          : isSurplus
                          ? t('فائض سيولة مستقر', 'Surplus Confortable', 'Superávit Cómodo')
                          : t('توازن نقدي', 'Équilibre', 'Equilibrio')}
                      </Badge>
                    </div>

                    {/* Net Cash Display */}
                    <div className="my-3 p-3 rounded-xl bg-background/80 border border-border/40 text-center">
                      <div className="text-[11px] text-muted-foreground font-medium mb-0.5">
                        {t('صافي السيولة المتوقعة في الخزينة', 'Solde Net Prévisionnel', 'Saldo Neto Previsto')}
                      </div>
                      <div
                        className={`text-2xl font-bold font-mono ${
                          netCashNumber < 0
                            ? 'text-rose-600 dark:text-rose-400'
                            : 'text-emerald-600 dark:text-emerald-400'
                        }`}
                      >
                        {netCashNumber.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}{' '}
                        <span className="text-xs font-sans text-muted-foreground">MAD</span>
                      </div>
                    </div>

                    {/* Breakdown */}
                    <div className="space-y-2 text-xs pt-2">
                      <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-400 font-medium">
                        <span className="flex items-center gap-1">
                          <ArrowUpRight className="w-3.5 h-3.5" />
                          {t('المقبوضات المتوقعة (فواتير)', 'Encaissements attendus', 'Cobros esperados')}
                        </span>
                        <span className="font-mono font-bold">
                          +{parseFloat(p.projectedInboundMad).toLocaleString()} MAD
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-rose-700 dark:text-rose-400 font-medium">
                        <span className="flex items-center gap-1">
                          <ArrowDownRight className="w-3.5 h-3.5" />
                          {t('الالتزامات الإلزامية', 'Dépenses incompressibles', 'Gastos obligatorios')}
                        </span>
                        <span className="font-mono font-bold">
                          -{parseFloat(p.projectedOutboundMad).toLocaleString()} MAD
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Outbound Detail pills */}
                  <div className="pt-4 mt-4 border-t border-border/40 text-[10px] space-y-1 text-muted-foreground">
                    <div className="flex justify-between">
                      <span>{t('⛽ محروقات:', '⛽ Carburant :')}</span>
                      <span className="font-mono font-semibold">{parseFloat(p.breakdown.mandatoryFuelMad).toLocaleString()} MAD</span>
                    </div>
                    <div className="flex justify-between">
                      <span>{t('🚢 موانئ وعبور:', '🚢 Ports & Transit :')}</span>
                      <span className="font-mono font-semibold">{parseFloat(p.breakdown.mandatoryFerryAndCustomsMad).toLocaleString()} MAD</span>
                    </div>
                    <div className="flex justify-between">
                      <span>{t('👨‍✈️ تعويضات السائقين:', '👨‍✈️ Indemnités :')}</span>
                      <span className="font-mono font-semibold">{parseFloat(p.breakdown.driverAllowancesAndSalariesMad).toLocaleString()} MAD</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* 2. CLIENT PAYMENT VELOCITY (PVI) & RELIABILITY TABLE */}
      <Card className="border-border shadow-sm">
        <CardHeader className="pb-3 border-b border-border/50">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-primary" />
            {t('مصفوفة سرعة سداد المصدرين (Payment Velocity Index - PVI)', 'Indice de Vélocité de Paiement des Exportateurs (PVI)', 'Índice de Velocidad de Pago de Exportadores (PVI)')}
          </CardTitle>
          <CardDescription className="text-xs">
            {t(
              'تحليل سلوك التحصيل التاريخي وتصنيف العملاء استناداً لنظام الأقدمية FIFO وإزاحة الفواتير المفتوحة',
              'Analyse des règlements historiques FIFO et décalage prévisionnel des créances ouvertes',
              'Análisis de pagos históricos FIFO y ajuste predictivo de cuentas por cobrar'
            )}
          </CardDescription>
        </CardHeader>

        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-xs text-start">
            <thead className="bg-muted/50 border-b border-border text-muted-foreground">
              <tr>
                <th className="p-3 text-start font-semibold">{t('العميل / المصدر', 'Client / Exportateur', 'Cliente / Exportador')}</th>
                <th className="p-3 text-center font-semibold">{t('الفواتير المسددة', 'Factures payées', 'Facturas pagadas')}</th>
                <th className="p-3 text-center font-semibold">{t('متوسط التأخير (PVI)', 'Délai moyen (PVI)', 'Retraso medio (PVI)')}</th>
                <th className="p-3 text-center font-semibold">{t('تصنيف الموثوقية', 'Note Fiabilité', 'Calificación Fiabilidad')}</th>
                <th className="p-3 text-end font-semibold">{t('المستحقات المفتوحة', 'Créances en cours', 'Cuentas pendientes')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {clientVelocities.map((client) => {
                const isGradeA = client.reliabilityRating === 'A';
                const isGradeB = client.reliabilityRating === 'B';

                return (
                  <tr key={`client-pvi-${client.clientId}`} className="hover:bg-muted/30 transition-colors">
                    <td className="p-3 font-medium text-foreground">
                      {client.clientName}
                    </td>
                    <td className="p-3 text-center font-mono text-muted-foreground">
                      {client.totalPaidInvoices}
                    </td>
                    <td className="p-3 text-center font-mono font-semibold">
                      {client.averageDelayDays <= 0 ? (
                        <span className="text-emerald-600 dark:text-emerald-400">
                          {client.averageDelayDays} {t('يوم (في الموعد)', 'j (ponctuel)', 'd (a tiempo)')}
                        </span>
                      ) : client.averageDelayDays <= 15 ? (
                        <span className="text-amber-600 dark:text-amber-400">
                          +{client.averageDelayDays} {t('يوم', 'jours', 'días')}
                        </span>
                      ) : (
                        <span className="text-rose-600 dark:text-rose-400 font-bold">
                          +{client.averageDelayDays} {t('يوم (تأخير هيكلي)', 'j (retard)', 'd (retraso)')}
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-center">
                      <Badge
                        variant="outline"
                        className={`font-mono font-bold text-xs px-2.5 py-0.5 ${
                          isGradeA
                            ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                            : isGradeB
                            ? 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400'
                            : 'border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-400'
                        }`}
                      >
                        {t('فئة', 'Classe', 'Clase')} {client.reliabilityRating}
                      </Badge>
                    </td>
                    <td className="p-3 text-end font-mono font-semibold text-foreground">
                      {parseFloat(client.totalOutstandingMad) > 0 ? (
                        <span>
                          {parseFloat(client.totalOutstandingMad).toLocaleString()} MAD
                          {parseFloat(client.totalOutstandingEur) > 0 && (
                            <span className="text-[10px] text-muted-foreground ms-1">
                              ({parseFloat(client.totalOutstandingEur).toLocaleString()} €)
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="text-muted-foreground font-normal">0.00 MAD</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

