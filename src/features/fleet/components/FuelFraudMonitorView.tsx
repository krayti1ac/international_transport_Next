'use client';

import { useState, useTransition } from 'react';
import Decimal from 'decimal.js';
import { useTranslations, useLocale } from 'next-intl';
import {
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Fuel,
  Droplets,
  MapPin,
  TrendingDown,
  RotateCw,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  FileText,
  DollarSign,
  Activity,
  Layers,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type {
  FuelTheftIncidentRecord,
  FuelFraudKpiStats,
  FuelIncidentType,
  IncidentSeverity,
  IncidentStatus,
  AntiSiphoningDetectionInput,
} from '../types/fuel-fraud.types';
import {
  detectTripFuelFraudAction,
  confirmIncidentDeductionAction,
  resolveIncidentJustificationAction,
} from '../services/fuel-fraud.actions';

Decimal.config({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

interface FuelFraudMonitorViewProps {
  initialIncidents: FuelTheftIncidentRecord[];
  initialStats: FuelFraudKpiStats;
}

export function FuelFraudMonitorView({
  initialIncidents,
  initialStats,
}: FuelFraudMonitorViewProps) {
  const t = useTranslations('fuelFraud');
  const locale = useLocale();
  const isRtl = locale === 'ar';

  const [incidents, setIncidents] = useState<FuelTheftIncidentRecord[]>(initialIncidents);
  const [stats, setStats] = useState<FuelFraudKpiStats>(initialStats);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [isPending, startTransition] = useTransition();
  const [scanning, setScanning] = useState<boolean>(false);

  // Modal States
  const [selectedIncident, setSelectedIncident] = useState<FuelTheftIncidentRecord | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState<boolean>(false);
  const [isDeductOpen, setIsDeductOpen] = useState<boolean>(false);
  const [isJustifyOpen, setIsJustifyOpen] = useState<boolean>(false);
  const [actionNotes, setActionNotes] = useState<string>('');

  // 1. Filtered incidents
  const filteredIncidents = incidents.filter((inc) => {
    if (statusFilter !== 'all' && inc.status !== statusFilter) return false;
    if (severityFilter !== 'all' && inc.severity !== severityFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const plate = inc.truck?.plate_number?.toLowerCase() || '';
      const driver = inc.driver?.full_name?.toLowerCase() || inc.driver?.name?.toLowerCase() || '';
      const loc = inc.location_name?.toLowerCase() || '';
      if (!plate.includes(q) && !driver.includes(q) && !loc.includes(q)) return false;
    }
    return true;
  });

  // 2. Incident Type Helpers
  const getIncidentTypeLabel = (type: FuelIncidentType) => {
    switch (type) {
      case 'rapid_siphoning':
        return isRtl ? 'شفط وقود مفاجئ' : locale === 'es' ? 'Sifonaje brusco' : 'Siphonage rapide';
      case 'tank_overflow':
        return isRtl ? 'تجاوز سعة الخزان' : locale === 'es' ? 'Exceso de capacidad' : 'Dépassement réservoir';
      case 'ghost_refueling':
        return isRtl ? 'تزود وهمي / تضخيم' : locale === 'es' ? 'Repostaje ficticio' : 'Plein fictif';
      case 'geofence_mismatch':
        return isRtl ? 'تضارب موقع المحطة' : locale === 'es' ? 'Discrepancia GPS' : 'Incohérence GPS';
      case 'abnormal_burn_rate':
        return isRtl ? 'استهلاك زائد غير طبيعي' : locale === 'es' ? 'Consumo anómalo' : 'Surconsommation';
      default:
        return type;
    }
  };

  const getIncidentTypeIcon = (type: FuelIncidentType) => {
    switch (type) {
      case 'rapid_siphoning':
        return <Droplets className="w-4 h-4 text-rose-500 animate-pulse" />;
      case 'tank_overflow':
        return <AlertTriangle className="w-4 h-4 text-amber-500" />;
      case 'ghost_refueling':
        return <Fuel className="w-4 h-4 text-purple-500" />;
      case 'geofence_mismatch':
        return <MapPin className="w-4 h-4 text-blue-500" />;
      case 'abnormal_burn_rate':
        return <TrendingDown className="w-4 h-4 text-orange-500" />;
    }
  };

  const getSeverityBadge = (severity: IncidentSeverity) => {
    switch (severity) {
      case 'critical':
        return <Badge variant="destructive" className="bg-rose-600/90 hover:bg-rose-700">{isRtl ? 'حرج جداً' : 'Critique'}</Badge>;
      case 'high':
        return <Badge className="bg-amber-600 hover:bg-amber-700 text-white">{isRtl ? 'مرتفع' : 'Élevé'}</Badge>;
      case 'medium':
        return <Badge variant="secondary" className="bg-blue-500/20 text-blue-700 dark:text-blue-300">{isRtl ? 'متوسط' : 'Moyen'}</Badge>;
      case 'low':
        return <Badge variant="outline">{isRtl ? 'منخفض' : 'Faible'}</Badge>;
    }
  };

  const getStatusBadge = (status: IncidentStatus) => {
    switch (status) {
      case 'detected':
        return <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30">{t('filterDetected')}</Badge>;
      case 'confirmed_deduction':
        return <Badge className="bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-500/30">{t('filterConfirmed')}</Badge>;
      case 'justified':
        return <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">{t('filterJustified')}</Badge>;
      case 'dismissed':
        return <Badge variant="outline" className="text-muted-foreground">{t('filterDismissed')}</Badge>;
    }
  };

  // 3. Trigger Interactive Telematics Fraud Simulation Scan
  const handleRunRadarScan = () => {
    setScanning(true);
    startTransition(async () => {
      // Simulate real CAN-Bus telemetry with rapid siphoning and tank overfill
      const sampleScanInput: AntiSiphoningDetectionInput = {
        truckConfig: {
          truckId: 101,
          plateNumber: '84920-A-26',
          tankCapacityLiters: 850,
          standardRateL100km: 34.0,
          fuelPricePerLiterMad: 14.5,
        },
        dataPoints: [
          {
            timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
            fuelLevelLiters: 480,
            speedKmh: 75,
            engineStatus: 'ON',
            latitude: 35.75,
            longitude: -5.81,
          },
          {
            timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
            fuelLevelLiters: 472,
            speedKmh: 0,
            engineStatus: 'OFF',
            latitude: 35.735,
            longitude: -5.822,
          },
          // Siphoning event: 34 liters vanished in 5 minutes with engine OFF
          {
            timestamp: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
            fuelLevelLiters: 438,
            speedKmh: 0,
            engineStatus: 'OFF',
            latitude: 35.735,
            longitude: -5.822,
          },
        ],
        receipts: [
          {
            receiptId: 'REC-9941',
            liters: 950, // Exceeds 850L tank capacity!
            unitPrice: 14.5,
            totalAmount: 13775,
            currency: 'MAD',
            stationName: 'Afriquia Tanger Med Port',
            stationLatitude: 35.885,
            stationLongitude: -5.505,
            timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
          },
        ],
      };

      const res = await detectTripFuelFraudAction(sampleScanInput);
      setScanning(false);

      if (res.success && res.summary) {
        // Create local optimistic records
        const newRecords: FuelTheftIncidentRecord[] = res.summary.incidents.map((anom, idx) => ({
          id: `local-scan-${Date.now()}-${idx}`,
          company_id: 'default-co',
          truck_id: 101,
          driver_id: 'drv-01',
          trip_id: null,
          incident_type: anom.incidentType,
          severity: anom.severity,
          detected_loss_liters: anom.detectedLossLiters,
          financial_loss_mad: anom.financialLossMad,
          fuel_price_per_liter: 14.5,
          confidence_score: anom.confidenceScore,
          status: 'detected',
          gps_latitude: anom.gpsLatitude ?? null,
          gps_longitude: anom.gpsLongitude ?? null,
          location_name: anom.locationName ?? 'Tanger Med Highway Rest Area',
          telematics_snapshot: anom.snapshot,
          justification_notes: null,
          deduction_reference_id: null,
          reviewed_by: null,
          reviewed_at: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          truck: {
            id: 101,
            plate_number: '84920-A-26',
            model: 'Volvo FH 500 Globetrotter',
            fuel_consumption_rate: 34.0,
          },
          driver: {
            id: 'drv-01',
            full_name: 'محمد بلقاسم (Mohamed Belkacem)',
            phone: '+212661234567',
          },
        }));

        setIncidents((prev) => [...newRecords, ...prev]);

        // Update Stats
        const addLiters = new Decimal(res.summary.totalLossLiters);
        const addMad = new Decimal(res.summary.totalLossMad);
        setStats((prev) => ({
          ...prev,
          activeIncidentsCount: prev.activeIncidentsCount + newRecords.length,
          totalLossLiters: Number(new Decimal(prev.totalLossLiters).plus(addLiters).toFixed(2)),
          totalFinancialLossMad: Number(new Decimal(prev.totalFinancialLossMad).plus(addMad).toFixed(2)),
          siphoningCount: prev.siphoningCount + (res.summary?.incidents.filter(i => i.incidentType === 'rapid_siphoning').length || 0),
          overflowCount: prev.overflowCount + (res.summary?.incidents.filter(i => i.incidentType === 'tank_overflow').length || 0),
        }));
      }
    });
  };

  // 4. Confirm Driver Deduction
  const handleConfirmDeduction = () => {
    if (!selectedIncident) return;
    startTransition(async () => {
      if (!selectedIncident.id.startsWith('local-scan-')) {
        await confirmIncidentDeductionAction({
          incidentId: selectedIncident.id,
          notes: actionNotes || 'خصم مؤكد لمخالفة وقود من عهدة السائق',
        });
      }

      setIncidents((prev) =>
        prev.map((i) =>
          i.id === selectedIncident.id
            ? {
                ...i,
                status: 'confirmed_deduction',
                justification_notes: actionNotes,
                reviewed_at: new Date().toISOString(),
              }
            : i
        )
      );

      setStats((prev) => ({
        ...prev,
        activeIncidentsCount: Math.max(0, prev.activeIncidentsCount - 1),
        confirmedDeductionsCount: prev.confirmedDeductionsCount + 1,
      }));

      setIsDeductOpen(false);
      setSelectedIncident(null);
      setActionNotes('');
    });
  };

  // 5. Accept Justification or Dismiss
  const handleResolveJustification = (resolution: 'justified' | 'dismissed') => {
    if (!selectedIncident) return;
    startTransition(async () => {
      if (!selectedIncident.id.startsWith('local-scan-')) {
        await resolveIncidentJustificationAction({
          incidentId: selectedIncident.id,
          justificationNotes: actionNotes || 'تم تبرير الفاقد وتقديم التوضيح الفني اللازم',
          resolution,
        });
      }

      setIncidents((prev) =>
        prev.map((i) =>
          i.id === selectedIncident.id
            ? {
                ...i,
                status: resolution,
                justification_notes: actionNotes,
                reviewed_at: new Date().toISOString(),
              }
            : i
        )
      );

      setStats((prev) => ({
        ...prev,
        activeIncidentsCount: Math.max(0, prev.activeIncidentsCount - 1),
      }));

      setIsJustifyOpen(false);
      setSelectedIncident(null);
      setActionNotes('');
    });
  };

  return (
    <div className="space-y-6" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 p-6 bg-gradient-to-r from-slate-900 via-rose-950 to-slate-900 text-white rounded-2xl shadow-xl border border-rose-900/30">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-rose-500/20 border border-rose-500/30 rounded-xl text-rose-400">
              <ShieldAlert className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
              <p className="text-sm text-slate-300">{t('subtitle')}</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            onClick={handleRunRadarScan}
            disabled={scanning || isPending}
            className="bg-rose-600 hover:bg-rose-700 text-white font-medium shadow-lg shadow-rose-900/40 gap-2"
          >
            <RotateCw className={`w-4 h-4 ${scanning ? 'animate-spin' : ''}`} />
            {scanning ? t('scanning') : t('radarScan')}
          </Button>
        </div>
      </div>

      {/* Bento Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Active Alerts */}
        <Card className="border-rose-500/20 bg-rose-500/[0.03] shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('activeAlerts')}
            </CardTitle>
            <div className="p-2 bg-rose-500/10 rounded-lg text-rose-600 dark:text-rose-400">
              <ShieldAlert className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-rose-600 dark:text-rose-400">
              {stats.activeIncidentsCount}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.siphoningCount} {t('siphoningCount')} • {stats.overflowCount} {t('overflowCount')}
            </p>
          </CardContent>
        </Card>

        {/* Total Lost Volume */}
        <Card className="border-border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('totalLossVolume')}
            </CardTitle>
            <div className="p-2 bg-amber-500/10 rounded-lg text-amber-600 dark:text-amber-400">
              <Droplets className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Intl.NumberFormat(locale === 'ar' ? 'ar-MA' : 'fr-FR', {
                maximumFractionDigits: 1,
              }).format(stats.totalLossLiters)}{' '}
              <span className="text-sm font-normal text-muted-foreground">L</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {t('ghostCount')}: {stats.ghostRefuelingCount}
            </p>
          </CardContent>
        </Card>

        {/* Total Financial Loss */}
        <Card className="border-border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('totalLossFinancial')}
            </CardTitle>
            <div className="p-2 bg-purple-500/10 rounded-lg text-purple-600 dark:text-purple-400">
              <DollarSign className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
              {new Intl.NumberFormat(locale === 'ar' ? 'ar-MA' : 'fr-FR', {
                maximumFractionDigits: 2,
              }).format(stats.totalFinancialLossMad)}{' '}
              <span className="text-sm font-normal text-muted-foreground">MAD</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              ~{' '}
              {new Intl.NumberFormat('fr-FR', {
                maximumFractionDigits: 2,
              }).format(new Decimal(stats.totalFinancialLossMad).dividedBy(10.8).toNumber())}{' '}
              EUR
            </p>
          </CardContent>
        </Card>

        {/* Confirmed Deductions */}
        <Card className="border-border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('confirmedDeductions')}
            </CardTitle>
            <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {stats.confirmedDeductionsCount}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {isRtl ? 'تم تحصيلها في كشوفات المخالصة' : 'Retenues actées sur quitus'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filter Toolbar */}
      <Card className="p-4 shadow-sm border-border">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 justify-between">
          <div className="flex flex-wrap items-center gap-2 flex-1">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="w-4 h-4 absolute top-1/2 -translate-y-1/2 start-3 text-muted-foreground" />
              <Input
                placeholder={isRtl ? 'بحث بالشاحنة، السائق، أو الموقع...' : 'Recherche par camion, chauffeur...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="ps-9 h-9"
              />
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px] h-9">
                <SelectValue placeholder={t('filterAll')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('filterAll')}</SelectItem>
                <SelectItem value="detected">{t('filterDetected')}</SelectItem>
                <SelectItem value="confirmed_deduction">{t('filterConfirmed')}</SelectItem>
                <SelectItem value="justified">{t('filterJustified')}</SelectItem>
                <SelectItem value="dismissed">{t('filterDismissed')}</SelectItem>
              </SelectContent>
            </Select>

            <Select value={severityFilter} onValueChange={setSeverityFilter}>
              <SelectTrigger className="w-[130px] h-9">
                <SelectValue placeholder="الخطورة" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل المستويات</SelectItem>
                <SelectItem value="critical">حرج جداً</SelectItem>
                <SelectItem value="high">مرتفع</SelectItem>
                <SelectItem value="medium">متوسط</SelectItem>
                <SelectItem value="low">منخفض</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="text-xs text-muted-foreground self-center">
            {filteredIncidents.length} {isRtl ? 'واقعة مسجلة' : 'incidents'}
          </div>
        </div>
      </Card>

      {/* Incidents Table / List */}
      <Card className="shadow-sm border-border overflow-hidden">
        <CardHeader className="border-b bg-muted/30 px-6 py-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold">{t('tableTitle')}</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {filteredIncidents.length === 0 ? (
            <div className="text-center py-16 px-4 space-y-3">
              <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-600 mx-auto flex items-center justify-center">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-semibold">{t('noIncidentsFound')}</h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                {t('cleanFleetMsg')}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/20 text-muted-foreground text-xs">
                    <th className="py-3 px-4 text-start font-medium">{t('incidentType')}</th>
                    <th className="py-3 px-4 text-start font-medium">{t('truck')}</th>
                    <th className="py-3 px-4 text-start font-medium">{t('driver')}</th>
                    <th className="py-3 px-4 text-start font-medium">{t('lossLiters')}</th>
                    <th className="py-3 px-4 text-start font-medium">{t('lossFinancial')}</th>
                    <th className="py-3 px-4 text-start font-medium">{t('confidenceScore')}</th>
                    <th className="py-3 px-4 text-start font-medium">{t('status')}</th>
                    <th className="py-3 px-4 text-center font-medium">{t('actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredIncidents.map((incident) => {
                    const lossDec = new Decimal(incident.detected_loss_liters);
                    const costDec = new Decimal(incident.financial_loss_mad);

                    return (
                      <tr key={incident.id} className="hover:bg-muted/30 transition-colors">
                        {/* Incident Type & Severity */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2">
                            {getIncidentTypeIcon(incident.incident_type)}
                            <div>
                              <div className="font-semibold text-foreground flex items-center gap-1.5">
                                {getIncidentTypeLabel(incident.incident_type)}
                                {getSeverityBadge(incident.severity)}
                              </div>
                              <div className="text-xs text-muted-foreground mt-0.5">
                                {new Date(incident.created_at).toLocaleString(locale === 'ar' ? 'ar-MA' : 'fr-FR', {
                                  dateStyle: 'short',
                                  timeStyle: 'short',
                                })}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Truck */}
                        <td className="py-3.5 px-4 font-medium">
                          {incident.truck?.plate_number || '84920-A-26'}
                          <div className="text-xs text-muted-foreground font-normal">
                            {incident.truck?.model || 'Volvo FH'}
                          </div>
                        </td>

                        {/* Driver */}
                        <td className="py-3.5 px-4">
                          <div className="font-medium">
                            {incident.driver?.full_name || incident.driver?.name || 'سائق غير معين'}
                          </div>
                          {incident.driver?.phone && (
                            <div className="text-xs text-muted-foreground" dir="ltr">
                              {incident.driver.phone}
                            </div>
                          )}
                        </td>

                        {/* Loss Liters */}
                        <td className="py-3.5 px-4 font-bold text-rose-600 dark:text-rose-400">
                          -{lossDec.toFixed(1)} L
                        </td>

                        {/* Financial Loss */}
                        <td className="py-3.5 px-4 font-semibold">
                          {costDec.toFixed(2)} MAD
                        </td>

                        {/* Confidence Score */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2">
                            <div className="w-16 bg-muted rounded-full h-2 overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  incident.confidence_score >= 90
                                    ? 'bg-rose-500'
                                    : incident.confidence_score >= 80
                                    ? 'bg-amber-500'
                                    : 'bg-blue-500'
                                }`}
                                style={{ width: `${incident.confidence_score}%` }}
                              />
                            </div>
                            <span className="text-xs font-semibold">{incident.confidence_score}%</span>
                          </div>
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-4">{getStatusBadge(incident.status)}</td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 px-2"
                              onClick={() => {
                                setSelectedIncident(incident);
                                setIsDetailOpen(true);
                              }}
                            >
                              <FileText className="w-3.5 h-3.5 me-1" />
                              {t('viewDetails')}
                            </Button>

                            {incident.status === 'detected' && (
                              <>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  className="h-8 px-2 bg-rose-600 hover:bg-rose-700"
                                  onClick={() => {
                                    setSelectedIncident(incident);
                                    setIsDeductOpen(true);
                                  }}
                                >
                                  {t('confirmDeduction')}
                                </Button>

                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8 px-2"
                                  onClick={() => {
                                    setSelectedIncident(incident);
                                    setIsJustifyOpen(true);
                                  }}
                                >
                                  {t('acceptJustification')}
                                </Button>
                              </>
                            )}
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

      {/* Incident Detail Modal */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-lg" dir={isRtl ? 'rtl' : 'ltr'}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-rose-500" />
              تفاصيل واقعة الاشتباه بالوقود
            </DialogTitle>
            <DialogDescription>
              سجل التتبع والبيانات اللحظية المستخرجة من أجهزة الاستشعار
            </DialogDescription>
          </DialogHeader>

          {selectedIncident && (
            <div className="space-y-4 py-2 text-sm">
              <div className="grid grid-cols-2 gap-3 p-3 bg-muted/40 rounded-xl">
                <div>
                  <span className="text-muted-foreground text-xs block">الشاحنة:</span>
                  <span className="font-semibold">{selectedIncident.truck?.plate_number}</span>
                </div>
                <div>
                  <span className="text-muted-foreground text-xs block">السائق:</span>
                  <span className="font-semibold">{selectedIncident.driver?.full_name || selectedIncident.driver?.name}</span>
                </div>
                <div>
                  <span className="text-muted-foreground text-xs block">الكمية المفقودة:</span>
                  <span className="font-bold text-rose-600">
                    {selectedIncident.detected_loss_liters} لتر
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground text-xs block">الخسارة المقدرة:</span>
                  <span className="font-bold text-rose-600">
                    {selectedIncident.financial_loss_mad} درهم
                  </span>
                </div>
              </div>

              {selectedIncident.gps_latitude && (
                <div className="flex items-center justify-between p-3 border rounded-xl">
                  <div className="flex items-center gap-2 text-xs">
                    <MapPin className="w-4 h-4 text-blue-500" />
                    <span>
                      الإحداثيات: {selectedIncident.gps_latitude}, {selectedIncident.gps_longitude}
                    </span>
                  </div>
                  <a
                    href={`https://www.google.com/maps?q=${selectedIncident.gps_latitude},${selectedIncident.gps_longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                  >
                    عرض على خرائط Google <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}

              {/* Telematics Snapshot JSON */}
              <div className="space-y-1.5">
                <span className="text-xs font-semibold text-muted-foreground">
                  بيانات الحساسات الملتقطة (Telematics Snapshot):
                </span>
                <pre className="p-3 bg-slate-950 text-emerald-400 rounded-xl text-xs overflow-x-auto max-h-48 font-mono">
                  {JSON.stringify(selectedIncident.telematics_snapshot, null, 2)}
                </pre>
              </div>

              {selectedIncident.justification_notes && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                  <span className="text-xs font-semibold text-amber-700 dark:text-amber-400 block mb-1">
                    ملاحظات التبرير أو الخصم:
                  </span>
                  <p className="text-xs text-foreground">{selectedIncident.justification_notes}</p>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDetailOpen(false)}>
              إغلاق
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Deduction Modal */}
      <Dialog open={isDeductOpen} onOpenChange={setIsDeductOpen}>
        <DialogContent className="max-w-md" dir={isRtl ? 'rtl' : 'ltr'}>
          <DialogHeader>
            <DialogTitle className="text-rose-600 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              {t('confirmDeductionTitle')}
            </DialogTitle>
            <DialogDescription>{t('confirmDeductionDesc')}</DialogDescription>
          </DialogHeader>

          {selectedIncident && (
            <div className="space-y-4 py-2">
              <div className="p-3 bg-rose-50 dark:bg-rose-950/40 rounded-xl border border-rose-200 dark:border-rose-900/50 text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">السائق المستهدف:</span>
                  <span className="font-semibold">{selectedIncident.driver?.full_name || selectedIncident.driver?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">المبلغ المقتطع:</span>
                  <span className="font-bold text-rose-600">
                    {selectedIncident.financial_loss_mad} MAD
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold">{t('justificationNotes')}</label>
                <textarea
                  className="w-full rounded-xl border border-input bg-background p-3 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  placeholder="اكتب سبب ومبرر اعتماد الخصم على السائق..."
                  value={actionNotes}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setActionNotes(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeductOpen(false)}>
              {t('cancel')}
            </Button>
            <Button
              variant="destructive"
              disabled={isPending}
              onClick={handleConfirmDeduction}
              className="bg-rose-600 hover:bg-rose-700"
            >
              {t('confirmButton')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Justify / Dismiss Modal */}
      <Dialog open={isJustifyOpen} onOpenChange={setIsJustifyOpen}>
        <DialogContent className="max-w-md" dir={isRtl ? 'rtl' : 'ltr'}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              {t('acceptJustification')}
            </DialogTitle>
            <DialogDescription>
              تسجيل التوضيح الفني للسائق واستبعاد الواقعة من الخصومات المالية
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold">{t('justificationNotes')}</label>
              <textarea
                className="w-full rounded-xl border border-input bg-background p-3 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                placeholder="أدخل مبرر السائق (مثلاً: تنفيس خزان الوقود، معايرة الحساس، تسرب ميكانيكي مع تقرير ورشة)..."
                value={actionNotes}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setActionNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsJustifyOpen(false)}>
              {t('cancel')}
            </Button>
            <Button
              variant="secondary"
              disabled={isPending}
              onClick={() => handleResolveJustification('dismissed')}
            >
              {t('dismiss')}
            </Button>
            <Button
              disabled={isPending || !actionNotes.trim()}
              onClick={() => handleResolveJustification('justified')}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {t('acceptJustification')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
