'use client';

import { useCallback, useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { useLanguage } from '@/components/language-provider';
import { parseExcelFile, validateRows, validateICE, validateMoroccanPlate, validateEmail, validatePhone, type BulkImportResult, type ValidationOptions } from '@/lib/excel-importer';
import { importClientsAction, importTrucksAction, importTrailersAction, type BulkImportResponse } from '@/lib/bulk-import.actions';
import { useToast } from '@/hooks/use-toast';
import { AlertTriangle, CheckCircle2, Download, Upload, X, FileSpreadsheet, Loader2, ShieldCheck } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

type ImportEntity = 'clients' | 'trucks' | 'trailers';

interface BulkImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  entityType?: 'client' | 'truck' | 'trailer';
  onSuccess?: () => void;
}

const ENTITY_LABELS: Record<ImportEntity, { ar: string; fr: string; es: string }> = {
  clients: { ar: 'عملاء', fr: 'Clients', es: 'Clientes' },
  trucks: { ar: 'شاحنات', fr: 'Camions', es: 'Camiones' },
  trailers: { ar: 'مقطورات', fr: 'Remorques', es: 'Remolques' },
};

const SAMPLE_HEADERS: Record<ImportEntity, string[]> = {
  clients: ['name', 'phone', 'email', 'address', 'city', 'ice'],
  trucks: ['plate_number', 'model', 'status', 'address'],
  trailers: ['plate_number', 'model', 'status'],
};

const REQUIRED_FIELDS: Record<ImportEntity, string[]> = {
  clients: ['name', 'phone', 'ice'],
  trucks: ['plate_number', 'model'],
  trailers: ['plate_number', 'model'],
};

const VALIDATORS: Record<ImportEntity, ValidationOptions['fieldValidators']> = {
  clients: {
    ice: validateICE,
    phone: validatePhone,
    email: validateEmail,
  },
  trucks: {
    plate_number: validateMoroccanPlate,
  },
  trailers: {
    plate_number: validateMoroccanPlate,
  },
};

const HEADER_ALIASES: Record<ImportEntity, ValidationOptions['headerAliases']> = {
  clients: {
    name: ['اسم', 'nom', 'nombre', 'client', 'العميل'],
    phone: ['هاتف', 'tel', 'téléphone', 'phone', 'الهاتف'],
    email: ['بريد', 'email', 'e-mail', 'mail', 'البريد'],
    address: ['عنوان', 'adresse', 'address', 'العنوان'],
    city: ['مدينة', 'ville', 'city', 'المدينة'],
    ice: ['ice', 'رقم ice', 'رقم التسجيل', 'رقم التعريف'],
  },
  trucks: {
    plate_number: ['لوحة', 'plate', 'matricule', 'plaque', 'لوحة رقم'],
    model: ['طراز', 'model', 'موديل', 'النوع'],
    status: ['حالة', 'statut', 'status', 'الحالة'],
    address: ['عنوان', 'adresse', 'address', 'العنوان'],
  },
  trailers: {
    plate_number: ['لوحة', 'plate', 'matricule', 'plaque', 'لوحة رقم'],
    model: ['طراز', 'model', 'موديل', 'النوع'],
    status: ['حالة', 'statut', 'status', 'الحالة'],
  },
};

