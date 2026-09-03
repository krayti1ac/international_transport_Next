'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { TripOrder } from '@/types/database';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { DriverDeliveryScreen } from '@/features/trips/components/DriverDeliveryScreen';

function DriverDeliveryContent() {
  const searchParams = useSearchParams();
  const tripId = searchParams.get('tripId');
  const { toast } = useToast();
  const supabase = useMemo(() => createClient(), []);

  const [trip, setTrip] = useState<TripOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [tripError, setTripError] = useState<string | null>(null);

  useEffect(() => {
    if (!tripId) return;

    let cancelled = false;

    const fetchTrip = async () => {
      try {
        const { data, error } = await supabase
          .from('trip_orders')
          .select('*')
          .eq('id', parseInt(tripId))
          .single();

        if (cancelled) return;
        if (error) throw error;
        setTrip(data);
      } catch (error) {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : 'لم يتم العثور على الرحلة';
        setTripError(message);
        toast({ title: 'خطأ', description: message, variant: 'destructive' });
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchTrip();

    return () => {
      cancelled = true;
    };
  }, [tripId, supabase, toast]);

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto space-y-6" dir="rtl">
        <Card className="p-8 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary mb-2" />
          <p className="text-muted-foreground">جاري تحميل بيانات الرحلة...</p>
        </Card>
      </div>
    );
  }

  if (!tripId || !trip) {
    return (
      <div className="max-w-2xl mx-auto space-y-6" dir="rtl">
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">{tripError || 'لم يتم تحديد رحلة صالحة'}</p>
        </Card>
      </div>
    );
  }

  return <DriverDeliveryScreen trip={trip} onCancel={() => history.back()} />;
}

export default function DriverDeliveryPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-2xl mx-auto space-y-6" dir="rtl">
          <Card className="p-8 text-center flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-muted-foreground">جاري تحميل بيانات الرحلة...</p>
          </Card>
        </div>
      }
    >
      <DriverDeliveryContent />
    </Suspense>
  );
}
