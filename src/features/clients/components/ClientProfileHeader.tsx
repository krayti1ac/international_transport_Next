'use client';

import React from 'react';
import { ClientAvatar } from '@/components/clients/ClientAvatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Phone,
  Mail,
  MapPin,
  ExternalLink,
  Navigation,
  FileCheck2,
  Calculator,
  ArrowUpRight,
  ArrowDownLeft,
  Boxes,
} from 'lucide-react';
import type { Client } from '@/types/database';
import { useLanguage } from '@/components/language-provider';
import { buildGoogleMapsNavigationUrl, buildWazeNavigationUrl } from '@/lib/navigation-links';

interface ClientProfileHeaderProps {
  client: Client;
  onOpenFifoModal: () => void;
}

export function ClientProfileHeader({ client, onOpenFifoModal }: ClientProfileHeaderProps) {
  const { t } = useLanguage();

  // Navigation targets
  const loadingGpsTarget = {
    gpsUrl: client.loading_gps_url,
    addressOrCity: client.shipping_city || client.address,
    label: t('موقع التحميل', 'Lieu de chargement'),
  };

  const unloadingGpsTarget = {
    gpsUrl: client.unloading_gps_url,
    addressOrCity: client.shipping_city || client.city,
    label: t('موقع التفريغ', 'Lieu de déchargement'),
  };

  const loadingGoogleUrl = client.loading_gps_url
    ? buildGoogleMapsNavigationUrl(loadingGpsTarget)
    : null;
  const loadingWazeUrl = client.loading_gps_url
    ? buildWazeNavigationUrl(loadingGpsTarget)
    : null;

  const unloadingGoogleUrl = client.unloading_gps_url
    ? buildGoogleMapsNavigationUrl(unloadingGpsTarget)
    : null;
  const unloadingWazeUrl = client.unloading_gps_url
    ? buildWazeNavigationUrl(unloadingGpsTarget)
    : null;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-card via-card/90 to-muted/30 p-6 sm:p-8 shadow-xs">
      <div className="flex flex-col lg:flex-row justify-between items-start gap-6">
        {/* Client Identity & Details */}
        <div className="flex items-start gap-4 sm:gap-6">
          <ClientAvatar
            name={client.name}
            logoUrl={client.logo_url}
            clientId={client.id}
            size="xl"
            className="ring-2 ring-primary/20 shadow-md"
          />

          <div className="space-y-3">
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl sm:text-3xl font-black font-amiri text-foreground tracking-tight">
                  {client.name}
                </h1>

                {/* Specialization Badge */}
                {client.client_type === 'export' ? (
                  <Badge className="bg-amber-600/15 text-amber-700 dark:text-amber-400 border border-amber-600/30 gap-1.5 px-3 py-1 font-semibold text-xs rounded-full">
                    <ArrowUpRight className="w-3.5 h-3.5 text-amber-600" />
                    <span>{t('عميل تصدير حصري (Export Aller)', 'Client Export Exclusif (Aller)')}</span>
                  </Badge>
                ) : client.client_type === 'import' ? (
                  <Badge className="bg-blue-600/15 text-blue-700 dark:text-blue-400 border border-blue-600/30 gap-1.5 px-3 py-1 font-semibold text-xs rounded-full">
                    <ArrowDownLeft className="w-3.5 h-3.5 text-blue-600" />
                    <span>{t('عميل استيراد حصري (Import Retour)', 'Client Import Exclusif (Retour)')}</span>
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="gap-1.5 px-3 py-1 font-semibold text-xs rounded-full">
                    <Boxes className="w-3.5 h-3.5" />
                    <span>{t('شحن دولي عام (تصدير واستيراد)', 'Transport Général (Export & Import)')}</span>
                  </Badge>
                )}
              </div>

              {/* Contact info line */}
              <div className="flex items-center gap-4 mt-2 text-xs sm:text-sm text-muted-foreground flex-wrap">
                {client.phone && (
                  <span className="flex items-center gap-1.5 hover:text-foreground transition-colors">
                    <Phone className="w-3.5 h-3.5 text-primary" />
                    <span dir="ltr">{client.phone}</span>
                  </span>
                )}
                {client.email && (
                  <span className="flex items-center gap-1.5 hover:text-foreground transition-colors">
                    <Mail className="w-3.5 h-3.5 text-primary" />
                    <span dir="ltr">{client.email}</span>
                  </span>
                )}
                {(client.address || client.city) && (
                  <span className="flex items-center gap-1.5 hover:text-foreground transition-colors">
                    <MapPin className="w-3.5 h-3.5 text-primary" />
                    <span>
                      {client.address ? `${client.address}, ` : ''}
                      {client.city || t('المغرب', 'Maroc')}
                    </span>
                  </span>
                )}
                {client.nom_contact && (
                  <span className="text-muted-foreground/80">
                    ({t('المسؤول:', 'Contact :')} {client.nom_contact})
                  </span>
                )}
              </div>
            </div>

            {/* Tax & Fiscal Identity Badges */}
            <div className="flex items-center gap-2 flex-wrap pt-1">
              <Badge variant="outline" className="font-mono text-xs border-primary/20 bg-background/50 px-2.5 py-1">
                <FileCheck2 className="w-3 h-3 me-1.5 text-emerald-600" />
                <span className="text-muted-foreground">ICE: </span>
                <span className="font-bold text-foreground ms-1">{client.ice || t('غير مسجل', 'Non renseigné')}</span>
              </Badge>

              <Badge variant="outline" className="font-mono text-xs border-border bg-background/50 px-2.5 py-1">
                <span className="text-muted-foreground">TVA: </span>
                <span className="font-bold text-foreground ms-1">{client.tva_rate || '20'}%</span>
              </Badge>

              <Badge variant="outline" className="font-mono text-xs border-border bg-background/50 px-2.5 py-1">
                <span className="text-muted-foreground">{t('العملة الأساسية:', 'Devise :')} </span>
                <span className="font-bold text-foreground ms-1">{client.currency || 'MAD'}</span>
              </Badge>
            </div>

            {/* Geographic GPS Links (Google Maps & Waze) */}
            <div className="flex flex-wrap items-center gap-2.5 pt-2">
              {/* Loading Site GPS */}
              {client.loading_gps_url && (
                <div className="inline-flex items-center gap-1 rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-2.5 py-1 text-xs">
                  <MapPin className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span className="font-medium text-emerald-800 dark:text-emerald-300">
                    {t('موقع التحميل:', 'Chargement :')}
                  </span>
                  {loadingGoogleUrl && (
                    <a
                      href={loadingGoogleUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-semibold text-[11px] bg-emerald-600 text-white hover:bg-emerald-700 transition-colors shadow-2xs"
                      title="Google Maps"
                    >
                      <span>Google Maps</span>
                      <ExternalLink className="w-2.5 h-2.5 opacity-80" />
                    </a>
                  )}
                  {loadingWazeUrl && (
                    <a
                      href={loadingWazeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-semibold text-[11px] bg-sky-600 text-white hover:bg-sky-700 transition-colors shadow-2xs"
                      title="Waze Navigation"
                    >
                      <Navigation className="w-2.5 h-2.5" />
                      <span>Waze</span>
                    </a>
                  )}
                </div>
              )}

              {/* Unloading Site GPS */}
              {client.unloading_gps_url && (
                <div className="inline-flex items-center gap-1 rounded-xl border border-blue-500/30 bg-blue-500/5 px-2.5 py-1 text-xs">
                  <MapPin className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  <span className="font-medium text-blue-800 dark:text-blue-300">
                    {t('موقع التفريغ:', 'Déchargement :')}
                  </span>
                  {unloadingGoogleUrl && (
                    <a
                      href={unloadingGoogleUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-semibold text-[11px] bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-2xs"
                      title="Google Maps"
                    >
                      <span>Google Maps</span>
                      <ExternalLink className="w-2.5 h-2.5 opacity-80" />
                    </a>
                  )}
                  {unloadingWazeUrl && (
                    <a
                      href={unloadingWazeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-semibold text-[11px] bg-sky-600 text-white hover:bg-sky-700 transition-colors shadow-2xs"
                      title="Waze Navigation"
                    >
                      <Navigation className="w-2.5 h-2.5" />
                      <span>Waze</span>
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Primary Action Button */}
        <div className="w-full lg:w-auto flex flex-col sm:flex-row items-center gap-3 shrink-0">
          <Button
            onClick={onOpenFifoModal}
            className="w-full sm:w-auto h-12 px-6 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-bold shadow-lg shadow-emerald-600/20 hover:shadow-emerald-600/30 transition-all gap-2 text-sm"
          >
            <Calculator className="w-4 h-4" />
            <span>{t('تحصيل دفعة بنظام FIFO', 'Encaissement par FIFO')}</span>
          </Button>
        </div>
      </div>
    </div>
  );
}

