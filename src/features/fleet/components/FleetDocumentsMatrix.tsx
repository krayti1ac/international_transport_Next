'use client';

import { useState, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MatriculeBadge } from '@/components/ui/matricule-badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  FileWarning,
  Eye,
  RefreshCw,
  Clock,
  Plus,
  Search,
  Truck as TruckIcon,
  Layers,
  FileText,
  ExternalLink,
  CheckCircle2,
  XCircle,
  HelpCircle,
} from 'lucide-react';
import type { FleetDocument, Truck as TruckType, Trailer as TrailerType } from '@/types/database';
import {
  type FleetMatrixRow,
  CORE_DOC_TYPES,
  DOCUMENT_TYPE_LABELS,
} from '@/features/fleet/services/fleet-documents.constants';
import { useLanguage } from '@/components/language-provider';

interface FleetDocumentsMatrixProps {
  matrixRows: FleetMatrixRow[];
  trucks: TruckType[];
  trailers: TrailerType[];
  loading: boolean;
  onRenewDocument: (doc: FleetDocument, vehiclePlate: string) => void;
  onViewHistory: (doc: FleetDocument) => void;
  onAddNewDoc: (vehicle: { type: 'truck' | 'trailer'; id: number; plate: string }, docType?: string) => void;
}

export function FleetDocumentsMatrix({
  matrixRows,
  trucks,
  trailers,
  loading,
  onRenewDocument,
  onViewHistory,
  onAddNewDoc,
}: FleetDocumentsMatrixProps) {
  const { locale, dir, t } = useLanguage();
  const [searchQuery, setSearchQuery] = useState('');
  const [vehicleTypeFilter, setVehicleTypeFilter] = useState<'all' | 'truck' | 'trailer'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'attention' | 'expired' | 'safe'>('all');

  // Filtered rows
  const filteredRows = useMemo(() => {
    return matrixRows.filter((row) => {
      // 1. Vehicle Type
      if (vehicleTypeFilter !== 'all' && row.entity_type !== vehicleTypeFilter) {
        return false;
      }

      // 2. Status Filter
      if (statusFilter === 'attention' && row.overall_status === 'safe') return false;
      if (statusFilter === 'expired' && row.overall_status !== 'expired') return false;
      if (statusFilter === 'safe' && row.overall_status !== 'safe') return false;

      // 3. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchPlate = row.plate_number.toLowerCase().includes(q);
        const matchModel = (row.model || '').toLowerCase().includes(q);
        if (!matchPlate && !matchModel) return false;
      }

      return true;
    });
  }, [matrixRows, vehicleTypeFilter, statusFilter, searchQuery]);

  // Global counts
  const stats = useMemo(() => {
    let expired = 0;
    let warning = 0;
    let safe = 0;

    matrixRows.forEach((r) => {
      if (r.overall_status === 'expired') expired++;
      else if (r.overall_status === 'warning') warning++;
      else safe++;
    });

    return {
      total: matrixRows.length,
      expired,
      warning,
      safe,
      attention: expired + warning,
    };
  }, [matrixRows]);

  const renderCellBadge = (row: FleetMatrixRow, docType: string) => {
    const doc = row.documents[docType];

    // Missing Document
    if (!doc) {
      return (
        <button
          onClick={() =>
            onAddNewDoc(
              { type: row.entity_type, id: row.entity_id, plate: row.plate_number },
              docType
            )
          }
          className="w-full text-center py-2 px-1.5 rounded-lg border border-dashed border-border/80 hover:border-primary/60 hover:bg-primary/5 transition-all text-[11px] text-muted-foreground flex items-center justify-center gap-1 group"
          title={t('انقر لرفع وتسجيل هذه الوثيقة', 'Cliquer pour enregistrer ce document')}
        >
          <Plus className="w-3 h-3 text-muted-foreground/60 group-hover:text-primary transition-colors" />
          <span>{t('غير مسجلة', 'Non enregistrée')}</span>
        </button>
      );
    }

    const days = doc.days_until_expiry ?? 0;
    const formattedDate = doc.expiry_date
      ? new Date(doc.expiry_date).toLocaleDateString('fr-MA')
      : (locale === 'fr' ? 'Sans date' : 'بدون تاريخ');

    // 1. Expired (Red)
    if (doc.status_computed === 'expired') {
      return (
        <div className="flex flex-col gap-1 p-1.5 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[11px] font-bold font-mono truncate">{formattedDate}</span>
            <XCircle className="w-3.5 h-3.5 flex-shrink-0" />
          </div>
          <div className="flex items-center justify-between text-[10px] font-semibold">
            <span>{t('منتهية', 'Expiré')} ({Math.abs(days)} {t('يوم', 'j')})</span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => onRenewDocument(doc, row.plate_number)}
                className="p-1 rounded bg-destructive text-white hover:bg-destructive/90 transition-colors"
                title={t('تجديد سريع', 'Renouvellement rapide')}
              >
                <RefreshCw className="w-3 h-3" />
              </button>
              <button
                onClick={() => onViewHistory(doc)}
                className="p-1 rounded bg-destructive/20 hover:bg-destructive/30 transition-colors"
                title={t('سجل التجديدات', 'Historique')}
              >
                <Clock className="w-3 h-3" />
              </button>
              {doc.file_url && (
                <a
                  href={doc.file_url}
                  target="_blank"
                  rel="noreferrer"
                  className="p-1 rounded bg-destructive/20 hover:bg-destructive/30 transition-colors"
                  title={t('معاينة الملف', 'Voir le fichier')}
                >
                  <Eye className="w-3 h-3" />
                </a>
              )}
            </div>
          </div>
        </div>
      );
    }

    // 2. Warning / Expiring Soon (Orange)
    if (doc.status_computed === 'warning') {
      return (
        <div className="flex flex-col gap-1 p-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[11px] font-bold font-mono truncate">{formattedDate}</span>
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
          </div>
          <div className="flex items-center justify-between text-[10px] font-semibold">
            <span>{t('متبقي', 'Dans')} {days} {t('يوم', 'j')}</span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => onRenewDocument(doc, row.plate_number)}
                className="p-1 rounded bg-amber-600 text-white hover:bg-amber-700 transition-colors"
                title={t('تجديد سريع', 'Renouvellement rapide')}
              >
                <RefreshCw className="w-3 h-3" />
              </button>
              <button
                onClick={() => onViewHistory(doc)}
                className="p-1 rounded bg-amber-500/20 hover:bg-amber-500/30 transition-colors"
                title={t('سجل التجديدات', 'Historique')}
              >
                <Clock className="w-3 h-3" />
              </button>
              {doc.file_url && (
                <a
                  href={doc.file_url}
                  target="_blank"
                  rel="noreferrer"
                  className="p-1 rounded bg-amber-500/20 hover:bg-amber-500/30 transition-colors"
                  title={t('معاينة الملف', 'Voir le fichier')}
                >
                  <Eye className="w-3 h-3" />
                </a>
              )}
            </div>
          </div>
        </div>
      );
    }

    // 3. Safe (Green)
    return (
      <div className="flex flex-col gap-1 p-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-700 dark:text-emerald-300 group hover:border-emerald-500/50 transition-all">
        <div className="flex items-center justify-between gap-1">
          <span className="text-[11px] font-bold font-mono truncate">{formattedDate}</span>
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
        </div>
        <div className="flex items-center justify-between text-[10px] font-medium">
          <span className="text-emerald-600 dark:text-emerald-400">{t('سارية', 'Valide')} ({days} {t('يوم', 'j')})</span>
          <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => onRenewDocument(doc, row.plate_number)}
              className="p-1 rounded bg-emerald-500/20 hover:bg-emerald-500/40 text-emerald-700 dark:text-emerald-300 transition-colors"
              title={t('تجديد مبكر', 'Renouvellement anticipé')}
            >
              <RefreshCw className="w-3 h-3" />
            </button>
            <button
              onClick={() => onViewHistory(doc)}
              className="p-1 rounded bg-emerald-500/20 hover:bg-emerald-500/40 text-emerald-700 dark:text-emerald-300 transition-colors"
              title={t('سجل التجديدات', 'Historique')}
            >
              <Clock className="w-3 h-3" />
            </button>
            {doc.file_url && (
              <a
                href={doc.file_url}
                target="_blank"
                rel="noreferrer"
                className="p-1 rounded bg-emerald-500/20 hover:bg-emerald-500/40 text-emerald-700 dark:text-emerald-300 transition-colors"
                title={t('معاينة الملف', 'Voir le fichier')}
              >
                <Eye className="w-3 h-3" />
              </a>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4" dir={dir}>
      {/* KPI Stats Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <button
          onClick={() => setStatusFilter('all')}
          className={`p-3.5 rounded-2xl border text-start transition-all flex items-center justify-between ${
            statusFilter === 'all'
              ? 'bg-card border-primary ring-1 ring-primary shadow-xs'
              : 'bg-card border-border/70 hover:bg-muted/40'
          }`}
        >
          <div>
            <span className="text-[11px] font-semibold text-muted-foreground uppercase block">
              {t('إجمالي الأسطول', 'Total de la flotte')}
            </span>
            <span className="text-xl font-extrabold font-mono text-foreground">{stats.total}</span>
          </div>
          <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
            <TruckIcon className="w-4 h-4" />
          </div>
        </button>

        <button
          onClick={() => setStatusFilter('safe')}
          className={`p-3.5 rounded-2xl border text-start transition-all flex items-center justify-between ${
            statusFilter === 'safe'
              ? 'bg-card border-emerald-500 ring-1 ring-emerald-500 shadow-xs'
              : 'bg-card border-border/70 hover:bg-muted/40'
          }`}
        >
          <div>
            <span className="text-[11px] font-semibold text-muted-foreground uppercase block">
              {t('صالحة وسليمة', 'Valides et conformes')}
            </span>
            <span className="text-xl font-extrabold font-mono text-emerald-600 dark:text-emerald-400">
              {stats.safe}
            </span>
          </div>
          <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <ShieldCheck className="w-4 h-4" />
          </div>
        </button>

        <button
          onClick={() => setStatusFilter('attention')}
          className={`p-3.5 rounded-2xl border text-start transition-all flex items-center justify-between ${
            statusFilter === 'attention'
              ? 'bg-card border-amber-500 ring-1 ring-amber-500 shadow-xs'
              : 'bg-card border-border/70 hover:bg-muted/40'
          }`}
        >
          <div>
            <span className="text-[11px] font-semibold text-muted-foreground uppercase block">
              {t('تنتهي قريباً (30 يوم)', 'Expire bientôt (30 j)')}
            </span>
            <span className="text-xl font-extrabold font-mono text-amber-600 dark:text-amber-400">
              {stats.warning}
            </span>
          </div>
          <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
            <AlertTriangle className="w-4 h-4" />
          </div>
        </button>

        <button
          onClick={() => setStatusFilter('expired')}
          className={`p-3.5 rounded-2xl border text-start transition-all flex items-center justify-between ${
            statusFilter === 'expired'
              ? 'bg-card border-destructive ring-1 ring-destructive shadow-xs'
              : 'bg-card border-border/70 hover:bg-muted/40'
          }`}
        >
          <div>
            <span className="text-[11px] font-semibold text-muted-foreground uppercase block">
              {t('منتهية الصلاحية', 'Expirés')}
            </span>
            <span className="text-xl font-extrabold font-mono text-destructive">
              {stats.expired}
            </span>
          </div>
          <div className="w-9 h-9 rounded-xl bg-destructive/10 text-destructive flex items-center justify-center">
            <ShieldAlert className="w-4 h-4" />
          </div>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-2.5 items-center justify-between bg-card border border-border/70 p-3 rounded-2xl shadow-xs">
        <div className="flex items-center gap-2 w-full sm:w-auto flex-1 max-w-md">
          <div className="relative w-full">
            <Search className={`w-4 h-4 absolute ${dir === 'rtl' ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 text-muted-foreground`} />
            <Input
              type="text"
              placeholder={t('بحث بالترقيم، اللوحة، أو الموديل...', 'Rechercher par immatriculation, plaque ou modèle...')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`${dir === 'rtl' ? 'pr-9 pl-3' : 'pl-9 pr-3'} rounded-xl text-xs bg-muted/20`}
            />
          </div>
        </div>

        <div className="flex items-center gap-1.5 w-full sm:w-auto justify-end">
          {/* Vehicle Type Tabs */}
          <div className="inline-flex rounded-xl bg-muted/40 p-1 border border-border/60">
            <button
              onClick={() => setVehicleTypeFilter('all')}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                vehicleTypeFilter === 'all'
                  ? 'bg-background text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {t('الكل', 'Tous')} ({matrixRows.length})
            </button>
            <button
              onClick={() => setVehicleTypeFilter('truck')}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                vehicleTypeFilter === 'truck'
                  ? 'bg-background text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              🚛 {t('الشاحنات', 'Camions')} ({trucks.length})
            </button>
            <button
              onClick={() => setVehicleTypeFilter('trailer')}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                vehicleTypeFilter === 'trailer'
                  ? 'bg-background text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              🚚 {t('المقطورات', 'Remorques')} ({trailers.length})
            </button>
          </div>
        </div>
      </div>

      {/* Matrix Table */}
      <Card className="rounded-2xl border border-border/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-start min-w-[950px]">
            <thead>
              <tr className="bg-muted/40 border-b border-border/70 text-xs font-semibold text-muted-foreground">
                <th className={`p-3.5 text-start w-44 sticky ${dir === 'rtl' ? 'right-0 border-l' : 'left-0 border-r'} bg-muted/60 backdrop-blur-sm z-20 border-border/60`}>
                  {t('المركبة والترقيم', 'Véhicule & Immatriculation')}
                </th>
                <th className="p-3.5 text-center min-w-[155px]">
                  <span>{t('التأمين', 'Assurance')}</span>
                  <span className="block text-[10px] text-muted-foreground/80 font-normal">
                    {locale === 'ar' ? 'Assurance' : 'Assurance'}
                  </span>
                </th>
                <th className="p-3.5 text-center min-w-[155px]">
                  <span>{t('الفحص التقني', 'Visite Technique')}</span>
                  <span className="block text-[10px] text-muted-foreground/80 font-normal">
                    {locale === 'ar' ? 'Visite Technique' : 'Contrôle technique'}
                  </span>
                </th>
                <th className="p-3.5 text-center min-w-[155px]">
                  <span>{t('البطاقة الرمادية', 'Carte Grise')}</span>
                  <span className="block text-[10px] text-muted-foreground/80 font-normal">
                    {locale === 'ar' ? 'Carte Grise' : "Certificat d'immat."}
                  </span>
                </th>
                <th className="p-3.5 text-center min-w-[155px]">
                  <span>{t('رخصة النقل', 'Autorisation Transport')}</span>
                  <span className="block text-[10px] text-muted-foreground/80 font-normal">
                    {locale === 'ar' ? 'Autorisation / CMR' : 'Licence & CMR'}
                  </span>
                </th>
                <th className="p-3.5 text-center min-w-[155px]">
                  <span>{t('شهادة التبريد', 'Certificat ATP')}</span>
                  <span className="block text-[10px] text-muted-foreground/80 font-normal">
                    {locale === 'ar' ? 'Certificat ATP' : 'Agrément frigorifique'}
                  </span>
                </th>
                <th className="p-3.5 text-center min-w-[155px]">
                  <span>{t('التاكوغراف', 'Tachygraphe')}</span>
                  <span className="block text-[10px] text-muted-foreground/80 font-normal">
                    {locale === 'ar' ? 'Tachygraphe' : 'Étalonnage'}
                  </span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-16">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-primary mb-2" />
                    <p className="text-xs text-muted-foreground">
                      {t('جاري تحميل مصفوفة الأسطول والوثائق...', 'Chargement de la matrice des documents...')}
                    </p>
                  </td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-16 text-muted-foreground">
                    <FileWarning className="w-10 h-10 text-muted-foreground/40 mx-auto mb-2" />
                    <p className="text-sm font-semibold text-foreground">
                      {t('لا توجد نتائج مطابقة للفلتر المحدد', 'Aucun résultat trouvé pour ce filtre')}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {t('جرّب تغيير كلمات البحث أو إعادة ضبط الفلترة.', 'Essayez de modifier votre recherche ou de réinitialiser le filtre.')}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => {
                  const isTruck = row.entity_type === 'truck';

                  return (
                    <tr
                      key={`${row.entity_type}-${row.entity_id}`}
                      className="hover:bg-muted/20 transition-colors"
                    >
                      {/* Vehicle Column (Sticky Side) */}
                      <td className={`p-3.5 sticky ${dir === 'rtl' ? 'right-0 border-l' : 'left-0 border-r'} bg-card z-10 border-border/60 shadow-xs`}>
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${
                              isTruck
                                ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                                : 'bg-purple-500/10 text-purple-600 dark:text-purple-400'
                            }`}
                          >
                            <TruckIcon className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="mb-0.5">
                              <MatriculeBadge plate={row.plate_number} variant="badge" size="xs" />
                            </div>
                            <div className="text-[11px] text-muted-foreground truncate flex items-center gap-1 mt-0.5">
                              <span>{isTruck ? t('رأس شاحنة', 'Tracteur') : t('مقطورة', 'Remorque')}</span>
                              <span>•</span>
                              <span>{row.model}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Assurance */}
                      <td className="p-2 text-center align-middle">{renderCellBadge(row, 'insurance')}</td>

                      {/* Visite Technique */}
                      <td className="p-2 text-center align-middle">{renderCellBadge(row, 'technical_inspection')}</td>

                      {/* Carte Grise */}
                      <td className="p-2 text-center align-middle">{renderCellBadge(row, 'grey_card')}</td>

                      {/* Transport License */}
                      <td className="p-2 text-center align-middle">{renderCellBadge(row, 'transport_license')}</td>

                      {/* ATP Certificate */}
                      <td className="p-2 text-center align-middle">{renderCellBadge(row, 'atp_certificate')}</td>

                      {/* Tachograph */}
                      <td className="p-2 text-center align-middle">{renderCellBadge(row, 'tachograph_calibration')}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
