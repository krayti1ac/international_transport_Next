'use client';

/**
 * Trans Bodanon TMS — New LTL Consignment Modal
 * Supports Euro/Industrial pallets, LDM live preview, stacking, and temperature control.
 */

import React, { useState, useTransition, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useLanguage } from '@/components/language-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  RefreshCw,
  Building,
} from 'lucide-react';
import type { PalletType, TripConsignment } from '../types/groupage-ltl.types';
import { calculateConsignmentMetrics } from '../services/groupage-calculator.service';
import { createLtlConsignmentAction } from '../services/groupage-consignment.actions';

interface NewConsignmentModalProps {
  tripId: number;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (consignment: TripConsignment) => void;
}

export function NewConsignmentModal({
  tripId,
  isOpen,
  onClose,
  onSuccess,
}: NewConsignmentModalProps) {
  const t = useTranslations('groupageLtl');
  const tCommon = useTranslations('common');
  const { dir } = useLanguage();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  // Form State
  const [clientName, setClientName] = useState<string>('Maroc Primeurs Export S.A.');
  const [loadingCity, setLoadingCity] = useState<string>('Tanger Med');
  const [deliveryCity, setDeliveryCity] = useState<string>('Mercamadrid');
  const [cargoDescription, setCargoDescription] = useState<string>('Framboises & Myrtilles Frigo (+3°C)');
  const [isTemperatureControlled, setIsTemperatureControlled] = useState<boolean>(true);
  const [targetTempC, setTargetTempC] = useState<number>(3.0);
  const [palletCount, setPalletCount] = useState<number>(4);
  const [palletType, setPalletType] = useState<PalletType>('euro');
  const [isStackable, setIsStackable] = useState<boolean>(false);
  const [grossWeightKg, setGrossWeightKg] = useState<number>(1800);
  const [freightPrice, setFreightPrice] = useState<number>(4500);
  const [customsMrn, setCustomsMrn] = useState<string>('26MA0019488392M8');
  const [notes, setNotes] = useState<string>('');

  // Live Metric Calculation
  const metrics = useMemo(() => {
    return calculateConsignmentMetrics({
      palletType,
      palletCount,
      isStackable,
      grossWeightKg,
    });
  }, [palletType, palletCount, isStackable, grossWeightKg]);

  if (!isOpen) return null;

  const handleSubmit = () => {
    if (!clientName.trim() || !cargoDescription.trim()) {
      toast({
        title: tCommon('error'),
        description: t('errorClientAndCargoRequired'),
        variant: 'destructive',
      });
      return;
    }

    startTransition(async () => {
      const res = await createLtlConsignmentAction({
        tripId,
        clientName,
        loadingCity,
        loadingCountry: 'MA',
        deliveryCity,
        deliveryCountry: 'ES',
        cargoDescription,
        isTemperatureControlled,
        targetTemperatureC: isTemperatureControlled ? targetTempC : undefined,
        palletCount,
        palletType,
        isStackable,
        grossWeightKg,
        freightPrice,
        currency: 'MAD',
        customsMrn: customsMrn || undefined,
        notes: notes || undefined,
      });

      if (res.success && res.data) {
        toast({
          title: t('consignmentCreatedTitle'),
          description: t('consignmentCreatedDesc'),
        });
        if (onSuccess) onSuccess(res.data);
        onClose();
      } else {
        toast({
          title: tCommon('error'),
          description: res.error || t('consignmentCreateFailed'),
          variant: 'destructive',
        });
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div
        dir={dir}
        className="bg-background border rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <Boxes className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-foreground">{t('newConsignmentTitle')}</h3>
              <p className="text-xs text-muted-foreground">{t('newConsignmentSubtitle')}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0 rounded-full"
          >
            ✕
          </Button>
        </div>

        {/* Inputs */}
        <div className="space-y-3 text-xs">
          <div>
            <label className="font-medium block mb-1 flex items-center gap-1.5">
              <Building className="h-3.5 w-3.5 text-muted-foreground" />
              {t('clientNameLabel')}
            </label>
            <Input
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              className="text-xs"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-medium block mb-1 flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                {t('loadingCityLabel')}
              </label>
              <Input
                value={loadingCity}
                onChange={(e) => setLoadingCity(e.target.value)}
                className="text-xs"
              />
            </div>
            <div>
              <label className="font-medium block mb-1 flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                {t('deliveryCityLabel')}
              </label>
              <Input
                value={deliveryCity}
                onChange={(e) => setDeliveryCity(e.target.value)}
                className="text-xs"
              />
            </div>
          </div>

          <div>
            <label className="font-medium block mb-1">{t('cargoDescriptionLabel')}</label>
            <Input
              value={cargoDescription}
              onChange={(e) => setCargoDescription(e.target.value)}
              className="text-xs"
            />
          </div>

          {/* Temperature Controls */}
          <div className="p-3 rounded-lg border bg-muted/10 flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isTemperatureControlled}
                onChange={(e) => setIsTemperatureControlled(e.target.checked)}
                className="rounded border-input text-primary"
              />
              <span className="font-medium flex items-center gap-1">
                <Thermometer className="h-3.5 w-3.5 text-blue-500" />
                {t('tempControlledCheck')}
              </span>
            </label>
            {isTemperatureControlled && (
              <div className="flex items-center gap-1.5 font-mono">
                <Input
                  type="number"
                  step="0.5"
                  value={targetTempC}
                  onChange={(e) => setTargetTempC(Number(e.target.value))}
                  className="w-20 text-xs h-7 font-bold text-center"
                />
                <span className="text-muted-foreground">°C</span>
              </div>
            )}
          </div>

          {/* Pallets & LDM Parameters */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="font-medium block mb-1">{t('palletCountLabel')}</label>
              <Input
                type="number"
                min="1"
                max="34"
                value={palletCount}
                onChange={(e) => setPalletCount(Number(e.target.value))}
                className="text-xs font-mono"
              />
            </div>
            <div>
              <label className="font-medium block mb-1">{t('palletTypeLabel')}</label>
              <select
                value={palletType}
                onChange={(e) => setPalletType(e.target.value as PalletType)}
                className="w-full p-2 border rounded-lg bg-background text-xs"
              >
                <option value="euro">Euro (0.4 LDM)</option>
                <option value="industrial">Indus (0.5 LDM)</option>
                <option value="custom">Custom</option>
              </select>
            </div>
            <div>
              <label className="font-medium block mb-1">{t('grossWeightLabel')} (kg)</label>
              <Input
                type="number"
                min="0"
                value={grossWeightKg}
                onChange={(e) => setGrossWeightKg(Number(e.target.value))}
                className="text-xs font-mono"
              />
            </div>
          </div>

          {/* Stackable Toggle */}
          <div className="flex items-center justify-between p-2.5 rounded-lg border bg-muted/10">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isStackable}
                onChange={(e) => setIsStackable(e.target.checked)}
                className="rounded border-input text-primary"
              />
              <span className="font-medium flex items-center gap-1">
                <Layers className="h-3.5 w-3.5 text-amber-500" />
                {t('isStackableCheck')}
              </span>
            </label>
            <Badge variant="outline" className="text-[10px]">
              {isStackable ? t('stackableBadge') : t('nonStackableBadge')}
            </Badge>
          </div>

          {/* Real-time Metrics Preview */}
          <div className="p-3.5 rounded-xl border bg-primary/5 space-y-1.5 font-mono text-xs">
            <div className="flex justify-between">
              <span className="font-sans text-muted-foreground">{t('calculatedLdm')}:</span>
              <span className="font-bold text-primary text-sm">{metrics.ldmMeters} LDM</span>
            </div>
            <div className="flex justify-between">
              <span className="font-sans text-muted-foreground">{t('calculatedVolume')}:</span>
              <span>{metrics.volumeM3} m³</span>
            </div>
            <div className="flex justify-between">
              <span className="font-sans text-muted-foreground">{t('chargeableWeight')}:</span>
              <span className="font-bold">{metrics.chargeableWeightKg.toLocaleString()} kg</span>
            </div>
          </div>

          {/* Price & Customs */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-medium block mb-1 flex items-center gap-1.5">
                <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
                {t('freightPriceLabel')} (MAD)
              </label>
              <Input
                type="number"
                value={freightPrice}
                onChange={(e) => setFreightPrice(Number(e.target.value))}
                className="text-xs font-mono"
              />
            </div>
            <div>
              <label className="font-medium block mb-1 flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                {t('customsMrnLabel')}
              </label>
              <Input
                value={customsMrn}
                onChange={(e) => setCustomsMrn(e.target.value)}
                placeholder="26MA..."
                className="text-xs font-mono"
              />
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="pt-3 flex items-center justify-end gap-2 border-t">
          <Button variant="outline" size="sm" onClick={onClose} className="text-xs">
            {tCommon('cancel')}
          </Button>
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={isPending}
            className="text-xs gap-1.5"
          >
            {isPending ? (
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Plus className="h-3.5 w-3.5" />
            )}
            {t('createConsignmentBtn')}
          </Button>
        </div>
      </div>
    </div>
  );
}

