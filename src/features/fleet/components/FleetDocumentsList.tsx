'use client';

import { useState, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MatriculeBadge } from '@/components/ui/matricule-badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  FileText,
  Search,
  RefreshCw,
  Clock,
  Eye,
  Archive,
  ArchiveRestore,
  Trash2,
  Calendar,
  DollarSign,
  Truck,
  ExternalLink,
  ShieldCheck,
  AlertTriangle,
  XCircle,
} from 'lucide-react';
import type { FleetDocument } from '@/types/database';
import { DOCUMENT_TYPE_LABELS } from '@/features/fleet/services/fleet-documents.constants';
import {
  archiveFleetDocument,
  deleteFleetDocument,
} from '@/features/fleet/services/fleet-documents.actions';
import { useToast } from '@/hooks/use-toast';
import { CardViewToggle, useCardViewMode } from '@/components/ui/card-view-toggle';

interface FleetDocumentsListProps {
  documents: FleetDocument[];
  loading: boolean;
  onRenewDocument: (doc: FleetDocument, vehiclePlate: string) => void;
  onViewHistory: (doc: FleetDocument) => void;
  onRefresh: () => void;
}

export function FleetDocumentsList({
  documents,
  loading,
  onRenewDocument,
  onViewHistory,
  onRefresh,
}: FleetDocumentsListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [entityTypeFilter, setEntityTypeFilter] = useState<'all' | 'truck' | 'trailer'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'safe' | 'warning' | 'expired' | 'archived'>('all');
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [cardLayout, setCardLayout] = useCardViewMode('fleet_documents', 'grid');

  const { toast } = useToast();

  const filteredDocs = useMemo(() => {
    return documents.filter((doc) => {
      // 1. Entity Type
      if (entityTypeFilter !== 'all' && doc.entity_type !== entityTypeFilter) {
        return false;
      }

      // 2. Status Filter
      if (statusFilter === 'archived') {
        if (!doc.is_archived) return false;
      } else {
        if (doc.is_archived) return false;
        if (statusFilter === 'safe' && doc.status_computed !== 'safe') return false;
        if (statusFilter === 'warning' && doc.status_computed !== 'warning') return false;
        if (statusFilter === 'expired' && doc.status_computed !== 'expired') return false;
      }

      // 3. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const plate = doc.truck?.plate_number || doc.trailer?.plate_number || '';
        const docName = DOCUMENT_TYPE_LABELS[doc.document_type]?.label_ar || doc.document_type;
        const notes = doc.notes || '';
        const match =
          plate.toLowerCase().includes(q) ||
          docName.toLowerCase().includes(q) ||
          notes.toLowerCase().includes(q);
        if (!match) return false;
      }

      return true;
    });
  }, [documents, entityTypeFilter, statusFilter, searchQuery]);

  const handleArchiveToggle = async (doc: FleetDocument) => {
    setActionLoading(doc.id);
    try {
      const res = await archiveFleetDocument(doc.id, !doc.is_archived);
      if (!res.success) throw new Error(res.error);
      toast({
        title: doc.is_archived ? 'تم استعادة الوثيقة إلى الأسطول النشط' : 'تم نقل الوثيقة للأرشيف',
      });
      onRefresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'فشل في تغيير حالة الأرشفة';
      toast({ title: 'خطأ', description: msg, variant: 'destructive' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (docId: number) => {
    if (!confirm('هل أنت متأكد من رغبتك في حذف هذه الوثيقة نهائياً وسجلها؟')) return;
    setActionLoading(docId);
    try {
      const res = await deleteFleetDocument(docId);
      if (!res.success) throw new Error(res.error);
      toast({ title: 'تم حذف الوثيقة بنجاح' });
      onRefresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'فشل في حذف الوثيقة';
      toast({ title: 'خطأ', description: msg, variant: 'destructive' });
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-4" dir="rtl">
      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-2.5 items-center justify-between bg-card border border-border/70 p-3 rounded-2xl shadow-xs">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder="بحث بالترقيم، نوع الوثيقة، أو الملاحظات..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pr-9 rounded-xl text-xs bg-muted/20"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
          {/* Card View Mode Bascule */}
          <CardViewToggle viewMode={cardLayout} onChange={setCardLayout} />

          {/* Status Filters */}
          <div className="inline-flex rounded-xl bg-muted/40 p-1 border border-border/60 text-xs">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-2.5 py-1 font-semibold rounded-lg transition-all ${
                statusFilter === 'all'
                  ? 'bg-background text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              النشطة ({documents.filter((d) => !d.is_archived).length})
            </button>
            <button
              onClick={() => setStatusFilter('expired')}
              className={`px-2.5 py-1 font-semibold rounded-lg transition-all ${
                statusFilter === 'expired'
                  ? 'bg-destructive/10 text-destructive shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              المنتهية ({documents.filter((d) => !d.is_archived && d.status_computed === 'expired').length})
            </button>
            <button
              onClick={() => setStatusFilter('warning')}
              className={`px-2.5 py-1 font-semibold rounded-lg transition-all ${
                statusFilter === 'warning'
                  ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300 shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              تنتهي قريباً (
              {documents.filter((d) => !d.is_archived && d.status_computed === 'warning').length})
            </button>
            <button
              onClick={() => setStatusFilter('archived')}
              className={`px-2.5 py-1 font-semibold rounded-lg transition-all ${
                statusFilter === 'archived'
                  ? 'bg-background text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              الأرشيف ({documents.filter((d) => d.is_archived).length})
            </button>
          </div>
        </div>
      </div>

      {/* Document Cards Grid / List */}
      {loading ? (
        <div className="text-center py-16">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto text-primary mb-2" />
          <p className="text-xs text-muted-foreground">جاري تحميل قائمة الوثائق...</p>
        </div>
      ) : filteredDocs.length === 0 ? (
        <div className="text-center py-16 bg-card border border-border/80 rounded-2xl">
          <FileText className="w-10 h-10 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-sm font-semibold text-foreground">لا توجد وثائق مطابقة للبحث</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            تأكد من شروط الفلترة أو قم بإضافة وثائق جديدة.
          </p>
        </div>
      ) : cardLayout === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {filteredDocs.map((doc) => {
            const isTruck = doc.entity_type === 'truck';
            const plate =
              doc.truck?.plate_number || doc.trailer?.plate_number || `مركبة #${doc.entity_id}`;
            const vehicleModel = doc.truck?.model || doc.trailer?.model || '';
            const docLabel =
              DOCUMENT_TYPE_LABELS[doc.document_type]?.label_ar || doc.document_type;
            const docLabelFr = DOCUMENT_TYPE_LABELS[doc.document_type]?.label_fr || '';
            const expiryDateFormatted = doc.expiry_date
              ? new Date(doc.expiry_date).toLocaleDateString('fr-MA')
              : 'بدون تاريخ';

            return (
              <Card
                key={doc.id}
                className="rounded-2xl border border-border/80 shadow-xs hover:shadow-md transition-all overflow-hidden flex flex-col justify-between bg-card"
              >
                <div className="p-4 space-y-3">
                  {/* Top Row: Vehicle Plate + Status Badge */}
                  <div className="flex items-start justify-between gap-2 border-b border-border/40 pb-2.5">
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${
                          isTruck
                            ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                            : 'bg-purple-500/10 text-purple-600 dark:text-purple-400'
                        }`}
                      >
                        <Truck className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="mb-0.5">
                          <MatriculeBadge plate={plate} variant="badge" size="xs" />
                        </div>
                        <span className="text-[11px] text-muted-foreground">
                          {isTruck ? 'شاحنة' : 'مقطورة'} {vehicleModel ? `• ${vehicleModel}` : ''}
                        </span>
                      </div>
                    </div>

                    {/* Status Badge */}
                    {doc.is_archived ? (
                      <Badge variant="secondary" className="text-[10px]">
                        مؤرشفة
                      </Badge>
                    ) : doc.status_computed === 'expired' ? (
                      <Badge variant="destructive" className="text-[10px] gap-1">
                        <XCircle className="w-3 h-3" />
                        منتهية
                      </Badge>
                    ) : doc.status_computed === 'warning' ? (
                      <span className="bg-amber-500/15 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        تنتهي قريباً
                      </span>
                    ) : (
                      <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-500/40 gap-1">
                        <ShieldCheck className="w-3 h-3" />
                        سارية
                      </Badge>
                    )}
                  </div>

                  {/* Document Title */}
                  <div>
                    <h3 className="text-sm font-bold font-amiri text-foreground">{docLabel}</h3>
                    {docLabelFr && (
                      <p className="text-[11px] text-muted-foreground font-mono">{docLabelFr}</p>
                    )}
                    {doc.document_number && (
                      <span className="text-[11px] text-muted-foreground font-mono block mt-0.5">
                        رقم العقد: {doc.document_number}
                      </span>
                    )}
                  </div>

                  {/* Expiry & Cost Information */}
                  <div className="grid grid-cols-2 gap-2 text-xs bg-muted/20 p-2.5 rounded-xl border border-border/50">
                    <div>
                      <span className="text-[10px] text-muted-foreground block">تاريخ الانتهاء</span>
                      <span className="font-mono font-bold text-foreground">{expiryDateFormatted}</span>
                      {!doc.is_archived && doc.days_until_expiry !== undefined && (
                        <span
                          className={`text-[10px] block mt-0.5 font-medium ${
                            doc.days_until_expiry < 0
                              ? 'text-destructive'
                              : doc.days_until_expiry <= 30
                              ? 'text-amber-600 dark:text-amber-400'
                              : 'text-emerald-600 dark:text-emerald-400'
                          }`}
                        >
                          {doc.days_until_expiry < 0
                            ? `منتهية منذ ${Math.abs(doc.days_until_expiry)} يوم`
                            : `متبقي ${doc.days_until_expiry} يوم`}
                        </span>
                      )}
                    </div>

                    <div>
                      <span className="text-[10px] text-muted-foreground block">التكلفة المسجلة</span>
                      <span className="font-mono font-bold text-foreground">
                        {doc.cost ? `${doc.cost.toLocaleString()} ${doc.currency || 'MAD'}` : '—'}
                      </span>
                    </div>
                  </div>

                  {doc.notes && (
                    <p className="text-xs text-muted-foreground line-clamp-1 italic bg-muted/10 px-2 py-1 rounded-md">
                      {doc.notes}
                    </p>
                  )}
                </div>

                {/* Bottom Actions Toolbar */}
                <div className="p-3 bg-muted/30 border-t border-border/50 flex items-center justify-between gap-1.5 text-xs">
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onRenewDocument(doc, plate)}
                      className="rounded-xl h-8 px-2.5 text-xs font-semibold text-foreground hover:bg-emerald-500/10 hover:text-emerald-600 hover:border-emerald-500/40"
                    >
                      <RefreshCw className="w-3.5 h-3.5 ml-1 text-emerald-500" />
                      تجديد سريع
                    </Button>

                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onViewHistory(doc)}
                      title="سجل التجديدات"
                      className="rounded-xl h-8 w-8 text-muted-foreground hover:text-foreground"
                    >
                      <Clock className="w-3.5 h-3.5" />
                    </Button>

                    {doc.file_url && (
                      <Button
                        asChild
                        variant="ghost"
                        size="icon"
                        title="معاينة الملف"
                        className="rounded-xl h-8 w-8 text-muted-foreground hover:text-foreground"
                      >
                        <a href={doc.file_url} target="_blank" rel="noreferrer">
                          <Eye className="w-3.5 h-3.5" />
                        </a>
                      </Button>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleArchiveToggle(doc)}
                      disabled={actionLoading === doc.id}
                      title={doc.is_archived ? 'استعادة من الأرشيف' : 'نقل للأرشيف'}
                      className="rounded-xl h-8 w-8 text-muted-foreground hover:text-foreground"
                    >
                      {doc.is_archived ? (
                        <ArchiveRestore className="w-3.5 h-3.5" />
                      ) : (
                        <Archive className="w-3.5 h-3.5" />
                      )}
                    </Button>

                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(doc.id)}
                      disabled={actionLoading === doc.id}
                      title="حذف الوثيقة"
                      className="rounded-xl h-8 w-8 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        /* List View Cards */
        <div className="flex flex-col gap-3">
          {filteredDocs.map((doc) => {
            const isTruck = doc.entity_type === 'truck';
            const plate =
              doc.truck?.plate_number || doc.trailer?.plate_number || `مركبة #${doc.entity_id}`;
            const vehicleModel = doc.truck?.model || doc.trailer?.model || '';
            const docLabel =
              DOCUMENT_TYPE_LABELS[doc.document_type]?.label_ar || doc.document_type;
            const docLabelFr = DOCUMENT_TYPE_LABELS[doc.document_type]?.label_fr || '';
            const expiryDateFormatted = doc.expiry_date
              ? new Date(doc.expiry_date).toLocaleDateString('fr-MA')
              : 'بدون تاريخ';

            return (
              <Card
                key={doc.id}
                className="rounded-2xl border border-border/80 shadow-xs hover:shadow-md transition-all overflow-hidden bg-card"
              >
                <div className="p-3.5 flex flex-col lg:flex-row lg:items-center justify-between gap-3.5">
                  {/* Right: Vehicle Plate & Document Info */}
                  <div className="flex items-center gap-3 min-w-[240px]">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                        isTruck
                          ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                          : 'bg-purple-500/10 text-purple-600 dark:text-purple-400'
                      }`}
                    >
                      <Truck className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-0.5">
                        <MatriculeBadge plate={plate} variant="badge" size="xs" />
                        <span className="text-[11px] text-muted-foreground">
                          {isTruck ? 'شاحنة' : 'مقطورة'} {vehicleModel ? `• ${vehicleModel}` : ''}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold font-amiri text-foreground">{docLabel}</h3>
                        {docLabelFr && (
                          <span className="text-[10px] text-muted-foreground font-mono">({docLabelFr})</span>
                        )}
                        {doc.document_number && (
                          <span className="text-[10px] text-muted-foreground font-mono bg-muted/50 px-1.5 py-0.5 rounded">
                            #{doc.document_number}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Middle: Expiry & Cost Information */}
                  <div className="flex flex-wrap items-center gap-3 text-xs">
                    <div className="flex items-center gap-2 bg-muted/30 px-3 py-1.5 rounded-xl border border-border/40">
                      <span className="text-[11px] text-muted-foreground">تاريخ الانتهاء:</span>
                      <span className="font-mono font-bold text-foreground">{expiryDateFormatted}</span>
                      {!doc.is_archived && doc.days_until_expiry !== undefined && (
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                            doc.days_until_expiry < 0
                              ? 'bg-destructive/15 text-destructive'
                              : doc.days_until_expiry <= 30
                              ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                              : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                          }`}
                        >
                          {doc.days_until_expiry < 0
                            ? `منتهية منذ ${Math.abs(doc.days_until_expiry)} يوم`
                            : `متبقي ${doc.days_until_expiry} يوم`}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 bg-muted/30 px-3 py-1.5 rounded-xl border border-border/40">
                      <span className="text-[11px] text-muted-foreground">التكلفة:</span>
                      <span className="font-mono font-bold text-foreground">
                        {doc.cost ? `${doc.cost.toLocaleString()} ${doc.currency || 'MAD'}` : '—'}
                      </span>
                    </div>

                    {doc.notes && (
                      <p className="text-xs text-muted-foreground italic max-w-xs truncate hidden xl:block" title={doc.notes}>
                        {doc.notes}
                      </p>
                    )}
                  </div>

                  {/* Left: Status & Actions */}
                  <div className="flex items-center justify-between lg:justify-end gap-2.5 border-t lg:border-t-0 pt-2.5 lg:pt-0 border-border/40">
                    {/* Status Badge */}
                    {doc.is_archived ? (
                      <Badge variant="secondary" className="text-[10px]">
                        مؤرشفة
                      </Badge>
                    ) : doc.status_computed === 'expired' ? (
                      <Badge variant="destructive" className="text-[10px] gap-1">
                        <XCircle className="w-3 h-3" />
                        منتهية
                      </Badge>
                    ) : doc.status_computed === 'warning' ? (
                      <span className="bg-amber-500/15 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        تنتهي قريباً
                      </span>
                    ) : (
                      <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-500/40 gap-1">
                        <ShieldCheck className="w-3 h-3" />
                        سارية
                      </Badge>
                    )}

                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onRenewDocument(doc, plate)}
                        className="rounded-xl h-8 px-2.5 text-xs font-semibold text-foreground hover:bg-emerald-500/10 hover:text-emerald-600 hover:border-emerald-500/40"
                      >
                        <RefreshCw className="w-3.5 h-3.5 ml-1 text-emerald-500" />
                        تجديد سريع
                      </Button>

                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onViewHistory(doc)}
                        title="سجل التجديدات"
                        className="rounded-xl h-8 w-8 text-muted-foreground hover:text-foreground"
                      >
                        <Clock className="w-3.5 h-3.5" />
                      </Button>

                      {doc.file_url && (
                        <Button
                          asChild
                          variant="ghost"
                          size="icon"
                          title="معاينة الملف"
                          className="rounded-xl h-8 w-8 text-muted-foreground hover:text-foreground"
                        >
                          <a href={doc.file_url} target="_blank" rel="noreferrer">
                            <Eye className="w-3.5 h-3.5" />
                          </a>
                        </Button>
                      )}

                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleArchiveToggle(doc)}
                        disabled={actionLoading === doc.id}
                        title={doc.is_archived ? 'استعادة من الأرشيف' : 'نقل للأرشيف'}
                        className="rounded-xl h-8 w-8 text-muted-foreground hover:text-foreground"
                      >
                        {doc.is_archived ? (
                          <ArchiveRestore className="w-3.5 h-3.5" />
                        ) : (
                          <Archive className="w-3.5 h-3.5" />
                        )}
                      </Button>

                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(doc.id)}
                        disabled={actionLoading === doc.id}
                        title="حذف الوثيقة"
                        className="rounded-xl h-8 w-8 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

