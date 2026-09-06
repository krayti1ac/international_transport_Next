'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MatriculeBadge } from '@/components/ui/matricule-badge';
import { formatCurrency } from '@/lib/forex';
import { useTrucks } from '@/lib/query/queries';
import { Fuel, TrendingDown, AlertTriangle, CheckCircle, Search, Gauge, Wrench } from 'lucide-react';
import Link from 'next/link';

export default function FleetFuelAnalyticsPage() {
  const { data: trucks = [], isLoading } = useTrucks();
  const [search, setSearch] = useState('');

  const filteredTrucks = useMemo(() => {
    return trucks.filter(
      (t) =>
        t.plate_number.toLowerCase().includes(search.toLowerCase()) ||
        t.model.toLowerCase().includes(search.toLowerCase())
    );
  }, [trucks, search]);

  return (
    <div className="space-y-6 pb-12" dir="rtl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-amiri text-foreground flex items-center gap-2">
            <Fuel className="w-6 h-6 text-primary" />
            تحليلات استهلاك الوقود وكفاءة الأسطول
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {'مراقبة معدلات الاستهلاك ($L/100\\text{ km}$)، رصد الشذوذ، وضبط كفاءة المحركات'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <Card className="border-border">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center shrink-0">
              <Gauge className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">المعيار النموذجي للأسطول</p>
              <p className="text-lg font-bold font-mono text-foreground mt-0.5">32 - 35 L/100 km</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
              <CheckCircle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">الشاحنات في النطاق الاقتصادي</p>
              <p className="text-lg font-bold font-mono text-emerald-600 mt-0.5">
                {trucks.filter((t) => t.status === 'active').length} مركبات
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-600 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">مركبات تحتاج فحص حقن/فلاتر</p>
              <p className="text-lg font-bold font-mono text-rose-600 mt-0.5">
                {trucks.filter((t) => t.status === 'maintenance').length} مركبات
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="relative max-w-md">
        <Search className="w-4 h-4 text-muted-foreground absolute top-1/2 -translate-y-1/2 start-3" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="بحث برقم اللوحة أو الموديل..."
          className="ps-9 h-10 rounded-xl"
        />
      </div>

      <Card className="border-border overflow-hidden">
        <CardHeader className="border-b border-border/70 py-3.5 px-5">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <Gauge className="w-4 h-4 text-primary" />
            <span>مصفوفة مراقبة الشاحنات والتشخيص التنبؤي</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-12 text-center text-xs text-muted-foreground">جاري تحميل بيانات الأسطول...</div>
          ) : filteredTrucks.length === 0 ? (
            <div className="py-12 text-center text-xs text-muted-foreground">لا توجد شاحنات مطابقة للبحث.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-muted-foreground text-xs">
                    <th className="py-3 px-4 text-start font-semibold">الشاحنة</th>
                    <th className="py-3 px-4 text-start font-semibold">الموديل</th>
                    <th className="py-3 px-4 text-start font-semibold">حالة التشغيل</th>
                    <th className="py-3 px-4 text-start font-semibold">المعدل الموصى به</th>
                    <th className="py-3 px-4 text-end font-semibold">إجراءات التشخيص</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filteredTrucks.map((truck) => (
                    <tr key={truck.id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-4">
                        <MatriculeBadge plate={truck.plate_number} variant="badge" size="sm" />
                      </td>
                      <td className="py-3 px-4 text-xs font-medium text-foreground">{truck.model}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${
                            truck.status === 'active'
                              ? 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30'
                              : 'bg-rose-500/15 text-rose-600 border-rose-500/30'
                          }`}
                        >
                          {truck.status === 'active' ? 'نشطة في الخدمة' : 'في الصيانة'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-xs font-mono text-muted-foreground">34.0 L/100 km</td>
                      <td className="py-3 px-4 text-end">
                        <Link href={`/fleet/${truck.id}?type=truck`}>
                          <Button variant="outline" size="sm" className="h-8 text-xs rounded-xl gap-1.5">
                            <Wrench className="w-3.5 h-3.5" />
                            <span>تقرير الصحة والصيانة</span>
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
