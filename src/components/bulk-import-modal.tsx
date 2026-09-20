'use client';

import { useCallback, useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { useLanguage } from '@/components/language-provider';
import {
  parseExcelFile,
  validateRows,
  validateICE,
  validateMoroccanPlate,
  validateEmail,
  validatePhone,
  type BulkImportResult,
  type ValidationOptions,
} from '@/lib/excel-importer';
import {
  generateSmartExcelTemplate,
  FIELD_ALIASES,
  type BulkImportEntityType,
} from '@/lib/bulk-import';
import {
  importClientsAction,
  importTrucksAction,
  importTrailersAction,
  importDriversAction,
  importTripsAction,
  importProvidersAction,
  importTreasuryAction,
  type BulkImportResponse,
} from '@/lib/bulk-import.actions';
import { useToast } from '@/hooks/use-toast';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  Upload,
  X,
  FileSpreadsheet,
  Loader2,
  ShieldCheck,
  FileDown,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export type ImportEntity = 'clients' | 'trucks' | 'trailers' | 'drivers' | 'trips' | 'providers' | 'treasury';

interface BulkImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  entityType?: 'client' | 'truck' | 'trailer' | 'driver' | 'trip' | 'provider' | 'treasury';
  onSuccess?: () => void;
}

const ENTITY_LABELS: Record<ImportEntity, { ar: string; fr: string; es: string }> = {
  clients: { ar: 'عملاء', fr: 'Clients', es: 'Clientes' },
  trucks: { ar: 'شاحنات', fr: 'Camions', es: 'Camiones' },
  trailers: { ar: 'مقطورات', fr: 'Remorques', es: 'Remolques' },
  drivers: { ar: 'سائقين', fr: 'Chauffeurs', es: 'Conductores' },
  trips: { ar: 'رحلات', fr: 'Trajets', es: 'Viajes' },
  providers: { ar: 'موردين', fr: 'Fournisseurs', es: 'Proveedores' },
  treasury: { ar: 'خزينة', fr: 'Trésorerie', es: 'Tesorería' },
};

const REQUIRED_FIELDS: Record<ImportEntity, string[]> = {
  clients: ['name', 'phone', 'ice'],
  trucks: ['plate_number', 'model'],
  trailers: ['plate_number', 'model'],
  drivers: ['name', 'phone', 'license'],
  trips: ['departure_date', 'price'],
  providers: ['name', 'type'],
  treasury: ['type', 'amount', 'currency'],
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
  drivers: {
    phone: validatePhone,
  },
  trips: {},
  providers: {
    ice: validateICE,
    phone: validatePhone,
    email: validateEmail,
  },
  treasury: {},
};

