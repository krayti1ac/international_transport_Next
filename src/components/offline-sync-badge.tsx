'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { getOfflineQueue, processOfflineQueue } from '@/lib/offline-sync';
import { useToast } from '@/hooks/use-toast';

export function OfflineSyncBadge() {
  const [isOnline, setIsOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const { toast } = useToast();

  const updateStatus = () => {
    setIsOnline(navigator.onLine);
    setPendingCount(getOfflineQueue().length);
  };

  useEffect(() => {
    updateStatus();

    const handleOnline = () => {
      updateStatus();
      toast({ title: '🌐 تم استعادة الاتصال بالإنترنت' });
      triggerSync();
    };

    const handleOffline = () => {
      updateStatus();
      toast({
        title: '⚠️ انقطاع الاتصال',
        description: 'الوضع غير المتصل نشط - سيتم حفظ الإيصالات محلياً في هاتفك.',
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
  }, [toast]);

  const triggerSync = async () => {
    if (!navigator.onLine || isSyncing) return;
    const queue = getOfflineQueue();
    if (queue.length === 0) return;

    setIsSyncing(true);
    try {
      const { successCount, failCount } = await processOfflineQueue();
      if (successCount > 0) {
        toast({
          title: '✅ اكتملت المزامنة',
          description: `تم رفع ${successCount} إيصال إلى الخادم بنجاح.`,
        });
      }
      if (failCount > 0) {
        toast({
          title: 'تنبيه',
          description: `فشل مزامنة ${failCount} إيصال، ستتم إعادة المحاولة لاحقاً.`,
          variant: 'destructive',
        });
      }
    } finally {
      setIsSyncing(false);
      updateStatus();
    }
  };

  if (isOnline && pendingCount === 0) {
    return null;
  }

  return (
    <div
      className="fixed bottom-20 left-4 z-40 flex items-center gap-2 bg-background/95 backdrop-blur border border-border shadow-lg p-2 rounded-2xl animate-in fade-in slide-in-from-bottom-4"
      dir="rtl"
    >
      {!isOnline ? (
        <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-rose-500/15 text-rose-600 border border-rose-500/30">
          <WifiOff className="w-3.5 h-3.5 animate-pulse" />
          <span>غير متصل (Offline)</span>
        </span>
      ) : (
        <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-500/15 text-emerald-600 border border-emerald-500/30">
          <Wifi className="w-3.5 h-3.5" />
          <span>متصل</span>
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
          <span>مزامنة المعلقات ({pendingCount})</span>
        </Button>
      )}
    </div>
  );
}
