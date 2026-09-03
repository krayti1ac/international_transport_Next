'use client';

import { useState, useEffect, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { DeliverySignature } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { FileText, Download, MapPin, User, Clock, ExternalLink } from 'lucide-react';

interface PodReportViewProps {
  tripOrderId: number;
}

export function PodReportView({ tripOrderId }: PodReportViewProps) {
  const [delivery, setDelivery] = useState<DeliverySignature | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const fetchDelivery = async () => {
      try {
        const { data, error } = await supabase
          .from('delivery_signatures')
          .select('*')
          .eq('trip_order_id', tripOrderId)
          .maybeSingle();

        if (error) throw error;
        setDelivery(data as DeliverySignature | null);
      } catch (error) {
        toast({ title: 'خطأ', description: error instanceof Error ? error.message : 'حدث خطأ غير متوقع', variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    };

    fetchDelivery();

    channel = supabase
      .channel(`pod-${tripOrderId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'delivery_signatures', filter: `trip_order_id=eq.${tripOrderId}` },
        (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            setDelivery(payload.new as DeliverySignature);
          } else if (payload.eventType === 'DELETE') {
            setDelivery(null);
          }
        }
      )
      .subscribe();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [supabase, tripOrderId, toast]);

  const handleViewPdf = () => {
    const origin = window.location.origin;
    const pdfUrl = `${origin}/api/pod/pdf?tripOrderId=${tripOrderId}`;
    window.open(pdfUrl, '_blank', 'noopener,noreferrer');
  };

  if (loading) {
    return (
      <Card className="p-6 text-center">
        <p className="text-muted-foreground">جاري تحميل بيانات إثبات التسليم...</p>
      </Card>
    );
  }

  if (!delivery) {
    return (
      <Card className="p-6 text-center border-dashed">
        <FileText className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
        <p className="text-muted-foreground">لا يوجد إثبات تسليم مسجل لهذه الرحلة بعد</p>
      </Card>
    );
  }

  const mapsUrl = delivery.latitude && delivery.longitude
    ? `https://www.google.com/maps/search/?api=1&query=${delivery.latitude},${delivery.longitude}`
    : null;

  return (
    <Card className="border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-amiri text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
          <FileText className="w-5 h-5" />
          إثبات التسليم الرقمي (POD)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-muted-foreground" />
            <span className="text-muted-foreground">المستلم:</span>
            <span className="font-medium text-foreground">{delivery.signed_by}</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <span className="text-muted-foreground">تاريخ التوقيع:</span>
            <span className="font-medium text-foreground">{new Date(delivery.signed_at).toLocaleString('ar-MA')}</span>
          </div>
          {mapsUrl && (
            <div className="flex items-center gap-2 sm:col-span-2">
              <MapPin className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground">الموقع:</span>
              <a
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline flex items-center gap-1"
              >
                {delivery.latitude?.toFixed(5)}, {delivery.longitude?.toFixed(5)}
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg overflow-hidden border border-border bg-white dark:bg-slate-950">
            <p className="text-xs text-muted-foreground px-2 pt-2">التوقيع</p>
            <img src={delivery.signature_url} alt="Signature" className="w-full h-32 object-contain p-2" />
          </div>
          {delivery.cmr_image_url && (
            <div className="rounded-lg overflow-hidden border border-border bg-white dark:bg-slate-950">
              <p className="text-xs text-muted-foreground px-2 pt-2">صورة CMR</p>
              <img src={delivery.cmr_image_url} alt="CMR" className="w-full h-32 object-cover" />
            </div>
          )}
        </div>

        <Button onClick={handleViewPdf} className="w-full" variant="default">
          <Download className="w-4 h-4 ml-2" />
          تحميل إثبات التسليم (PDF)
        </Button>
      </CardContent>
    </Card>
  );
}
