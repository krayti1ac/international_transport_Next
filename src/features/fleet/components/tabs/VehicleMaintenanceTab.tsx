'use client';

import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Wrench,
  Calendar,
  DollarSign,
  PlusCircle,
  FileCheck2,
  AlertCircle,
  CheckCircle2,
  Clock,
  ExternalLink,
  Coins,
  Building,
} from 'lucide-react';
import Decimal from 'decimal.js';
import { useLanguage } from '@/components/language-provider';
import { formatCurrency } from '@/lib/forex';
import type { TruckMaintenance, Truck, Trailer } from '@/types/database';

Decimal.config({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

interface VehicleMaintenanceTabProps {
  vehicle: Truck | Trailer;
  vehicleType: 'truck' | 'trailer';
  maintenanceRecords: TruckMaintenance[];
  onScheduleMaintenance: () => void;
  onOpenCompleteModal?: (record: TruckMaintenance) => void;
}

export function VehicleMaintenanceTab({
  vehicle,
  vehicleType,
  maintenanceRecords,
  onScheduleMaintenance,
  onOpenCompleteModal,
}: VehicleMaintenanceTabProps) {
  const { t } = useLanguage();

  // Strict Decimal.js calculations for maintenance totals and categories
  const { totalSpend, categoryBreakdown, recordsWithCategory } = useMemo(() => {
    let totalDec = new Decimal(0);
    const breakdown: Record<string, InstanceType<typeof Decimal>> = {
      vidange: new Decimal(0),
      tires: new Decimal(0),
      freins: new Decimal(0),
      frigo: new Decimal(0),
      mecanique: new Decimal(0),
    };

    const enriched = maintenanceRecords.map((m: any) => {
      const amountDec = new Decimal(m.amount || 0);
      totalDec = totalDec.plus(amountDec);

      const typeDesc = `${m.expense_type || ''} ${m.type || ''} ${m.description || ''} ${m.notes || ''}`.toLowerCase();
      let cat = 'mecanique';

      if (typeDesc.includes('vidange') || typeDesc.includes('huile') || typeDesc.includes('filtre') || typeDesc.includes('زيت')) {
        cat = 'vidange';
        breakdown.vidange = breakdown.vidange.plus(amountDec);
      } else if (typeDesc.includes('pneu') || typeDesc.includes('إطار') || typeDesc.includes('عجلات') || typeDesc.includes('pneumatique')) {
        cat = 'tires';
        breakdown.tires = breakdown.tires.plus(amountDec);
      } else if (typeDesc.includes('frein') || typeDesc.includes('فرامل') || typeDesc.includes('disque') || typeDesc.includes('plaquette')) {
        cat = 'freins';
        breakdown.freins = breakdown.freins.plus(amountDec);
      } else if (typeDesc.includes('frigo') || typeDesc.includes('thermo') || typeDesc.includes('carrier') || typeDesc.includes('تبريد')) {
        cat = 'frigo';
        breakdown.frigo = breakdown.frigo.plus(amountDec);
      } else {
        breakdown.mecanique = breakdown.mecanique.plus(amountDec);
      }

      return {
        ...m,
        amountNum: amountDec.toNumber(),
        resolvedCategory: cat,
      };
    });

    return {
      totalSpend: totalDec.toNumber(),
      categoryBreakdown: {
        vidange: breakdown.vidange.toNumber(),
        tires: breakdown.tires.toNumber(),
        freins: breakdown.freins.toNumber(),
        frigo: breakdown.frigo.toNumber(),
        mecanique: breakdown.mecanique.toNumber(),
      },
      recordsWithCategory: enriched,
    };
  }, [maintenanceRecords]);

  return (
    <div className="space-y-6">
      {/* 1. Header KPIs & Category Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <Card className="rounded-2xl border-border bg-card p-3.5">
          <p className="text-[11px] font-medium text-muted-foreground">
            {t('زيوت وفلاتر (Vidange)', 'Vidanges & Filtres')}
          </p>
          <p className="text-lg font-black font-mono text-foreground mt-1">
            {formatCurrency(categoryBreakdown.vidange, 'MAD')}
          </p>
        </Card>

        <Card className="rounded-2xl border-border bg-card p-3.5">
          <p className="text-[11px] font-medium text-muted-foreground">
            {t('إطارات وضبط (Pneumatiques)', 'Pneumatiques')}
          </p>
          <p className="text-lg font-black font-mono text-foreground mt-1">
            {formatCurrency(categoryBreakdown.tires, 'MAD')}
          </p>
        </Card>

        <Card className="rounded-2xl border-border bg-card p-3.5">
          <p className="text-[11px] font-medium text-muted-foreground">
            {t('الفرامل والمكابح (Freins)', 'Freins & Disques')}
          </p>
          <p className="text-lg font-black font-mono text-foreground mt-1">
            {formatCurrency(categoryBreakdown.freins, 'MAD')}
          </p>
        </Card>

        <Card className="rounded-2xl border-border bg-card p-3.5">
          <p className="text-[11px] font-medium text-muted-foreground">
            {t('جهاز التبريد (Groupe Frigo)', 'Groupe Frigorifique')}
          </p>
          <p className="text-lg font-black font-mono text-foreground mt-1">
            {formatCurrency(categoryBreakdown.frigo, 'MAD')}
          </p>
        </Card>

        <Card className="rounded-2xl border-border bg-primary/5 border-primary/20 p-3.5 col-span-2 sm:col-span-1">
          <p className="text-[11px] font-medium text-primary">
            {t('إجمالي مصاريف الورشة', 'Total Dépenses')}
          </p>
          <p className="text-lg font-black font-mono text-primary mt-1">
            {formatCurrency(totalSpend, 'MAD')}
          </p>
        </Card>
      </div>

      {/* 2. Actions & Table Card */}
      <Card className="rounded-2xl border-border bg-card overflow-hidden">
        <CardHeader className="p-4 sm:p-5 border-b border-border/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <Wrench className="w-5 h-5 text-amber-500" />
            <span>
              {t('سجل عمليات الصيانة والإصلاحات', 'Historique des Travaux & Entretiens')} (
              {recordsWithCategory.length})
            </span>
          </CardTitle>

          <Button
            variant="default"
            size="sm"
            onClick={onScheduleMaintenance}
            className="rounded-xl text-xs h-8 gap-1.5 ms-auto"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>{t('جدولة فحص أو صيانة', 'Planifier entretien', 'Schedule Maintenance')}</span>
          </Button>
        </CardHeader>

        <CardContent className="p-0">
          {recordsWithCategory.length === 0 ? (
            <div className="p-10 text-center text-muted-foreground">
              <Wrench className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm font-medium">
                {t('لا توجد عمليات صيانة مسجلة لهذه المركبة.', 'Aucun entretien enregistré pour cette période.')}
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={onScheduleMaintenance}
                className="mt-4 rounded-xl text-xs gap-1.5"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>{t('إضافة أول تدخل الآن', 'Ajouter une intervention')}</span>
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-start">
                <thead className="bg-muted/50 border-b border-border text-muted-foreground font-medium">
                  <tr>
                    <th className="p-3.5 text-start">{t('التاريخ', 'Date')}</th>
                    <th className="p-3.5 text-start">{t('نوع التدخل', 'Type d\'intervention')}</th>
                    <th className="p-3.5 text-start">{t('الورشة / الميكانيكي', 'Garage / Prestataire')}</th>
                    <th className="p-3.5 text-start">{t('التكلفة المالية', 'Coût')}</th>
                    <th className="p-3.5 text-start">{t('قراءة العداد', 'Kilométrage')}</th>
                    <th className="p-3.5 text-start">{t('البيان وتفاصيل القطع', 'Détails & Pièces')}</th>
                    <th className="p-3.5 text-start">{t('الحالة', 'Statut')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {recordsWithCategory.map((record) => (
                    <tr key={record.id} className="hover:bg-muted/30 transition-colors">
                      <td className="p-3.5 font-mono font-medium whitespace-nowrap">
                        {record.maintenance_date || record.date || record.created_at?.split('T')[0] || '—'}
                      </td>
                      <td className="p-3.5">
                        <Badge variant="secondary" className="text-[11px] font-semibold">
                          {record.resolvedCategory === 'vidange'
                            ? t('تغيير زيت وفلاتر', 'Vidange & Filtres')
                            : record.resolvedCategory === 'tires'
                              ? t('إطارات وتدوير', 'Pneumatiques')
                              : record.resolvedCategory === 'freins'
                                ? t('نظام الفرامل', 'Système Freinage')
                                : record.resolvedCategory === 'frigo'
                                  ? t('جهاز تبريد Frigo', 'Groupe Frigorifique')
                                  : t('ميكانيكا عامة', 'Mécanique Générale')}
                        </Badge>
                      </td>
                      <td className="p-3.5 font-semibold text-foreground">
                        {record.workshop_name || record.provider_name || t('ورشة الصيانة المعتمدة', 'Garage Agréé')}
                      </td>
                      <td className="p-3.5 font-mono font-bold text-foreground whitespace-nowrap">
                        {formatCurrency(record.amountNum, record.currency || 'MAD')}
                      </td>
                      <td className="p-3.5 font-mono text-muted-foreground whitespace-nowrap">
                        {record.odometer_km ? `${record.odometer_km.toLocaleString()} km` : '—'}
                      </td>
                      <td className="p-3.5 text-muted-foreground max-w-sm">
                        <p className="truncate">
                          {record.description || record.notes || 'إصلاح دوري معتمد'}
                        </p>
                      </td>
                      <td className="p-3.5 whitespace-nowrap">
                        {record.status === 'completed' ? (
                          <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-500/30">
                            {t('مكتمل ومسدد', 'Réalisé & Réglé')}
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-[10px] text-amber-600 border-amber-500/30">
                            {t('مجدول / جاري', 'Planifié')}
                          </Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
