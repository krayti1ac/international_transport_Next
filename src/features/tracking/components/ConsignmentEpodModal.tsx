'use client';

/**
 * Trans Bodanon TMS — Consignment e-POD Signature Modal
 * Digital signature canvas, GPS capture, and instant invoice trigger for individual drops.
 */

import React, { useState, useRef, useEffect, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import {
  X,
  PenTool,
  CheckCircle,
  MapPin,
  Trash2,
  FileText,
  Loader2,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react';
import type { TripConsignment } from '../types/groupage-ltl.types';
import { submitConsignmentEpodAction } from '../services/consignment-epod.actions';

interface ConsignmentEpodModalProps {
  consignment: TripConsignment;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (result: { consignmentId: string; invoiceNumber?: string | null }) => void;
}

export function ConsignmentEpodModal({
  consignment,
  isOpen,
  onClose,
  onSuccess,
}: ConsignmentEpodModalProps) {
  const t = useTranslations('consignmentEpod');
  const [isPending, startTransition] = useTransition();

  const [signerName, setSignerName] = useState('');
  const [signerRole, setSignerRole] = useState('Chef de Réception / Quai');
  const [triggerInstantInvoice, setTriggerInstantInvoice] = useState(true);
  const [gpsCoordinates, setGpsCoordinates] = useState<{ lat?: number; lng?: number } | null>(null);
  const [isGettingGps, setIsGettingGps] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [hasSignature, setHasSignature] = useState(false);
  const isDrawing = useRef(false);

  // Initialize canvas
  useEffect(() => {
    if (!isOpen) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;
    ctx.scale(ratio, ratio);
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Auto-fetch GPS
    if (navigator.geolocation) {
      setIsGettingGps(true);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setGpsCoordinates({
            lat: Number(pos.coords.latitude.toFixed(6)),
            lng: Number(pos.coords.longitude.toFixed(6)),
          });
          setIsGettingGps(false);
        },
        () => setIsGettingGps(false),
        { enableHighAccuracy: true, timeout: 6000 }
      );
    }
  }, [isOpen]);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    isDrawing.current = true;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    ctx.beginPath();
    ctx.moveTo(clientX - rect.left, clientY - rect.top);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    ctx.lineTo(clientX - rect.left, clientY - rect.top);
    ctx.stroke();
    setHasSignature(true);
  };

  const stopDrawing = () => {
    isDrawing.current = false;
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  const handleSubmit = () => {
    if (!signerName.trim()) {
      setErrorMsg(t('errorSignerNameRequired'));
      return;
    }

    if (!hasSignature || !canvasRef.current) {
      setErrorMsg(t('errorSignatureRequired'));
      return;
    }

    setErrorMsg(null);
    const signatureBase64 = canvasRef.current.toDataURL('image/png');

    startTransition(async () => {
      const res = await submitConsignmentEpodAction({
        consignmentId: consignment.id,
        tripId: consignment.tripId,
        signerName,
        signerRole,
        signatureBase64,
        gpsLat: gpsCoordinates?.lat,
        gpsLng: gpsCoordinates?.lng,
        triggerInstantInvoice,
      });

      if (res.success && res.data) {
        onSuccess({
          consignmentId: consignment.id,
          invoiceNumber: res.data.invoiceNumber,
        });
        onClose();
      } else {
        setErrorMsg(res.error || t('epodSubmitFailed'));
      }
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 relative">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 end-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-2 mb-4">
          <div className="p-2 bg-blue-50 dark:bg-blue-950/40 text-blue-600 rounded-xl">
            <PenTool className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              {t('modalTitle')}
            </h3>
            <p className="text-xs text-slate-500 font-mono">
              {consignment.consignmentReference} — {consignment.clientName}
            </p>
          </div>
        </div>

        {errorMsg && (
          <div className="mb-4 p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 rounded-lg text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Consignment summary pill */}
        <div className="mb-4 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800 text-xs grid grid-cols-2 gap-2">
          <div>
            <span className="text-slate-400 block">{t('destinationLabel')}:</span>
            <span className="font-semibold text-slate-700 dark:text-slate-200">
              {consignment.deliveryCity} ({consignment.deliveryCountry})
            </span>
          </div>
          <div>
            <span className="text-slate-400 block">{t('cargoSpecsLabel')}:</span>
            <span className="font-semibold text-slate-700 dark:text-slate-200">
              {consignment.palletCount} {t('pallets')} ({consignment.grossWeightKg.toLocaleString()} kg)
            </span>
          </div>
        </div>

        {/* Signer inputs */}
        <div className="space-y-3 mb-4">
          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
              {t('signerNameLabel')} *
            </label>
            <input
              type="text"
              value={signerName}
              onChange={(e) => setSignerName(e.target.value)}
              placeholder={t('signerNamePlaceholder')}
              className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
              {t('signerRoleLabel')}
            </label>
            <input
              type="text"
              value={signerRole}
              onChange={(e) => setSignerRole(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg"
            />
          </div>
        </div>

        {/* Signature Canvas */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              {t('signaturePadLabel')} *
            </label>
            <button
              type="button"
              onClick={clearCanvas}
              className="text-[11px] text-slate-500 hover:text-rose-600 flex items-center gap-1"
            >
              <Trash2 className="w-3 h-3" />
              {t('clearSignatureBtn')}
            </button>
          </div>

          <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl overflow-hidden bg-slate-50/50 dark:bg-slate-950/30 touch-none">
            <canvas
              ref={canvasRef}
              className="w-full h-36 cursor-crosshair"
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
            />
          </div>
        </div>

        {/* GPS Coordinate & Instant Invoice Options */}
        <div className="space-y-2 mb-5">
          <div className="flex items-center justify-between text-xs p-2 bg-slate-50 dark:bg-slate-800/40 rounded-lg">
            <span className="text-slate-500 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-blue-500" />
              {t('gpsLocationLabel')}:
            </span>
            <span className="font-mono text-slate-700 dark:text-slate-300">
              {isGettingGps ? (
                t('fetchingGps')
              ) : gpsCoordinates?.lat ? (
                `${gpsCoordinates.lat}, ${gpsCoordinates.lng}`
              ) : (
                t('noGpsRecorded')
              )}
            </span>
          </div>

          <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={triggerInstantInvoice}
              onChange={(e) => setTriggerInstantInvoice(e.target.checked)}
              className="rounded text-emerald-600 focus:ring-emerald-500"
            />
            <span className="flex items-center gap-1">
              <FileText className="w-3.5 h-3.5 text-emerald-500" />
              {t('instantInvoiceCheck')}
            </span>
          </label>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all"
          >
            {t('cancelBtn')}
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isPending || !hasSignature}
            className="flex items-center gap-1.5 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white text-xs font-bold rounded-lg shadow-sm transition-all"
          >
            {isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <ShieldCheck className="w-4 h-4" />
            )}
            {t('confirmAndSignEpodBtn')}
          </button>
        </div>
      </div>
    </div>
  );
}

