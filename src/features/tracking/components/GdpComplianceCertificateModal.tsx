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
  ThermometerSnowflake,
  ShieldCheck,
  Printer,
  Copy,
  CheckCircle,
  AlertTriangle,
  FileCheck2,
  Lock,
  Truck,
  Award,
  MessageCircle,
  Send,
  Download,
} from 'lucide-react';
import type {
  ColdChainAuditEvaluation,
  TripReeferMonitoringProfile,
} from '../types/reefer-compliance.types';
import { REEFER_CARGO_CATALOG } from '../types/reefer-compliance.types';
import { dispatchReeferWhatsAppCertificateAction } from '../services/reefer-compliance.actions';
import { exportReeferDataColdCsvAction } from '../services/reefer-export.actions';


interface GdpComplianceCertificateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile: TripReeferMonitoringProfile;
  evaluation: ColdChainAuditEvaluation;
  cmrNumber?: string;
  route?: string;
  clientName?: string;
  truckPlate?: string;
  trailerPlate?: string;
}

export function GdpComplianceCertificateModal({
  open,
  onOpenChange,
  profile,
  evaluation,
  cmrNumber,
  route = 'Agadir (MA) ➔ Perpignan (FR)',
  clientName = 'Société Internationale Exportatrice',
  truckPlate = '12345-A-40',
  trailerPlate = 'REM-9921',
}: GdpComplianceCertificateModalProps) {
  const { t, dir, locale } = useLanguage();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [showWhatsAppBar, setShowWhatsAppBar] = useState(false);
  const [recipientPhone, setRecipientPhone] = useState('+212694585307');
  const [selectedLocale, setSelectedLocale] = useState<'ar' | 'fr' | 'es'>(
    locale === 'fr' ? 'fr' : locale === 'es' ? 'es' : 'ar'
  );
  const [isPendingWhatsApp, startTransitionWhatsApp] = useTransition();

  const cargoPreset = REEFER_CARGO_CATALOG[profile.cargoCategory] || REEFER_CARGO_CATALOG.fresh_produce;
  const certificateHash = evaluation.certificateHash || `ATP-${profile.atpClass.toUpperCase()}-${profile.tripId}-CERT`;
  const isCompliant = evaluation.complianceStatus === 'compliant';
  const isWarning = evaluation.complianceStatus === 'warning';

  const handleCopyHash = () => {
    navigator.clipboard.writeText(certificateHash);
    setCopied(true);
    toast({
      title: 'تم نسخ كود الشهادة التشفيري',
      description: certificateHash,
    });
    setTimeout(() => setCopied(false), 2500);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleSendWhatsApp = () => {
    if (!recipientPhone.trim()) {
      toast({
        title: 'يرجى إدخال رقم هاتف المستلم',
        variant: 'destructive',
      });
      return;
    }

    startTransitionWhatsApp(async () => {
      const res = await dispatchReeferWhatsAppCertificateAction({
        tripId: profile.tripId,
        recipientPhone,
        locale: selectedLocale,
      });

      if (!res.success) {
        toast({
          title: 'فشل إرسال الشهادة عبر واتساب',
          description: res.error,
          variant: 'destructive',
        });
        return;
      }

      toast({
        title: 'تم إرسال شهادة المطابقة بنجاح عبر WhatsApp ❄️',
        description: `المستلم: ${res.phone} ${res.isSimulated ? '(وضع التجربة الآمن 🧪)' : ''}`,
      });
      setShowWhatsAppBar(false);
    });
  };

  const [isExportingCsv, setIsExportingCsv] = useState(false);

  const handleExportCsv = async () => {
    setIsExportingCsv(true);
    try {
      const res = await exportReeferDataColdCsvAction(
        profile.tripId,
        locale === 'fr' ? 'fr' : locale === 'es' ? 'es' : 'ar'
      );
      if (res.success && res.fileContent) {
        const blob = new Blob([res.fileContent], { type: res.mimeType || 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = res.fileName || `reefer_logs_${profile.tripId}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        toast({ title: 'تم تصدير سجل درجات الحرارة (CSV) بنجاح 📊' });
      } else {
        toast({ title: 'فشل تصدير ملف CSV', description: res.error, variant: 'destructive' });
      }
    } finally {
      setIsExportingCsv(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto p-4 sm:p-6 bg-slate-950 text-slate-100 border-slate-800">
        <DialogHeader className="print:hidden">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
            <div>
              <DialogTitle className="text-xl font-bold flex items-center gap-2 text-white">
                <FileCheck2 className="w-6 h-6 text-emerald-400" />
                شهادة الامتثال الرقمية لسلسلة التبريد (GDP / EN 12830 / ATP)
              </DialogTitle>
              <DialogDescription className="text-sm text-slate-400 mt-1">
                وثيقة مطابقة المعايير الأوروبية للنقل الدولي المبرد وتدقيق الحرارة الحركية (MKT)
              </DialogDescription>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowWhatsAppBar(!showWhatsAppBar)}
                className="bg-emerald-950/40 border-emerald-700/60 hover:bg-emerald-900/60 text-emerald-300 font-medium"
              >
                <MessageCircle className="w-4 h-4 me-1.5 text-emerald-400" />
                إرسال واتساب
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={isExportingCsv}
                onClick={handleExportCsv}
                className="bg-slate-900 border-slate-700 hover:bg-slate-800 text-slate-200"
                title="تحميل كشف DataCOLD بصيغة CSV"
              >
                <Download className="w-4 h-4 me-1.5 text-cyan-400" />
                تصدير CSV
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyHash}
                className="bg-slate-900 border-slate-700 hover:bg-slate-800 text-slate-200"
              >
                {copied ? <CheckCircle className="w-4 h-4 text-emerald-400 me-1.5" /> : <Copy className="w-4 h-4 me-1.5" />}
                {copied ? 'تم النسخ' : 'نسخ الكود'}
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={handlePrint}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
              >
                <Printer className="w-4 h-4 me-1.5" />
                طباعة / PDF
              </Button>
            </div>
          </div>

          {/* Interactive WhatsApp Dispatch Bar */}
          {showWhatsAppBar && (
            <div className="bg-slate-900/90 border border-emerald-500/30 rounded-xl p-3 mt-3 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 animate-in fade-in duration-200">
              <div className="flex-1">
                <label className="text-[10px] text-slate-400 block mb-1">
                  رقم هاتف المستلم (العميل المستورد أو السائق مع رمز الدولة الدولي):
                </label>
                <Input
                  value={recipientPhone}
                  onChange={(e) => setRecipientPhone(e.target.value)}
                  placeholder="+212600000000 / +33600000000 / +34600000000"
                  className="h-8 text-xs bg-slate-950 border-slate-700 text-white font-mono"
                  dir="ltr"
                />
              </div>

              <div className="w-28">
                <label className="text-[10px] text-slate-400 block mb-1">لغة الرسالة:</label>
                <select
                  value={selectedLocale}
                  onChange={(e) => setSelectedLocale(e.target.value as 'ar' | 'fr' | 'es')}
                  className="h-8 text-xs w-full bg-slate-950 border border-slate-700 rounded-md text-white px-2"
                >
                  <option value="ar">العربية (AR)</option>
                  <option value="fr">Français (FR)</option>
                  <option value="es">Español (ES)</option>
                </select>
              </div>

              <div className="self-end pt-4 sm:pt-0">
                <Button
                  size="sm"
                  disabled={isPendingWhatsApp}
                  onClick={handleSendWhatsApp}
                  className="h-8 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold"
                >
                  <Send className="w-3.5 h-3.5 me-1.5" />
                  {isPendingWhatsApp ? 'جاري الإرسال...' : 'إرسال الآن'}
                </Button>
              </div>
            </div>
          )}
        </DialogHeader>


        {/* Certificate Printable Canvas */}
        <div className="bg-white text-slate-900 p-6 sm:p-8 rounded-xl shadow-2xl border-4 border-slate-200 font-sans print:p-0 print:border-none print:shadow-none print:text-black mt-2">
          {/* Header */}
          <div className="border-b-2 border-slate-900 pb-4 mb-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <span className="text-xs uppercase tracking-widest font-extrabold text-emerald-700 block">
                  TRANS BODANON INTERNATIONAL FREIGHT • CARRIER REEFER DIVISION
                </span>
                <h1 className="text-2xl font-black text-slate-950 uppercase tracking-tight mt-0.5">
                  CERTIFICAT OFFICIEL DE CONFORMITÉ DE LA CHAÎNE DU FROID
                </h1>
                <p className="text-xs text-slate-600 font-medium mt-0.5">
                  Accord ATP (Classe {profile.atpClass.toUpperCase()}) • Norme EN 12830 • Bonnes Pratiques de Distribution (BPD/GDP 2013/C 343/01)
                </p>
              </div>
              <div className="text-end">
                <Badge
                  className={`text-sm px-3 py-1 font-bold ${
                    isCompliant
                      ? 'bg-emerald-600 text-white hover:bg-emerald-600'
                      : isWarning
                      ? 'bg-amber-500 text-white hover:bg-amber-500'
                      : 'bg-red-600 text-white hover:bg-red-600'
                  }`}
                >
                  {isCompliant ? 'CONFORME / COMPLIANT' : isWarning ? 'TOLÉRÉ / WITH WARNING' : 'NON CONFORME / BREACHED'}
                </Badge>
                <span className="block text-[11px] text-slate-500 font-mono mt-1">
                  Certificat N°: {certificateHash.substring(0, 22)}
                </span>
              </div>
            </div>
          </div>

          {/* Section 1: Expedition & Equipment Details */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-lg border border-slate-200 text-xs mb-6">
            <div>
              <span className="text-slate-500 block uppercase font-bold text-[10px]">Voyage / Trip ID</span>
              <span className="font-extrabold text-slate-900 text-sm">#{profile.tripId}</span>
              {cmrNumber && <span className="block text-[11px] text-slate-600">CMR: {cmrNumber}</span>}
            </div>
            <div>
              <span className="text-slate-500 block uppercase font-bold text-[10px]">Itinéraire / Route</span>
              <span className="font-semibold text-slate-900">{route}</span>
              <span className="block text-[11px] text-slate-600">Client: {clientName}</span>
            </div>
            <div>
              <span className="text-slate-500 block uppercase font-bold text-[10px]">Tracteur & Semi-Remorque</span>
              <span className="font-semibold text-slate-900">{truckPlate}</span>
              <span className="block text-[11px] text-slate-600">Remorque: {trailerPlate}</span>
            </div>
            <div>
              <span className="text-slate-500 block uppercase font-bold text-[10px]">Groupe Frigorifique</span>
              <span className="font-semibold text-slate-900">{profile.coolingUnitBrand}</span>
              <span className="block text-[11px] text-emerald-700 font-bold">ATP: {profile.atpClass.toUpperCase()} (FRC)</span>
            </div>
          </div>

          {/* Section 2: Thermal Parameters & Kinetic Temperature (MKT) */}
          <div className="mb-6">
            <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider mb-2 flex items-center gap-1.5">
              <ThermometerSnowflake className="w-4 h-4 text-emerald-600" />
              Paramètres Thermiques & Audit de Cinétique Moyenne (MKT)
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div className="p-3 border border-slate-200 rounded-lg bg-white">
                <span className="text-[10px] text-slate-500 uppercase font-bold block">Consigne (Setpoint)</span>
                <span className="text-lg font-black text-slate-900">{profile.setpointTemp > 0 ? `+${profile.setpointTemp}` : profile.setpointTemp}°C</span>
                <span className="text-[10px] text-slate-500 block">Tolérance: {profile.minTempThreshold}°C à {profile.maxTempThreshold}°C</span>
              </div>
              <div className="p-3 border border-emerald-200 bg-emerald-50/50 rounded-lg">
                <span className="text-[10px] text-emerald-800 uppercase font-bold block">Température MKT</span>
                <span className="text-lg font-black text-emerald-700">
                  {evaluation.mktTemperatureCelsius > 0 ? `+${evaluation.mktTemperatureCelsius}` : evaluation.mktTemperatureCelsius}°C
                </span>
                <span className="text-[10px] text-emerald-600 block">Cinétique Arrhenius ΔH 83.1 kJ</span>
              </div>
              <div className="p-3 border border-slate-200 rounded-lg bg-white">
                <span className="text-[10px] text-slate-500 uppercase font-bold block">Moyenne Air Soufflé</span>
                <span className="text-lg font-bold text-slate-800">
                  {evaluation.avgSupplyTemp > 0 ? `+${evaluation.avgSupplyTemp}` : evaluation.avgSupplyTemp}°C
                </span>
                <span className="text-[10px] text-slate-500 block">Supply Air Average</span>
              </div>
              <div className="p-3 border border-slate-200 rounded-lg bg-white">
                <span className="text-[10px] text-slate-500 uppercase font-bold block">Moyenne Air Repris</span>
                <span className="text-lg font-bold text-slate-800">
                  {evaluation.avgReturnTemp > 0 ? `+${evaluation.avgReturnTemp}` : evaluation.avgReturnTemp}°C
                </span>
                <span className="text-[10px] text-slate-500 block">Return Air Average</span>
              </div>
              <div className="p-3 border border-slate-200 rounded-lg bg-white">
                <span className="text-[10px] text-slate-500 uppercase font-bold block">Score de Conformité</span>
                <span className="text-lg font-black text-emerald-600">{evaluation.complianceScorePercent}%</span>
                <span className="text-[10px] text-slate-500 block">{evaluation.totalLogsCount} relevés horodatés</span>
              </div>
            </div>
          </div>

          {/* Section 3: Excursions & Security Incidents */}
          <div className="mb-6">
            <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider mb-2 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              Contrôle des Excursions & Intégrité des Portes en Transit
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3 border border-slate-200 rounded-lg bg-slate-50">
                <span className="text-slate-600 font-bold block">Durée d&apos;Excursion Thermique</span>
                <span className="text-base font-black text-slate-900 mt-0.5">
                  {evaluation.totalExcursionMinutes} minutes
                </span>
                <span className="text-[10px] text-slate-500 block">
                  Seuil maximal autorisé: {profile.maxAllowedExcursionMinutes} min
                </span>
              </div>
              <div className="p-3 border border-slate-200 rounded-lg bg-slate-50">
                <span className="text-slate-600 font-bold block">Ouvertures de Portes en Transit</span>
                <span className="text-base font-black text-slate-900 mt-0.5">
                  {evaluation.doorBreachesCount} {evaluation.doorBreachesCount === 0 ? 'incident (Intégrité 100%)' : 'anomalies'}
                </span>
                <span className="text-[10px] text-slate-500 block">
                  Contrôle par géofencing des points autorisés
                </span>
              </div>
              <div className="p-3 border border-slate-200 rounded-lg bg-slate-50">
                <span className="text-slate-600 font-bold block">Consommation Gazole Groupe</span>
                <span className="text-base font-black text-slate-900 mt-0.5">
                  {evaluation.totalDieselBurnedLiters} Litres
                </span>
                <span className="text-[10px] text-slate-500 block">
                  Autonomie et fonctionnement continu vérifiés
                </span>
              </div>
            </div>
          </div>

          {/* Section 4: Legal declaration & Signatures */}
          <div className="border-t border-slate-300 pt-4 mt-6 text-xs text-slate-600 leading-relaxed">
            <p className="italic">
              Nous soussignés, Trans Bodanon International Freight, certifions que les denrées périssables / produits pharmaceutiques
              chargés à bord de la semi-remorque sous référence ont été maintenus sous surveillance thermique continue conformément
              à l&apos;accord international ATP et aux directives européennes GDP. Les données brutes issues des enregistreurs EN 12830
              sont scellées numériquement et inaltérables.
            </p>

            <div className="grid grid-cols-2 gap-8 mt-6 pt-4 border-t border-dashed border-slate-300">
              {/* Seal & Hash */}
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-full border-2 border-emerald-600 flex items-center justify-center bg-emerald-50 text-emerald-800 font-bold text-center text-[9px] uppercase leading-tight">
                  TRANS<br />BODANON<br />SEAL
                </div>
                <div>
                  <span className="text-[10px] font-mono text-slate-500 block">EMPREINTE NUMÉRIQUE SHA-256:</span>
                  <span className="font-mono text-[11px] font-bold text-slate-900 block break-all">
                    {certificateHash}
                  </span>
                  <span className="text-[9px] text-slate-400 block mt-0.5">
                    Généré le: {new Date().toLocaleDateString('fr-FR')} • Horodatage certifié UTC
                  </span>
                </div>
              </div>

              {/* Signatures */}
              <div className="flex justify-between items-end text-end">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">
                    Direction Technique & Chaîne du Froid
                  </span>
                  <div className="h-10 border-b border-slate-400 w-44 mt-1 flex items-end justify-end pb-1 font-serif italic text-slate-800 text-sm">
                    M. K. Bodanon (Signé)
                  </div>
                  <span className="text-[9px] text-slate-400 block mt-0.5">Visa de Conformité Sanitaire</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

