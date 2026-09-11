'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useLanguage } from '@/components/language-provider';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MatriculeBadge } from '@/components/ui/matricule-badge';
import {
  Route,
  ClipboardList,
  PlaneTakeoff,
  MapPin,
  PlaneLanding,
  CheckCircle2,
  ChevronRight,
  RotateCw,
  ExternalLink,
  ChevronLeft,
} from 'lucide-react';
import { useSecretaryTripStages, SecretaryTripItem } from '../services/secretary.queries';
import { advanceTripStageAction } from '../services/secretary.actions';

const STAGES = [
  {
    id: 'pendingAssignment',
    labelAr: 'قيد التعيين والانتظار',
    labelFr: 'En attente',
    nextStage: 'outbound',
    icon: ClipboardList,
    badgeClass: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30',
  },
  {
    id: 'outbound',
    labelAr: 'في طريق الذهاب',
    labelFr: 'Transit Aller',
    nextStage: 'pendingReturn',
    icon: PlaneTakeoff,
    badgeClass: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30',
  },
  {
    id: 'pendingReturn',
    labelAr: 'بانتظار العودة',
    labelFr: 'Attente Retour',
    nextStage: 'returnRoute',
    icon: MapPin,
    badgeClass: 'bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/30',
  },
  {
    id: 'returnRoute',
    labelAr: 'في طريق العودة',
    labelFr: 'Transit Retour',
    nextStage: 'settled',
    icon: PlaneLanding,
    badgeClass: 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border-indigo-500/30',
  },
  {
    id: 'settled',
    labelAr: 'مكتملة ومفوترة',
    labelFr: 'Clôturé & Facturé',
    nextStage: null,
    icon: CheckCircle2,
    badgeClass: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
  },
];

