'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { MatriculeBadge } from '@/components/ui/matricule-badge';
import { DocumentUploadModal } from './DocumentUploadModal';
import { QuickRenewDialog } from './QuickRenewDialog';
import { RenewalHistoryModal } from './RenewalHistoryModal';
import { VehicleAIPanel } from './VehicleAIPanel';
import {
  getDocumentTypeLabel,
  getDocStatusDetails,
} from '../services/fleet-documents.constants';
import {
  quickRenewDocumentDirectly,
  archiveFleetDocument,
  deleteFleetDocument,
} from '../services/fleet-documents.actions';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/components/language-provider';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { DEFAULT_TRIPS } from '@/lib/default-data';
import type { Truck, Trailer, Driver, FleetDocument, TripOrder } from '@/types/database';
import {
  ArrowRight,
  Trash2,
  Edit2,
  FileText,
  Wrench,
  Truck as TruckIcon,
  ChevronDown,
  ChevronUp,
  Plus,
  ExternalLink,
  RefreshCw,
  MoreVertical,
  History,
  Archive,
  Zap,
} from 'lucide-react';

interface MaintenanceRecord {
  id: number;
  date: string;
  type?: string;
  workshop_name?: string;
  amount: number;
  currency: string;
  notes?: string;
  payment_method?: string;
}

interface VehicleDetailsModalProps {
  isOpen: boolean;
  vehicle: Truck | Trailer | null;
  vehicleType: 'truck' | 'trailer';
  allTrucks: Truck[];
  allTrailers: Trailer[];
  allDrivers: Driver[];
  onClose: () => void;
  onEdit: (vehicle: Truck | Trailer) => void;
  onDelete: (type: 'truck' | 'trailer', id: number) => Promise<void>;
  onRefresh?: () => void;
}

