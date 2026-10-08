'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useLanguage } from '@/components/language-provider';
import { useToast } from '@/hooks/use-toast';
import {
  saveCheckpointToOfflineQueue,
  type StrategicCheckpointType,
} from '@/lib/offline-sync';
import {
  MapPin,
  Navigation,
  Compass,
  CheckCircle2,
  Gauge,
  Thermometer,
  Fuel,
} from 'lucide-react';
import type { TripOrder } from '@/types/database';

interface DriverCheckpointModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeTrip?: TripOrder | null;
}

export function DriverCheckpointModal({
  isOpen,
  onClose,
  activeTrip,
}: DriverCheckpointModalProps) {
  const { t, dir } = useLanguage();
  const { toast } = useToast();

  const [checkpointType, setCheckpointType] =
    useState<StrategicCheckpointType>('guerguerat_customs_entry');
  const [notes, setNotes] = useState('');
  const [odometerKm, setOdometerKm] = useState('');
  const [fuelLevel, setFuelLevel] = useState('');
  const [reeferTemp, setReeferTemp] = useState('');
  const [latitude, setLatitude] = useState<number | undefined>(undefined);
  const [longitude, setLongitude] = useState<number | undefined>(undefined);
  const [gpsFetching, setGpsFetching] = useState(false);
  const [saving, setSaving] = useState(false);

  // Auto-acquire GPS coordinates
  useEffect(() => {
    if (!isOpen) return;

    if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
      setGpsFetching(true);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLatitude(pos.coords.latitude);
          setLongitude(pos.coords.longitude);
          setGpsFetching(false);
        },
        (err) => {
          console.warn('Geolocation warning:', err.message);
          setGpsFetching(false);
        },
        { timeout: 8000, enableHighAccuracy: true }
      );
    }
  }, [isOpen]);

  const checkpointOptions: {
    type: StrategicCheckpointType;
    labelAr: string;
    labelFr: string;
    labelEs: string;
    icon: string;
  }[] = [
    {
      type: 'guerguerat_customs_entry',
      labelAr: '🇲🇦 معبر الكركارات المغربي (الدخول والتفتيش)',
      labelFr: '🇲🇦 Guerguerat Poste Frontière Marocain',
      labelEs: '🇲🇦 Paso Fronterizo de Guerguerat',
      icon: '🏛️',
    },
    {
      type: 'guerguerat_buffer_exit',
      labelAr: '🏜️ المنطقة العازلة (قندهار الصحراوية)',
      labelFr: '🏜️ Zone Tampon Kandahar (No Man’s Land)',
      labelEs: '🏜️ Zona de Amortiguamiento Kandahar',
      icon: '🏜️',
    },
    {
      type: 'mauritania_pk55_entry',
      labelAr: '🇲🇷 جمارك الكلم 55 موريتانيا (التأشيرة والعبور)',
      labelFr: '🇲🇷 Douane PK55 Mauritanie (Visa & Transit)',
      labelEs: '🇲🇷 Aduana PK55 Mauritania',
      icon: '🛂',
    },
    {
      type: 'nouakchott_transit_halt',
      labelAr: '🐪 نواكشوط (استراحة القافلة وتفتيش السلامة)',
      labelFr: '🐪 Halte Nouakchott (Contrôle Convoi)',
      labelEs: '🐪 Parada Nouakchott',
      icon: '🐪',
    },
    {
      type: 'rosso_ferry_crossing',
      labelAr: '🚢 عبّارة روصو النهرية نحو السنغال (Bac de Rosso)',
      labelFr: '🚢 Bac fluvial de Rosso (Vers Sénégal)',
      labelEs: '🚢 Barcaza fluvial de Rosso',
      icon: '🚢',
    },
    {
      type: 'diama_border_crossing',
      labelAr: '🇸🇳 معبر سد دياما السنغالي (Barrage de Diama)',
      labelFr: '🇸🇳 Poste frontière Barrage de Diama',
      labelEs: '🇸🇳 Paso de Diama (Senegal)',
      icon: '🇸🇳',
    },
    {
      type: 'dakar_delivery_hub',
      labelAr: '📍 داكار (وصول مستودعات وميناء السنغال)',
      labelFr: '📍 Hub Dakar (Arrivée Déchargement)',
      labelEs: '📍 Llegada Dakar',
      icon: '📍',
    },
    {
      type: 'tanger_med_port_gate',
      labelAr: '⚓ بوابة ميناء طنجة المتوسط (PortNet / SAS)',
      labelFr: '⚓ Port Tanger Med (Accès SAS Export)',
      labelEs: '⚓ Acceso Puerto Tánger Med',
      icon: '⚓',
    },
    {
      type: 'ferry_boarding',
      labelAr: '⛴️ صعود العبّارة البحرية (Tanger Med ➔ Algeciras)',
      labelFr: '⛴️ Embarquement Ferry (Tanger Med ➔ Algésiras)',
      labelEs: '⛴️ Embarque Ferry',
      icon: '⛴️',
    },
    {
      type: 'algeciras_port_arrival',
      labelAr: '🇪🇸 وصول ميناء الجزيرة الخضراء (التفتيش الجمركي الأوروبي)',
      labelFr: '🇪🇸 Port Algésiras (Contrôle Douane UE / PIF)',
      labelEs: '🇪🇸 Puerto de Algeciras',
      icon: '🇪🇸',
    },
    {
      type: 'departure_depot',
      labelAr: '🚚 الانطلاق من مستودع الشحن الأصلي',
      labelFr: '🚚 Départ du Dépôt / Entrepôt',
      labelEs: '🚚 Salida del Almacén',
      icon: '🚚',
    },
    {
      type: 'delivery_destination',
      labelAr: '🏁 الوصول النهائي لوجهة التسليم',
      labelFr: '🏁 Arrivée Destination Finale',
      labelEs: '🏁 Llegada al Destino',
      icon: '🏁',
    },
  ];

  const handleSave = async () => {
    setSaving(true);
    try {
      const selectedOption = checkpointOptions.find((c) => c.type === checkpointType);
      const label = selectedOption?.labelAr || checkpointType;
      const tripId = activeTrip?.id || 0;

      await saveCheckpointToOfflineQueue({
        trip_id: tripId,
        checkpoint_type: checkpointType,
        checkpoint_label: label,
        notes: notes.trim() || undefined,
        latitude,
        longitude,
        odometer_km: odometerKm ? Number(odometerKm) : undefined,
        fuel_level_percent: fuelLevel ? Number(fuelLevel) : undefined,
        reefer_temperature: reeferTemp ? Number(reeferTemp) : undefined,
        idempotency_key: `checkpoint_${tripId}_${checkpointType}_${Date.now()}`,
      });

      toast({
        title: t('✅ تم تسجيل نقطة العبور بنجاح', '✅ Point de passage enregistré', '✅ Punto registrado'),
        description: t(
          'تم حفظ السجل في ذاكرة الجهاز غير المتصلة وسيتم إرساله تلقائياً إلى غرفة العمليات فور توفر الشبكة.',
          'Enregistré en mémoire hors-ligne. Synchronisation automatique dès que le réseau est disponible.',
          'Guardado localmente. Se sincronizará automáticamente al haber cobertura.'
        ),
      });

      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error';
      toast({
        title: t('خطأ', 'Erreur', 'Error'),
        description: msg,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto" dir={dir}>
        <DialogHeader className="text-start border-b border-border/60 pb-2">
          <DialogTitle className="text-base font-bold flex items-center gap-2">
            <Compass className="w-5 h-5 text-amber-500" />
            {t(
              'تسجيل نقطة عبور ميدانية (Offline Checkpoint)',
              'Enregistrement Point de Passage (Hors-Ligne)',
              'Registro Punto de Control (Offline)'
            )}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {t(
              'توثيق معابر الصحراء والحدود والموانئ وحفظها محلياً دون اشتراط وجود إنترنت.',
              'Enregistrement instantané des postes frontières et haltes sans connexion requise.',
              'Registro inmediato de pasos fronterizos y escalas sin conexión requerida.'
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3.5 py-2 text-xs">
          {/* Checkpoint selector */}
          <div className="space-y-1.5">
            <label className="font-bold text-foreground block">
              {t('اختر المعبر أو النقطة الحالية:', 'Sélectionnez le poste / étape:', 'Seleccionar paso:')}
            </label>
            <Select
              value={checkpointType}
              onValueChange={(val) => setCheckpointType(val as StrategicCheckpointType)}
            >
              <SelectTrigger className="w-full h-10 rounded-xl text-xs font-semibold">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {checkpointOptions.map((opt) => (
                  <SelectItem key={opt.type} value={opt.type} className="text-xs">
                    {t(opt.labelAr, opt.labelFr, opt.labelEs)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* GPS Coordinates preview */}
          <div className="p-2.5 bg-muted/40 rounded-xl border border-border/80 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-emerald-600" />
              <div>
                <span className="font-bold block text-[11px]">
                  {t('الموقع الجغرافي (GPS):', 'Coordonnées GPS:', 'Ubicación GPS:')}
                </span>
                <span className="text-[10px] text-muted-foreground font-mono">
                  {latitude && longitude
                    ? `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`
                    : gpsFetching
                    ? t('جاري التقاط الإحداثيات من القمر الصناعي...', 'Recherche signal GPS...', 'Buscando GPS...')
                    : t('إحداثيات تقريبية (جاهز للحفظ)', 'Non disponible / En attente', 'Pendiente')}
                </span>
              </div>
            </div>
            {latitude && longitude && (
              <span className="text-[10px] bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 font-bold px-2 py-0.5 rounded-md">
                {t('دقيق 📍', 'Précis 📍', 'Preciso 📍')}
              </span>
            )}
          </div>

          {/* Telemetry Inputs */}
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
                <Gauge className="w-3 h-3 text-slate-500" />
                {t('العداد (Km)', 'Odomètre (Km)', 'Km')}
              </label>
              <input
                type="number"
                placeholder="245100"
                value={odometerKm}
                onChange={(e) => setOdometerKm(e.target.value)}
                className="w-full h-8 px-2.5 rounded-lg border border-border bg-background text-xs font-mono"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
                <Fuel className="w-3 h-3 text-amber-500" />
                {t('الوقود %', 'Gasoil %', 'Combustible %')}
              </label>
              <input
                type="number"
                placeholder="80%"
                value={fuelLevel}
                onChange={(e) => setFuelLevel(e.target.value)}
                className="w-full h-8 px-2.5 rounded-lg border border-border bg-background text-xs font-mono"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
                <Thermometer className="w-3 h-3 text-cyan-500" />
                {t('الحرارة °C', 'Frigo °C', 'Temp °C')}
              </label>
              <input
                type="number"
                placeholder="-20°C"
                value={reeferTemp}
                onChange={(e) => setReeferTemp(e.target.value)}
                className="w-full h-8 px-2.5 rounded-lg border border-border bg-background text-xs font-mono"
              />
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1">
            <label className="font-semibold text-[11px] text-muted-foreground block">
              {t('ملاحظات الميدان أو حالة المرور:', 'Observations / Trafic:', 'Observaciones:')}
            </label>
            <textarea
              rows={2}
              placeholder={t(
                'ختم الجمارك جاهز، طابور الشاحنات سريع...',
                'Formalités douanières en cours, trafic fluide...',
                'Trámites aduaneros en curso...'
              )}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full p-2 rounded-xl border border-border bg-background text-xs resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-border/60">
          <Button variant="outline" size="sm" onClick={onClose} disabled={saving} className="rounded-xl text-xs">
            {t('إلغاء', 'Annuler', 'Cancelar')}
          </Button>

          <Button
            size="sm"
            onClick={handleSave}
            disabled={saving}
            className="rounded-xl gap-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{t('تأكيد وحفظ النقطة محلياً', 'Valider le point hors-ligne', 'Confirmar punto')}</span>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
