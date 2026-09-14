'use client';

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  FileText,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Clock,
  Calendar,
  History,
  Download,
  ExternalLink,
  PlusCircle,
  RefreshCw,
  Zap,
  CheckCircle2,
} from 'lucide-react';
import { useLanguage } from '@/components/language-provider';
import { formatCurrency } from '@/lib/forex';
import { DOCUMENT_TYPE_LABELS } from '@/features/fleet/services/fleet-documents.constants';
import type { FleetDocument } from '@/types/database';

interface VehicleDocumentsTabProps {
  documents: FleetDocument[];
  vehiclePlate: string;
  vehicleType: 'truck' | 'trailer';
  onAddDocument: () => void;
  onQuickRenewDirect: (doc: FleetDocument) => Promise<void>;
  onOpenRenewDialog: (doc: FleetDocument) => void;
  onViewRenewalHistory: (doc: FleetDocument) => void;
  renewingDocId: number | null;
}

export function VehicleDocumentsTab({
  documents,
  vehiclePlate,
  vehicleType,
  onAddDocument,
  onQuickRenewDirect,
  onOpenRenewDialog,
  onViewRenewalHistory,
  renewingDocId,
}: VehicleDocumentsTabProps) {
  const { t, locale } = useLanguage();
  const [filter, setFilter] = useState<'all' | 'valid' | 'expiring_soon' | 'expired'>('all');

  const now = useMemo(() => new Date(), []);

  // Enrich docs with status computations
  const enrichedDocs = useMemo(() => {
    return documents.map((doc) => {
      let daysRemaining: number | null = null;
      let status: 'valid' | 'expiring_soon' | 'expired' | 'no_date' = 'no_date';

      if (doc.expiry_date) {
        const expiry = new Date(doc.expiry_date);
        const diffTime = expiry.getTime() - now.getTime();
        daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (daysRemaining < 0) {
          status = 'expired';
        } else if (daysRemaining <= 30) {
          status = 'expiring_soon';
        } else {
          status = 'valid';
        }
      }

      const labelObj = DOCUMENT_TYPE_LABELS[doc.document_type];
      const displayName =
        locale === 'fr'
          ? labelObj?.label_fr || doc.document_type
          : labelObj?.label_ar || doc.document_type;

      return {
        ...doc,
        daysRemaining,
        computedStatus: status,
        displayName,
      };
    });
  }, [documents, now, locale]);

  // Filtered documents
  const filteredDocs = useMemo(() => {
    if (filter === 'all') return enrichedDocs;
    return enrichedDocs.filter((d) => d.computedStatus === filter);
  }, [enrichedDocs, filter]);

  return (
    <div className="space-y-4">
      {/* Top Filter & Actions Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-card p-3 rounded-2xl border border-border">
        <div className="flex items-center gap-1.5 flex-wrap">
          <Button
            variant={filter === 'all' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setFilter('all')}
            className="rounded-xl text-xs h-8"
          >
            {t('الكل', 'Tous', 'All')} ({enrichedDocs.length})
          </Button>

          <Button
            variant={filter === 'expired' ? 'destructive' : 'ghost'}
            size="sm"
            onClick={() => setFilter('expired')}
            className="rounded-xl text-xs h-8 text-rose-600 dark:text-rose-400"
          >
            {t('منتهية الصلاحية', 'Expirés', 'Expired')} (
            {enrichedDocs.filter((d) => d.computedStatus === 'expired').length})
          </Button>

          <Button
            variant={filter === 'expiring_soon' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setFilter('expiring_soon')}
            className="rounded-xl text-xs h-8 text-amber-600 dark:text-amber-400"
          >
            {t('قريبة الانتهاء (30 يوم)', 'Expire bientôt', 'Expiring Soon')} (
            {enrichedDocs.filter((d) => d.computedStatus === 'expiring_soon').length})
          </Button>

          <Button
            variant={filter === 'valid' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setFilter('valid')}
            className="rounded-xl text-xs h-8 text-emerald-600 dark:text-emerald-400"
          >
            {t('سارية', 'Valides', 'Valid')} (
            {enrichedDocs.filter((d) => d.computedStatus === 'valid').length})
          </Button>
        </div>

        <Button
          variant="default"
          size="sm"
          onClick={onAddDocument}
          className="rounded-xl text-xs h-8 gap-1.5 ms-auto"
        >
          <PlusCircle className="w-3.5 h-3.5" />
          <span>{t('إضافة وثيقة جديدة', 'Nouveau document', 'Add Document')}</span>
        </Button>
      </div>

      {/* Documents Grid */}
      {filteredDocs.length === 0 ? (
        <Card className="rounded-2xl border-dashed border-2 border-border p-10 text-center">
          <div className="w-12 h-12 rounded-2xl bg-muted mx-auto flex items-center justify-center text-muted-foreground mb-3">
            <FileText className="w-6 h-6" />
          </div>
          <p className="text-sm font-bold text-foreground">
            {t('لا توجد وثائق في هذا القسم', 'Aucun document dans cette catégorie', 'No documents found')}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {t('يمكنك رفع وتوثيق التراخيص والفحوصات القانونية في أي وقت.', 'Ajoutez des documents légaux à tout moment.', 'You can upload legal documents at any time.')}
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={onAddDocument}
            className="mt-4 rounded-xl text-xs gap-1.5"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>{t('رفع وثيقة الآن', 'Téléverser maintenant', 'Upload Document Now')}</span>
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredDocs.map((doc) => {
            const isRenewing = renewingDocId === doc.id;
            const isExpired = doc.computedStatus === 'expired';
            const isExpiringSoon = doc.computedStatus === 'expiring_soon';

            return (
              <Card
                key={doc.id}
                className={`rounded-2xl border transition-all hover:shadow-md overflow-hidden ${
                  isExpired
                    ? 'border-rose-500/40 bg-rose-500/5'
                    : isExpiringSoon
                      ? 'border-amber-500/40 bg-amber-500/5'
                      : 'border-border bg-card'
                }`}
              >
                <div
                  className={`h-1.5 w-full ${
                    isExpired
                      ? 'bg-rose-500'
                      : isExpiringSoon
                        ? 'bg-amber-500'
                        : 'bg-emerald-500'
                  }`}
                />
                <CardContent className="p-5 space-y-4">
                  {/* Card Header: Title & Status Badge */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                          isExpired
                            ? 'bg-rose-500/15 text-rose-600'
                            : isExpiringSoon
                              ? 'bg-amber-500/15 text-amber-600'
                              : 'bg-emerald-500/15 text-emerald-600'
                        }`}
                      >
                        {isExpired ? (
                          <ShieldAlert className="w-5 h-5" />
                        ) : isExpiringSoon ? (
                          <AlertTriangle className="w-5 h-5" />
                        ) : (
                          <ShieldCheck className="w-5 h-5" />
                        )}
                      </div>
                      <div>
                        <h2 className="font-bold text-base text-foreground leading-tight">
                          {doc.displayName}
                        </h2>
                        {doc.document_number && (
                          <p className="text-xs font-mono text-muted-foreground mt-0.5">
                            N° {doc.document_number}
                          </p>
                        )}
                      </div>
                    </div>

                    {isExpired ? (
                      <Badge variant="destructive" className="text-xs animate-pulse">
                        {t('منتهي الصلاحية!', 'Expiré!', 'Expired!')}
                      </Badge>
                    ) : isExpiringSoon ? (
                      <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 text-xs">
                        {t(`متبقي ${doc.daysRemaining} يوم`, `Reste ${doc.daysRemaining} j`, `${doc.daysRemaining} days left`)}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs text-emerald-600 border-emerald-500/30">
                        {t('ساري ومطابق', 'Valide & Conforme', 'Valid')}
                      </Badge>
                    )}
                  </div>

                  {/* Date Metadata */}
                  <div className="grid grid-cols-2 gap-2 text-xs p-3 rounded-xl bg-muted/40 border border-border/40">
                    <div>
                      <span className="text-muted-foreground block text-[11px]">
                        {t('تاريخ الإصدار:', 'Délivré le :')}
                      </span>
                      <span className="font-mono font-medium text-foreground">
                        {doc.issue_date || '—'}
                      </span>
                    </div>

                    <div>
                      <span className="text-muted-foreground block text-[11px]">
                        {t('تاريخ نهاية الصلاحية:', 'Date d\'expiration :')}
                      </span>
                      <span
                        className={`font-mono font-bold ${
                          isExpired
                            ? 'text-rose-600'
                            : isExpiringSoon
                              ? 'text-amber-600'
                              : 'text-foreground'
                        }`}
                      >
                        {doc.expiry_date || t('غير محدد', 'Non spécifiée', 'Unspecified')}
                      </span>
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/50 flex-wrap">
                    <div className="flex items-center gap-1.5">
                      {doc.file_url && (
                        <Button
                          variant="ghost"
                          size="sm"
                          asChild
                          className="h-8 text-xs px-2.5 rounded-lg text-primary hover:bg-primary/10"
                        >
                          <a href={doc.file_url} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="w-3.5 h-3.5 me-1" />
                            <span>{t('معاينة', 'Aperçu', 'Preview')}</span>
                          </a>
                        </Button>
                      )}

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onViewRenewalHistory(doc)}
                        className="h-8 text-xs px-2.5 rounded-lg text-muted-foreground hover:text-foreground"
                      >
                        <History className="w-3.5 h-3.5 me-1" />
                        <span>{t('السجل', 'Historique', 'History')}</span>
                      </Button>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onOpenRenewDialog(doc)}
                        className="h-8 text-xs px-3 rounded-lg border-border"
                      >
                        <RefreshCw className="w-3.5 h-3.5 me-1 text-primary" />
                        <span>{t('تجديد مالي', 'Renouvellement', 'Renew')}</span>
                      </Button>

                      <Button
                        variant="default"
                        size="sm"
                        disabled={isRenewing}
                        onClick={() => onQuickRenewDirect(doc)}
                        className="h-8 text-xs px-3 rounded-lg gap-1"
                        title={t('تجديد سريع (+سنة واحدة)', 'Renouvellement rapide (+1 an)', 'Quick +1 Year')}
                      >
                        {isRenewing ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Zap className="w-3.5 h-3.5" />
                        )}
                        <span>{t('+365 يوم', '+1 an', '+1 Year')}</span>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

