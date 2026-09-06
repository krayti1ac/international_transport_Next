'use client';

import { useState, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Upload, FileText, AlertCircle, CheckCircle2, Loader2, X, Download } from 'lucide-react';
import { useLanguage } from '@/components/language-provider';
import { parseFileToRows, validateBulkRows, type BulkImportEntityType, type BulkImportResult } from '@/lib/bulk-import';
import type { Truck, Trailer, Client } from '@/types/database';

interface BulkImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  entityType: BulkImportEntityType;
  onSuccess: () => void;
}

export function BulkImportModal({ isOpen, onClose, entityType, onSuccess }: BulkImportModalProps) {
  const { t, dir } = useLanguage();
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<BulkImportResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  const entityLabels: Record<BulkImportEntityType, { title: string; description: string; sampleHeaders: string[] }> = {
    truck: {
      title: t('استيراد جماعي للشاحنات', 'Importation en masse des camions'),
      description: t('استيراد قائمة الشاحنات من ملف Excel أو CSV', 'Importer une liste de camions depuis un fichier Excel ou CSV'),
      sampleHeaders: ['plate_number', 'model', 'status', 'weight_capacity'],
    },
    trailer: {
      title: t('استيراد جماعي للمقطورات', 'Importation en masse des remorques'),
      description: t('استيراد قائمة المقطورات من ملف Excel أو CSV', 'Importer une liste de remorques depuis un fichier Excel ou CSV'),
      sampleHeaders: ['plate_number', 'model', 'status'],
    },
    client: {
      title: t('استيراد جماعي للعملاء', 'Importation en masse des clients'),
      description: t('استيراد قائمة العملاء من ملف Excel أو CSV', 'Importer une liste de clients depuis un fichier Excel ou CSV'),
      sampleHeaders: ['name', 'phone', 'email', 'city', 'address', 'ice', 'client_type', 'currency'],
    },
  };

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await processFile(e.dataTransfer.files[0]);
    }
  }, []);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      await processFile(e.target.files[0]);
    }
  }, []);

  const processFile = async (selectedFile: File) => {
    setLoading(true);
    setImportResult(null);
    setFile(selectedFile);

    try {
      const rows = await parseFileToRows(selectedFile);
      const result = validateBulkRows(rows, entityType);
      setImportResult(result);

      if (result.invalidCount > 0) {
        toast({
          title: t('تم العثور على أخطاء', 'Erreurs détectées'),
          description: t(`${result.invalidCount} صف يحتوي على أخطاء يجب إصلاحها`, `${result.invalidCount} lignes contiennent des erreurs`),
          variant: 'destructive',
        });
      }
    } catch (error: any) {
      toast({
        title: t('خطأ في قراءة الملف', 'Erreur de lecture du fichier'),
        description: error.message,
        variant: 'destructive',
      });
      setFile(null);
    } finally {
      setLoading(false);
    }
  };

  const downloadSample = () => {
    const headers = entityLabels[entityType].sampleHeaders.join(',');
    const sampleRow = entityType === 'client'
      ? ['Example Company', '+212600000000', 'contact@example.com', 'Tanger', 'Address', '12345678', 'export', 'MAD'].join(',')
      : ['12345-A-123', 'Model X', 'active', '25'].join(',');
    const csv = '\uFEFF' + headers + '\r\n' + sampleRow;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `sample_${entityType}s.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleImport = async () => {
    if (!importResult || importResult.validCount === 0) return;

    setImporting(true);
    try {
      const tableName = entityType === 'truck' ? 'trucks' : entityType === 'trailer' ? 'trailers' : 'clients';
      const payload = importResult.validRows.map(row => {
        const data = { ...row.data };
        if (entityType === 'truck' && !data.status) data.status = 'active';
        if (entityType === 'client') {
          if (!data.client_type) data.client_type = 'export';
          if (!data.currency) data.currency = 'MAD';
          if (!data.is_active && data.is_active !== false) data.is_active = true;
        }
        return data;
      });

      const { error } = await supabase.from(tableName).insert(payload);
      if (error) throw error;

      toast({
        title: t('تم الاستيراد بنجاح', 'Importation réussie'),
        description: t(`تم استيراد ${importResult.validCount} سجل بنجاح`, `${importResult.validCount} enregistrements importés avec succès`),
      });

      onSuccess();
      handleClose();
    } catch (error: any) {
      toast({
        title: t('خطأ أثناء الاستيراد', 'Erreur lors de l\'importation'),
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setImporting(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setImportResult(null);
    setLoading(false);
    setImporting(false);
    setDragActive(false);
    onClose();
  };

  const currentEntity = entityLabels[entityType];

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto" dir={dir}>
        <DialogHeader>
          <DialogTitle className="font-amiri text-xl">{currentEntity.title}</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground mt-1">
            {currentEntity.description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {!importResult && !loading && (
            <div className="space-y-3">
              <div
                className={`border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer ${
                  dragActive ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                }`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
                <p className="text-sm font-semibold text-foreground mb-1">
                  {t('اسحب الملف هنا أو انقر للاختيار', 'Glissez le fichier ici ou cliquez pour sélectionner')}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t('يدعم ملفات .xlsx و .csv', 'Formats supportés : .xlsx et .csv')}
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.csv,.txt"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>

              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  {t('الأعمدة المطلوبة:', 'Colonnes requises:')} {entityLabels[entityType].sampleHeaders.join(', ')}
                </p>
                <Button variant="ghost" size="sm" onClick={downloadSample} className="text-xs">
                  <Download className={`w-3.5 h-3.5 ${dir === 'rtl' ? 'ml-1' : 'mr-1'}`} />
                  {t('تحميل نموذج', 'Télécharger modèle')}
                </Button>
              </div>
            </div>
          )}

          {loading && (
            <div className="flex flex-col items-center justify-center py-10">
              <Loader2 className="w-8 h-8 animate-spin text-primary mb-3" />
              <p className="text-sm text-muted-foreground">{t('جاري قراءة الملف...', 'Lecture du fichier...')}</p>
            </div>
          )}

          {importResult && !loading && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-blue-500" />
                    <span className="text-sm font-medium">{file?.name}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="flex items-center gap-1 text-emerald-600">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {importResult.validCount} {t('صالح', 'valides')}
                    </span>
                    {importResult.invalidCount > 0 && (
                      <span className="flex items-center gap-1 text-rose-600">
                        <AlertCircle className="w-3.5 h-3.5" />
                        {importResult.invalidCount} {t('خطأ', 'erreurs')}
                      </span>
                    )}
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => { setImportResult(null); setFile(null); }}>
                  <X className="w-4 h-4" />
                </Button>
              </div>

              {importResult.invalidCount > 0 && (
                <div className="border border-rose-200 dark:border-rose-900 rounded-lg p-3 bg-rose-50 dark:bg-rose-950/30">
                  <p className="text-xs font-semibold text-rose-700 dark:text-rose-300 mb-2">
                    {t('صفوف تحتوي على أخطاء:', 'Lignes avec erreurs:')}
                  </p>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {importResult.invalidRows.map((row, idx) => (
                      <div key={idx} className="text-xs text-rose-600 dark:text-rose-400 bg-white dark:bg-rose-950/20 p-2 rounded border border-rose-100 dark:border-rose-900">
                        <span className="font-mono font-bold">#{row.rowIndex}:</span> {row.errors.join(', ')}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {importResult.validCount > 0 && (
                <div className="border border-emerald-200 dark:border-emerald-900 rounded-lg p-3 bg-emerald-50 dark:bg-emerald-950/30">
                  <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 mb-2">
                    {t('صفوف صالحة للاستيراد:', 'Lignes valides pour importation:')}
                  </p>
                  <div className="max-h-60 overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-emerald-200 dark:border-emerald-900">
                          <th className="py-1.5 px-2 text-start font-semibold text-emerald-700 dark:text-emerald-300">#</th>
                          {Object.keys(importResult.validRows[0]?.data || {}).slice(0, 6).map(key => (
                            <th key={key} className="py-1.5 px-2 text-start font-semibold text-emerald-700 dark:text-emerald-300">{key}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-emerald-100 dark:divide-emerald-900">
                        {importResult.validRows.map((row) => (
                          <tr key={row.rowIndex} className="hover:bg-emerald-50 dark:hover:bg-emerald-950/20">
                            <td className="py-1.5 px-2 font-mono text-emerald-600">{row.rowIndex}</td>
                            {Object.values(row.data).slice(0, 6).map((val, i) => (
                              <td key={i} className="py-1.5 px-2 text-emerald-900 dark:text-emerald-100 max-w-[150px] truncate">{String(val ?? '')}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-3 border-t border-border/50">
                <Button variant="outline" onClick={handleClose} disabled={importing} className="flex-1">
                  {t('إلغاء', 'Annuler')}
                </Button>
                {importResult.validCount > 0 && (
                  <Button onClick={handleImport} disabled={importing} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white">
                    {importing ? <Loader2 className={`w-4 h-4 animate-spin ${dir === 'rtl' ? 'ml-2' : 'mr-2'}`} /> : <CheckCircle2 className={`w-4 h-4 ${dir === 'rtl' ? 'ml-2' : 'mr-2'}`} />}
                    {t('تأكيد الاستيراد', 'Confirmer l\'importation')} ({importResult.validCount})
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
