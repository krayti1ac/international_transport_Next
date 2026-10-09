'use client';

import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/components/language-provider';
import {
  Repeat,
  Calendar,
  DollarSign,
  Play,
  CheckCircle2,
  Clock,
  Plus,
  RefreshCw,
  Loader2,
} from 'lucide-react';
import type { RecurringInvoiceSchedule } from '../types/recurring-invoice.types';
import { processDueRecurringInvoicesAction } from '../services/payments.actions';

interface RecurringSchedulesListProps {
  schedules: RecurringInvoiceSchedule[];
  onAddNew: () => void;
  onRefresh: () => void;
}

export function RecurringSchedulesList({
  schedules,
  onAddNew,
  onRefresh,
}: RecurringSchedulesListProps) {
  const { locale, dir } = useLanguage();
  const language = locale;
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  const handleProcessDueNow = async () => {
    try {
      setIsProcessing(true);
      const res = await processDueRecurringInvoicesAction();

      toast({
        title:
          language === 'es'
            ? 'Procesamiento de facturación completado'
            : language === 'fr'
              ? 'Traitement de facturation terminé'
              : 'اكتملت معالجة دورات الفوترة',
        description:
          language === 'es'
            ? `Se han generado ${res.invoicesGenerated.length} facturas automáticas.`
            : language === 'fr'
              ? `${res.invoicesGenerated.length} factures générées automatiquement.`
              : `تم توليد ${res.invoicesGenerated.length} فاتورة جديدة بنجاح.`,
      });

      onRefresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'فشل تنفيذ الدورة التلقائية';
      toast({
        title:
          language === 'es'
            ? 'Error al procesar'
            : language === 'fr'
              ? 'Erreur de traitement'
              : 'خطأ أثناء المعالجة',
        description: msg,
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Card className="w-full border-border bg-card shadow-xs" dir={dir}>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div className="space-y-1">
          <CardTitle className="text-lg font-bold font-amiri flex items-center gap-2">
            <Repeat className="w-5 h-5 text-primary" />
            <span>
              {language === 'es'
                ? 'Planes de Facturación Recurrente'
                : language === 'fr'
                  ? 'Contrats & Facturation Récurrente'
                  : 'عقود الفوترة الدورية المجدولة'}
            </span>
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            {language === 'es'
              ? 'Generación y envío automático de facturas y enlaces de pago'
              : language === 'fr'
                ? 'Génération et émission automatisée de factures avec liens de paiement'
                : 'إصدار آلي مجدول للفواتير وروابط السداد الرقمية للعقود الدورية'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleProcessDueNow}
            disabled={isProcessing}
            className="text-xs flex items-center gap-1.5"
          >
            {isProcessing ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Play className="w-3.5 h-3.5 text-emerald-600" />
            )}
            <span>
              {language === 'es'
                ? 'Procesar vencidos'
                : language === 'fr'
                  ? 'Traiter les échéances'
                  : 'تشغيل الفواتير المستحقة'}
            </span>
          </Button>

          <Button
            size="sm"
            onClick={onAddNew}
            className="text-xs flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>
              {language === 'es'
                ? 'Nuevo plan'
                : language === 'fr'
                  ? 'Nouveau contrat'
                  : 'جدولة عقد جديد'}
            </span>
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {schedules.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground space-y-2 border border-dashed rounded-lg">
            <Repeat className="w-8 h-8 mx-auto text-muted-foreground/60" />
            <p className="text-sm font-medium">
              {language === 'es'
                ? 'No hay programaciones recurrentes registradas'
                : language === 'fr'
                  ? 'Aucune facturation récurrente configurée'
                  : 'لا توجد أي عقود فوترة دورية مجدولة حالياً'}
            </p>
            <Button variant="outline" size="sm" onClick={onAddNew}>
              {language === 'es'
                ? 'Crear primera programación'
                : language === 'fr'
                  ? 'Créer le premier contrat'
                  : 'إنشاء أول جدول فوترة'}
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-border/60">
            {schedules.map((item) => (
              <div
                key={item.id}
                className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-muted/30 px-2 rounded-md transition-colors"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-foreground">{item.title}</span>
                    <Badge
                      variant="outline"
                      className={`text-[10px] ${
                        item.status === 'active'
                          ? 'border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10'
                          : 'border-border text-muted-foreground'
                      }`}
                    >
                      {item.status.toUpperCase()}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground font-mono">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {item.frequency}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {language === 'es'
                        ? `Próxima: ${item.nextIssueDate}`
                        : language === 'fr'
                          ? `Prochaine : ${item.nextIssueDate}`
                          : `الإصدار القادم: ${item.nextIssueDate}`}
                    </span>
                    <span className="flex items-center gap-1 text-foreground font-bold">
                      <DollarSign className="w-3 h-3" />
                      {item.totalAmountTtc} {item.currency}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center">
                  <span className="text-xs font-mono text-muted-foreground px-2 py-0.5 rounded bg-muted">
                    {language === 'es'
                      ? `Ciclos: ${item.totalCyclesCompleted}`
                      : language === 'fr'
                        ? `Cycles : ${item.totalCyclesCompleted}`
                        : `الدورات المنجزة: ${item.totalCyclesCompleted}`}
                    {item.maxCycles ? ` / ${item.maxCycles}` : ''}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

