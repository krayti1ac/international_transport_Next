'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { TripOrder } from '@/types/database';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import {
  Loader2,
  CheckCircle2,
  MapPin,
  Truck,
  User,
  Calendar,
  Search,
  FileText,
  ArrowRight,
  AlertCircle,
} from 'lucide-react';
import { DriverDeliveryScreen } from '@/features/trips/components/DriverDeliveryScreen';
import { CardViewToggle, useCardViewMode } from '@/components/ui/card-view-toggle';

function getStatusBadge(status: string) {
  switch (status) {
    case 'in_transit':
      return {
        label: 'في الطريق',
        className: 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/25',
      };
    case 'completed':
      return {
        label: 'مكتملة',
        className: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/25',
      };
    case 'pending':
      return {
        label: 'قيد الانتظار',
        className: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/25',
      };
    case 'cancelled':
      return {
        label: 'ملغية',
        className: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/25',
      };
    default:
      return {
        label: status || 'غير محدد',
        className: 'bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/25',
      };
  }
}

function DriverDeliveryContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const tripId = searchParams.get('tripId');
  const { toast } = useToast();
  const supabase = useMemo(() => createClient(), []);

  // Single trip state
  const [trip, setTrip] = useState<TripOrder | null>(null);
  const [loadingTrip, setLoadingTrip] = useState(false);
  const [tripError, setTripError] = useState<string | null>(null);

  // Trips list state (when no tripId provided)
  const [tripsList, setTripsList] = useState<TripOrder[]>([]);
  const [driversMap, setDriversMap] = useState<Record<number, string>>({});
  const [trucksMap, setTrucksMap] = useState<Record<number, string>>({});
  const [loadingList, setLoadingList] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'completed'>('active');
  const [cardLayout, setCardLayout] = useCardViewMode('driver_delivery_trips', 'grid');

  // Load single trip if tripId is present
  useEffect(() => {
    if (!tripId) {
      setTrip(null);
      setTripError(null);
      setLoadingTrip(false);
      return;
    }

    let cancelled = false;
    setLoadingTrip(true);
    setTripError(null);

    const fetchTrip = async () => {
      try {
        const id = parseInt(tripId, 10);
        if (isNaN(id)) {
          throw new Error('معرف الرحلة غير صالح');
        }

        const { data, error } = await supabase
          .from('trip_orders')
          .select('*')
          .eq('id', id)
          .single();

        if (cancelled) return;
        if (error) throw error;
        setTrip(data);
      } catch (error) {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : 'لم يتم العثور على الرحلة';
        setTripError(message);
        toast({ title: 'خطأ', description: message, variant: 'destructive' });
      } finally {
        if (!cancelled) setLoadingTrip(false);
      }
    };

    fetchTrip();

    return () => {
      cancelled = true;
    };
  }, [tripId, supabase, toast]);

  // Load trips list if NO tripId is present
  useEffect(() => {
    if (tripId) return;

    let cancelled = false;
    setLoadingList(true);

    const fetchTripsAndMeta = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();

        // Check if user is associated with a driver
        let driverId: number | null = null;
        if (session?.user) {
          const { data: driverData } = await supabase
            .from('drivers')
            .select('id')
            .eq('user_id', session.user.id)
            .maybeSingle();

          if (driverData?.id) {
            driverId = driverData.id;
          }
        }

        // Fetch trips
        let tripsQuery = supabase
          .from('trip_orders')
          .select('*')
          .order('departure_date', { ascending: false });

        if (driverId) {
          tripsQuery = tripsQuery.eq('driver_id', driverId);
        } else {
          tripsQuery = tripsQuery.limit(100);
        }

        const [tripsRes, driversRes, trucksRes] = await Promise.all([
          tripsQuery,
          supabase.from('drivers').select('id, name'),
          supabase.from('trucks').select('id, plate_number'),
        ]);

        if (cancelled) return;

        if (tripsRes.error) throw tripsRes.error;
        setTripsList(tripsRes.data || []);

        if (driversRes.data) {
          const dMap: Record<number, string> = {};
          driversRes.data.forEach((d) => {
            dMap[d.id] = d.name;
          });
          setDriversMap(dMap);
        }

        if (trucksRes.data) {
          const tMap: Record<number, string> = {};
          trucksRes.data.forEach((t) => {
            tMap[t.id] = t.plate_number;
          });
          setTrucksMap(tMap);
        }
      } catch (error) {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : 'حدث خطأ أثناء تحميل الرحلات';
        toast({ title: 'خطأ', description: message, variant: 'destructive' });
      } finally {
        if (!cancelled) setLoadingList(false);
      }
    };

    fetchTripsAndMeta();

    return () => {
      cancelled = true;
    };
  }, [tripId, supabase, toast]);

  // Filtering trips
  const filteredTrips = useMemo(() => {
    return tripsList.filter((item) => {
      // Filter by status tab
      if (statusFilter === 'active' && item.status === 'completed') return false;
      if (statusFilter === 'completed' && item.status !== 'completed') return false;

      // Filter by search query
      if (!searchTerm.trim()) return true;
      const term = searchTerm.toLowerCase();
      const idMatch = String(item.id).includes(term);
      const cmrMatch = item.cmr_number?.toLowerCase().includes(term);
      const routeMatch = item.route?.toLowerCase().includes(term);
      const driverName = item.driver_id ? driversMap[item.driver_id]?.toLowerCase() : '';
      const driverMatch = driverName?.includes(term);
      const truckPlate = item.truck_id ? trucksMap[item.truck_id]?.toLowerCase() : '';
      const truckMatch = truckPlate?.includes(term);

      return idMatch || cmrMatch || routeMatch || driverMatch || truckMatch;
    });
  }, [tripsList, statusFilter, searchTerm, driversMap, trucksMap]);

  // 1. Loading state when tripId is active
  if (loadingTrip) {
    return (
      <div className="max-w-2xl mx-auto space-y-6 py-12" dir="rtl">
        <Card className="p-8 text-center shadow-sm">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary mb-3" />
          <p className="text-foreground font-medium">جاري تحميل بيانات الرحلة...</p>
          <p className="text-xs text-muted-foreground mt-1">يرجى الانتظار قليلاً</p>
        </Card>
      </div>
    );
  }

  // 2. Error state when tripId is invalid
  if (tripId && (!trip || tripError)) {
    return (
      <div className="max-w-xl mx-auto space-y-6 py-12" dir="rtl">
        <Card className="p-8 text-center space-y-4 shadow-sm border-destructive/30">
          <AlertCircle className="w-12 h-12 text-destructive mx-auto" />
          <div>
            <h2 className="text-lg font-bold text-foreground">تعذر العثور على الرحلة</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {tripError || 'معرف الرحلة غير صالح أو تم حذفه'}
            </p>
          </div>
          <Button
            onClick={() => router.replace('/driver-delivery')}
            className="w-full sm:w-auto"
          >
            <ArrowRight className="w-4 h-4 ml-2" />
            اختيار رحلة من القائمة
          </Button>
        </Card>
      </div>
    );
  }

  // 3. Render delivery screen if trip is selected
  if (trip) {
    return (
      <div className="space-y-4" dir="rtl">
        <div className="flex items-center justify-between bg-card p-3 rounded-lg border shadow-sm">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.replace('/driver-delivery')}
            className="text-muted-foreground hover:text-foreground"
          >
            <ArrowRight className="w-4 h-4 ml-1.5" />
            العودة لاختيار رحلة أخرى
          </Button>
          <span className="text-xs text-muted-foreground font-mono">
            رحلة #{trip.id} {trip.cmr_number ? `| CMR: ${trip.cmr_number}` : ''}
          </span>
        </div>

        <DriverDeliveryScreen
          trip={trip}
          onCancel={() => router.replace('/driver-delivery')}
          onSuccess={() => {
            toast({
              title: 'تم تأكيد التسليم بنجاح',
              description: 'تم تسجيل توقيع المستلم وتحديث حالة الرحلة.',
            });
            router.replace('/driver-delivery');
          }}
        />
      </div>
    );
  }

  // 4. Trip Selection Screen (when no tripId)
  return (
    <div className="space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-5">
        <div>
          <h1 className="text-2xl font-bold font-amiri text-foreground flex items-center gap-2">
            <CheckCircle2 className="w-6 h-6 text-primary" />
            تأكيد وتوقيع التسليم (POD)
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            اختر الرحلة لتسجيل توقيع المستلم ورفع نسخة CMR وإثبات التسليم الجغرافي
          </p>
        </div>
      </div>

      {/* Filters & Search & View Toggle */}
      <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="بحث برقم الرحلة، CMR، المسار، السائق، أو الشاحنة..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pr-9"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-lg border">
            <Button
              type="button"
              size="sm"
              variant={statusFilter === 'active' ? 'default' : 'ghost'}
              onClick={() => setStatusFilter('active')}
              className="text-xs h-8"
            >
              الرحلات النشطة
            </Button>
            <Button
              type="button"
              size="sm"
              variant={statusFilter === 'completed' ? 'default' : 'ghost'}
              onClick={() => setStatusFilter('completed')}
              className="text-xs h-8"
            >
              المكتملة
            </Button>
            <Button
              type="button"
              size="sm"
              variant={statusFilter === 'all' ? 'default' : 'ghost'}
              onClick={() => setStatusFilter('all')}
              className="text-xs h-8"
            >
              الكل ({tripsList.length})
            </Button>
          </div>

          <CardViewToggle viewMode={cardLayout} onChange={setCardLayout} />
        </div>
      </div>

      {/* Trips Content */}
      {loadingList ? (
        <Card className="p-12 text-center shadow-sm">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary mb-3" />
          <p className="text-foreground font-medium">جاري تحميل الرحلات...</p>
          <p className="text-xs text-muted-foreground mt-1">يرجى الانتظار</p>
        </Card>
      ) : filteredTrips.length === 0 ? (
        <Card className="p-12 text-center shadow-sm">
          <FileText className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
          <h3 className="text-base font-semibold text-foreground">لا توجد رحلات مطابقة</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {searchTerm
              ? 'لم يتم العثور على أي رحلة تطابق معايير البحث'
              : statusFilter === 'active'
              ? 'لا توجد رحلات نشطة في الوقت الحالي بحاجة لتأكيد التسليم'
              : 'لا توجد رحلات مسجلة في هذا القسم'}
          </p>
          {searchTerm && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSearchTerm('')}
              className="mt-4"
            >
              إلغاء البحث
            </Button>
          )}
        </Card>
      ) : cardLayout === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTrips.map((item) => {
            const badge = getStatusBadge(item.status);
            const driverName = item.driver_id ? driversMap[item.driver_id] : null;
            const truckPlate = item.truck_id ? trucksMap[item.truck_id] : null;

            return (
              <Card
                key={item.id}
                className="flex flex-col justify-between hover:border-primary/50 hover:shadow-md transition-all"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-mono font-bold bg-muted px-2 py-0.5 rounded text-foreground">
                      #{item.id}
                    </span>
                    <span
                      className={`text-xs px-2.5 py-0.5 rounded-full border font-medium ${badge.className}`}
                    >
                      {badge.label}
                    </span>
                  </div>
                  <CardTitle className="text-base font-amiri font-bold text-foreground mt-2 flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-primary shrink-0" />
                    <span>{item.route || 'مسار غير محدد'}</span>
                  </CardTitle>
                </CardHeader>

                <CardContent className="space-y-3 pt-0">
                  <div className="space-y-1.5 text-xs text-muted-foreground bg-muted/30 p-2.5 rounded-md border">
                    {item.cmr_number && (
                      <div className="flex justify-between items-center">
                        <span className="flex items-center gap-1">
                          <FileText className="w-3.5 h-3.5" />
                          رقم CMR:
                        </span>
                        <span className="font-mono font-medium text-foreground" dir="ltr">
                          {item.cmr_number}
                        </span>
                      </div>
                    )}

                    {driverName && (
                      <div className="flex justify-between items-center">
                        <span className="flex items-center gap-1">
                          <User className="w-3.5 h-3.5" />
                          السائق:
                        </span>
                        <span className="font-medium text-foreground">{driverName}</span>
                      </div>
                    )}

                    {truckPlate && (
                      <div className="flex justify-between items-center">
                        <span className="flex items-center gap-1">
                          <Truck className="w-3.5 h-3.5" />
                          الشاحنة:
                        </span>
                        <span className="font-mono font-medium text-foreground" dir="ltr">
                          {truckPlate}
                        </span>
                      </div>
                    )}

                    {item.departure_date && (
                      <div className="flex justify-between items-center">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          تاريخ الانطلاق:
                        </span>
                        <span className="font-medium text-foreground">{item.departure_date}</span>
                      </div>
                    )}
                  </div>

                  <Button
                    className="w-full mt-2"
                    size="sm"
                    onClick={() => router.push(`/driver-delivery?tripId=${item.id}`)}
                  >
                    <CheckCircle2 className="w-4 h-4 ml-1.5" />
                    تأكيد وتوقيع التسليم (POD)
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        /* List View Cards */
        <div className="flex flex-col gap-3">
          {filteredTrips.map((item) => {
            const badge = getStatusBadge(item.status);
            const driverName = item.driver_id ? driversMap[item.driver_id] : null;
            const truckPlate = item.truck_id ? trucksMap[item.truck_id] : null;

            return (
              <Card
                key={item.id}
                className="p-4 hover:border-primary/50 hover:shadow-md transition-all overflow-hidden"
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Trip ID, Status, and Route */}
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs font-mono font-bold bg-muted px-2.5 py-1 rounded text-foreground">
                        #{item.id}
                      </span>
                      <span
                        className={`text-xs px-2.5 py-0.5 rounded-full border font-medium ${badge.className}`}
                      >
                        {badge.label}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 font-amiri font-bold text-base text-foreground">
                      <MapPin className="w-4 h-4 text-primary shrink-0" />
                      <span>{item.route || 'مسار غير محدد'}</span>
                    </div>
                  </div>

                  {/* Metadata Chips & Action Button */}
                  <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 text-xs text-muted-foreground">
                    {item.cmr_number && (
                      <div className="bg-muted/40 px-2.5 py-1.5 rounded-md border flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="text-muted-foreground">CMR:</span>
                        <span className="font-mono font-medium text-foreground" dir="ltr">
                          {item.cmr_number}
                        </span>
                      </div>
                    )}

                    {driverName && (
                      <div className="bg-muted/40 px-2.5 py-1.5 rounded-md border flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="text-muted-foreground">السائق:</span>
                        <span className="font-medium text-foreground">{driverName}</span>
                      </div>
                    )}

                    {truckPlate && (
                      <div className="bg-muted/40 px-2.5 py-1.5 rounded-md border flex items-center gap-1.5">
                        <Truck className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="text-muted-foreground">الشاحنة:</span>
                        <span className="font-mono font-medium text-foreground" dir="ltr">
                          {truckPlate}
                        </span>
                      </div>
                    )}

                    {item.departure_date && (
                      <div className="bg-muted/40 px-2.5 py-1.5 rounded-md border flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="font-medium text-foreground">{item.departure_date}</span>
                      </div>
                    )}

                    <Button
                      size="sm"
                      onClick={() => router.push(`/driver-delivery?tripId=${item.id}`)}
                      className="shrink-0 mr-auto lg:mr-0"
                    >
                      <CheckCircle2 className="w-4 h-4 ml-1.5" />
                      تأكيد وتوقيع التسليم (POD)
                    </Button>
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

export default function DriverDeliveryPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-2xl mx-auto space-y-6 py-12" dir="rtl">
          <Card className="p-8 text-center flex flex-col items-center justify-center gap-3 shadow-sm">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-foreground font-medium">جاري تحميل الصفحة...</p>
          </Card>
        </div>
      }
    >
      <DriverDeliveryContent />
    </Suspense>
  );
}
