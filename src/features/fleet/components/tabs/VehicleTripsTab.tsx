'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Route,
  ArrowRight,
  ExternalLink,
  MapPin,
  Calendar,
  User,
  Building2,
  CheckCircle2,
  Clock,
  Navigation,
} from 'lucide-react';
import { useLanguage } from '@/components/language-provider';
import { formatCurrency } from '@/lib/forex';
import type { TripOrder, Driver, Client } from '@/types/database';

interface VehicleTripsTabProps {
  trips: TripOrder[];
  driversMap?: Record<number, Driver>;
  clientsMap?: Record<number, Client>;
}

export function VehicleTripsTab({
  trips,
  driversMap = {},
  clientsMap = {},
}: VehicleTripsTabProps) {
  const { t, dir } = useLanguage();
  const [filter, setFilter] = useState<'all' | 'in_progress' | 'completed'>('all');

  const filteredTrips = useMemo(() => {
    if (filter === 'all') return trips;
    if (filter === 'in_progress') {
      return trips.filter(
        (tr) => tr.status === 'in_progress' || tr.status === 'loading'
      );
    }
    return trips.filter(
      (tr) => tr.status === 'completed' || tr.status === 'settled'
    );
  }, [trips, filter]);

  return (
    <div className="space-y-4">
      {/* Filters Bar */}
      <div className="flex items-center justify-between gap-3 bg-card p-3 rounded-2xl border border-border flex-wrap">
        <div className="flex items-center gap-1.5">
          <Button
            variant={filter === 'all' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setFilter('all')}
            className="rounded-xl text-xs h-8"
          >
            {t('جميع الرحلات', 'Tous les trajets')} ({trips.length})
          </Button>

          <Button
            variant={filter === 'in_progress' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setFilter('in_progress')}
            className="rounded-xl text-xs h-8 text-blue-600 dark:text-blue-400"
          >
            {t('رحلات جارية', 'En cours')} (
            {trips.filter((tr) => tr.status === 'in_progress' || tr.status === 'loading').length})
          </Button>

          <Button
            variant={filter === 'completed' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setFilter('completed')}
            className="rounded-xl text-xs h-8 text-emerald-600 dark:text-emerald-400"
          >
            {t('مكتملة ومسلمة', 'Achevés')} (
            {trips.filter((tr) => tr.status === 'completed' || tr.status === 'settled').length})
          </Button>
        </div>

        <span className="text-xs text-muted-foreground font-mono">
          {filteredTrips.length} {t('مهمة نقل مسجلة', 'missions')}
        </span>
      </div>

      {/* Trips Table Card */}
      <Card className="rounded-2xl border-border bg-card overflow-hidden">
        <CardContent className="p-0">
          {filteredTrips.length === 0 ? (
            <div className="p-10 text-center text-muted-foreground">
              <Route className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm font-medium">
                {t('لا توجد رحلات مسجلة في هذا التبويب.', 'Aucun trajet trouvé.')}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-start">
                <thead className="bg-muted/50 border-b border-border text-muted-foreground font-medium">
                  <tr>
                    <th className="p-3.5 text-start">{t('رقم الرحلة', 'N° Trajet')}</th>
                    <th className="p-3.5 text-start">{t('مسار النقل الدولي', 'Itinéraire')}</th>
                    <th className="p-3.5 text-start">{t('العميل', 'Client')}</th>
                    <th className="p-3.5 text-start">{t('السائق المنفذ', 'Chauffeur')}</th>
                    <th className="p-3.5 text-start">{t('تاريخ الانطلاق', 'Départ')}</th>
                    <th className="p-3.5 text-start">{t('قيمة النولون', 'Fret')}</th>
                    <th className="p-3.5 text-start">{t('الحالة', 'Statut')}</th>
                    <th className="p-3.5 text-center">{t('الإجراء', 'Action')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filteredTrips.map((tr) => {
                    const driver = tr.driver_id ? driversMap[tr.driver_id] : null;
                    const client = tr.client_id ? clientsMap[tr.client_id] : null;
                    const isActive = tr.status === 'in_progress' || tr.status === 'loading';

                    return (
                      <tr key={tr.id} className="hover:bg-muted/30 transition-colors">
                        {/* Trip Order Number */}
                        <td className="p-3.5 font-mono font-bold text-foreground whitespace-nowrap">
                          <Link
                            href={`/trips/${tr.id}`}
                            className="hover:text-primary transition-colors flex items-center gap-1 group"
                          >
                            <span>#{tr.id}</span>
                            <span className="text-[11px] text-muted-foreground">
                              {tr.cmr_number ? `(${tr.cmr_number})` : ''}
                            </span>
                            <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </Link>
                        </td>

                        {/* Route */}
                        <td className="p-3.5">
                          <div className="flex items-center gap-1.5 font-semibold text-foreground">
                            <span>
                              {tr.route ||
                                (tr.route_export
                                  ? `${tr.route_export} -> ${tr.route_import || ''}`
                                  : t('المغرب -> أوروبا', 'Maroc -> Europe'))}
                            </span>
                          </div>
                          {(tr as any).distance_km && (
                            <p className="text-[11px] text-muted-foreground font-mono mt-0.5">
                              {(tr as any).distance_km} km
                            </p>
                          )}
                        </td>

                        {/* Client */}
                        <td className="p-3.5">
                          {client ? (
                            <Link
                              href={`/clients/${client.id}`}
                              className="font-semibold text-foreground hover:text-primary transition-colors truncate block max-w-[150px]"
                            >
                              {client.name}
                            </Link>
                          ) : (
                            <span className="text-muted-foreground">
                              {(tr as any).client_name || '—'}
                            </span>
                          )}
                        </td>

                        {/* Driver */}
                        <td className="p-3.5">
                          {driver ? (
                            <Link
                              href={`/drivers/${driver.id}`}
                              className="font-medium text-foreground hover:text-primary transition-colors truncate block max-w-[130px]"
                            >
                              {driver.name}
                            </Link>
                          ) : (
                            <span className="text-muted-foreground">
                              {(tr as any).driver_name || '—'}
                            </span>
                          )}
                        </td>

                        {/* Departure Date */}
                        <td className="p-3.5 font-mono text-muted-foreground whitespace-nowrap">
                          {tr.departure_date || '—'}
                        </td>

                        {/* Freight Price */}
                        <td className="p-3.5 font-mono font-bold text-foreground whitespace-nowrap">
                          {formatCurrency(tr.price ?? tr.price_export ?? 0, (tr as any).currency || 'EUR')}
                        </td>

                        {/* Status Badge */}
                        <td className="p-3.5 whitespace-nowrap">
                          {isActive ? (
                            <Badge className="bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30 text-[10px]">
                              {t('على الطريق', 'En route', 'In Transit')}
                            </Badge>
                          ) : tr.status === 'settled' ? (
                            <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-500/30">
                              {t('مسددة بالكامل', 'Réglée', 'Settled')}
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-[10px]">
                              {t('مكتملة', 'Terminée', 'Completed')}
                            </Badge>
                          )}
                        </td>

                        {/* Action Link */}
                        <td className="p-3.5 text-center whitespace-nowrap">
                          <Button
                            variant="ghost"
                            size="sm"
                            asChild
                            className="h-7 text-xs px-2.5 rounded-lg text-primary hover:bg-primary/10"
                          >
                            <Link href={`/trips/${tr.id}`}>
                              <span>{t('عرض الرحلة', 'Détails')}</span>
                            </Link>
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
