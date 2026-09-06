'use client';

import { useState, useEffect, useMemo } from 'react';
import { createClient } from '@/lib/supabase/browser';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/components/language-provider';
import { Shield, User as UserIcon, FileText, Trash2, Edit, Copy } from 'lucide-react';

interface AuditLog {
  id: number;
  action_type: string;
  entity_type: string;
  entity_id: string;
  employee_id: string;
  reason?: string;
  created_at: string;
}

export default function AuditLogsPage() {
  const { t, dir, locale } = useLanguage();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setLogs((data as AuditLog[]) || []);
    } catch (error: any) {
      toast({
        title: t('خطأ في جلب سجلات التدقيق', 'Erreur de chargement du journal d’audit'),
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'soft_delete':
        return (
          <div className="p-2 rounded-lg bg-rose-500/15 text-rose-600 dark:text-rose-400">
            <Trash2 className="w-4 h-4" />
          </div>
        );
      case 'update':
        return (
          <div className="p-2 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400">
            <Edit className="w-4 h-4" />
          </div>
        );
      case 'duplicate':
        return (
          <div className="p-2 rounded-lg bg-blue-500/15 text-blue-600 dark:text-blue-400">
            <Copy className="w-4 h-4" />
          </div>
        );
      default:
        return (
          <div className="p-2 rounded-lg bg-muted text-muted-foreground">
            <FileText className="w-4 h-4" />
          </div>
        );
    }
  };

  const getActionText = (action: string) => {
    switch (action) {
      case 'soft_delete': return t('حذف', 'Suppression');
      case 'update': return t('تعديل', 'Modification');
      case 'duplicate': return t('نسخ', 'Duplication');
      default: return action;
    }
  };

  const getEntityText = (entity: string) => {
    switch (entity) {
      case 'trip_orders': return t('رحلات', 'Voyages');
      case 'invoices': return t('فواتير', 'Factures');
      case 'advances': return t('سلفيات', 'Avances');
      case 'clients': return t('عملاء', 'Clients');
      case 'drivers': return t('سائقين', 'Conducteurs');
      case 'trucks': return t('شاحنات', 'Véhicules');
      case 'payments': return t('مدفوعات', 'Règlements');
      default: return entity;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-muted-foreground">{t('جاري تحميل السجلات...', 'Chargement du journal...')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6" dir={dir}>
      <div>
        <h1 className="text-2xl font-bold font-amiri text-foreground flex items-center gap-2">
          <Shield className="w-6 h-6 text-primary" />
          {t('سجلات التدقيق والحركات الأمنية', 'Journal d’Audit & Sécurité')}
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {t('تتبع التغييرات والتعديلات وعمليات الحذف في النظام', 'Traçabilité complète des modifications, suppressions et actions critiques')}
        </p>
      </div>

      <Card>
        <CardHeader className="border-b border-border pb-3">
          <CardTitle className="font-amiri text-foreground">
            {t('سجل العمليات الأخير', 'Dernières opérations enregistrées')}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="space-y-3">
            {logs.map((log: AuditLog) => (
              <div key={log.id} className="flex items-start gap-4 p-3.5 bg-muted/40 hover:bg-muted/70 transition-colors rounded-xl border border-border">
                <div className="mt-0.5">
                  {getActionIcon(log.action_type)}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-bold text-foreground">{getActionText(log.action_type)}</span>
                      <span className="text-muted-foreground mx-2">{t('في', 'sur')}</span>
                      <span className="font-medium text-foreground bg-primary/10 text-primary px-2 py-0.5 rounded text-xs">
                        {getEntityText(log.entity_type)}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground font-mono">
                      {new Date(log.created_at).toLocaleString(locale === 'ar' ? 'ar-MA' : 'fr-FR')}
                    </span>
                  </div>
                  {log.reason && (
                    <p className="text-sm text-muted-foreground mt-1 bg-background p-2 rounded-md border border-border">
                      <span className="font-semibold text-foreground">{t('السبب: ', 'Motif : ')}</span>
                      {log.reason}
                    </p>
                  )}
                  <div className="flex items-center gap-1.5 mt-2 text-xs text-muted-foreground">
                    <UserIcon className="w-3.5 h-3.5" />
                    <span>{t('الموظف: ', 'Utilisateur : ')}<span className="font-mono text-foreground">{log.employee_id}</span></span>
                  </div>
                </div>
              </div>
            ))}
            {logs.length === 0 && (
              <div className="text-center py-12">
                <p className="text-muted-foreground">{t('لا توجد سجلات تدقيق حتى الآن', 'Aucune entrée d’audit enregistrée')}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
