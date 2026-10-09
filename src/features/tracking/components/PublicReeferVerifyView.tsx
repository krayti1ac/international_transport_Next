'use client';

/**
 * Trans Bodanon TMS — Public Reefer Cold Chain Verification View
 * Responsive Bento Layout for Customs Officers, Veterinary Inspectors, & Cargo Consignees
 * Standards: EN 12830 / EU GDP Guidelines / ATP Treaty
 */

import React, { useState } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  Thermometer,
  Snowflake,
  Truck,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Download,
  Copy,
  Check,
  Activity,
  Clock,
  Globe,
  Building,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { exportReeferDataColdPdfAction } from '../services/reefer-export.actions';
import type { PublicReeferVerificationResult } from '../types/reefer-verification.types';

interface PublicReeferVerifyViewProps {
  initialResult: PublicReeferVerificationResult;
  candidateHash: string;
  tripIdHint?: string;
  initialLang?: 'ar' | 'fr' | 'es';
}

const DICTIONARY = {
  ar: {
    title: 'بوابة التحقق الرسمية من سلامة سلسلة التبريد',
    subtitle: 'فحص ومطابقة كشوفات درجات الحرارة وفق معايير EN 12830 / GDP / ATP',
    authentic: 'وثيقة معتمدة ومطابقة رقمياً',
    authenticDesc: 'تم التحقق بنجاح من الختم الرقمي المشفر HMAC-SHA256 ومطابقة كافة سجلات درجات الحرارة دون أي تلاعب.',
    tampered: 'تحذير: اشتباه تلاعب في البيانات أو الختم الرقمي',
    tamperedDesc: 'الختم الرقمي لا يتطابق مع بصمة السجلات المحفوظة. يرجى مراجعة إدارة العمليات المبردة قبل الإفراج الجمركي.',
    unregistered: 'الشهادة غير مسجلة أو المعرف غير صالح',
    unregisteredDesc: 'لم يتم العثور على سجلات تبريد مطابقة لهذا الرمز. يرجى التأكد من مسح الرمز الصحيح.',
    badgeVerified: 'موثق ومشفر رقمياً',
    badgeTampered: 'مشبوه / تلاعب رقمي',
    badgeUnregistered: 'غير مسجل',
    certificateNumber: 'رقم الشهادة المرجعي',
    atpClassification: 'تصنيف ATP المعتمد',
    cargoType: 'نوع الشحنة المحمولة',
    complianceLevel: 'مستوى الامتثال الحراري',
    setpointTarget: 'الحرارة المستهدفة',
    mktIndex: 'مؤشر الحرارة الحركية (MKT)',
    currentOrAvg: 'متوسط درجة حرارة البضاعة',
    excursionsCount: 'إجمالي مدة الانحراف',
    doorBreaches: 'حوادث فتح الأبواب',
    trailerInfo: 'المقطورة / الشاحنة',
    coolingUnit: 'وحدة التبريد المستخدمة',
    cmrReference: 'وثيقة النقل (CMR)',
    route: 'مسار الرحلة الدولي',
    inspectorsNote: 'ملاحظات التفتيش الجمركي والصحي',
    inspectorsNoteDesc: 'هذا التقرير صادر تلقائياً ومحمي ببصمة تشفير غير قابلة للتعديل لأغراض الرقابة الصحية والجمارك الدولية.',
    downloadOfficialPdf: 'تحميل كشف درجات الحرارة الرسمي (PDF)',
    generatingPdf: 'جاري استخراج التقرير...',
    telemetryChartTitle: 'منحنى استقرار درجات الحرارة خلال الرحلة (°C)',
    minutes: 'دقيقة',
    recordsCount: 'إجمالي القراءات المسجلة',
    cargoCategories: {
      fresh_produce: 'بواكير وخضار وفواكه (+2°C إلى +6°C)',
      deep_frozen: 'أسماك ومجمدات عميقة (-18°C إلى -25°C)',
      pharma_cold: 'أدوية ومستحضرات GDP (+2°C إلى +8°C)',
      meat_chilled: 'لحوم مبردة طازجة (0°C إلى +4°C)',
    },
    statusLabels: {
      compliant: 'مطابق للمعايير الدولية (GDP Pass)',
      warning: 'تحذير: تقلبات حرارية طفيفة',
      breached: 'مخالفة حرجة لسلسلة التبريد',
    },
    copied: 'تم النسخ',
    copySeal: 'نسخ الختم التشفيري',
  },
  fr: {
    title: 'Portail Officiel de Vérification de la Chaîne du Froid',
    subtitle: 'Contrôle et conformité des relevés de température selon EN 12830 / GDP / ATP',
    authentic: 'Document Certifié et Conforme Numériquement',
    authenticDesc: 'Le sceau numérique cryptographique HMAC-SHA256 a été validé avec succès sans aucune altération de données.',
    tampered: 'Attention : Suspicion d\'altération ou falsification numérique',
    tamperedDesc: 'Le sceau cryptographique ne correspond pas à l\'empreinte des enregistrements enregistrés. Veuillez contacter les opérations frigorifiques avant le dédouanement.',
    unregistered: 'Certificat non enregistré ou identifiant invalide',
    unregisteredDesc: 'Aucun profil frigorifique ne correspond à ce code. Veuillez vérifier le QR Code scanné.',
    badgeVerified: 'Certifié & Crypté',
    badgeTampered: 'Suspect / Altération',
    badgeUnregistered: 'Non Enregistré',
    certificateNumber: 'N° de Certificat de Référence',
    atpClassification: 'Classification ATP Agréée',
    cargoType: 'Nature de la Marchandise',
    complianceLevel: 'Niveau de Conformité Thermique',
    setpointTarget: 'Consigne (Setpoint)',
    mktIndex: 'Indice Cinétique Moyen (MKT)',
    currentOrAvg: 'Température Moyenne Cargaison',
    excursionsCount: 'Durée Totale d\'Excursion',
    doorBreaches: 'Ouvertures Portes en Transit',
    trailerInfo: 'Remorque / Tracteur',
    coolingUnit: 'Groupe Frigorifique',
    cmrReference: 'Lettre de Voiture (CMR)',
    route: 'Itinéraire International',
    inspectorsNote: 'Note d\'Inspection Douanière & Sanitaire',
    inspectorsNoteDesc: 'Rapport généré automatiquement sous sceau d\'intégrité infalsifiable pour les autorités vétérinaires et douanières.',
    downloadOfficialPdf: 'Télécharger le Relevé Officiel (PDF)',
    generatingPdf: 'Génération en cours...',
    telemetryChartTitle: 'Courbe de Stabilité des Températures (°C)',
    minutes: 'min',
    recordsCount: 'Total des Relevés Enregistrés',
    cargoCategories: {
      fresh_produce: 'Fruits & Légumes Frais (+2°C à +6°C)',
      deep_frozen: 'Poissons & Surgelés (-18°C à -25°C)',
      pharma_cold: 'Produits Pharmaceutiques GDP (+2°C à +8°C)',
      meat_chilled: 'Viandes Réfrigérées (0°C à +4°C)',
    },
    statusLabels: {
      compliant: 'Conforme aux Normes Internationales (GDP Pass)',
      warning: 'Avertissement : Variations Mineures',
      breached: 'Rupture Critique Chaîne du Froid',
    },
    copied: 'Copié',
    copySeal: 'Copier le Sceau Numérique',
  },
  es: {
    title: 'Portal Oficial de Verificación de Cadena de Frío',
    subtitle: 'Inspección y conformidad de registros de temperatura según EN 12830 / GDP / ATP',
    authentic: 'Documento Certificado y Conforme Digitalmente',
    authenticDesc: 'El sello criptográfico HMAC-SHA256 ha sido validado con éxito sin alteración alguna de los datos.',
    tampered: 'Atención: Sospecha de alteración o falsificación digital',
    tamperedDesc: 'El sello criptográfico no coincide con la huella digital registrada. Consulte a operaciones frigoríficas antes del despacho aduanero.',
    unregistered: 'Certificado no registrado o identificador inválido',
    unregisteredDesc: 'No se encontraron registros frigoríficos para este código. Por favor verifique el código QR escaneado.',
    badgeVerified: 'Certificado y Cifrado',
    badgeTampered: 'Sospechoso / Alterado',
    badgeUnregistered: 'No Registrado',
    certificateNumber: 'N° de Certificado de Referencia',
    atpClassification: 'Clasificación ATP Homologada',
    cargoType: 'Tipo de Mercancía Transportada',
    complianceLevel: 'Nivel de Conformidad Térmica',
    setpointTarget: 'Consigna (Setpoint)',
    mktIndex: 'Índice Cinético Medio (MKT)',
    currentOrAvg: 'Temperatura Media de Carga',
    excursionsCount: 'Duración Total de Excursión',
    doorBreaches: 'Aperturas Puertas en Tránsito',
    trailerInfo: 'Semirremolque / Camión',
    coolingUnit: 'Equipo Frigorífico',
    cmrReference: 'Carta de Porte (CMR)',
    route: 'Ruta Internacional',
    inspectorsNote: 'Nota para Inspección Aduanera y Sanitaria',
    inspectorsNoteDesc: 'Informe generado automáticamente con sello inviolable para inspección veterinaria y aduanera internacional.',
    downloadOfficialPdf: 'Descargar Informe Oficial (PDF)',
    generatingPdf: 'Generando informe...',
    telemetryChartTitle: 'Curva de Estabilidad de Temperatura (°C)',
    minutes: 'min',
    recordsCount: 'Total de Registros Registrados',
    cargoCategories: {
      fresh_produce: 'Frutas y Hortalizas (+2°C a +6°C)',
      deep_frozen: 'Pescados y Congelados (-18°C a -25°C)',
      pharma_cold: 'Productos Farmacéuticos GDP (+2°C a +8°C)',
      meat_chilled: 'Carnes Refrigeradas (0°C a +4°C)',
    },
    statusLabels: {
      compliant: 'Conforme a Normas Internacionales (GDP Pass)',
      warning: 'Advertencia: Fluctuaciones Menores',
      breached: 'Ruptura Crítica Cadena de Frío',
    },
    copied: 'Copiado',
    copySeal: 'Copiar Sello Digital',
  },
};

