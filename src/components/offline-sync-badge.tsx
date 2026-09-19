'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { getTotalOfflineQueueCount, processAllOfflineQueues } from '@/lib/offline-sync';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/components/language-provider';

export function OfflineSyncBadge() {
  const { t, dir } = useLanguage();
  const [isOnline, setIsOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const { toast } = useToast();

  const updateStatus = useCallback(async () => {
    if (typeof navigator !== 'undefined') {
      setIsOnline(navigator.onLine);
    }
    try {
      const count = await getTotalOfflineQueueCount();
      setPendingCount(count);
    } catch {
      setPendingCount(0);
    }
  }, []);

  const triggerSync = useCallback(async () => {
    if ((typeof navigator !== 'undefined' && !navigator.onLine) || isSyncing) return;
    const count = await getTotalOfflineQueueCount();
    if (count === 0) return;

    setIsSyncing(true);
    try {
      const { receipts, pods, tasks } = await processAllOfflineQueues();
      const successTotal = receipts.successCount + pods.successCount + tasks.successCount;
      const failTotal = receipts.failCount + pods.failCount + tasks.failCount;

      if (successTotal > 0) {
        toast({
          title: t('✅ اكتملت المزامنة بنجاح', '✅ Synchronisation réussie', '✅ Sincronización exitosa'),
          description: t(
            `تم رفع وتحديث ${successTotal} من العناصر المعلقة (إيصالات، إثباتات تسليم POD، ومهام).`,
            `${successTotal} élément(s) synchronisé(s) (reçus, preuves POD et missions).`,
            `${successTotal} elemento(s) sincronizado(s) (recibos, pruebas POD y misiones).`
          ),
        });
      }
      if (failTotal > 0) {
        toast({
          title: t('فشلت بعض المزامنات', 'Échec partiel de synchronisation', 'Fallo parcial de sincronización'),
          description: t(
            `تعذر رفع ${failTotal} من العناصر المعلقة - سيتم المحاولة مجدداً تلقائياً.`,
            `${failTotal} élément(s) n'ont pas pu être synchronisés - nouvelle tentative automatique.`,
            `${failTotal} elemento(s) no se pudieron sincronizar - reintento automático.`
          ),
          variant: 'destructive',
        });
      }
    } finally {
      setIsSyncing(false);
      updateStatus();
    }
  }, [isSyncing, t, toast, updateStatus]);

  useEffect(() => {
    updateStatus();

    const handleOnline = () => {
      updateStatus();
      toast({
        title: t('🌐 تم استعادة الاتصال بالإنترنت', '🌐 Connexion Internet rétablie', '🌐 Conexión a Internet restablecida'),
      });
      triggerSync();
    };

    const handleOffline = () => {
      updateStatus();
      toast({
        title: t('⚠️ انقطاع الاتصال', '⚠️ Connexion perdue', '⚠️ Conexión perdida'),
        description: t(
          'الوضع غير المتصل نشط - سيتم حفظ الإيصالات وإثباتات التسليم محلياً في هاتفك.',
          'Mode hors ligne actif - les reçus et POD seront stockés localement.',
          'Modo sin conexión activo - los recibos y POD se guardarán localmente.'
        ),
        variant: 'destructive',
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const interval = setInterval(updateStatus, 5000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, [toast, t, triggerSync, updateStatus]);

  if (isOnline && pendingCount === 0) {
    return null;
  }

  return (
    <div
      className={`fixed bottom-20 ${dir === 'rtl' ? 'left-4' : 'right-4'} z-40 flex items-center gap-2 bg-background/95 backdrop-blur border border-border shadow-lg p-2 rounded-2xl animate-in fade-in slide-in-from-bottom-4`}
      dir={dir}
    >
      {!isOnline ? (
        <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-rose-500/15 text-rose-600 border border-rose-500/30">
          <WifiOff className="w-3.5 h-3.5 animate-pulse" />
          <span>{t('غير متصل (Offline)', 'Hors ligne (Offline)', 'Sin conexión (Offline)')}</span>
        </span>
      ) : (
        <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-500/15 text-emerald-600 border border-emerald-500/30">
          <Wifi className="w-3.5 h-3.5" />
          <span>{t('متصل', 'En ligne', 'En línea')}</span>
        </span>
      )}

      {pendingCount > 0 && (
        <Button
          size="sm"
          variant="outline"
          disabled={!isOnline || isSyncing}
          onClick={triggerSync}
          className="h-8 rounded-xl text-xs flex items-center gap-1.5 bg-primary/5 hover:bg-primary/10 border-primary/20 text-primary font-bold"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
          <span>
            {t(
              `مزامنة المعلقات (${pendingCount})`,
              `Synchroniser (${pendingCount})`,
              `Sincronizar (${pendingCount})`
            )}
          </span>
        </Button>
      )}
    </div>
  );
}
