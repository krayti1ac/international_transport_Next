'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { MatriculeBadge } from '@/components/ui/matricule-badge';
import { DocumentUploadModal } from './DocumentUploadModal';
import { QuickRenewDialog } from './QuickRenewDialog';
import { VehicleAIPanel } from './VehicleAIPanel';
import { DOCUMENT_TYPE_LABELS } from '../services/fleet-documents.constants';
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

      let loadedDocs: FleetDocument[] = docsRes.data || [];
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
          .eq('truck_id', vehicle.id)
          .order('date', { ascending: false });

        if (maintRes.data && maintRes.data.length > 0) {
          loadedMaint = maintRes.data;
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
      return { label: 'ساري', badgeClass: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30' };
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expiry = new Date(expiryDate);
    expiry.setHours(0, 0, 0, 0);
    const diff = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (diff < 0) {
      return { label: 'منتهي', badgeClass: 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30' };
    }
    if (diff <= 30) {
      return { label: `ينتهي خلال ${diff} يوم`, badgeClass: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30' };
    }
    return { label: 'ساري', badgeClass: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30' };
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'active':
        return 'نشط ومتاح';
      case 'in_trip':
        return 'في رحلة';
      case 'in_maintenance':
      case 'maintenance':
        return 'في الصيانة';
      case 'inactive':
        return 'غير نشط';
      default:
        return status || 'غير محدد';
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-3 sm:p-5 overflow-y-auto"
      dir="rtl"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl bg-[#11161d] text-foreground border border-border/70 rounded-2xl shadow-2xl my-6 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header Bar matching screenshot */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/40 bg-[#0d1218]">
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
              title="رجوع"
            >
              <ArrowRight className="w-5 h-5" />
            </button>
            <h2 className="font-amiri text-lg sm:text-xl font-bold text-foreground">
              {isTruck ? 'تفاصيل الشاحنة' : 'تفاصيل المقطورة'}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted/30 rounded-lg"
              onClick={() => onEdit(vehicle)}
              title="تعديل بيانات المركبة"
            >
              <Edit2 className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-rose-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg"
              onClick={() => onDelete(vehicleType, vehicle.id)}
              title="حذف المركبة"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="p-4 sm:p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* Main Info Card */}
          <div className="bg-[#171d25] border border-border/60 rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="text-2xl sm:text-3xl font-bold font-mono tracking-wider text-foreground block">
                  {vehicle.plate_number}
                </span>
                <div className="mt-1">
                  <MatriculeBadge plate={vehicle.plate_number} variant="badge" size="sm" />
                </div>
              </div>

              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-muted/60 border border-border/60 text-muted-foreground">
                {getStatusText(vehicle.status)}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-xs border-t border-border/30">
              <div className="flex justify-between items-center py-1">
                <span className="text-muted-foreground">رقم اللوحة:</span>
                <span className="font-mono font-bold text-foreground">{vehicle.plate_number}</span>
              </div>

              <div className="flex justify-between items-center py-1">
                <span className="text-muted-foreground">النوع / الموديل:</span>
                <span className="font-semibold text-foreground">{vehicle.model || (isTruck ? 'شاحنة' : 'مقطورة')}</span>
              </div>

              <div className="flex justify-between items-center py-1">
                <span className="text-muted-foreground">الحالة:</span>
                <span className="font-medium text-foreground">{getStatusText(vehicle.status)}</span>
              </div>

              {/* Linked entity */}
              {!isTruck ? (
                <div className="flex justify-between items-center py-1">
                  <span className="text-muted-foreground">الشاحنة المرتبطة:</span>
                  <span className="font-semibold text-foreground">
                    {assignedTruck ? (
                      <span className="flex items-center gap-1">
                        <TruckIcon className="w-3.5 h-3.5 text-blue-500" />
                        {assignedTruck.plate_number}
                      </span>
                    ) : (
                      'بدون شاحنة مرتبطة'
                    )}
                  </span>
                </div>
              ) : (
                <>
                  <div className="flex justify-between items-center py-1">
                    <span className="text-muted-foreground">السائق المسند:</span>
                    <span className="font-semibold text-foreground">
                      {assignedDriver?.name || 'غير مسند'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-1">
                    <span className="text-muted-foreground">المقطورة المجرورة:</span>
                    <span className="font-semibold text-foreground">
                      {assignedTrailer ? assignedTrailer.plate_number : 'بدون مقطورة مرتبطة'}
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
          <div className="border border-border/60 rounded-2xl bg-[#171d25] overflow-hidden transition-all">
            <button
              type="button"
              onClick={() => setDocsOpen(!docsOpen)}
              className="w-full flex items-center justify-between p-4 hover:bg-muted/20 transition-colors text-right"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center">
                  <FileText className="w-4 h-4" />
                </div>
                <span className="font-bold text-sm text-foreground">
                  {isTruck ? 'وثائق الشاحنة' : 'وثائق المقطورة'}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-blue-500/15 text-blue-400 border border-blue-500/20">
                  {documents.length}
                </span>
              </div>

              {docsOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
            </button>

            {docsOpen && (
              <div className="p-4 pt-0 border-t border-border/30 space-y-3">
                <div className="flex justify-end pt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs rounded-xl"
                    onClick={() => setIsUploadOpen(true)}
                  >
                    <Plus className="w-3.5 h-3.5 ml-1" />
                    إضافة وثيقة
                  </Button>
                </div>

                {documents.length === 0 ? (
                  <div className="p-6 text-center text-xs text-muted-foreground border border-dashed border-border/60 rounded-xl">
                    لا توجد وثائق مسجلة بعد
                  </div>
                ) : (
                  <div className="space-y-2">
                    {documents.map((doc) => {
                      const label = DOCUMENT_TYPE_LABELS[doc.document_type]?.label_ar || doc.document_type;
                      const status = getDocStatusInfo(doc.expiry_date);

                      return (
                        <div
                          key={doc.id}
                          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl bg-[#11161d] border border-border/50 text-xs"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-foreground">{label}</span>
                              <span className={`px-2 py-0.5 rounded-md text-[10px] font-medium border ${status.badgeClass}`}>
                                {status.label}
                              </span>
                            </div>
                            <div className="text-muted-foreground text-[11px] font-mono flex items-center gap-3">
                              {doc.document_number && <span>رقم: {doc.document_number}</span>}
                              {doc.expiry_date && <span>تاريخ الانتهاء: {doc.expiry_date}</span>}
                            </div>
                            {doc.notes && <p className="text-muted-foreground text-[11px]">{doc.notes}</p>}
                          </div>

                          <div className="flex items-center gap-1.5 self-end sm:self-center">
                            {doc.file_url && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-[11px] text-muted-foreground hover:text-foreground"
                                onClick={() => window.open(doc.file_url, '_blank')}
                              >
                                <ExternalLink className="w-3.5 h-3.5 ml-1" />
                                عرض
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 px-2 text-[11px] rounded-lg"
                              onClick={() => {
                                setSelectedDocForRenew(doc);
                                setIsRenewOpen(true);
                              }}
                            >
                              <RefreshCw className="w-3 h-3 ml-1" />
                              تجديد
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
          <div className="border border-border/60 rounded-2xl bg-[#171d25] overflow-hidden transition-all">
            <button
              type="button"
              onClick={() => setMaintOpen(!maintOpen)}
              className="w-full flex items-center justify-between p-4 hover:bg-muted/20 transition-colors text-right"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center">
                  <Wrench className="w-4 h-4" />
                </div>
                <span className="font-bold text-sm text-foreground">
                  {isTruck ? 'صيانة الشاحنة' : 'صيانة المقطورة'}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-amber-500/15 text-amber-400 border border-amber-500/20">
                  {maintenanceRecords.length}
                </span>
              </div>

              {maintOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
            </button>

            {maintOpen && (
              <div className="p-4 pt-0 border-t border-border/30 space-y-2">
                {maintenanceRecords.length === 0 ? (
                  <div className="p-6 text-center text-xs text-muted-foreground border border-dashed border-border/60 rounded-xl mt-3">
                    لا توجد عمليات صيانة مسجلة لهذه المركبة بعد
                  </div>
                ) : (
                  <div className="space-y-2 mt-3">
                    {maintenanceRecords.map((m) => (
                      <div
                        key={m.id}
                        className="p-3 rounded-xl bg-[#11161d] border border-border/50 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-foreground">
                              {m.workshop_name || m.type || 'صيانة دورية وإصلاحات'}
                            </span>
                            <span className="font-mono text-muted-foreground text-[11px]">{m.date}</span>
                          </div>
                          {m.notes && <p className="text-muted-foreground text-[11px]">{m.notes}</p>}
                        </div>

                        <div className="font-mono font-bold text-emerald-500 self-end sm:self-center">
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
          <div className="border border-border/60 rounded-2xl bg-[#171d25] overflow-hidden transition-all">
            <button
              type="button"
              onClick={() => setTripsOpen(!tripsOpen)}
              className="w-full flex items-center justify-between p-4 hover:bg-muted/20 transition-colors text-right"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center">
                  <TruckIcon className="w-4 h-4" />
                </div>
                <span className="font-bold text-sm text-foreground">
                  سجل الرحلات
                </span>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-blue-500/15 text-blue-400 border border-blue-500/20">
                  {trips.length}
                </span>
              </div>

              {tripsOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
            </button>

            {tripsOpen && (
              <div className="p-4 pt-0 border-t border-border/30 space-y-2">
                {trips.length === 0 ? (
                  <div className="p-6 text-center text-xs text-muted-foreground border border-dashed border-border/60 rounded-xl mt-3">
                    لا توجد رحلات مسجلة لهذه المركبة بعد
                  </div>
                ) : (
                  <div className="space-y-2 mt-3">
                    {trips.map((t) => (
                      <div
                        key={t.id}
                        className="p-3 rounded-xl bg-[#11161d] border border-border/50 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-foreground">
                              #{t.id} • {t.route_export || t.route}
                            </span>
                            <span className="px-2 py-0.5 rounded text-[10px] bg-muted text-muted-foreground font-semibold">
                              {t.status}
                            </span>
                          </div>
                          <div className="text-[11px] text-muted-foreground flex items-center gap-3">
                            <span>الانطلاق: {t.departure_date}</span>
                            {t.cmr_number && <span>CMR: {t.cmr_number}</span>}
                          </div>
                        </div>

                        <div className="font-mono font-bold text-primary self-end sm:self-center">
                          {t.price?.toLocaleString()} {t.price_type || 'MAD'}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Bottom Summary Section matching screenshot ("السجل") */}
          <div className="bg-[#171d25] border border-border/60 rounded-2xl p-5 space-y-3">
            <h3 className="text-sm font-bold font-amiri text-foreground pb-2 border-b border-border/30">
              السجل
            </h3>

            <div className="space-y-2.5 text-xs">
              {/* Row 1: رحلات */}
              <div
                className="flex items-center justify-between p-2.5 rounded-xl hover:bg-muted/30 cursor-pointer transition-colors"
                onClick={() => setTripsOpen(!tripsOpen)}
              >
                <div className="flex items-center gap-2">
                  <TruckIcon className="w-4 h-4 text-blue-400" />
                  <span className="text-foreground font-medium">رحلات</span>
                </div>
                <span className="w-7 h-6 rounded-md bg-blue-500/15 text-blue-400 font-mono font-bold flex items-center justify-center text-xs">
                  {trips.length}
                </span>
              </div>

              {/* Row 2: صيانة */}
              <div
                className="flex items-center justify-between p-2.5 rounded-xl hover:bg-muted/30 cursor-pointer transition-colors"
                onClick={() => setMaintOpen(!maintOpen)}
              >
                <div className="flex items-center gap-2">
                  <Wrench className="w-4 h-4 text-amber-400" />
                  <span className="text-foreground font-medium">صيانة</span>
                </div>
                <span className="w-7 h-6 rounded-md bg-amber-500/15 text-amber-400 font-mono font-bold flex items-center justify-center text-xs">
                  {maintenanceRecords.length}
                </span>
              </div>

              {/* Row 3: وثائق */}
              <div
                className="flex items-center justify-between p-2.5 rounded-xl hover:bg-muted/30 cursor-pointer transition-colors"
                onClick={() => setDocsOpen(!docsOpen)}
              >
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-emerald-400" />
                  <span className="text-foreground font-medium">وثائق</span>
                </div>
                <span className="w-7 h-6 rounded-md bg-emerald-500/15 text-emerald-400 font-mono font-bold flex items-center justify-center text-xs">
                  {documents.length}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Upload Document Modal */}
      {isUploadOpen && (
        <DocumentUploadModal
          isOpen={isUploadOpen}
          onClose={() => setIsUploadOpen(false)}
          onSuccess={() => {
            setIsUploadOpen(false);
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
    </div>
  );
}
