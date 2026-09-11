'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useLanguage } from '@/components/language-provider';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  CalendarClock,
  ShieldAlert,
  UserCheck,
  Truck,
  ArrowRight,
  RotateCw,
  PlaneTakeoff,
} from 'lucide-react';
import { useSecretaryCriticalDates } from '../services/secretary.queries';
import { MatriculeBadge } from '@/components/ui/matricule-badge';

export function CriticalDatesTracker() {
  const { t, dir, locale } = useLanguage();
  const { data, isLoading, refetch, isRefetching } = useSecretaryCriticalDates();

  const [activeTab, setActiveTab] = useState<'docs' | 'departures'>('docs');

  const criticalDocs = data?.criticalDocs || [];
  const scheduledDepartures = data?.scheduledDepartures || [];
  const urgentCount = data?.urgentCount || 0;
  const totalCount = data?.totalAlertsCount || 0;

  const urgencyStyles: Record<string, { badge: string; text: string }> = {
    expired: {
      badge: 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30',
      text: t('منتهية الصلاحية', 'Expiré'),
    },
    urgent: {
      badge: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
      text: t('أقل من 48 ساعة', 'Urgent (< 48h)'),
    },
    soon: {
      badge: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30',
      text: t('خلال 7 أيام', 'Dans 7 jours'),
    },
    upcoming: {
      badge: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
      text: t('خلال 30 يوماً', 'Dans 30 jours'),
    },
  };

  return (
    <Card className="rounded-2xl border border-border/80 bg-card shadow-xs overflow-hidden flex flex-col justify-between">
      <div>
        {/* Header */}
        <CardHeader className="p-4 pb-3 border-b border-border/60 bg-muted/20 flex flex-row items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-rose-500/15 text-rose-600 dark:text-rose-400 flex items-center justify-center">
              <CalendarClock className="w-4 h-4" />
            </div>
            <div>
              <CardTitle className="text-sm font-bold font-amiri text-foreground flex items-center gap-2">
                {t('رادار تتبع التواريخ والاستحقاقات', 'Radar Échéances & Dates')}
                {urgentCount > 0 && (
                  <Badge variant="destructive" className="text-[10px] px-2 py-0.5 rounded-full">
                    {urgentCount} {t('عاجل', 'urgents')}
                  </Badge>
                )}
              </CardTitle>
              <p className="text-[11px] text-muted-foreground">
                {t('تنبيهات انتهاء وثائق الأسطول، تأشيرات السائقين، ومواعيد الانطلاق', 'Visas, assurances, visites techniques & départs')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => refetch()}
              disabled={isRefetching}
              title={t('تحديث', 'Actualiser')}
              className="h-8 w-8 rounded-xl text-muted-foreground hover:text-foreground"
            >
              <RotateCw className={`w-3.5 h-3.5 ${isRefetching ? 'animate-spin' : ''}`} />
            </Button>
            <Button
              asChild
              variant="outline"
              size="sm"
              className="h-8 px-2.5 text-xs rounded-xl border-border hover:bg-muted"
            >
              <Link href="/notifications/expiration">
                <span>{t('كافة التنبيهات', 'Toutes')}</span>
                <ArrowRight className={`w-3 h-3 ${dir === 'rtl' ? 'ms-1 rotate-180' : 'me-1'}`} />
              </Link>
            </Button>
          </div>
        </CardHeader>

        {/* Tabs switcher */}
        <div className="flex border-b border-border/60 bg-muted/10 px-4 pt-2 gap-2 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('docs')}
            className={`pb-2 font-semibold border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'docs'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>{t('وثائق وتأشيرات تنتهي قريباً', 'Documents & Visas')}</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-muted font-mono">
              {totalCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('departures')}
            className={`pb-2 font-semibold border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'departures'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <PlaneTakeoff className="w-3.5 h-3.5" />
            <span>{t('انطلاقات الرحلات المجدولة', 'Départs programmés')}</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-muted font-mono">
              {scheduledDepartures.length}
            </span>
          </button>
        </div>

        {/* Content */}
        <CardContent className="p-4">
          {isLoading ? (
            <div className="py-8 text-center text-xs text-muted-foreground">
              {t('جاري فحص التواريخ والوثائق...', 'Chargement des échéances...')}
            </div>
          ) : activeTab === 'docs' ? (
            criticalDocs.length === 0 ? (
              <div className="py-6 text-center text-xs text-muted-foreground border border-dashed border-border rounded-xl bg-muted/10">
                <ShieldAlert className="w-6 h-6 text-emerald-500 mx-auto mb-1.5 opacity-80" />
                <p className="font-semibold text-foreground">{t('جميع الوثائق والتأشيرات سارية', 'Toutes les échéances sont à jour')}</p>
                <p className="text-[11px] mt-0.5">{t('لا توجد أي وثيقة منتهية أو قريبة من الانتهاء خلال 30 يوماً', 'Aucune alerte pour les 30 prochains jours')}</p>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-72 overflow-y-auto pe-1">
                {criticalDocs.slice(0, 5).map((doc) => {
                  const style = urgencyStyles[doc.urgency] || urgencyStyles.upcoming;

                  return (
                    <div
                      key={doc.id}
                      className="p-3 rounded-xl border border-border/70 bg-card hover:bg-muted/20 transition-all flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-start gap-2.5 min-w-0">
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                            doc.type === 'visa'
                              ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'
                              : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                          }`}
                        >
                          {doc.type === 'visa' ? (
                            <UserCheck className="w-4 h-4" />
                          ) : (
                            <Truck className="w-4 h-4" />
                          )}
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-foreground truncate">
                              {doc.title}
                            </span>
                            {doc.entityPlate && (
                              <MatriculeBadge plate={doc.entityPlate} variant="badge" size="xs" />
                            )}
                          </div>
                          <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                            {doc.entityName}
                          </p>
                        </div>
                      </div>

                      <div className="text-end shrink-0">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold border ${style.badge}`}
                        >
                          {doc.daysRemaining < 0
                            ? t(`انتهت منذ ${Math.abs(doc.daysRemaining)} يوماً`, `Expiré (${Math.abs(doc.daysRemaining)} j)`)
                            : doc.daysRemaining === 0
                            ? t('تنتهي اليوم!', 'Expire aujourd\'hui')
                            : t(`متبقي ${doc.daysRemaining} يوم`, `${doc.daysRemaining} j restants`)}
                        </span>
                        <span className="block text-[10px] font-mono text-muted-foreground mt-0.5" dir="ltr">
                          {doc.expiryDate}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          ) : (
            scheduledDepartures.length === 0 ? (
              <div className="py-6 text-center text-xs text-muted-foreground border border-dashed border-border rounded-xl bg-muted/10">
                <PlaneTakeoff className="w-6 h-6 text-muted-foreground mx-auto mb-1.5 opacity-60" />
                <p className="font-semibold text-foreground">{t('لا توجد انطلاقات مجدولة قادمة', 'Aucun départ programmé')}</p>
                <p className="text-[11px] mt-0.5">{t('سجلي رحلة جديدة من زر الإدخال السريع', 'Utilisez la saisie rapide pour créer un trajet')}</p>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-72 overflow-y-auto pe-1">
                {scheduledDepartures.slice(0, 5).map((trip) => (
                  <div
                    key={trip.id}
                    className="p-3 rounded-xl border border-border/70 bg-card hover:bg-muted/20 transition-all flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-foreground truncate">
                          {trip.route}
                        </span>
                        {trip.cmrNumber && (
                          <Badge variant="outline" className="text-[10px] font-mono">
                            CMR: {trip.cmrNumber}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground">
                        <span>{trip.driverName || t('سائق غير معين', 'Chauffeur non assigné')}</span>
                        {trip.truckPlate && (
                          <MatriculeBadge plate={trip.truckPlate} variant="badge" size="xs" />
                        )}
                      </div>
                    </div>

                    <div className="text-end shrink-0">
                      <span className="text-[11px] font-mono font-bold text-primary block" dir="ltr">
                        {trip.departureDate ? new Date(trip.departureDate).toLocaleDateString(locale === 'ar' ? 'ar-MA' : 'fr-FR') : '—'}
                      </span>
                      <Badge variant="secondary" className="text-[10px] mt-0.5">
                        {t('مجدولة', 'Planifié')}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </CardContent>
      </div>
    </Card>
  );
}
