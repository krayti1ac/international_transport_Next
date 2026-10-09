'use client';

import { useState, useTransition } from 'react';
import { useLanguage } from '@/components/language-provider';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  Leaf,
  ShieldCheck,
  Printer,
  Sparkles,
  TrendingDown,
  Ship,
  Truck,
  ThermometerSnowflake,
  FileText,
  Award,
  Layers,
  CheckCircle,
} from 'lucide-react';
import {
  calculateTripCarbonFootprint,
  buildGreenFreightCertificate,
} from '../services/carbon-footprint.service';
import { auditAndSaveTripCarbonAction } from '../services/carbon-audit.actions';
import type { CarbonFootprintResult, GreenFreightCertificate, TruckEuroClass } from '../types/esg-carbon.types';

interface GreenFreightCertificateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tripId: number;
  cmrNumber?: string;
  route?: string;
  clientName?: string;
  truckPlate?: string;
  initialWeightTons?: number;
  initialRoadKm?: number;
  initialFerryKm?: number;
}

export function GreenFreightCertificateModal({
  open,
  onOpenChange,
  tripId,
  cmrNumber = `CMR-MA-${tripId}`,
  route = 'أكادير ➔ بربينيان (Agadir ➔ Perpignan)',
  clientName = 'Atlas Fresh Logistics',
  truckPlate = '12345-A-40',
  initialWeightTons = 22.50,
  initialRoadKm = 1850.0,
  initialFerryKm = 45.0,
}: GreenFreightCertificateModalProps) {
  const { t, dir } = useLanguage();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  // Interactive parameters
  const [cargoWeight, setCargoWeight] = useState<number>(initialWeightTons);
  const [roadKm, setRoadKm] = useState<number>(initialRoadKm);
  const [ferryKm, setFerryKm] = useState<number>(initialFerryKm);
  const [euroClass, setEuroClass] = useState<TruckEuroClass>('euro_6');
  const [isReefer, setIsReefer] = useState<boolean>(true);
  const [reeferHours, setReeferHours] = useState<number>(48.0);

  // Active Certificate View state
  const [viewCertificate, setViewCertificate] = useState(false);

  // Live calculation
  const results: CarbonFootprintResult = calculateTripCarbonFootprint({
    cargoWeightTons: cargoWeight,
    roadDistanceKm: roadKm,
    ferryDistanceKm: ferryKm,
    truckEuroClass: euroClass,
    isReefer,
    reeferHours,
  });

  const certificate: GreenFreightCertificate = buildGreenFreightCertificate({
    tripId,
    cmrNumber,
    route,
    clientName,
    vehiclePlate: truckPlate,
    calculationInput: {
      cargoWeightTons: cargoWeight,
      roadDistanceKm: roadKm,
      ferryDistanceKm: ferryKm,
      truckEuroClass: euroClass,
      isReefer,
      reeferHours,
    },
  });

  const handleSaveAudit = () => {
    startTransition(async () => {
      try {
        const res = await auditAndSaveTripCarbonAction({
          tripId,
          cargoWeightTons: cargoWeight,
          roadDistanceKm: roadKm,
          ferryDistanceKm: ferryKm,
          truckEuroClass: euroClass,
          isReefer,
          reeferHours,
        });

        if (res.success) {
          toast({
            title: t('تم اعتماد التدقيق الكربوني بنجاح', 'Audit carbone validé avec succès'),
            description: t(
              `تم توثيق رتبة الكفاءة (${results.efficiencyRating}) وفق معيار GLEC v3.0`,
              `Classe d'efficacité (${results.efficiencyRating}) enregistrée selon GLEC v3.0`
            ),
          });
        } else {
          throw new Error(res.error);
        }
      } catch (err: any) {
        toast({
          title: t('فشل حفظ التدقيق الكربوني', "Échec de l'enregistrement"),
          description: err.message,
          variant: 'destructive',
        });
      }
    });
  };

  const getRatingBadgeColor = (rating: string) => {
    switch (rating) {
      case 'A+':
        return 'bg-emerald-600 text-white border-emerald-500';
      case 'A':
        return 'bg-emerald-500 text-white border-emerald-400';
      case 'B':
        return 'bg-blue-600 text-white border-blue-500';
      case 'C':
        return 'bg-amber-500 text-white border-amber-400';
      case 'D':
        return 'bg-orange-600 text-white border-orange-500';
      default:
        return 'bg-rose-600 text-white border-rose-500';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl p-6" dir={dir}>
        <DialogHeader className="border-b border-border pb-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <Leaf className="w-6 h-6" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold font-amiri text-foreground flex items-center gap-2">
                  {t('تدقيق البصمة الكربونية والشحن الأخضر (GLEC v3.0)', 'Audit Empreinte Carbone & Fret Vert (GLEC v3.0)')}
                  <Badge variant="outline" className="text-emerald-600 border-emerald-500/30 text-xs">
                    ISO 14083 / CBAM
                  </Badge>
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  {t(
                    `الإرسالية #${tripId} • بوليصة الشحن: ${cmrNumber} • ${route}`,
                    `Expédition #${tripId} • CMR : ${cmrNumber} • ${route}`
                  )}
                </DialogDescription>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant={viewCertificate ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewCertificate(!viewCertificate)}
                className="rounded-xl text-xs h-9"
              >
                <Award className="w-3.5 h-3.5 ms-1.5" />
                {viewCertificate
                  ? t('عرض لوحة المؤشرات', 'Voir tableau de bord')
                  : t('معاينة الشهادة الرسمية', 'Voir le certificat')}
              </Button>
            </div>
          </div>
        </DialogHeader>

        {!viewCertificate ? (
          /* =========================================================
             VIEW A: BENTO KPIS & LIVE AUDIT CONTROLS
             ========================================================= */
          <div className="space-y-6 pt-2">
            {/* Bento Grid: 4 Critical Carbon KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
              {/* Card 1: Total WTW Emissions */}
              <div className="p-4 rounded-2xl border border-border bg-card shadow-2xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{t('انبعاثات WTW الإجمالية', 'Émissions WTW')}</span>
                  <Leaf className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="text-xl font-bold font-mono text-foreground">
                  {results.totalWtwEmissionsKg}{' '}
                  <span className="text-xs font-normal text-muted-foreground">kg CO2e</span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {t('المباشرة TTW:', 'Directes TTW :')} {results.totalTtwEmissionsKg} kg
                </p>
              </div>

              {/* Card 2: Multimodal Carbon Savings */}
              <div className="p-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 shadow-2xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-emerald-800 dark:text-emerald-300 font-medium">
                    {t('الوفر البيئي (العبّارة)', 'Économie Ro-Ro')}
                  </span>
                  <TrendingDown className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="text-xl font-bold font-mono text-emerald-700 dark:text-emerald-400">
                  -{results.emissionsSavingsPercentage}%
                </div>
                <p className="text-[11px] text-emerald-700 dark:text-emerald-300">
                  {t('تم توفير:', 'Économisé :')} -{results.emissionsSavedKg} kg
                </p>
              </div>

              {/* Card 3: GLEC Carbon Intensity */}
              <div className="p-4 rounded-2xl border border-border bg-card shadow-2xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{t('كثافة الكربون', 'Intensité Carbone')}</span>
                  <Layers className="w-4 h-4 text-blue-500" />
                </div>
                <div className="text-xl font-bold font-mono text-foreground">
                  {results.emissionsIntensityGPerTkm}{' '}
                  <span className="text-xs font-normal text-muted-foreground">g/t-km</span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {results.tonKilometers} t-km {t('إجمالي', 'total')}
                </p>
              </div>

              {/* Card 4: Efficiency Rating */}
              <div className="p-4 rounded-2xl border border-border bg-card shadow-2xs space-y-1.5 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{t('درجة الكفاءة', 'Classe Efficacité')}</span>
                  <Sparkles className="w-4 h-4 text-amber-500" />
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={`text-base font-bold px-3 py-0.5 rounded-lg border ${getRatingBadgeColor(results.efficiencyRating)}`}>
                    {results.efficiencyRating}
                  </Badge>
                  <span className="text-xs font-medium text-foreground">GLEC Standard</span>
                </div>
                <p className="text-[10px] text-muted-foreground truncate">{results.ratingDescription}</p>
              </div>
            </div>

            {/* Visual Comparison: Multimodal Routing vs All-Road Baseline */}
            <Card className="rounded-2xl border border-border shadow-xs">
              <CardContent className="p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-sm font-amiri flex items-center gap-2 text-foreground">
                    <Ship className="w-4 h-4 text-primary" />
                    {t('المقارنة البيئية: العبور البحري المتوسطي مقابل النقل البري الصرف', 'Comparaison Écologique : Ro-Ro vs Tout-Route')}
                  </h4>
                  <Badge variant="secondary" className="text-xs">
                    EU CBAM Scope 3
                  </Badge>
                </div>

                <div className="space-y-3">
                  {/* Multimodal (Actual) */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground flex items-center gap-1.5">
                        <Truck className="w-3.5 h-3.5 text-emerald-600" />
                        {t('المسار المعتمد الفعلي (شاحنة + عبّارة Ro-Ro)', 'Itinéraire Multimodal Actuel')}
                      </span>
                      <span className="font-mono font-bold text-foreground">{results.totalWtwEmissionsKg} kg CO2e</span>
                    </div>
                    <div className="h-3 w-full bg-muted rounded-full overflow-hidden flex">
                      <div
                        className="bg-emerald-600 h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.min(
                            100,
                            (Number(results.totalWtwEmissionsKg) / Number(results.baselineAllRoadEmissionsKg)) * 100
                          )}%`,
                        }}
                      />
                    </div>
                  </div>

                  {/* Counterfactual All-Road */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground flex items-center gap-1.5">
                        <Truck className="w-3.5 h-3.5 text-slate-400" />
                        {t('السيناريو البري البديل (بدون عبّارة عبر الالتفاف البري)', 'Scénario Tout-Route Alternatif')}
                      </span>
                      <span className="font-mono text-muted-foreground">{results.baselineAllRoadEmissionsKg} kg CO2e</span>
                    </div>
                    <div className="h-3 w-full bg-muted rounded-full overflow-hidden">
                      <div className="bg-slate-400 h-full rounded-full w-full opacity-60" />
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/20 flex items-center justify-between text-xs text-emerald-800 dark:text-emerald-300">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-600" />
                    <span>
                      {t(
                        `وفورات كربونية صافية تم تحقيقها بفضل التوجيه البحري: ${results.emissionsSavedKg} كغ CO2e`,
                        `Économies nettes réalisées grâce au transit maritime : ${results.emissionsSavedKg} kg CO2e`
                      )}
                    </span>
                  </div>
                  <span className="font-mono font-bold">-{results.emissionsSavingsPercentage}%</span>
                </div>
              </CardContent>
            </Card>

            {/* Interactive Parameter Adjuster (Calculator Controls) */}
            <div className="p-4 rounded-2xl border border-border bg-muted/20 space-y-3">
              <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <ThermometerSnowflake className="w-4 h-4 text-blue-500" />
                {t('معطيات حمولة الرحلة وتجهيزات التبريد Frigo', 'Paramètres de Chargement & Froid')}
              </span>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                <div>
                  <label className="text-[11px] text-muted-foreground">{t('وزن الحمولة (طن)', 'Poids (tonnes)')}</label>
                  <Input
                    type="number"
                    step="0.1"
                    value={cargoWeight}
                    onChange={(e) => setCargoWeight(Number(e.target.value) || 0)}
                    className="h-8 text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="text-[11px] text-muted-foreground">{t('المسافة البرية (كم)', 'Distance route (km)')}</label>
                  <Input
                    type="number"
                    value={roadKm}
                    onChange={(e) => setRoadKm(Number(e.target.value) || 0)}
                    className="h-8 text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="text-[11px] text-muted-foreground">{t('مسافة العبّارة (كم)', 'Distance Ferry (km)')}</label>
                  <Input
                    type="number"
                    value={ferryKm}
                    onChange={(e) => setFerryKm(Number(e.target.value) || 0)}
                    className="h-8 text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="text-[11px] text-muted-foreground">{t('محرك الشاحنة', 'Moteur Camion')}</label>
                  <select
                    value={euroClass}
                    onChange={(e) => setEuroClass(e.target.value as TruckEuroClass)}
                    className="w-full h-8 px-2 rounded-lg border border-input bg-background text-foreground text-xs"
                  >
                    <option value="euro_6">Euro 6 (95.4 g/t-km)</option>
                    <option value="euro_5">Euro 5 (108.2 g/t-km)</option>
                    <option value="electric_hybrid">Electric / Hybrid (42.0 g/t-km)</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1.5 text-xs text-foreground cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isReefer}
                      onChange={(e) => setIsReefer(e.target.checked)}
                      className="rounded border-input text-primary"
                    />
                    {t('شاحنة مبردة Frigo (+2.5 L/h)', 'Groupe Frigo (+2.5 L/h)')}
                  </label>

                  {isReefer && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] text-muted-foreground">{t('ساعات التشغيل:', 'Heures :')}</span>
                      <Input
                        type="number"
                        value={reeferHours}
                        onChange={(e) => setReeferHours(Number(e.target.value) || 0)}
                        className="w-16 h-7 text-xs font-mono"
                      />
                    </div>
                  )}
                </div>

                <Button
                  onClick={handleSaveAudit}
                  disabled={isPending}
                  size="sm"
                  className="rounded-xl text-xs h-8 bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
                >
                  <ShieldCheck className="w-3.5 h-3.5 ms-1.5" />
                  {isPending ? t('جارٍ التوثيق...', 'Validation...') : t('اعتماد وتوثيق التدقيق الكربوني', 'Valider et signer audit')}
                </Button>
              </div>
            </div>
          </div>
        ) : (
          /* =========================================================
             VIEW B: OFFICIAL GREEN FREIGHT CERTIFICATE (PDF PREVIEW)
             ========================================================= */
          <div className="space-y-4 pt-2">
            <div className="p-6 rounded-3xl border-2 border-emerald-500/30 bg-card shadow-sm space-y-6 relative overflow-hidden">
              {/* Background Watermark */}
              <div className="absolute end-4 bottom-4 opacity-5 pointer-events-none">
                <Leaf className="w-64 h-64 text-emerald-600" />
              </div>

              {/* Certificate Header */}
              <div className="flex items-start justify-between border-b border-border pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <Leaf className="w-6 h-6 text-emerald-600" />
                    <h3 className="font-extrabold text-lg text-foreground font-amiri tracking-tight">
                      TRANS BODANON TMS • OFFICIAL GREEN FREIGHT CERTIFICATE
                    </h3>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {t('شهادة الشحن الأخضر والتدقيق الكربوني المعتمد وفق معيار GLEC Framework v3.0 و ISO 14083', 'Certificat Officiel de Fret Vert certifié selon GLEC v3.0 et ISO 14083')}
                  </p>
                </div>

                <div className="text-end">
                  <Badge className={`text-sm font-bold px-3 py-1 ${getRatingBadgeColor(results.efficiencyRating)}`}>
                    Classe {results.efficiencyRating}
                  </Badge>
                  <p className="text-[10px] text-muted-foreground font-mono mt-1">{certificate.certificateId}</p>
                </div>
              </div>

              {/* Trip & Client Meta */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs border-b border-border/60 pb-4">
                <div>
                  <span className="text-muted-foreground block text-[11px]">{t('العميل المستفيد', 'Client Bénéficiaire')}</span>
                  <strong className="text-foreground">{certificate.clientName}</strong>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">{t('بوليصة الشحن (CMR)', 'Lettre de Voiture')}</span>
                  <strong className="text-foreground font-mono">{certificate.cmrNumber}</strong>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">{t('المسار الدولي', 'Itinéraire')}</span>
                  <strong className="text-foreground">{certificate.route}</strong>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">{t('الشاحنة المخصصة', 'Véhicule')}</span>
                  <strong className="text-foreground font-mono">{certificate.vehiclePlate}</strong>
                </div>
              </div>

              {/* Carbon Balance Sheet */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-muted/20 p-4 rounded-2xl border border-border">
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">{t('البصمة الكربونية الكلية (WTW)', 'Total Empreinte WTW')}</span>
                  <p className="text-2xl font-black font-mono text-foreground">
                    {results.totalWtwEmissionsKg}{' '}
                    <span className="text-xs font-normal text-muted-foreground">kg CO2e</span>
                  </p>
                  <span className="text-[10px] text-muted-foreground block">
                    TTW (Direct Combustion): {results.totalTtwEmissionsKg} kg
                  </span>
                </div>

                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">{t('الوفر البيئي المتحقق', 'Économies Réalisées')}</span>
                  <p className="text-2xl font-black font-mono text-emerald-600">
                    -{results.emissionsSavingsPercentage}%
                  </p>
                  <span className="text-[10px] text-emerald-700 dark:text-emerald-400 block font-mono">
                    -{results.emissionsSavedKg} kg vs All-Road
                  </span>
                </div>

                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">{t('كثافة الانبعاثات', 'Intensité Émissions')}</span>
                  <p className="text-2xl font-black font-mono text-foreground">
                    {results.emissionsIntensityGPerTkm}{' '}
                    <span className="text-xs font-normal text-muted-foreground">gCO2e / t-km</span>
                  </p>
                  <span className="text-[10px] text-muted-foreground block">
                    Calculated for {results.cargoWeightTons} tonnes
                  </span>
                </div>
              </div>

              {/* Cryptographic Seal & Compliance Footnote */}
              <div className="pt-2 border-t border-border flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-[11px]">
                <div className="space-y-0.5">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    {t('الختم التوثيقي الجنائي المشفر (HMAC-SHA256)', 'Sceau Criptographique HMAC-SHA256')} :
                  </span>
                  <span className="font-mono text-[10px] text-muted-foreground break-all" dir="ltr">
                    {certificate.certificateHash}
                  </span>
                </div>

                <div className="text-end text-[10px] text-muted-foreground">
                  <p>Norme ISO 14083:2023 • GLEC Framework v3.0</p>
                  <p>Conforme Déclaration CBAM (Scope 3 - Cat. 4)</p>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.print()}
                className="rounded-xl text-xs"
              >
                <Printer className="w-3.5 h-3.5 ms-1.5" />
                {t('طباعة الشهادة (PDF)', 'Imprimer le certificat (PDF)')}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

