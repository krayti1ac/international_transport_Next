'use client';

import React, { useState, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Truck } from '@/components/icons/vehicle-icons';
import {
  ArrowUpRight,
  ArrowDownLeft,
  Calendar,
  FileText,
  User,
  Search,
  ExternalLink,
} from 'lucide-react';
import type { ClientTripWithDetails } from '../../types/client-statement.types';
import { useLanguage } from '@/components/language-provider';

interface ClientTripsTabProps {
  trips: ClientTripWithDetails[];
  currency?: string;
}

export function ClientTripsTab({ trips, currency = 'MAD' }: ClientTripsTabProps) {
  const { t } = useLanguage();
  const [search, setSearch] = useState('');

  const filteredTrips = useMemo(() => {
    return trips.filter((trip) => {
      if (!search) return true;
      const s = search.toLowerCase();
      const route = (trip.route || trip.route_export || trip.route_import || '').toLowerCase();
      const truck = (trip.truckPlate || '').toLowerCase();
      const driver = (trip.driverName || '').toLowerCase();
      const cmr = (
        trip.cmr_number ||
        trip.cmr_export_number ||
        trip.cmr_import_number ||
        ''
      ).toLowerCase();
      return (
        route.includes(s) ||
        truck.includes(s) ||
        driver.includes(s) ||
        cmr.includes(s) ||
        trip.id.toString().includes(s)
      );
    });
  }, [trips, search]);

  if (trips.length === 0) {
    return (
      <div className="text-center py-12 bg-card rounded-xl border border-border text-muted-foreground">
        <Truck className="w-8 h-8 mx-auto mb-2 opacity-40" />
        <p className="text-sm">
          {t('لا توجد رحلات أو شحنات مسجلة لهذا العميل حتى الآن', 'Aucun trajet enregistré pour ce client')}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search Filter */}
      <div className="flex items-center justify-between gap-3 bg-card p-3 rounded-xl border border-border shadow-2xs">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('بحث بالمسار، الشاحنة، السائق، أو CMR...', 'Rechercher par trajet, camion, chauffeur, CMR...')}
            className="ps-9 h-9 text-xs"
          />
        </div>
        <div className="text-xs text-muted-foreground font-semibold">
          {filteredTrips.length} {t('رحلة مرتبطة', 'trajet(s) lié(s)')}
        </div>
      </div>

      {/* Grid of Trip Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredTrips.map((trip) => {
          const isExport = trip.isExport;
          const routeName = isExport
            ? trip.route_export || trip.route
            : trip.route_import || trip.route;
          const cmr = isExport
            ? trip.cmr_export_number || trip.cmr_number
            : trip.cmr_import_number || trip.cmr_number;
          const price = isExport
            ? trip.price_export || trip.price
            : trip.price_import || trip.price;
          const cmrUrl = isExport ? trip.cmr_export_url : trip.cmr_import_url;

          return (
            <div
              key={trip.id}
              className="p-4 rounded-xl border border-border bg-card hover:border-primary/50 transition-all space-y-3 shadow-2xs group"
            >
              {/* Card Header: Type Badge & Departure Date */}
              <div className="flex justify-between items-start">
                {isExport ? (
                  <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30 gap-1 text-[11px]">
                    <ArrowUpRight className="w-3 h-3 text-amber-600" />
                    <span>{t('تصدير (ذهاب)', 'Export (Aller)')}</span>
                  </Badge>
                ) : (
                  <Badge className="bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30 gap-1 text-[11px]">
                    <ArrowDownLeft className="w-3 h-3 text-blue-600" />
                    <span>{t('استيراد (عودة)', 'Import (Retour)')}</span>
                  </Badge>
                )}

                <span className="text-[11px] text-muted-foreground font-mono flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {trip.departure_date}
                </span>
              </div>

              {/* Route Title */}
              <h4
                className="font-bold text-sm text-foreground line-clamp-1 group-hover:text-primary transition-colors"
                title={routeName}
              >
                <Truck className="w-4 h-4 inline me-1.5 text-primary" />
                {routeName}
              </h4>

              {/* Vehicle & Driver Info */}
              <div className="grid grid-cols-2 gap-2 text-xs bg-muted/40 p-2.5 rounded-lg border border-border/60">
                <div>
                  <span className="text-muted-foreground block text-[10px]">{t('الشاحنة الناقلة:', 'Tracteur :')}</span>
                  <span className="font-mono font-bold text-foreground">
                    {trip.truckPlate || t('غير محدد', 'Non assigné')}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px]">{t('السائق المكلف:', 'Chauffeur :')}</span>
                  <span className="font-medium text-foreground flex items-center gap-1">
                    <User className="w-3 h-3 text-muted-foreground" />
                    <span className="truncate">{trip.driverName || t('غير محدد', 'Non assigné')}</span>
                  </span>
                </div>
              </div>

              {/* CMR and Shipping Rate */}
              <div className="flex justify-between items-center pt-2 border-t border-border text-xs">
                <div className="flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground">CMR:</span>
                  <span className="font-mono font-semibold text-foreground">
                    {cmr || 'N/A'}
                  </span>
                  {cmrUrl && (
                    <a
                      href={cmrUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline ms-1"
                      title={t('عرض وثيقة CMR', 'Voir le document CMR')}
                    >
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>

                <div className="text-end">
                  <span className="font-mono font-bold text-primary text-sm">
                    {Number(price || 0).toLocaleString()} {currency}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

