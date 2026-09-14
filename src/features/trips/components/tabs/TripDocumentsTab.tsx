'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/components/language-provider';
import { formatCurrency } from '@/lib/forex';
import Decimal from 'decimal.js';
import type { TripOrder } from '@/types/database';
import {
  FileText,
  Ship,
  ExternalLink,
  Download,
  CheckCircle2,
  AlertCircle,
  Copy,
  Receipt,
  FileCheck2,
  Anchor,
} from 'lucide-react';

Decimal.config({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

interface TripDocumentsTabProps {
  trip: TripOrder;
}

export function TripDocumentsTab({ trip }: TripDocumentsTabProps) {
  const { t, dir } = useLanguage();

  const docList = [
    {
      key: 'cmr_export_url',
      title: t('وثيقة الـ CMR للتصدير (ذهاب)', 'CMR Export (Aller)'),
      code: trip.cmr_export_number || trip.cmr_number || 'N/A',
      url: trip.cmr_export_url,
      type: 'cmr',
    },
    {
      key: 'cmr_import_url',
      title: t('وثيقة الـ CMR للاستيراد (عودة)', 'CMR Import (Retour)'),
      code: trip.cmr_import_number || 'N/A',
      url: trip.cmr_import_url,
      type: 'cmr',
    },
    {
      key: 'mrn_export_url',
      title: t('بيان التصدير الجمركي (MRN / DUA)', 'Déclaration Export (MRN/DUA)'),
      code: 'Customs Doc',
      url: trip.mrn_export_url,
      type: 'customs',
    },
    {
      key: 'phyto_url',
      title: t('الشهادة الصحية النباتية (Phyto)', 'Certificat Phyto-sanitaire'),
      code: 'ONSSA / Health',
      url: trip.phyto_url,
      type: 'health',
    },
    {
      key: 'facture_url',
      title: t('الفاتورة التجارية للبضاعة (Facture)', 'Facture Commerciale Marchandises'),
      code: 'Invoice Ref',
      url: trip.facture_url,
      type: 'invoice',
    },
  ];

  // Port & Ferry fees calculation via Decimal.js
  const ferryCostDec = new Decimal(trip.ferry_cost || 0);
  const triptikCostDec = new Decimal(trip.triptik_cost || 0);
  const transitAlmeriaCostDec = new Decimal(trip.transit_almeria_cost || 0);
  const marsaMarocCostDec = new Decimal(trip.marsa_maroc_cost || 0);

  const totalPortFeesDec = ferryCostDec
    .plus(triptikCostDec)
    .plus(transitAlmeriaCostDec)
    .plus(marsaMarocCostDec);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 1. Shipping & Customs Documents */}
        <Card className="rounded-2xl border-border bg-card shadow-xs">
          <CardHeader className="pb-3 border-b border-border/60">
            <CardTitle className="text-base font-bold flex items-center justify-between">
              <span className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                {t('وثائق الشحن والتخليص الجمركي', 'Documents d\'Expédition & Douane')}
              </span>
              <Badge variant="outline" className="text-xs font-mono">
                {docList.filter((d) => d.url).length} / {docList.length} {t('مرفوعة', 'fichiers')}
              </Badge>
            </CardTitle>
          </CardHeader>

          <CardContent className="p-5 space-y-3">
            {docList.map((doc) => {
              const isAvailable = Boolean(doc.url);

              return (
                <div
                  key={doc.key}
                  className={`p-3.5 rounded-xl border transition-colors flex items-center justify-between gap-3 ${
                    isAvailable
                      ? 'border-border/80 bg-muted/20 hover:bg-muted/40'
                      : 'border-dashed border-border/60 bg-muted/10 opacity-70'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                        isAvailable
                          ? 'bg-primary/10 text-primary'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      <FileText className="w-4 h-4" />
                    </div>

                    <div className="min-w-0">
                      <p className="text-xs font-bold text-foreground truncate">
                        {doc.title}
                      </p>
                      <p className="text-[11px] font-mono text-muted-foreground mt-0.5">
                        {doc.code}
                      </p>
                    </div>
                  </div>

                  {isAvailable ? (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        asChild
                        className="h-7 text-xs rounded-lg gap-1 border-primary/30 text-primary hover:bg-primary/10"
                      >
                        <a href={doc.url} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="w-3 h-3" />
                          <span>{t('معاينة', 'Ouvrir', 'Preview')}</span>
                        </a>
                      </Button>
                    </div>
                  ) : (
                    <Badge variant="secondary" className="text-[10px] shrink-0">
                      {t('غير مرفوع', 'Non téléversé', 'Missing')}
                    </Badge>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* 2. Maritime Transit (Ferry) & Port Charges */}
        <Card className="rounded-2xl border-border bg-card shadow-xs flex flex-col justify-between">
          <div>
            <CardHeader className="pb-3 border-b border-border/60">
              <CardTitle className="text-base font-bold flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Ship className="w-5 h-5 text-blue-600" />
                  {t('بيانات العبور البحري والموانئ (Ferry)', 'Transit Maritime & Frais Portuaires')}
                </span>
                <Badge variant="outline" className="text-xs font-mono border-blue-500/30 text-blue-600">
                  Tanger Med Corridor
                </Badge>
              </CardTitle>
            </CardHeader>

            <CardContent className="p-5 space-y-4">
              {/* Ferry Booking Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-blue-500/5 border border-blue-500/20">
                  <span className="text-[11px] text-muted-foreground font-medium block">
                    {t('شركة الملاحة البحرية:', 'Compagnie Maritime :')}
                  </span>
                  <span className="text-sm font-bold text-foreground mt-0.5 block">
                    {trip.ferry_company || t('Balearia / FRS / Armas', 'Non spécifiée')}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-blue-500/5 border border-blue-500/20">
                  <span className="text-[11px] text-muted-foreground font-medium block">
                    {t('رمز الحجز (Localizador):', 'Réf. Réservation (Localizador) :')}
                  </span>
                  <span className="text-sm font-mono font-black text-blue-600 dark:text-blue-400 mt-0.5 block">
                    {trip.ferry_localizador || 'LOC-TIR-9824'}
                  </span>
                </div>
              </div>

              {/* Port & Crossing Fee Breakdown (Decimal.js) */}
              <div className="p-4 rounded-xl bg-muted/40 border border-border/60 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-border/50">
                  <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <Anchor className="w-3.5 h-3.5 text-blue-500" />
                    {t('تفصيل رسوم الموانئ والعبور الميدانية:', 'Frais de Transit Détaillés :')}
                  </span>
                  <span className="text-sm font-mono font-black text-blue-600 dark:text-blue-400">
                    {formatCurrency(totalPortFeesDec.toNumber(), 'MAD')}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 rounded-lg bg-background border border-border/50">
                    <span className="text-muted-foreground text-[11px] block">
                      {t('تذكرة العبّارة / الباخرة', 'Billet Bateau Ferry')}
                    </span>
                    <span className="font-mono font-bold text-foreground mt-0.5 block">
                      {formatCurrency(ferryCostDec.toNumber(), 'MAD')}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-lg bg-background border border-border/50">
                    <span className="text-muted-foreground text-[11px] block">
                      {t('دفتر المرور الجمركي (Triptyque)', 'Triptyque (CPD)')}
                    </span>
                    <span className="font-mono font-bold text-foreground mt-0.5 block">
                      {formatCurrency(triptikCostDec.toNumber(), 'MAD')}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-lg bg-background border border-border/50">
                    <span className="text-muted-foreground text-[11px] block">
                      {t('ترانزيت ألميريا / الجزيرة', 'Transit Port Espagne')}
                    </span>
                    <span className="font-mono font-bold text-foreground mt-0.5 block">
                      {formatCurrency(transitAlmeriaCostDec.toNumber(), 'MAD')}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-lg bg-background border border-border/50">
                    <span className="text-muted-foreground text-[11px] block">
                      {t('رسوم مرسى المغرب (Tanger Med)', 'Marsa Maroc')}
                    </span>
                    <span className="font-mono font-bold text-foreground mt-0.5 block">
                      {formatCurrency(marsaMarocCostDec.toNumber(), 'MAD')}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </div>
        </Card>
      </div>
    </div>
  );
}

