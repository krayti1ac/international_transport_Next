'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/components/language-provider';
import {
  ShieldCheck,
  CreditCard,
  Truck,
  FileText,
  Anchor,
  Globe2,
  Calendar,
  AlertTriangle,
} from 'lucide-react';
import type { Driver, TripOrder } from '@/types/database';

interface DriverOfflineDocumentWalletProps {
  isOpen: boolean;
  onClose: () => void;
  driver?: Driver | null;
  activeTrip?: TripOrder | null;
}

export function DriverOfflineDocumentWallet({
  isOpen,
  onClose,
  driver,
  activeTrip,
}: DriverOfflineDocumentWalletProps) {
  const { t, dir } = useLanguage();

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto" dir={dir}>
        <DialogHeader className="text-start border-b border-border/60 pb-2">
          <DialogTitle className="text-base font-bold flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-indigo-600" />
            {t(
              'محفظة وثائق السائق الرقمية دون إنترنت',
              'Portefeuille Numérique Hors-Ligne (Police / Douane)',
              'Cartera Digital Offline (Aduanas / Policía)'
            )}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {t(
              'جاهزة للعرض الفوري أمام شرطة الحدود، الجمارك، ومكاتب الموانئ دون اشتراط وجود شبكة.',
              'Prête pour contrôle immédiat aux postes frontières sans besoin de réseau.',
              'Lista para inspección inmediata en puestos fronterizos.'
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2 text-xs">
          {/* Driver Credentials Card */}
          <div className="p-3 bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-xl shadow-sm border border-slate-700">
            <div className="flex items-center justify-between pb-2 border-b border-slate-700">
              <span className="font-extrabold text-sm">{driver?.name || t('كابتن الأسطول', 'Conducteur', 'Conductor')}</span>
              <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full font-mono">
                {driver?.cin || 'CIN'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 mt-2.5 text-[11px]">
              <div>
                <span className="text-slate-400 block text-[10px]">{t('رخصة السياقة:', 'Permis:', 'Licencia:')}</span>
                <span className="font-mono font-bold">{driver?.license || 'N/A'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">{t('الهاتف:', 'Téléphone:', 'Teléfono:')}</span>
                <span className="font-mono">{driver?.phone || 'N/A'}</span>
              </div>
            </div>

            {/* Visas */}
            <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-slate-700/60 text-[10px]">
              <div>
                <span className="text-indigo-300 block font-semibold">{t('تأشيرة إفريقيا (موريتانيا/السنغال):', 'Visa Afrique:', 'Visado África:')}</span>
                <span className="font-mono">
                  {driver?.african_visa_number || t('صالحة للعبور', 'Valide', 'Válido')}
                </span>
                {driver?.african_visa_expiry_date && (
                  <span className="text-slate-400 block">
                    {t('انتهاء:', 'Exp:', 'Cad:')} {driver.african_visa_expiry_date}
                  </span>
                )}
              </div>

              <div>
                <span className="text-amber-300 block font-semibold">{t('تأشيرة شنغن الأوروبية:', 'Visa Schengen:', 'Visado Schengen:')}</span>
                <span className="font-mono">
                  {driver?.visa_number || (driver?.has_valid_visa ? t('سارية المفعول', 'Valide', 'Válido') : t('غير متوفرة', 'Non renseigné', 'No disponible'))}
                </span>
                {driver?.visa_expiry_date && (
                  <span className="text-slate-400 block">
                    {t('انتهاء:', 'Exp:', 'Cad:')} {driver.visa_expiry_date}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Assigned Vehicle Card */}
          <div className="p-3 bg-muted/40 rounded-xl border border-border/80">
            <div className="flex items-center gap-1.5 font-bold text-foreground mb-2">
              <Truck className="w-4 h-4 text-emerald-600" />
              <span>{t('بيانات الشاحنة والمقطورة المسندة', 'Véhicule & Ensemble Attelé', 'Vehículo Asignado')}</span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div>
                <span className="text-muted-foreground block text-[10px]">{t('لوحة الشاحنة (Tracteur):', 'Plaque Tracteur:', 'Camión:')}</span>
                <span className="font-mono font-extrabold text-foreground">
                  {driver?.default_truck_name || 'TRACTEUR-REG-MA'}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[10px]">{t('لوحة المقطورة (Semi-remorque):', 'Plaque Remorque:', 'Remolque:')}</span>
                <span className="font-mono font-extrabold text-foreground">
                  {driver?.default_trailer_name || 'REMORQUE-FRIGO-MA'}
                </span>
              </div>
            </div>
          </div>

          {/* Active Trip International Waybill Card */}
          {activeTrip && (
            <div className="p-3 bg-indigo-500/10 border border-indigo-500/30 rounded-xl">
              <div className="flex items-center gap-1.5 font-bold text-indigo-950 dark:text-indigo-200 mb-2">
                <FileText className="w-4 h-4 text-indigo-600" />
                <span>{t('الرحلة ووثائق الترانزيت (CMR / MRN)', 'Voyage Actif (CMR & Douane)', 'Viaje Activo')}</span>
              </div>

              <div className="space-y-1.5 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('المسار:', 'Itinéraire:', 'Ruta:')}</span>
                  <span className="font-bold text-foreground">{activeTrip.route}</span>
                </div>

                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('رقم إرسالية CMR:', 'N° CMR Export:', 'Nº CMR:')}</span>
                  <span className="font-mono font-bold text-indigo-700 dark:text-indigo-300">
                    {activeTrip.cmr_export_number || activeTrip.cmr_number || `CMR-2026-${activeTrip.id}`}
                  </span>
                </div>

                {activeTrip.goods_description_export && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('البضاعة المشحونة:', 'Marchandise:', 'Mercancía:')}</span>
                    <span className="text-foreground">{activeTrip.goods_description_export}</span>
                  </div>
                )}

                {activeTrip.weight_export && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('الوزن الإجمالي:', 'Poids Brut:', 'Peso Bruto:')}</span>
                    <span className="font-mono font-bold text-foreground">
                      {activeTrip.weight_export} Kg
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end pt-2 border-t border-border/60">
          <Button size="sm" onClick={onClose} className="rounded-xl text-xs px-4">
            {t('تم الفحص / إغلاق', 'Fermer', 'Cerrar')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

