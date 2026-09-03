'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { saveFleetDocument } from '@/features/fleet/services/fleet-documents.actions';
import { DOCUMENT_TYPE_LABELS, CORE_DOC_TYPES } from '@/features/fleet/services/fleet-documents.constants';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Upload, FileText, Calendar, DollarSign, RefreshCw, Truck, Check } from 'lucide-react';
import type { FleetDocument, Truck as TruckType, Trailer as TrailerType } from '@/types/database';
import { DEFAULT_TRUCKS, DEFAULT_TRAILERS, fallbackArray } from '@/lib/default-data';

interface DocumentUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  trucks: TruckType[];
  trailers: TrailerType[];
  initialVehicle?: { type: 'truck' | 'trailer'; id: number; plate: string } | null;
  initialDocType?: string | null;
  editingDoc?: FleetDocument | null;
}

export function DocumentUploadModal({
  isOpen,
  onClose,
  onSuccess,
  trucks: rawTrucks,
  trailers: rawTrailers,
  initialVehicle,
  initialDocType,
  editingDoc,
}: DocumentUploadModalProps) {
  const trucks = fallbackArray(rawTrucks, DEFAULT_TRUCKS);
  const trailers = fallbackArray(rawTrailers, DEFAULT_TRAILERS);

  const [entityType, setEntityType] = useState<'truck' | 'trailer'>('truck');
  const [entityId, setEntityId] = useState<string>('');
  const [documentType, setDocumentType] = useState<string>('insurance');
  const [documentNumber, setDocumentNumber] = useState('');
  const [issueDate, setIssueDate] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [cost, setCost] = useState('');
  const [currency, setCurrency] = useState('MAD');
  const [notes, setNotes] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const { toast } = useToast();
  const supabase = createClient();

  useEffect(() => {
    if (editingDoc) {
      setEntityType((editingDoc.entity_type as 'truck' | 'trailer') || 'truck');
      setEntityId(String(editingDoc.entity_id));
      setDocumentType(editingDoc.document_type || 'insurance');
      setDocumentNumber(editingDoc.document_number || '');
      setIssueDate(editingDoc.issue_date || '');
      setExpiryDate(editingDoc.expiry_date || '');
      setCost(editingDoc.cost ? String(editingDoc.cost) : '');
      setCurrency(editingDoc.currency || 'MAD');
      setNotes(editingDoc.notes || '');
    } else if (initialVehicle) {
      setEntityType(initialVehicle.type);
      setEntityId(String(initialVehicle.id));
      if (initialDocType) setDocumentType(initialDocType);
    } else {
      if (trucks.length > 0 && !entityId) {
        setEntityId(String(trucks[0].id));
      }
    }
  }, [editingDoc, initialVehicle, initialDocType, trucks, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!entityId || !documentType) {
      toast({ title: 'يرجى اختيار المركبة ونوع الوثيقة', variant: 'destructive' });
      return;
    }

    setUploading(true);
    try {
      let fileUrl = editingDoc?.file_url;

      // If a new file is uploaded
      if (file) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${entityType}-${entityId}-${documentType}-${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage.from('fleet-documents').upload(fileName, file, {
          cacheControl: '3600',
          upsert: true,
        });

        if (uploadError) {
          console.warn('Storage upload error (fallback to path):', uploadError);
        } else {
          const { data } = supabase.storage.from('fleet-documents').getPublicUrl(fileName);
          fileUrl = data.publicUrl;
        }
      }

      const res = await saveFleetDocument({
        id: editingDoc?.id,
        entityType,
        entityId: Number(entityId),
        documentType,
        documentNumber,
        issueDate: issueDate || undefined,
        expiryDate: expiryDate || undefined,
        cost: parseFloat(cost) || 0,
        currency,
        fileUrl,
        notes,
      });

      if (!res.success) throw new Error(res.error);

      toast({
        title: editingDoc ? 'تم تعديل الوثيقة بنجاح' : 'تم إضافة الوثيقة وتثبيتها بنجاح',
      });

      onSuccess();
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'فشل في حفظ الوثيقة';
      toast({ title: 'خطأ', description: msg, variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wide mb-1">
            <FileText className="w-4 h-4 text-blue-500" />
            <span>إدارة وثائق الأسطول</span>
          </div>
          <DialogTitle className="font-amiri text-xl">
            {editingDoc ? 'تعديل وثيقة مسجلة' : 'إضافة وثيقة جديدة للأسطول'}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            تسجيل وتحديث وثائق الشاحنات والمقطورات مع تواريخ الصلاحية والتنبيهات.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2 text-sm">
          {/* Vehicle Type & Selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">نوع المركبة</label>
              <Select
                value={entityType}
                onValueChange={(val: 'truck' | 'trailer') => {
                  setEntityType(val);
                  if (val === 'truck' && trucks.length > 0) setEntityId(String(trucks[0].id));
                  if (val === 'trailer' && trailers.length > 0) setEntityId(String(trailers[0].id));
                }}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="truck">🚛 رأس شاحنة (Tracteur)</SelectItem>
                  <SelectItem value="trailer">🚚 مقطورة (Remorque)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">المركبة / الترقيم</label>
              <Select value={entityId} onValueChange={setEntityId}>
                <SelectTrigger className="rounded-xl font-mono">
                  <SelectValue placeholder="اختر المركبة" />
                </SelectTrigger>
                <SelectContent>
                  {entityType === 'truck'
                    ? trucks.map((t) => (
                        <SelectItem key={t.id} value={String(t.id)}>
                          {t.plate_number} {t.model ? `(${t.model})` : ''}
                        </SelectItem>
                      ))
                    : trailers.map((tr) => (
                        <SelectItem key={tr.id} value={String(tr.id)}>
                          {tr.plate_number} {tr.model ? `(${tr.model})` : ''}
                        </SelectItem>
                      ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Document Type & Number */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">نوع الوثيقة</label>
              <Select value={documentType} onValueChange={setDocumentType}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CORE_DOC_TYPES.map((typeKey) => (
                    <SelectItem key={typeKey} value={typeKey}>
                      {DOCUMENT_TYPE_LABELS[typeKey]?.label_ar || typeKey}
                    </SelectItem>
                  ))}
                  <SelectItem value="other">وثيقة أخرى</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">رقم الوثيقة / العقد (اختياري)</label>
              <Input
                type="text"
                placeholder="مثال: POL-2026-991"
                value={documentNumber}
                onChange={(e) => setDocumentNumber(e.target.value)}
                className="rounded-xl font-mono text-xs"
              />
            </div>
          </div>

          {/* Issue Date & Expiry Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                تاريخ الإصدار
              </label>
              <Input
                type="date"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
                className="rounded-xl font-mono text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-blue-500" />
                تاريخ انتهاء الصلاحية
              </label>
              <Input
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                className="rounded-xl font-mono text-sm"
              />
            </div>
          </div>

          {/* Cost & Currency */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                <DollarSign className="w-3.5 h-3.5" />
                تكلفة الوثيقة / التأمين
              </label>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
                className="rounded-xl font-mono text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">العملة</label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MAD">MAD (درهم)</SelectItem>
                  <SelectItem value="EUR">EUR (يورو)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* File Upload Attachment */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Upload className="w-3.5 h-3.5 text-indigo-500" />
              مرفق الوثيقة (PDF / صورة)
            </label>
            <Input
              type="file"
              accept=".pdf,image/*"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="rounded-xl text-xs cursor-pointer"
            />
            {editingDoc?.file_url && !file && (
              <p className="text-[11px] text-muted-foreground">
                يوجد ملف مرفق حالياً:{' '}
                <a
                  href={editingDoc.file_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary underline font-medium"
                >
                  معاينة الملف الحالي
                </a>
              </p>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground">ملاحظات إضافية</label>
            <Input
              type="text"
              placeholder="مثال: تأمين شامل مع المساعدة على الطريق الدولية"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="rounded-xl text-xs"
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-border/50">
            <Button type="button" variant="ghost" onClick={onClose} disabled={uploading} className="rounded-xl">
              إلغاء
            </Button>
            <Button
              type="submit"
              disabled={uploading}
              className="rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 shadow-md font-medium"
            >
              {uploading ? (
                <RefreshCw className="w-4 h-4 ml-1.5 animate-spin" />
              ) : (
                <Check className="w-4 h-4 ml-1.5" />
              )}
              {editingDoc ? 'حفظ التعديلات' : 'حفظ وتثبيت الوثيقة'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

