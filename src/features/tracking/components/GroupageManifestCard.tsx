'use client';

/**
 * Trans Bodanon TMS — Groupage & LTL Multi-Consignment Manifest Card
 * Features: Live 13.6m LDM utilization radar, payload weight tracker, and multi-client CMR manifests.
 */

import React, { useState, useEffect, useTransition, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useLanguage } from '@/components/language-provider';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  Boxes,
  Plus,
  Scale,
  Thermometer,
  Layers,
  MapPin,
  FileText,
  DollarSign,
  AlertTriangle,
  CheckCircle2,
  Truck,
  RefreshCw,
  ExternalLink,
  ChevronRight,
} from 'lucide-react';
import type { TripConsignment, ConsignmentStatus } from '../types/groupage-ltl.types';
import { calculateTrailerUtilization } from '../services/groupage-calculator.service';
import {
  fetchTripConsignmentsAction,
  updateConsignmentStatusAction,
} from '../services/groupage-consignment.actions';
import { NewConsignmentModal } from './NewConsignmentModal';

interface GroupageManifestCardProps {
  tripId: number;
  tripNumber?: string;
  initialConsignments?: TripConsignment[];
}

export function GroupageManifestCard({
  tripId,
  tripNumber = 'TRIP-2026-8840',
  initialConsignments = [],
}: GroupageManifestCardProps) {
  const t = useTranslations('groupageLtl');
  const tCommon = useTranslations('common');
  const { dir } = useLanguage();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const [consignments, setConsignments] = useState<TripConsignment[]>(initialConsignments);
  const [showNewModal, setShowNewModal] = useState<boolean>(false);

  // Load consignments if not provided
  useEffect(() => {
    if (initialConsignments.length === 0 && tripId) {
      fetchTripConsignmentsAction(tripId).then((res) => {
        if (res.success && res.data) {
          setConsignments(res.data);
        }
      });
    }
  }, [tripId, initialConsignments.length]);

  // Aggregate trailer capacity utilization
  const utilization = useMemo(() => {
    return calculateTrailerUtilization(consignments);
  }, [consignments]);

  const handleUpdateStatus = (consignmentId: string, newStatus: ConsignmentStatus) => {
    startTransition(async () => {
      const res = await updateConsignmentStatusAction({
        consignmentId,
        status: newStatus,
      });

      if (res.success) {
        setConsignments((prev) =>
          prev.map((c) => (c.id === consignmentId ? { ...c, status: newStatus } : c))
        );
        toast({
          title: t('statusUpdatedTitle'),
          description: t('statusUpdatedDesc'),
        });
      } else {
        toast({
          title: tCommon('error'),
          description: res.error || t('statusUpdateFailed'),
          variant: 'destructive',
        });
      }
    });
  };

  const getStatusBadge = (status: ConsignmentStatus) => {
    switch (status) {
      case 'manifested':
        return (
          <Badge variant="outline" className="text-[10px] text-muted-foreground">
            {t('statusManifested')}
          </Badge>
        );
      case 'loaded':
        return (
          <Badge className="bg-blue-600/10 text-blue-700 dark:text-blue-400 border-blue-500/30 text-[10px]">
            {t('statusLoaded')}
          </Badge>
        );
      case 'in_transit':
        return (
          <Badge className="bg-amber-600/10 text-amber-700 dark:text-amber-400 border-amber-500/30 text-[10px]">
            {t('statusInTransit')}
          </Badge>
        );
      case 'customs_cleared':
        return (
          <Badge className="bg-purple-600/10 text-purple-700 dark:text-purple-400 border-purple-500/30 text-[10px]">
            {t('statusCustomsCleared')}
          </Badge>
        );
      case 'delivered':
      case 'signed_epod':
        return (
          <Badge className="bg-emerald-600/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 text-[10px]">
            <CheckCircle2 className="h-3 w-3 me-1 inline" />
            {t('statusDelivered')}
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <Card className="border-border shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="text-base md:text-lg flex items-center gap-2">
              <Boxes className="h-5 w-5 text-primary" />
              {t('manifestCardTitle')}
              <Badge variant="outline" className="font-mono text-xs ms-1">
                {tripNumber}
              </Badge>
            </CardTitle>
            <CardDescription className="text-xs">
              {t('manifestCardSubtitle')}
            </CardDescription>
          </div>
          <Button
            size="sm"
            onClick={() => setShowNewModal(true)}
            className="text-xs gap-1.5 self-start md:self-auto"
          >
            <Plus className="h-3.5 w-3.5" />
            {t('addConsignmentBtn')}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* Capacity Utilization Radar */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-4 rounded-xl border bg-muted/20">
          {/* LDM Meter Progress */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="font-medium flex items-center gap-1">
                <Truck className="h-3.5 w-3.5 text-primary" />
                {t('ldmCapacityLabel')}
              </span>
              <span className="font-mono font-bold">
                {utilization.totalLdm} / {utilization.maxLdm} m ({utilization.ldmUtilizationPct}%)
              </span>
            </div>
            <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-500 rounded-full ${
                  utilization.isOverLdm
                    ? 'bg-destructive'
                    : utilization.ldmUtilizationPct > 85
                    ? 'bg-amber-500'
                    : 'bg-primary'
                }`}
                style={{ width: `${Math.min(100, utilization.ldmUtilizationPct)}%` }}
              />
            </div>
            {utilization.isOverLdm && (
              <span className="text-[10px] text-destructive flex items-center gap-1 font-bold">
                <AlertTriangle className="h-3 w-3" />
                {t('overLdmWarning')}
              </span>
            )}
          </div>

          {/* Payload Weight Progress */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="font-medium flex items-center gap-1">
                <Scale className="h-3.5 w-3.5 text-blue-500" />
                {t('payloadWeightLabel')}
              </span>
              <span className="font-mono font-bold">
                {utilization.totalGrossWeightKg.toLocaleString()} / {utilization.maxWeightKg.toLocaleString()} kg
              </span>
            </div>
            <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-500 rounded-full ${
                  utilization.isOverloaded
                    ? 'bg-destructive'
                    : utilization.weightUtilizationPct > 85
                    ? 'bg-amber-500'
                    : 'bg-blue-600'
                }`}
                style={{ width: `${Math.min(100, utilization.weightUtilizationPct)}%` }}
              />
            </div>
            {utilization.isOverloaded && (
              <span className="text-[10px] text-destructive flex items-center gap-1 font-bold">
                <AlertTriangle className="h-3 w-3" />
                {t('overloadedWarning')}
              </span>
            )}
          </div>

          {/* Volume Progress & Revenue */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="font-medium flex items-center gap-1">
                <DollarSign className="h-3.5 w-3.5 text-emerald-500" />
                {t('combinedRevenueLabel')}
              </span>
              <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                {utilization.totalFreightRevenue.toLocaleString()} {utilization.currency}
              </span>
            </div>
            <div className="flex justify-between text-[11px] text-muted-foreground pt-1">
              <span>{t('totalPalletsCount')}: <strong className="text-foreground">{utilization.totalPallets}</strong></span>
              <span>{t('consignmentsCount')}: <strong className="text-foreground">{utilization.consignmentsCount}</strong></span>
            </div>
          </div>
        </div>

        {/* Consignments Table */}
        {consignments.length === 0 ? (
          <div className="text-center py-8 border rounded-xl bg-muted/10 space-y-2">
            <Boxes className="h-8 w-8 mx-auto text-muted-foreground/60" />
            <p className="text-xs text-muted-foreground">{t('noConsignmentsYet')}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowNewModal(true)}
              className="text-xs gap-1"
            >
              <Plus className="h-3.5 w-3.5" />
              {t('addFirstConsignment')}
            </Button>
          </div>
        ) : (
          <div className="rounded-xl border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-start border-collapse text-xs">
                <thead className="bg-muted/40 font-semibold border-b text-[11px] text-muted-foreground">
                  <tr>
                    <th className="p-2.5 text-start">{t('refAndClientCol')}</th>
                    <th className="p-2.5 text-start">{t('routeCol')}</th>
                    <th className="p-2.5 text-start">{t('cargoSpecsCol')}</th>
                    <th className="p-2.5 text-end">{t('ldmAndWeightCol')}</th>
                    <th className="p-2.5 text-end">{t('priceCol')}</th>
                    <th className="p-2.5 text-center">{t('statusCol')}</th>
                    <th className="p-2.5 text-center">{t('actionsCol')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {consignments.map((c) => (
                    <tr key={c.id} className="hover:bg-muted/20 transition-colors">
                      <td className="p-2.5">
                        <span className="font-mono font-bold text-foreground block">
                          {c.consignmentReference}
                        </span>
                        <span className="text-[11px] text-muted-foreground">{c.clientName}</span>
                      </td>

                      <td className="p-2.5 text-muted-foreground">
                        <div className="flex items-center gap-1 text-[11px]">
                          <span>{c.loadingCity}</span>
                          <ChevronRight className="h-3 w-3 shrink-0" />
                          <span>{c.deliveryCity}</span>
                        </div>
                        {c.cmrNumber && (
                          <span className="font-mono text-[10px] text-primary block">
                            {c.cmrNumber}
                          </span>
                        )}
                      </td>

                      <td className="p-2.5">
                        <span className="truncate max-w-[150px] block">{c.cargoDescription}</span>
                        {c.isTemperatureControlled && c.targetTemperatureC !== null && (
                          <Badge variant="outline" className="text-[10px] text-blue-600 gap-0.5 mt-0.5">
                            <Thermometer className="h-2.5 w-2.5" />
                            {c.targetTemperatureC}°C
                          </Badge>
                        )}
                      </td>

                      <td className="p-2.5 text-end font-mono">
                        <span className="font-bold text-foreground block">{c.ldmMeters} LDM</span>
                        <span className="text-[10px] text-muted-foreground">
                          {c.palletCount} {c.palletType} ({c.grossWeightKg.toLocaleString()} kg)
                        </span>
                      </td>

                      <td className="p-2.5 text-end font-mono">
                        <span className="font-bold text-emerald-600 dark:text-emerald-400 block">
                          {c.freightPrice.toLocaleString()} {c.currency}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {c.chargeableWeightKg} kg chg.
                        </span>
                      </td>

                      <td className="p-2.5 text-center">{getStatusBadge(c.status)}</td>

                      <td className="p-2.5 text-center">
                        <select
                          value={c.status}
                          onChange={(e) =>
                            handleUpdateStatus(c.id, e.target.value as ConsignmentStatus)
                          }
                          disabled={isPending}
                          className="p-1 border rounded text-[11px] bg-background"
                        >
                          <option value="manifested">{t('statusManifested')}</option>
                          <option value="loaded">{t('statusLoaded')}</option>
                          <option value="in_transit">{t('statusInTransit')}</option>
                          <option value="customs_cleared">{t('statusCustomsCleared')}</option>
                          <option value="delivered">{t('statusDelivered')}</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </CardContent>

      {/* New Consignment Modal */}
      {showNewModal && (
        <NewConsignmentModal
          tripId={tripId}
          isOpen={showNewModal}
          onClose={() => setShowNewModal(false)}
          onSuccess={(newConsignment) => {
            setConsignments((prev) => [...prev, newConsignment]);
          }}
        />
      )}
    </Card>
  );
}

