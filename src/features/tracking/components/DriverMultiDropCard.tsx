'use client';

/**
 * Trans Bodanon TMS — Driver Multi-Drop Delivery & e-POD Card
 * Manages drop-off stops sequencing, navigation, and independent e-POD collection.
 */

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  MapPin,
  CheckCircle2,
  Navigation,
  PenTool,
  ShieldCheck,
  FileText,
  ExternalLink,
  Copy,
  Check,
  Clock,
  Thermometer,
} from 'lucide-react';
import type { TripConsignment } from '../types/groupage-ltl.types';
import { ConsignmentEpodModal } from './ConsignmentEpodModal';
import { buildPublicConsignmentTrackingUrl } from '../services/consignment-epod.service';

interface DriverMultiDropCardProps {
  tripId: number;
  initialConsignments: TripConsignment[];
  onRefresh?: () => void;
}

export function DriverMultiDropCard({
  tripId,
  initialConsignments,
  onRefresh,
}: DriverMultiDropCardProps) {
  const t = useTranslations('consignmentEpod');
  const [consignments, setConsignments] = useState<TripConsignment[]>(initialConsignments);
  const [selectedConsignment, setSelectedConsignment] = useState<TripConsignment | null>(null);
  const [copiedTokenId, setCopiedTokenId] = useState<string | null>(null);

  // Sort consignments by dropSequence
  const sortedConsignments = [...consignments].sort((a, b) => {
    const seqA = a.dropSequence !== undefined && a.dropSequence !== null ? a.dropSequence : 999;
    const seqB = b.dropSequence !== undefined && b.dropSequence !== null ? b.dropSequence : 999;
    return seqA - seqB;
  });

  const handleEpodSuccess = (result: { consignmentId: string; invoiceNumber?: string | null }) => {
    setConsignments((prev) =>
      prev.map((c) => {
        if (c.id === result.consignmentId) {
          return {
            ...c,
            status: 'signed_epod',
            epodSignedAt: new Date().toISOString(),
            invoiceNumber: result.invoiceNumber || c.invoiceNumber,
          };
        }
        return c;
      })
    );
    if (onRefresh) onRefresh();
  };

  const handleCopyTrackingLink = (c: TripConsignment) => {
    const url = buildPublicConsignmentTrackingUrl(c.consignmentReference, c.trackingToken);
    navigator.clipboard.writeText(url);
    setCopiedTokenId(c.id);
    setTimeout(() => setCopiedTokenId(null), 2500);
  };

  const openNavigation = (c: TripConsignment) => {
    const destination = encodeURIComponent(`${c.deliveryCity}, ${c.deliveryCountry}`);
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${destination}`, '_blank');
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm mb-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-5 border-b border-slate-100 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 rounded-lg">
              <MapPin className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              {t('multiDropTitle')}
            </h3>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {t('multiDropSubtitle')}
          </p>
        </div>

        <div className="text-xs font-semibold px-3 py-1 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 rounded-lg border border-indigo-100 dark:border-indigo-900">
          {sortedConsignments.filter((c) => c.status === 'signed_epod' || c.status === 'delivered').length} / {sortedConsignments.length} {t('completedStops')}
        </div>
      </div>

      {/* Multi-Drop Timeline */}
      <div className="mt-5 space-y-4">
        {sortedConsignments.map((c, index) => {
          const isDelivered = c.status === 'signed_epod' || c.status === 'delivered';
          const dropNum = c.dropSequence || index + 1;

          return (
            <div
              key={c.id}
              className={`p-4 rounded-xl border transition-all ${
                isDelivered
                  ? 'bg-slate-50/80 dark:bg-slate-800/30 border-slate-200 dark:border-slate-800'
                  : 'bg-white dark:bg-slate-900 border-indigo-200 dark:border-indigo-900/60 shadow-sm'
              }`}
            >
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                {/* Stop info */}
                <div className="flex items-start gap-3">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                      isDelivered
                        ? 'bg-emerald-500 text-white'
                        : 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                    }`}
                  >
                    {isDelivered ? <CheckCircle2 className="w-4 h-4" /> : dropNum}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold font-mono text-slate-500">
                        {c.consignmentReference}
                      </span>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                        {c.clientName}
                      </h4>
                      {c.isTemperatureControlled && (
                        <span className="flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 bg-cyan-50 text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-300 rounded">
                          <Thermometer className="w-3 h-3" />
                          {c.targetTemperatureC ?? 4}°C
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      <span className="font-semibold">{c.deliveryCity} ({c.deliveryCountry})</span>
                      {c.deliveryDockName && <span className="text-slate-400">— {c.deliveryDockName}</span>}
                    </p>

                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {c.cargoDescription} • {c.palletCount} {t('pallets')} • {c.grossWeightKg.toLocaleString()} kg
                    </p>
                  </div>
                </div>

                {/* Status and Action Buttons */}
                <div className="flex flex-wrap items-center gap-2 self-end md:self-center">
                  <button
                    type="button"
                    onClick={() => openNavigation(c)}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg transition-all"
                  >
                    <Navigation className="w-3.5 h-3.5 text-blue-500" />
                    {t('navigateBtn')}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleCopyTrackingLink(c)}
                    className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-lg transition-all"
                    title={t('copyTrackingLinkTitle')}
                  >
                    {copiedTokenId === c.id ? (
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    <span className="hidden sm:inline">{t('trackingLinkBtn')}</span>
                  </button>

                  {isDelivered ? (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900 rounded-lg text-xs font-bold">
                      <ShieldCheck className="w-4 h-4 text-emerald-500" />
                      <span>{t('epodSignedBadge')}</span>
                      {c.invoiceNumber && (
                        <span className="text-[10px] font-mono text-blue-600 dark:text-blue-400 ms-1">
                          ({c.invoiceNumber})
                        </span>
                      )}
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setSelectedConsignment(c)}
                      className="flex items-center gap-1.5 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-sm transition-all"
                    >
                      <PenTool className="w-3.5 h-3.5" />
                      {t('deliverAndSignBtn')}
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Signature Modal */}
      {selectedConsignment && (
        <ConsignmentEpodModal
          consignment={selectedConsignment}
          isOpen={Boolean(selectedConsignment)}
          onClose={() => setSelectedConsignment(null)}
          onSuccess={handleEpodSuccess}
        />
      )}
    </div>
  );
}

