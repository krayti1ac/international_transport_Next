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
import { useLanguage } from '@/components/language-provider';
import Decimal from 'decimal.js';

interface DriverDetailViewProps {
    driverId: number;
}

type TabKey = 'overview' | 'salaries' | 'advances' | 'fines' | 'trips';

export function DriverDetailView({ driverId }: DriverDetailViewProps) {
    const { t, dir } = useLanguage();
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
            toast({ title: t('خطأ في تحميل بيانات السائق', 'Erreur lors du chargement des données du chauffeur'), description: err?.message, variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    }, [driverId, supabase, toast, t]);

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
        if (diffDays < 0) return { label: t('التأشيرة منتهية الصلاحية', 'Visa expiré'), className: 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/25', daysLeft: diffDays };
        if (diffDays <= 30) return { label: t(`تنتهي خلال ${diffDays} يوم`, `Expire dans ${diffDays} j`), className: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/25', daysLeft: diffDays };
        return { label: t(`سارية (${diffDays} يوم)`, `Valide (${diffDays} j)`), className: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/25', daysLeft: diffDays };
    }, [driver, t]);

    const totalAdvances = useMemo(() => {
        return advances.reduce((sum, a) => {
            if (a.status !== 'approved') return sum;
            const amt = new Decimal(a.amount || 0);
            const extra = new Decimal(a.extra_advances || 0);
            const allow = new Decimal(a.driver_allowance || 0);
            const receipt = new Decimal(a.receipt_expenses || 0);
            return sum.plus(amt).plus(extra).plus(allow).plus(receipt);
        }, new Decimal(0)).toNumber();
    }, [advances]);

    const pendingFines = useMemo(() => {
        return fines
            .filter((f) => !f.deducted_from_settlement)
            .reduce((sum, f) => sum.plus(new Decimal(f.amount || 0)), new Decimal(0))
            .toNumber();
    }, [fines]);

    const latestSalary = salaries[0];
    const lastSalaryNet = latestSalary ? Number(latestSalary.amount) : 0;

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-24 gap-3" dir={dir}>
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                <p className="text-xs text-muted-foreground">{t('جاري تحميل ملف السائق...', 'Chargement du dossier chauffeur...')}</p>
            </div>
        );
    }

    if (!driver) {
        return (
            <div className="text-center py-16 bg-card rounded-2xl border border-border" dir={dir}>
                <User className="w-10 h-10 mx-auto text-muted-foreground/50 mb-2" />
                <p className="text-sm font-semibold">{t('السائق غير موجود', 'Chauffeur introuvable')}</p>
                <Link href="/drivers" className="text-xs text-primary mt-2 inline-block">
                    {t('العودة إلى قائمة السائقين', 'Retour à la liste des chauffeurs')}
                </Link>
            </div>
        );
    }

    const tabs: Array<{ key: TabKey; label: string; icon: any; count?: number }> = [
        { key: 'overview', label: t('الملف الشخصي', 'Profil'), icon: User },
        { key: 'salaries', label: t('الرواتب وكشف الحساب', 'Salaires et Relevé'), icon: Wallet, count: salaries.length },
        { key: 'advances', label: t('السلف النشطة', 'Avances Actives'), icon: Banknote, count: advances.filter((a) => a.status === 'approved').length },
        { key: 'fines', label: t('المخالفات والغرامات', 'Infractions et Amendes'), icon: AlertTriangle, count: fines.length },
        { key: 'trips', label: t('الرحلات الدولية', 'Missions Internationales'), icon: Route, count: trips.length },
    ];

    return (
        <div className="space-y-6 max-w-7xl mx-auto" dir={dir}>
            <div className="flex flex-col gap-3 pb-2 border-b border-border/40">
                <Link href="/drivers" className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 w-fit">
                    <ArrowRight className={`w-3.5 h-3.5 ${dir === 'rtl' ? '' : 'rotate-180'}`} />
                    {t('العودة إلى قائمة السائقين', 'Retour à la liste des chauffeurs')}
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
                        {t('تحديث البيانات', 'Actualiser')}
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiCard icon={Banknote} label={t('إجمالي السلف المعتمدة', 'Total Avances Approuvées')} value={formatCurrency(totalAdvances, 'MAD')} subtitle={t(`${advances.filter((a) => a.status === 'approved').length} عملية`, `${advances.filter((a) => a.status === 'approved').length} opération(s)`)} color="amber" />
                <KpiCard icon={AlertTriangle} label={t('مخالفات معلقة', 'Amendes En Suspens')} value={formatCurrency(pendingFines, 'MAD')} subtitle={t(`${fines.filter((f) => !f.deducted_from_settlement).length} غرامة`, `${fines.filter((f) => !f.deducted_from_settlement).length} amende(s)`)} color="rose" />
                <KpiCard icon={Wallet} label={t('آخر راتب مصروف', 'Dernier Salaire Versé')} value={formatCurrency(lastSalaryNet, latestSalary?.currency || 'MAD')} subtitle={latestSalary ? `${latestSalary.period_start} → ${latestSalary.period_end}` : t('لا يوجد', 'Aucun')} color="emerald" />
                <KpiCard icon={Route} label={t('إجمالي الرحلات', 'Total Missions')} value={`${trips.length}`} subtitle={t('رحلة دولية', 'missions internationales')} color="blue" />
            </div>

            <div className="flex flex-wrap gap-1 bg-muted/40 p-1 rounded-2xl border border-border/60 w-fit">
                {tabs.map((tItem) => {
                    const Icon = tItem.icon;
                    const active = activeTab === tItem.key;
                    return (
                        <button
                            key={tItem.key}
                            onClick={() => setActiveTab(tItem.key)}
                            className={`px-3 py-2 text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5 ${
                                active ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
                            }`}
                        >
                            <Icon className="w-3.5 h-3.5" />
                            {tItem.label}
                            {typeof tItem.count === 'number' && tItem.count > 0 && (
                                <span className="px-1.5 py-0.5 rounded-md bg-primary/15 text-primary text-[10px] font-mono">{tItem.count}</span>
                            )}
                        </button>
                    );
                })}
            </div>

            {activeTab === 'overview' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <Card className="rounded-2xl border border-border/80 lg:col-span-2">
                        <CardHeader className="pb-3 border-b border-border/40 bg-muted/20">
                            <CardTitle className="text-sm flex items-center gap-2"><User className="w-4 h-4 text-amber-500" /> {t('البيانات الشخصية', 'Informations personnelles')}</CardTitle>
                        </CardHeader>
                        <CardContent className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                            <Field icon={Phone} label={t('رقم الهاتف', 'Numéro de téléphone')} value={driver.phone ? <a href={`tel:${driver.phone}`} className="font-mono hover:text-primary" dir="ltr">{driver.phone}</a> : '—'} />
                            <Field icon={Hash} label={t('رقم رخصة السياقة', 'Numéro de permis')} value={driver.license || '—'} mono />
                            <Field icon={CreditCard} label={t('الراتب الأساسي', 'Salaire de base')} value={driver.base_salary != null ? formatCurrency(Number(driver.base_salary), 'MAD') : '—'} />
                            <Field icon={BadgePercent} label={t('نسبة العمولة على الرحلات', 'Commission sur trajets')} value={driver.bonus_percentage != null ? `${driver.bonus_percentage}%` : '—'} />
                            <Field icon={TruckIcon} label={t('الشاحنة المخصصة', 'Camion assigné')} value={truck ? <MatriculeBadge plate={truck.plate_number} variant="badge" size="xs" /> : <span className="text-muted-foreground">{t('غير مسند', 'Non assigné')}</span>} />
                            <Field icon={Container} label={t('المقطورة المرتبطة', 'Remorque liée')} value={trailer ? <MatriculeBadge plate={trailer.plate_number} variant="badge" size="xs" /> : <span className="text-muted-foreground">—</span>} />
                        </CardContent>
                    </Card>

                    <Card className="rounded-2xl border border-border/80">
                        <CardHeader className="pb-3 border-b border-border/40 bg-muted/20">
                            <CardTitle className="text-sm flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-teal-500" /> {t('صلاحية التأشيرة', 'Validité du Visa')}</CardTitle>
                        </CardHeader>
                        <CardContent className="p-5 space-y-4 text-xs">
                            {driver.visa_expiry_date ? (
                                <>
                                    <div className="flex items-center justify-between">
                                        <span className="text-muted-foreground">{t('الحالة:', 'Statut :')}</span>
                                        <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${visa?.className}`}>
                                            {visa?.label}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-muted-foreground">{t('تاريخ الانتهاء:', 'Date d\'expiration :')}</span>
                                        <span className="font-mono text-foreground" dir="ltr">{driver.visa_expiry_date}</span>
                                    </div>
                                    {typeof visa?.daysLeft === 'number' && visa.daysLeft <= 30 && (
                                        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 flex items-start gap-2">
                                            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                                            <p className="leading-relaxed">{t('يرجى تجديد التأشيرة قبل تاريخ الانتهاء لضمان استمرارية الرحلات الدولية.', 'Veuillez renouveler le visa avant la date d\'expiration pour assurer la continuité des trajets.')}</p>
                                        </div>
                                    )}
                                </>
                            ) : (
                                <p className="text-muted-foreground">{t('لا توجد تأشيرة مسجلة لهذا السائق.', 'Aucun visa enregistré pour ce chauffeur.')}</p>
                            )}
                        </CardContent>
                    </Card>
                </div>
            )}

            {activeTab === 'salaries' && (
                <Card className="rounded-2xl border border-border/80">
                    <CardHeader className="pb-3 border-b border-border/40 bg-muted/20 flex flex-row items-center justify-between gap-2 flex-wrap">
                        <CardTitle className="text-sm flex items-center gap-2"><Wallet className="w-4 h-4 text-emerald-500" /> {t('كشف حساب الرواتب الشهرية', 'Relevé des salaires mensuels')}</CardTitle>
                        <Button size="sm" className="rounded-xl h-8 text-xs gap-1.5" onClick={() => setPayOpen(true)}>
                            <Banknote className="w-3.5 h-3.5" />
                            {t('صرف راتب جديد', 'Nouveau versement')}
                        </Button>
                    </CardHeader>
                    <CardContent className="p-0">
                        {salaries.length === 0 ? (
                            <EmptyState icon={Wallet} label={t('لا توجد رواتب مسجلة لهذا السائق', 'Aucun salaire enregistré pour ce chauffeur')} />
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-xs">
                                    <thead className="bg-muted/30 text-muted-foreground">
                                        <tr>
                                            <th className="text-start p-3 font-semibold">{t('الفترة', 'Période')}</th>
                                            <th className="text-start p-3 font-semibold">{t('المبلغ', 'Montant')}</th>
                                            <th className="text-start p-3 font-semibold">{t('العملة', 'Devise')}</th>
                                            <th className="text-start p-3 font-semibold">{t('الحالة', 'Statut')}</th>
                                            <th className="text-start p-3 font-semibold">{t('تاريخ الصرف', 'Date de versement')}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {salaries.map((s) => (
                                            <tr key={s.id} className="border-t border-border/40 hover:bg-muted/20">
                                                <td className="p-3 font-mono" dir="ltr">{s.period_start} → {s.period_end}</td>
                                                <td className="p-3 font-bold font-mono text-emerald-700 dark:text-emerald-300">{formatCurrency(Number(s.amount), s.currency)}</td>
                                                <td className="p-3 font-mono">{s.currency}</td>
                                                <td className="p-3"><StatusBadge value={s.status} kind="salary" t={t} /></td>
                                                <td className="p-3 font-mono text-muted-foreground" dir="ltr">{new Date(s.created_at).toLocaleDateString(dir === 'rtl' ? 'ar-MA' : 'fr-FR')}</td>
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
                        <CardTitle className="text-sm flex items-center gap-2"><Banknote className="w-4 h-4 text-amber-500" /> {t('سجل السلف المعتمدة', 'Historique des avances approuvées')}</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        {advances.length === 0 ? (
                            <EmptyState icon={Banknote} label={t('لا توجد سلف مسجلة لهذا السائق', 'Aucune avance enregistrée pour ce chauffeur')} />
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-xs">
                                    <thead className="bg-muted/30 text-muted-foreground">
                                        <tr>
                                            <th className="text-start p-3 font-semibold">{t('التاريخ', 'Date')}</th>
                                            <th className="text-start p-3 font-semibold">{t('السبب', 'Motif')}</th>
                                            <th className="text-start p-3 font-semibold">{t('المبلغ', 'Montant')}</th>
                                            <th className="text-start p-3 font-semibold">{t('إضافات', 'Suppléments')}</th>
                                            <th className="text-start p-3 font-semibold">{t('المجموع', 'Total')}</th>
                                            <th className="text-start p-3 font-semibold">{t('الحالة', 'Statut')}</th>
                                            <th className="text-start p-3 font-semibold">{t('رقم CMR', 'N° CMR')}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {advances.map((a) => {
                                            const total = new Decimal(a.amount || 0)
                                                .plus(new Decimal(a.extra_advances || 0))
                                                .plus(new Decimal(a.driver_allowance || 0))
                                                .plus(new Decimal(a.receipt_expenses || 0));
                                            const additions = new Decimal(a.extra_advances || 0)
                                                .plus(new Decimal(a.driver_allowance || 0))
                                                .plus(new Decimal(a.receipt_expenses || 0));

                                            return (
                                                <tr key={a.id} className="border-t border-border/40 hover:bg-muted/20">
                                                    <td className="p-3 font-mono" dir="ltr">{a.date}</td>
                                                    <td className="p-3 max-w-[200px] truncate">{a.reason || '—'}</td>
                                                    <td className="p-3 font-mono">{formatCurrency(Number(a.amount), a.currency)}</td>
                                                    <td className="p-3 font-mono text-muted-foreground">{formatCurrency(additions.toNumber(), a.currency)}</td>
                                                    <td className="p-3 font-bold font-mono">{formatCurrency(total.toNumber(), a.currency)}</td>
                                                    <td className="p-3"><StatusBadge value={a.status} kind="advance" t={t} /></td>
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
                        <CardTitle className="text-sm flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-rose-500" /> {t('المخالفات والغرامات', 'Infractions et Amendes')}</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        {fines.length === 0 ? (
                            <EmptyState icon={CheckCircle2} label={t('لا توجد مخالفات مسجلة — السائق نظيف', 'Aucune infraction enregistrée — Chauffeur en règle')} />
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-xs">
                                    <thead className="bg-muted/30 text-muted-foreground">
                                        <tr>
                                            <th className="text-start p-3 font-semibold">{t('التاريخ', 'Date')}</th>
                                            <th className="text-start p-3 font-semibold">{t('النوع', 'Type')}</th>
                                            <th className="text-start p-3 font-semibold">{t('الوصف', 'Description')}</th>
                                            <th className="text-start p-3 font-semibold">{t('المبلغ', 'Montant')}</th>
                                            <th className="text-start p-3 font-semibold">{t('الحالة', 'Statut')}</th>
                                            <th className="text-start p-3 font-semibold">{t('تم اقتطاعها؟', 'Déduite ?')}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {fines.map((f) => (
                                            <tr key={f.id} className="border-t border-border/40 hover:bg-muted/20">
                                                <td className="p-3 font-mono" dir="ltr">{new Date(f.created_at).toLocaleDateString(dir === 'rtl' ? 'ar-MA' : 'fr-FR')}</td>
                                                <td className="p-3">{f.fine_type || '—'}</td>
                                                <td className="p-3 max-w-[240px] truncate">{f.description || '—'}</td>
                                                <td className="p-3 font-bold font-mono text-rose-700 dark:text-rose-300">{formatCurrency(Number(f.amount), f.currency)}</td>
                                                <td className="p-3"><StatusBadge value={f.status} kind="fine" t={t} /></td>
                                                <td className="p-3">
                                                    {f.deducted_from_settlement ? (
                                                        <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 text-[10px] font-semibold">
                                                            <CheckCircle2 className="w-3 h-3" /> {t('نعم', 'Oui')} ({f.deducted_at ? new Date(f.deducted_at).toLocaleDateString(dir === 'rtl' ? 'ar-MA' : 'fr-FR') : ''})
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 text-[10px] font-semibold">
                                                            <Clock className="w-3 h-3" /> {t('معلقة', 'En attente')}
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
                        <CardTitle className="text-sm flex items-center gap-2"><Route className="w-4 h-4 text-blue-500" /> {t('الرحلات الدولية المسندة', 'Missions Internationales Assignées')}</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        {trips.length === 0 ? (
                            <EmptyState icon={Route} label={t('لا توجد رحلات مسجلة لهذا السائق', 'Aucun trajet enregistré pour ce chauffeur')} />
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-xs">
                                    <thead className="bg-muted/30 text-muted-foreground">
                                        <tr>
                                            <th className="text-start p-3 font-semibold">{t('المسار', 'Trajet')}</th>
                                            <th className="text-start p-3 font-semibold">{t('العميل', 'Client')}</th>
                                            <th className="text-start p-3 font-semibold">{t('تاريخ الانطلاق', 'Date départ')}</th>
                                            <th className="text-start p-3 font-semibold">{t('السعر', 'Prix')}</th>
                                            <th className="text-start p-3 font-semibold">{t('CMR', 'CMR')}</th>
                                            <th className="text-start p-3 font-semibold">{t('الحالة', 'Statut')}</th>
                                            <th className="text-start p-3 font-semibold">{t('وثائق', 'Documents')}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {trips.map((tripItem) => (
                                            <tr key={tripItem.id} className="border-t border-border/40 hover:bg-muted/20">
                                                <td className="p-3 max-w-[200px]">
                                                    <div className="font-semibold">{tripItem.route_export || tripItem.route}</div>
                                                    {tripItem.route_import && <div className="text-muted-foreground text-[10px]">↩ {tripItem.route_import}</div>}
                                                </td>
                                                <td className="p-3">
                                                    {tripItem.client_id && clients[tripItem.client_id] ? (
                                                        <span className="inline-flex items-center gap-1"><Building2 className="w-3 h-3 text-muted-foreground" />{clients[tripItem.client_id].name}</span>
                                                    ) : '—'}
                                                </td>
                                                <td className="p-3 font-mono" dir="ltr">{tripItem.departure_date}</td>
                                                <td className="p-3 font-bold font-mono">{formatCurrency(Number(tripItem.price), 'MAD')}</td>
                                                <td className="p-3 font-mono text-muted-foreground">{tripItem.cmr_number || tripItem.cmr_export_number || '—'}</td>
                                                <td className="p-3"><StatusBadge value={tripItem.status} kind="trip" t={t} /></td>
                                                <td className="p-3">
                                                    <div className="flex items-center gap-1.5">
                                                        {tripItem.cmr_export_url && <DocLink href={tripItem.cmr_export_url} label={t('CMR ذهاب', 'CMR Aller')} />}
                                                        {tripItem.cmr_import_url && <DocLink href={tripItem.cmr_import_url} label={t('CMR عودة', 'CMR Retour')} />}
                                                        {tripItem.facture_url && <DocLink href={tripItem.facture_url} label={t('فاتورة', 'Facture')} />}
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
                    toast({ title: t('تم صرف الراتب وتحديث الكشوفات بنجاح', 'Salaire versé et relevés mis à jour avec succès') });
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

function StatusBadge({ value, kind, t }: { value: string; kind: 'salary' | 'advance' | 'fine' | 'trip'; t: (ar: string, fr: string) => string }) {
    const map: Record<string, { icon: any; cls: string; label: string }> = {
        settled: { icon: CheckCircle2, cls: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/25', label: t('مصروف', 'Versé') },
        approved: { icon: CheckCircle2, cls: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/25', label: t('معتمدة', 'Approuvée') },
        paid: { icon: CheckCircle2, cls: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/25', label: t('مدفوعة', 'Payée') },
        completed: { icon: CheckCircle2, cls: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/25', label: t('مكتملة', 'Terminée') },
        pending: { icon: Clock, cls: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/25', label: t('قيد الانتظار', 'En attente') },
        pending_settlement: { icon: Clock, cls: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/25', label: t('بانتظار التسوية', 'En attente de règlement') },
        rejected: { icon: XCircle, cls: 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/25', label: t('مرفوضة', 'Rejetée') },
        cancelled: { icon: XCircle, cls: 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/25', label: t('ملغاة', 'Annulée') },
        in_progress: { icon: Route, cls: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/25', label: t('قيد التنفيذ', 'En cours') },
        in_transit: { icon: Route, cls: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/25', label: t('في الطريق', 'En route') },
        draft: { icon: Clock, cls: 'bg-slate-500/15 text-slate-600 dark:text-slate-400 border-slate-500/25', label: t('مسودة', 'Brouillon') },
        open: { icon: AlertTriangle, cls: 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/25', label: t('مفتوحة', 'Ouverte') },
        closed: { icon: CheckCircle2, cls: 'bg-slate-500/15 text-slate-600 dark:text-slate-400 border-slate-500/25', label: t('مغلقة', 'Fermée') },
    };
    const cfg = map[value] || { icon: Receipt, cls: 'bg-slate-500/15 text-slate-600 dark:text-slate-400 border-slate-500/25', label: value || t('غير محدد', 'Non défini') };
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