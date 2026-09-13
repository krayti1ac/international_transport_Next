'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MatriculeBadge } from '@/components/ui/matricule-badge';
import { useTrucks } from '@/lib/query/queries';
import {
  Fuel,
  AlertTriangle,
  CheckCircle,
  Search,
  Gauge,
  Wrench,
  Radio,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import Link from 'next/link';
import { useLanguage } from '@/components/language-provider';
import { CanBusTelematicsMonitor } from '@/features/fleet/components/CanBusTelematicsMonitor';

export default function FleetFuelAnalyticsPage() {
  const { t, dir } = useLanguage();
  const { data: trucks = [], isLoading } = useTrucks();
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'analytics' | 'telematics' | 'fraud_radar'>('analytics');

  const filteredTrucks = useMemo(() => {
    return trucks.filter(
      (t) =>
        t.plate_number.toLowerCase().includes(search.toLowerCase()) ||
        t.model.toLowerCase().includes(search.toLowerCase())
    );
  }, [trucks, search]);

  return (
    <div className="space-y-6 pb-12" dir={dir}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-amiri text-foreground flex items-center gap-2">
            <Fuel className="w-6 h-6 text-primary" />
            {t('ذكاء الوقود وتليمتريكس كمبيوتر الشاحنة (CAN-Bus & FMS)', 'Intelligence Carburant & Télémétrie FMS')}
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t(
              'مراقبة استهلاك الأسطول، استشعار حزم SAE J1939 الحية، وتدقيق وصولات الوقود جغرافياً',
              'Suivi de la consommation, ingestion télématique SAE J1939 et audit géographique anti-fraude'
            )}
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center p-1 rounded-xl bg-muted border border-border text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('analytics')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
              activeTab === 'analytics'
                ? 'bg-background text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Gauge className="w-3.5 h-3.5 inline-block me-1.5" />
            {t('كفاءة الاستهلاك', 'Efficacité')}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('telematics')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
              activeTab === 'telematics'
                ? 'bg-background text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Radio className="w-3.5 h-3.5 inline-block me-1.5 text-emerald-500 animate-pulse" />
            {t('بث CAN-Bus المباشر', 'Télémétrie Directe')}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('fraud_radar')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
              activeTab === 'fraud_radar'
                ? 'bg-background text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 inline-block me-1.5 text-blue-500" />
            {t('رادار مكافحة الاحتيال', 'Radar Anti-Fraude')}
          </button>
        </div>
      </div>

      {activeTab === 'telematics' ? (
        <CanBusTelematicsMonitor />
      ) : activeTab === 'fraud_radar' ? (
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <Card className="border-border">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t('المحطات المعتمدة بالكوريدور', 'Stations couloir certifiées')}</p>
                  <p className="text-lg font-bold font-mono text-emerald-600 mt-0.5">11 {t('محطة موثوقة', 'stations')}</p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center shrink-0">
                  <Zap className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t('نطاق التدقيق الجغرافي', 'Rayon géofence de contrôle')}</p>
                  <p className="text-lg font-bold font-mono text-foreground mt-0.5" dir="ltr">15.0 km / ±36h</p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t('سقف سعة الخزان المسموح', 'Capacité max réservoir')}</p>
                  <p className="text-lg font-bold font-mono text-amber-600 mt-0.5" dir="ltr">900 L</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="border-border overflow-hidden">
            <CardHeader className="py-3.5 px-5 border-b border-border flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-primary" />
                <span>{t('محرك المطابقة الثلاثية لوصولات الوقود (Triangulation Audit Engine)', 'Moteur d’audit de triangulation')}</span>
              </CardTitle>
              <Link href="/fuel-receipt">
                <Button size="sm" variant="outline" className="rounded-xl text-xs h-8 gap-1.5">
                  <Fuel className="w-3.5 h-3.5" />
                  <span>{t('إدخال وتدقيق وصل وقود جديد', 'Vérifier un nouveau reçu')}</span>
                </Button>
              </Link>
            </CardHeader>
            <CardContent className="p-6 text-xs text-muted-foreground space-y-3">
              <p className="leading-relaxed">
                {t(
                  'يقوم محرك Trans Bodanon لمكافحة الاحتيال بالتحقق الآلي من كل وصل وقود عبر مقارنة إحداثيات المحطة المستخلصة بالذكاء الاصطناعي مع سجل موقع الشاحنة الفعلي (GPS) خلال نافذة زمنية مدتها 36 ساعة، وفحص عدم تجاوز سعة الخزان (900 لتر)، وضمان عدم انحراف السعر عن النطاق السعري للكوريدور المغربي والإسباني.',
                  'Le moteur anti-fraude Trans Bodanon compare automatiquement les coordonnées de la station avec l’historique GPS du camion (fenêtre de 36h), vérifie le volume par rapport au réservoir et contrôle le prix unitaire.'
                )}
              </p>
            </CardContent>
          </Card>
        </div>
      ) : (
        <>
          {/* Default Analytics View */}
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
        </>
      )}
    </div>
  );
}
