'use client';

import { useState, useEffect, useMemo } from 'react';
import { createClient } from '@/lib/supabase/browser';
import type { TripOrder, Advance, Driver } from '@/types/database';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/components/language-provider';
import { MapPin, Fuel, FileText, CheckCircle } from 'lucide-react';
import Decimal from 'decimal.js';

export default function DriverTasksPage() {
  const { t, dir } = useLanguage();
  const [trips, setTrips] = useState<TripOrder[]>([]);
  const [advances, setAdvances] = useState<Advance[]>([]);
  const [driver, setDriver] = useState<Driver | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const init = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) return;

        const { data: driverData, error: driverError } = await supabase
          .from('drivers')
          .select('*')
          .eq('user_id', session.user.id)
          .single<Driver>();

        if (driverError || !driverData) {
          toast({
            title: t('خطأ', 'Erreur'),
            description: t('لم يتم العثور على ملف السائق المرتبط بهذا الحساب', 'Profil conducteur introuvable pour ce compte'),
            variant: 'destructive',
          });
          setLoading(false);
          return;
        }

        setDriver(driverData);

        const [tripsRes, advancesRes] = await Promise.all([
          supabase.from('trip_orders').select('*').eq('driver_id', driverData.id).order('departure_date', { ascending: false }),
          supabase.from('advances').select('*').eq('driver_id', driverData.id).order('date', { ascending: false }),
        ]);

        if (tripsRes.error) throw tripsRes.error;
        
        let advancesData: Advance[] = [];
        if (!advancesRes.error && advancesRes.data) {
          advancesData = advancesRes.data;
        } else {
          // Fallback to ordering by created_at if date does not exist
          const fallbackAdv = await supabase
            .from('advances')
            .select('*')
            .eq('driver_id', driverData.id)
            .order('created_at', { ascending: false });
          advancesData = fallbackAdv.data || [];
        }

        setTrips(tripsRes.data || []);
        setAdvances(advancesData);

        channel = supabase
          .channel(`driver-tasks-${driverData.id}`)
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'trip_orders',
              filter: `driver_id=eq.${driverData.id}`,
            },
            (payload) => {
              if (payload.eventType === 'INSERT') {
                const newTrip = payload.new as TripOrder;
                setTrips((prev) => [newTrip, ...prev]);
                toast({ title: t('تم إسناد رحلة جديدة لك!', 'Un nouveau voyage vous a été assigné !') });
              } else if (payload.eventType === 'UPDATE') {
                const updated = payload.new as TripOrder;
                setTrips((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
              }
            }
          )
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'advances',
              filter: `driver_id=eq.${driverData.id}`,
            },
            (payload) => {
              if (payload.eventType === 'INSERT') {
                setAdvances((prev) => [payload.new as Advance, ...prev]);
              } else if (payload.eventType === 'UPDATE') {
                const updated = payload.new as Advance;
                setAdvances((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
                toast({ title: t('تم تحديث حالة السلفة', 'Statut de l’avance mis à jour') });
              }
            }
          )
          .subscribe();
      } catch (error: any) {
        const message = error?.message || (error instanceof Error ? error.message : t('حدث خطأ غير متوقع', 'Une erreur inattendue est survenue'));
        toast({
          title: t('خطأ', 'Erreur'),
          description: message,
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    init();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [supabase, toast, t]);

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return t('قيد الانتظار', 'En attente');
      case 'in_transit': return t('في الطريق', 'En route');
      case 'completed': return t('مكتمل', 'Terminé');
      case 'cancelled': return t('ملغي', 'Annulé');
      default: return status;
    }
  };

  const getAdvanceStatusText = (status: string) => {
    switch (status) {
      case 'approved': return t('معتمد', 'Approuvé');
      case 'pending': return t('قيد الانتظار', 'En attente');
      case 'settled': return t('مسوى', 'Régularisé');
      case 'rejected': return t('مرفوض', 'Rejeté');
      default: return status;
    }
  };

  return (
    <div className="space-y-6" dir={dir}>
      <div>
        <h1 className="text-2xl font-bold font-amiri text-foreground">
          {t('مهامي وجدول الرحلات', 'Mes Missions & Planning Chauffeur')}
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {t('متابعة مسار الرحلات النشطة، وثائق CMR وسجل السلف الشخصية', 'Suivi de vos voyages actifs, documents CMR et historique des acomptes')}
        </p>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">{t('جاري تحميل البيانات...', 'Chargement des données...')}</p>
        </div>
      ) : (
        <>
          <div className="space-y-4">
            <h2 className="text-lg font-bold font-amiri text-foreground flex items-center gap-2">
              <MapPin className="w-5 h-5 text-primary" />
              {t('الرحلات المخصصة', 'Voyages assignés')}
            </h2>
            {trips.length === 0 ? (
              <Card className="p-8 text-center">
                <p className="text-muted-foreground">{t('لا توجد رحلات مخصصة لك حالياً', 'Aucun voyage assigné pour le moment')}</p>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {trips.map((trip) => (
                  <Card key={trip.id} className="hover:shadow-md transition-shadow">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg font-amiri text-foreground">{trip.route}</CardTitle>
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          trip.status === 'in_transit'
                            ? 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/25'
                            : trip.status === 'completed'
                            ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25'
                            : 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/25'
                        }`}>
                          {getStatusText(trip.status)}
                        </span>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">{t('تاريخ الانطلاق:', 'Date de départ :')}</span>
                          <span className="font-medium text-foreground">{trip.departure_date}</span>
                        </div>
                        {trip.cmr_number && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">{t('رقم CMR:', 'N° CMR :')}</span>
                            <span className="font-medium font-mono text-foreground" dir="ltr">{trip.cmr_number}</span>
                          </div>
                        )}
                      </div>
                      <div className="mt-3 pt-3 border-t border-border">
                        <Button
                          size="sm"
                          variant="default"
                          className="w-full"
                          asChild
                        >
                          <a href={`/driver-delivery?tripId=${trip.id}`}>
                            <CheckCircle className={`w-3.5 h-3.5 ${dir === 'rtl' ? 'ml-1.5' : 'mr-1.5'}`} />
                            {t('تأكيد التسليم', 'Confirmer la livraison')}
                          </a>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-4 pt-4">
            <h2 className="text-lg font-bold font-amiri text-foreground flex items-center gap-2">
              <Fuel className="w-5 h-5 text-primary" />
              {t('السلف الأخيرة', 'Dernières avances perçues')}
            </h2>
            {advances.length === 0 ? (
              <Card className="p-8 text-center">
                <p className="text-muted-foreground">{t('لا توجد سلف مسجلة', 'Aucune avance enregistrée')}</p>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {advances.slice(0, 5).map((advance) => (
                  <Card key={advance.id} className="hover:shadow-md transition-shadow">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base font-amiri flex items-center gap-2 text-foreground">
                          <FileText className="w-4 h-4 text-primary" />
                          {t(`سلفة #${advance.id}`, `Avance #${advance.id}`)}
                        </CardTitle>
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          advance.status === 'approved'
                            ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25'
                            : advance.status === 'pending'
                            ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/25'
                            : 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/25'
                        }`}>
                          {getAdvanceStatusText(advance.status)}
                        </span>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">{t('المبلغ:', 'Montant :')}</span>
                          <span className="font-bold text-primary font-mono">
                            {new Decimal(advance.amount || 0).toFixed(2)} {advance.currency}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">{t('التاريخ:', 'Date :')}</span>
                          <span className="font-medium text-foreground">{advance.date}</span>
                        </div>
                        {advance.reason && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">{t('السبب:', 'Motif :')}</span>
                            <span className="font-medium text-foreground">{advance.reason}</span>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
