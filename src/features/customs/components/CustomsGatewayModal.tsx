'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  ShieldCheck,
  Download,
  FileCode,
  CheckCircle2,
  AlertTriangle,
  Anchor,
  Truck,
  FileText,
  Copy,
  Check,
  RefreshCw,
} from 'lucide-react';
import { getTripCustomsData } from '../services/customs-gateway.actions';
import { generatePortNetXml, generateTirEpdXml } from '../utils/customs-xml';
import type { PortNetGatePass, TirEpdDeclaration, CustomsPreCheckResult } from '../types';

interface CustomsGatewayModalProps {
  tripId: number | null;
  isOpen: boolean;
  onClose: () => void;
}

export function CustomsGatewayModal({ tripId, isOpen, onClose }: CustomsGatewayModalProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [portNet, setPortNet] = useState<PortNetGatePass | null>(null);
  const [tirEpd, setTirEpd] = useState<TirEpdDeclaration | null>(null);
  const [readiness, setReadiness] = useState<CustomsPreCheckResult | null>(null);
  const [activeTab, setActiveTab] = useState<'portnet' | 'tirepd'>('portnet');
  const [copied, setCopied] = useState(false);

  const loadData = useCallback(async () => {
    if (!tripId) return;
    setLoading(true);
    try {
      const res = await getTripCustomsData(tripId);
      if (res.success && res.portNet && res.tirEpd) {
        setPortNet(res.portNet);
        setTirEpd(res.tirEpd);
        setReadiness(res.readiness || null);
      } else {
        toast({ title: res.error || 'فشل تحميل بيانات الجمارك', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'خطأ في الاتصال بالخادم', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [tripId, toast]);

  useEffect(() => {
    if (isOpen && tripId) {
      loadData();
    }
  }, [isOpen, tripId, loadData]);

  const handleDownloadXml = (type: 'portnet' | 'tirepd') => {
    let xmlContent = '';
    let filename = '';

    if (type === 'portnet' && portNet) {
      xmlContent = generatePortNetXml(portNet);
      filename = `PortNet-GatePass-Trip-${tripId}.xml`;
    } else if (type === 'tirepd' && tirEpd) {
      xmlContent = generateTirEpdXml(tirEpd);
      filename = `TIR-EPD-Declaration-Trip-${tripId}.xml`;
    }

    if (!xmlContent) return;

    const blob = new Blob([xmlContent], { type: 'application/xml;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({ title: `تم تنزيل ملف ${type === 'portnet' ? 'PortNet' : 'TIR-EPD'} XML بنجاح` });
  };

  const handleCopyXml = (type: 'portnet' | 'tirepd') => {
    let xmlContent = '';
    if (type === 'portnet' && portNet) xmlContent = generatePortNetXml(portNet);
    if (type === 'tirepd' && tirEpd) xmlContent = generateTirEpdXml(tirEpd);

    if (!xmlContent) return;
    navigator.clipboard.writeText(xmlContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: 'تم نسخ محتوى XML إلى الحافظة' });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader className="border-b pb-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-primary mb-1">
            <ShieldCheck className="w-4 h-4" />
            <span>بوابة الربط الجمركي والموانئ (PortNet & TIR-EPD Gateway)</span>
          </div>
          <DialogTitle className="text-xl font-bold font-amiri text-foreground flex items-center justify-between">
            <span>تخليص عبور الشاحنة والبيان الجمركي المسبق #{tripId}</span>
            {portNet && (
              <Badge variant="outline" className="font-mono text-xs border-primary/40 text-primary">
                {portNet.cmrNumber}
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            توليد تصاريح بوابة ميناء طنجة المتوسط (PortNet Pass Portuaire) والبيان الجمركي الإلكتروني الأوروبي (IRU TIR-EPD).
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2 text-muted-foreground">
            <RefreshCw className="w-8 h-8 animate-spin text-primary" />
            <p className="text-xs font-semibold">جاري تجميع وثائق الشحنة والجمارك...</p>
          </div>
        ) : !portNet || !tirEpd ? (
          <div className="py-8 text-center text-xs text-muted-foreground">
            لا توجد بيانات متاحة لهذه الرحلة.
          </div>
        ) : (
          <div className="space-y-4 py-2">
            {/* Readiness Summary Banner */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* PortNet Readiness */}
              <div
                className={`p-3.5 rounded-xl border flex items-start gap-2.5 ${
                  readiness?.isReadyForPortNet
                    ? 'bg-emerald-500/10 border-emerald-500/30'
                    : 'bg-amber-500/10 border-amber-500/30'
                }`}
              >
                {readiness?.isReadyForPortNet ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                )}
                <div className="space-y-1">
                  <p className="text-xs font-bold text-foreground">
                    بوابة PortNet (طنجة المتوسط)
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {readiness?.isReadyForPortNet
                      ? 'جميع البيانات مكتملة وجاهزة لتوليد تصريح المرور (Pass Portuaire).'
                      : `بيانات ناقصة: ${readiness?.missingPortNetFields.join('، ')}`}
                  </p>
                </div>
              </div>

              {/* TIR-EPD Readiness */}
              <div
                className={`p-3.5 rounded-xl border flex items-start gap-2.5 ${
                  readiness?.isReadyForTirEpd
                    ? 'bg-emerald-500/10 border-emerald-500/30'
                    : 'bg-amber-500/10 border-amber-500/30'
                }`}
              >
                {readiness?.isReadyForTirEpd ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                )}
                <div className="space-y-1">
                  <p className="text-xs font-bold text-foreground">
                    البيان الجمركي الأوروبي (IRU TIR-EPD)
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {readiness?.isReadyForTirEpd
                      ? 'مستندات العبور الدولي تحت نظام TIR جاهزة للإرسال الإلكتروني.'
                      : `بيانات ناقصة: ${readiness?.missingTirEpdFields.join('، ')}`}
                  </p>
                </div>
              </div>
            </div>

            {/* Itinerary & Equipment Summary Card */}
            <div className="p-3.5 bg-muted/40 rounded-xl border border-border/80 text-xs space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div>
                  <span className="text-[10px] text-muted-foreground block">رأس الشاحنة (Tracteur):</span>
                  <span className="font-mono font-bold text-foreground">{portNet.tractorPlate}</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground block">المقطورة (Remorque):</span>
                  <span className="font-mono font-bold text-foreground">{portNet.trailerPlate}</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground block">السائق وجواز السفر:</span>
                  <span className="font-medium text-foreground">
                    {portNet.driverName} ({portNet.driverCinOrPassport || 'غير محدد'})
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground block">حجز العبّارة (Ferry Localizador):</span>
                  <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                    {portNet.bookingReference}
                  </span>
                </div>
              </div>

              <div className="border-t pt-2 grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div>
                  <span className="text-[10px] text-muted-foreground block">الرقم المرجعي الجمركي (MRN/DUM):</span>
                  <span className="font-mono text-[11px] text-foreground">{portNet.mrnNumber}</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground block">ختم الرصاص الجمركي (Scellé):</span>
                  <span className="font-mono text-[11px] text-foreground">{portNet.customsSealNumber}</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground block">الوزن الإجمالي للبضاعة:</span>
                  <span className="font-mono font-bold text-foreground">{portNet.grossWeightKg.toLocaleString()} KG</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground block">شركة العبّارات البحرية:</span>
                  <span className="text-foreground">{portNet.ferryCompany}</span>
                </div>
              </div>
            </div>

            {/* XML Switcher Tabs */}
            <div className="border rounded-xl p-3 bg-card space-y-3">
              <div className="flex items-center justify-between border-b pb-2">
                <div className="flex gap-2">
                  <button
                    onClick={() => setActiveTab('portnet')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                      activeTab === 'portnet'
                        ? 'bg-primary text-primary-foreground shadow-xs'
                        : 'text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    <Anchor className="w-3.5 h-3.5" />
                    معاينة PortNet XML (Tanger Med)
                  </button>
                  <button
                    onClick={() => setActiveTab('tirepd')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                      activeTab === 'tirepd'
                        ? 'bg-primary text-primary-foreground shadow-xs'
                        : 'text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    <FileCode className="w-3.5 h-3.5" />
                    معاينة IRU TIR-EPD XML (EU Entry)
                  </button>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCopyXml(activeTab)}
                  className="h-7 text-xs gap-1"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? 'تم النسخ' : 'نسخ XML'}
                </Button>
              </div>

              {/* XML Codebox */}
              <div className="relative">
                <pre
                  dir="ltr"
                  className="bg-slate-950 text-slate-100 p-3 rounded-lg text-[11px] font-mono max-h-56 overflow-y-auto leading-relaxed"
                >
                  {activeTab === 'portnet' ? generatePortNetXml(portNet) : generateTirEpdXml(tirEpd)}
                </pre>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t">
              <Button variant="outline" size="sm" onClick={onClose} className="rounded-xl text-xs">
                إغلاق
              </Button>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => handleDownloadXml('portnet')}
                  className="rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5 shadow-2xs"
                >
                  <Download className="w-4 h-4" />
                  تحميل PortNet XML
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleDownloadXml('tirepd')}
                  className="rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 shadow-2xs"
                >
                  <Download className="w-4 h-4" />
                  تحميل TIR-EPD XML
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

