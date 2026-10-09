'use client';

import React, { useState, useTransition } from 'react';
import { useLanguage } from '@/components/language-provider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Clock,
  Gauge,
  Activity,
  Search,
  RefreshCw,
  PlusCircle,
  Truck,
  User,
  AlertOctagon,
  CheckCircle2,
  Euro,
  Calendar,
  X,
  MessageSquare,
  MapPin,
} from 'lucide-react';
import type {
  DriverComplianceStatusResult,
  FleetComplianceRadarSummary,
  TachographActivityType,
  TachographRadarStatus,
} from '../types/tachograph.types';
import {
  getFleetComplianceRadarAction,
  logDriverActivityAction,
  triggerDriverRestAlertAction,
} from '../services/tachograph.actions';


interface TachographComplianceRadarViewProps {
  initialSummary: FleetComplianceRadarSummary;
}

export function TachographComplianceRadarView({
  initialSummary,
}: TachographComplianceRadarViewProps) {
  const { t, dir } = useLanguage();
  const [summary, setSummary] = useState<FleetComplianceRadarSummary>(initialSummary);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isPending, startTransition] = useTransition();

  // Quick activity log modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDriverId, setSelectedDriverId] = useState<number | null>(null);
  const [modalActivityType, setModalActivityType] = useState<TachographActivityType>('drive');
  const [modalDurationMinutes, setModalDurationMinutes] = useState<number>(45);
  const [modalLocation, setModalLocation] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  // WhatsApp rest alert state
  const [sendingAlertDriverId, setSendingAlertDriverId] = useState<number | null>(null);
  const [alertFeedback, setAlertFeedback] = useState<{
    driverId: number;
    message: string;
    success: boolean;
  } | null>(null);

  const handleSendWhatsAppRestAlert = async (driverId: number) => {
    setSendingAlertDriverId(driverId);
    setAlertFeedback(null);
    const res = await triggerDriverRestAlertAction(driverId, {
      forceSend: true,
      language: dir === 'rtl' ? 'ar' : 'fr',
    });
    setSendingAlertDriverId(null);
    if (res.success && res.alertSent) {
      setAlertFeedback({
        driverId,
        message: t(
          `تم إرسال تنبيه الواتساب مع باحة (${res.parking?.name || 'SSTPA'}) بنجاح!`,
          `Alerte envoyée avec succès avec (${res.parking?.name || 'SSTPA'}) !`,
          `¡Alerta enviada con éxito hacia (${res.parking?.name || 'SSTPA'})!`
        ),
        success: true,
      });
    } else {
      setAlertFeedback({
        driverId,
        message: res.error || t('فشل إرسال التنبيه', "Échec de l'envoi", 'Error al enviar'),
        success: false,
      });
    }
  };


  const refreshRadar = () => {
    startTransition(async () => {
      const res = await getFleetComplianceRadarAction({
        radar_status: statusFilter as any,
        search: searchQuery,
      });
      if (res.success && res.summary) {
        setSummary(res.summary);
      }
    });
  };

  const handleFilterChange = (filter: string) => {
    setStatusFilter(filter);
    startTransition(async () => {
      const res = await getFleetComplianceRadarAction({
        radar_status: filter as any,
        search: searchQuery,
      });
      if (res.success && res.summary) {
        setSummary(res.summary);
      }
    });
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    refreshRadar();
  };

  const openLogModal = (driverId?: number) => {
    setSelectedDriverId(driverId || (summary.drivers[0]?.driver_id ?? null));
    setFeedbackMessage(null);
    setIsModalOpen(true);
  };

  const handleLogActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDriverId) return;

    setIsSubmitting(true);
    setFeedbackMessage(null);

    const startTime = new Date(Date.now() - modalDurationMinutes * 60000).toISOString();
    const endTime = new Date().toISOString();

    const res = await logDriverActivityAction({
      driver_id: selectedDriverId,
      activity_type: modalActivityType,
      start_time: startTime,
      end_time: endTime,
      duration_minutes: modalDurationMinutes,
      start_location: modalLocation || undefined,
      country_code: 'MA',
    });

    setIsSubmitting(false);

    if (res.success) {
      setFeedbackMessage(
        t('تم تسجيل النشاط وتحديث الرادار بنجاح', 'Activité enregistrée avec succès', 'Actividad registrada con éxito')
      );
      setTimeout(() => {
        setIsModalOpen(false);
        refreshRadar();
      }, 1000);
    } else {
      setFeedbackMessage(res.error || t('حدث خطأ أثناء الحفظ', 'Erreur lors de la sauvegarde', 'Error al guardar'));
    }
  };

  const filteredDrivers = summary.drivers.filter((driver) => {
    const matchesSearch =
      !searchQuery ||
      (driver.driver_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (driver.truck_plate || '').toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus =
      statusFilter === 'all' || driver.radar_status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: TachographRadarStatus) => {
    switch (status) {
      case 'compliant':
        return (
          <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 font-semibold flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            {t('ملتزم نظامياً', 'Conforme', 'Conforme')}
          </Badge>
        );
      case 'warning':
        return (
          <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 font-semibold flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5" />
            {t('تنبيه اقتراب الحد', 'Avertissement', 'Aviso preventivo')}
          </Badge>
        );
      case 'critical_urgency':
        return (
          <Badge className="bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20 font-semibold animate-pulse flex items-center gap-1">
            <AlertOctagon className="w-3.5 h-3.5" />
            {t('حرج جداً (≤15 د)', 'Urgence critique', 'Urgencia crítica')}
          </Badge>
        );
      case 'violation':
        return (
          <Badge variant="destructive" className="font-bold flex items-center gap-1">
            <ShieldAlert className="w-3.5 h-3.5" />
            {t('مخالفة قواعد القيادة', 'Infraction', 'Infracción')}
          </Badge>
        );
    }
  };

  const getActivityBadge = (activity: TachographActivityType) => {
    switch (activity) {
      case 'drive':
        return (
          <Badge className="bg-blue-600 text-white flex items-center gap-1">
            <Truck className="w-3 h-3" />
            {t('قيادة', 'Conduite', 'Conducción')}
          </Badge>
        );
      case 'rest':
        return (
          <Badge className="bg-emerald-600 text-white flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {t('راحة / استراحة', 'Repos / Pause', 'Descanso')}
          </Badge>
        );
      case 'work':
        return (
          <Badge className="bg-purple-600 text-white flex items-center gap-1">
            <Activity className="w-3 h-3" />
            {t('عمل آخر', 'Autre travail', 'Otro trabajo')}
          </Badge>
        );
      case 'available':
        return (
          <Badge className="bg-slate-500 text-white flex items-center gap-1">
            <Gauge className="w-3 h-3" />
            {t('جاهزية', 'Disponibilité', 'Disponibilidad')}
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-6" dir={dir}>
      {/* 1. Header & Quick Action */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-border/40">
        <div>
          <div className="flex items-center gap-2">
            <Gauge className="w-7 h-7 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight">
              {t(
                'رادار التاكوغراف وامتثال أوقات القيادة الأوروبية (EC 561/2006)',
                'Radar Tachygraphe & Conformité CE 561/2006',
                'Radar Tacógrafo y Conformidad CE 561/2006'
              )}
            </h1>
            <Badge variant="outline" className="text-xs bg-primary/5 text-primary border-primary/20">
              EU Standard (EC 561/2006)
            </Badge>
            <Badge
              variant="outline"
              className="text-xs bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 font-medium flex items-center gap-1.5"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              {t(
                'تزامن حي FMS / CAN-Bus (J1939)',
                'Sync Direct FMS / CAN-Bus (J1939)',
                'Sincronización Directa FMS / CAN-Bus (J1939)'
              )}
            </Badge>
          </div>

          <p className="text-sm text-muted-foreground mt-1">
            {t(
              'مراقبة فورية للقيادة المتواصلة (4.5 س)، فترات الراحة الإلزامية (45 د)، وسقوف القيادة اليومية والأسبوعية للأسطول الدولي',
              'Surveillance en direct des temps de conduite continue (4.5h), pauses obligatoires (45m) et plafonds CE',
              'Monitoreo en vivo de tiempos de conducción continua (4.5h), pausas reglamentarias (45m) y techos CE'
            )}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={refreshRadar}
            disabled={isPending}
            className="flex items-center gap-1.5"
          >
            <RefreshCw className={`w-4 h-4 ${isPending ? 'animate-spin' : ''}`} />
            {t('تحديث الرادار', 'Actualiser', 'Actualizar')}
          </Button>

          <Button
            size="sm"
            onClick={() => openLogModal()}
            className="flex items-center gap-1.5 bg-primary text-primary-foreground shadow-sm"
          >
            <PlusCircle className="w-4 h-4" />
            {t('تسجيل نشاط تاكوغراف', 'Enregistrer Activité', 'Registrar Actividad')}
          </Button>
        </div>
      </div>

      {/* 2. Executive Bento KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Monitored Drivers */}
        <Card className="shadow-xs border-border/60">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium">
                {t('السائقون المشمولون', 'Chauffeurs Actifs', 'Conductores')}
              </span>
              <User className="w-4 h-4" />
            </div>
            <div className="mt-2 text-2xl font-bold">{summary.total_monitored_drivers}</div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {t('أسطول النقل الدولي', 'Flotte internationale', 'Flota internacional')}
            </p>
          </CardContent>
        </Card>

        {/* Compliant */}
        <Card className="shadow-xs border-emerald-500/20 bg-emerald-500/5">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400">
              <span className="text-xs font-medium">{t('ملتزم نظامياً', 'Conforme', 'Conforme')}</span>
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div className="mt-2 text-2xl font-bold text-emerald-700 dark:text-emerald-300">
              {summary.compliant_count}
            </div>
            <p className="text-[11px] text-emerald-600/80 dark:text-emerald-400/80 mt-0.5">
              {t('ضمن الحدود الآمنة', 'En zone sécurisée', 'En zona segura')}
            </p>
          </CardContent>
        </Card>

        {/* Warning */}
        <Card className="shadow-xs border-amber-500/20 bg-amber-500/5">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-amber-600 dark:text-amber-400">
              <span className="text-xs font-medium">{t('تنبيه (≤45 د)', 'Avis (≤45m)', 'Aviso (≤45m)')}</span>
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div className="mt-2 text-2xl font-bold text-amber-700 dark:text-amber-300">
              {summary.warning_count}
            </div>
            <p className="text-[11px] text-amber-600/80 dark:text-amber-400/80 mt-0.5">
              {t('التخطيط للراحة', 'Planifier pause', 'Planificar pausa')}
            </p>
          </CardContent>
        </Card>

        {/* Critical Urgency */}
        <Card className="shadow-xs border-red-500/20 bg-red-500/5">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-red-600 dark:text-red-400">
              <span className="text-xs font-medium">{t('حرج (≤15 د)', 'Urgence (≤15m)', 'Urgente (≤15m)')}</span>
              <AlertOctagon className="w-4 h-4" />
            </div>
            <div className="mt-2 text-2xl font-bold text-red-700 dark:text-red-300">
              {summary.critical_urgency_count}
            </div>
            <p className="text-[11px] text-red-600/80 dark:text-red-400/80 mt-0.5">
              {t('توقف إلزامي وشيك', 'Arrêt imminent', 'Parada inminente')}
            </p>
          </CardContent>
        </Card>

        {/* Violations */}
        <Card className="shadow-xs border-destructive/30 bg-destructive/5">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-destructive">
              <span className="text-xs font-medium">{t('مخالفة مؤكدة', 'Infraction', 'Infracción')}</span>
              <ShieldAlert className="w-4 h-4" />
            </div>
            <div className="mt-2 text-2xl font-bold text-destructive">{summary.violation_count}</div>
            <p className="text-[11px] text-destructive/80 mt-0.5">
              {t('تجاوز الحدود النظامية', 'Dépassement légal', 'Exceso legal')}
            </p>
          </CardContent>
        </Card>

        {/* EUR Risk Exposure */}
        <Card className="shadow-xs border-primary/20 bg-primary/5">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-primary">
              <span className="text-xs font-medium">
                {t('مخاطر الغرامات', 'Risque Amendes', 'Riesgo Multas')}
              </span>
              <Euro className="w-4 h-4" />
            </div>
            <div className="mt-2 text-2xl font-bold text-primary">
              €{summary.total_risk_exposure_eur}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {t('تقدير الاتحاد الأوروبي', 'Estimation UE', 'Estimación UE')}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 3. Filter Toolbar & Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card p-3 rounded-xl border border-border/60">
        <div className="flex flex-wrap items-center gap-1.5">
          {[
            { id: 'all', label: t('الكل', 'Tous', 'Todos') },
            { id: 'compliant', label: t('الملتزمون', 'Conformes', 'Conformes') },
            { id: 'warning', label: t('تنبيه مبكر', 'Avertissements', 'Avisos') },
            { id: 'critical_urgency', label: t('حرج وشيك', 'Urgents', 'Urgentes') },
            { id: 'violation', label: t('المخالفات', 'Infractions', 'Infracciones') },
          ].map((tab) => (
            <Button
              key={tab.id}
              variant={statusFilter === tab.id ? 'default' : 'ghost'}
              size="sm"
              onClick={() => handleFilterChange(tab.id)}
              className="text-xs h-8 px-3"
            >
              {tab.label}
            </Button>
          ))}
        </div>

        <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-xs">
          <Search className="w-4 h-4 absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t(
              'بحث بالاسم أو الترقيم...',
              'Recherche chauffeur / plaque...',
              'Buscar conductor / matrícula...'
            )}
            className="ps-9 h-8 text-xs bg-background"
          />
        </form>
      </div>

      {/* 4. Drivers Live Radar Cards Grid */}
      {filteredDrivers.length === 0 ? (
        <Card className="text-center py-12 border-dashed border-border/80">
          <CardContent className="space-y-3">
            <Gauge className="w-12 h-12 text-muted-foreground mx-auto opacity-50" />
            <h3 className="text-base font-semibold">
              {t('لا توجد بيانات مطابقة للفلتر', 'Aucun chauffeur correspondant', 'Sin conductores coincidentes')}
            </h3>
            <p className="text-xs text-muted-foreground">
              {t(
                'جرّب تغيير حالة الفلتر أو تسجيل نشاط تاكوغراف جديد.',
                'Modifiez le filtre ou enregistrez une nouvelle activité.',
                'Cambie el filtro o registre una nueva actividad.'
              )}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDrivers.map((driver) => {
            const continuousPercent = Math.min(
              100,
              Math.round((driver.continuous_drive_minutes / 270) * 100)
            );
            const dailyPercent = Math.min(
              100,
              Math.round((driver.daily_drive_minutes / driver.daily_drive_ceiling_minutes) * 100)
            );

            return (
              <Card
                key={driver.driver_id}
                className={`shadow-xs border transition-all ${
                  driver.radar_status === 'violation'
                    ? 'border-destructive/60 bg-destructive/5'
                    : driver.radar_status === 'critical_urgency'
                    ? 'border-red-500/50 bg-red-500/5'
                    : driver.radar_status === 'warning'
                    ? 'border-amber-500/40 bg-amber-500/5'
                    : 'border-border/60 bg-card'
                }`}
              >
                <CardHeader className="p-4 pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <CardTitle className="text-base font-bold flex items-center gap-1.5">
                        <User className="w-4 h-4 text-muted-foreground" />
                        {driver.driver_name || `Driver #${driver.driver_id}`}
                      </CardTitle>
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Truck className="w-3.5 h-3.5" />
                          {driver.truck_plate || t('شاحنة غير محددة', 'Sans camion', 'Sin camión')}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1">
                      {getStatusBadge(driver.radar_status)}
                      {getActivityBadge(driver.current_activity)}
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="p-4 pt-2 space-y-4">
                  {/* Gauge 1: Continuous Driving (Max 4.5h = 270m) */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {t('القيادة المتواصلة', 'Conduite continue', 'Conducción continua')}:
                      </span>
                      <span className="font-semibold">
                        {Math.floor(driver.continuous_drive_minutes / 60)}س{' '}
                        {driver.continuous_drive_minutes % 60}د / 4س 30د
                      </span>
                    </div>

                    <div className="w-full bg-secondary h-2.5 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          driver.continuous_drive_minutes > 270
                            ? 'bg-destructive'
                            : driver.remaining_continuous_drive_minutes <= 15
                            ? 'bg-red-500 animate-pulse'
                            : driver.remaining_continuous_drive_minutes <= 45
                            ? 'bg-amber-500'
                            : 'bg-primary'
                        }`}
                        style={{ width: `${continuousPercent}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>
                        {t('المتبقي للراحة', 'Reste avant pause', 'Restante para pausa')}:{' '}
                        <strong
                          className={
                            driver.remaining_continuous_drive_minutes <= 15
                              ? 'text-red-600 dark:text-red-400 font-bold'
                              : driver.remaining_continuous_drive_minutes <= 45
                              ? 'text-amber-600 dark:text-amber-400 font-bold'
                              : 'text-foreground'
                          }
                        >
                          {driver.remaining_continuous_drive_minutes} {t('دقيقة', 'min', 'min')}
                        </strong>
                      </span>
                      {driver.is_split_break_pending && (
                        <Badge variant="outline" className="text-[10px] bg-blue-500/10 text-blue-600">
                          {t('أنجز 15د (بانتظار 30د)', '15m fait (attente 30m)', '15m hecho')}
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Gauge 2: Daily Driving (9h standard or 10h extended) */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-muted-foreground flex items-center gap-1">
                        <Gauge className="w-3.5 h-3.5" />
                        {t('القيادة اليومية', 'Conduite journalière', 'Conducción diaria')}:
                      </span>
                      <span className="font-semibold">
                        {Math.floor(driver.daily_drive_minutes / 60)}س{' '}
                        {driver.daily_drive_minutes % 60}د /{' '}
                        {driver.daily_drive_ceiling_minutes / 60}س
                      </span>
                    </div>

                    <div className="w-full bg-secondary h-2.5 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          driver.daily_drive_minutes > driver.daily_drive_ceiling_minutes
                            ? 'bg-destructive'
                            : driver.remaining_daily_drive_minutes <= 15
                            ? 'bg-red-500'
                            : driver.remaining_daily_drive_minutes <= 60
                            ? 'bg-amber-500'
                            : 'bg-emerald-600'
                        }`}
                        style={{ width: `${dailyPercent}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>
                        {t('المتبقي اليوم', 'Reste ce jour', 'Restante hoy')}:{' '}
                        <strong>
                          {driver.remaining_daily_drive_minutes} {t('دقيقة', 'min', 'min')}
                        </strong>
                      </span>
                      <span className="text-[10px]">
                        {t('تمديدات 10س', 'Ext. 10h', 'Ext. 10h')}:{' '}
                        <strong>{driver.daily_10h_extensions_used_this_week}/2</strong>
                      </span>
                    </div>
                  </div>

                  {/* Weekly & Fortnightly Summaries */}
                  <div className="grid grid-cols-2 gap-2 text-xs p-2 rounded-lg bg-secondary/40 border border-border/40">
                    <div>
                      <div className="text-[10px] text-muted-foreground">
                        {t('أسبوعي (سقف 56س)', 'Hebdo (Max 56h)', 'Semanal (Máx 56h)')}
                      </div>
                      <div className="font-semibold mt-0.5">
                        {Math.floor(driver.weekly_drive_minutes / 60)}س{' '}
                        {driver.weekly_drive_minutes % 60}د
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-muted-foreground">
                        {t('أسبوعين (سقف 90س)', 'Bi-hebdo (Max 90h)', 'Bisemanal (Máx 90h)')}
                      </div>
                      <div className="font-semibold mt-0.5">
                        {Math.floor(driver.fortnightly_drive_minutes / 60)}س{' '}
                        {driver.fortnightly_drive_minutes % 60}د
                      </div>
                    </div>
                  </div>

                  {/* Infringement / Penalty Exposure Alert Box */}
                  {driver.active_infringements.length > 0 && (
                    <div className="p-2.5 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs space-y-1">
                      <div className="font-bold flex items-center justify-between">
                        <span className="flex items-center gap-1">
                          <ShieldAlert className="w-3.5 h-3.5" />
                          {t('مخالفة نظامية مسجلة', 'Infraction relevée', 'Infracción detectada')}
                        </span>
                        <span className="bg-destructive text-white px-1.5 py-0.5 rounded text-[10px]">
                          €{driver.total_estimated_penalties_eur}
                        </span>
                      </div>
                      <p className="text-[11px] leading-tight opacity-90">
                        {driver.active_infringements[0].description}
                      </p>
                    </div>
                  )}

                  {/* Recommended Tactical Action Callout */}
                  <div className="text-xs p-2.5 rounded-lg bg-primary/5 border border-primary/10 text-foreground">
                    <span className="text-[10px] font-semibold text-primary block mb-0.5">
                      {t('التوجيه الميداني الموصى به', 'Instruction recommandée', 'Instrucción recomendada')}:
                    </span>
                    <p className="text-[11px] leading-relaxed text-muted-foreground">
                      {driver.recommended_action}
                    </p>
                  </div>

                  {/* Rest Alert Feedback Banner if present */}
                  {alertFeedback && alertFeedback.driverId === driver.driver_id && (
                    <div
                      className={`p-2 rounded-lg text-xs flex items-center gap-1.5 ${
                        alertFeedback.success
                          ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                          : 'bg-destructive/10 text-destructive border border-destructive/20'
                      }`}
                    >
                      <MessageSquare className="w-3.5 h-3.5 shrink-0" />
                      <span className="text-[11px] font-medium leading-tight">{alertFeedback.message}</span>
                    </div>
                  )}

                  {/* Actions Row: Quick Activity & WhatsApp Rest Alert */}
                  <div className="flex flex-col gap-1.5">
                    {(driver.radar_status === 'critical_urgency' ||
                      driver.radar_status === 'warning' ||
                      driver.radar_status === 'violation') && (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={sendingAlertDriverId === driver.driver_id}
                        onClick={() => handleSendWhatsAppRestAlert(driver.driver_id)}
                        className="w-full text-xs h-8 flex items-center justify-center gap-1.5 border-emerald-500/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/10 font-semibold"
                      >
                        <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                        {sendingAlertDriverId === driver.driver_id
                          ? t('جاري الإرسال...', 'Envoi en cours...', 'Enviando...')
                          : t(
                              'إرسال تنبيه واتساب مع باحة الاستراحة',
                              'Alerte WhatsApp Parking',
                              'Alerta WhatsApp Parking'
                            )}
                      </Button>
                    )}

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openLogModal(driver.driver_id)}
                      className="w-full text-xs h-8 flex items-center justify-center gap-1"
                    >
                      <PlusCircle className="w-3.5 h-3.5" />
                      {t('تسجيل نشاط لهذا السائق', 'Enregistrer activité', 'Registrar actividad')}
                    </Button>
                  </div>

                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* 5. Quick Log Activity Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-background border rounded-2xl w-full max-w-md shadow-2xl p-6 relative animate-in fade-in zoom-in-95">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute end-4 top-4 text-muted-foreground hover:text-foreground"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold flex items-center gap-2">
              <Gauge className="w-5 h-5 text-primary" />
              {t(
                'تسجيل نشاط تاكوغراف للسائق',
                'Enregistrer Activité Tachygraphe',
                'Registrar Actividad Tacógrafo'
              )}
            </h3>
            <p className="text-xs text-muted-foreground mt-1 mb-4">
              {t(
                'تحديث أزمنة القيادة والراحة وتحديث رادار الامتثال الأوروبي فورياً',
                'Met à jour en direct les temps et le radar CE 561/2006',
                'Actualiza en vivo los tiempos y el radar CE 561/2006'
              )}
            </p>

            {feedbackMessage && (
              <div
                className={`p-3 rounded-lg text-xs mb-4 ${
                  feedbackMessage.includes('بنجاح') || feedbackMessage.includes('succès') || feedbackMessage.includes('éxito')
                    ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                    : 'bg-destructive/10 text-destructive border border-destructive/20'
                }`}
              >
                {feedbackMessage}
              </div>
            )}

            <form onSubmit={handleLogActivity} className="space-y-4">
              {/* Driver Select */}
              <div className="space-y-1">
                <label className="text-xs font-semibold">
                  {t('السائق', 'Chauffeur', 'Conductor')}
                </label>
                <select
                  value={selectedDriverId || ''}
                  onChange={(e) => setSelectedDriverId(Number(e.target.value))}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs"
                  required
                >
                  {summary.drivers.map((d) => (
                    <option key={d.driver_id} value={d.driver_id}>
                      {d.driver_name} ({d.truck_plate || 'No truck'})
                    </option>
                  ))}
                </select>
              </div>

              {/* Activity Type */}
              <div className="space-y-1">
                <label className="text-xs font-semibold">
                  {t('نوع النشاط', "Type d'activité", 'Tipo de actividad')}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'drive', label: t('قيادة (Drive)', 'Conduite', 'Conducción') },
                    { id: 'rest', label: t('راحة / استراحة (Rest)', 'Repos / Pause', 'Descanso') },
                    { id: 'work', label: t('عمل آخر (Work)', 'Autre travail', 'Otro trabajo') },
                    { id: 'available', label: t('جاهزية (Available)', 'Disponibilité', 'Disponibilidad') },
                  ].map((act) => (
                    <button
                      key={act.id}
                      type="button"
                      onClick={() => setModalActivityType(act.id as TachographActivityType)}
                      className={`text-xs p-2 rounded-lg border font-medium text-center transition-all ${
                        modalActivityType === act.id
                          ? 'border-primary bg-primary/10 text-primary font-bold'
                          : 'border-border/60 hover:bg-muted text-muted-foreground'
                      }`}
                    >
                      {act.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Duration Minutes */}
              <div className="space-y-1">
                <label className="text-xs font-semibold">
                  {t('المدة (بالدقائق)', 'Durée (minutes)', 'Duración (minutos)')}
                </label>
                <Input
                  type="number"
                  min="1"
                  max="720"
                  value={modalDurationMinutes}
                  onChange={(e) => setModalDurationMinutes(Number(e.target.value))}
                  className="h-9 text-xs"
                  required
                />
                <div className="flex gap-1.5 pt-1">
                  {[15, 30, 45, 120, 270].map((preset) => (
                    <Button
                      key={preset}
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setModalDurationMinutes(preset)}
                      className="text-[10px] h-6 px-2"
                    >
                      {preset}د
                    </Button>
                  ))}
                </div>
              </div>

              {/* Location (Optional) */}
              <div className="space-y-1">
                <label className="text-xs font-semibold">
                  {t('الموقع / المدينة (اختياري)', 'Lieu / Ville (optionnel)', 'Lugar / Ciudad (opcional)')}
                </label>
                <Input
                  value={modalLocation}
                  onChange={(e) => setModalLocation(e.target.value)}
                  placeholder="Tanger Med Port / Algeciras..."
                  className="h-9 text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsModalOpen(false)}
                >
                  {t('إلغاء', 'Annuler', 'Cancelar')}
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isSubmitting}
                  className="bg-primary text-primary-foreground"
                >
                  {isSubmitting
                    ? t('جاري الحفظ...', 'Enregistrement...', 'Guardando...')
                    : t('تأكيد وتسجيل النشاط', 'Confirmer', 'Confirmar')}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

