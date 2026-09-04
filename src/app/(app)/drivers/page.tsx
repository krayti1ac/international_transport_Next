'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import type { Driver, Truck, Trailer } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import {
  Plus,
  Search,
  User,
  Users,
  UserCheck,
  Truck as TruckIcon,
  Phone,
  ShieldCheck,
  AlertTriangle,
  CreditCard,
  Edit2,
  Trash2,
  Route,
  Container
} from 'lucide-react';
import { FleetFormModal } from '@/components/fleet-form-modal';
import { MatriculeBadge } from '@/components/ui/matricule-badge';
import { CardViewToggle, useCardViewMode } from '@/components/ui/card-view-toggle';
import { DEFAULT_DRIVERS, DEFAULT_TRUCKS, DEFAULT_TRAILERS, fallbackArray } from '@/lib/default-data';

type StatusFilter = 'all' | 'active' | 'in_trip' | 'vacation' | 'inactive';
type VisaFilter = 'all' | 'valid' | 'expiring_soon' | 'expired_or_none';

export default function DriversPage() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [trailers, setTrailers] = useState<Trailer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [visaFilter, setVisaFilter] = useState<VisaFilter>('all');
  const [cardLayout, setCardLayout] = useCardViewMode('drivers', 'grid');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);

  const { toast } = useToast();
  const supabase = useMemo(() => createClient(), []);

  const fetchData = useCallback(async () => {
    try {
      const [driversRes, trucksRes, trailersRes] = await Promise.all([
        supabase.from('drivers').select('*').order('name'),
        supabase.from('trucks').select('*').order('plate_number'),
        supabase.from('trailers').select('*').order('plate_number'),
      ]);

      if (driversRes.error) throw driversRes.error;
      if (trucksRes.error) throw trucksRes.error;

      setDrivers(fallbackArray(driversRes.data, DEFAULT_DRIVERS));
      setTrucks(fallbackArray(trucksRes.data, DEFAULT_TRUCKS));
      setTrailers(fallbackArray(trailersRes.data, DEFAULT_TRAILERS));
    } catch {
      setDrivers((prev) => fallbackArray(prev, DEFAULT_DRIVERS));
      setTrucks((prev) => fallbackArray(prev, DEFAULT_TRUCKS));
      setTrailers((prev) => fallbackArray(prev, DEFAULT_TRAILERS));
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchData();

    const channel = supabase
      .channel('drivers-realtime-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'drivers' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trucks' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trailers' }, () => fetchData())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchData, supabase]);

  const handleSaveDriver = async (_type: any, data: any) => {
    try {
      // If assigning a truck to this driver, release it from any previously assigned driver
      if (data.default_truck_id) {
        try {
          await supabase
            .from('drivers')
            .update({ default_truck_id: null })
            .eq('default_truck_id', data.default_truck_id)
            .neq('id', data.id || -1);
        } catch (e) {
          console.warn('Releasing previous truck assignment from other driver:', e);
        }

        setDrivers((prev) =>
          prev.map((d) =>
            d.id !== data.id && d.default_truck_id === data.default_truck_id
              ? { ...d, default_truck_id: undefined }
              : d
          )
        );
      }

      const executeSave = async (payload: any) => {
        if (payload.id) {
          return await supabase.from('drivers').update(payload).eq('id', payload.id);
        } else {
          return await supabase.from('drivers').insert(payload);
        }
      };

      let currentData = { ...data };
      let { error } = await executeSave(currentData);

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
      toast({ title: data.id ? 'تم تحديث بيانات السائق بنجاح' : 'تمت إضافة السائق بنجاح' });
      fetchData();
    } catch (error: any) {
      toast({
        title: 'خطأ أثناء حفظ بيانات السائق',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleDeleteDriver = async (id: number) => {
    if (!confirm('هل أنت متأكد من رغبتك في حذف هذا السائق؟')) return;

    try {
      const { error } = await supabase.from('drivers').delete().eq('id', id);
      if (error) throw error;
      toast({ title: 'تم حذف السائق بنجاح' });
      fetchData();
    } catch (error: any) {
      toast({
        title: 'خطأ أثناء حذف السائق',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25';
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
        return 'جاهز ومتاح';
      case 'in_trip':
        return 'في رحلة دولية';
      case 'vacation':
        return 'في إجازة';
      case 'inactive':
        return 'متوقف';
      default:
        return status || 'غير محدد';
    }
  };

  // Visa Status Helper
  const getVisaDetails = (driver: Driver) => {
    if (!driver.visa_expiry_date) {
      return {
        status: 'none',
        label: 'بدون تأشيرة دولية',
        badgeClass: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20',
        daysLeft: null,
      };
    }

    const expiry = new Date(driver.visa_expiry_date);
    const now = new Date();
    const diffTime = expiry.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return {
        status: 'expired',
        label: 'التأشيرة منتهية الصلاحية',
        badgeClass: 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/25',
        daysLeft: diffDays,
      };
    } else if (diffDays <= 30) {
      return {
        status: 'expiring_soon',
        label: `تنتهي خلال ${diffDays} يوم`,
        badgeClass: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/25',
        daysLeft: diffDays,
      };
    } else {
      return {
        status: 'valid',
        label: `فيزا سارية (${diffDays} يوم)`,
        badgeClass: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/25',
        daysLeft: diffDays,
      };
    }
  };

  // KPI Calculations
  const totalDrivers = drivers.length;
  const activeDrivers = drivers.filter((d) => d.status === 'active').length;
  const inTripDrivers = drivers.filter((d) => d.status === 'in_trip').length;
  const validVisaDrivers = drivers.filter((d) => {
    const v = getVisaDetails(d);
    return v.status === 'valid' || v.status === 'expiring_soon';
  }).length;
  const expiringSoonCount = drivers.filter((d) => getVisaDetails(d).status === 'expiring_soon').length;

  // Filtered drivers
  const filteredDrivers = drivers.filter((driver) => {
    // 1. Status Filter
    if (statusFilter !== 'all' && driver.status !== statusFilter) {
      return false;
    }

    // 2. Visa Filter
    const visa = getVisaDetails(driver);
    if (visaFilter === 'valid' && visa.status !== 'valid') return false;
    if (visaFilter === 'expiring_soon' && visa.status !== 'expiring_soon') return false;
    if (visaFilter === 'expired_or_none' && visa.status !== 'expired' && visa.status !== 'none') return false;

    // 3. Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const nameMatch = driver.name?.toLowerCase().includes(q);
      const phoneMatch = driver.phone?.toLowerCase().includes(q);
      const licenseMatch = driver.license?.toLowerCase().includes(q);
      const visaMatch = driver.visa_number?.toLowerCase().includes(q);
      return nameMatch || phoneMatch || licenseMatch || visaMatch;
    }

    return true;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto" dir="rtl">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-2 border-b border-border/40">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            <span>إدارة الكوادر البشرية والأسطول</span>
          </div>
          <h1 className="text-2xl lg:text-3xl font-bold font-amiri tracking-tight text-foreground">
            إدارة وبيانات السائقين
          </h1>
          <p className="text-muted-foreground text-xs sm:text-sm mt-1">
            متابعة شاملة لملفات السائقين الدوليين، رخص القيادة، تتبع صلاحية التأشيرات (Visa Schengen)، وتعيين الشاحنات.
          </p>
        </div>

        <Button
          onClick={() => {
            setEditingDriver(null);
            setIsModalOpen(true);
          }}
          className="bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 shadow-md font-medium text-xs sm:text-sm rounded-xl h-10 px-4 transition-all"
        >
          <Plus className="w-4 h-4 ml-2" />
          إضافة سائق جديد
        </Button>
      </div>

      {/* Bento Grid KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Drivers */}
        <div className="bg-card border border-border/80 p-4 rounded-2xl flex items-center justify-between shadow-xs">
          <div>
            <span className="text-xs font-bold text-muted-foreground uppercase">إجمالي السائقين</span>
            <div className="text-2xl font-extrabold font-mono text-foreground mt-1">
              {totalDrivers} <span className="text-xs text-muted-foreground font-normal">كابتن</span>
            </div>
            <span className="text-[11px] text-blue-600 dark:text-blue-400 font-medium">طاقم النقل الدولي والمحلي</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
        </div>

        {/* Available / Active Drivers */}
        <div className="bg-card border border-border/80 p-4 rounded-2xl flex items-center justify-between shadow-xs">
          <div>
            <span className="text-xs font-bold text-muted-foreground uppercase">السائقين المتاحين</span>
            <div className="text-2xl font-extrabold font-mono text-foreground mt-1">
              {activeDrivers} <span className="text-xs text-muted-foreground font-normal">/ {totalDrivers}</span>
            </div>
            <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">جاهزية تامة للانطلاق</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <UserCheck className="w-5 h-5" />
          </div>
        </div>

        {/* On Trip Drivers */}
        <div className="bg-card border border-border/80 p-4 rounded-2xl flex items-center justify-between shadow-xs">
          <div>
            <span className="text-xs font-bold text-muted-foreground uppercase">في رحلات نشطة</span>
            <div className="text-2xl font-extrabold font-mono text-foreground mt-1">
              {inTripDrivers} <span className="text-xs text-muted-foreground font-normal">كابتن</span>
            </div>
            <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">في مسارات الشحن حالياً</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
            <Route className="w-5 h-5" />
          </div>
        </div>

        {/* Visa Tracker */}
        <div className="bg-card border border-border/80 p-4 rounded-2xl flex items-center justify-between shadow-xs">
          <div>
            <span className="text-xs font-bold text-muted-foreground uppercase">تأشيرات شنغن سارية</span>
            <div className="text-2xl font-extrabold font-mono text-foreground mt-1">
              {validVisaDrivers} <span className="text-xs text-muted-foreground font-normal">/ {totalDrivers}</span>
            </div>
            {expiringSoonCount > 0 ? (
              <span className="text-[11px] text-rose-600 dark:text-rose-400 font-medium flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                {expiringSoonCount} تنتهي قريباً
              </span>
            ) : (
              <span className="text-[11px] text-teal-600 dark:text-teal-400 font-medium">كافة التأشيرات محدثة</span>
            )}
          </div>
          <div className="w-10 h-10 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="space-y-3 bg-muted/40 p-3 rounded-2xl border border-border/60">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Status Tabs */}
          <div className="flex flex-wrap gap-1 bg-card p-1 rounded-xl border border-border/60 shadow-2xs">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                statusFilter === 'all'
                  ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              الكل ({drivers.length})
            </button>
            <button
              onClick={() => setStatusFilter('active')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                statusFilter === 'active'
                  ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              متاح للعمل ({activeDrivers})
            </button>
            <button
              onClick={() => setStatusFilter('in_trip')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                statusFilter === 'in_trip'
                  ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              في رحلة ({inTripDrivers})
            </button>
            <button
              onClick={() => setStatusFilter('vacation')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                statusFilter === 'vacation'
                  ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              في إجازة ({drivers.filter((d) => d.status === 'vacation').length})
            </button>
            <button
              onClick={() => setStatusFilter('inactive')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                statusFilter === 'inactive'
                  ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              متوقف ({drivers.filter((d) => d.status === 'inactive').length})
            </button>
          </div>

          {/* Controls: View Mode & Search */}
          <div className="flex items-center gap-2 flex-1 max-w-md justify-end">
            <CardViewToggle viewMode={cardLayout} onChange={setCardLayout} />

            <div className="relative flex-1">
              <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="بحث باسم السائق، الهاتف، الرخصة، أو الفيزا..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pr-9 h-9 text-xs rounded-xl bg-card border-border/80"
              />
            </div>
          </div>
        </div>

        {/* Quick Visa Filter Pills */}
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-border/40 text-xs">
          <span className="text-muted-foreground font-medium flex items-center gap-1 shrink-0">
            <ShieldCheck className="w-3.5 h-3.5 text-teal-500" />
            فلترة التأشيرات:
          </span>
          <button
            onClick={() => setVisaFilter('all')}
            className={`px-2.5 py-1 rounded-lg text-[11px] transition-all border ${
              visaFilter === 'all'
                ? 'bg-secondary text-secondary-foreground font-semibold border-secondary'
                : 'text-muted-foreground border-transparent hover:bg-muted'
            }`}
          >
            كافة السائقين
          </button>
          <button
            onClick={() => setVisaFilter('valid')}
            className={`px-2.5 py-1 rounded-lg text-[11px] transition-all border ${
              visaFilter === 'valid'
                ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-semibold border-emerald-500/30'
                : 'text-muted-foreground border-transparent hover:bg-muted'
            }`}
          >
            تأشيرة سارية ({drivers.filter((d) => getVisaDetails(d).status === 'valid').length})
          </button>
          <button
            onClick={() => setVisaFilter('expiring_soon')}
            className={`px-2.5 py-1 rounded-lg text-[11px] transition-all border ${
              visaFilter === 'expiring_soon'
                ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400 font-semibold border-amber-500/30'
                : 'text-muted-foreground border-transparent hover:bg-muted'
            }`}
          >
            تنتهي قريباً ({expiringSoonCount})
          </button>
          <button
            onClick={() => setVisaFilter('expired_or_none')}
            className={`px-2.5 py-1 rounded-lg text-[11px] transition-all border ${
              visaFilter === 'expired_or_none'
                ? 'bg-rose-500/20 text-rose-600 dark:text-rose-400 font-semibold border-rose-500/30'
                : 'text-muted-foreground border-transparent hover:bg-muted'
            }`}
          >
            بدون فيزا أو منتهية ({drivers.filter((d) => ['expired', 'none'].includes(getVisaDetails(d).status)).length})
          </button>
        </div>
      </div>

      {/* Main Content */}
      {loading ? (
        <div className="text-center py-16 bg-card rounded-2xl border border-border">
          <p className="text-xs text-muted-foreground">جاري تحميل بيانات السائقين...</p>
        </div>
      ) : filteredDrivers.length === 0 ? (
        <div className="text-center py-16 bg-card rounded-2xl border border-border">
          <User className="w-10 h-10 mx-auto text-muted-foreground/50 mb-2" />
          <p className="text-sm font-semibold text-foreground">لا يوجد سائقين مطابقين للبحث</p>
          <p className="text-xs text-muted-foreground mt-1">جرّب تغيير عبارة البحث أو الفلتر المحدد أعلاه.</p>
        </div>
      ) : cardLayout === 'grid' ? (
        /* Grid Mode */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDrivers.map((driver) => {
            const visa = getVisaDetails(driver);
            const assignedTruck = trucks.find((t) => t.id === driver.default_truck_id);
            const assignedTrailer = assignedTruck?.default_trailer_id
              ? trailers.find((tr) => tr.id === assignedTruck.default_trailer_id)
              : null;

            return (
            <Link href={`/drivers/${driver.id}`} key={driver.id} className="block">
              <Card
                className="rounded-2xl border border-border/80 bg-card hover:shadow-md transition-all flex flex-col justify-between overflow-hidden group cursor-pointer"
              >
                <div>
                  <CardHeader className="p-4 pb-3 border-b border-border/40 bg-muted/20">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                          <User className="w-5 h-5" />
                        </div>
                        <div>
                          <CardTitle className="text-base font-bold font-amiri text-foreground">
                            {driver.name}
                          </CardTitle>
                        </div>
                      </div>
                      <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold shrink-0 ${getStatusColor(driver.status)}`}>
                        {getStatusText(driver.status)}
                      </span>
                    </div>
                  </CardHeader>

                  <CardContent className="p-4 space-y-2.5 text-xs">
                    {/* Phone */}
                    <div className="flex justify-between items-center py-1 border-b border-border/30">
                      <span className="text-muted-foreground flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                        الهاتف:
                      </span>
                      {driver.phone ? (
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            window.location.href = `tel:${driver.phone}`;
                          }}
                          className="font-mono font-medium text-foreground hover:text-primary transition-colors flex items-center gap-1 cursor-pointer"
                          dir="ltr"
                        >
                          {driver.phone}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </div>

                    {/* Visa Validity */}
                    <div className="flex justify-between items-center py-1 border-b border-border/30 gap-2">
                      <span className="text-muted-foreground flex items-center gap-1.5 shrink-0">
                        <ShieldCheck className="w-3.5 h-3.5 text-muted-foreground" />
                        صلاحية التأشيرة:
                      </span>
                      <div className="text-left">
                        {driver.visa_expiry_date ? (
                          <div className="flex flex-col items-end">
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border ${visa.badgeClass}`}>
                              {visa.label}
                            </span>
                            <span className="text-[10px] text-muted-foreground mt-0.5 font-mono">تنتهي: {driver.visa_expiry_date}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-[11px]">لا توجد تأشيرة مسجلة</span>
                        )}
                      </div>
                    </div>

                    {/* Assigned Truck */}
                    <div className="flex justify-between items-center py-1 border-b border-border/30 gap-2">
                      <span className="text-muted-foreground flex items-center gap-1.5 shrink-0">
                        <TruckIcon className="w-3.5 h-3.5 text-muted-foreground" />
                        الشاحنة المخصصة:
                      </span>
                      <span className="font-mono text-foreground text-left">
                        {assignedTruck ? (
                          <span className="inline-flex items-center gap-1.5">
                            <MatriculeBadge plate={assignedTruck.plate_number} variant="badge" size="xs" />
                            {assignedTruck.model && (
                              <span className="text-[11px] text-muted-foreground truncate">({assignedTruck.model})</span>
                            )}
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-[11px]">
                            {driver.default_truck_name || 'غير مسند'}
                          </span>
                        )}
                      </span>
                    </div>

                    {/* Assigned Trailer */}
                    <div className="flex justify-between items-center py-1 border-b border-border/30 gap-2">
                      <span className="text-muted-foreground flex items-center gap-1.5 shrink-0">
                        <Container className="w-3.5 h-3.5 text-muted-foreground" />
                        المقطورة المرتبطة:
                      </span>
                      <span className="font-mono text-foreground text-left">
                        {assignedTrailer ? (
                          <span className="inline-flex items-center gap-1.5">
                            <MatriculeBadge plate={assignedTrailer.plate_number} variant="badge" size="xs" />
                            {assignedTrailer.model && (
                              <span className="text-[11px] text-muted-foreground truncate">({assignedTrailer.model})</span>
                            )}
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-[11px]">
                            بدون مقطورة مرتبطة
                          </span>
                        )}
                      </span>
                    </div>

                  </CardContent>
                </div>

                <div className="flex gap-2 p-3 border-t border-border/40 bg-muted/10">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 text-xs rounded-xl h-8"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setEditingDriver(driver);
                      setIsModalOpen(true);
                    }}
                  >
                    <Edit2 className="w-3.5 h-3.5 ml-1" />
                    تعديل البيانات
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs text-destructive hover:bg-destructive/10 rounded-xl h-8 px-2.5"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleDeleteDriver(driver.id);
                    }}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </Card>
            </Link>
            );
          })}
        </div>
      ) : (
        /* List Mode */
        <div className="flex flex-col gap-3">
          {filteredDrivers.map((driver) => {
            const visa = getVisaDetails(driver);
            const assignedTruck = trucks.find((t) => t.id === driver.default_truck_id);
            const assignedTrailer = assignedTruck?.default_trailer_id
              ? trailers.find((tr) => tr.id === assignedTruck.default_trailer_id)
              : null;

            return (
              <Link href={`/drivers/${driver.id}`} key={driver.id} className="block">
              <Card
                className="rounded-2xl border border-border/80 bg-card hover:shadow-md transition-all overflow-hidden cursor-pointer"
              >
                <div className="p-3.5 flex flex-col lg:flex-row lg:items-center justify-between gap-3.5">
                  {/* Right: Driver Name & Visa Badge */}
                  <div className="flex items-center gap-3 min-w-[240px]">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                      <User className="w-5 h-5" />
                    </div>
                    <div>
                      <CardTitle className="text-base font-bold font-amiri text-foreground">{driver.name}</CardTitle>
                    </div>
                  </div>

                  {/* Middle: Phone, License, Truck, Visa */}
                  <div className="flex flex-wrap items-center gap-2.5 text-xs flex-1">
                    <div className="bg-muted/30 px-3 py-1.5 rounded-xl border border-border/40 flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                      {driver.phone ? (
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            window.location.href = `tel:${driver.phone}`;
                          }}
                          className="font-mono font-medium text-foreground hover:text-primary cursor-pointer"
                          dir="ltr"
                        >
                          {driver.phone}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </div>

                    <div className="bg-muted/30 px-3 py-1.5 rounded-xl border border-border/40 flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-teal-500" />
                      <span className="text-muted-foreground text-[11px]">صلاحية التأشيرة:</span>
                      {driver.visa_expiry_date ? (
                        <span className="inline-flex items-center gap-1.5">
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border ${visa.badgeClass}`}>
                            {visa.label}
                          </span>
                          <span className="font-mono text-[10px] text-muted-foreground">({driver.visa_expiry_date})</span>
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-[11px]">لا توجد تأشيرة مسجلة</span>
                      )}
                    </div>

                    <div className="bg-muted/30 px-3 py-1.5 rounded-xl border border-border/40 flex items-center gap-1.5">
                      <TruckIcon className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-muted-foreground text-[11px]">الشاحنة:</span>
                      {assignedTruck ? (
                        <span className="inline-flex items-center gap-1.5">
                          <MatriculeBadge plate={assignedTruck.plate_number} variant="badge" size="xs" />
                          {assignedTruck.model && <span className="text-[11px] text-muted-foreground">({assignedTruck.model})</span>}
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-[11px]">{driver.default_truck_name || 'غير مسند'}</span>
                      )}
                    </div>

                    <div className="bg-muted/30 px-3 py-1.5 rounded-xl border border-border/40 flex items-center gap-1.5">
                      <Container className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-muted-foreground text-[11px]">المقطورة:</span>
                      {assignedTrailer ? (
                        <span className="inline-flex items-center gap-1.5">
                          <MatriculeBadge plate={assignedTrailer.plate_number} variant="badge" size="xs" />
                          {assignedTrailer.model && <span className="text-[11px] text-muted-foreground">({assignedTrailer.model})</span>}
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-[11px]">بدون مقطورة مرتبطة</span>
                      )}
                    </div>
                  </div>

                  {/* Left: Status & Actions */}
                  <div className="flex items-center justify-between lg:justify-end gap-2.5 border-t lg:border-t-0 pt-2.5 lg:pt-0 border-border/40">
                    <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${getStatusColor(driver.status)}`}>
                      {getStatusText(driver.status)}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs rounded-xl h-8 px-3"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setEditingDriver(driver);
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
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleDeleteDriver(driver.id);
                        }}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
              </Link>
            );
          })}
        </div>
      )}

      {/* Driver Add/Edit Modal */}
      <FleetFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        entityType="driver"
        initialData={editingDriver}
        driversList={drivers}
        trucksList={trucks}
        onSave={handleSaveDriver}
      />
    </div>
  );
}
