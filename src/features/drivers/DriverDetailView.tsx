'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import type { Driver, Truck, Trailer, DriverSalary, Advance, FinePenalty, TripOrder, Client } from '@/types/database';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MatriculeBadge } from '@/components/ui/matricule-badge';
import { PaySalaryDialog } from '@/components/payroll/PaySalaryDialog';
import {
    ArrowRight,
    User,
    Phone,
    ShieldCheck,
    Truck as TruckIcon,
    Container,
    CreditCard,
    Wallet,
    AlertTriangle,
    Route,
    FileText,
    Loader2,
    Calendar,
    Hash,
    BadgePercent,
    Building2,
    RefreshCw,
    CheckCircle2,
    XCircle,
    Clock,
    Banknote,
    Receipt,
    ExternalLink,
} from 'lucide-react';
import { formatCurrency } from '@/lib/forex';

interface DriverDetailViewProps {
    driverId: number;
}

type TabKey = 'overview' | 'salaries' | 'advances' | 'fines' | 'trips';

export function DriverDetailView({ driverId }: DriverDetailViewProps) {
    const [driver, setDriver] = useState<Driver | null>(null);
    const [truck, setTruck] = useState<Truck | null>(null);
    const [trailer, setTrailer] = useState<Trailer | null>(null);
    const [salaries, setSalaries] = useState<DriverSalary[]>([]);
    const [advances, setAdvances] = useState<Advance[]>([]);
    const [fines, setFines] = useState<FinePenalty[]>([]);
    const [trips, setTrips] = useState<TripOrder[]>([]);
    const [clients, setClients] = useState<Record<number, Client>>({});
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<TabKey>('overview');

    const [isPayOpen, setPayOpen] = useState(false);
    const [payMonth, setPayMonth] = useState(() => new Date().getMonth() + 1);
    const [payYear, setPayYear] = useState(() => new Date().getFullYear());

    const supabase = useMemo(() => createClient(), []);
    const { toast } = useToast();

    const fetchAll = useCallback(async () => {
        setLoading(true);
        try {
            const [driverRes, salariesRes, advancesRes, finesRes, tripsRes] = await Promise.all([
                supabase.from('drivers').select('*').eq('id', driverId).maybeSingle<Driver>(),
                supabase.from('driver_salaries').select('*').eq('driver_id', driverId).order('period_start', { ascending: false }),
                supabase.from('advances').select('*').eq('driver_id', driverId).eq('is_deleted', false).order('date', { ascending: false }),
                supabase.from('fine_penalties').select('*').eq('driver_id', driverId).order('created_at', { ascending: false }),
                supabase.from('trip_orders').select('*').eq('driver_id', driverId).order('departure_date', { ascending: false }).limit(100),
            ]);

            const drv = driverRes.data;
            setDriver(drv ?? null);
            setSalaries(salariesRes.data || []);
            setAdvances(advancesRes.data || []);
            setFines(finesRes.data || []);
            setTrips(tripsRes.data || []);

            if (drv?.default_truck_id) {
                const { data: t } = await supabase
                    .from('trucks')
                    .select('*')
                    .eq('id', drv.default_truck_id)
                    .maybeSingle<Truck>();
                setTruck(t ?? null);
                if (t?.default_trailer_id) {
                    const { data: tr } = await supabase
                        .from('trailers')
                        .select('*')
                        .eq('id', t.default_trailer_id)
                        .maybeSingle<Trailer>();
                    setTrailer(tr ?? null);
                } else {
                    setTrailer(null);
                }
            } else {
                setTruck(null);
                setTrailer(null);
            }

            const clientIds = Array.from(
                new Set(
                    (tripsRes.data || [])
                        .flatMap((t) => [t.client_id, t.client_import_id])
                        .filter((v): v is number => typeof v === 'number')
                )
            );
            if (clientIds.length > 0) {
                const { data: cls } = await supabase
                    .from('clients')
                    .select('*')
                    .in('id', clientIds);
                const map: Record<number, Client> = {};
                (cls || []).forEach((c) => {
                    if (c.id != null) map[c.id] = c as Client;
                });
                setClients(map);
            } else {
                setClients({});
            }
        } catch (err: any) {
            toast({ title: 'خطأ في تحميل بيانات السائق', description: err?.message, variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    }, [driverId, supabase, toast]);

    useEffect(() => {
        fetchAll();
    }, [fetchAll]);

    useEffect(() => {
        const channel = supabase
            .channel(`driver-detail-${driverId}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'driver_salaries', filter: `driver_id=eq.${driverId}` }, () => fetchAll())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'advances', filter: `driver_id=eq.${driverId}` }, () => fetchAll())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'fine_penalties', filter: `driver_id=eq.${driverId}` }, () => fetchAll())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'trip_orders', filter: `driver_id=eq.${driverId}` }, () => fetchAll())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'drivers', filter: `id=eq.${driverId}` }, () => fetchAll())
            .subscribe();
        return () => {
            supabase.removeChannel(channel);
        };
    }, [driverId, supabase, fetchAll]);

    const visa = useMemo(() => {
        if (!driver?.visa_expiry_date) return null;
        const expiry = new Date(driver.visa_expiry_date);
        const diffDays = Math.ceil((expiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        if (diffDays < 0) return { label: 'التأشيرة منتهية الصلاحية', className: 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/25', daysLeft: diffDays };
        if (diffDays <= 30) return { label: `تنتهي خلال ${diffDays} يوم`, className: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/25', daysLeft: diffDays };
        return { label: `سارية (${diffDays} يوم)`, className: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/25', daysLeft: diffDays };
    }, [driver]);

    const totalAdvances = useMemo(
        () => advances.reduce((sum, a) => sum + (a.status === 'approved' ? Number(a.amount) + Number(a.extra_advances || 0) + Number(a.driver_allowance || 0) + Number(a.receipt_expenses || 0) : 0), 0),
        [advances]
    );

    const pendingFines = useMemo(
        () => fines.filter((f) => !f.deducted_from_settlement).reduce((sum, f) => sum + Number(f.amount), 0),
        [fines]
    );

    const latestSalary = salaries[0];
    const lastSalaryNet = latestSalary ? Number(latestSalary.amount) : 0;

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-24 gap-3" dir="rtl">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                <p className="text-xs text-muted-foreground">جاري تحميل ملف السائق...</p>
            </div>
        );
    }

    if (!driver) {
        return (
            <div className="text-center py-16 bg-card rounded-2xl border border-border" dir="rtl">
                <User className="w-10 h-10 mx-auto text-muted-foreground/50 mb-2" />
                <p className="text-sm font-semibold">السائق غير موجود</p>
                <Link href="/drivers" className="text-xs text-primary mt-2 inline-block">
                    العودة إلى قائمة السائقين
                </Link>
            </div>
        );
    }

    const tabs: Array<{ key: TabKey; label: string; icon: any; count?: number }> = [
        { key: 'overview', label: 'الملف الشخصي', icon: User },
        { key: 'salaries', label: 'الرواتب وكشف الحساب', icon: Wallet, count: salaries.length },
        { key: 'advances', label: 'السلف النشطة', icon: Banknote, count: advances.filter((a) => a.status === 'approved').length },
        { key: 'fines', label: 'المخالفات والغرامات', icon: AlertTriangle, count: fines.length },
        { key: 'trips', label: 'الرحلات الدولية', icon: Route, count: trips.length },
    ];

    return (
        <div className="space-y-6 max-w-7xl mx-auto" dir="rtl">
            <div className="flex flex-col gap-3 pb-2 border-b border-border/40">
                <Link href="/drivers" className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 w-fit">
                    <ArrowRight className="w-3.5 h-3.5" />
                    العودة إلى قائمة السائقين
                </Link>
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                            <User className="w-7 h-7" />
                        </div>
                        <div>
                            <h1 className="text-2xl lg:text-3xl font-bold font-amiri tracking-tight text-foreground">{driver.name}</h1>
                            <p className="text-xs text-muted-foreground mt-1 font-mono">#{driver.id}</p>
                        </div>
                    </div>
                    <Button variant="outline" size="sm" onClick={fetchAll} className="rounded-xl h-9 text-xs gap-2">
                        <RefreshCw className="w-3.5 h-3.5" />
                        تحديث البيانات
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiCard icon={Banknote} label="إجمالي السلف المعتمدة" value={formatCurrency(totalAdvances, 'MAD')} subtitle={`${advances.filter((a) => a.status === 'approved').length} عملية`} color="amber" />
                <KpiCard icon={AlertTriangle} label="مخالفات معلقة" value={formatCurrency(pendingFines, 'MAD')} subtitle={`${fines.filter((f) => !f.deducted_from_settlement).length} غرامة`} color="rose" />
                <KpiCard icon={Wallet} label="آخر راتب مصروف" value={formatCurrency(lastSalaryNet, latestSalary?.currency || 'MAD')} subtitle={latestSalary ? `${latestSalary.period_start} → ${latestSalary.period_end}` : 'لا يوجد'} color="emerald" />
                <KpiCard icon={Route} label="إجمالي الرحلات" value={`${trips.length}`} subtitle="رحلة دولية" color="blue" />
            </div>

            <div className="flex flex-wrap gap-1 bg-muted/40 p-1 rounded-2xl border border-border/60 w-fit">
                {tabs.map((t) => {
                    const Icon = t.icon;
                    const active = activeTab === t.key;
                    return (
                        <button
                            key={t.key}
                            onClick={() => setActiveTab(t.key)}
                            className={`px-3 py-2 text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5 ${
                                active ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
                            }`}
                        >
                            <Icon className="w-3.5 h-3.5" />
                            {t.label}
                            {typeof t.count === 'number' && t.count > 0 && (
                                <span className="px-1.5 py-0.5 rounded-md bg-primary/15 text-primary text-[10px] font-mono">{t.count}</span>
                            )}
                        </button>
                    );
                })}
            </div>

            {activeTab === 'overview' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <Card className="rounded-2xl border border-border/80 lg:col-span-2">
                        <CardHeader className="pb-3 border-b border-border/40 bg-muted/20">
                            <CardTitle className="text-sm flex items-center gap-2"><User className="w-4 h-4 text-amber-500" /> البيانات الشخصية</CardTitle>
                        </CardHeader>
                        <CardContent className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                            <Field icon={Phone} label="رقم الهاتف" value={driver.phone ? <a href={`tel:${driver.phone}`} className="font-mono hover:text-primary" dir="ltr">{driver.phone}</a> : '—'} />
                            <Field icon={Hash} label="رقم رخصة السياقة" value={driver.license || '—'} mono />
                            <Field icon={CreditCard} label="الراتب الأساسي" value={driver.base_salary != null ? formatCurrency(Number(driver.base_salary), 'MAD') : '—'} />
                            <Field icon={BadgePercent} label="نسبة العمولة على الرحلات" value={driver.bonus_percentage != null ? `${driver.bonus_percentage}%` : '—'} />
                            <Field icon={TruckIcon} label="الشاحنة المخصصة" value={truck ? <MatriculeBadge plate={truck.plate_number} variant="badge" size="xs" /> : <span className="text-muted-foreground">غير مسند</span>} />
                            <Field icon={Container} label="المقطورة المرتبطة" value={trailer ? <MatriculeBadge plate={trailer.plate_number} variant="badge" size="xs" /> : <span className="text-muted-foreground">—</span>} />
                        </CardContent>
                    </Card>

                    <Card className="rounded-2xl border border-border/80">
                        <CardHeader className="pb-3 border-b border-border/40 bg-muted/20">
                            <CardTitle className="text-sm flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-teal-500" /> صلاحية التأشيرة</CardTitle>
                        </CardHeader>
                        <CardContent className="p-5 space-y-4 text-xs">
                            {driver.visa_expiry_date ? (
                                <>
                                    <div className="flex items-center justify-between">
                                        <span className="text-muted-foreground">الحالة:</span>
                                        <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${visa?.className}`}>
                                            {visa?.label}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-muted-foreground">تاريخ الانتهاء:</span>
                                        <span className="font-mono text-foreground" dir="ltr">{driver.visa_expiry_date}</span>
                                    </div>
                                    {typeof visa?.daysLeft === 'number' && visa.daysLeft <= 30 && (
                                        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 flex items-start gap-2">
                                            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                                            <p className="leading-relaxed">يرجى تجديد التأشيرة قبل تاريخ الانتهاء لضمان استمرارية الرحلات الدولية.</p>
                                        </div>
                                    )}
                                </>
                            ) : (
                                <p className="text-muted-foreground">لا توجد تأشيرة مسجلة لهذا السائق.</p>
                            )}
                        </CardContent>
                    </Card>
                </div>
            )}

            {activeTab === 'salaries' && (
                <Card className="rounded-2xl border border-border/80">
                    <CardHeader className="pb-3 border-b border-border/40 bg-muted/20 flex flex-row items-center justify-between gap-2 flex-wrap">
                        <CardTitle className="text-sm flex items-center gap-2"><Wallet className="w-4 h-4 text-emerald-500" /> كشف حساب الرواتب الشهرية</CardTitle>
                        <Button size="sm" className="rounded-xl h-8 text-xs gap-1.5" onClick={() => setPayOpen(true)}>
                            <Banknote className="w-3.5 h-3.5" />
                            صرف راتب جديد
                        </Button>
                    </CardHeader>
                    <CardContent className="p-0">
                        {salaries.length === 0 ? (
                            <EmptyState icon={Wallet} label="لا توجد رواتب مسجلة لهذا السائق" />
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-xs">
                                    <thead className="bg-muted/30 text-muted-foreground">
                                        <tr>
                                            <th className="text-right p-3 font-semibold">الفترة</th>
                                            <th className="text-right p-3 font-semibold">المبلغ</th>
                                            <th className="text-right p-3 font-semibold">العملة</th>
                                            <th className="text-right p-3 font-semibold">الحالة</th>
                                            <th className="text-right p-3 font-semibold">تاريخ الصرف</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {salaries.map((s) => (
                                            <tr key={s.id} className="border-t border-border/40 hover:bg-muted/20">
                                                <td className="p-3 font-mono" dir="ltr">{s.period_start} → {s.period_end}</td>
                                                <td className="p-3 font-bold font-mono text-emerald-700 dark:text-emerald-300">{formatCurrency(Number(s.amount), s.currency)}</td>
                                                <td className="p-3 font-mono">{s.currency}</td>
                                                <td className="p-3"><StatusBadge value={s.status} kind="salary" /></td>
                                                <td className="p-3 font-mono text-muted-foreground" dir="ltr">{new Date(s.created_at).toLocaleDateString('ar-MA')}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {activeTab === 'advances' && (
                <Card className="rounded-2xl border border-border/80">
                    <CardHeader className="pb-3 border-b border-border/40 bg-muted/20">
                        <CardTitle className="text-sm flex items-center gap-2"><Banknote className="w-4 h-4 text-amber-500" /> سجل السلف المعتمدة</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        {advances.length === 0 ? (
                            <EmptyState icon={Banknote} label="لا توجد سلف مسجلة لهذا السائق" />
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-xs">
                                    <thead className="bg-muted/30 text-muted-foreground">
                                        <tr>
                                            <th className="text-right p-3 font-semibold">التاريخ</th>
                                            <th className="text-right p-3 font-semibold">السبب</th>
                                            <th className="text-right p-3 font-semibold">المبلغ</th>
                                            <th className="text-right p-3 font-semibold">إضافات</th>
                                            <th className="text-right p-3 font-semibold">المجموع</th>
                                            <th className="text-right p-3 font-semibold">الحالة</th>
                                            <th className="text-right p-3 font-semibold">رقم CMR</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {advances.map((a) => {
                                            const total = Number(a.amount) + Number(a.extra_advances || 0) + Number(a.driver_allowance || 0) + Number(a.receipt_expenses || 0);
                                            return (
                                                <tr key={a.id} className="border-t border-border/40 hover:bg-muted/20">
                                                    <td className="p-3 font-mono" dir="ltr">{a.date}</td>
                                                    <td className="p-3 max-w-[200px] truncate">{a.reason || '—'}</td>
                                                    <td className="p-3 font-mono">{formatCurrency(Number(a.amount), a.currency)}</td>
                                                    <td className="p-3 font-mono text-muted-foreground">{formatCurrency(Number(a.extra_advances || 0) + Number(a.driver_allowance || 0) + Number(a.receipt_expenses || 0), a.currency)}</td>
                                                    <td className="p-3 font-bold font-mono">{formatCurrency(total, a.currency)}</td>
                                                    <td className="p-3"><StatusBadge value={a.status} kind="advance" /></td>
                                                    <td className="p-3 font-mono text-muted-foreground">{a.cmr_number || '—'}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {activeTab === 'fines' && (
                <Card className="rounded-2xl border border-border/80">
                    <CardHeader className="pb-3 border-b border-border/40 bg-muted/20">
                        <CardTitle className="text-sm flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-rose-500" /> المخالفات والغرامات</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        {fines.length === 0 ? (
                            <EmptyState icon={CheckCircle2} label="لا توجد مخالفات مسجلة — السائق نظيف" />
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-xs">
                                    <thead className="bg-muted/30 text-muted-foreground">
                                        <tr>
                                            <th className="text-right p-3 font-semibold">التاريخ</th>
                                            <th className="text-right p-3 font-semibold">النوع</th>
                                            <th className="text-right p-3 font-semibold">الوصف</th>
                                            <th className="text-right p-3 font-semibold">المبلغ</th>
                                            <th className="text-right p-3 font-semibold">الحالة</th>
                                            <th className="text-right p-3 font-semibold">تم اقتطاعها؟</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {fines.map((f) => (
                                            <tr key={f.id} className="border-t border-border/40 hover:bg-muted/20">
                                                <td className="p-3 font-mono" dir="ltr">{new Date(f.created_at).toLocaleDateString('ar-MA')}</td>
                                                <td className="p-3">{f.fine_type || '—'}</td>
                                                <td className="p-3 max-w-[240px] truncate">{f.description || '—'}</td>
                                                <td className="p-3 font-bold font-mono text-rose-700 dark:text-rose-300">{formatCurrency(Number(f.amount), f.currency)}</td>
                                                <td className="p-3"><StatusBadge value={f.status} kind="fine" /></td>
                                                <td className="p-3">
                                                    {f.deducted_from_settlement ? (
                                                        <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 text-[10px] font-semibold">
                                                            <CheckCircle2 className="w-3 h-3" /> نعم ({f.deducted_at ? new Date(f.deducted_at).toLocaleDateString('ar-MA') : ''})
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 text-[10px] font-semibold">
                                                            <Clock className="w-3 h-3" /> معلقة
                                                        </span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {activeTab === 'trips' && (
                <Card className="rounded-2xl border border-border/80">
                    <CardHeader className="pb-3 border-b border-border/40 bg-muted/20">
                        <CardTitle className="text-sm flex items-center gap-2"><Route className="w-4 h-4 text-blue-500" /> الرحلات الدولية المسندة</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        {trips.length === 0 ? (
                            <EmptyState icon={Route} label="لا توجد رحلات مسجلة لهذا السائق" />
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-xs">
                                    <thead className="bg-muted/30 text-muted-foreground">
                                        <tr>
                                            <th className="text-right p-3 font-semibold">المسار</th>
                                            <th className="text-right p-3 font-semibold">العميل</th>
                                            <th className="text-right p-3 font-semibold">تاريخ الانطلاق</th>
                                            <th className="text-right p-3 font-semibold">السعر</th>
                                            <th className="text-right p-3 font-semibold">CMR</th>
                                            <th className="text-right p-3 font-semibold">الحالة</th>
                                            <th className="text-right p-3 font-semibold">وثائق</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {trips.map((t) => (
                                            <tr key={t.id} className="border-t border-border/40 hover:bg-muted/20">
                                                <td className="p-3 max-w-[200px]">
                                                    <div className="font-semibold">{t.route_export || t.route}</div>
                                                    {t.route_import && <div className="text-muted-foreground text-[10px]">↩ {t.route_import}</div>}
                                                </td>
                                                <td className="p-3">
                                                    {t.client_id && clients[t.client_id] ? (
                                                        <span className="inline-flex items-center gap-1"><Building2 className="w-3 h-3 text-muted-foreground" />{clients[t.client_id].name}</span>
                                                    ) : '—'}
                                                </td>
                                                <td className="p-3 font-mono" dir="ltr">{t.departure_date}</td>
                                                <td className="p-3 font-bold font-mono">{formatCurrency(Number(t.price), 'MAD')}</td>
                                                <td className="p-3 font-mono text-muted-foreground">{t.cmr_number || t.cmr_export_number || '—'}</td>
                                                <td className="p-3"><StatusBadge value={t.status} kind="trip" /></td>
                                                <td className="p-3">
                                                    <div className="flex items-center gap-1.5">
                                                        {t.cmr_export_url && <DocLink href={t.cmr_export_url} label="CMR ذهاب" />}
                                                        {t.cmr_import_url && <DocLink href={t.cmr_import_url} label="CMR عودة" />}
                                                        {t.facture_url && <DocLink href={t.facture_url} label="فاتورة" />}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            <PaySalaryDialog
                isOpen={isPayOpen}
                onClose={() => setPayOpen(false)}
                onSuccess={() => {
                    setPayOpen(false);
                    fetchAll();
                    toast({ title: 'تم صرف الراتب وتحديث الكشوفات بنجاح' });
                }}
                driverName={driver.name}
                netPay={lastSalaryNet || 0}
                currency={latestSalary?.currency || 'MAD'}
                driverId={driver.id}
                month={payMonth}
                year={payYear}
            />
        </div>
    );
}

function KpiCard({ icon: Icon, label, value, subtitle, color }: { icon: any; label: string; value: string; subtitle?: string; color: 'amber' | 'rose' | 'emerald' | 'blue' }) {
    const palette: Record<string, string> = {
        amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
        rose: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
        emerald: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
        blue: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    };
    return (
        <div className="bg-card border border-border/80 p-4 rounded-2xl shadow-xs">
            <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-muted-foreground uppercase">{label}</span>
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${palette[color]}`}>
                    <Icon className="w-4 h-4" />
                </div>
            </div>
            <div className="text-2xl font-extrabold font-mono text-foreground mt-2">{value}</div>
            {subtitle && <div className="text-[11px] text-muted-foreground mt-1">{subtitle}</div>}
        </div>
    );
}

function Field({ icon: Icon, label, value, mono }: { icon: any; label: string; value: React.ReactNode; mono?: boolean }) {
    return (
        <div className="space-y-1.5">
            <div className="text-[11px] font-semibold text-muted-foreground uppercase flex items-center gap-1.5">
                <Icon className="w-3.5 h-3.5" />
                {label}
            </div>
            <div className={`text-sm text-foreground ${mono ? 'font-mono' : ''}`}>{value}</div>
        </div>
    );
}

function StatusBadge({ value, kind }: { value: string; kind: 'salary' | 'advance' | 'fine' | 'trip' }) {
    const map: Record<string, { icon: any; cls: string; label: string }> = {
        settled: { icon: CheckCircle2, cls: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/25', label: 'مصروف' },
        approved: { icon: CheckCircle2, cls: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/25', label: 'معتمدة' },
        paid: { icon: CheckCircle2, cls: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/25', label: 'مدفوعة' },
        completed: { icon: CheckCircle2, cls: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/25', label: 'مكتملة' },
        pending: { icon: Clock, cls: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/25', label: 'قيد الانتظار' },
        pending_settlement: { icon: Clock, cls: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/25', label: 'بانتظار التسوية' },
        rejected: { icon: XCircle, cls: 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/25', label: 'مرفوضة' },
        cancelled: { icon: XCircle, cls: 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/25', label: 'ملغاة' },
        in_progress: { icon: Route, cls: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/25', label: 'قيد التنفيذ' },
        in_transit: { icon: Route, cls: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/25', label: 'في الطريق' },
        draft: { icon: Clock, cls: 'bg-slate-500/15 text-slate-600 dark:text-slate-400 border-slate-500/25', label: 'مسودة' },
        open: { icon: AlertTriangle, cls: 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/25', label: 'مفتوحة' },
        closed: { icon: CheckCircle2, cls: 'bg-slate-500/15 text-slate-600 dark:text-slate-400 border-slate-500/25', label: 'مغلقة' },
    };
    const cfg = map[value] || { icon: Receipt, cls: 'bg-slate-500/15 text-slate-600 dark:text-slate-400 border-slate-500/25', label: value || 'غير محدد' };
    const Icon = cfg.icon;
    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${cfg.cls}`}>
            <Icon className="w-3 h-3" />
            {cfg.label}
        </span>
    );
}

function DocLink({ href, label }: { href: string; label: string }) {
    return (
        <a href={href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary/10 text-primary text-[10px] font-semibold hover:bg-primary/20">
            <FileText className="w-3 h-3" />
            {label}
            <ExternalLink className="w-2.5 h-2.5" />
        </a>
    );
}

function EmptyState({ icon: Icon, label }: { icon: any; label: string }) {
    return (
        <div className="text-center py-10 text-muted-foreground text-xs">
            <Icon className="w-7 h-7 mx-auto mb-2 opacity-50" />
            <p>{label}</p>
        </div>
    );
}