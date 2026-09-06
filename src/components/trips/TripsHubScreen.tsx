'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  Plus,
  Search,
  Printer,
  Edit2,
  Download,
  Share2,
  PlaneTakeoff,
  PlaneLanding,
  MapPin,
  CheckCircle,
  ClipboardList,
  LayoutGrid,
  List,
  Calendar,
  Truck as TruckIcon,
  User as UserIcon,
  Eye,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { CMRPrintModal } from '@/components/cmr-print-modal';
import { MatriculeBadge } from '@/components/ui/matricule-badge';
import { TripFormModal } from '@/components/trip-form-modal';
import { TripOrderDetails } from '@/components/trips/TripOrderDetails';
import { SmartRouteAnalyzer } from '@/features/trips/components/SmartRouteAnalyzer';
import { exportToCSV } from '@/lib/export';
import { moveTripStage } from '@/app/actions/trip-actions';
import {
  DEFAULT_TRIPS,
  DEFAULT_CLIENTS,
  DEFAULT_DRIVERS,
  DEFAULT_TRUCKS,
  DEFAULT_TRAILERS,
  DEFAULT_CASH_BOXES,
  DEFAULT_ROUTES,
  fallbackArray,
} from '@/lib/default-data';
import { TripsKanbanSkeleton } from '@/components/skeletons';
import { mapDbStatusToKanbanStage } from '@/lib/utils/trip-status';
import { useLanguage } from '@/components/language-provider';
import type { TripOrder, Client, Driver, Truck as TruckType, Trailer, Advance, TransportRoute } from '@/types/database';
import {
  DndContext,
  useDraggable,
  useDroppable,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';

const KANBAN_STAGES = [
  { id: 'pendingAssignment', labelAr: 'قيد التعيين', labelFr: 'En attente', icon: ClipboardList, color: 'bg-amber-500', badgeClass: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30' },
  { id: 'outbound', labelAr: 'في طريق الذهاب', labelFr: 'Transit Aller', icon: PlaneTakeoff, color: 'bg-blue-500', badgeClass: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30' },
  { id: 'pendingReturn', labelAr: 'بانتظار العودة', labelFr: 'Attente Retour', icon: MapPin, color: 'bg-orange-500', badgeClass: 'bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/30' },
  { id: 'returnRoute', labelAr: 'في طريق العودة', labelFr: 'Transit Retour', icon: PlaneLanding, color: 'bg-indigo-500', badgeClass: 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border-indigo-500/30' },
  { id: 'settled', labelAr: 'مكتملة ومفوترة', labelFr: 'Clôturé & Facturé', icon: CheckCircle, color: 'bg-emerald-500', badgeClass: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30' },
];

interface KanbanColumnProps {
  stage: typeof KANBAN_STAGES[number];
  trips: TripOrder[];
  drivers: Driver[];
  trucks: TruckType[];
  trailers: Trailer[];
  onTripClick: (trip: TripOrder) => void;
  onEditTrip: (trip: TripOrder) => void;
  onPrintCMR: (trip: TripOrder) => void;
  onShare: (trip: TripOrder) => void;
}

function KanbanColumn({ stage, trips, drivers, trucks, trailers, onTripClick, onEditTrip, onPrintCMR, onShare }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });
  const { locale, t } = useLanguage();
  const Icon = stage.icon;
  const stageLabel = locale === 'fr' ? stage.labelFr : stage.labelAr;

  return (
    <div className="flex flex-col min-w-[280px] bg-muted/20 border border-border/70 rounded-2xl p-3">
      <div className="flex items-center justify-between mb-3 p-2.5 bg-card/80 backdrop-blur-xs rounded-xl border border-border shadow-2xs">
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded-lg ${stage.color} text-white shadow-xs`}>
            <Icon className="w-4 h-4" />
          </div>
          <p className="text-xs font-bold text-foreground font-amiri">{stageLabel}</p>
        </div>
        <span className="px-2 py-0.5 rounded-full text-xs font-bold font-mono bg-muted text-foreground border border-border">
          {trips.length}
        </span>
      </div>

      <div
        ref={setNodeRef}
        className={`flex-1 space-y-2.5 p-1 rounded-xl transition-colors ${
          isOver ? 'bg-primary/10 ring-2 ring-primary/30 ring-dashed' : 'bg-transparent'
        }`}
        style={{ minHeight: '350px' }}
      >
        {trips.map((trip) => (
          <TripCard
            key={trip.id}
            trip={trip}
            drivers={drivers}
            trucks={trucks}
            trailers={trailers}
            stage={stage}
            onTripClick={() => onTripClick(trip)}
            onEdit={() => onEditTrip(trip)}
            onPrint={() => onPrintCMR(trip)}
            onShare={() => onShare(trip)}
          />
        ))}

        {trips.length === 0 && (
          <div className="h-32 flex flex-col items-center justify-center border border-dashed border-border/80 rounded-xl text-center p-4 text-xs text-muted-foreground">
            <span>{t('لا توجد رحلات', 'Aucun voyage')}</span>
            <span className="text-[10px] text-muted-foreground/60 mt-1">{t('اسحب رحلة إلى هنا', 'Glissez un voyage ici')}</span>
          </div>
        )}
      </div>
    </div>
  );
}

interface TripCardProps {
  trip: TripOrder;
  drivers: Driver[];
  trucks: TruckType[];
  trailers: Trailer[];
  stage: typeof KANBAN_STAGES[number];
  onTripClick: () => void;
  onEdit: () => void;
  onPrint: () => void;
  onShare: () => void;
}

function TripCard({ trip, drivers, trucks, trailers, stage, onTripClick, onEdit, onPrint, onShare }: TripCardProps) {
  const { locale, t } = useLanguage();
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: String(trip.id),
    data: { trip, stage: stage.id },
  });

  const assignedDriver = drivers.find((d) => d.id === trip.driver_id);
  const assignedTruck = trucks.find((t) => t.id === trip.truck_id);
  const assignedTrailer = trailers.find((tr) => tr.id === trip.trailer_id);
  const stageLabel = locale === 'fr' ? stage.labelFr : stage.labelAr;

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
    zIndex: isDragging ? 1000 : undefined,
  } : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={onTripClick}
      className={`bg-card border border-border/80 rounded-xl p-3.5 shadow-2xs hover:shadow-md transition-all cursor-grab active:cursor-grabbing group relative ${
        isDragging ? 'shadow-xl ring-2 ring-primary opacity-90 scale-105' : ''
      }`}
    >
      <div className="space-y-2.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <span className="text-xs font-bold text-foreground font-amiri line-clamp-1 block">
              {trip.route_export || trip.route || (locale === 'fr' ? `Voyage #${trip.id}` : `رحلة #${trip.id}`)}
            </span>
            <span className="text-[10px] font-mono text-muted-foreground">
              #{trip.id} {trip.cmr_number ? `• CMR: ${trip.cmr_number}` : ''}
            </span>
          </div>
          <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border shrink-0 ${stage.badgeClass}`}>
            {stageLabel}
          </span>
        </div>

        <div className="space-y-1.5 text-xs text-muted-foreground bg-muted/30 p-2.5 rounded-lg border border-border/50">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-[11px]">
              <UserIcon className="w-3 h-3 text-muted-foreground/70" />
              {t('السائق:', 'Chauffeur :')}
            </span>
            <span className="font-semibold text-foreground truncate max-w-[120px]">
              {assignedDriver?.name || t('غير مسند', 'Non assigné')}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-[11px]">
              <TruckIcon className="w-3 h-3 text-muted-foreground/70" />
              {t('الشاحنة:', 'Camion :')}
            </span>
            <div className="flex items-center gap-1 flex-wrap justify-end">
              {assignedTruck?.plate_number ? (
                <MatriculeBadge plate={assignedTruck.plate_number} variant="badge" size="xs" />
              ) : (
                <span className="text-muted-foreground text-[11px]">—</span>
              )}
              {assignedTrailer?.plate_number && (
                <MatriculeBadge plate={assignedTrailer.plate_number} variant="subtle" size="xs" />
              )}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-[11px]">
              <Calendar className="w-3 h-3 text-muted-foreground/70" />
              {t('الانطلاق:', 'Départ :')}
            </span>
            <span className="font-mono text-foreground text-[11px]">{trip.departure_date || '—'}</span>
          </div>

          <div className="flex items-center justify-between pt-1 border-t border-border/40 font-mono">
            <span className="text-[11px] text-muted-foreground font-sans">{t('القيمة:', 'Montant :')}</span>
            <span className="font-bold text-emerald-600 dark:text-emerald-400">
              {(trip.price || 0).toLocaleString()} {trip.price_type || 'MAD'}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between pt-1">
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-xs text-primary hover:text-primary hover:bg-primary/10 rounded-lg flex items-center gap-1"
            onClick={(e) => { e.stopPropagation(); onTripClick(); }}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>{t('التفاصيل', 'Détails')}</span>
          </Button>

          <div className="flex gap-1">
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted" onClick={(e) => { e.stopPropagation(); onEdit(); }}>
              <Edit2 className="w-3 h-3" />
            </Button>
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted" onClick={(e) => { e.stopPropagation(); onPrint(); }}>
              <Printer className="w-3 h-3" />
            </Button>
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 rounded-lg text-muted-foreground hover:text-emerald-600 hover:bg-emerald-500/10" onClick={(e) => { e.stopPropagation(); onShare(); }}>
              <Share2 className="w-3 h-3" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

import { useTripsHubDataQuery } from '@/lib/query/hooks';
import { useQueryClient } from '@tanstack/react-query';

export default function TripsHubScreen() {
  const { data: hubData, isLoading } = useTripsHubDataQuery();
  const queryClient = useQueryClient();

  const trips = hubData?.trips || [];
  const clients = hubData?.clients || [];
  const drivers = hubData?.drivers || [];
  const trucks = hubData?.trucks || [];
  const trailers = hubData?.trailers || [];
  const advances = hubData?.advances || [];
  const cashBoxes = hubData?.cashBoxes || [];
  const transportRoutes = hubData?.transportRoutes || [];
  const loading = isLoading;

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStageFilter, setSelectedStageFilter] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'kanban' | 'table'>('kanban');
  const [showSmartAnalyzer, setShowSmartAnalyzer] = useState(false);

  const [activeCMRTrip, setActiveCMRTrip] = useState<TripOrder | null>(null);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingTrip, setEditingTrip] = useState<TripOrder | null>(null);
  const [selectedTrip, setSelectedTrip] = useState<TripOrder | null>(null);

  const { toast } = useToast();
  const { locale, dir, t } = useLanguage();
  const supabase = useMemo(() => createClient(), []);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const refreshData = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['trips-hub-data'] });
  }, [queryClient]);

  useEffect(() => {
    const channel = supabase
      .channel('trip-orders-kanban')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trip_orders' }, () => {
        refreshData();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [refreshData, supabase]);

  const handleSaveTrip = async (tripData: Partial<TripOrder>) => {
    try {
      if (editingTrip) {
        const { error } = await supabase.from('trip_orders').update(tripData).eq('id', editingTrip.id);
        if (error) throw error;
        toast({ title: t('تم تعديل بيانات الرحلة بنجاح', 'Données du voyage modifiées avec succès') });
      } else {
        const { error } = await supabase.from('trip_orders').insert(tripData);
        if (error) throw error;
        toast({ title: t('تم تسجيل الرحلة بنجاح', 'Voyage enregistré avec succès') });
      }
      refreshData();
    } catch (error: unknown) {
      toast({ title: t('خطأ أثناء الحفظ', 'Erreur d\'enregistrement'), description: (error as Error).message, variant: 'destructive' });
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { over, active } = event;
    if (!over || !active) return;
    const tripId = parseInt(active.id as string);
    const newStage = over.id as string;

    const result = await moveTripStage(tripId, newStage);
    if (result.success) {
      const targetStage = KANBAN_STAGES.find(s => s.id === newStage);
      const stageName = locale === 'fr' ? targetStage?.labelFr : targetStage?.labelAr;
      toast({ title: locale === 'fr' ? `Voyage déplacé vers "${stageName}"` : `تم نقل الرحلة إلى "${stageName}"` });
      refreshData();
    } else {
      toast({ title: t('خطأ', 'Erreur'), description: result.error, variant: 'destructive' });
    }
  };

  const handleExportExcel = () => {
    exportToCSV(
      filteredTrips,
      [
        { header: t('رقم الرحلة', 'N° Voyage'), key: 'id' },
        { header: t('المسار', 'Trajet'), key: 'route' },
        { header: t('رقم CMR', 'N° CMR'), key: (t: TripOrder) => t.cmr_number || 'N/A' },
        { header: t('تاريخ الانطلاق', 'Date départ'), key: 'departure_date' },
        { header: t('السعر', 'Prix'), key: 'price' },
        { header: t('العملة', 'Devise'), key: (t: TripOrder) => t.price_type || 'MAD' },
        { header: t('الحالة', 'Statut'), key: (t: TripOrder) => mapDbStatusToKanbanStage(t.status) },
      ],
      'قائمة_الرحلات_الدولية'
    );
    toast({ title: t('✅ تم تصدير بيانات الرحلات إلى ملف Excel بنجاح', '✅ Export Excel des voyages réussi') });
  };

  const stageCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const stage of KANBAN_STAGES) {
      counts[stage.id] = trips.filter((t) => mapDbStatusToKanbanStage(t.status) === stage.id).length;
    }
    return counts;
  }, [trips]);

  const filteredTrips = useMemo(() => {
    let result = trips;
    if (selectedStageFilter) result = result.filter((t) => mapDbStatusToKanbanStage(t.status) === selectedStageFilter);
    if (!searchQuery) return result;
    const q = searchQuery.toLowerCase();
    return result.filter(trip => 
        (trip.route ?? '').toLowerCase().includes(q) || 
        (trip.cmr_number ?? '').toLowerCase().includes(q) || 
        String(trip.id).includes(q)
    );
  }, [trips, selectedStageFilter, searchQuery]);

  const groupedTrips = useMemo(() => {
    const groups: Record<string, TripOrder[]> = {};
    for (const stage of KANBAN_STAGES) groups[stage.id] = [];
    filteredTrips.forEach((trip) => {
      const kanbanStage = mapDbStatusToKanbanStage(trip.status);
      if (groups[kanbanStage]) groups[kanbanStage].push(trip);
    });
    return groups;
  }, [filteredTrips]);

  const shareTrackingWhatsApp = (trip: TripOrder, clientPhone?: string) => {
    const trackingUrl = `${window.location.origin}/track/${trip.id}`;
    const message = locale === 'fr'
      ? `Bonjour, vous pouvez suivre le trajet de votre expédition (${trip.route || trip.id}) en direct via le lien suivant :\n${trackingUrl}`
      : `مرحباً، يمكنك متابعة خط سير شحنتكم (${trip.route || trip.id}) مباشرة عبر الرابط التالي:\n${trackingUrl}`;
    if (clientPhone) {
      window.open(`https://wa.me/${clientPhone.replace(/[^\d+]/g, '')}?text=${encodeURIComponent(message)}`, '_blank');
    } else {
      navigator.clipboard.writeText(trackingUrl).then(() => toast({ title: t('📋 تم نسخ رابط التتبع', '📋 Lien de suivi copié') }));
    }
  };

  return (
    <div className="space-y-6" dir={dir}>
      {/* Immediate Static Shell: Header & Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-amiri text-foreground">
            {t('إدارة الرحلات والشحنات الدولية', 'Gestion des Voyages et Expéditions Internationales')}
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t('متابعة حالة النقل الدولي وأوامر العمل', 'Suivi opérationnel des transports et ordres de mission')}
          </p>
        </div>
        <div className="flex items-center gap-2.5 flex-wrap">
          <Button
            size="sm"
            variant={showSmartAnalyzer ? 'default' : 'outline'}
            onClick={() => setShowSmartAnalyzer(!showSmartAnalyzer)}
            className={`h-9 rounded-xl text-xs gap-1.5 transition-all ${
              showSmartAnalyzer ? 'bg-amber-600 hover:bg-amber-700 text-white' : 'border-amber-500/40 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10'
            }`}
          >
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span>{t('المستشار الذكي (AI)', 'Conseiller Intelligent (IA)')}</span>
          </Button>

          <div className="flex items-center bg-muted/80 p-1 rounded-xl border border-border">
            <Button size="sm" variant={viewMode === 'kanban' ? 'default' : 'ghost'} className="h-8 px-3 text-xs" onClick={() => setViewMode('kanban')}>
              <LayoutGrid className={`w-3.5 h-3.5 ${dir === 'rtl' ? 'ml-1.5' : 'mr-1.5'}`} /> {t('لوحة كانبان', 'Tableau Kanban')}
            </Button>
            <Button size="sm" variant={viewMode === 'table' ? 'default' : 'ghost'} className="h-8 px-3 text-xs" onClick={() => setViewMode('table')}>
              <List className={`w-3.5 h-3.5 ${dir === 'rtl' ? 'ml-1.5' : 'mr-1.5'}`} /> {t('جدول الرحلات', 'Liste des voyages')}
            </Button>
          </div>
          <Button variant="outline" size="sm" onClick={handleExportExcel} className="h-9 rounded-xl text-xs">
            <Download className={`w-4 h-4 ${dir === 'rtl' ? 'ml-1.5' : 'mr-1.5'}`} /> {t('تصدير', 'Exporter')}
          </Button>
          <Button size="sm" onClick={() => { setEditingTrip(null); setIsFormModalOpen(true); }} className="h-9 rounded-xl text-xs">
            <Plus className={`w-4 h-4 ${dir === 'rtl' ? 'ml-1.5' : 'mr-1.5'}`} /> {t('رحلة جديدة', 'Nouveau voyage')}
          </Button>
        </div>
      </div>

      {/* Smart Route & Profit Optimizer */}
      {showSmartAnalyzer && (
        <div className="animate-in fade-in slide-in-from-top-4 duration-200">
          <SmartRouteAnalyzer />
        </div>
      )}

      {/* Immediate Static Shell: Stage Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => setSelectedStageFilter(null)} className={`px-3 py-1.5 rounded-xl text-xs font-semibold border ${selectedStageFilter === null ? 'bg-foreground text-background' : 'bg-card text-muted-foreground'}`}>
          {t('كافة الرحلات', 'Tous les voyages')}
        </button>
        {KANBAN_STAGES.map((stage) => {
          const stageName = locale === 'fr' ? stage.labelFr : stage.labelAr;
          return (
            <button key={stage.id} onClick={() => setSelectedStageFilter(selectedStageFilter === stage.id ? null : stage.id)} className={`px-3 py-1.5 rounded-xl text-xs font-semibold border ${selectedStageFilter === stage.id ? `${stage.color} text-white` : 'bg-card text-muted-foreground'}`}>
              {stageName} {loading ? '' : `(${stageCounts[stage.id] ?? 0})`}
            </button>
          );
        })}
      </div>

      {/* Search Input Shell */}
      <Input placeholder={t('بحث سريع...', 'Recherche rapide...')} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="rounded-xl" />

      {/* Dynamic Data Content / Skeleton */}
      {loading ? (
        <TripsKanbanSkeleton />
      ) : viewMode === 'kanban' ? (
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 overflow-x-auto pb-4">
            {KANBAN_STAGES.map((stage) => (
              <KanbanColumn key={stage.id} stage={stage} trips={groupedTrips[stage.id] || []} drivers={drivers} trucks={trucks} trailers={trailers} onTripClick={setSelectedTrip} onEditTrip={(t) => { setEditingTrip(t); setIsFormModalOpen(true); }} onPrintCMR={setActiveCMRTrip} onShare={(t) => shareTrackingWhatsApp(t, clients.find(c => c.id === t.client_id)?.phone)} />
            ))}
          </div>
        </DndContext>
      ) : (
        <Card className="p-0 overflow-hidden">
          <table className={`w-full text-xs ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
            <thead className="bg-muted text-muted-foreground uppercase border-b border-border">
              <tr>
                <th className="px-4 py-3">{t('الرحلة', 'Voyage')}</th>
                <th className="px-4 py-3">{t('المسار', 'Trajet')}</th>
                <th className="px-4 py-3">{t('السائق', 'Chauffeur')}</th>
                <th className="px-4 py-3">{t('القيمة', 'Montant')}</th>
                <th className="px-4 py-3 text-center">{t('الإجراءات', 'Actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredTrips.map(trip => (
                <tr key={trip.id} className="hover:bg-muted/50 cursor-pointer" onClick={() => setSelectedTrip(trip)}>
                  <td className="px-4 py-3 font-mono">#{trip.id}</td>
                  <td className="px-4 py-3">{trip.route}</td>
                  <td className="px-4 py-3">{drivers.find(d => d.id === trip.driver_id)?.name || t('غير مسند', 'Non assigné')}</td>
                  <td className="px-4 py-3 font-mono font-bold text-emerald-600 dark:text-emerald-400">{trip.price?.toLocaleString()}</td>
                  <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="sm" onClick={() => setActiveCMRTrip(trip)}><Printer className="w-4 h-4" /></Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {isFormModalOpen && (
        <TripFormModal
          isOpen={isFormModalOpen}
          onClose={() => {
            setIsFormModalOpen(false);
            setEditingTrip(null);
          }}
          onSubmit={handleSaveTrip}
          clients={clients}
          drivers={drivers}
          trucks={trucks}
          trailers={trailers}
          transportRoutes={transportRoutes}
          initialData={editingTrip}
        />
      )}
      {activeCMRTrip && <CMRPrintModal isOpen={!!activeCMRTrip} onClose={() => setActiveCMRTrip(null)} trip={activeCMRTrip} client={clients.find(c => c.id === activeCMRTrip.client_id)} driver={drivers.find(d => d.id === activeCMRTrip.driver_id)} truck={trucks.find(t => t.id === activeCMRTrip.truck_id)} trailer={trailers.find(tr => tr.id === activeCMRTrip.trailer_id)} />}
      {selectedTrip && (
        <TripOrderDetails
          trip={selectedTrip}
          clients={clients}
          drivers={drivers}
          trucks={trucks}
          trailers={trailers}
          advances={advances}
          cashBoxes={cashBoxes}
          onClose={() => setSelectedTrip(null)}
          onUpdate={(t: TripOrder) => {
            queryClient.setQueryData(['trips-hub-data'], (old: any) => {
              if (!old) return old;
              return {
                ...old,
                trips: (old.trips || []).map((p: TripOrder) => (p.id === t.id ? t : p)),
              };
            });
            setSelectedTrip(t);
          }}
        />
      )}
    </div>
  );
}
