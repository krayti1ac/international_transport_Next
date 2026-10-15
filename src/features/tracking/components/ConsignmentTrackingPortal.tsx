'use client';

/**
 * Trans Bodanon TMS — Isolated Public Consignment Tracking Portal
 * Customer-facing portal displaying only their consignment, CMR, forensic e-POD seal, and invoice.
 */

import React from 'react';
import { useTranslations } from 'next-intl';
import {
  Package,
  MapPin,
  CheckCircle2,
  Clock,
  ShieldCheck,
  FileText,
  Thermometer,
  Truck,
  ArrowRight,
  ExternalLink,
} from 'lucide-react';
import type { PublicConsignmentTrackingData } from '../types/consignment-epod.types';

interface ConsignmentTrackingPortalProps {
  data: PublicConsignmentTrackingData;
}

export function ConsignmentTrackingPortal({ data }: ConsignmentTrackingPortalProps) {
  const t = useTranslations('consignmentEpod');

  const isDelivered = data.status === 'signed_epod' || data.status === 'delivered';

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-blue-900 to-indigo-900 text-white rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 bg-blue-500/30 border border-blue-400/40 rounded-full text-[11px] font-mono uppercase tracking-wider">
                {t('isolatedTrackingBadge')}
              </span>
              {data.isTemperatureControlled && (
                <span className="px-2 py-0.5 bg-cyan-500/30 border border-cyan-400/40 rounded-full text-[11px] flex items-center gap-1 font-semibold">
                  <Thermometer className="w-3 h-3" />
                  {data.targetTemperatureC ?? 4}°C
                </span>
              )}
            </div>
            <h1 className="text-xl sm:text-2xl font-black font-mono">
              {data.consignmentReference}
            </h1>
            <p className="text-xs text-blue-200 mt-1">
              {data.clientName} — {data.cargoDescription}
            </p>
          </div>

          <div className="self-start sm:self-center">
            {isDelivered ? (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/20 border border-emerald-400/30 rounded-xl text-emerald-300 text-xs font-bold">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                {t('statusDeliveredAndSigned')}
              </div>
            ) : (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/20 border border-amber-400/30 rounded-xl text-amber-300 text-xs font-bold">
                <Clock className="w-4 h-4 text-amber-400 animate-pulse" />
                {t('statusInTransit')}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Origin -> Destination Route */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
        <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4">
          {t('routeOverviewTitle')}
        </h3>

        <div className="flex items-center justify-between relative">
          {/* Origin */}
          <div className="flex flex-col">
            <span className="text-[11px] text-slate-400 font-semibold">{t('loadingPoint')}</span>
            <span className="text-base font-bold text-slate-900 dark:text-white">
              {data.loadingCity}
            </span>
            <span className="text-xs text-slate-500 font-mono">
              {data.loadingCountry}
            </span>
          </div>

          {/* Icon */}
          <div className="flex flex-col items-center px-4">
            <div className="p-2.5 bg-blue-50 dark:bg-blue-950/40 text-blue-600 rounded-full border border-blue-100 dark:border-blue-900">
              <Truck className="w-5 h-5" />
            </div>
            <span className="text-[10px] text-slate-400 mt-1 font-mono">
              {data.palletCount} {t('pallets')} ({data.grossWeightKg.toLocaleString()} kg)
            </span>
          </div>

          {/* Destination */}
          <div className="flex flex-col text-end">
            <span className="text-[11px] text-slate-400 font-semibold">{t('deliveryDestination')}</span>
            <span className="text-base font-bold text-slate-900 dark:text-white">
              {data.deliveryCity}
            </span>
            <span className="text-xs text-slate-500 font-mono">
              {data.deliveryCountry} {data.deliveryDockName ? `• ${data.deliveryDockName}` : ''}
            </span>
          </div>
        </div>
      </div>

      {/* Cryptographic e-POD Proof of Delivery */}
      {data.isVerified && (
        <div className="bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/60 rounded-xl p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-2 bg-emerald-500 text-white rounded-lg">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-emerald-950 dark:text-emerald-200">
                {t('verifiedEpodTitle')}
              </h3>
              <p className="text-xs text-emerald-700 dark:text-emerald-400">
                {t('verifiedEpodSubtitle')}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono mb-4">
            <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-emerald-100 dark:border-emerald-900/40">
              <span className="text-slate-400 block font-sans text-[11px] mb-0.5">{t('receiverName')}:</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">{data.epodSignerName}</span>
              <span className="text-[10px] text-slate-400 block font-sans">({data.epodSignerRole})</span>
            </div>

            <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-emerald-100 dark:border-emerald-900/40">
              <span className="text-slate-400 block font-sans text-[11px] mb-0.5">{t('timestampLabel')}:</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">
                {data.epodSignedAt ? new Date(data.epodSignedAt).toLocaleString() : '-'}
              </span>
              {data.epodGpsLat && (
                <span className="text-[10px] text-slate-400 block">
                  GPS: {data.epodGpsLat}, {data.epodGpsLng}
                </span>
              )}
            </div>
          </div>

          {/* Forensic Hash */}
          <div className="p-3 bg-slate-900 text-slate-300 rounded-lg font-mono text-[11px] break-all">
            <span className="text-emerald-400 font-bold block mb-1 font-sans text-xs">
              {t('forensicHashLabel')} (HMAC-SHA256):
            </span>
            {data.epodHmacHash}
          </div>

          {/* Digital Signature preview if available */}
          {data.epodSignatureUrl && (
            <div className="mt-4 p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
              <span className="text-[11px] text-slate-400 font-semibold block mb-2">
                {t('digitalSignaturePreview')}:
              </span>
              <img
                src={data.epodSignatureUrl}
                alt="Consignment Signature"
                className="max-h-24 mx-auto object-contain"
              />
            </div>
          )}
        </div>
      )}

      {/* Documentation & Legal Invoice */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
        <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4">
          {t('documentsAndBillingTitle')}
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-100 dark:bg-blue-950/60 text-blue-600 rounded-lg">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                  {t('cmrDocLabel')}
                </span>
                <span className="text-[11px] text-slate-500 font-mono">
                  {data.cmrNumber || 'CMR-LTL-PENDING'}
                </span>
              </div>
            </div>
          </div>

          <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 rounded-lg">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                  {t('invoiceDocLabel')}
                </span>
                <span className="text-[11px] text-slate-500 font-mono">
                  {data.invoiceNumber || t('invoicePending')}
                </span>
              </div>
            </div>
            {data.totalAmount && (
              <span className="text-xs font-bold font-mono text-emerald-600">
                {data.totalAmount.toLocaleString()} {data.currency}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

