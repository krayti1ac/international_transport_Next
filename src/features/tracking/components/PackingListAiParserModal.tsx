'use client';

/**
 * Trans Bodanon TMS — AI Transport Order & Packing List Parser Modal
 * Multimodal document ingestion with Gemini AI extraction, LDM calculations, and one-click consignment import.
 */

import React, { useState, useRef, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import {
  X,
  Sparkles,
  UploadCloud,
  FileText,
  FileCheck,
  CheckCircle,
  AlertCircle,
  Loader2,
  Package,
  Layers,
  Thermometer,
  ShieldCheck,
  Building2,
  MapPin,
  Scale,
  DollarSign,
  Barcode,
  ArrowRight,
  RefreshCw,
  PlusCircle,
  CheckSquare,
  Square,
} from 'lucide-react';
import type { ExtractedConsignmentItem, PackingListParseResult } from '../types/consignment-ai-parser.types';
import type { PalletType, TripConsignment } from '../types/groupage-ltl.types';
import {
  parseShippingDocumentAction,
  batchCreateConsignmentsFromAiAction,
} from '../services/consignment-ai-parser.actions';
import { calculateConsignmentMetrics } from '../services/groupage-calculator.service';

interface PackingListAiParserModalProps {
  tripId: number;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (importedCount: number, consignments: TripConsignment[]) => void;
}

export function PackingListAiParserModal({
  tripId,
  isOpen,
  onClose,
  onSuccess,
}: PackingListAiParserModalProps) {
  const t = useTranslations('consignmentAiParser');
  const [isPending, startTransition] = useTransition();

  // File upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileBase64, setFileBase64] = useState<string | null>(null);
  const [targetCurrency, setTargetCurrency] = useState<'MAD' | 'EUR'>('MAD');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Parsing & results state
  const [parseResult, setParseResult] = useState<PackingListParseResult | null>(null);
  const [editableItems, setEditableItems] = useState<ExtractedConsignmentItem[]>([]);
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [parsingLogId, setParsingLogId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  // Process selected file to base64
  const handleFileSelect = (file: File) => {
    setSelectedFile(file);
    setErrorMsg(null);
    setSuccessMsg(null);
    setParseResult(null);
    setEditableItems([]);
    setSelectedItemIds(new Set());

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setFileBase64(result);
    };
    reader.onerror = () => {
      setErrorMsg(t('fileReadError'));
    };
    reader.readAsDataURL(file);
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => {
    setIsDragging(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  // Trigger AI parsing action
  const handleScanDocument = () => {
    if (!selectedFile || !fileBase64) {
      setErrorMsg(t('selectFileFirst'));
      return;
    }

    setErrorMsg(null);
    setSuccessMsg(null);

    let mimeType = selectedFile.type as any;
    if (!mimeType || mimeType === '') {
      if (selectedFile.name.endsWith('.pdf')) mimeType = 'application/pdf';
      else if (selectedFile.name.endsWith('.png')) mimeType = 'image/png';
      else if (selectedFile.name.endsWith('.jpg') || selectedFile.name.endsWith('.jpeg')) mimeType = 'image/jpeg';
      else mimeType = 'text/plain';
    }

    startTransition(async () => {
      const res = await parseShippingDocumentAction({
        base64Data: fileBase64,
        mimeType,
        fileName: selectedFile.name,
        fileSizeBytes: selectedFile.size,
        tripId,
        targetCurrency,
      });

      if (!res.success || !res.data) {
        setErrorMsg(res.error || t('parseFailed'));
        return;
      }

      setParseResult(res.data);
      setEditableItems(res.data.items);
      setSelectedItemIds(new Set(res.data.items.map((i) => i.id)));
      if (res.logId) setParsingLogId(res.logId);
    });
  };

  // Toggle item selection
  const toggleItemSelection = (id: string) => {
    const next = new Set(selectedItemIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedItemIds(next);
  };

  const toggleSelectAll = () => {
    if (selectedItemIds.size === editableItems.length) {
      setSelectedItemIds(new Set());
    } else {
      setSelectedItemIds(new Set(editableItems.map((i) => i.id)));
    }
  };

  // Modify item field inline and recompute metrics
  const handleItemFieldChange = (
    index: number,
    field: keyof ExtractedConsignmentItem,
    value: any
  ) => {
    const updated = [...editableItems];
    const item = { ...updated[index], [field]: value };

    // If pallet params changed, recompute metrics
    if (
      field === 'palletType' ||
      field === 'palletCount' ||
      field === 'isStackable' ||
      field === 'lengthCm' ||
      field === 'widthCm' ||
      field === 'heightCm' ||
      field === 'grossWeightKg'
    ) {
      item.calculatedMetrics = calculateConsignmentMetrics({
        palletType: item.palletType,
        palletCount: item.palletCount,
        isStackable: item.isStackable,
        lengthCm: item.lengthCm,
        widthCm: item.widthCm,
        heightCm: item.heightCm,
        grossWeightKg: item.grossWeightKg,
      });
    }

    updated[index] = item;
    setEditableItems(updated);
  };

  // Batch import consignments
  const handleBatchImport = () => {
    const itemsToImport = editableItems.filter((i) => selectedItemIds.has(i.id));
    if (itemsToImport.length === 0) {
      setErrorMsg(t('noItemsSelected'));
      return;
    }

    setErrorMsg(null);
    startTransition(async () => {
      const res = await batchCreateConsignmentsFromAiAction({
        tripId,
        items: itemsToImport.map((i) => ({
          clientName: i.clientName,
          clientId: i.clientId,
          senderName: i.senderName,
          senderAddress: i.senderAddress,
          receiverName: i.receiverName,
          receiverAddress: i.receiverAddress,
          loadingCity: i.loadingCity,
          loadingCountry: i.loadingCountry,
          deliveryCity: i.deliveryCity,
          deliveryCountry: i.deliveryCountry,
          cargoDescription: i.cargoDescription,
          hsCode: i.hsCode,
          isTemperatureControlled: i.isTemperatureControlled,
          targetTemperatureC: i.targetTemperatureC,
          palletCount: i.palletCount,
          palletType: i.palletType,
          isStackable: i.isStackable,
          lengthCm: i.lengthCm,
          widthCm: i.widthCm,
          heightCm: i.heightCm,
          grossWeightKg: i.grossWeightKg,
          freightPrice: i.freightPrice,
          currency: i.currency,
          customsMrn: i.customsMrn,
          sourceDocumentName: selectedFile?.name || null,
          notes: i.notes,
        })),
        sourceDocumentName: selectedFile?.name || null,
        parsingLogId,
      });

      if (!res.success) {
        setErrorMsg(res.error || t('batchImportError'));
        return;
      }

      setSuccessMsg(t('importSuccess', { count: res.count }));
      setTimeout(() => {
        onSuccess(res.count, res.createdConsignments);
        onClose();
      }, 1200);
    });
  };

  const selectedCount = selectedItemIds.size;
  const totalPalletsSelected = editableItems
    .filter((i) => selectedItemIds.has(i.id))
    .reduce((sum, i) => sum + i.palletCount, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-violet-600/10 text-violet-600 dark:bg-violet-500/20 dark:text-violet-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  {t('title')}
                </h3>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-violet-100 text-violet-800 dark:bg-violet-950/70 dark:text-violet-300 border border-violet-200 dark:border-violet-800">
                  Gemini 2.5 Flash
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t('subtitle', { tripId })}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isPending}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Error & Success Alerts */}
          {errorMsg && (
            <div className="flex items-center gap-2 p-3 text-sm text-rose-700 bg-rose-50 dark:bg-rose-950/40 dark:text-rose-300 rounded-xl border border-rose-200 dark:border-rose-900">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="flex items-center gap-2 p-3 text-sm text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-300 rounded-xl border border-emerald-200 dark:border-emerald-900">
              <CheckCircle className="w-4 h-4 shrink-0" />
              <span className="font-semibold">{successMsg}</span>
            </div>
          )}

          {/* Section 1: File Ingestion Dropzone */}
          {!parseResult && (
            <div className="space-y-4">
              <div
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`relative border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition ${
                  isDragging
                    ? 'border-violet-500 bg-violet-50/50 dark:bg-violet-950/20'
                    : selectedFile
                    ? 'border-emerald-500/60 bg-emerald-50/30 dark:bg-emerald-950/20'
                    : 'border-slate-300 dark:border-slate-700 hover:border-violet-400 dark:hover:border-violet-500 bg-slate-50/50 dark:bg-slate-800/30'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,image/png,image/jpeg,image/webp,.txt"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleFileSelect(e.target.files[0]);
                    }
                  }}
                />

                {selectedFile ? (
                  <div className="space-y-2">
                    <div className="w-12 h-12 mx-auto rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400 flex items-center justify-center">
                      <FileCheck className="w-6 h-6" />
                    </div>
                    <div className="font-semibold text-slate-800 dark:text-slate-100">
                      {selectedFile.name}
                    </div>
                    <div className="text-xs text-slate-500">
                      {(selectedFile.size / 1024).toFixed(1)} KB — {t('clickToChange')}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="w-12 h-12 mx-auto rounded-full bg-violet-100 text-violet-600 dark:bg-violet-950/50 dark:text-violet-400 flex items-center justify-center">
                      <UploadCloud className="w-6 h-6" />
                    </div>
                    <div>
                      <span className="font-semibold text-violet-600 dark:text-violet-400 hover:underline">
                        {t('browseFiles')}
                      </span>{' '}
                      <span className="text-slate-500 dark:text-slate-400">{t('dragDropHint')}</span>
                    </div>
                    <p className="text-xs text-slate-400 dark:text-slate-500">
                      PDF, PNG, JPG, WEBP (Max 20MB) — Packing List, CMR, Facture Proforma, DUM
                    </p>
                  </div>
                )}
              </div>

              {/* Currency & Scan Options */}
              <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                    {t('currencyLabel')}:
                  </label>
                  <select
                    value={targetCurrency}
                    onChange={(e) => setTargetCurrency(e.target.value as 'MAD' | 'EUR')}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                  >
                    <option value="MAD">MAD (Dirham Marocain)</option>
                    <option value="EUR">EUR (Euro)</option>
                  </select>
                </div>

                <button
                  type="button"
                  onClick={handleScanDocument}
                  disabled={!selectedFile || isPending}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-xs text-white bg-violet-600 hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-violet-500/20 transition"
                >
                  {isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>{t('analyzingDocument')}</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>{t('startAiScan')}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Section 2: AI Parsing Results & Consignments Grid */}
          {parseResult && (
            <div className="space-y-5">
              {/* Summary Stats Banner */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-violet-50 to-indigo-50 dark:from-slate-800 dark:to-slate-800/80 border border-violet-200 dark:border-slate-700">
                <div className="flex flex-wrap items-center justify-between gap-4 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-lg text-xs font-bold uppercase bg-violet-600 text-white">
                      {parseResult.documentType.replace('_', ' ')}
                    </span>
                    <span className="text-xs text-slate-600 dark:text-slate-300 font-medium">
                      {parseResult.rawSummary}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                      <ShieldCheck className="w-4 h-4" />
                      {parseResult.confidenceScore}% {t('confidence')}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setParseResult(null);
                        setEditableItems([]);
                        setSelectedItemIds(new Set());
                      }}
                      className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      {t('scanAnother')}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-violet-200/60 dark:border-slate-700/60 text-xs">
                  <div>
                    <span className="text-slate-500">{t('itemsFound')}:</span>
                    <span className="font-bold text-slate-900 dark:text-white ms-1">
                      {editableItems.length}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500">{t('totalPallets')}:</span>
                    <span className="font-bold text-slate-900 dark:text-white ms-1">
                      {parseResult.totalPalletsExtracted}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500">{t('totalLdm')}:</span>
                    <span className="font-bold text-indigo-600 dark:text-indigo-400 ms-1">
                      {parseResult.totalLdmExtracted} LDM
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500">{t('totalWeight')}:</span>
                    <span className="font-bold text-slate-900 dark:text-white ms-1">
                      {parseResult.totalWeightKgExtracted.toLocaleString()} kg
                    </span>
                  </div>
                </div>
              </div>

              {/* Selection Bar */}
              <div className="flex items-center justify-between px-1 text-xs font-semibold">
                <button
                  type="button"
                  onClick={toggleSelectAll}
                  className="flex items-center gap-2 text-violet-600 dark:text-violet-400 hover:underline"
                >
                  {selectedItemIds.size === editableItems.length ? (
                    <CheckSquare className="w-4 h-4" />
                  ) : (
                    <Square className="w-4 h-4" />
                  )}
                  <span>
                    {selectedItemIds.size === editableItems.length
                      ? t('deselectAll')
                      : t('selectAll')}
                  </span>
                </button>
                <span className="text-slate-500">
                  {t('selectedSummary', {
                    count: selectedCount,
                    total: editableItems.length,
                    pallets: totalPalletsSelected,
                  })}
                </span>
              </div>

              {/* Consignments List */}
              <div className="space-y-3">
                {editableItems.map((item, index) => {
                  const isSelected = selectedItemIds.has(item.id);
                  return (
                    <div
                      key={item.id}
                      className={`p-4 rounded-xl border transition ${
                        isSelected
                          ? 'border-violet-400/80 bg-violet-50/20 dark:bg-violet-950/10 dark:border-violet-800'
                          : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/60 opacity-60'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <button
                          type="button"
                          onClick={() => toggleItemSelection(item.id)}
                          className="mt-1 text-violet-600 dark:text-violet-400"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-5 h-5" />
                          ) : (
                            <Square className="w-5 h-5 text-slate-400" />
                          )}
                        </button>

                        <div className="flex-1 space-y-3">
                          {/* Row 1: Client & Cargo Description */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="text-[11px] font-semibold text-slate-500">
                                {t('clientLabel')}
                              </label>
                              <input
                                type="text"
                                value={item.clientName}
                                onChange={(e) =>
                                  handleItemFieldChange(index, 'clientName', e.target.value)
                                }
                                className="w-full px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100"
                              />
                            </div>
                            <div>
                              <label className="text-[11px] font-semibold text-slate-500">
                                {t('cargoDescLabel')}
                              </label>
                              <input
                                type="text"
                                value={item.cargoDescription}
                                onChange={(e) =>
                                  handleItemFieldChange(index, 'cargoDescription', e.target.value)
                                }
                                className="w-full px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100"
                              />
                            </div>
                          </div>

                          {/* Row 2: Route & HS Code */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                            <div>
                              <label className="text-[10px] text-slate-500">{t('originCity')}</label>
                              <input
                                type="text"
                                value={item.loadingCity}
                                onChange={(e) =>
                                  handleItemFieldChange(index, 'loadingCity', e.target.value)
                                }
                                className="w-full px-2 py-1 text-xs rounded-md bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] text-slate-500">{t('destCity')}</label>
                              <input
                                type="text"
                                value={item.deliveryCity}
                                onChange={(e) =>
                                  handleItemFieldChange(index, 'deliveryCity', e.target.value)
                                }
                                className="w-full px-2 py-1 text-xs rounded-md bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] text-slate-500">{t('hsCode')}</label>
                              <input
                                type="text"
                                value={item.hsCode || ''}
                                placeholder="e.g. 0702.00"
                                onChange={(e) =>
                                  handleItemFieldChange(index, 'hsCode', e.target.value)
                                }
                                className="w-full px-2 py-1 text-xs font-mono rounded-md bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] text-slate-500">{t('weightKg')}</label>
                              <input
                                type="number"
                                value={item.grossWeightKg}
                                onChange={(e) =>
                                  handleItemFieldChange(
                                    index,
                                    'grossWeightKg',
                                    Number(e.target.value)
                                  )
                                }
                                className="w-full px-2 py-1 text-xs rounded-md bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
                              />
                            </div>
                          </div>

                          {/* Row 3: Pallet Metrics & Badges */}
                          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                            <div className="flex flex-wrap items-center gap-2">
                              {/* Pallets Count & Type */}
                              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md">
                                <Package className="w-3.5 h-3.5 text-slate-500" />
                                <span className="font-bold text-slate-700 dark:text-slate-300">
                                  {item.palletCount}
                                </span>
                                <select
                                  value={item.palletType}
                                  onChange={(e) =>
                                    handleItemFieldChange(
                                      index,
                                      'palletType',
                                      e.target.value as PalletType
                                    )
                                  }
                                  className="text-[11px] bg-transparent border-0 text-slate-600 dark:text-slate-400 font-medium cursor-pointer"
                                >
                                  <option value="euro">Euro (0.4 LDM)</option>
                                  <option value="industrial">Indus (0.5 LDM)</option>
                                  <option value="custom">Custom</option>
                                  <option value="bulk">Bulk</option>
                                </select>
                              </div>

                              {/* LDM Badge */}
                              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
                                {item.calculatedMetrics.ldmMeters} LDM
                              </span>

                              {/* Stackable Toggle */}
                              <button
                                type="button"
                                onClick={() =>
                                  handleItemFieldChange(index, 'isStackable', !item.isStackable)
                                }
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold transition ${
                                  item.isStackable
                                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                                    : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                                }`}
                              >
                                <Layers className="w-3 h-3" />
                                {item.isStackable ? t('stackable') : t('nonStackable')}
                              </button>

                              {/* Refrigerated / Temp Indicator */}
                              <button
                                type="button"
                                onClick={() =>
                                  handleItemFieldChange(
                                    index,
                                    'isTemperatureControlled',
                                    !item.isTemperatureControlled
                                  )
                                }
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold transition ${
                                  item.isTemperatureControlled
                                    ? 'bg-cyan-100 text-cyan-800 dark:bg-cyan-950/60 dark:text-cyan-300'
                                    : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                                }`}
                              >
                                <Thermometer className="w-3 h-3" />
                                {item.isTemperatureControlled
                                  ? `${item.targetTemperatureC ?? 4}°C`
                                  : t('ambientTemp')}
                              </button>
                            </div>

                            {/* Agreed Price */}
                            <div className="flex items-center gap-1">
                              <label className="text-[10px] text-slate-500">{t('priceLabel')}:</label>
                              <input
                                type="number"
                                value={item.freightPrice}
                                onChange={(e) =>
                                  handleItemFieldChange(
                                    index,
                                    'freightPrice',
                                    Number(e.target.value)
                                  )
                                }
                                className="w-20 px-2 py-0.5 text-xs font-semibold rounded bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
                              />
                              <span className="text-[11px] font-bold text-slate-500">
                                {item.currency}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition"
          >
            {t('cancel')}
          </button>

          {parseResult && (
            <button
              type="button"
              onClick={handleBatchImport}
              disabled={isPending || selectedCount === 0}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-xs text-white bg-violet-600 hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-violet-500/25 transition"
            >
              {isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{t('importingConsignments')}</span>
                </>
              ) : (
                <>
                  <PlusCircle className="w-4 h-4" />
                  <span>{t('importSelectedBtn', { count: selectedCount })}</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