export function BulkImportModal({ isOpen, onClose, entityType, onSuccess }: BulkImportModalProps) {
  const { t, locale } = useLanguage();
  const { toast } = useToast();

  const resolveInitialEntity = (type?: string): ImportEntity => {
    switch (type) {
      case 'truck': return 'trucks';
      case 'trailer': return 'trailers';
      case 'driver': return 'drivers';
      case 'trip': return 'trips';
      case 'provider': return 'providers';
      case 'treasury': return 'treasury';
      default: return 'clients';
    }
  };

  const [entity, setEntity] = useState<ImportEntity>(resolveInitialEntity(entityType));

  useEffect(() => {
    setEntity(resolveInitialEntity(entityType));
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
        headerAliases: FIELD_ALIASES,
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
    const canonicalType: BulkImportEntityType =
      entity === 'clients' ? 'client'
      : entity === 'trucks' ? 'truck'
      : entity === 'trailers' ? 'trailer'
      : entity === 'drivers' ? 'driver'
      : entity === 'trips' ? 'trip'
      : entity === 'providers' ? 'provider'
      : 'treasury';

    generateSmartExcelTemplate(canonicalType);
  };

  const handleDownloadErrorsExcel = () => {
    if (!result || result.invalidRows.length === 0) return;

    const errorData = result.invalidRows.map((r) => ({
      'رقم_الصف_في_الملف': r.row,
      'أسباب_الرفض': r.errors.join(' | '),
      ...r.data,
    }));

    const worksheet = XLSX.utils.json_to_sheet(errorData);
    worksheet['!cols'] = [{ wch: 18 }, { wch: 45 }];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'الأخطاء_تحتاج_مراجعة');
    XLSX.writeFile(workbook, `أخطاء_استيراد_${entity}.xlsx`);
  };

  const handleImport = async () => {
    if (!result?.validRows.length) return;
    setImporting(true);
    setImportResult(null);
    try {
      let res: BulkImportResponse;
      if (entity === 'clients') res = await importClientsAction(result.validRows);
      else if (entity === 'trucks') res = await importTrucksAction(result.validRows);
      else if (entity === 'trailers') res = await importTrailersAction(result.validRows);
      else if (entity === 'drivers') res = await importDriversAction(result.validRows);
      else if (entity === 'trips') res = await importTripsAction(result.validRows);
      else if (entity === 'providers') res = await importProvidersAction(result.validRows);
      else res = await importTreasuryAction(result.validRows);

      setImportResult(res);
      if (res.imported > 0 && onSuccess) {
        onSuccess();
      }
      toast({
        title: res.success
          ? t('تم الاستيراد بنجاح', 'Importation réussie')
          : t('اكتمل الاستيراد مع وجود استثناءات', 'Importation terminée avec exceptions'),
        description: t(
          `تم استيراد ${res.imported} سجل بنجاح${res.failed > 0 ? ` (فشل ${res.failed} سجل)` : ''}`,
          `${res.imported} enregistrements importés${res.failed > 0 ? ` (${res.failed} échecs)` : ''}`
        ),
      });
    } catch (error: unknown) {
      toast({
        title: t('خطأ أثناء الاستيراد', "Erreur lors de l'importation"),
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
            {locale === 'es'
              ? 'Importación Masiva desde Excel / Access CSV'
              : t('استيراد جماعي من Excel / Access CSV', 'Importation en masse depuis Excel / Access CSV')}
          </CardTitle>
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={handleClose}>
            <X className="w-4 h-4" />
          </Button>
        </CardHeader>
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-wrap gap-1.5 p-1 bg-muted/30 rounded-xl border border-border/40">
            {(['clients', 'trucks', 'trailers', 'drivers', 'trips', 'providers', 'treasury'] as ImportEntity[]).map((e) => (
              <button
                key={e}
                onClick={() => {
                  setEntity(e);
                  reset();
                }}
                className={`flex-1 min-w-[70px] py-1.5 px-2 text-xs font-bold rounded-lg transition-all text-center ${
                  entity === e
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'bg-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50'
                }`}
              >
                {locale === 'es' ? ENTITY_LABELS[e].es : t(ENTITY_LABELS[e].ar, ENTITY_LABELS[e].fr)}
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {locale === 'es'
                ? 'Formatos soportados: xlsx, csv (Exportaciones MS Access)'
                : t(
                    'الصيغ المدعومة: xlsx, csv (صادرات MS Access)',
                    'Formats supportés : xlsx, csv (Exports MS Access)'
                  )}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={downloadSample}
              className="h-8 text-xs rounded-xl gap-1.5 border-primary/30 hover:bg-primary/5"
            >
              <Download className="w-3.5 h-3.5 text-primary" />
              {locale === 'es'
                ? `Descargar plantilla (${ENTITY_LABELS[entity].es})`
                : t(`تحميل نموذج (${ENTITY_LABELS[entity].ar})`, `Télécharger le modèle (${ENTITY_LABELS[entity].fr})`)}
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
            <input type="file" accept=".xlsx,.csv,.txt" onChange={onInputChange} className="hidden" id="bulk-import-file" />
            <label htmlFor="bulk-import-file" className="cursor-pointer block">
              <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-xs font-semibold text-foreground">
                {file
                  ? file.name
                  : locale === 'es'
                    ? 'Arrastra el archivo aquí o haz clic para seleccionarlo'
                    : t('اسحب الملف هنا أو اضغط للاختيار', 'Glissez le fichier ici ou cliquez pour choisir')}
              </p>
              {!file && (
                <p className="text-[11px] text-muted-foreground mt-1">
                  {locale === 'es'
                    ? 'Tamaño máximo: 10MB • Auto-limpieza y desinfección de datos activa'
                    : t(
                        'الحد الأقصى: 10MB • التطهير والتجميل التلقائي للبيانات مفعّل',
                        'Taille max : 10MB • Nettoyage et assainissement automatique actif'
                      )}
                </p>
              )}
            </label>
          </div>

          {parsing && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
              {locale === 'es'
                ? 'Analizando y desinfectando datos...'
                : t('جاري تحليل وتطهير البيانات...', 'Analyse et assainissement des données...')}
            </div>
          )}

          {result && !importResult && (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <Card className="border-border">
                  <CardContent className="p-3 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <div>
                      <p className="text-[11px] text-muted-foreground">
                        {locale === 'es' ? 'Válidos' : t('صالحة للاستيراد', 'Valides')}
                      </p>
                      <p className="text-lg font-bold font-mono text-emerald-600">{result.validRows.length}</p>
                    </div>
                  </CardContent>
                </Card>
                <Card className="border-border">
                  <CardContent className="p-3 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-600" />
                    <div>
                      <p className="text-[11px] text-muted-foreground">
                        {locale === 'es' ? 'A revisar' : t('تحتاج مراجعة', 'À corriger')}
                      </p>
                      <p className="text-lg font-bold font-mono text-rose-600">{result.invalidRows.length}</p>
                    </div>
                  </CardContent>
                </Card>
                <Card className="border-border">
                  <CardContent className="p-3 flex items-center gap-2">
                    <FileSpreadsheet className="w-4 h-4 text-primary" />
                    <div>
                      <p className="text-[11px] text-muted-foreground">
                        {locale === 'es' ? 'Total registros' : t('إجمالي الصفوف', 'Total lignes')}
                      </p>
                      <p className="text-lg font-bold font-mono text-foreground">{result.totalRows}</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {result.invalidRows.length > 0 && (
                <div className="bg-rose-500/5 border border-rose-500/20 rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-rose-700 dark:text-rose-400 flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      {locale === 'es'
                        ? 'Errores de validación detectados'
                        : t('أخطاء التحقق من البيانات', 'Erreurs de validation')}
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleDownloadErrorsExcel}
                      className="h-7 text-[11px] text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-800 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg gap-1"
                    >
                      <FileDown className="w-3 h-3" />
                      {locale === 'es'
                        ? 'Descargar errores en Excel'
                        : t('تنزيل الأخطاء في Excel', 'Exporter les erreurs')}
                    </Button>
                  </div>
                  <div className="max-h-40 overflow-y-auto space-y-1.5 pe-1">
                    {result.invalidRows.map((r) => (
                      <div key={r.row} className="text-[11px] text-rose-700 dark:text-rose-300 bg-rose-500/10 rounded-lg px-2.5 py-1.5">
                        <span className="font-mono font-bold">#{r.row}</span> {r.errors.join('، ')}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <Button variant="outline" onClick={reset} className="rounded-xl h-9 text-xs">
                  {locale === 'es' ? 'Cancelar' : t('إلغاء', 'Annuler')}
                </Button>
                <Button
                  onClick={handleImport}
                  disabled={importing || result.validRows.length === 0}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl h-9 text-xs font-semibold gap-1.5 shadow-sm"
                >
                  {importing ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      {locale === 'es'
                        ? 'Importando...'
                        : t('جاري الاستيراد...', 'Importation en cours...')}
                    </>
                  ) : (
                    <>
                      <Upload className="w-3.5 h-3.5" />
                      {result.invalidRows.length > 0
                        ? locale === 'es'
                          ? `Importar solo ${result.validRows.length} registros válidos`
                          : t(
                              `استيراد ${result.validRows.length} سجل سليم فقط`,
                              `Importer seulement ${result.validRows.length} valides`
                            )
                        : locale === 'es'
                          ? 'Confirmar importación'
                          : t('تأكيد الاستيراد', "Confirmer l'importation")}
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {importResult && (
            <div className="space-y-3">
              <div
                className={`rounded-xl p-4 border ${
                  importResult.success
                    ? 'bg-emerald-500/5 border-emerald-500/20'
                    : 'bg-amber-500/5 border-amber-500/20'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  {importResult.success ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-amber-600" />
                  )}
                  <p className="text-sm font-bold text-foreground">
                    {importResult.success
                      ? locale === 'es'
                        ? 'Importación completada con éxito'
                        : t('اكتمل الاستيراد بنجاح', 'Importation réussie')
                      : locale === 'es'
                        ? 'Completado con advertencias/errores'
                        : t('اكتمل مع استثناءات', 'Importation terminée avec erreurs')}
                  </p>
                </div>
                <p className="text-xs text-muted-foreground">
                  {locale === 'es'
                    ? `Se importaron ${importResult.imported} registros correctamente`
                    : t(
                        `تم استيراد ${importResult.imported} سجل بنجاح`,
                        `${importResult.imported} enregistrements importés avec succès`
                      )}
                  {importResult.failed > 0 &&
                    ` • ${
                      locale === 'es'
                        ? `${importResult.failed} registros no fueron importados`
                        : t(`فشل ${importResult.failed} سجل`, `${importResult.failed} échecs`)
                    }`}
                </p>
              </div>

              {importResult.errors.length > 0 && (
                <div className="bg-rose-500/5 border border-rose-500/20 rounded-xl p-3 space-y-2 max-h-48 overflow-y-auto">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-rose-700 dark:text-rose-400">
                      {locale === 'es' ? 'Detalles de errores' : t('تفاصيل الأخطاء', 'Détails des erreurs')}
                    </p>
                    {result && result.invalidRows.length > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleDownloadErrorsExcel}
                        className="h-6 text-[10px] text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-800 rounded-md gap-1"
                      >
                        <FileDown className="w-2.5 h-2.5" />
                        {locale === 'es' ? 'Exportar Excel' : t('تصدير Excel', 'Exporter Excel')}
                      </Button>
                    )}
                  </div>
                  {importResult.errors.map((err, i) => (
                    <div key={i} className="text-[11px] text-rose-700 dark:text-rose-300 bg-rose-500/10 rounded-lg px-2.5 py-1.5">
                      {locale === 'es' ? 'Fila' : t('صف', 'Ligne')} #{err.row}: {err.message}
                    </div>
                  ))}
                </div>
              )}

              <div className="flex justify-end">
                <Button onClick={handleClose} className="rounded-xl h-9 text-xs">
                  {locale === 'es' ? 'Cerrar' : t('إلغاء وإغلاق', 'Fermer')}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
