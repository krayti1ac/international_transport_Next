'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { TruckMaintenance, Truck, Trailer } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import {
  Wrench,
  Plus,
  Trash2,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Clock,
  RefreshCw,
  Gauge,
} from 'lucide-react';
import { formatCurrency } from '@/lib/forex';
import { MatriculeBadge } from '@/components/ui/matricule-badge';
import {
  getMaintenanceSchedules,
  deleteMaintenanceSchedule,
  type EnrichedMaintenanceSchedule,
} from '@/features/fleet/services/maintenance-schedule.actions';
import { MaintenanceSchedulerModal } from '@/features/fleet/components/MaintenanceSchedulerModal';
import { CompleteMaintenanceModal } from '@/features/fleet/components/CompleteMaintenanceModal';
import { useLanguage } from '@/components/language-provider';

export default function MaintenancePage() {
  const { t, dir } = useLanguage();
  const { toast } = useToast();
  const supabase = useMemo(() => createClient(), []);

  const [records, setRecords] = useState<TruckMaintenance[]>([]);
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [trailers, setTrailers] = useState<Trailer[]>([]);
  const [loading, setLoading] = useState(true);

  const [schedules, setSchedules] = useState<EnrichedMaintenanceSchedule[]>([]);
  const [isSchedulerOpen, setIsSchedulerOpen] = useState(false);
  const [selectedScheduleToComplete, setSelectedScheduleToComplete] = useState<EnrichedMaintenanceSchedule | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [maintRes, trucksRes, trailersRes, schedRes] = await Promise.all([
        supabase.from('truck_maintenance').select('*').order('maintenance_date', { ascending: false }),
        supabase.from('trucks').select('*'),
        supabase.from('trailers').select('*'),
        getMaintenanceSchedules(),
      ]);

      setRecords(maintRes.data || []);
      setTrucks(trucksRes.data || []);
      setTrailers(trailersRes.data || []);
      if (schedRes.success && schedRes.data) {
        setSchedules(schedRes.data);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : t('فشل تحميل سجلات الصيانة', 'Échec du chargement de l\'historique');
      toast({ title: t('خطأ', 'Erreur'), description: message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [supabase, toast, t]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDeleteSchedule = async (id: number) => {
    if (!confirm(t('هل أنت متأكد من رغبتك في حذف هذا الموعد المجدول؟', 'Êtes-vous sûr de vouloir supprimer cette maintenance programmée ?'))) return;
    const res = await deleteMaintenanceSchedule(id);
    if (res.success) {
      toast({ title: t('تم حذف الموعد المجدول', 'Maintenance programmée supprimée') });
      fetchData();
    } else {
      toast({ title: t('خطأ', 'Erreur'), description: res.error, variant: 'destructive' });
    }
  };

  const scheduleStats = useMemo(() => {
    const overdue = schedules.filter((s) => s.urgency === 'overdue').length;
    const dueSoon = schedules.filter((s) => s.urgency === 'due_soon').length;
    const total = schedules.length;
    return { overdue, dueSoon, total };
  }, [schedules]);

  return (
    <div className="space-y-6 pb-12" dir={dir}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-amiri text-foreground flex items-center gap-2">
            <Wrench className="w-6 h-6 text-primary" />
            {t('الصيانة العامة والوقائية للأسطول', 'Maintenance Générale et Préventive de la Flotte')}
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t(
              'متابعة فواتير الإصلاح، جدولة الصيانة الدورية، ومراقبة استهلاك القطع الحيوية',
              'Suivi des factures de réparation, planification préventive et contrôle des pièces'
            )}
          </p>
        </div>

        <Button
          onClick={() => setIsSchedulerOpen(true)}
          className="rounded-xl gap-2 font-bold shadow-xs self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>{t('جدولة صيانة وقائية جديدة', 'Programmer une nouvelle maintenance')}</span>
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <Card className="border-border">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-600 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t('صيانة متأخرة تجاوزت الموعد', 'Maintenances en retard')}</p>
              <p className="text-xl font-bold font-mono text-rose-600 mt-0.5">
                {scheduleStats.overdue} {t('مركبات', 'véhicules')}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t('مستحقة خلال 14 يوماً', 'Échéance sous 14 jours')}</p>
              <p className="text-xl font-bold font-mono text-amber-600 mt-0.5">
                {scheduleStats.dueSoon} {t('مركبات', 'véhicules')}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t('إجمالي العمليات المجدولة', 'Total des tâches programmées')}</p>
              <p className="text-xl font-bold font-mono text-foreground mt-0.5">
                {scheduleStats.total} {t('مهام', 'tâches')}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="scheduler" className="w-full">
        <TabsList className="grid w-full sm:w-80 grid-cols-2 h-11 rounded-xl mb-4">
          <TabsTrigger value="scheduler" className="rounded-lg text-xs font-bold gap-2">
            <Calendar className="w-3.5 h-3.5" />
            {t('المواعيد والتنبيهات', 'Échéancier')} ({schedules.length})
          </TabsTrigger>
          <TabsTrigger value="history" className="rounded-lg text-xs font-bold gap-2">
            <Wrench className="w-3.5 h-3.5" />
            {t('سجل المنفذة', 'Historique')} ({records.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="scheduler" className="space-y-4">
          <Card className="border-border overflow-hidden">
            <CardHeader className="border-b border-border/70 py-3.5 px-5 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Calendar className="w-4 h-4 text-primary" />
                <span>{t('مواعيد الصيانة الوقائية القادمة', 'Échéances de maintenance à venir')}</span>
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={fetchData} className="h-8 text-xs gap-1">
                <RefreshCw className="w-3.5 h-3.5" />
                {t('تحديث', 'Actualiser')}
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="py-12 text-center text-xs text-muted-foreground">{t('جاري تحميل جدول الصيانة...', 'Chargement du planning...')}</div>
              ) : schedules.length === 0 ? (
                <div className="py-12 text-center text-xs text-muted-foreground">
                  {t('لا توجد مواعيد صيانة مجدولة حالياً. اضغط على "جدولة صيانة وقائية جديدة" للإضافة.', 'Aucune maintenance programmée. Cliquez sur "Programmer une nouvelle maintenance" pour en ajouter.')}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/40 text-muted-foreground text-xs">
                        <th className="py-3 px-4 text-start font-semibold">{t('المركبة', 'Véhicule')}</th>
                        <th className="py-3 px-4 text-start font-semibold">{t('نوع الصيانة المجدولة', 'Type de maintenance')}</th>
                        <th className="py-3 px-4 text-start font-semibold">{t('تاريخ الاستحقاق', 'Date d\'échéance')}</th>
                        <th className="py-3 px-4 text-start font-semibold">{t('الحالة والمهلة', 'Statut / Délai')}</th>
                        <th className="py-3 px-4 text-start font-semibold">{t('التكلفة التقديرية', 'Coût estimé')}</th>
                        <th className="py-3 px-4 text-end font-semibold">{t('الإجراءات', 'Actions')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60 text-xs">
                      {schedules.map((item) => {
                        const isOverdue = item.urgency === 'overdue';
                        const isDueSoon = item.urgency === 'due_soon';

                        return (
                          <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                            <td className="py-3 px-4">
                              <MatriculeBadge plate={item.plateNumber} variant="badge" size="xs" />
                              <span className="text-[11px] text-muted-foreground block mt-0.5">{item.model}</span>
                            </td>
                            <td className="py-3 px-4 font-semibold text-foreground">{item.maintenance_type}</td>
                            <td className="py-3 px-4 font-mono">{item.scheduled_date}</td>
                            <td className="py-3 px-4">
                              <span
                                className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                                  isOverdue
                                    ? 'bg-rose-500/15 text-rose-700 border-rose-500/30'
                                    : isDueSoon
                                    ? 'bg-amber-500/15 text-amber-700 border-amber-500/30'
                                    : 'bg-emerald-500/15 text-emerald-700 border-emerald-500/30'
                                }`}
                              >
                                {isOverdue
                                  ? `${t('متأخرة', 'En retard')} (${Math.abs(item.daysRemaining)} ${t('يوم', 'j')})`
                                  : isDueSoon
                                  ? `${t('مستحقة قريباً', 'Bientôt')} (${item.daysRemaining} ${t('يوم', 'j')})`
                                  : `${t('متبقي', 'Reste')} ${item.daysRemaining} ${t('يوم', 'j')}`}
                              </span>
                            </td>
                            <td className="py-3 px-4 font-mono font-bold text-foreground" dir="ltr">
                              {formatCurrency(item.amount_estimate || 0, item.currency || 'MAD')}
                            </td>
                            <td className="py-3 px-4 text-end">
                              <div className="flex items-center justify-end gap-1.5">
                                <Button
                                  size="sm"
                                  onClick={() => setSelectedScheduleToComplete(item)}
                                  className="h-8 text-xs rounded-xl gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  {t('إتمام وصرف', 'Valider & Clôturer')}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteSchedule(item.id)}
                                  className="h-8 w-8 p-0 text-rose-500 hover:bg-rose-500/10 rounded-lg"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card className="border-border overflow-hidden">
            <CardHeader className="border-b border-border/70 py-3.5 px-5">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Gauge className="w-4 h-4 text-primary" />
                <span>{t('سجل مصاريف الصيانة السابقة', 'Historique des dépenses de maintenance')}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/40 text-muted-foreground text-xs">
                      <th className="py-3 px-4 text-start font-semibold">{t('رقم الشاحنة', 'Camion')}</th>
                      <th className="py-3 px-4 text-start font-semibold">{t('نوع الصيانة', 'Type')}</th>
                      <th className="py-3 px-4 text-start font-semibold">{t('التاريخ', 'Date')}</th>
                      <th className="py-3 px-4 text-start font-semibold">{t('المبلغ', 'Montant')}</th>
                      <th className="py-3 px-4 text-start font-semibold">{t('الورشة / الملاحظات', 'Atelier / Remarques')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60 text-xs">
                    {records.slice(0, 15).map((rec) => {
                      const truck = trucks.find((t) => t.id === rec.truck_id);
                      return (
                        <tr key={rec.id} className="hover:bg-muted/30 transition-colors">
                          <td className="py-3 px-4 font-mono font-bold">
                            {truck ? <MatriculeBadge plate={truck.plate_number} variant="badge" size="xs" /> : `${t('شاحنة #', 'Camion #')}${rec.truck_id}`}
                          </td>
                          <td className="py-3 px-4 font-medium">{rec.expense_type || rec.type || t('صيانة عامة', 'Entretien général')}</td>
                          <td className="py-3 px-4 font-mono">{rec.maintenance_date || rec.date || '—'}</td>
                          <td className="py-3 px-4 font-mono font-bold text-rose-600" dir="ltr">
                            -{formatCurrency(rec.amount, rec.currency || 'MAD')}
                          </td>
                          <td className="py-3 px-4 text-muted-foreground truncate max-w-xs">{rec.description || rec.notes || '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <MaintenanceSchedulerModal
        isOpen={isSchedulerOpen}
        onClose={() => setIsSchedulerOpen(false)}
        onSaved={fetchData}
        trucks={trucks}
        trailers={trailers}
      />

      <CompleteMaintenanceModal
        schedule={selectedScheduleToComplete}
        onClose={() => setSelectedScheduleToComplete(null)}
        onCompleted={fetchData}
      />
    </div>
  );
}
