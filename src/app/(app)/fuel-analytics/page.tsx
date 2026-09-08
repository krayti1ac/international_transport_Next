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
import { useLanguage } from '@/components/language-provider';

export default function FleetFuelAnalyticsPage() {
  const { t, dir } = useLanguage();
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
    <div className="space-y-6 pb-12" dir={dir}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-amiri text-foreground flex items-center gap-2">
            <Fuel className="w-6 h-6 text-primary" />
            {t('تحليلات استهلاك الوقود وكفاءة الأسطول', 'Analyses de la Consommation de Carburant et Efficacité')}
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t(
              'مراقبة معدلات الاستهلاك (L/100 km)، رصد الشذوذ، وضبط كفاءة المحركات',
              'Suivi des taux de consommation (L/100 km), détection des anomalies et réglage des moteurs'
            )}
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
              <p className="text-xs text-muted-foreground">{t('المعيار النموذجي للأسطول', 'Norme standard de la flotte')}</p>
              <p className="text-lg font-bold font-mono text-foreground mt-0.5" dir="ltr">32 - 35 L/100 km</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
              <CheckCircle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t('الشاحنات في النطاق الاقتصادي', 'Camions en zone économique')}</p>
              <p className="text-lg font-bold font-mono text-emerald-600 mt-0.5">
                {trucks.filter((t) => t.status === 'active').length} {t('مركبات', 'véhicules')}
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
              <p className="text-xs text-muted-foreground">{t('مركبات تحتاج فحص حقن/فلاتر', 'Véhicules nécessitant contrôle injecteurs/filtres')}</p>
              <p className="text-lg font-bold font-mono text-rose-600 mt-0.5">
                {trucks.filter((t) => t.status === 'maintenance').length} {t('مركبات', 'véhicules')}
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
          placeholder={t('بحث برقم اللوحة أو الموديل...', 'Rechercher par immatriculation ou modèle...')}
          className="ps-9 h-10 rounded-xl"
        />
      </div>

      <Card className="border-border overflow-hidden">
        <CardHeader className="border-b border-border/70 py-3.5 px-5">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <Gauge className="w-4 h-4 text-primary" />
            <span>{t('مصفوفة مراقبة الشاحنات والتشخيص التنبؤي', 'Matrice de surveillance et diagnostic prédictif')}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-12 text-center text-xs text-muted-foreground">{t('جاري تحميل بيانات الأسطول...', 'Chargement des données de la flotte...')}</div>
          ) : filteredTrucks.length === 0 ? (
            <div className="py-12 text-center text-xs text-muted-foreground">{t('لا توجد شاحنات مطابقة للبحث.', 'Aucun camion ne correspond à la recherche.')}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-muted-foreground text-xs">
                    <th className="py-3 px-4 text-start font-semibold">{t('الشاحنة', 'Camion')}</th>
                    <th className="py-3 px-4 text-start font-semibold">{t('الموديل', 'Modèle')}</th>
                    <th className="py-3 px-4 text-start font-semibold">{t('حالة التشغيل', 'Statut')}</th>
                    <th className="py-3 px-4 text-start font-semibold">{t('المعدل الموصى به', 'Norme recommandée')}</th>
                    <th className="py-3 px-4 text-end font-semibold">{t('إجراءات التشخيص', 'Actions de diagnostic')}</th>
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
                          {truck.status === 'active' ? t('نشطة في الخدمة', 'En service') : t('في الصيانة', 'En maintenance')}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-xs font-mono text-muted-foreground" dir="ltr">34.0 L/100 km</td>
                      <td className="py-3 px-4 text-end">
                        <Link href={`/fleet/${truck.id}?type=truck`}>
                          <Button variant="outline" size="sm" className="h-8 text-xs rounded-xl gap-1.5">
                            <Wrench className="w-3.5 h-3.5" />
                            <span>{t('تقرير الصحة والصيانة', 'Rapport de maintenance')}</span>
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
