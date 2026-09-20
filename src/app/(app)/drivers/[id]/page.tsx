import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  ArrowRight, 
  User, 
  CreditCard, 
  Truck, 
  AlertTriangle, 
  DollarSign, 
  CheckCircle2, 
  XCircle, 
  MapPin, 
  ShieldCheck, 
  Award, 
  Wallet,
  Globe2 
} from 'lucide-react';
import Decimal from 'decimal.js';
import { formatCurrency } from '@/lib/forex';
import { resolveDriverPhoto } from '@/lib/driver-photos';
import { evaluateAfricanDriverVisa } from '@/lib/african-corridor';
import type { Driver, TripOrder, Advance, FinePenalty, DriverSalary } from '@/types/database';

Decimal.config({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

interface DriverDetailPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: DriverDetailPageProps) {
  const { id } = await params;
  return {
    title: `ملف السائق #${id} | Trans Bodanon TMS`,
  };
}

export default async function DriverDetailPage({ params }: DriverDetailPageProps) {
  const { id } = await params;
  const driverId = parseInt(id, 10);

  if (isNaN(driverId)) {
    notFound();
  }

  const supabase = await createClient();

  // جلب بيانات السائق والعلاقات التشغيلية والمالية المرتبطة به بالتوازي
  const [
    driverRes,
    tripsRes,
    advancesRes,
    finesRes,
    salariesRes,
  ] = await Promise.all([
    supabase.from('drivers').select('*').eq('id', driverId).maybeSingle<Driver>(),
    supabase.from('trip_orders').select('*').eq('driver_id', driverId).order('departure_date', { ascending: false }),
    supabase.from('advances').select('*').eq('driver_id', driverId).order('date', { ascending: false }),
    supabase.from('fine_penalties').select('*').eq('driver_id', driverId).order('created_at', { ascending: false }),
    supabase.from('driver_salaries').select('*').eq('driver_id', driverId).order('created_at', { ascending: false }),
  ]);

  if (!driverRes.data) {
    notFound();
  }

  const driver = driverRes.data;
  const trips = (tripsRes.data || []) as TripOrder[];
  const advances = (advancesRes.data || []) as Advance[];
  const fines = (finesRes.data || []) as FinePenalty[];
  const salaries = (salariesRes.data || []) as DriverSalary[];

  // الحسابات المالية الدقيقة باستخدام Decimal.js
  const totalAdvances = advances.reduce(
    (acc, adv) => acc.plus(new Decimal(adv.amount || 0)),
    new Decimal(0)
  );

  const totalFines = fines.reduce(
    (acc, fine) => acc.plus(new Decimal(fine.amount || 0)),
    new Decimal(0)
  );

  const pendingFines = fines
    .filter((f) => !f.deducted_from_settlement)
    .reduce((acc, fine) => acc.plus(new Decimal(fine.amount || 0)), new Decimal(0));

  const completedTrips = trips.filter((t) => t.status === 'completed' || t.status === 'delivered').length;
  const activeTrips = trips.filter((t) => t.status === 'in_transit' || t.status === 'customs_export').length;

  // فحص صلاحية تأشيرة شنغن
  let visaStatus: 'valid' | 'expiring' | 'expired' | 'none' = 'none';
  let daysUntilVisaExpiry: number | null = null;

  if (driver.visa_expiry_date) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expiry = new Date(driver.visa_expiry_date);
    const diffTime = expiry.getTime() - today.getTime();
    daysUntilVisaExpiry = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (daysUntilVisaExpiry < 0) {
      visaStatus = 'expired';
    } else if (daysUntilVisaExpiry <= 30) {
      visaStatus = 'expiring';
    } else {
      visaStatus = 'valid';
    }
  }

  // فحص صلاحية تأشيرة الممر الإفريقي البري (موريتانيا / السنغال)
  const africanVisa = evaluateAfricanDriverVisa(
    driver.african_visa_expiry_date,
    driver.african_visa_number
  );

  const photoUrl = resolveDriverPhoto(driver);

  return (
    <div className="space-y-6 max-w-7xl mx-auto" dir="rtl">
      {/* شريط التنقل العلوي والرجوع */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/drivers">
            <Button variant="outline" size="icon" className="rounded-xl h-10 w-10">
              <ArrowRight className="w-5 h-5 text-muted-foreground" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold font-amiri text-foreground flex items-center gap-2">
              <span>{driver.name}</span>
              <Badge variant={driver.status === 'active' ? 'default' : 'secondary'} className="text-xs">
                {driver.status === 'active' ? 'نشط ومتاح' : driver.status}
              </Badge>
            </h1>
            <p className="text-xs text-muted-foreground">الملف التعريفي والمالي الشامل للسائق الدولي</p>
          </div>
        </div>
      </div>

      {/* بطاقة الهوية ورادار التأشيرة */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* معلومات السائق والاتصال */}
        <Card className="md:col-span-1 shadow-sm border-border/80 rounded-2xl">
          <CardContent className="pt-6 flex flex-col items-center text-center">
            <div className="relative w-28 h-28 rounded-full overflow-hidden border-4 border-primary/20 shadow-md mb-4 bg-muted flex items-center justify-center">
              {photoUrl ? (
                <Image src={photoUrl} alt={driver.name} fill className="object-cover" unoptimized />
              ) : (
                <User className="w-12 h-12 text-muted-foreground" />
              )}
            </div>

            <h2 className="text-lg font-bold">{driver.name}</h2>
            {driver.phone ? (
              <a
                href={`tel:${driver.phone}`}
                className="text-xs text-muted-foreground font-mono mt-0.5 hover:text-primary transition-colors block"
                dir="ltr"
              >
                {driver.phone}
              </a>
            ) : (
              <p className="text-xs text-muted-foreground font-mono mt-0.5">بدون رقم هاتف</p>
            )}

            <div className="w-full mt-6 space-y-3 text-start border-t pt-4">
              <div className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <CreditCard className="w-3.5 h-3.5 text-primary" />
                  رقم رخصة السياقة:
                </span>
                <span className="font-mono font-bold">{driver.license || 'غير مسجل'}</span>
              </div>

              <div className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Truck className="w-3.5 h-3.5 text-primary" />
                  الشاحنة الافتراضية:
                </span>
                <span className="font-semibold">{driver.default_truck_name || 'غير مسندة'}</span>
              </div>

              <div className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                  الراتب الأساسي:
                </span>
                <span className="font-bold text-emerald-600 font-mono">
                  {formatCurrency(driver.base_salary, 'MAD')}
                </span>
              </div>

              <div className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Award className="w-3.5 h-3.5 text-amber-500" />
                  نسبة البونص / التحفيز:
                </span>
                <span className="font-bold font-mono">{driver.bonus_percentage}%</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* مؤشرات الأداء والوضعية الدولية */}
        <div className="md:col-span-2 space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card className="rounded-2xl shadow-sm border-r-4 border-r-blue-500">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground font-medium">إجمالي الرحلات</p>
                <p className="text-2xl font-bold font-mono mt-1">{trips.length}</p>
                <p className="text-[11px] text-emerald-600 font-medium mt-0.5">{completedTrips} مكتملة</p>
              </CardContent>
            </Card>

            <Card className="rounded-2xl shadow-sm border-r-4 border-r-amber-500">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground font-medium">رحلات جارية</p>
                <p className="text-2xl font-bold font-mono mt-1">{activeTrips}</p>
                <p className="text-[11px] text-amber-600 font-medium mt-0.5">في المسار الدولي</p>
              </CardContent>
            </Card>

            <Card className="rounded-2xl shadow-sm border-r-4 border-r-emerald-500">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground font-medium">إجمالي السلف</p>
                <p className="text-xl font-bold font-mono text-emerald-700 mt-1">
                  {formatCurrency(totalAdvances, 'MAD')}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{advances.length} عمليات صرف</p>
              </CardContent>
            </Card>

            <Card className="rounded-2xl shadow-sm border-r-4 border-r-rose-500">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground font-medium">مخالفات معلقة</p>
                <p className="text-xl font-bold font-mono text-rose-600 mt-1">
                  {formatCurrency(pendingFines, 'MAD')}
                </p>
                <p className="text-[11px] text-rose-500 mt-0.5">من أصل {formatCurrency(totalFines, 'MAD')} مسجلة</p>
              </CardContent>
            </Card>
          </div>

          {/* رادارات التأشيرات الدولية (الممر الأوروبي والإفريقي) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* رادار تأشيرة شنغن (Schengen Visa Radar) */}
            <Card className="rounded-2xl shadow-sm border-border/80">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-indigo-500" />
                  <span>تأشيرة شنغن (أوروبا بحراً)</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 bg-muted/20 p-4 rounded-xl">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground">رقم التأشيرة:</span>
                  <span className="font-mono font-bold">{driver.visa_number || 'غير مسجلة'}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground">تاريخ الانتهاء:</span>
                  <span className="font-mono font-bold text-foreground">
                    {driver.visa_expiry_date || 'غير محدد'}
                  </span>
                </div>
                <div className="pt-1">
                  {visaStatus === 'valid' && (
                    <Badge className="bg-emerald-500 text-white gap-1 py-1 px-2.5 text-[11px] w-full justify-center">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>سارية (متبقي {daysUntilVisaExpiry} يوماً)</span>
                    </Badge>
                  )}
                  {visaStatus === 'expiring' && (
                    <Badge className="bg-amber-500 text-white gap-1 py-1 px-2.5 text-[11px] animate-pulse w-full justify-center">
                      <AlertTriangle className="w-3 h-3" />
                      <span>توشك على الانتهاء ({daysUntilVisaExpiry} يوماً)</span>
                    </Badge>
                  )}
                  {visaStatus === 'expired' && (
                    <Badge variant="destructive" className="gap-1 py-1 px-2.5 text-[11px] w-full justify-center">
                      <XCircle className="w-3 h-3" />
                      <span>منتهية الصلاحية (ممنوع من العبور)</span>
                    </Badge>
                  )}
                  {visaStatus === 'none' && (
                    <Badge variant="secondary" className="gap-1 py-1 px-2.5 text-[11px] w-full justify-center">
                      <span>بدون تأشيرة أوروبية</span>
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* رادار تأشيرة الممر الإفريقي البري (African Overland Visa Radar) */}
            <Card className="rounded-2xl shadow-sm border-border/80">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Globe2 className="w-4 h-4 text-emerald-600" />
                    <span>تأشيرة الممر الإفريقي (موريتانيا / السنغال)</span>
                  </span>
                  <span className="text-base">🇲🇷 🇸🇳</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 bg-muted/20 p-4 rounded-xl">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground">رقم التأشيرة / المرور:</span>
                  <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">
                    {driver.african_visa_number || 'غير مسجلة'}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground">تاريخ الانتهاء:</span>
                  <span className="font-mono font-bold text-foreground">
                    {driver.african_visa_expiry_date || 'غير محدد'}
                  </span>
                </div>
                <div className="pt-1">
                  {africanVisa.status === 'valid' && (
                    <Badge className="bg-emerald-600 text-white gap-1 py-1 px-2.5 text-[11px] w-full justify-center">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>{africanVisa.badgeLabelAr}</span>
                    </Badge>
                  )}
                  {africanVisa.status === 'expiring' && (
                    <Badge className="bg-amber-500 text-white gap-1 py-1 px-2.5 text-[11px] animate-pulse w-full justify-center">
                      <AlertTriangle className="w-3 h-3" />
                      <span>{africanVisa.badgeLabelAr}</span>
                    </Badge>
                  )}
                  {africanVisa.status === 'expired' && (
                    <Badge variant="destructive" className="gap-1 py-1 px-2.5 text-[11px] w-full justify-center">
                      <XCircle className="w-3 h-3" />
                      <span>{africanVisa.badgeLabelAr}</span>
                    </Badge>
                  )}
                  {africanVisa.status === 'missing' && (
                    <Badge variant="secondary" className="gap-1 py-1 px-2.5 text-[11px] w-full justify-center">
                      <span>{africanVisa.badgeLabelAr}</span>
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* الجداول: الرحلات الحديثة، السلف المالية، والمخالفات */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* سجل الرحلات المسندة */}
        <Card className="rounded-2xl shadow-sm border-border/80">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold flex items-center justify-between">
              <span className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-primary" />
                سجل الرحلات الدولية ({trips.length})
              </span>
              <Link href={`/trips?driver_id=${driver.id}`} className="text-xs text-primary hover:underline">
                عرض في الكانبان
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {trips.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">لا توجد رحلات مسجلة لهذا السائق.</p>
            ) : (
              <div className="space-y-2.5">
                {trips.slice(0, 5).map((trip) => (
                  <div key={trip.id} className="flex items-center justify-between p-3 rounded-xl bg-muted/40 text-xs">
                    <div>
                      <p className="font-bold text-foreground">{trip.route || `رحلة #${trip.id}`}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        انطلاق: {trip.departure_date} | CMR: {trip.cmr_number || 'N/A'}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-[11px]">
                      {trip.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* سجل المخالفات والغرامات */}
        <Card className="rounded-2xl shadow-sm border-border/80">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold flex items-center justify-between">
              <span className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-500" />
                المخالفات والغرامات المرورية ({fines.length})
              </span>
              <span className="text-xs font-mono text-muted-foreground font-normal">
                الإجمالي: {formatCurrency(totalFines, 'MAD')}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {fines.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">سجل السائق نظيف من أي مخالفات.</p>
            ) : (
              <div className="space-y-2.5">
                {fines.slice(0, 5).map((fine) => (
                  <div key={fine.id} className="flex items-center justify-between p-3 rounded-xl bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200/40 text-xs">
                    <div>
                      <p className="font-bold text-foreground">{fine.fine_type || 'مخالفة سير'}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{fine.description || 'بدون تفاصيل'}</p>
                    </div>
                    <div className="text-start">
                      <p className="font-bold font-mono text-rose-600">
                        {formatCurrency(fine.amount, fine.currency || 'MAD')}
                      </p>
                      <Badge variant={fine.deducted_from_settlement ? 'default' : 'secondary'} className="text-[10px] mt-0.5">
                        {fine.deducted_from_settlement ? 'مقتطعة' : 'معلقة'}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* سجل السلف المالية والعهد */}
        <Card className="rounded-2xl shadow-sm border-border/80">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold flex items-center justify-between">
              <span className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-amber-500" />
                سجل السلف والعهد المالية ({advances.length})
              </span>
              <Link href="/driver-advances" className="text-xs text-primary hover:underline">
                إدارة السلف
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {advances.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">لا توجد سلف مسجلة لهذا السائق.</p>
            ) : (
              <div className="space-y-2.5">
                {advances.slice(0, 5).map((adv) => (
                  <div key={adv.id} className="flex items-center justify-between p-3 rounded-xl bg-muted/40 text-xs">
                    <div>
                      <p className="font-bold text-foreground">{adv.reason || 'سلفة تشغيلية'}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        التاريخ: {adv.date} {adv.cmr_number ? `| CMR: ${adv.cmr_number}` : ''}
                      </p>
                    </div>
                    <div className="text-start">
                      <p className="font-bold font-mono text-amber-600 dark:text-amber-400">
                        {formatCurrency(adv.amount, adv.currency || 'MAD')}
                      </p>
                      <Badge variant="outline" className="text-[10px] mt-0.5">
                        {adv.status === 'approved' ? 'معتمدة' : adv.status === 'pending' ? 'معلقة' : adv.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* كشف حساب الرواتب الشهرية */}
        <Card className="rounded-2xl shadow-sm border-border/80">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Wallet className="w-4 h-4 text-emerald-500" />
                كشف حساب الرواتب الشهرية ({salaries.length})
              </span>
              <Link href="/driver-settlements" className="text-xs text-primary hover:underline">
                التسويات
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {salaries.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">لا توجد رواتب مسجلة لهذا السائق حتى الآن.</p>
            ) : (
              <div className="space-y-2.5">
                {salaries.slice(0, 5).map((sal) => (
                  <div key={sal.id} className="flex items-center justify-between p-3 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/40 text-xs">
                    <div>
                      <p className="font-bold text-foreground font-mono" dir="ltr">
                        {sal.period_start} → {sal.period_end}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        تاريخ الصرف: {new Date(sal.created_at).toLocaleDateString('ar-MA')}
                      </p>
                    </div>
                    <div className="text-start">
                      <p className="font-bold font-mono text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(sal.amount, sal.currency || 'MAD')}
                      </p>
                      <Badge variant="outline" className="text-[10px] mt-0.5">
                        {sal.status === 'paid' || sal.status === 'settled' ? 'مصروف' : sal.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
