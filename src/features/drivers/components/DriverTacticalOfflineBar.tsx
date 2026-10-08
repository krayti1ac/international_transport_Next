'use client';

import { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '@/components/language-provider';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import {
  getTotalOfflineQueueCount,
  processAllOfflineQueues,
} from '@/lib/offline-sync';
import { getAdaptiveCompressionSettings } from '@/lib/image-compressor';
import {
  Wifi,
  WifiOff,
  RefreshCw,
  ShieldAlert,
  MapPin,
  FileText,
  Radio,
  Navigation,
  BatteryCharging,
  Battery,
} from 'lucide-react';
import { DriverCheckpointModal } from './DriverCheckpointModal';
import { DriverOfflineDocumentWallet } from './DriverOfflineDocumentWallet';
import { autonomousGeoTracker } from '@/features/tracking/services/autonomous-geo-tracker.service';
import type { AutonomousTrackerStatus } from '@/features/tracking/types/offline-geolocation.types';
import type { Driver, TripOrder } from '@/types/database';

interface DriverTacticalOfflineBarProps {
  driver?: Driver | null;
  activeTrip?: TripOrder | null;
  onSyncCompleted?: () => void;
}

export function DriverTacticalOfflineBar({
  driver,
  activeTrip,
  onSyncCompleted,
}: DriverTacticalOfflineBarProps) {
  const { t, dir } = useLanguage();
  const { toast } = useToast();

  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [queueCount, setQueueCount] = useState<number>(0);
  const [syncing, setSyncing] = useState<boolean>(false);
  const [isRoaming, setIsRoaming] = useState<boolean>(false);
  const [isCheckpointOpen, setIsCheckpointOpen] = useState<boolean>(false);
  const [isWalletOpen, setIsWalletOpen] = useState<boolean>(false);
  const [geoStatus, setGeoStatus] = useState<AutonomousTrackerStatus | null>(null);

  const refreshCount = useCallback(async () => {
    try {
      const count = await getTotalOfflineQueueCount();
      setQueueCount(count);
    } catch {
      setQueueCount(0);
    }
  }, []);

  // Autonomous GPS Tracking lifecycle
  useEffect(() => {
    if (activeTrip?.id) {
      autonomousGeoTracker.startTracking(activeTrip.id, {
        truckId: activeTrip.truck_id,
        driverId: driver?.id,
      });

      const unsubscribe = autonomousGeoTracker.subscribe((status) => {
        setGeoStatus(status);
        refreshCount();
      });

      return () => {
        unsubscribe();
      };
    }
  }, [activeTrip?.id, activeTrip?.truck_id, driver?.id, refreshCount]);

  useEffect(() => {
    refreshCount();

    const compressionSettings = getAdaptiveCompressionSettings();
    setIsRoaming(compressionSettings.isRoamingOrWeak);

    const handleOnline = () => {
      setIsOnline(true);
      refreshCount();
      // Auto-trigger sync on reconnect
      handleManualSync();
    };

    const handleOffline = () => {
      setIsOnline(false);
      refreshCount();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const interval = setInterval(refreshCount, 10000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, [refreshCount]);

  const handleManualSync = async () => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      toast({
        title: t('لا يتوفر اتصال بالإنترنت', 'Aucune connexion Internet', 'Sin conexión a Internet'),
        description: t(
          'أنت الآن في وضع عدم الاتصال بالصحراء. بياناتك محفوظة بأمان في ذاكرة الهاتف وسيتم رفعها تلقائياً عند استعادة التغطية.',
          'Vous êtes hors-ligne. Vos données sont sécurisées dans le stockage local et seront synchronisées dès le retour du réseau.',
          'Modo sin conexión activo. Sus datos están guardados localmente y se sincronizarán al recuperar la cobertura.'
        ),
      });
      return;
    }

    setSyncing(true);
    try {
      const res = await processAllOfflineQueues();
      const geoCount = res.geoBreadcrumbs?.totalSynced || 0;
      const totalSuccess =
        res.receipts.successCount +
        res.pods.successCount +
        res.tasks.successCount +
        res.checkpoints.successCount +
        geoCount;

      await refreshCount();

      if (totalSuccess > 0) {
        toast({
          title: t('✅ تمت المزامنة بنجاح', '✅ Synchronisation réussie', '✅ Sincronización exitosa'),
          description: t(
            `تم رفع ${totalSuccess} عنصر (مسارات GPS، وصولات، توقيعات، نقاط عبور) إلى الخادم المركزي.`,
            `${totalSuccess} élément(s) (traces GPS, reçus, POD, checkpoints) synchronisés avec succès.`,
            `${totalSuccess} elemento(s) sincronizados con éxito.`
          ),
        });
        if (onSyncCompleted) onSyncCompleted();
      } else {
        toast({
          title: t('النظام محدث بالكامل', 'Système à jour', 'Sistema al día'),
          description: t('لا توجد عناصر معلقة قيد المزامنة.', 'Aucun élément en attente.', 'No hay elementos pendientes.'),
        });
      }
    } catch (err) {
      console.error('Error during manual sync:', err);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <>
      <div
        className="sticky top-0 z-30 w-full bg-slate-900/95 backdrop-blur-md text-white border-b border-slate-800 px-3 py-2 shadow-md"
        dir={dir}
      >
        <div className="flex flex-wrap items-center justify-between gap-2 max-w-4xl mx-auto">
          {/* Status Badge */}
          <div className="flex items-center gap-2">
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wide transition-all ${
                isOnline
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                  : 'bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse'
              }`}
            >
              {isOnline ? (
                <>
                  <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{t('متصل بالشبكة', 'En Ligne', 'Conectado')}</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-3.5 h-3.5 text-amber-300" />
                  <span>
                    {t(
                      `وضع عدم الاتصال بالصحراء (${queueCount} قيد الانتظار)`,
                      `Hors-ligne Désert (${queueCount} en attente)`,
                      `Sin conexión (${queueCount} pendientes)`
                    )}
                  </span>
                </>
              )}
            </div>

            {/* Roaming Guard Indicator */}
            {isRoaming && (
              <div
                className="hidden sm:flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-500/20 border border-blue-500/30 text-blue-300 text-[10px] font-semibold"
                title={t(
                  'وضع التجوال الدولي نشط: تفعيل الضغط الفائق للصور إلى أقل من 200KB لحفظ باقة البيانات',
                  'Roaming actif: compression extrême des photos (<200KB) pour préserver les données',
                  'Roaming activo: compresión de fotos (<200KB)'
                )}
              >
                <ShieldAlert className="w-3 h-3 text-blue-400" />
                <span>{t('حماية التجوال (Roaming Guard)', 'Roaming Guard', 'Roaming Guard')}</span>
              </div>
            )}

            {/* Autonomous GPS Tracker Status */}
            {geoStatus?.isActive && (
              <div
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                title={t(
                  'تتبع المسار الصحراوي الذاتي نشط مع توفير البطارية',
                  'Traçage GPS désertique autonome actif avec économiseur de batterie',
                  'Rastreo GPS desértico autónomo activo'
                )}
              >
                <Navigation className="w-3.5 h-3.5 text-cyan-400" />
                <span>
                  {t('تتبع نشط', 'GPS Actif', 'GPS Activo')}
                  {geoStatus.pendingQueueCount > 0 ? ` (${geoStatus.pendingQueueCount})` : ''}
                </span>
                {geoStatus.batteryLevel !== undefined && (
                  <span className="flex items-center text-[10px] text-cyan-200/80 ps-1 border-s border-cyan-500/30">
                    {geoStatus.batteryLevel}%
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Quick Action Buttons */}
          <div className="flex items-center gap-1.5">
            {/* Log Checkpoint Button */}
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsCheckpointOpen(true)}
              className="h-8 px-2.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-100 border-slate-700 rounded-lg gap-1"
            >
              <MapPin className="w-3.5 h-3.5 text-amber-400" />
              <span>{t('تسجيل نقطة عبور', 'Point de Passage', 'Punto de Paso')}</span>
            </Button>

            {/* Document Wallet Button */}
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsWalletOpen(true)}
              className="h-8 px-2.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-100 border-slate-700 rounded-lg gap-1"
            >
              <FileText className="w-3.5 h-3.5 text-indigo-400" />
              <span>{t('محفظة الوثائق', 'Documents', 'Documentos')}</span>
            </Button>

            {/* Manual Sync Button */}
            <Button
              size="sm"
              onClick={handleManualSync}
              disabled={syncing}
              className={`h-8 px-2.5 text-xs rounded-lg gap-1 font-bold ${
                queueCount > 0
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white animate-bounce'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
              }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
              <span className="hidden xs:inline">
                {syncing
                  ? t('جاري الرفع...', 'Sync...', 'Sincronizando...')
                  : queueCount > 0
                  ? t(`مزامنة (${queueCount})`, `Sync (${queueCount})`, `Sinc (${queueCount})`)
                  : t('مزامنة', 'Sync', 'Sinc')}
              </span>
            </Button>
          </div>
        </div>
      </div>

      {/* Checkpoint Modal */}
      <DriverCheckpointModal
        isOpen={isCheckpointOpen}
        onClose={() => {
          setIsCheckpointOpen(false);
          refreshCount();
        }}
        activeTrip={activeTrip}
      />

      {/* Offline Document Wallet Modal */}
      <DriverOfflineDocumentWallet
        isOpen={isWalletOpen}
        onClose={() => setIsWalletOpen(false)}
        driver={driver}
        activeTrip={activeTrip}
      />
    </>
  );
}

