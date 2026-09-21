'use client';

import React, { useState, useEffect } from 'react';
import { Bell, BellRing, BellOff, ShieldAlert, CheckCircle2, RefreshCw } from 'lucide-react';
import {
  subscribeDriverPushAction,
  unsubscribeDriverPushAction,
} from '../services/push-notifications.actions';
import { getOrCreateDeviceId } from '@/lib/license';
import { useLanguage } from '@/components/language-provider';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function PushSubscriptionManager({ driverId }: { driverId?: number }) {
  const { t, dir } = useLanguage();
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');

  useEffect(() => {
    if (
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator &&
      'PushManager' in window
    ) {
      setIsSupported(true);
      setPermission(Notification.permission);

      navigator.serviceWorker.ready
        .then((reg) => {
          return reg.pushManager.getSubscription();
        })
        .then((sub) => {
          setIsSubscribed(Boolean(sub));
        })
        .catch((err) => {
          console.warn('[PushManager Init Warn]:', err);
        });
    }
  }, []);

  const handleSubscribe = async () => {
    if (!isSupported) return;
    setIsLoading(true);

    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);

      if (perm !== 'granted') {
        alert(
          t(
            'يرجى السماح بصلاحية الإشعارات من إعدادات المتصفح لتلقي تنبيهات المأموريات.',
            'Veuillez autoriser les notifications dans les paramètres du navigateur pour recevoir les alertes.',
            'Por favor permita las notificaciones en la configuración del navegador para recibir alertas.'
          )
        );
        setIsLoading(false);
        return;
      }

      const reg = await navigator.serviceWorker.ready;
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

      if (!vapidKey) {
        throw new Error('مفتاح VAPID العام غير معرّف');
      }

      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey) as unknown as BufferSource,
      });

      const subJson = subscription.toJSON();
      const deviceId = getOrCreateDeviceId();

      if (!subJson.endpoint || !subJson.keys?.p256dh || !subJson.keys?.auth) {
        throw new Error('بيانات الاشتراك غير مكتملة من مزود المتصفح');
      }

      const res = await subscribeDriverPushAction({
        driverId,
        deviceId,
        endpoint: subJson.endpoint,
        p256dh: subJson.keys.p256dh,
        auth: subJson.keys.auth,
        userAgent: navigator.userAgent,
      });

      if (res.success) {
        setIsSubscribed(true);
      } else {
        alert(res.error || t('تعذر حفظ اشتراك الإشعارات', 'Échec de l’enregistrement de l’abonnement', 'Error al registrar suscripción'));
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('Push subscribe error:', msg);
      alert(`${t('فشل تفعيل الإشعارات:', 'Erreur d’activation des notifications :', 'Error al activar notificaciones :')} ${msg}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnsubscribe = async () => {
    setIsLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await sub.unsubscribe();
        await unsubscribeDriverPushAction(sub.endpoint);
        setIsSubscribed(false);
      }
    } catch (err) {
      console.error('Push unsubscribe error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isSupported) {
    return null;
  }

  return (
    <div
      dir={dir}
      className="p-4 bg-card border border-border/70 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm transition-all"
    >
      <div className="flex items-center gap-3.5">
        {isSubscribed ? (
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
            <BellRing className="w-5 h-5 animate-pulse" />
          </div>
        ) : (
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
            <Bell className="w-5 h-5" />
          </div>
        )}
        <div>
          <p className="text-sm font-bold text-foreground">
            {isSubscribed
              ? t('تنبيهات الطوارئ والمأموريات مفعلة', 'Notifications de mission & urgences activées', 'Notificaciones de misión y emergencias activadas')
              : t('تفعيل إشعارات الهاتف الفورية (PWA Push)', 'Activer les notifications push mobiles', 'Activar notificaciones push móviles')}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isSubscribed
              ? t(
                  'ستصلك نبضات التكليف بالرحلات وإنذارات حرارة التبريد واهتزازات الطوارئ حتى والشاشة مقفلة.',
                  'Vous recevrez les assignations de mission et alertes frigo même écran verrouillé.',
                  'Recibirá asignaciones de misión y alertas frigoríficas incluso con la pantalla bloqueada.'
                )
              : t(
                  'فعّل الإشعارات لاستقبال المأموريات الجديدة وإنذارات الطريق فورياً دون الحاجة لفتح التطبيق.',
                  'Activez pour recevoir les missions et alertes de route instantanément sans ouvrir l’app.',
                  'Active para recibir nuevas misiones y alertas de ruta al instante sin abrir la app.'
                )}
          </p>
        </div>
      </div>

      <button
        onClick={isSubscribed ? handleUnsubscribe : handleSubscribe}
        disabled={isLoading}
        className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all shrink-0 flex items-center justify-center gap-1.5 ${
          isSubscribed
            ? 'bg-muted text-foreground hover:bg-muted/80 border border-border/50'
            : 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-md shadow-primary/20'
        }`}
      >
        {isLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
        {isLoading
          ? t('جاري المعالجة...', 'Traitement...', 'Procesando...')
          : isSubscribed
          ? t('إلغاء التفعيل', 'Désactiver', 'Desactivar')
          : t('تفعيل الإشعارات 🔔', 'Activer les notifications 🔔', 'Activar notificaciones 🔔')}
      </button>
    </div>
  );
}