export function TripStagesPipeline() {
  const { t, dir, locale } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading, refetch, isRefetching } = useSecretaryTripStages();
  const [selectedStageFilter, setSelectedStageFilter] = useState<string>('all');
  const [updatingTripId, setUpdatingTripId] = useState<number | null>(null);

  const trips = data?.trips || [];
  const counts = data?.stageCounts || {
    pendingAssignment: 0,
    outbound: 0,
    pendingReturn: 0,
    returnRoute: 0,
    settled: 0,
    total: 0,
  };

  const filteredTrips = trips.filter((tr) => {
    if (selectedStageFilter === 'all') return true;
    return tr.stage === selectedStageFilter;
  });

  const handleAdvanceStage = async (trip: SecretaryTripItem, nextStage: string) => {
    try {
      setUpdatingTripId(trip.id);
      const res = await advanceTripStageAction(trip.id, nextStage);
      if (!res.success) {
        throw new Error(res.error || t('فشل تحديث المرحلة', 'Échec de mise à jour'));
      }

      toast({
        title: t('تم تحديث مرحلة الرحلة بنجاح', 'Étape mise à jour avec succès'),
        description: `${trip.route} (#${trip.id})`,
      });

      queryClient.invalidateQueries({ queryKey: ['secretary-trip-stages'] });
      queryClient.invalidateQueries({ queryKey: ['trips'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t('حدث خطأ', 'Erreur');
      toast({
        title: t('خطأ في التحديث', 'Erreur'),
        description: msg,
        variant: 'destructive',
      });
    } finally {
      setUpdatingTripId(null);
    }
  };

  return (
    <Card className="rounded-2xl border border-border/80 bg-card shadow-xs overflow-hidden">
      {/* Header */}
      <CardHeader className="p-4 pb-3 border-b border-border/60 bg-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <Route className="w-4 h-4" />
          </div>
          <div>
            <CardTitle className="text-sm font-bold font-amiri text-foreground flex items-center gap-2">
              {t('تتبع مراحل الرحلات والعمليات الجارية', 'Suivi des Étapes & Trajets Opérationnels')}
              <Badge variant="outline" className="text-xs font-mono font-bold">
                {counts.total} {t('رحلة', 'trajets')}
              </Badge>
            </CardTitle>
            <p className="text-[11px] text-muted-foreground">
              {t('متابعة مسار النقل الدولي خطوة بخطوة وتحديث المراحل دون تعقيد إحصائي', 'Suivi en direct des étapes du fret international')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => refetch()}
            disabled={isRefetching}
            className="h-8 w-8 rounded-xl text-muted-foreground hover:text-foreground"
            title={t('تحديث', 'Actualiser')}
          >
            <RotateCw className={`w-3.5 h-3.5 ${isRefetching ? 'animate-spin' : ''}`} />
          </Button>
          <Button
            asChild
            variant="outline"
            size="sm"
            className="h-8 px-3 text-xs rounded-xl border-border"
          >
            <Link href="/trips" className="flex items-center gap-1.5">
              <span>{t('إدارة الرحلات بالكامل', 'Gestion des trajets')}</span>
              <ExternalLink className="w-3 h-3" />
            </Link>
          </Button>
        </div>
      </CardHeader>

      {/* Pipeline Stage Indicators / Filter Bar */}
      <div className="p-4 bg-muted/10 border-b border-border/60">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
          {/* All Filter */}
          <button
            type="button"
            onClick={() => setSelectedStageFilter('all')}
            className={`p-2.5 rounded-xl border text-start transition-all ${
              selectedStageFilter === 'all'
                ? 'bg-primary/10 border-primary text-primary shadow-2xs'
                : 'border-border/80 bg-card hover:bg-muted/40 text-muted-foreground'
            }`}
          >
            <span className="text-[10px] font-bold block uppercase tracking-wider opacity-75">
              {t('كافة الرحلات', 'Tous')}
            </span>
            <span className="text-lg font-mono font-bold block text-foreground mt-0.5">
              {counts.total}
            </span>
          </button>

          {/* Individual Stages */}
          {STAGES.map((st) => {
            const Icon = st.icon;
            const count = (counts as any)[st.id] || 0;
            const isSelected = selectedStageFilter === st.id;

            return (
              <button
                key={st.id}
                type="button"
                onClick={() => setSelectedStageFilter(st.id)}
                className={`p-2.5 rounded-xl border text-start transition-all flex flex-col justify-between ${
                  isSelected
                    ? 'border-primary bg-primary/10 text-primary shadow-2xs'
                    : 'border-border/80 bg-card hover:bg-muted/40 text-muted-foreground'
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[10px] font-bold truncate">
                    {locale === 'fr' ? st.labelFr : st.labelAr}
                  </span>
                  <Icon className="w-3.5 h-3.5 shrink-0 opacity-80" />
                </div>
                <span className="text-lg font-mono font-bold block text-foreground mt-1">
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Trips Table */}
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className={`w-full ${dir === 'rtl' ? 'text-right' : 'text-left'} text-xs`}>
            <thead className="bg-muted/40 text-muted-foreground font-semibold border-b border-border/60 uppercase">
              <tr>
                <th className="px-4 py-3">{t('الرحلة / CMR', 'Trajet / CMR')}</th>
                <th className="px-4 py-3">{t('خط السير والمسار', 'Itinéraire')}</th>
                <th className="px-4 py-3">{t('العميل', 'Client')}</th>
                <th className="px-4 py-3">{t('السائق والشاحنة', 'Chauffeur / Camion')}</th>
                <th className="px-4 py-3">{t('تاريخ الانطلاق', 'Date départ')}</th>
                <th className="px-4 py-3 text-center">{t('المرحلة الحالية', 'Étape')}</th>
                <th className="px-4 py-3 text-center">{t('الإجراء التشغيلي', 'Action')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                    {t('جاري تحميل الرحلات...', 'Chargement des trajets...')}
                  </td>
                </tr>
              ) : filteredTrips.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                    {t('لا توجد رحلات في هذه المرحلة حالياً', 'Aucun trajet dans cette étape')}
                  </td>
                </tr>
              ) : (
                filteredTrips.map((trip) => {
                  const stageObj = STAGES.find((s) => s.id === trip.stage) || STAGES[0];
                  const nextStage = stageObj.nextStage;
                  const nextStageObj = nextStage ? STAGES.find((s) => s.id === nextStage) : null;
                  const isUpdating = updatingTripId === trip.id;

                  return (
                    <tr key={trip.id} className="hover:bg-muted/30 transition-colors">
                      {/* Trip ID / CMR */}
                      <td className="px-4 py-3 font-mono font-bold text-foreground">
                        #{trip.id}
                        {trip.cmr_number && (
                          <span className="block text-[10px] text-muted-foreground font-normal">
                            CMR: {trip.cmr_number}
                          </span>
                        )}
                      </td>

                      {/* Route */}
                      <td className="px-4 py-3 font-medium text-foreground">
                        <span className="truncate block max-w-xs">{trip.route}</span>
                      </td>

                      {/* Client */}
                      <td className="px-4 py-3 text-muted-foreground">
                        <span className="truncate block max-w-[120px]">
                          {trip.client_name || '—'}
                        </span>
                      </td>

                      {/* Driver & Truck */}
                      <td className="px-4 py-3">
                        <div className="space-y-1">
                          <span className="font-semibold text-foreground block">
                            {trip.driver_name || t('غير محدد', 'Non défini')}
                          </span>
                          <div className="flex items-center gap-1 flex-wrap">
                            {trip.truck_plate && (
                              <MatriculeBadge plate={trip.truck_plate} variant="badge" size="xs" />
                            )}
                            {trip.trailer_plate && (
                              <span className="text-[10px] text-muted-foreground font-mono">
                                [{trip.trailer_plate}]
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Departure Date */}
                      <td className="px-4 py-3 font-mono text-muted-foreground" dir="ltr">
                        {trip.departure_date ? new Date(trip.departure_date).toLocaleDateString(locale === 'ar' ? 'ar-MA' : 'fr-FR') : '—'}
                      </td>

                      {/* Current Stage Badge */}
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${stageObj.badgeClass}`}
                        >
                          {locale === 'fr' ? stageObj.labelFr : stageObj.labelAr}
                        </span>
                      </td>

                      {/* Action: Next Stage */}
                      <td className="px-4 py-3 text-center">
                        {nextStage && nextStageObj ? (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={isUpdating}
                            onClick={() => handleAdvanceStage(trip, nextStage)}
                            className="h-7 px-2.5 text-[11px] font-semibold rounded-lg border-border hover:border-primary hover:bg-primary/5 hover:text-primary transition-all"
                            title={t('نقل للمرحلة التالية', 'Passer à l\'étape suivante')}
                          >
                            <span>{t('نقل إلى: ', 'Vers: ')}{locale === 'fr' ? nextStageObj.labelFr : nextStageObj.labelAr}</span>
                            {dir === 'rtl' ? (
                              <ChevronLeft className="w-3 h-3 ms-1 text-primary" />
                            ) : (
                              <ChevronRight className="w-3 h-3 ms-1 text-primary" />
                            )}
                          </Button>
                        ) : (
                          <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center justify-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            {t('مكتملة', 'Terminé')}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
