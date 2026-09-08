'use client';

import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { UploadCloud, FileSpreadsheet, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { readExcelFile, validateClientsImport, validateTrucksImport, type ImportedClient, type ImportedTruck } from '@/lib/excel-importer';
import { bulkInsertClients, bulkInsertTrucks, bulkInsertTrailers } from '@/lib/bulk-import.actions';
import * as XLSX from 'xlsx';

export type BulkImportEntity = 'clients' | 'trucks' | 'client' | 'truck' | 'trailer';

interface BulkImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  entityType: BulkImportEntity;
  onSuccess: () => void;
}

export function BulkImportModal({ isOpen, onClose, entityType, onSuccess }: BulkImportModalProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  
  const [validData, setValidData] = useState<unknown[]>([]);
  const [errors, setErrors] = useState<{ row: number; reasons: string[] }[]>([]);
  const [totalRows, setTotalRows] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const isClient = entityType === 'clients' || entityType === 'client';
  const isTruck = entityType === 'trucks' || entityType === 'truck';
  const isTrailer = entityType === 'trailer';

  const entityTitle = isClient 
    ? 'العملاء' 
    : isTruck 
      ? 'الشاحنات' 
      : 'المقطورات';

  const handleReset = () => {
    setValidData([]);
    setErrors([]);
    setTotalRows(0);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const processFile = async (file: File) => {
    setIsProcessing(true);
    handleReset();

    try {
      const rawData = await readExcelFile(file);
      
      let validationResult;
      if (isClient) {
        validationResult = validateClientsImport(rawData);
      } else {
        // Both trucks and trailers share plate_number/model/status layout
        validationResult = validateTrucksImport(rawData);
      }

      setValidData(validationResult.validData);
      setErrors(validationResult.errors);
      setTotalRows(validationResult.totalRows);

      if (validationResult.errors.length > 0) {
        toast({
          title: 'يوجد أخطاء في بعض الصفوف',
          description: `تم العثور على أخطاء في ${validationResult.errors.length} صف تم استبعادها.`,
          variant: 'destructive',
        });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'خطأ في قراءة الملف';
      toast({ title: 'خطأ في قراءة الملف', description: message, variant: 'destructive' });
    } finally {
      setIsProcessing(false);
    }
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => setIsDragging(false);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  };

  const onFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleImport = async () => {
    if (validData.length === 0) return;
    setIsUploading(true);

    try {
      if (isClient) {
        await bulkInsertClients(validData as ImportedClient[]);
      } else if (isTruck) {
        await bulkInsertTrucks(validData as ImportedTruck[]);
      } else if (isTrailer) {
        await bulkInsertTrailers(validData as { plate_number: string; model?: string; status?: string }[]);
      }

      toast({ title: `✅ تم استيراد ${validData.length} سجل بنجاح.` });
      onSuccess();
      onClose();
      handleReset();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'فشل الاستيراد';
      toast({ title: 'فشل الاستيراد', description: message, variant: 'destructive' });
    } finally {
      setIsUploading(false);
    }
  };

  const downloadTemplate = () => {
    const templateData = isClient 
      ? [{ 'الاسم': 'شركة النقل السريع', 'الهاتف': '+212600000000', 'ICE': '001928374000082', 'النوع': 'export', 'العملة': 'MAD', 'العنوان': 'طنجة المتوسط' }]
      : [{ 'رقم اللوحة': '12345-أ-50', 'العلامة التجارية': 'Volvo', 'الموديل': 'FH 500', 'الحالة': 'active' }];
    
    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template');
    XLSX.writeFile(wb, `${entityType}_template.xlsx`);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); handleReset(); }}>
      <DialogContent className="sm:max-w-xl" dir="rtl">
        <DialogHeader>
          <DialogTitle className="font-amiri text-xl flex items-center justify-between">
            <span>استيراد {entityTitle} جماعياً</span>
            <Button variant="ghost" size="sm" onClick={downloadTemplate} className="text-blue-600 text-xs gap-1.5">
              <FileSpreadsheet className="w-4 h-4" />
              تحميل القالب الفارغ
            </Button>
          </DialogTitle>
        </DialogHeader>

        {!validData.length && !errors.length && !isProcessing && (
          <div
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            className={`mt-4 border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center text-center transition-colors cursor-pointer ${
              isDragging ? 'border-primary bg-primary/5' : 'border-slate-300 dark:border-slate-700 hover:border-primary/50 hover:bg-slate-50 dark:hover:bg-slate-900/50'
            }`}
            onClick={() => fileInputRef.current?.click()}
          >
            <input type="file" ref={fileInputRef} onChange={onFileSelect} accept=".xlsx,.xls,.csv" className="hidden" />
            <UploadCloud className={`w-12 h-12 mb-4 ${isDragging ? 'text-primary' : 'text-slate-400'}`} />
            <p className="text-sm font-medium text-foreground">اسحب وأفلت ملف Excel هنا</p>
            <p className="text-xs text-muted-foreground mt-1">أو اضغط لاختيار ملف من جهازك (.xlsx, .csv)</p>
          </div>
        )}

        {isProcessing && (
          <div className="py-12 flex flex-col items-center justify-center">
            <Loader2 className="w-8 h-8 text-primary animate-spin mb-4" />
            <p className="text-sm text-muted-foreground">جاري تحليل البيانات والتحقق من صحتها...</p>
          </div>
        )}

        {(validData.length > 0 || errors.length > 0) && !isProcessing && (
          <div className="mt-4 space-y-4">
            <div className="flex gap-4 p-4 bg-muted/40 rounded-xl border border-border">
              <div className="flex-1 text-center">
                <p className="text-2xl font-bold text-foreground font-mono">{totalRows}</p>
                <p className="text-xs text-muted-foreground">إجمالي الصفوف</p>
              </div>
              <div className="flex-1 text-center border-r border-border">
                <p className="text-2xl font-bold text-emerald-600 font-mono">{validData.length}</p>
                <p className="text-xs text-emerald-600/80">صفوف صالحة للاستيراد</p>
              </div>
              <div className="flex-1 text-center border-r border-border">
                <p className="text-2xl font-bold text-rose-600 font-mono">{errors.length}</p>
                <p className="text-xs text-rose-600/80">صفوف بها أخطاء</p>
              </div>
            </div>

            {errors.length > 0 && (
              <div className="border border-rose-200 dark:border-rose-900/50 rounded-xl overflow-hidden">
                <div className="bg-rose-50 dark:bg-rose-950/40 px-3 py-2 flex items-center text-rose-700 dark:text-rose-300 text-sm font-semibold">
                  <AlertCircle className="w-4 h-4 ml-2" />
                  تفاصيل الأخطاء (لن يتم استيرادها)
                </div>
                <div className="max-h-40 overflow-y-auto bg-card p-3 space-y-2">
                  {errors.map((err, i) => (
                    <div key={i} className="text-xs bg-rose-50/50 dark:bg-rose-950/20 p-2 rounded-lg border border-rose-200/50 dark:border-rose-900/30">
                      <span className="font-bold text-rose-700 dark:text-rose-300">صف {err.row}:</span>
                      <ul className="list-disc list-inside mt-1 text-muted-foreground">
                        {err.reasons.map((r, idx) => <li key={idx}>{r}</li>)}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={handleReset}>إلغاء واختيار ملف آخر</Button>
              <Button onClick={handleImport} disabled={validData.length === 0 || isUploading} className="min-w-[140px]">
                {isUploading ? (
                  <><Loader2 className="w-4 h-4 ml-2 animate-spin" /> جاري الحفظ...</>
                ) : (
                  <><CheckCircle2 className="w-4 h-4 ml-2" /> استيراد ({validData.length}) سجل</>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
