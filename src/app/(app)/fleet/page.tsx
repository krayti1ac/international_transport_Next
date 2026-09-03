'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import type { Truck, Driver, Trailer } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import {
  Plus,
  Search,
  Truck as TruckIcon,
  Warehouse,
  Edit2,
  Trash2,
  Activity,
  FileText,
} from 'lucide-react';
import { FleetFormModal } from '@/components/fleet-form-modal';
import { MatriculeBadge } from '@/components/ui/matricule-badge';
import { CardViewToggle, useCardViewMode } from '@/components/ui/card-view-toggle';
import { VehicleDetailsModal } from '@/features/fleet/components/VehicleDetailsModal';
import { DEFAULT_TRUCKS, DEFAULT_DRIVERS, DEFAULT_TRAILERS, fallbackArray } from '@/lib/default-data';

type TabType = 'trucks' | 'trailers';
type EntityType = 'truck' | 'trailer';

export default function FleetPage() {
  const [activeTab, setActiveTab] = useState<TabType>('trucks');
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [trailers, setTrailers] = useState<Trailer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [cardLayout, setCardLayout] = useCardViewMode('fleet', 'grid');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [selectedDetailsVehicle, setSelectedDetailsVehicle] = useState<{ entity: Truck | Trailer; type: EntityType } | null>(null);

  const { toast } = useToast();
  const supabase = useMemo(() => createClient(), []);

  const fetchData = useCallback(async () => {
    try {
      const [trucksRes, driversRes, trailersRes] = await Promise.all([
        supabase.from('trucks').select('*').order('plate_number'),
        supabase.from('drivers').select('*').order('name'),
        supabase.from('trailers').select('*').order('plate_number'),
      ]);

      if (trucksRes.error) throw trucksRes.error;
      if (driversRes.error) throw driversRes.error;
      if (trailersRes.error) throw trailersRes.error;

      setTrucks(fallbackArray(trucksRes.data, DEFAULT_TRUCKS));
      setDrivers(fallbackArray(driversRes.data, DEFAULT_DRIVERS));
      setTrailers(fallbackArray(trailersRes.data, DEFAULT_TRAILERS));
    } catch {
      setTrucks((prev) => fallbackArray(prev, DEFAULT_TRUCKS));
      setDrivers((prev) => fallbackArray(prev, DEFAULT_DRIVERS));
      setTrailers((prev) => fallbackArray(prev, DEFAULT_TRAILERS));
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchData();

    const channel = supabase
      .channel('fleet-realtime-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trucks' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'drivers' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trailers' }, () => fetchData())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchData, supabase]);

  const handleSaveItem = async (type: EntityType, data: any) => {
    const tableName = type === 'truck' ? 'trucks' : 'trailers';
    try {
      // 1. If assigning a driver or trailer to a truck, release it from any previously assigned truck
      if (type === 'truck') {
        if (data.default_driver_id) {
          try {
            await supabase
              .from('trucks')
              .update({ default_driver_id: null })
              .eq('default_driver_id', data.default_driver_id)
              .neq('id', data.id || -1);
          } catch (e) {
            console.warn('Releasing previous driver assignment:', e);
          }

          setTrucks((prev) =>
            prev.map((t) =>
              t.id !== data.id && t.default_driver_id === data.default_driver_id
                ? { ...t, default_driver_id: undefined }
                : t
            )
          );
        }

        if (data.default_trailer_id) {
          try {
            await supabase
              .from('trucks')
              .update({ default_trailer_id: null })
              .eq('default_trailer_id', data.default_trailer_id)
              .neq('id', data.id || -1);
          } catch (e) {
            console.warn('Releasing previous trailer assignment:', e);
          }

          setTrucks((prev) =>
            prev.map((t) =>
              t.id !== data.id && t.default_trailer_id === data.default_trailer_id
                ? { ...t, default_trailer_id: undefined }
                : t
            )
          );
        }
      }

      // 2. Save current entity
      const executeSave = async (payload: any) => {
        if (payload.id) {
          return await supabase.from(tableName).update(payload).eq('id', payload.id);
        } else {
          return await supabase.from(tableName).insert(payload);
        }
      };

      let currentData = { ...data };
      let { error } = await executeSave(currentData);

      // Handle schema column mismatches (e.g. power, weight_capacity) if not present in remote schema cache
      while (error && error.message && error.message.includes('in the schema cache')) {
        const match = error.message.match(/Could not find the '([^']+)' column/);
        if (match && match[1] && match[1] in currentData) {
          delete currentData[match[1]];
          const retryRes = await executeSave(currentData);
          error = retryRes.error;
        } else {
          break;
        }
      }

      if (error) throw error;
      toast({ title: data.id ? 'تم تحديث البيانات بنجاح' : 'تمت الإضافة بنجاح' });
      fetchData();
    } catch (error: any) {
      toast({
        title: 'خطأ أثناء الحفظ',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleDeleteItem = async (type: TabType, id: number) => {
    if (!confirm('هل أنت متأكد من رغبتك في حذف هذا العنصر؟')) return;
    const tableName = type === 'trucks' ? 'trucks' : 'trailers';

    try {
      const { error } = await supabase.from(tableName).delete().eq('id', id);
      if (error) throw error;
      toast({ title: 'تم الحذف بنجاح' });
      fetchData();
    } catch (error: any) {
      toast({
        title: 'خطأ أثناء الحذف',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25';
      case 'in_maintenance':
      case 'maintenance':
        return 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/25';
      case 'in_trip':
        return 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/25';
      case 'vacation':
        return 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/25';
      case 'inactive':
        return 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/25';
      default:
        return 'bg-slate-500/15 text-slate-600 dark:text-slate-400 border border-slate-500/25';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'active':
        return 'نشط ومتاح';
      case 'in_maintenance':
      case 'maintenance':
        return 'في الصيانة';
      case 'in_trip':
        return 'في رحلة';
      case 'vacation':
        return 'في إجازة';
      case 'inactive':
        return 'متوقف';
      default:
        return status || 'غير محدد';
    }
  };

  const activeTrucksCount = trucks.filter((t) => t.status === 'active' || t.status === 'in_trip').length;
  const inTripTrucksCount = trucks.filter((t) => t.status === 'in_trip').length;
  const currentEntityType: EntityType = activeTab === 'trucks' ? 'truck' : 'trailer';

  return (
    <div className="space-y-6 max-w-7xl mx-auto" dir="rtl">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-2 border-b border-border/40">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            <span>إدارة الأسطول واللوجستيات</span>
          </div>
          <h1 className="text-2xl lg:text-3xl font-bold font-amiri tracking-tight text-foreground">
            المركبات والمقطورات
          </h1>
          <p className="text-muted-foreground text-xs sm:text-sm mt-1">
            متابعة دقيقة لحالة الأسطول، الشاحنات والمقطورات، تراخيص التأمين والفحص الدوري.
          </p>
        </div>

        <Button
          onClick={() => {
            setEditingItem(null);
            setIsModalOpen(true);
          }}
          className="bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 shadow-md font-medium text-xs sm:text-sm rounded-xl h-10 px-4 transition-all"
        >
          <Plus className="w-4 h-4 ml-2" />
          {activeTab === 'trucks' ? 'إضافة شاحنة جديدة' : 'إضافة مقطورة جديدة'}
        </Button>
      </div>

      {/* Bento Grid Fleet KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-card border border-border/80 p-4 rounded-2xl flex items-center justify-between shadow-xs">
          <div>
            <span className="text-xs font-bold text-muted-foreground uppercase">الشاحنات المتاحة</span>
            <div className="text-2xl font-extrabold font-mono text-foreground mt-1">
              {activeTrucksCount} <span className="text-xs text-muted-foreground font-normal">/ {trucks.length}</span>
            </div>
            <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">جاهزية تشغيلية عالية</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
            <TruckIcon className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-card border border-border/80 p-4 rounded-2xl flex items-center justify-between shadow-xs">
          <div>
            <span className="text-xs font-bold text-muted-foreground uppercase">شاحنات في رحلات نشطة</span>
            <div className="text-2xl font-extrabold font-mono text-foreground mt-1">
              {inTripTrucksCount} <span className="text-xs text-muted-foreground font-normal">/ {trucks.length}</span>
            </div>
            <span className="text-[11px] text-blue-600 dark:text-blue-400 font-medium">عمليات شحن دولية ومحلية</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
            <Activity className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-card border border-border/80 p-4 rounded-2xl flex items-center justify-between shadow-xs">
          <div>
            <span className="text-xs font-bold text-muted-foreground uppercase">المقطورات المسجلة</span>
            <div className="text-2xl font-extrabold font-mono text-foreground mt-1">
              {trailers.length} <span className="text-xs text-muted-foreground font-normal">مقطورة</span>
            </div>
            <span className="text-[11px] text-purple-600 dark:text-purple-400 font-medium">نقل دولي مبرد وجاف</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
            <Warehouse className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Tabs & Search Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-muted/40 p-2 rounded-2xl border border-border/60">
        <div className="flex gap-1.5 bg-card p-1 rounded-xl border border-border/60 shadow-2xs">
          <button
            onClick={() => setActiveTab('trucks')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
              activeTab === 'trucks'
                ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <TruckIcon className="w-3.5 h-3.5" />
            <span>الشاحنات ({trucks.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('trailers')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
              activeTab === 'trailers'
                ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Warehouse className="w-3.5 h-3.5" />
            <span>المقطورات ({trailers.length})</span>
          </button>
        </div>

        {/* Controls: View Mode Bascule & Search */}
        <div className="flex items-center gap-2 flex-1 max-w-lg justify-end">
          <CardViewToggle viewMode={cardLayout} onChange={setCardLayout} />

          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="بحث بالرقم، اللوحة، أو الموديل..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pr-9 h-9 text-xs rounded-xl bg-card border-border/80"
            />
          </div>
        </div>
      </div>

      {/* Main Content (Grid Cards vs List View Cards) */}
      {loading ? (
        <div className="text-center py-16 bg-card rounded-2xl border border-border">
          <p className="text-xs text-muted-foreground">جاري تحميل بيانات الأسطول...</p>
        </div>
      ) : cardLayout === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Trucks Tab */}
          {activeTab === 'trucks' &&
            trucks
              .filter(
                (truck) =>
                  truck.plate_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  truck.model?.toLowerCase().includes(searchQuery.toLowerCase())
              )
              .map((truck) => (
                <Card
                  key={truck.id}
                  className="rounded-2xl border border-border/80 bg-card hover:shadow-md transition-all flex flex-col justify-between overflow-hidden group"
                >
                  <div>
                    <CardHeader className="p-4 pb-3 border-b border-border/40 bg-muted/20">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                            <TruckIcon className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="mb-0.5">
                              <Link href={`/fleet/${truck.id}?type=truck`} className="hover:opacity-80 transition-opacity">
                                <MatriculeBadge plate={truck.plate_number} variant="badge" size="sm" />
                              </Link>
                            </div>
                            <span className="text-[11px] text-muted-foreground">{truck.model || 'شاحنة نقل دولي'}</span>
                          </div>
                        </div>
                        <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${getStatusColor(truck.status)}`}>
                          {getStatusText(truck.status)}
                        </span>
                      </div>
                    </CardHeader>
                    <CardContent className="p-4 space-y-2.5 text-xs">
                      <div className="flex justify-between py-1 border-b border-border/30">
                        <span className="text-muted-foreground">السائق المسند:</span>
                        <span className="font-semibold text-foreground">
                          {drivers.find((d) => d.id === truck.default_driver_id)?.name || truck.default_driver_name || 'غير مسند'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-1 border-b border-border/30 gap-2">
                        <span className="text-muted-foreground shrink-0">المقطورة المجرورة:</span>
                        <span className="font-semibold text-foreground text-left">
                          {(() => {
                            const trl = trailers.find((t) => t.id === truck.default_trailer_id);
                            if (!trl) return <span className="text-muted-foreground">غير مسندة</span>;
                            return <MatriculeBadge plate={trl.plate_number} variant="badge" size="xs" />;
                          })()}
                        </span>
                      </div>
                      {truck.weight_capacity && (
                        <div className="flex justify-between py-1 border-b border-border/30">
                          <span className="text-muted-foreground">سعة الحمولة:</span>
                          <span className="font-mono font-bold text-foreground">{truck.weight_capacity} طن</span>
                        </div>
                      )}
                      <div className="flex justify-between py-1">
                        <span className="text-muted-foreground">الموقع الحالي:</span>
                        <span className="font-mono text-foreground text-[11px]">{truck.current_location || 'المقر الرئيسي'}</span>
                      </div>
                    </CardContent>
                  </div>
                  <div className="flex gap-2 p-3 border-t border-border/40 bg-muted/10">
                    <Button
                      variant="secondary"
                      size="sm"
                      className="flex-1 text-xs rounded-xl h-8 bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 dark:text-blue-400 font-medium"
                      onClick={() => setSelectedDetailsVehicle({ entity: truck, type: 'truck' })}
                    >
                      <FileText className="w-3.5 h-3.5 ml-1" />
                      السجلات
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditingItem(truck);
                        setIsModalOpen(true);
                      }}
                    >
                      <Edit2 className="w-3.5 h-3.5 ml-1" />
                      تعديل
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs text-destructive hover:bg-destructive/10 rounded-xl h-8 px-2.5"
                      onClick={() => handleDeleteItem('trucks', truck.id)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </Card>
              ))}

          {/* Trailers Tab */}
          {activeTab === 'trailers' &&
            trailers
              .filter(
                (trailer) =>
                  trailer.plate_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  trailer.model?.toLowerCase().includes(searchQuery.toLowerCase())
              )
              .map((trailer) => (
                <Card
                  key={trailer.id}
                  className="rounded-2xl border border-border/80 bg-card hover:shadow-md transition-all flex flex-col justify-between overflow-hidden"
                >
                  <div>
                    <CardHeader className="p-4 pb-3 border-b border-border/40 bg-muted/20">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                            <Warehouse className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="mb-0.5">
                              <Link href={`/fleet/${trailer.id}?type=trailer`} className="hover:opacity-80 transition-opacity">
                                <MatriculeBadge plate={trailer.plate_number} variant="badge" size="sm" />
                              </Link>
                            </div>
                            <span className="text-[11px] text-muted-foreground">{trailer.model || 'مقطورة شحن'}</span>
                          </div>
                        </div>
                        <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${getStatusColor(trailer.status)}`}>
                          {getStatusText(trailer.status)}
                        </span>
                      </div>
                    </CardHeader>
                    <CardContent className="p-4 space-y-2.5 text-xs">
                      {(() => {
                        const assignedTruck = trucks.find((t) => t.default_trailer_id === trailer.id);
                        const assignedDriver = assignedTruck
                          ? drivers.find((d) => d.id === assignedTruck.default_driver_id)
                          : null;
                        return (
                          <>
                            <div className="flex justify-between py-1 border-b border-border/30">
                              <span className="text-muted-foreground">الشاحنة المرتبطة:</span>
                              <span className="font-semibold text-foreground">
                                {assignedTruck ? (
                                  <MatriculeBadge plate={assignedTruck.plate_number} variant="badge" size="sm" />
                                ) : (
                                  <span className="text-muted-foreground">غير مسندة</span>
                                )}
                              </span>
                            </div>
                            <div className="flex justify-between py-1 border-b border-border/30">
                              <span className="text-muted-foreground">السائق المرتبط:</span>
                              <span className="font-semibold text-foreground">
                                {assignedDriver?.name || 'غير مسند'}
                              </span>
                            </div>
                            <div className="flex justify-between py-1">
                              <span className="text-muted-foreground">الموقع:</span>
                              <span className="font-mono text-foreground text-[11px]">
                                {assignedTruck?.current_location || 'المقر الرئيسي'}
                              </span>
                            </div>
                            <div className="flex justify-between py-1">
                              <span className="text-muted-foreground">الفحص الفني:</span>
                              <span className="font-mono text-muted-foreground text-[11px]">ساري المفعول</span>
                            </div>
                          </>
                        );
                      })()}
                    </CardContent>
                  </div>
                  <div className="flex gap-2 p-3 border-t border-border/40 bg-muted/10">
                    <Button
                      variant="secondary"
                      size="sm"
                      className="flex-1 text-xs rounded-xl h-8 bg-purple-500/10 text-purple-600 hover:bg-purple-500/20 dark:text-purple-400 font-medium"
                      onClick={() => setSelectedDetailsVehicle({ entity: trailer, type: 'trailer' })}
                    >
                      <FileText className="w-3.5 h-3.5 ml-1" />
                      السجلات
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditingItem(trailer);
                        setIsModalOpen(true);
                      }}
                    >
                      <Edit2 className="w-3.5 h-3.5 ml-1" />
                      تعديل
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs text-destructive hover:bg-destructive/10 rounded-xl h-8 px-2.5"
                      onClick={() => handleDeleteItem('trailers', trailer.id)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </Card>
              ))}
        </div>
      ) : (
        /* List View Cards */
        <div className="flex flex-col gap-3">
          {/* Trucks List Cards */}
          {activeTab === 'trucks' &&
            trucks
              .filter(
                (truck) =>
                  truck.plate_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  truck.model?.toLowerCase().includes(searchQuery.toLowerCase())
              )
              .map((truck) => (
                <Card
                  key={truck.id}
                  className="rounded-2xl border border-border/80 bg-card hover:shadow-md transition-all overflow-hidden"
                >
                  <div className="p-3.5 flex flex-col lg:flex-row lg:items-center justify-between gap-3.5">
                    {/* Right: Plate & Model */}
                    <div className="flex items-center gap-3 min-w-[220px]">
                      <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                        <TruckIcon className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="mb-0.5">
                          <Link href={`/fleet/${truck.id}?type=truck`} className="hover:opacity-80 transition-opacity">
                            <MatriculeBadge plate={truck.plate_number} variant="badge" size="sm" />
                          </Link>
                        </div>
                        <span className="text-[11px] text-muted-foreground">{truck.model || 'شاحنة نقل دولي'}</span>
                      </div>
                    </div>

                    {/* Middle: Driver, Trailer, Weight, Location */}
                    <div className="flex flex-wrap items-center gap-3 text-xs">
                      <div className="bg-muted/30 px-3 py-1.5 rounded-xl border border-border/40 flex items-center gap-1.5">
                        <span className="text-muted-foreground text-[11px]">السائق:</span>
                        <span className="font-semibold text-foreground">
                          {drivers.find((d) => d.id === truck.default_driver_id)?.name || truck.default_driver_name || 'غير مسند'}
                        </span>
                      </div>

                      <div className="bg-muted/30 px-3 py-1.5 rounded-xl border border-border/40 flex items-center gap-1.5">
                        <span className="text-muted-foreground text-[11px]">المقطورة:</span>
                        {(() => {
                          const trl = trailers.find((t) => t.id === truck.default_trailer_id);
                          if (!trl) return <span className="text-muted-foreground text-[11px]">غير مسندة</span>;
                          return <MatriculeBadge plate={trl.plate_number} variant="badge" size="xs" />;
                        })()}
                      </div>

                      {truck.weight_capacity && (
                        <div className="bg-muted/30 px-3 py-1.5 rounded-xl border border-border/40 flex items-center gap-1.5">
                          <span className="text-muted-foreground text-[11px]">الحمولة:</span>
                          <span className="font-mono font-bold text-foreground">{truck.weight_capacity} طن</span>
                        </div>
                      )}

                      <div className="bg-muted/30 px-3 py-1.5 rounded-xl border border-border/40 flex items-center gap-1.5">
                        <span className="text-muted-foreground text-[11px]">الموقع:</span>
                        <span className="font-mono text-foreground text-[11px]">{truck.current_location || 'المقر الرئيسي'}</span>
                      </div>
                    </div>

                    {/* Left: Status & Actions */}
                    <div className="flex items-center justify-between lg:justify-end gap-2.5 border-t lg:border-t-0 pt-2.5 lg:pt-0 border-border/40">
                      <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${getStatusColor(truck.status)}`}>
                        {getStatusText(truck.status)}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <Button
                          variant="secondary"
                          size="sm"
                          className="text-xs rounded-xl h-8 px-3 bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 dark:text-blue-400 font-medium"
                          onClick={() => setSelectedDetailsVehicle({ entity: truck, type: 'truck' })}
                        >
                          <FileText className="w-3.5 h-3.5 ml-1" />
                          السجلات
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs rounded-xl h-8 px-3"
                          onClick={() => {
                            setEditingItem(truck);
                            setIsModalOpen(true);
                          }}
                        >
                          <Edit2 className="w-3.5 h-3.5 ml-1" />
                          تعديل
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs text-destructive hover:bg-destructive/10 rounded-xl h-8 px-2.5"
                          onClick={() => handleDeleteItem('trucks', truck.id)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}

          {/* Trailers List Cards */}
          {activeTab === 'trailers' &&
            trailers
              .filter(
                (trailer) =>
                  trailer.plate_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  trailer.model?.toLowerCase().includes(searchQuery.toLowerCase())
              )
              .map((trailer) => (
                <Card
                  key={trailer.id}
                  className="rounded-2xl border border-border/80 bg-card hover:shadow-md transition-all overflow-hidden"
                >
                  <div className="p-3.5 flex flex-col lg:flex-row lg:items-center justify-between gap-3.5">
                    {/* Right: Plate & Model */}
                    <div className="flex items-center gap-3 min-w-[220px]">
                      <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                        <Warehouse className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="mb-0.5">
                          <Link href={`/fleet/${trailer.id}?type=trailer`} className="hover:opacity-80 transition-opacity">
                            <MatriculeBadge plate={trailer.plate_number} variant="badge" size="sm" />
                          </Link>
                        </div>
                        <span className="text-[11px] text-muted-foreground">{trailer.model || 'مقطورة شحن'}</span>
                      </div>
                    </div>

                    {/* Middle: Truck & Driver */}
                    <div className="flex flex-wrap items-center gap-3 text-xs">
                      {(() => {
                        const assignedTruck = trucks.find((t) => t.default_trailer_id === trailer.id);
                        const assignedDriver = assignedTruck
                          ? drivers.find((d) => d.id === assignedTruck.default_driver_id)
                          : null;
                        return (
                          <>
                            <div className="bg-muted/30 px-3 py-1.5 rounded-xl border border-border/40 flex items-center gap-1.5">
                              <span className="text-muted-foreground text-[11px]">الشاحنة:</span>
                              {assignedTruck ? (
                                <MatriculeBadge plate={assignedTruck.plate_number} variant="badge" size="xs" />
                              ) : (
                                <span className="text-muted-foreground text-[11px]">غير مسندة</span>
                              )}
                            </div>
                            <div className="bg-muted/30 px-3 py-1.5 rounded-xl border border-border/40 flex items-center gap-1.5">
                              <span className="text-muted-foreground text-[11px]">السائق:</span>
                              <span className="font-semibold text-foreground">
                                {assignedDriver?.name || 'غير مسند'}
                              </span>
                            </div>
                            <div className="bg-muted/30 px-3 py-1.5 rounded-xl border border-border/40 flex items-center gap-1.5">
                              <span className="text-muted-foreground text-[11px]">الموقع:</span>
                              <span className="font-mono text-foreground text-[11px]">
                                {assignedTruck?.current_location || 'المقر الرئيسي'}
                              </span>
                            </div>
                          </>
                        );
                      })()}
                    </div>

                    {/* Left: Status & Actions */}
                    <div className="flex items-center justify-between lg:justify-end gap-2.5 border-t lg:border-t-0 pt-2.5 lg:pt-0 border-border/40">
                      <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${getStatusColor(trailer.status)}`}>
                        {getStatusText(trailer.status)}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <Button
                          variant="secondary"
                          size="sm"
                          className="text-xs rounded-xl h-8 px-3 bg-purple-500/10 text-purple-600 hover:bg-purple-500/20 dark:text-purple-400 font-medium"
                          onClick={() => setSelectedDetailsVehicle({ entity: trailer, type: 'trailer' })}
                        >
                          <FileText className="w-3.5 h-3.5 ml-1" />
                          السجلات
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs rounded-xl h-8 px-3"
                          onClick={() => {
                            setEditingItem(trailer);
                            setIsModalOpen(true);
                          }}
                        >
                          <Edit2 className="w-3.5 h-3.5 ml-1" />
                          تعديل
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs text-destructive hover:bg-destructive/10 rounded-xl h-8 px-2.5"
                          onClick={() => handleDeleteItem('trailers', trailer.id)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
        </div>
      )}

      {/* Modal */}
      <FleetFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        entityType={currentEntityType}
        initialData={editingItem}
        driversList={drivers}
        trucksList={trucks}
        trailersList={trailers}
        onSave={(type, data) => handleSaveItem(type as any, data)}
      />

      {selectedDetailsVehicle && (
        <VehicleDetailsModal
          isOpen={!!selectedDetailsVehicle}
          vehicle={selectedDetailsVehicle.entity}
          vehicleType={selectedDetailsVehicle.type}
          allTrucks={trucks}
          allTrailers={trailers}
          allDrivers={drivers}
          onClose={() => setSelectedDetailsVehicle(null)}
          onEdit={(v) => {
            setSelectedDetailsVehicle(null);
            setEditingItem(v);
            setIsModalOpen(true);
          }}
          onDelete={async (type, id) => {
            setSelectedDetailsVehicle(null);
            await handleDeleteItem(type === 'truck' ? 'trucks' : 'trailers', id);
          }}
          onRefresh={fetchData}
        />
      )}
    </div>
  );
}