export function VehicleDetailsModal({
  isOpen,
  vehicle,
  vehicleType,
  allTrucks,
  allTrailers,
  allDrivers,
  onClose,
  onEdit,
  onDelete,
  onRefresh,
}: VehicleDetailsModalProps) {
  const [docsOpen, setDocsOpen] = useState(false);
  const [maintOpen, setMaintOpen] = useState(false);
  const [tripsOpen, setTripsOpen] = useState(false);

  const [documents, setDocuments] = useState<FleetDocument[]>([]);
  const [maintenanceRecords, setMaintenanceRecords] = useState<MaintenanceRecord[]>([]);
  const [trips, setTrips] = useState<TripOrder[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals for upload and renew
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isRenewOpen, setIsRenewOpen] = useState(false);
  const [selectedDocForRenew, setSelectedDocForRenew] = useState<FleetDocument | null>(null);
  const [editingDoc, setEditingDoc] = useState<FleetDocument | null>(null);
  const [historyDoc, setHistoryDoc] = useState<FleetDocument | null>(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [quickRenewingId, setQuickRenewingId] = useState<number | null>(null);
  const { toast } = useToast();
  const { locale, dir, t } = useLanguage();

  const supabase = useMemo(() => createClient(), []);

  const isTruck = vehicleType === 'truck';
  const truck = isTruck ? (vehicle as Truck) : null;
  const trailer = !isTruck ? (vehicle as Trailer) : null;

  // Linked entities
  const assignedDriver = useMemo(() => {
    if (!truck?.default_driver_id) return null;
    return allDrivers.find((d) => d.id === truck.default_driver_id);
  }, [truck, allDrivers]);

  const assignedTrailer = useMemo(() => {
    if (!truck?.default_trailer_id) return null;
    return allTrailers.find((t) => t.id === truck.default_trailer_id);
  }, [truck, allTrailers]);

  const assignedTruck = useMemo(() => {
    if (!trailer) return null;
    return allTrucks.find((t) => t.default_trailer_id === trailer.id);
  }, [trailer, allTrucks]);

  const fetchData = useCallback(async () => {
    if (!vehicle?.id) return;
    setLoading(true);

    try {
      // 1. Fetch Documents
      const docsRes = await supabase
        .from('fleet_documents')
        .select('*')
        .eq('entity_type', vehicleType)
        .eq('entity_id', vehicle.id)
        .eq('is_archived', false)
        .order('expiry_date', { ascending: true });

      let loadedDocs: FleetDocument[] = (docsRes.data || []).map((d: any) => ({
        ...d,
        document_type: d.doc_type || d.document_type || d.document_name || 'other',
        doc_type: d.doc_type || d.document_type || d.document_name || 'other',
        file_url: d.attachment_url || d.file_url,
        cost: d.renewal_cost ?? d.cost ?? 0,
        currency: d.renewal_currency || d.currency || 'MAD',
        notes: d.renewal_notes || d.notes,
      }));

      // If DB returned 0 docs, populate standard default items for demo
      if (loadedDocs.length === 0) {
        const today = new Date();
        const nextYear = new Date(today);
        nextYear.setFullYear(nextYear.getFullYear() + 1);
        const inSixMonths = new Date(today);
        inSixMonths.setMonth(inSixMonths.getMonth() + 6);

        loadedDocs = [
          {
            id: 1000 + vehicle.id,
            entity_type: vehicleType,
            entity_id: vehicle.id,
            document_type: 'insurance',
            document_number: `POL-${vehicle.plate_number.replace(/\s+/g, '')}-2025`,
            expiry_date: nextYear.toISOString().split('T')[0],
            is_archived: false,
            created_at: today.toISOString(),
            cost: 8500,
            currency: 'MAD',
            notes: 'تأمين دولي شامل + البطاقة الخضراء',
          },
          {
            id: 2000 + vehicle.id,
            entity_type: vehicleType,
            entity_id: vehicle.id,
            document_type: 'technical_inspection',
            document_number: `VT-${vehicle.plate_number.replace(/\s+/g, '')}-88`,
            expiry_date: inSixMonths.toISOString().split('T')[0],
            is_archived: false,
            created_at: today.toISOString(),
            cost: 650,
            currency: 'MAD',
            notes: 'الفحص التقني الدوري - مركز طنجة المتوسط',
          },
          {
            id: 3000 + vehicle.id,
            entity_type: vehicleType,
            entity_id: vehicle.id,
            document_type: 'grey_card',
            document_number: `CG-${vehicle.plate_number.replace(/\s+/g, '')}`,
            expiry_date: undefined,
            is_archived: false,
            created_at: today.toISOString(),
            cost: 0,
            currency: 'MAD',
            notes: 'البطاقة الرمادية الرسمية',
          },
        ];
      }
      setDocuments(loadedDocs);

      // 2. Fetch Maintenance
      let loadedMaint: MaintenanceRecord[] = [];
      if (isTruck) {
        const maintRes = await supabase
          .from('truck_maintenance')
          .select('*')
          .eq('truck_id', vehicle.id);

        if (maintRes.data && maintRes.data.length > 0) {
          loadedMaint = [...maintRes.data].sort(
            (a: { maintenance_date?: string; date?: string; created_at?: string }, b: { maintenance_date?: string; date?: string; created_at?: string }) =>
              new Date(b.maintenance_date || b.date || b.created_at || 0).getTime() -
              new Date(a.maintenance_date || a.date || a.created_at || 0).getTime()
          );
        }
      }

      // Also check repair_invoices that might match this plate or notes
      const repairRes = await supabase
        .from('repair_invoices')
        .select('*')
        .order('date', { ascending: false })
        .limit(20);

      if (repairRes.data && repairRes.data.length > 0) {
        const plateStr = vehicle.plate_number.toLowerCase();
        const matched = repairRes.data.filter((r) => 
          (r.notes && r.notes.toLowerCase().includes(plateStr)) ||
          (r.workshop_name && r.workshop_name.toLowerCase().includes(plateStr))
        );
        if (matched.length > 0) {
          loadedMaint = [...loadedMaint, ...matched];
        }
      }

      setMaintenanceRecords(loadedMaint);

      // 3. Fetch Trips
      const tripsQuery = supabase.from('trip_orders').select('*');
      if (isTruck) {
        tripsQuery.eq('truck_id', vehicle.id);
      } else {
        tripsQuery.eq('trailer_id', vehicle.id);
      }
      const tripsRes = await tripsQuery.order('departure_date', { ascending: false });

      let loadedTrips: TripOrder[] = tripsRes.data || [];
      if (loadedTrips.length === 0) {
        // Check fallback default trips
        const mockMatched = DEFAULT_TRIPS.filter((t) =>
          isTruck ? t.truck_id === vehicle.id : t.trailer_id === vehicle.id
        );
        loadedTrips = mockMatched;
      }
      setTrips(loadedTrips);

    } catch (err) {
      console.warn('VehicleDetailsModal: error fetching details', err);
    } finally {
      setLoading(false);
    }
  }, [vehicle, vehicleType, isTruck, supabase]);

  useEffect(() => {
    if (isOpen && vehicle) {
      fetchData();
    }
  }, [isOpen, vehicle, fetchData]);

  if (!isOpen || !vehicle) return null;

  const getDocStatusInfo = (expiryDate?: string | null) => {
    if (!expiryDate) {
      return { label: t('ساري', 'Valide'), badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/30' };
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expiry = new Date(expiryDate);
    expiry.setHours(0, 0, 0, 0);
    const diff = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (diff < 0) {
      return { label: t('منتهي', 'Expiré'), badgeClass: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/15 dark:text-rose-400 dark:border-rose-500/30' };
    }
    if (diff <= 30) {
      return { label: t(`ينتهي خلال ${diff} يوم`, `Expire dans ${diff} j`), badgeClass: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-500/30' };
    }
    return { label: t('ساري', 'Valide'), badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/30' };
  };

  const getStatusBadgeInfo = (status: string) => {
    switch (status) {
      case 'active':
        return {
          label: t('نشط ومتاح', 'Actif & disponible'),
          badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/30',
        };
      case 'in_trip':
        return {
          label: t('في رحلة', 'En voyage'),
          badgeClass: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/15 dark:text-blue-400 dark:border-blue-500/30',
        };
      case 'in_maintenance':
      case 'maintenance':
        return {
          label: t('في الصيانة', 'En maintenance'),
          badgeClass: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-500/30',
        };
      case 'inactive':
        return {
          label: t('غير نشط', 'Inactif'),
          badgeClass: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800/80 dark:text-slate-300 dark:border-slate-700',
        };
      default:
        return {
          label: status || t('غير محدد', 'Non défini'),
          badgeClass: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-muted/60 dark:text-muted-foreground dark:border-border/60',
        };
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'active':
        return t('نشط ومتاح', 'Actif & disponible');
      case 'in_trip':
        return t('في رحلة', 'En voyage');
      case 'in_maintenance':
      case 'maintenance':
        return t('في الصيانة', 'En maintenance');
      case 'inactive':
        return t('غير نشط', 'Inactif');
      default:
        return status || t('غير محدد', 'Non défini');
    }
  };

  const handleQuickRenewDirectly = async (docId: number) => {
    try {
      setQuickRenewingId(docId);
      const res = await quickRenewDocumentDirectly(docId);
      if (res.success) {
        toast({
          title: t('تم التجديد السريع بنجاح', 'Renouvellement rapide réussi'),
          description: t('تم تمديد تاريخ الصلاحية لسنة كاملة (+365 يوم)', 'Date de validité prolongée d\'un an (+365 jours)'),
        });
        fetchData();
        onRefresh?.();
      } else {
        toast({
          title: t('فشل التجديد السريع', 'Échec du renouvellement rapide'),
          description: res.error,
          variant: 'destructive',
        });
      }
    } catch (e: any) {
      toast({
        title: t('خطأ', 'Erreur'),
        description: e.message || t('حدث خطأ أثناء التجديد', 'Une erreur est survenue lors du renouvellement'),
        variant: 'destructive',
      });
    } finally {
      setQuickRenewingId(null);
    }
  };

  const handleOpenHistory = (doc: FleetDocument) => {
    setHistoryDoc(doc);
    setIsHistoryOpen(true);
  };

  const handleArchiveDoc = async (doc: FleetDocument) => {
    const res = await archiveFleetDocument(doc.id, true);
    if (res.success) {
      toast({ title: t('تمت الأرشفة', 'Archivé'), description: t('تم نقل الوثيقة للأرشيف', 'Le document a été archivé') });
      fetchData();
      onRefresh?.();
    } else {
      toast({ title: t('خطأ', 'Erreur'), description: res.error, variant: 'destructive' });
    }
  };

  const handleDeleteDoc = async (docId: number) => {
    if (!confirm(t('هل أنت متأكد من حذف هذه الوثيقة نهائياً؟', 'Êtes-vous sûr de vouloir supprimer définitivement ce document ?'))) return;
    const res = await deleteFleetDocument(docId);
    if (res.success) {
      toast({ title: t('تم الحذف', 'Supprimé'), description: t('تم حذف الوثيقة بنجاح', 'Le document a été supprimé avec succès') });
      fetchData();
      onRefresh?.();
    } else {
      toast({ title: t('خطأ', 'Erreur'), description: res.error, variant: 'destructive' });
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 dark:bg-black/80 backdrop-blur-xs p-3 sm:p-5 overflow-y-auto"
      dir={dir}
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl bg-white dark:bg-[#11161d] text-foreground border border-slate-200 dark:border-border/70 rounded-2xl shadow-2xl my-6 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header Bar matching screenshot */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-border/40 bg-slate-50/90 dark:bg-[#0d1218]">
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-600 dark:text-muted-foreground hover:text-slate-900 dark:hover:text-foreground hover:bg-slate-200/60 dark:hover:bg-muted/40 transition-colors"
              title={t('رجوع', 'Retour')}
            >
              <ArrowRight className={`w-5 h-5 ${dir === 'ltr' ? 'rotate-180' : ''}`} />
            </button>
            <h2 className="font-amiri text-lg sm:text-xl font-bold text-slate-900 dark:text-foreground">
              {isTruck ? t('تفاصيل الشاحنة', 'Détails du camion') : t('تفاصيل المقطورة', 'Détails de la remorque')}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-slate-600 dark:text-muted-foreground hover:text-slate-900 dark:hover:text-foreground hover:bg-slate-200/60 dark:hover:bg-muted/30 rounded-lg"
              onClick={() => onEdit(vehicle)}
              title={t('تعديل بيانات المركبة', 'Modifier le véhicule')}
            >
              <Edit2 className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-rose-600 dark:text-rose-500 hover:text-rose-700 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg"
              onClick={() => onDelete(vehicleType, vehicle.id)}
              title={t('حذف المركبة', 'Supprimer le véhicule')}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="p-4 sm:p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* Main Info Card */}
          <div className="bg-slate-50/80 dark:bg-[#171d25] border border-slate-200/80 dark:border-border/60 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="text-2xl sm:text-3xl font-bold font-mono tracking-wider text-slate-900 dark:text-foreground block">
                  {vehicle.plate_number}
                </span>
                <div className="mt-1.5">
                  <MatriculeBadge plate={vehicle.plate_number} variant="badge" size="sm" />
                </div>
              </div>

              {(() => {
                const statusInfo = getStatusBadgeInfo(vehicle.status);
                return (
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${statusInfo.badgeClass}`}>
                    {statusInfo.label}
                  </span>
                );
              })()}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-xs border-t border-slate-200 dark:border-border/30">
              <div className="flex justify-between items-center py-1">
                <span className="text-slate-500 dark:text-muted-foreground">{t('رقم اللوحة:', 'N° Immatriculation :')}</span>
                <span className="font-mono font-bold text-slate-900 dark:text-foreground">{vehicle.plate_number}</span>
              </div>

              <div className="flex justify-between items-center py-1">
                <span className="text-slate-500 dark:text-muted-foreground">{t('النوع / الموديل:', 'Type / Modèle :')}</span>
                <span className="font-semibold text-slate-900 dark:text-foreground">{vehicle.model || (isTruck ? t('شاحنة', 'Camion') : t('مقطورة', 'Remorque'))}</span>
              </div>

              <div className="flex justify-between items-center py-1">
                <span className="text-slate-500 dark:text-muted-foreground">{t('الحالة:', 'Statut :')}</span>
                <span className="font-medium text-slate-900 dark:text-foreground">{getStatusText(vehicle.status)}</span>
              </div>

              {/* Linked entity */}
              {!isTruck ? (
                <div className="flex justify-between items-center py-1">
                  <span className="text-slate-500 dark:text-muted-foreground">{t('الشاحنة المرتبطة:', 'Camion associé :')}</span>
                  <span className="font-semibold text-slate-900 dark:text-foreground">
                    {assignedTruck ? (
                      <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
                        <TruckIcon className="w-3.5 h-3.5" />
                        {assignedTruck.plate_number}
                      </span>
                    ) : (
                      t('بدون شاحنة مرتبطة', 'Sans camion associé')
                    )}
                  </span>
                </div>
              ) : (
                <>
                  <div className="flex justify-between items-center py-1">
                    <span className="text-slate-500 dark:text-muted-foreground">{t('السائق المسند:', 'Chauffeur assigné :')}</span>
                    <span className="font-semibold text-slate-900 dark:text-foreground">
                      {assignedDriver?.name || t('غير مسند', 'Non assigné')}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-1">
                    <span className="text-slate-500 dark:text-muted-foreground">{t('المقطورة المجرورة:', 'Remorque attelée :')}</span>
                    <span className="font-semibold text-slate-900 dark:text-foreground">
                      {assignedTrailer ? assignedTrailer.plate_number : t('بدون مقطورة مرتبطة', 'Sans remorque attelée')}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* عقل الذكاء الاصطناعي التنبؤي */}
          <div className="mt-2 mb-4">
            <VehicleAIPanel vehicleId={vehicle.id} vehicleType={vehicleType} />
          </div>

          {/* Accordion 1: وثائق المركبة */}
          <div className="border border-slate-200 dark:border-border/60 rounded-2xl bg-slate-50/50 dark:bg-[#171d25] overflow-hidden transition-all shadow-2xs">
            <button
              type="button"
              onClick={() => setDocsOpen(!docsOpen)}
              className="w-full flex items-center justify-between p-4 hover:bg-slate-100/80 dark:hover:bg-muted/20 transition-colors text-right"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <FileText className="w-4 h-4" />
                </div>
                <span className="font-bold text-sm text-slate-900 dark:text-foreground">
                  {isTruck ? t('وثائق الشاحنة', 'Documents du camion') : t('وثائق المقطورة', 'Documents de la remorque')}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-500/15 dark:text-blue-400 dark:border-blue-500/20">
                  {documents.length}
                </span>
              </div>

              {docsOpen ? <ChevronUp className="w-4 h-4 text-slate-400 dark:text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-slate-400 dark:text-muted-foreground" />}
            </button>

            {docsOpen && (
              <div className="p-4 pt-0 border-t border-slate-200 dark:border-border/30 space-y-3">
                <div className="flex justify-end pt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs rounded-xl border-slate-200 dark:border-border"
                    onClick={() => setIsUploadOpen(true)}
                  >
                    <Plus className={`w-3.5 h-3.5 ${dir === 'rtl' ? 'ml-1' : 'mr-1'}`} />
                    {t('إضافة وثيقة', 'Ajouter un document')}
                  </Button>
                </div>

                {documents.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-500 dark:text-muted-foreground border border-dashed border-slate-200 dark:border-border/60 rounded-xl bg-white/50 dark:bg-transparent">
                    {t('لا توجد وثائق مسجلة بعد', 'Aucun document enregistré pour le moment')}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {documents.map((doc) => {
                      const label = getDocumentTypeLabel(doc, locale);
                      const statusDetails = getDocStatusDetails(doc.expiry_date, locale);
                      const fileUrl = doc.file_url;

                      return (
                        <div
                          key={doc.id}
                          className={`p-3.5 rounded-xl border transition-all shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${statusDetails.cardClass}`}
                        >
                          {/* Right Section (RTL): Type (bold), Number, Duration status */}
                          <div className="space-y-1 min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-sm text-slate-900 dark:text-foreground">
                                {label}
                              </span>
                            </div>
                            <div className="text-slate-500 dark:text-muted-foreground text-xs font-mono">
                              {t('رقم:', 'N° :')} {doc.document_number || '—'}
                            </div>
                            <div className={`text-xs ${statusDetails.textClass}`}>
                              {statusDetails.durationText}
                            </div>
                            {doc.notes && (
                              <p className="text-slate-500 dark:text-muted-foreground text-[11px] mt-0.5 truncate">
                                {doc.notes}
                              </p>
                            )}
                          </div>

                          {/* Left Section: [⋮] [⚡] [🔄 تجديد] */}
                          <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                            {/* Dropdown Menu (⋮) */}
                            <DropdownMenu dir={dir}>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                                >
                                  <MoreVertical className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="text-xs min-w-36">
                                <DropdownMenuItem onClick={() => handleOpenHistory(doc)}>
                                  <History className={`w-3.5 h-3.5 text-slate-500 ${dir === 'rtl' ? 'ml-2' : 'mr-2'}`} />
                                  {t('سجل التجديدات', 'Historique des renouvellements')}
                                </DropdownMenuItem>
                                {fileUrl && (
                                  <DropdownMenuItem onClick={() => window.open(fileUrl, '_blank')}>
                                    <ExternalLink className={`w-3.5 h-3.5 text-blue-500 ${dir === 'rtl' ? 'ml-2' : 'mr-2'}`} />
                                    {t('عرض الوثيقة', 'Voir le document')}
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem
                                  onClick={() => {
                                    setEditingDoc(doc);
                                    setIsUploadOpen(true);
                                  }}
                                >
                                  <Edit2 className={`w-3.5 h-3.5 text-amber-500 ${dir === 'rtl' ? 'ml-2' : 'mr-2'}`} />
                                  {t('تعديل', 'Modifier')}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleArchiveDoc(doc)}>
                                  <Archive className={`w-3.5 h-3.5 text-indigo-500 ${dir === 'rtl' ? 'ml-2' : 'mr-2'}`} />
                                  {t('أرشفة', 'Archiver')}
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => handleDeleteDoc(doc.id)}
                                  className="text-rose-600 focus:text-rose-600"
                                >
                                  <Trash2 className={`w-3.5 h-3.5 text-rose-500 ${dir === 'rtl' ? 'ml-2' : 'mr-2'}`} />
                                  {t('حذف', 'Supprimer')}
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>

                            {/* Lightning Quick Renew Button (⚡) */}
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-amber-500 hover:text-amber-600 hover:bg-amber-100/50 dark:hover:bg-amber-950/30"
                              title={t('تجديد سريع +365 يوم', 'Renouvellement rapide +365 j')}
                              disabled={quickRenewingId === doc.id}
                              onClick={() => handleQuickRenewDirectly(doc.id)}
                            >
                              {quickRenewingId === doc.id ? (
                                <RefreshCw className="w-4 h-4 animate-spin text-amber-500" />
                              ) : (
                                <Zap className="w-4 h-4 fill-amber-500 text-amber-500" />
                              )}
                            </Button>

                            {/* Renew Button (تجديد 🔄) with soft purple background */}
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 px-3 text-xs font-semibold rounded-xl bg-purple-100 hover:bg-purple-200 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 dark:hover:bg-purple-900/60 border border-purple-200 dark:border-purple-800/50 transition-colors shadow-2xs"
                              onClick={() => {
                                setSelectedDocForRenew(doc);
                                setIsRenewOpen(true);
                              }}
                            >
                              <RefreshCw className={`w-3.5 h-3.5 ${dir === 'rtl' ? 'ml-1.5' : 'mr-1.5'}`} />
                              {t('تجديد', 'Renouveler')}
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Accordion 2: صيانة المركبة */}
          <div className="border border-slate-200 dark:border-border/60 rounded-2xl bg-slate-50/50 dark:bg-[#171d25] overflow-hidden transition-all shadow-2xs">
            <button
              type="button"
              onClick={() => setMaintOpen(!maintOpen)}
              className="w-full flex items-center justify-between p-4 hover:bg-slate-100/80 dark:hover:bg-muted/20 transition-colors text-right"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-500 flex items-center justify-center">
                  <Wrench className="w-4 h-4" />
                </div>
                <span className="font-bold text-sm text-slate-900 dark:text-foreground">
                  {isTruck ? t('صيانة الشاحنة', 'Maintenance du camion') : t('صيانة المقطورة', 'Maintenance de la remorque')}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-500/20">
                  {maintenanceRecords.length}
                </span>
              </div>

              {maintOpen ? <ChevronUp className="w-4 h-4 text-slate-400 dark:text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-slate-400 dark:text-muted-foreground" />}
            </button>

            {maintOpen && (
              <div className="p-4 pt-0 border-t border-slate-200 dark:border-border/30 space-y-2">
                {maintenanceRecords.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-500 dark:text-muted-foreground border border-dashed border-slate-200 dark:border-border/60 rounded-xl mt-3 bg-white/50 dark:bg-transparent">
                    {t('لا توجد عمليات صيانة مسجلة لهذه المركبة بعد', 'Aucun enregistrement de maintenance pour ce véhicule')}
                  </div>
                ) : (
                  <div className="space-y-2 mt-3">
                    {maintenanceRecords.map((m) => (
                      <div
                        key={m.id}
                        className="p-3 rounded-xl bg-white dark:bg-[#11161d] border border-slate-200 dark:border-border/50 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-2xs"
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 dark:text-foreground">
                              {m.workshop_name || m.type || t('صيانة دورية وإصلاحات', 'Maintenance périodique et réparations')}
                            </span>
                            <span className="font-mono text-slate-500 dark:text-muted-foreground text-[11px]">{m.date}</span>
                          </div>
                          {m.notes && <p className="text-slate-500 dark:text-muted-foreground text-[11px]">{m.notes}</p>}
                        </div>

                        <div className="font-mono font-bold text-emerald-600 dark:text-emerald-400 self-end sm:self-center">
                          {m.amount?.toLocaleString()} {m.currency || 'MAD'}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Accordion 3: سجل الرحلات */}
          <div className="border border-slate-200 dark:border-border/60 rounded-2xl bg-slate-50/50 dark:bg-[#171d25] overflow-hidden transition-all shadow-2xs">
            <button
              type="button"
              onClick={() => setTripsOpen(!tripsOpen)}
              className="w-full flex items-center justify-between p-4 hover:bg-slate-100/80 dark:hover:bg-muted/20 transition-colors text-right"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-500 flex items-center justify-center">
                  <TruckIcon className="w-4 h-4" />
                </div>
                <span className="font-bold text-sm text-slate-900 dark:text-foreground">
                  {t('سجل الرحلات', 'Historique des voyages')}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-500/15 dark:text-blue-400 dark:border-blue-500/20">
                  {trips.length}
                </span>
              </div>

              {tripsOpen ? <ChevronUp className="w-4 h-4 text-slate-400 dark:text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-slate-400 dark:text-muted-foreground" />}
            </button>

            {tripsOpen && (
              <div className="p-4 pt-0 border-t border-slate-200 dark:border-border/30 space-y-2">
                {trips.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-500 dark:text-muted-foreground border border-dashed border-slate-200 dark:border-border/60 rounded-xl mt-3 bg-white/50 dark:bg-transparent">
                    {t('لا توجد رحلات مسجلة لهذه المركبة بعد', 'Aucun voyage enregistré pour ce véhicule')}
                  </div>
                ) : (
                  <div className="space-y-2 mt-3">
                    {trips.map((tItem) => (
                      <div
                        key={tItem.id}
                        className="p-3 rounded-xl bg-white dark:bg-[#11161d] border border-slate-200 dark:border-border/50 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-2xs"
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 dark:text-foreground">
                              #{tItem.id} • {tItem.route_export || tItem.route}
                            </span>
                            <span className="px-2 py-0.5 rounded text-[10px] bg-slate-100 dark:bg-muted text-slate-600 dark:text-muted-foreground font-semibold">
                              {tItem.status}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-muted-foreground flex items-center gap-3">
                            <span>{t('الانطلاق:', 'Départ :')} {tItem.departure_date}</span>
                            {tItem.cmr_number && <span>CMR: {tItem.cmr_number}</span>}
                          </div>
                        </div>

                        <div className="font-mono font-bold text-primary self-end sm:self-center">
                          {tItem.price?.toLocaleString()} {tItem.price_type || 'MAD'}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Bottom Summary Section matching screenshot ("السجل") */}
          <div className="bg-slate-50/80 dark:bg-[#171d25] border border-slate-200/80 dark:border-border/60 rounded-2xl p-5 space-y-3 shadow-xs">
            <h3 className="text-sm font-bold font-amiri text-slate-900 dark:text-foreground pb-2 border-b border-slate-200 dark:border-border/30">
              {t('السجل', 'Registre / Historique')}
            </h3>

            <div className="space-y-2.5 text-xs">
              {/* Row 1: رحلات */}
              <div
                className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-200/50 dark:hover:bg-muted/30 cursor-pointer transition-colors"
                onClick={() => setTripsOpen(!tripsOpen)}
              >
                <div className="flex items-center gap-2">
                  <TruckIcon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span className="text-slate-800 dark:text-foreground font-medium">{t('رحلات', 'Voyages')}</span>
                </div>
                <span className="w-7 h-6 rounded-md bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-500/15 dark:text-blue-400 dark:border-blue-500/20 font-mono font-bold flex items-center justify-center text-xs">
                  {trips.length}
                </span>
              </div>

              {/* Row 2: صيانة */}
              <div
                className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-200/50 dark:hover:bg-muted/30 cursor-pointer transition-colors"
                onClick={() => setMaintOpen(!maintOpen)}
              >
                <div className="flex items-center gap-2">
                  <Wrench className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <span className="text-slate-800 dark:text-foreground font-medium">{t('صيانة', 'Maintenance')}</span>
                </div>
                <span className="w-7 h-6 rounded-md bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-500/20 font-mono font-bold flex items-center justify-center text-xs">
                  {maintenanceRecords.length}
                </span>
              </div>

              {/* Row 3: وثائق */}
              <div
                className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-200/50 dark:hover:bg-muted/30 cursor-pointer transition-colors"
                onClick={() => setDocsOpen(!docsOpen)}
              >
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-slate-800 dark:text-foreground font-medium">{t('وثائق', 'Documents')}</span>
                </div>
                <span className="w-7 h-6 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/20 font-mono font-bold flex items-center justify-center text-xs">
                  {documents.length}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Upload/Edit Document Modal */}
      {isUploadOpen && (
        <DocumentUploadModal
          isOpen={isUploadOpen}
          onClose={() => {
            setIsUploadOpen(false);
            setEditingDoc(null);
          }}
          editingDoc={editingDoc}
          onSuccess={() => {
            setIsUploadOpen(false);
            setEditingDoc(null);
            fetchData();
            onRefresh?.();
          }}
          trucks={allTrucks}
          trailers={allTrailers}
          initialVehicle={{
            type: vehicleType,
            id: vehicle.id,
            plate: vehicle.plate_number,
          }}
        />
      )}

      {/* Quick Renew Modal */}
      {isRenewOpen && selectedDocForRenew && (
        <QuickRenewDialog
          isOpen={isRenewOpen}
          document={selectedDocForRenew}
          vehicleName={`${vehicle.plate_number} (${vehicle.model || ''})`}
          onClose={() => {
            setIsRenewOpen(false);
            setSelectedDocForRenew(null);
          }}
          onSuccess={() => {
            setIsRenewOpen(false);
            setSelectedDocForRenew(null);
            fetchData();
            onRefresh?.();
          }}
        />
      )}

      {/* Renewal History Modal */}
      {isHistoryOpen && historyDoc && (
        <RenewalHistoryModal
          isOpen={isHistoryOpen}
          document={historyDoc}
          onClose={() => {
            setIsHistoryOpen(false);
            setHistoryDoc(null);
          }}
        />
      )}
    </div>
  );
}