export function BulkImportModal({ isOpen, onClose, entityType, onSuccess }: BulkImportModalProps) {
  const { t, dir, locale } = useLanguage();
  const { toast } = useToast();
  const [entity, setEntity] = useState<ImportEntity>(entityType === 'truck' ? 'trucks' : entityType === 'trailer' ? 'trailers' : 'clients');

  useEffect(() => {
    if (entityType === 'truck') setEntity('trucks');
    else if (entityType === 'trailer') setEntity('trailers');
    else setEntity('clients');
  }, [entityType]);
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [result, setResult] = useState<BulkImportResult | null>(null);
  const [importResult, setImportResult] = useState<BulkImportResponse | null>(null);

  const reset = useCallback(() => {
    setFile(null);
    setParsing(false);
    setImporting(false);
    setResult(null);
    setImportResult(null);
    setDragOver(false);
  }, []);

  const parseFile = useCallback(async (target: File) => {
    setFile(target);
    setParsing(true);
    setResult(null);
    setImportResult(null);
    try {
      const parsed = await parseExcelFile(target);
      const validated = validateRows(parsed.validRows, {
        requiredFields: REQUIRED_FIELDS[entity],
        fieldValidators: VALIDATORS[entity],
        headerAliases: HEADER_ALIASES[entity],
      });
      setResult(validated);
    } catch (error: unknown) {
      toast({
        title: t('خطأ في قراءة الملف', 'Erreur de lecture du fichier'),
        description: error instanceof Error ? error.message : 'فشل تحليل الملف',
        variant: 'destructive',
      });
      reset();
    } finally {
      setParsing(false);
    }
  }, [entity, reset, t, toast]);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    const target = e.dataTransfer.files?.[0];
    if (target) parseFile(target);
  }, [parseFile]);

  const onInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const target = e.target.files?.[0];
    if (target) parseFile(target);
  }, [parseFile]);

  const downloadSample = () => {
    const headers = SAMPLE_HEADERS[entity];
    const ws = XLSX.utils.json_to_sheet([{ [headers[0]]: '', [headers[1]]: '', [headers[2]]: '', [headers[3]]: '', [headers[4]]: '', [headers[5]]: '' }]);
    ws['!cols'] = headers.map(() => ({ wch: 18 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'template');
    XLSX.writeFile(wb, `sample_${entity}.xlsx`);
  };

  const handleImport = async () => {
    if (!result?.validRows.length) return;
    setImporting(true);
    setImportResult(null);
    try {
      let res: BulkImportResponse;
      if (entity === 'clients') res = await importClientsAction(result.validRows);
      else if (entity === 'trucks') res = await importTrucksAction(result.validRows);
      else res = await importTrailersAction(result.validRows);
      setImportResult(res);
      if (res.success && onSuccess) {
        onSuccess();
      }
      toast({
        title: res.success ? t('تم الاستيراد بنجاح', 'Importation réussie') : t('عملية الاستيراد مكتملة مع أخطاء', 'Importation terminée avec erreurs'),
        description: t(`تم استيراد ${res.imported} سجل`, `${res.imported} enregistrements importés`),
      });
    } catch (error: unknown) {
      toast({
        title: t('خطأ أثناء الاستيراد', 'Erreur lors de l\'importation'),
        description: error instanceof Error ? error.message : 'حدث خطأ غير متوقع',
        variant: 'destructive',
      });
    } finally {
      setImporting(false);
    }
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <Card className="w-full max-w-3xl rounded-2xl shadow-2xl border-border bg-card overflow-hidden">
        <CardHeader className="p-4 border-b border-border/60 bg-muted/20 flex flex-row items-center justify-between">
          <CardTitle className="text-base font-bold font-amiri text-foreground flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-primary" />
            {t('استيراد جماعي من Excel', 'Importation en masse depuis Excel')}
          </CardTitle>
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={handleClose}>
            <X className="w-4 h-4" />
          </Button>
        </CardHeader>
        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-3 gap-2">
            {(['clients', 'trucks', 'trailers'] as ImportEntity[]).map((e) => (
              <button
                key={e}
                onClick={() => { setEntity(e); reset(); }}
                className={`px-3 py-2 text-xs font-bold rounded-xl transition-all ${
                  entity === e ? 'bg-primary text-primary-foreground shadow-xs' : 'bg-muted/60 text-muted-foreground hover:text-foreground'
                }`}
              >
                {t(ENTITY_LABELS[e].ar, ENTITY_LABELS[e].fr)}
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">{t('الصيغ المدعومة: xlsx, csv', 'Formats supportés : xlsx, csv')}</span>
            <Button variant="outline" size="sm" onClick={downloadSample} className="h-8 text-xs rounded-xl gap-1.5">
              <Download className="w-3.5 h-3.5" />
              {t('تحميل نموذج', 'Télécharger le modèle')}
            </Button>
          </div>

          <div
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
              dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/60'
            }`}
          >
            <input type="file" accept=".xlsx,.csv" onChange={onInputChange} className="hidden" id="bulk-import-file" />
            <label htmlFor="bulk-import-file" className="cursor-pointer block">
              <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-xs font-semibold text-foreground">
                {file ? file.name : t('اسحب الملف هنا أو اضغط للاختيار', 'Glissez le fichier ici ou cliquez pour choisir')}
              </p>
              {!file && (
                <p className="text-[11px] text-muted-foreground mt-1">{t('الحد الأقصى لحجم الملف: 10MB', 'Taille max : 10MB')}</p>
              )}
            </label>
          </div>

          {parsing && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              {t('جاري تحليل الملف...', 'Analyse du fichier en cours...')}
            </div>
          )}

          {result && !importResult && (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <Card className="border-border">
                  <CardContent className="p-3 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <div>
                      <p className="text-[11px] text-muted-foreground">{t('صالحة للاستيراد', 'Valides')}</p>
                      <p className="text-lg font-bold font-mono text-foreground">{result.validRows.length}</p>
                    </div>
                  </CardContent>
                </Card>
                <Card className="border-border">
                  <CardContent className="p-3 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-600" />
                    <div>
                      <p className="text-[11px] text-muted-foreground">{t('تحتاج مراجعة', 'À corriger')}</p>
                      <p className="text-lg font-bold font-mono text-foreground">{result.invalidRows.length}</p>
                    </div>
                  </CardContent>
                </Card>
                <Card className="border-border">
                  <CardContent className="p-3 flex items-center gap-2">
                    <FileSpreadsheet className="w-4 h-4 text-primary" />
                    <div>
                      <p className="text-[11px] text-muted-foreground">{t('إجمالي الصفوف', 'Total lignes')}</p>
                      <p className="text-lg font-bold font-mono text-foreground">{result.totalRows}</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {result.invalidRows.length > 0 && (
                <div className="bg-rose-500/5 border border-rose-500/20 rounded-xl p-3 space-y-2 max-h-48 overflow-y-auto">
                  <p className="text-xs font-bold text-rose-700 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    {t('أخطاء التحقق من البيانات', 'Erreurs de validation')}
                  </p>
                  {result.invalidRows.map((r) => (
                    <div key={r.row} className="text-[11px] text-rose-700 bg-rose-500/10 rounded-lg px-2 py-1">
                      <span className="font-mono font-bold">#{r.row}</span> {r.errors.join('، ')}
                    </div>
                  ))}
                </div>
              )}

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={reset} className="rounded-xl h-9 text-xs">
                  {t('إلغاء', 'Annuler')}
                </Button>
                <Button
                  onClick={handleImport}
                  disabled={importing || result.validRows.length === 0}
                  className="bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-xl h-9 text-xs font-semibold"
                >
                  {importing ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      {t('جاري الاستيراد...', 'Importation en cours...')}
                    </>
                  ) : (
                    <>
                      <Upload className="w-3.5 h-3.5" />
                      {t('تأكيد الاستيراد', 'Confirmer l\'importation')}
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {importResult && (
            <div className="space-y-3">
              <div className={`rounded-xl p-4 border ${importResult.success ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-amber-500/5 border-amber-500/20'}`}>
                <div className="flex items-center gap-2 mb-1">
                  {importResult.success ? <CheckCircle2 className="w-5 h-5 text-emerald-600" /> : <AlertTriangle className="w-5 h-5 text-amber-600" />}
                  <p className="text-sm font-bold text-foreground">
                    {importResult.success ? t('اكتمل الاستيراد بنجاح', 'Importation réussie') : t('اكتمل مع أخطاء', 'Importation terminée avec erreurs')}
                  </p>
                </div>
                <p className="text-xs text-muted-foreground">
                  {t(`تم استيراد ${importResult.imported} سجل بنجاح`, `${importResult.imported} enregistrements importés avec succès`)}
                  {importResult.failed > 0 && ` • ${t(`فشل ${importResult.failed} سجل`, `${importResult.failed} échecs`)}`}
                </p>
              </div>
              {importResult.errors.length > 0 && (
                <div className="bg-rose-500/5 border border-rose-500/20 rounded-xl p-3 space-y-2 max-h-48 overflow-y-auto">
                  <p className="text-xs font-bold text-rose-700">{t('تفاصيل الأخطاء', 'Détails des erreurs')}</p>
                  {importResult.errors.map((err, i) => (
                    <div key={i} className="text-[11px] text-rose-700 bg-rose-500/10 rounded-lg px-2 py-1">
                      {t('صف', 'Ligne')} #{err.row}: {err.message}
                    </div>
                  ))}
                </div>
              )}
              <div className="flex justify-end">
                <Button onClick={handleClose} className="rounded-xl h-9 text-xs">
                  {t('إغلاق', 'Fermer')}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
