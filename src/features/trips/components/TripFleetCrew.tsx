'use client';

import React from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MatriculeBadge } from '@/components/ui/matricule-badge';
import { DriverAvatar } from '@/components/drivers/DriverAvatar';
import { TruckIcon, TrailerIcon } from '@/components/icons/vehicle-icons';
import { useLanguage } from '@/components/language-provider';
import type { Driver, Truck, Trailer } from '@/types/database';
import {
  User,
  Phone,
  ShieldCheck,
  Fuel,
  ExternalLink,
  MessageSquare,
  Truck as TruckLucide,
  Snowflake,
} from 'lucide-react';

interface TripFleetCrewProps {
  driver: Driver | null;
  truck: Truck | null;
  trailer: Trailer | null;
}

export function TripFleetCrew({ driver, truck, trailer }: TripFleetCrewProps) {
  const { t } = useLanguage();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold font-amiri text-foreground flex items-center gap-2">
          <TruckLucide className="w-5 h-5 text-amber-500" />
          <span>{t('طاقم المأمورية والعتاد المشغل', 'Équipage & Matériel Assigné')}</span>
        </h2>
        <Badge variant="outline" className="text-xs font-mono">
          Fleet & Driver
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* 1. Assigned Driver */}
        <Card className="rounded-2xl border-border bg-card shadow-xs p-5 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Badge variant="secondary" className="text-[11px] font-semibold">
                {t('السائق القائد', 'Chauffeur Titulaire')}
              </Badge>
              {driver?.has_valid_visa && (
                <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 text-[10px]">
                  {t('تأشيرة صالحة (Visa OK)', 'Visa Valide')}
                </Badge>
              )}
            </div>

            {driver ? (
              <div className="flex items-center gap-3.5">
                <DriverAvatar
                  name={driver.name}
                  photoUrl={driver.photo_url}
                  driverId={driver.id}
                  size="lg"
                />
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/drivers/${driver.id}`}
                    className="text-base font-bold text-foreground hover:text-primary transition-colors flex items-center gap-1 group truncate"
                  >
                    <span className="truncate">{driver.name}</span>
                    <ExternalLink className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                  </Link>
                  <p className="text-xs text-muted-foreground font-mono mt-0.5">
                    Permis: {driver.license || 'EC'}
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-4 text-center text-muted-foreground bg-muted/30 rounded-xl">
                <User className="w-6 h-6 mx-auto mb-1 opacity-50" />
                <p className="text-xs font-semibold">{t('لم يُعين سائق بعد', 'Chauffeur non assigné')}</p>
              </div>
            )}
          </div>

          {driver?.phone && (
            <div className="pt-3 mt-3 border-t border-border/50 flex items-center justify-between">
              <a
                href={`tel:${driver.phone}`}
                className="text-xs font-mono font-medium text-muted-foreground hover:text-foreground flex items-center gap-1.5"
              >
                <Phone className="w-3.5 h-3.5 text-primary" />
                <span>{driver.phone}</span>
              </a>

              <a
                href={`https://wa.me/${driver.phone.replace(/[^\d+]/g, '').replace(/^00/, '').replace(/^0/, '212')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 hover:underline bg-emerald-500/10 px-2 py-0.5 rounded-md"
              >
                <MessageSquare className="w-3 h-3" />
                <span>WhatsApp</span>
              </a>
            </div>
          )}
        </Card>

        {/* 2. Tractor Truck */}
        <Card className="rounded-2xl border-border bg-card shadow-xs p-5 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Badge variant="secondary" className="text-[11px] font-semibold">
                {t('الشاحنة والجرار (Tracteur)', 'Camion Tracteur')}
              </Badge>
              {truck?.fuel_consumption_rate && (
                <span className="text-[11px] font-mono text-muted-foreground flex items-center gap-1">
                  <Fuel className="w-3 h-3 text-amber-500" />
                  {truck.fuel_consumption_rate}%
                </span>
              )}
            </div>

            {truck ? (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center shrink-0">
                      <TruckIcon className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-foreground">{truck.model || 'Volvo FH'}</p>
                      <p className="text-[11px] text-muted-foreground font-mono">TIR Unit</p>
                    </div>
                  </div>
                  <MatriculeBadge plate={truck.plate_number} variant="badge" size="sm" />
                </div>
              </div>
            ) : (
              <div className="p-4 text-center text-muted-foreground bg-muted/30 rounded-xl">
                <TruckIcon className="w-6 h-6 mx-auto mb-1 opacity-50" />
                <p className="text-xs font-semibold">{t('لم تُعين شاحنة بعد', 'Tracteur non assigné')}</p>
              </div>
            )}
          </div>

          {truck && (
            <div className="pt-3 mt-3 border-t border-border/50 flex items-center justify-end">
              <Link
                href={`/fleet/${truck.id}?type=truck`}
                className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
              >
                <span>{t('عرض ملف الشاحنة', 'Fiche Camion')}</span>
                <ExternalLink className="w-3 h-3" />
              </Link>
            </div>
          )}
        </Card>

        {/* 3. Semi-Trailer */}
        <Card className="rounded-2xl border-border bg-card shadow-xs p-5 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Badge variant="secondary" className="text-[11px] font-semibold">
                {t('المقطورة الملحقة (Semi-Remorque)', 'Semi-Remorque')}
              </Badge>
              <Badge variant="outline" className="text-[10px] font-mono border-purple-500/30 text-purple-600">
                FRIGO / TIR
              </Badge>
            </div>

            {trailer ? (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-600 flex items-center justify-center shrink-0">
                      <TrailerIcon className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-foreground">
                        {trailer.model || 'Schmitz Frigo ATP'}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {trailer.model?.includes('Frigo') ? t('مقطورة تبريد', 'Frigorifique') : t('مقطورة مشمعة', 'Bâchée')}
                      </p>
                    </div>
                  </div>
                  <MatriculeBadge plate={trailer.plate_number} variant="badge" size="sm" />
                </div>
              </div>
            ) : (
              <div className="p-4 text-center text-muted-foreground bg-muted/30 rounded-xl">
                <TrailerIcon className="w-6 h-6 mx-auto mb-1 opacity-50" />
                <p className="text-xs font-semibold">{t('لم تُعين مقطورة بعد', 'Remorque non assignée')}</p>
              </div>
            )}
          </div>

          {trailer && (
            <div className="pt-3 mt-3 border-t border-border/50 flex items-center justify-end">
              <Link
                href={`/fleet/${trailer.id}?type=trailer`}
                className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
              >
                <span>{t('عرض ملف المقطورة', 'Fiche Remorque')}</span>
                <ExternalLink className="w-3 h-3" />
              </Link>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

