'use client';

import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Printer, 
  X, 
  ShieldCheck, 
  Truck, 
  User, 
  Navigation, 
  Globe2, 
  Coins 
} from 'lucide-react';
import { 
  AfricanTransitManifest, 
  AFRICAN_CORRIDOR_WAYPOINTS, 
  buildAfricanTransitManifest 
} from '@/lib/african-corridor';
import { formatCurrency } from '@/lib/forex';
import type { TripOrder, Driver, Truck as TruckType, Trailer } from '@/types/database';

interface AfricanTransitManifestModalProps {
  isOpen: boolean;
  onClose: () => void;
  trip: TripOrder;
  driver?: Driver | null;
  truck?: TruckType | null;
  trailer?: Trailer | null;
  customsSealNumber?: string;
  carnetNumber?: string;
  ecowasCardNumber?: string;
}

export function AfricanTransitManifestModal({
  isOpen,
  onClose,
  trip,
  driver,
  truck,
  trailer,
  customsSealNumber,
  carnetNumber,
  ecowasCardNumber,
}: AfricanTransitManifestModalProps) {
  const printAreaRef = useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

  const manifest: AfricanTransitManifest = buildAfricanTransitManifest({
    tripId: trip.id,
    orderNumber: trip.cmr_number || trip.cmr_export_number || `ORD-${trip.id.toString().padStart(5, '0')}`,
    truckPlate: truck?.plate_number || (trip.truck_id ? `TRUCK-${trip.truck_id}` : '12345-A-40'),
    trailerPlate: trailer?.plate_number || undefined,
    driverName: driver?.name || 'سائق النقل الدولي',
    driverCin: driver?.cin || undefined,
    driverLicense: driver?.license || undefined,
    africanVisaNumber: driver?.african_visa_number || undefined,
    africanVisaExpiry: driver?.african_visa_expiry_date || undefined,
    customsSealNumber,
    carnetDePassageNumber: carnetNumber,
    ecowasCardNumber,
    loadingPoint: trip.route_export || 'المغرب / أكادير',
    destinationPoint: trip.route_import || 'السنغال / دكار',
    cargoDescription: trip.goods_description_export || undefined,
    cargoWeightKg: trip.weight_export ? Number(trip.weight_export) : undefined,
    declaredValueMad: trip.price ? Number(trip.price) : undefined,
    departureDate: trip.departure_date || undefined,
  });

  const handlePrint = () => {
    window.print();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-3 sm:p-5 overflow-y-auto"
      dir="rtl"
      onClick={onClose}
    >
      <div
        className="bg-card border border-border w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden my-auto animate-in fade-in-50 zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* شريط الإجراءات العلوي */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-muted/40 no-print">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl">
              <Globe2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold flex items-center gap-2">
                <span>كشف الترانزيت الجمركي الإفريقي (TRIE)</span>
                <Badge variant="outline" className="text-[11px] font-mono border-emerald-500/30 text-emerald-600 bg-emerald-500/5">
                  ECOWAS & Mauritania Transit
                </Badge>
              </h2>
              <p className="text-xs text-muted-foreground">Déclaration de Transit Inter-États / Carnet de Passage</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={handlePrint}
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl gap-1.5 shadow-sm"
            >
              <Printer className="w-4 h-4" />
              <span>طباعة الكشف الرسمي</span>
            </Button>
            <Button
              onClick={onClose}
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full hover:bg-muted"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </Button>
          </div>
        </div>

        {/* جسم الوثيقة المجهزة للطباعة */}
        <div ref={printAreaRef} className="p-6 sm:p-8 space-y-6 text-foreground bg-card print:p-0 print:bg-white print:text-black">
          {/* ترويسة الوثيقة */}
          <div className="border-2 border-emerald-600/30 rounded-xl p-5 bg-gradient-to-r from-emerald-50/50 via-card to-amber-50/50 dark:from-emerald-950/20 dark:to-amber-950/20">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl">🇲🇦</span>
                  <span className="text-muted-foreground text-xs">➔</span>
                  <span className="text-2xl">🇲🇷</span>
                  <span className="text-muted-foreground text-xs">➔</span>
                  <span className="text-2xl">🇸🇳</span>
                  <h1 className="text-lg sm:text-xl font-black font-amiri text-foreground mr-2">
                    كشف الترانزيت البري الدولي للممر الإفريقي
                  </h1>
                </div>
                <p className="text-xs text-muted-foreground font-mono mt-1">
                  {"COMMUNAUTÉ ÉCONOMIQUE DES ÉTATS DE L'AFRIQUE DE L'OUEST (CEDEAO / ECOWAS)"}
                </p>
              </div>

              <div className="text-start sm:text-end font-mono">
                <span className="text-xs text-muted-foreground block">رقم الكشف الدولي:</span>
                <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-md border border-emerald-500/20">
                  {manifest.manifestNumber}
                </span>
              </div>
            </div>

            {/* الأختام ووثائق المرور */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 text-xs">
              <div className="bg-background/80 p-2.5 rounded-lg border">
                <span className="text-muted-foreground block text-[11px]">رقم الختم الجمركي (Plomb):</span>
                <span className="font-mono font-bold text-foreground text-xs">{manifest.customsSealNumber}</span>
              </div>
              <div className="bg-background/80 p-2.5 rounded-lg border">
                <span className="text-muted-foreground block text-[11px]">دفتر المرور الدولي (CPD):</span>
                <span className="font-mono font-bold text-foreground text-xs">{manifest.carnetDePassageNumber}</span>
              </div>
              <div className="bg-background/80 p-2.5 rounded-lg border">
                <span className="text-muted-foreground block text-[11px]">البطاقة البنية (Carte Brune):</span>
                <span className="font-mono font-bold text-foreground text-xs">{manifest.ecowasCardNumber}</span>
              </div>
              <div className="bg-background/80 p-2.5 rounded-lg border">
                <span className="text-muted-foreground block text-[11px]">أمر الشحن (Order #):</span>
                <span className="font-mono font-bold text-foreground text-xs">{manifest.orderNumber}</span>
              </div>
            </div>
          </div>

          {/* محطات الممر الخمسة (شريط المسار الإفريقي) */}
          <div className="border rounded-xl p-4 bg-muted/20">
            <h3 className="text-xs font-bold text-muted-foreground mb-3 flex items-center gap-1.5">
              <Navigation className="w-3.5 h-3.5 text-primary" />
              <span>محطات الممر البري ونقاط المراقبة الجمركية والأمنية:</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 text-center text-xs">
              {Object.values(AFRICAN_CORRIDOR_WAYPOINTS).map((wp, idx) => (
                <div key={wp.id} className="p-2 rounded-lg border bg-card/80 flex flex-col items-center justify-between">
                  <div className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[10px] font-bold flex items-center justify-center mb-1">
                    {idx + 1}
                  </div>
                  <span className="font-bold text-[11px] line-clamp-1">{wp.nameAr}</span>
                  <span className="text-[10px] text-muted-foreground font-mono mt-0.5">
                    {wp.latitude.toFixed(2)}, {wp.longitude.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* تفاصيل الشاحنة والسائق */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* الشاحنة والمقطورة */}
            <div className="border rounded-xl p-4 space-y-3 bg-card">
              <h3 className="text-xs font-bold text-muted-foreground flex items-center gap-1.5 border-b pb-2">
                <Truck className="w-3.5 h-3.5 text-primary" />
                <span>بيانات الشاحنة والمقطورة الدولية</span>
              </h3>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">لوحة ترقيم الشاحنة:</span>
                  <span className="font-mono font-bold">{manifest.truckPlate}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">لوحة ترقيم المقطورة:</span>
                  <span className="font-mono font-bold">{manifest.trailerPlate}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">نقطة الانطلاق والشحن:</span>
                  <span className="font-semibold">{manifest.loadingPoint}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">نقطة الوصول النهائية:</span>
                  <span className="font-semibold">{manifest.destinationPoint}</span>
                </div>
              </div>
            </div>

            {/* بيانات السائق وتأشيرة الممر الإفريقي */}
            <div className="border rounded-xl p-4 space-y-3 bg-card">
              <h3 className="text-xs font-bold text-muted-foreground flex items-center gap-1.5 border-b pb-2">
                <User className="w-3.5 h-3.5 text-primary" />
                <span>بيانات السائق وتأشيرة العبور</span>
              </h3>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">اسم السائق:</span>
                  <span className="font-bold">{manifest.driverName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">بطاقة التعريف (CIN):</span>
                  <span className="font-mono">{manifest.driverCin}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">رخصة السياقة:</span>
                  <span className="font-mono">{manifest.driverLicense}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">تأشيرة الممر الإفريقي:</span>
                  <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    {manifest.africanVisaNumber} (تنتهي: {manifest.africanVisaExpiry})
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* بيان الحمولة والقيم المعلنة بالعملات المتعددة */}
          <div className="border rounded-xl p-4 space-y-3 bg-muted/10">
            <h3 className="text-xs font-bold text-muted-foreground flex items-center gap-1.5 border-b pb-2">
              <Coins className="w-3.5 h-3.5 text-amber-500" />
              <span>بيان البضاعة والقيمة الجمركية المعلنة (MAD / MRU / XOF)</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
              <div className="sm:col-span-1">
                <span className="text-muted-foreground block text-[11px]">طبيعة البضاعة:</span>
                <span className="font-semibold text-xs">{manifest.cargoDescription}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">الوزن الإجمالي (الصافي):</span>
                <span className="font-mono font-bold text-xs">{manifest.cargoWeightKg.toLocaleString('fr-MA')} كجم</span>
              </div>
              <div className="sm:col-span-2 space-y-1">
                <span className="text-muted-foreground block text-[11px]">القيمة المصرح بها متعددة العملات:</span>
                <div className="flex flex-wrap gap-2 text-xs font-mono font-bold">
                  <span className="bg-muted px-2 py-0.5 rounded border">{formatCurrency(manifest.declaredValueMad, 'MAD')}</span>
                  <span className="bg-muted px-2 py-0.5 rounded border text-amber-600">{formatCurrency(manifest.declaredValueMru, 'MRU')}</span>
                  <span className="bg-muted px-2 py-0.5 rounded border text-indigo-600">{formatCurrency(manifest.declaredValueXof, 'XOF')}</span>
                </div>
              </div>
            </div>
          </div>

          {/* خانات التأشير والختم الجمركي الميداني للمعابر */}
          <div className="border rounded-xl p-4">
            <h3 className="text-xs font-bold text-muted-foreground mb-3 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>خانات التأشير والأختام الرسمية للمعابر الحدودية:</span>
            </h3>
            <div className="grid grid-cols-3 gap-3 text-center text-xs">
              <div className="border-2 border-dashed rounded-xl p-4 h-24 flex flex-col justify-between items-center text-muted-foreground">
                <span className="text-[11px] font-bold">ختم جمارك الكركارات 🇲🇦</span>
                <span className="text-[9px]">Visa Sortie Maroc</span>
              </div>
              <div className="border-2 border-dashed rounded-xl p-4 h-24 flex flex-col justify-between items-center text-muted-foreground">
                <span className="text-[11px] font-bold">ختم ترانزيت موريتانيا 🇲🇷</span>
                <span className="text-[9px]">Visa Transit Mauritanie</span>
              </div>
              <div className="border-2 border-dashed rounded-xl p-4 h-24 flex flex-col justify-between items-center text-muted-foreground">
                <span className="text-[11px] font-bold">ختم دخول السنغال (روصو) 🇸🇳</span>
                <span className="text-[9px]">Visa Entrée Sénégal (Rosso)</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

