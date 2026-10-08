'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '@/components/language-provider';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MatriculeBadge } from '@/components/ui/matricule-badge';
import { useToast } from '@/hooks/use-toast';
import {
  listCustomsDossiersAction,
  issueBaeReleaseAction,
  validateAndSubmitPhytoDossierAction,
} from '../services/customs-dossier.actions';
import type { ConsolidatedCustomsDossier } from '../types/customs-dossier.types';
import {
  ShieldCheck,
  ShieldAlert,
  Snowflake,
  Scale,
  QrCode,
  FileCheck2,
  RefreshCw,
  Copy,
  Check,
  CheckCircle2,
  Loader2,
  Sparkles,
  ExternalLink,
} from 'lucide-react';

export function PhytosanitaryDossierTab() {
  const { t, locale, dir } = useLanguage();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [dossiers, setDossiers] = useState<ConsolidatedCustomsDossier[]>([]);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  const fetchDossiers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listCustomsDossiersAction();
      if (res.success && res.data) {
        setDossiers(res.data);
      } else {
        toast({
          title: t('خطأ في جلب الملفات الجمركية', 'Erreur de chargement des dossiers', 'Error cargando expedientes'),
          description: res.error,
          variant: 'destructive',
        });
      }
    } finally {
      setLoading(false);
    }
  }, [t, toast]);

  useEffect(() => {
    fetchDossiers();
  }, [fetchDossiers]);

  const handleIssueBae = async (tripId: number) => {
    setActionLoadingId(tripId);
    try {
      const res = await issueBaeReleaseAction({
        tripId,
        customsInspectorName: 'مفتش الجمارك المعتمد (ADII Tanger Med)',
      });

      if (res.success) {
        toast({
          title: t('تم إصدار إذن الرفع (BAE) بنجاح', 'Mainlevée (BAE) accordée avec succès', 'Autorización (BAE) emitida con éxito'),
          description: res.message,
        });
        fetchDossiers();
      } else {
        toast({
          title: t('فشل إصدار إذن الرفع', 'Échec de la mainlevée', 'Fallo al emitir BAE'),
          description: res.error,
          variant: 'destructive',
        });
      }
    } finally {
      setActionLoadingId(null);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedHash(id);
    setTimeout(() => setCopiedHash(null), 2000);
    toast({
      title: t('تم نسخ الختم الرقمي', 'Empreinte QR copiée', 'Firma QR copiada'),
      description: text.substring(0, 24) + '...',
    });
  };

  const getChannelBadgeClass = (channel: string) => {
    switch (channel) {
      case 'GREEN':
        return 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30';
      case 'ORANGE':
        return 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30';
      case 'RED':
        return 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30';
      default:
        return 'bg-muted text-muted-foreground border-border';
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header with Refresh */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-muted/40 rounded-xl border border-border/70">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-base text-foreground flex items-center gap-2">
              <FileCheck2 className="w-5 h-5 text-emerald-600" />
              <span>
                {t(
                  'أرشيف المراقبة الصحية النباتية والمطابقة الجمركية (ONSSA & Transit Dossiers)',
                  'Dossiers Phytosanitaires ONSSA & Conformité Douanière',
                  'Expedientes Fitosanitarios ONSSA y Conformidad Aduanera'
                )}
              </span>
            </h3>
            <Badge variant="outline" className="text-[10px] font-mono border-emerald-500/30 text-emerald-600">
              ONSSA Certified
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            {t(
              'مطابقة أوزان الشحن (CMR vs DUM)، سلامة أختام الرصاص، التحقق من درجات التبريد الإلزامية، وتوليد الختم الرقمي QR',
              'Rapprochement des poids, scellés de douane, régimes thermiques frigo et QR code sécurisé',
              'Reconciliación de pesos, precintos aduaneros, régimen térmico y código QR cifrado'
            )}
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={fetchDossiers}
          disabled={loading}
          className="h-8 text-xs gap-1.5 self-end sm:self-center"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>{t('تحديث الملفات', 'Actualiser', 'Actualizar')}</span>
        </Button>
      </div>

      {/* 2. Dossiers List */}
      {loading ? (
        <div className="flex flex-col items-center justify-center p-12 gap-3 text-muted-foreground">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-xs font-medium">
            {t('جاري جلب الملفات الجمركية والشواهد الصحية...', 'Chargement des dossiers...', 'Cargando expedientes...')}
          </p>
        </div>
      ) : dossiers.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 border border-dashed border-border rounded-xl text-center space-y-2">
          <ShieldCheck className="w-10 h-10 text-muted-foreground" />
          <p className="text-sm font-bold">
            {t('لا توجد ملفات جمركية نشطة حالياً', 'Aucun dossier actif', 'No hay expedientes activos')}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {dossiers.map((dossier) => (
            <Card key={dossier.id} className="border-border/80 shadow-xs hover:border-primary/40 transition-colors">
              <CardHeader className="pb-3 border-b border-border/40">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm font-extrabold text-primary">
                      {dossier.dossierReference}
                    </span>
                    <MatriculeBadge plate={dossier.truckPlate} />
                    <span className="text-xs text-muted-foreground font-mono">
                      ({dossier.trailerPlate})
                    </span>
                    <Badge variant="outline" className={`text-xs font-bold px-2 py-0.5 border ${getChannelBadgeClass(dossier.channel)}`}>
                      {dossier.channel === 'GREEN'
                        ? t('المسار الأخضر (Circuit Vert)', 'Circuit Vert', 'Circuito Verde')
                        : dossier.channel === 'ORANGE'
                        ? t('المسار البرتقالي (Orange)', 'Circuit Orange', 'Circuito Naranja')
                        : t('المسار الأحمر (Rouge)', 'Circuit Rouge', 'Circuito Rojo')}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center">
                    {dossier.status === 'cleared_bae' ? (
                      <Badge className="bg-emerald-600 text-white text-xs gap-1 py-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>{t('إذن الرفع صادر (BAE)', 'Mainlevée Accordée (BAE)', 'BAE Emitido')}</span>
                      </Badge>
                    ) : (
                      <Button
                        size="sm"
                        disabled={actionLoadingId === dossier.tripId}
                        onClick={() => handleIssueBae(dossier.tripId)}
                        className="h-8 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                      >
                        {actionLoadingId === dossier.tripId ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Sparkles className="w-3.5 h-3.5" />
                        )}
                        <span>{t('إصدار إذن الرفع (BAE)', 'Émettre BAE', 'Emitir BAE')}</span>
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>

              <CardContent className="pt-4 space-y-4">
                {/* Bento Row: 4 Metric Pillars */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                  {/* ONSSA Certificate Card */}
                  <div className="p-3 rounded-xl bg-card border border-border/70 space-y-1.5">
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span className="font-semibold flex items-center gap-1.5">
                        <FileCheck2 className="w-3.5 h-3.5 text-emerald-500" />
                        {t('شهادة ONSSA', 'Certificat ONSSA', 'Certificado ONSSA')}
                      </span>
                      <Badge variant="outline" className="text-[10px] py-0 text-emerald-600 border-emerald-500/30">
                        {dossier.phytosanitary.status}
                      </Badge>
                    </div>
                    <p className="font-mono font-bold text-foreground truncate">
                      {dossier.phytosanitary.certificateNumber}
                    </p>
                    <div className="flex justify-between text-[11px] text-muted-foreground pt-1 border-t border-border/40">
                      <span>{t('شمع الرصاص:', 'Scellé :', 'Precinto:')}</span>
                      <span className="font-mono font-bold text-foreground">{dossier.sealNumber}</span>
                    </div>
                  </div>

                  {/* Weight Reconciliation Card */}
                  <div className="p-3 rounded-xl bg-card border border-border/70 space-y-1.5">
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span className="font-semibold flex items-center gap-1.5">
                        <Scale className="w-3.5 h-3.5 text-indigo-500" />
                        {t('مطابقة الوزن', 'Rapprochement Poids', 'Reconciliación Peso')}
                      </span>
                      <span className={`font-mono font-bold text-[11px] ${
                        dossier.weightReconciliation.isWeightCompliant ? 'text-emerald-600' : 'text-rose-600'
                      }`}>
                        Δ {dossier.weightReconciliation.variancePercentage}%
                      </span>
                    </div>
                    <div className="flex justify-between text-[11px]">
                      <span>CMR Gross:</span>
                      <span className="font-mono font-bold">{dossier.weightReconciliation.cmrGrossWeightKg.toLocaleString()} kg</span>
                    </div>
                    <div className="flex justify-between text-[11px] text-muted-foreground pt-1 border-t border-border/40">
                      <span>DUM Gross:</span>
                      <span className="font-mono font-bold">{dossier.weightReconciliation.dumGrossWeightKg.toLocaleString()} kg</span>
                    </div>
                  </div>

                  {/* Frigo Thermal Regime Card */}
                  <div className="p-3 rounded-xl bg-card border border-border/70 space-y-1.5">
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span className="font-semibold flex items-center gap-1.5">
                        <Snowflake className="w-3.5 h-3.5 text-cyan-500" />
                        {t('نظام التبريد الإلزامي', 'Régime Frigo', 'Régimen Frigorífico')}
                      </span>
                      <Badge variant="outline" className={`text-[10px] py-0 ${
                        dossier.thermalCompliance.isCompliant
                          ? 'text-cyan-600 border-cyan-500/30'
                          : 'text-rose-600 border-rose-500/30'
                      }`}>
                        {dossier.thermalCompliance.isCompliant
                          ? t('مطابق', 'Conforme', 'Conforme')
                          : t('انحراف', 'Déviation', 'Desviación')}
                      </Badge>
                    </div>
                    <div className="flex justify-between text-[11px]">
                      <span>{t('المستشعر:', 'Capteur :', 'Sensor:')}</span>
                      <span className="font-mono font-bold text-cyan-600">{dossier.thermalCompliance.currentSensorTemp}°C</span>
                    </div>
                    <div className="flex justify-between text-[11px] text-muted-foreground pt-1 border-t border-border/40">
                      <span>{t('النطاق المصرح به:', 'Plage consigne :', 'Rango consigna:')}</span>
                      <span className="font-mono text-[10px]">{dossier.thermalCompliance.prescribedRange}</span>
                    </div>
                  </div>

                  {/* Customs & Sanitary Fees Card */}
                  <div className="p-3 rounded-xl bg-card border border-border/70 space-y-1.5">
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span className="font-semibold">
                        {t('رسوم المراقبة والتنبر', 'Taxes & Timbre', 'Tasas e Inspección')}
                      </span>
                      <span className="text-[10px] text-muted-foreground font-mono">Decimal.js</span>
                    </div>
                    <div className="text-sm font-mono font-extrabold text-foreground">
                      {dossier.fees.totalDutiesAndFeesMad} <span className="text-xs text-muted-foreground">MAD</span>
                    </div>
                    <div className="flex justify-between text-[11px] text-muted-foreground pt-1 border-t border-border/40">
                      <span>{t('تفتيش صحي:', 'Insp. sanitaire :', 'Insp. sanitaria:')}</span>
                      <span className="font-mono font-medium">{dossier.fees.sanitaryInspectionFeeMad} MAD</span>
                    </div>
                  </div>
                </div>

                {/* Cryptographic Verification Stamp Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-lg bg-muted/60 border border-border/60 text-xs">
                  <div className="flex items-center gap-2 overflow-hidden">
                    <QrCode className="w-4 h-4 text-primary shrink-0" />
                    <span className="text-muted-foreground shrink-0">
                      {t('الختم الرقمي المشفر (QR Verification Hash):', 'Empreinte Cryptographique QR :', 'Firma Criptográfica QR:')}
                    </span>
                    <span className="font-mono text-[11px] text-foreground truncate select-all">
                      {dossier.qrVerificationHash}
                    </span>
                  </div>

                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => copyToClipboard(dossier.qrVerificationHash, dossier.id)}
                    className="h-7 text-xs gap-1 px-2 shrink-0 self-end sm:self-center"
                  >
                    {copiedHash === dossier.id ? (
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    <span>{copiedHash === dossier.id ? t('تم النسخ', 'Copié', 'Copiado') : t('نسخ', 'Copier', 'Copiar')}</span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