export function PublicReeferVerifyView({
  initialResult,
  candidateHash,
  initialLang = 'ar',
}: PublicReeferVerifyViewProps) {
  const [lang, setLang] = useState<'ar' | 'fr' | 'es'>(initialLang);
  const [copied, setCopied] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  const t = DICTIONARY[lang];
  const isRtl = lang === 'ar';
  const result = initialResult;

  const handleCopyHash = () => {
    if (result.verificationHash) {
      navigator.clipboard.writeText(result.verificationHash);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleDownloadPdf = async () => {
    if (!result.tripId) return;
    setIsExportingPdf(true);
    try {
      const res = await exportReeferDataColdPdfAction(result.tripId, lang);
      if (res.success && res.fileContent) {
        const blob = new Blob([res.fileContent], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const win = window.open(url, '_blank');
        if (win) {
          win.focus();
        } else {
          // Fallback download anchor
          const a = document.createElement('a');
          a.href = url;
          a.download = res.fileName || `EN12830_Reefer_Report_${result.tripId}.html`;
          a.click();
        }
      } else {
        alert(res.error || 'Failed to download report');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error generating report';
      alert(msg);
    } finally {
      setIsExportingPdf(false);
    }
  };

  // Determine badge styling and state
  const isVerified = result.isValid && result.securityBadge === 'verified';
  const isTampered = result.securityBadge === 'tampered' || result.isTamperEvident;

  return (
    <div
      dir={isRtl ? 'rtl' : 'ltr'}
      className="min-h-screen bg-slate-50 dark:bg-slate-950 text-foreground py-8 px-4 sm:px-6 lg:px-8 flex flex-col items-center"
    >
      {/* Top Language Switcher Bar */}
      <div className="w-full max-w-4xl flex items-center justify-between pb-6 mb-4 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
          <Globe className="w-4 h-4 text-primary" />
          <span>Trans Bodanon • Cold Chain Trust Portal</span>
        </div>
        <div className="flex items-center gap-1.5 bg-slate-200/60 dark:bg-slate-800/60 p-1 rounded-xl text-xs font-bold">
          <button
            onClick={() => setLang('ar')}
            className={`px-3 py-1 rounded-lg transition-all ${
              lang === 'ar'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            العربية
          </button>
          <button
            onClick={() => setLang('fr')}
            className={`px-3 py-1 rounded-lg transition-all ${
              lang === 'fr'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Français
          </button>
          <button
            onClick={() => setLang('es')}
            className={`px-3 py-1 rounded-lg transition-all ${
              lang === 'es'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Español
          </button>
        </div>
      </div>

      <div className="w-full max-w-4xl space-y-6">
        {/* Main Status Hero Card */}
        <Card
          className={`border-2 shadow-xl overflow-hidden ${
            isVerified
              ? 'border-emerald-500/40 bg-gradient-to-br from-emerald-500/5 via-card to-background'
              : isTampered
              ? 'border-rose-500/60 bg-gradient-to-br from-rose-500/10 via-card to-background'
              : 'border-amber-500/40 bg-gradient-to-br from-amber-500/5 via-card to-background'
          }`}
        >
          <CardHeader className="pb-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div
                  className={`w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 shadow-inner ${
                    isVerified
                      ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                      : isTampered
                      ? 'bg-rose-500/20 text-rose-600 dark:text-rose-400 animate-pulse'
                      : 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
                  }`}
                >
                  {isVerified ? (
                    <ShieldCheck className="w-10 h-10" />
                  ) : isTampered ? (
                    <ShieldAlert className="w-10 h-10" />
                  ) : (
                    <ShieldX className="w-10 h-10" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Badge
                      className={`text-xs px-2.5 py-0.5 font-bold ${
                        isVerified
                          ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                          : isTampered
                          ? 'bg-rose-600 hover:bg-rose-700 text-white'
                          : 'bg-amber-600 hover:bg-amber-700 text-white'
                      }`}
                    >
                      {isVerified
                        ? t.badgeVerified
                        : isTampered
                        ? t.badgeTampered
                        : t.badgeUnregistered}
                    </Badge>
                    {result.complianceScorePercent !== undefined && (
                      <span className="text-xs font-mono font-bold text-muted-foreground">
                        Score: {result.complianceScorePercent}%
                      </span>
                    )}
                  </div>
                  <CardTitle className="text-2xl font-black tracking-tight">
                    {isVerified ? t.authentic : isTampered ? t.tampered : t.unregistered}
                  </CardTitle>
                  <CardDescription className="text-xs mt-1 max-w-xl">
                    {isVerified
                      ? t.authenticDesc
                      : isTampered
                      ? t.tamperedDesc
                      : t.unregisteredDesc}
                  </CardDescription>
                </div>
              </div>

              {/* Action Buttons in Hero */}
              {isVerified && result.tripId && (
                <div className="shrink-0">
                  <Button
                    onClick={handleDownloadPdf}
                    disabled={isExportingPdf}
                    className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-md flex items-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    <span>{isExportingPdf ? t.generatingPdf : t.downloadOfficialPdf}</span>
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>

          {isVerified && (
            <CardContent className="pt-0 pb-5">
              <div className="p-3 rounded-xl bg-slate-100/70 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <Lock className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="text-muted-foreground shrink-0">{t.certificateNumber}:</span>
                  <span className="font-mono font-bold text-foreground truncate">
                    {result.certificateNumber || candidateHash}
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyHash}
                  className="h-7 text-[11px] gap-1.5 shrink-0"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span>{t.copied}</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                      <span>{t.copySeal}</span>
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          )}
        </Card>

        {/* Bento Grid: Cold Chain Metrics & Cargo Specifications */}
        {isVerified && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Card 1: Setpoint & Average Return Temp */}
              <Card className="shadow-sm">
                <CardContent className="p-5 space-y-2">
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span className="text-xs font-semibold">{t.setpointTarget}</span>
                    <Thermometer className="w-4 h-4 text-sky-500" />
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-black font-mono text-sky-600 dark:text-sky-400">
                      {result.setpointTemp !== undefined ? `${result.setpointTemp}°C` : '--'}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      (±{(result.maxTempThreshold! - result.setpointTemp!).toFixed(1)}°C)
                    </span>
                  </div>
                  <div className="text-[11px] text-muted-foreground pt-1 border-t flex justify-between">
                    <span>{t.currentOrAvg}:</span>
                    <span className="font-mono font-bold text-foreground">
                      {result.avgReturnTemp !== undefined ? `${result.avgReturnTemp}°C` : '--'}
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* Card 2: Mean Kinetic Temperature (MKT) */}
              <Card className="shadow-sm">
                <CardContent className="p-5 space-y-2">
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span className="text-xs font-semibold">{t.mktIndex}</span>
                    <Activity className="w-4 h-4 text-emerald-500" />
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-black font-mono text-emerald-600 dark:text-emerald-400">
                      {result.mktTemperatureCelsius !== undefined
                        ? `${result.mktTemperatureCelsius}°C`
                        : '--'}
                    </span>
                    <Badge variant="outline" className="text-[10px] font-mono">
                      Arrhenius
                    </Badge>
                  </div>
                  <div className="text-[11px] text-muted-foreground pt-1 border-t flex justify-between">
                    <span>ΔH Activation:</span>
                    <span className="font-mono font-bold text-foreground">83.144 kJ/mol</span>
                  </div>
                </CardContent>
              </Card>

              {/* Card 3: Excursions & Integrity */}
              <Card className="shadow-sm">
                <CardContent className="p-5 space-y-2">
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span className="text-xs font-semibold">{t.excursionsCount}</span>
                    <Clock className="w-4 h-4 text-indigo-500" />
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-black font-mono text-foreground">
                      {result.totalExcursionMinutes || 0}
                    </span>
                    <span className="text-xs text-muted-foreground">{t.minutes}</span>
                  </div>
                  <div className="text-[11px] text-muted-foreground pt-1 border-t flex justify-between">
                    <span>{t.doorBreaches}:</span>
                    <span
                      className={`font-mono font-bold ${
                        (result.doorBreachesCount || 0) > 0 ? 'text-rose-600' : 'text-emerald-600'
                      }`}
                    >
                      {result.doorBreachesCount || 0}
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* Card 4: ATP Treaty Classification */}
              <Card className="shadow-sm">
                <CardContent className="p-5 space-y-2">
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span className="text-xs font-semibold">{t.atpClassification}</span>
                    <Snowflake className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-black font-mono uppercase text-foreground">
                      {result.atpClass === 'class_c'
                        ? 'ATP FRC (Class C)'
                        : result.atpClass?.toUpperCase() || 'ATP Class C'}
                    </span>
                  </div>
                  <div className="text-[11px] text-muted-foreground pt-1 border-t flex justify-between">
                    <span>{t.complianceLevel}:</span>
                    <span className="font-bold text-emerald-600">
                      {result.complianceStatus
                        ? t.statusLabels[result.complianceStatus]
                        : 'GDP Valid'}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Interactive Telemetry Mini-Graph */}
            {result.logsSample && result.logsSample.length > 0 && (
              <Card className="shadow-md">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Activity className="w-4 h-4 text-primary" />
                      <CardTitle className="text-base font-bold">
                        {t.telemetryChartTitle}
                      </CardTitle>
                    </div>
                    <span className="text-xs text-muted-foreground font-mono">
                      {result.totalLogsCount || result.logsSample.length} {t.recordsCount}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="p-5">
                  <div className="h-36 w-full relative flex flex-col justify-end">
                    {/* SVG Curve Plot */}
                    <svg
                      className="w-full h-full overflow-visible"
                      viewBox={`0 0 ${Math.max(100, result.logsSample.length * 20)} 100`}
                      preserveAspectRatio="none"
                    >
                      {/* Setpoint Reference Line */}
                      <line
                        x1="0"
                        y1="50"
                        x2={Math.max(100, result.logsSample.length * 20)}
                        y2="50"
                        stroke="#0ea5e9"
                        strokeWidth="1.5"
                        strokeDasharray="4 4"
                      />

                      {/* Return Air Temp Polyline */}
                      <polyline
                        fill="none"
                        stroke="#10b981"
                        strokeWidth="2.5"
                        points={result.logsSample
                          .map((log, idx) => {
                            const x = idx * 20 + 10;
                            // Map temperature relative to setpoint (50 center)
                            const diff = log.returnAirTemp - (result.setpointTemp || 4);
                            const y = Math.max(10, Math.min(90, 50 - diff * 12));
                            return `${x},${y}`;
                          })
                          .join(' ')}
                      />

                      {/* Data Points */}
                      {result.logsSample.map((log, idx) => {
                        const x = idx * 20 + 10;
                        const diff = log.returnAirTemp - (result.setpointTemp || 4);
                        const y = Math.max(10, Math.min(90, 50 - diff * 12));
                        return (
                          <circle
                            key={idx}
                            cx={x}
                            cy={y}
                            r="3"
                            className="fill-emerald-600 stroke-white dark:stroke-slate-900"
                            strokeWidth="1.5"
                          />
                        );
                      })}
                    </svg>

                    {/* Chart Legend */}
                    <div className="flex items-center justify-center gap-6 mt-3 text-[11px] text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <span className="w-3 h-0.5 bg-emerald-500 inline-block rounded"></span>
                        <span>{t.currentOrAvg} (°C)</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-3 h-0.5 bg-sky-500 border-dashed inline-block rounded"></span>
                        <span>{t.setpointTarget} ({result.setpointTemp}°C)</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Shipment & Operational Details (Masked for Public View) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Transport Metadata */}
              <Card className="shadow-sm">
                <CardHeader className="pb-3 border-b">
                  <div className="flex items-center gap-2 text-sm font-bold">
                    <Truck className="w-4 h-4 text-primary" />
                    <span>بيانات الشحنة والأسطول • Transport & Fleet</span>
                  </div>
                </CardHeader>
                <CardContent className="p-4 space-y-2.5 text-xs">
                  <div className="flex justify-between py-1 border-b">
                    <span className="text-muted-foreground flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5" />
                      {t.cmrReference}:
                    </span>
                    <span className="font-mono font-bold">{result.cmrNumber}</span>
                  </div>

                  <div className="flex justify-between py-1 border-b">
                    <span className="text-muted-foreground flex items-center gap-1.5">
                      <Truck className="w-3.5 h-3.5" />
                      {t.trailerInfo}:
                    </span>
                    <span className="font-mono font-semibold">
                      {result.trailerPlate} / {result.truckPlate}
                    </span>
                  </div>

                  <div className="flex justify-between py-1 border-b">
                    <span className="text-muted-foreground flex items-center gap-1.5">
                      <Snowflake className="w-3.5 h-3.5" />
                      {t.coolingUnit}:
                    </span>
                    <span className="font-medium">{result.coolingUnitBrand}</span>
                  </div>

                  <div className="flex justify-between py-1">
                    <span className="text-muted-foreground flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {t.cargoType}:
                    </span>
                    <span className="font-bold text-foreground">
                      {result.cargoCategory
                        ? t.cargoCategories[result.cargoCategory]
                        : 'Fresh Food / Pharma'}
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* Carrier & Legal Entity */}
              <Card className="shadow-sm">
                <CardHeader className="pb-3 border-b">
                  <div className="flex items-center gap-2 text-sm font-bold">
                    <Building className="w-4 h-4 text-primary" />
                    <span>الجهة الناقلة المعتمدة • Certified Carrier</span>
                  </div>
                </CardHeader>
                <CardContent className="p-4 space-y-2.5 text-xs">
                  <div className="flex justify-between py-1 border-b">
                    <span className="text-muted-foreground">الشركة:</span>
                    <span className="font-bold text-foreground">{result.company?.name}</span>
                  </div>

                  <div className="flex justify-between py-1 border-b">
                    <span className="text-muted-foreground">المعرف الموحد (ICE):</span>
                    <span className="font-mono font-bold">{result.company?.ice}</span>
                  </div>

                  <div className="flex justify-between py-1 border-b">
                    <span className="text-muted-foreground">الهاتف / Contact:</span>
                    <span className="font-mono">{result.company?.phone}</span>
                  </div>

                  <div className="flex justify-between py-1">
                    <span className="text-muted-foreground">العنوان:</span>
                    <span className="text-muted-foreground text-[11px] truncate max-w-[200px]">
                      {result.company?.address}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Official Border Inspection Seal Footer */}
            <div className="p-4 rounded-2xl bg-slate-900 text-slate-100 border border-slate-800 shadow-md flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-slate-800 text-emerald-400">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold text-sm text-white">{t.inspectorsNote}</div>
                  <div className="text-slate-400 text-[11px]">{t.inspectorsNoteDesc}</div>
                </div>
              </div>
              <div className="text-end font-mono text-[10px] text-slate-400">
                <div>HMAC-SHA256 INTEGRITY SEAL</div>
                <div className="text-emerald-400 font-bold break-all max-w-[280px]">
                  {result.verificationHash.substring(0, 32)}...
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

