'use client';

/**
 * Trans Bodanon TMS — Insurance Dossier & e-POD Dispatch Modal
 * Multi-Channel Dispatch Gateway: WhatsApp Cloud API & SMTP Email
 * Standards: ATP Treaty / INCOTERMS 2020 / EU GDP Guidelines (2013/C 343/01)
 */

import React, { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { useLanguage } from '@/components/language-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  Send,
  Mail,
  MessageSquare,
  ShieldCheck,
  ShieldAlert,
  Copy,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  RefreshCw,
  FileText,
  Building,
  User,
  Clock,
  Sparkles,
} from 'lucide-react';
import type { ReeferCargoInsuranceClaim } from '../types/reefer-claim-settlement.types';
import {
  type InsurerCompany,
  type InsuranceDispatchChannel,
  type InsuranceDispatchResult,
  INSURER_PARTNER_PRESETS,
} from '../types/insurance-dispatch.types';
import { dispatchInsuranceClaimAction } from '../services/insurance-dispatch.actions';

interface InsuranceDossierDispatchModalProps {
  claim: ReeferCargoInsuranceClaim;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (result: InsuranceDispatchResult) => void;
}

export function InsuranceDossierDispatchModal({
  claim,
  isOpen,
  onClose,
  onSuccess,
}: InsuranceDossierDispatchModalProps) {
  const t = useTranslations('insuranceDispatch');
  const tCommon = useTranslations('common');
  const { locale, dir } = useLanguage();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  // Selected Insurer
  const [insurerCompany, setInsurerCompany] = useState<InsurerCompany>('allianz');
  const [adjusterName, setAdjusterName] = useState<string>('Gestionnaire Sinistres Fret');
  const [recipientEmail, setRecipientEmail] = useState<string>(
    INSURER_PARTNER_PRESETS.allianz.defaultEmail
  );
  const [recipientPhone, setRecipientPhone] = useState<string>(
    INSURER_PARTNER_PRESETS.allianz.defaultPhone
  );
  const [channel, setChannel] = useState<InsuranceDispatchChannel>('both');
  const [includeEpodAnnex, setIncludeEpodAnnex] = useState<boolean>(true);
  const [includeMktSummary, setIncludeMktSummary] = useState<boolean>(true);
  const [forceBypassCooldown, setForceBypassCooldown] = useState<boolean>(false);
  const [notes, setNotes] = useState<string>('');

  // Result state
  const [dispatchResult, setDispatchResult] = useState<InsuranceDispatchResult | null>(null);

  if (!isOpen) return null;

  const handleInsurerChange = (newCompany: InsurerCompany) => {
    setInsurerCompany(newCompany);
    const preset = INSURER_PARTNER_PRESETS[newCompany];
    if (preset) {
      setRecipientEmail(preset.defaultEmail);
      setRecipientPhone(preset.defaultPhone);
    }
  };

  const handleDispatch = () => {
    if (!adjusterName.trim()) {
      toast({
        title: tCommon('error'),
        description: t('errorAdjusterRequired'),
        variant: 'destructive',
      });
      return;
    }

    if ((channel === 'email' || channel === 'both') && !recipientEmail.trim()) {
      toast({
        title: tCommon('error'),
        description: t('errorEmailRequired'),
        variant: 'destructive',
      });
      return;
    }

    if ((channel === 'whatsapp' || channel === 'both') && !recipientPhone.trim()) {
      toast({
        title: tCommon('error'),
        description: t('errorPhoneRequired'),
        variant: 'destructive',
      });
      return;
    }

    startTransition(async () => {
      const res = await dispatchInsuranceClaimAction({
        claimReference: claim.claimReference,
        tripId: claim.tripId,
        tripNumber: claim.tripNumber,
        truckPlate: claim.truckPlate,
        driverName: claim.driverName,
        cargoCategory: claim.cargoCategory,
        annexId: claim.annexId,
        insuredCargoValue: claim.insuredCargoValue,
        grossLossAmount: claim.grossLossAmount,
        deductibleAmount: claim.deductibleAmount,
        netIndemnityAmount: claim.netIndemnityAmount,
        currency: claim.currency,
        policyNumber: claim.policyNumber,
        insurerCompany,
        adjusterName,
        channel,
        recipientEmail,
        recipientPhone,
        includeEpodAnnex,
        includeMktSummary,
        forceBypassCooldown,
        notes: notes || undefined,
        locale: (locale as 'ar' | 'fr' | 'es') || 'fr',
      });

      if (res.success && res.data) {
        setDispatchResult(res.data);
        toast({
          title: t('dispatchSuccessTitle'),
          description: t('dispatchSuccessDesc'),
        });
        if (onSuccess) onSuccess(res.data);
      } else {
        toast({
          title: tCommon('error'),
          description: res.error || t('dispatchFailedDesc'),
          variant: 'destructive',
        });
      }
    });
  };

  const copyToClipboard = (text: string, msg: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: tCommon('success'),
      description: msg,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div
        dir={dir}
        className="bg-background border rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-5 max-h-[92vh] overflow-y-auto transition-all"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <Send className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-base md:text-lg text-foreground flex items-center gap-2">
                {t('modalTitle')}
                <Badge variant="outline" className="font-mono text-xs">
                  {claim.claimReference}
                </Badge>
              </h3>
              <p className="text-xs text-muted-foreground">{t('modalSubtitle')}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0 rounded-full hover:bg-muted"
          >
            ✕
          </Button>
        </div>

        {/* Claim Summary Card */}
        <div className="p-3.5 rounded-xl border bg-muted/20 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          <div>
            <span className="text-muted-foreground block text-[11px]">{t('tripLabel')}</span>
            <span className="font-semibold text-foreground">{claim.tripNumber}</span>
          </div>
          <div>
            <span className="text-muted-foreground block text-[11px]">{t('truckPlateLabel')}</span>
            <span className="font-semibold text-foreground">{claim.truckPlate}</span>
          </div>
          <div>
            <span className="text-muted-foreground block text-[11px]">{t('netClaimLabel')}</span>
            <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono">
              {claim.netIndemnityAmount.toLocaleString()} {claim.currency}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground block text-[11px]">{t('epodAnnexLabel')}</span>
            <span className="font-mono text-primary font-medium">
              {claim.annexId || t('noAnnex')}
            </span>
          </div>
        </div>

        {/* Dispatch Result State */}
        {dispatchResult ? (
          <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 space-y-4">
            <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-bold text-sm">
              <CheckCircle2 className="h-5 w-5" />
              <span>{t('dispatchCompletedTitle')}</span>
            </div>

            <div className="space-y-2 text-xs">
              {dispatchResult.whatsapp && (
                <div className="flex items-center justify-between p-2 rounded bg-background/80 border">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-emerald-600" />
                    <span>WhatsApp ({dispatchResult.whatsapp.recipient}):</span>
                  </div>
                  <Badge
                    variant={dispatchResult.whatsapp.success ? 'default' : 'destructive'}
                    className="text-[10px]"
                  >
                    {dispatchResult.whatsapp.success ? t('sentSuccessBadge') : t('failedBadge')}
                  </Badge>
                </div>
              )}

              {dispatchResult.email && (
                <div className="flex items-center justify-between p-2 rounded bg-background/80 border">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-blue-600" />
                    <span>Email ({dispatchResult.email.recipient}):</span>
                  </div>
                  <Badge
                    variant={dispatchResult.email.success ? 'default' : 'destructive'}
                    className="text-[10px]"
                  >
                    {dispatchResult.email.success ? t('sentSuccessBadge') : t('failedBadge')}
                  </Badge>
                </div>
              )}

              {/* Cryptographic Seal & Link */}
              <div className="p-2.5 rounded bg-background/80 border space-y-1.5 font-mono text-[11px]">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground font-sans">{t('dossierSealLabel')}:</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      copyToClipboard(dispatchResult.dossierSeal, t('sealCopiedMsg'))
                    }
                    className="h-6 px-2 text-[10px] gap-1"
                  >
                    <Copy className="h-3 w-3" />
                    {t('copyBtn')}
                  </Button>
                </div>
                <div className="text-[10px] text-muted-foreground truncate">
                  {dispatchResult.dossierSeal}
                </div>
              </div>

              {dispatchResult.dossierVerificationUrl && (
                <div className="pt-1 flex items-center justify-between gap-2">
                  <span className="text-[11px] text-muted-foreground font-sans">
                    {t('signedUrlLabel')}:
                  </span>
                  <a
                    href={dispatchResult.dossierVerificationUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-primary hover:underline flex items-center gap-1 font-medium"
                  >
                    <ExternalLink className="h-3 w-3" />
                    {t('openVerificationLinkBtn')}
                  </a>
                </div>
              )}
            </div>

            <div className="pt-2 flex justify-end">
              <Button size="sm" onClick={onClose} className="text-xs">
                {tCommon('close')}
              </Button>
            </div>
          </div>
        ) : (
          /* Form Controls */
          <div className="space-y-4 text-xs">
            {/* Insurer Company Selection */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="font-medium block mb-1 flex items-center gap-1.5">
                  <Building className="h-3.5 w-3.5 text-muted-foreground" />
                  {t('insurerCompanyLabel')}
                </label>
                <select
                  value={insurerCompany}
                  onChange={(e) => handleInsurerChange(e.target.value as InsurerCompany)}
                  className="w-full p-2 border rounded-lg bg-background text-xs"
                >
                  <option value="allianz">Allianz Maroc / Allianz Trade</option>
                  <option value="rma">RMA Watanya</option>
                  <option value="axa">AXA Assurance Maroc</option>
                  <option value="sanlam">Sanlam Maroc</option>
                  <option value="other">{t('otherInsurer')}</option>
                </select>
              </div>

              <div>
                <label className="font-medium block mb-1 flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5 text-muted-foreground" />
                  {t('adjusterNameLabel')}
                </label>
                <Input
                  value={adjusterName}
                  onChange={(e) => setAdjusterName(e.target.value)}
                  placeholder={t('adjusterPlaceholder')}
                  className="text-xs"
                />
              </div>
            </div>

            {/* Channels & Recipients */}
            <div className="space-y-2">
              <label className="font-medium block mb-1">{t('dispatchChannelLabel')}</label>
              <div className="grid grid-cols-3 gap-2">
                <Button
                  type="button"
                  variant={channel === 'whatsapp' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setChannel('whatsapp')}
                  className="text-xs gap-1.5"
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  WhatsApp
                </Button>
                <Button
                  type="button"
                  variant={channel === 'email' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setChannel('email')}
                  className="text-xs gap-1.5"
                >
                  <Mail className="h-3.5 w-3.5" />
                  Email (SMTP)
                </Button>
                <Button
                  type="button"
                  variant={channel === 'both' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setChannel('both')}
                  className="text-xs gap-1.5"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  {t('bothChannels')}
                </Button>
              </div>
            </div>

            {/* Recipient Coordinates */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {(channel === 'email' || channel === 'both') && (
                <div>
                  <label className="font-medium block mb-1 flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                    {t('insurerEmailLabel')}
                  </label>
                  <Input
                    type="email"
                    value={recipientEmail}
                    onChange={(e) => setRecipientEmail(e.target.value)}
                    placeholder="claims@insurer.com"
                    className="text-xs font-mono"
                  />
                </div>
              )}

              {(channel === 'whatsapp' || channel === 'both') && (
                <div>
                  <label className="font-medium block mb-1 flex items-center gap-1.5">
                    <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
                    {t('insurerPhoneLabel')}
                  </label>
                  <Input
                    value={recipientPhone}
                    onChange={(e) => setRecipientPhone(e.target.value)}
                    placeholder="+212600000000"
                    className="text-xs font-mono"
                  />
                </div>
              )}
            </div>

            {/* Dossier Options */}
            <div className="p-3 rounded-lg border bg-muted/10 space-y-2.5">
              <span className="font-semibold block text-[11px] text-muted-foreground uppercase tracking-wider">
                {t('dossierContentOptions')}
              </span>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={includeEpodAnnex}
                    onChange={(e) => setIncludeEpodAnnex(e.target.checked)}
                    className="rounded border-input text-primary"
                  />
                  <span>{t('includeEpodAnnexCheck')}</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={includeMktSummary}
                    onChange={(e) => setIncludeMktSummary(e.target.checked)}
                    className="rounded border-input text-primary"
                  />
                  <span>{t('includeMktSummaryCheck')}</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer select-none text-amber-600 dark:text-amber-400">
                  <input
                    type="checkbox"
                    checked={forceBypassCooldown}
                    onChange={(e) => setForceBypassCooldown(e.target.checked)}
                    className="rounded border-input text-primary"
                  />
                  <span>{t('forceBypassCooldownCheck')}</span>
                </label>
              </div>
            </div>

            {/* Optional Adjuster Notes */}
            <div>
              <label className="font-medium block mb-1">{t('additionalNotesLabel')}</label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t('notesPlaceholder')}
                className="text-xs"
              />
            </div>

            {/* Action Buttons */}
            <div className="pt-3 flex items-center justify-end gap-2 border-t">
              <Button variant="outline" size="sm" onClick={onClose} className="text-xs">
                {tCommon('cancel')}
              </Button>
              <Button
                size="sm"
                onClick={handleDispatch}
                disabled={isPending}
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs gap-1.5"
              >
                {isPending ? (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5" />
                )}
                {t('confirmAndDispatchBtn')}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

