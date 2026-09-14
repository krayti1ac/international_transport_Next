'use client';

import React from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ClientAvatar } from '@/components/clients/ClientAvatar';
import { useLanguage } from '@/components/language-provider';
import type { TripOrder, Client } from '@/types/database';
import {
  ArrowRight,
  Package,
  Weight,
  MapPin,
  ExternalLink,
  Calendar,
  User,
  Boxes,
  ArrowUpRight,
  ArrowDownLeft,
} from 'lucide-react';

interface TripRouteFlowProps {
  trip: TripOrder;
  clientExport: Client | null;
  clientImport: Client | null;
}

export function TripRouteFlow({ trip, clientExport, clientImport }: TripRouteFlowProps) {
  const { t, dir } = useLanguage();

  const hasImportLeg = Boolean(
    trip.route_import ||
      trip.client_import_id ||
      clientImport ||
      trip.goods_description_import ||
      trip.cmr_import_number
  );

  const loadingGpsUrl = trip.shipping_gps_url || clientExport?.loading_gps_url;
  const unloadingExportGpsUrl = clientExport?.unloading_gps_url;
  const unloadingImportGpsUrl = trip.unloading_gps_url || clientImport?.unloading_gps_url;

  return (
    <div className="space-y-4">
      {/* Title Strip */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold font-amiri text-foreground flex items-center gap-2">
          <Boxes className="w-5 h-5 text-primary" />
          <span>{t('مخطط مسار الرحلة الدولي (ذهاب وعودة)', 'Flux d\'Itinéraire International (Aller / Retour)')}</span>
        </h2>
        <Badge variant="outline" className="text-xs font-mono">
          TIR Cross-Border Corridor
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* 1. Outbound Leg: Export Aller */}
        <Card className="rounded-2xl border-border bg-card shadow-xs relative overflow-hidden flex flex-col justify-between">
          <div className="absolute top-0 inset-x-0 h-1.5 bg-blue-600" />
          <CardHeader className="pb-3 border-b border-border/60">
            <div className="flex items-center justify-between gap-2">
              <Badge className="bg-blue-600/15 text-blue-700 dark:text-blue-400 border border-blue-600/30 gap-1.5 px-3 py-1 font-semibold text-xs rounded-full">
                <ArrowUpRight className="w-3.5 h-3.5" />
                <span>{t('مسار الذهاب والتصدير (Export Aller)', 'Trajet Aller (Export)')}</span>
              </Badge>

              {trip.departure_date && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
                  <Calendar className="w-3.5 h-3.5 text-primary" />
                  <span>{trip.departure_date}</span>
                </div>
              )}
            </div>
          </CardHeader>

          <CardContent className="p-5 space-y-4 flex-1">
            {/* Route Line */}
            <div className="p-3.5 rounded-xl bg-blue-500/5 border border-blue-500/20">
              <p className="text-[11px] font-medium text-muted-foreground">
                {t('مسار الشحن الدولي:', 'Corridor de transport :')}
              </p>
              <p className="text-base font-bold text-foreground mt-0.5 flex items-center gap-2 flex-wrap">
                <span>{trip.route_export || trip.route || t('المغرب', 'Maroc')}</span>
                <ArrowRight
                  className={`w-4 h-4 text-blue-600 shrink-0 ${dir === 'rtl' ? 'rotate-180' : ''}`}
                />
                <span className="text-blue-700 dark:text-blue-400">
                  {trip.destination_branch_id ? t('أوروبا', 'Europe') : 'أوروبا / الوجهة النهائية'}
                </span>
              </p>
            </div>

            {/* Client Profile Link */}
            <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-muted/40 border border-border/50">
              <div className="flex items-center gap-3 min-w-0">
                {clientExport ? (
                  <ClientAvatar
                    name={clientExport.name}
                    logoUrl={clientExport.logo_url}
                    clientId={clientExport.id}
                    size="md"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center text-muted-foreground shrink-0">
                    <User className="w-4 h-4" />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-[11px] text-muted-foreground font-medium">
                    {t('عميل التصدير والشاحن:', 'Client Exportateur :')}
                  </p>
                  {clientExport ? (
                    <Link
                      href={`/clients/${clientExport.id}`}
                      className="text-sm font-bold text-foreground hover:text-primary transition-colors flex items-center gap-1 group truncate"
                    >
                      <span className="truncate">{clientExport.name}</span>
                      <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                    </Link>
                  ) : (
                    <p className="text-sm font-bold text-foreground">
                      {t('غير محدد', 'Non spécifié', 'Unspecified')}
                    </p>
                  )}
                </div>
              </div>

              {trip.cmr_export_number && (
                <div className="text-end shrink-0">
                  <p className="text-[10px] text-muted-foreground uppercase font-mono">CMR Export</p>
                  <p className="text-xs font-mono font-bold text-foreground">{trip.cmr_export_number}</p>
                </div>
              )}
            </div>

            {/* Cargo Specs: Description & Weight */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-muted/30 border border-border/40">
                <span className="text-muted-foreground block text-[11px] flex items-center gap-1">
                  <Package className="w-3.5 h-3.5 text-primary" />
                  {t('وصف البضاعة:', 'Marchandises :')}
                </span>
                <span className="font-semibold text-foreground mt-1 block truncate">
                  {trip.goods_description_export || t('بضائع عامة / خضار وفواكه', 'Marchandises Générales')}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-muted/30 border border-border/40">
                <span className="text-muted-foreground block text-[11px] flex items-center gap-1">
                  <Weight className="w-3.5 h-3.5 text-blue-500" />
                  {t('الوزن القائم (Poids):', 'Poids Brut :')}
                </span>
                <span className="font-mono font-bold text-foreground mt-1 block">
                  {trip.weight_export ? `${trip.weight_export.toLocaleString()} kg` : '—'}
                </span>
              </div>
            </div>

            {/* GPS Direct Targets */}
            <div className="pt-2 border-t border-border/50 flex items-center gap-2 flex-wrap">
              {loadingGpsUrl && (
                <Button
                  variant="outline"
                  size="sm"
                  asChild
                  className="h-7 text-xs rounded-lg gap-1 border-emerald-500/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10"
                >
                  <a href={loadingGpsUrl} target="_blank" rel="noopener noreferrer">
                    <MapPin className="w-3 h-3" />
                    <span>{t('GPS موقع الشحن بالمغرب', 'GPS Chargement')}</span>
                  </a>
                </Button>
              )}

              {unloadingExportGpsUrl && (
                <Button
                  variant="outline"
                  size="sm"
                  asChild
                  className="h-7 text-xs rounded-lg gap-1 border-blue-500/30 text-blue-700 dark:text-blue-400 hover:bg-blue-500/10"
                >
                  <a href={unloadingExportGpsUrl} target="_blank" rel="noopener noreferrer">
                    <MapPin className="w-3 h-3" />
                    <span>{t('GPS موقع التفريغ بأوروبا', 'GPS Déchargement')}</span>
                  </a>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 2. Inbound Leg: Import Retour or Empty Return */}
        <Card className="rounded-2xl border-border bg-card shadow-xs relative overflow-hidden flex flex-col justify-between">
          <div
            className={`absolute top-0 inset-x-0 h-1.5 ${
              hasImportLeg ? 'bg-emerald-600' : 'bg-slate-400'
            }`}
          />
          <CardHeader className="pb-3 border-b border-border/60">
            <div className="flex items-center justify-between gap-2">
              <Badge
                className={`gap-1.5 px-3 py-1 font-semibold text-xs rounded-full border ${
                  hasImportLeg
                    ? 'bg-emerald-600/15 text-emerald-700 dark:text-emerald-400 border-emerald-600/30'
                    : 'bg-muted text-muted-foreground border-border'
                }`}
              >
                <ArrowDownLeft className="w-3.5 h-3.5" />
                <span>
                  {hasImportLeg
                    ? t('مسار العودة والاستيراد (Import Retour)', 'Trajet Retour (Import)')
                    : t('مسار العودة (فارغة / Retour à vide)', 'Retour à vide')}
                </span>
              </Badge>

              {trip.loading_date_import && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
                  <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                  <span>{trip.loading_date_import}</span>
                </div>
              )}
            </div>
          </CardHeader>

          <CardContent className="p-5 space-y-4 flex-1">
            {hasImportLeg ? (
              <>
                {/* Route Line */}
                <div className="p-3.5 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
                  <p className="text-[11px] font-medium text-muted-foreground">
                    {t('مسار الشحن في الرجوع:', 'Corridor de retour :')}
                  </p>
                  <p className="text-base font-bold text-foreground mt-0.5 flex items-center gap-2 flex-wrap">
                    <span>{trip.route_import || 'أوروبا'}</span>
                    <ArrowRight
                      className={`w-4 h-4 text-emerald-600 shrink-0 ${dir === 'rtl' ? 'rotate-180' : ''}`}
                    />
                    <span className="text-emerald-700 dark:text-emerald-400">
                      {t('المغرب (الوجهة والتخليص)', 'Maroc (Dédouanement)')}
                    </span>
                  </p>
                </div>

                {/* Import Client */}
                <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-muted/40 border border-border/50">
                  <div className="flex items-center gap-3 min-w-0">
                    {clientImport ? (
                      <ClientAvatar
                        name={clientImport.name}
                        logoUrl={clientImport.logo_url}
                        clientId={clientImport.id}
                        size="md"
                      />
                    ) : (
                      <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center text-muted-foreground shrink-0">
                        <User className="w-4 h-4" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-[11px] text-muted-foreground font-medium">
                        {t('عميل الاستيراد والمستورد:', 'Client Importateur :')}
                      </p>
                      {clientImport ? (
                        <Link
                          href={`/clients/${clientImport.id}`}
                          className="text-sm font-bold text-foreground hover:text-primary transition-colors flex items-center gap-1 group truncate"
                        >
                          <span className="truncate">{clientImport.name}</span>
                          <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                        </Link>
                      ) : (
                        <p className="text-sm font-bold text-foreground">
                          {t('غير محدد', 'Non spécifié', 'Unspecified')}
                        </p>
                      )}
                    </div>
                  </div>

                  {trip.cmr_import_number && (
                    <div className="text-end shrink-0">
                      <p className="text-[10px] text-muted-foreground uppercase font-mono">CMR Import</p>
                      <p className="text-xs font-mono font-bold text-foreground">{trip.cmr_import_number}</p>
                    </div>
                  )}
                </div>

                {/* Cargo Specs: Description & Weight */}
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-xl bg-muted/30 border border-border/40">
                    <span className="text-muted-foreground block text-[11px] flex items-center gap-1">
                      <Package className="w-3.5 h-3.5 text-emerald-600" />
                      {t('بضاعة الاستيراد:', 'Marchandises Import :')}
                    </span>
                    <span className="font-semibold text-foreground mt-1 block truncate">
                      {trip.goods_description_import || t('طرد وطرود صناعية / مواد أولية', 'Marchandises Diverses')}
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-muted/30 border border-border/40">
                    <span className="text-muted-foreground block text-[11px] flex items-center gap-1">
                      <Weight className="w-3.5 h-3.5 text-emerald-600" />
                      {t('الوزن القائم (Poids):', 'Poids Brut :')}
                    </span>
                    <span className="font-mono font-bold text-foreground mt-1 block">
                      {trip.weight_import ? `${trip.weight_import.toLocaleString()} kg` : '—'}
                    </span>
                  </div>
                </div>

                {/* GPS Targets for Import */}
                {unloadingImportGpsUrl && (
                  <div className="pt-2 border-t border-border/50 flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      asChild
                      className="h-7 text-xs rounded-lg gap-1 border-blue-500/30 text-blue-700 dark:text-blue-400 hover:bg-blue-500/10"
                    >
                      <a href={unloadingImportGpsUrl} target="_blank" rel="noopener noreferrer">
                        <MapPin className="w-3 h-3" />
                        <span>{t('GPS موقع التفريغ بالمغرب', 'GPS Déchargement Maroc')}</span>
                      </a>
                    </Button>
                  </div>
                )}
              </>
            ) : (
              /* Empty return state */
              <div className="p-8 text-center flex flex-col items-center justify-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center text-muted-foreground">
                  <Boxes className="w-6 h-6 opacity-60" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">
                    {t('العودة فارغة بدون حمولة (Retour à vide)', 'Retour à vide sans fret')}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                    {t(
                      'لم يتم تسجيل عميل أو بضاعة لمسار الرجوع. الشاحنة تعود فارغة لتسريع الجاهزية للمأمورية القادمة.',
                      'Le véhicule effectue le retour à vide.'
                    )}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

