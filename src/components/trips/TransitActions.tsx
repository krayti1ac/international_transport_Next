'use client';

import { useState, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Upload, MessageCircle, Ship, FileText, CheckCircle, XCircle } from 'lucide-react';
import type { TripOrder } from '@/types/database';
import { generateWhatsAppLink } from '@/lib/utils/whatsapp-links';

interface TransitActionsProps {
  trip: TripOrder;
  onUpdate: (updatedTrip: TripOrder) => void;
  truckPlate?: string;
  trailerPlate?: string;
  ferryPhone?: string;
}

type DocumentType = 'cmr_export' | 'facture' | 'phyto' | 'mrn_export' | 'cmr_import';

const DOCUMENT_LABELS: Record<string, { label: string; field: keyof TripOrder }> = {
  cmr_export: { label: 'CMR Export', field: 'cmr_export_url' },
  facture: { label: 'Facture', field: 'facture_url' },
  phyto: { label: 'Phytosanitaire', field: 'phyto_url' },
  mrn_export: { label: 'MRN / DUM Export', field: 'mrn_export_url' },
  cmr_import: { label: 'CMR Import', field: 'cmr_import_url' },
};

export function TransitActions({ trip, onUpdate, truckPlate, trailerPlate, ferryPhone }: TransitActionsProps) {
  const [uploading, setUploading] = useState<string | null>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const { toast } = useToast();
  const supabase = createClient();

  const handleFileUpload = async (docType: DocumentType, file: File) => {
    setUploading(docType);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${trip.id}/${docType}_${Date.now()}.${fileExt}`; // eslint-disable-line react-hooks/purity
      const { error: uploadError } = await supabase.storage
        .from('trip-documents')
        .upload(fileName, file, { contentType: file.type, upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('trip-documents')
        .getPublicUrl(fileName);

      const field = DOCUMENT_LABELS[docType].field;
      const { error: updateError } = await supabase
        .from('trip_orders')
        .update({ [field]: publicUrl })
        .eq('id', trip.id);

      if (updateError) throw updateError;

      onUpdate({ ...trip, [field]: publicUrl });
      toast({ title: `تم رفع ${DOCUMENT_LABELS[docType].label} بنجاح` });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'حدث خطأ غير متوقع';
      toast({
        title: 'خطأ في رفع الملف',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setUploading(null);
    }
  };

  const handleFerryWhatsApp = () => {
    const phone = ferryPhone || '';
    const link = generateWhatsAppLink(phone, 'ferry', {
      truck_plate: truckPlate || '',
      trailer_plate: trailerPlate || '',
      ferry_company: trip.ferry_company || undefined,
      mrn_export_url: trip.mrn_export_url || undefined,
    });
    window.open(link, '_blank');
  };

  const handleTransitExportWhatsApp = () => {
    const link = generateWhatsAppLink('', 'transit_export', {
      truck_plate: truckPlate || '',
      trailer_plate: trailerPlate || '',
      cmr_export_url: trip.cmr_export_url || undefined,
      facture_url: trip.facture_url || undefined,
    });
    window.open(link, '_blank');
  };

  return (
    <div className="space-y-4" dir="rtl">
      <h3 className="font-amiri text-lg font-bold text-foreground flex items-center gap-2">
        <Ship className="w-5 h-5 text-primary" />
        إجراءات العبّارة والجمرك
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-foreground flex items-center gap-2">
              <FileText className="w-4 h-4 text-emerald-600" />
              جمرك التصدير (Export Customs)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(Object.keys(DOCUMENT_LABELS) as DocumentType[]).map((key) => {
              if (!['cmr_export', 'facture', 'phyto'].includes(key)) return null;
              const doc = DOCUMENT_LABELS[key];
              const url = trip[doc.field] as string | undefined;
              return (
                <div key={key} className="flex items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground">{doc.label}</span>
                  <div className="flex items-center gap-2">
                    {url ? (
                      <a href={url} target="_blank" rel="noopener noreferrer" className="text-emerald-600 hover:text-emerald-700">
                        <CheckCircle className="w-4 h-4" />
                      </a>
                    ) : (
                      <XCircle className="w-4 h-4 text-muted-foreground" />
                    )}
                    <input
                      type="file"
                      accept="application/pdf,image/*"
                      className="hidden"
                      ref={(el) => { fileInputRefs.current[key] = el; }}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileUpload(key, file);
                      }}
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={() => fileInputRefs.current[key]?.click()}
                      disabled={uploading === key}
                    >
                      {uploading === key ? (
                        <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin ml-1" />
                      ) : (
                        <Upload className="w-3 h-3 ml-1" />
                      )}
                      {url ? 'تغيير' : 'رفع'}
                    </Button>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-foreground flex items-center gap-2">
              <Ship className="w-4 h-4 text-blue-600" />
              حجز العبّارة (Ferry Booking)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground">MRN / DUM</span>
              <div className="flex items-center gap-2">
                {trip.mrn_export_url ? (
                  <a href={trip.mrn_export_url} target="_blank" rel="noopener noreferrer" className="text-emerald-600 hover:text-emerald-700">
                    <CheckCircle className="w-4 h-4" />
                  </a>
                ) : (
                  <XCircle className="w-4 h-4 text-muted-foreground" />
                )}
                <input
                  type="file"
                  accept="application/pdf,image/*"
                  className="hidden"
                  ref={(el) => { fileInputRefs.current['mrn_export'] = el; }}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileUpload('mrn_export', file);
                  }}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={() => fileInputRefs.current['mrn_export']?.click()}
                  disabled={uploading === 'mrn_export'}
                >
                  {uploading === 'mrn_export' ? 'جاري...' : 'رفع MRN'}
                </Button>
              </div>
            </div>
            <Button
              type="button"
              size="sm"
              className="w-full flex items-center justify-center gap-2 text-xs"
              onClick={handleFerryWhatsApp}
            >
              <MessageCircle className="w-3.5 h-3.5" />
              واتساب العبّارة
            </Button>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-foreground flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-600" />
              جمرك الاستيراد (Import Customs)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(Object.keys(DOCUMENT_LABELS) as DocumentType[]).map((key) => {
              if (!['cmr_import'].includes(key)) return null;
              const doc = DOCUMENT_LABELS[key];
              const url = trip[doc.field] as string | undefined;
              return (
                <div key={key} className="flex items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground">{doc.label}</span>
                  <div className="flex items-center gap-2">
                    {url ? (
                      <a href={url} target="_blank" rel="noopener noreferrer" className="text-emerald-600 hover:text-emerald-700">
                        <CheckCircle className="w-4 h-4" />
                      </a>
                    ) : (
                      <XCircle className="w-4 h-4 text-muted-foreground" />
                    )}
                    <input
                      type="file"
                      accept="application/pdf,image/*"
                      className="hidden"
                      ref={(el) => { fileInputRefs.current[key] = el; }}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileUpload(key, file);
                      }}
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={() => fileInputRefs.current[key]?.click()}
                      disabled={uploading === key}
                    >
                      {uploading === key ? 'جاري...' : 'رفع'}
                    </Button>
                  </div>
                </div>
              );
            })}
            <Button
              type="button"
              size="sm"
              className="w-full flex items-center justify-center gap-2 text-xs mt-2"
              onClick={handleTransitExportWhatsApp}
            >
              <MessageCircle className="w-3.5 h-3.5" />
              واتساب الترانزيت
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
