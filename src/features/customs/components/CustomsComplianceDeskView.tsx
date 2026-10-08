'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useLanguage } from '@/components/language-provider';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { MatriculeBadge } from '@/components/ui/matricule-badge';
import { useToast } from '@/hooks/use-toast';
import {
  ShieldCheck,
  FileCode,
  CheckCircle2,
  Anchor,
  FileText,
  RefreshCw,
  Send,
  Key,
  Search,
  Check,
  Copy,
  Layers,
  Building2,
  FileCheck2,
} from 'lucide-react';
import { PhytosanitaryDossierTab } from './PhytosanitaryDossierTab';
import {
  getCustomsDeskDataAction,
  submitBadrDumAction,
  submitPortNetManifestAction,
} from '../services/customs-gateway.actions';
import { buildBadrDumXml } from '../services/portnet-badr-edi.service';
import { signCustomsXmlPayload } from '../services/customs-mtls-signer.service';
import type { BadrDumData } from '../types/customs-mtls.types';

export function CustomsComplianceDeskView() {
  const { t, dir, locale } = useLanguage();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState<{
    certificate: any;
    trips: any[];
    stats: {
      totalTrips: number;
      clearedBaeCount: number;
      circuitVertCount: number;
      circuitOrangeCount: number;
      circuitRougeCount: number;
      totalLiquidationMad: number;
    };
  } | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [corridorFilter, setCorridorFilter] = useState<'ALL' | 'MARITIME' | 'OVERLAND'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'CLEARED' | 'PENDING' | 'INSPECTION'>('ALL');
  const [activeDeskTab, setActiveDeskTab] = useState<'edi_submissions' | 'phyto_dossiers'>('edi_submissions');

  // Submitting state tracker for individual trips
  const [submittingTripId, setSubmittingTripId] = useState<{ id: number; action: 'dum' | 'manifest' } | null>(null);

  // XML Inspection Modal state
  const [inspectedXmlTrip, setInspectedXmlTrip] = useState<any | null>(null);
  const [signedXmlPreview, setSignedXmlPreview] = useState<string>('');
  const [copiedXml, setCopiedXml] = useState(false);

  const loadDeskData = useCallback(async (_isRefresh?: boolean) => {
    setRefreshing(true);
    try {
      const res = await getCustomsDeskDataAction();
      if (res.success) {
        setData(res);
      } else {
        toast({
          title: t('خطأ في جلب البيانات', 'Erreur de chargement', 'Error de carga'),
          description: res.error,
          variant: 'destructive',
        });
      }
    } catch (err: unknown) {
      toast({
        title: t('فشل الاتصال بالخادم', 'Échec de connexion', 'Error de conexión'),
        description: err instanceof Error ? err.message : '',
        variant: 'destructive',
      });
    } finally {
      setRefreshing(false);
    }
  }, [t, toast]);

  useEffect(() => {
    let active = true;
    const fetchInitial = async () => {
      try {
        const res = await getCustomsDeskDataAction();
        if (active && res.success) {
          setData(res);
        }
      } catch {
        // Fallback gracefully
      } finally {
        if (active) setLoading(false);
      }
    };
    fetchInitial();
    return () => {
      active = false;
    };
  }, []);

  // Handle direct BADR DUM transmission
  const handleTransmitBadrDum = async (trip: any) => {
    setSubmittingTripId({ id: trip.id, action: 'dum' });
    try {
      const res = await submitBadrDumAction(trip.id);
      if (res.success && res.receipt) {
        toast({
          title: t('تم إيداع التصريح بنجاح', 'DUM Transmise avec Succès', 'DUM Transmitida con Éxito'),
          description:
            locale === 'ar'
              ? res.receipt.messageAr
              : locale === 'es'
              ? res.receipt.messageEs
              : res.receipt.messageFr,
        });
        await loadDeskData(true);
      } else {
        toast({
          title: t('تعذر إيداع التصريح', 'Échec de Transmission DUM', 'Error al transmitir DUM'),
          description: res.error,
          variant: 'destructive',
        });
      }
    } catch (err: unknown) {
      toast({
        title: t('خطأ في العملية', 'Erreur de traitement', 'Error de procesamiento'),
        description: err instanceof Error ? err.message : '',
        variant: 'destructive',
      });
    } finally {
      setSubmittingTripId(null);
    }
  };

  // Handle direct PortNet Cargo Manifest transmission
  const handleTransmitPortNetManifest = async (trip: any) => {
    setSubmittingTripId({ id: trip.id, action: 'manifest' });
    try {
      const res = await submitPortNetManifestAction(trip.id);
      if (res.success) {
        toast({
          title: t('تم إيداع مانيفست PortNet', 'Manifeste PortNet Validé', 'Manifiesto PortNet Validado'),
          description: t(
            `تم توليد بطاقة العبور المينائي ${res.gatePassId}`,
            `Pass d'accès au port généré : ${res.gatePassId}`,
            `Pase de acceso al puerto generado: ${res.gatePassId}`
          ),
        });
        await loadDeskData(true);
      } else {
        toast({
          title: t('تعذر إيداع المانيفست', 'Échec Manifeste PortNet', 'Error de manifiesto PortNet'),
          description: res.error,
          variant: 'destructive',
        });
      }
    } catch (err: unknown) {
      toast({
        title: t('خطأ في العملية', 'Erreur de traitement', 'Error de procesamiento'),
        description: err instanceof Error ? err.message : '',
        variant: 'destructive',
      });
    } finally {
      setSubmittingTripId(null);
    }
  };

  // Inspect XML-DSig signature for a trip
  const handleInspectXml = (trip: any) => {
    const dummyBadr: BadrDumData = {
      tripId: trip.id,
      referenceNumber: `DUM-EXP-${trip.id}`,
      regimeDouanier: '1000',
      bureauDouanier: trip.route?.toLowerCase().includes('guerguerat') ? 'MA004900' : 'MA003100',
      declarantAgrement: 'AGR-MA-TB-042',
      declarantName: 'TRANS BODANON TRANSIT SARL',
      carrierIce: '001928374650001',
      exporterIce: trip.client?.ice || '001234567890001',
      exporterName: trip.client?.name || 'Chargeur Marocain SARL',
      importerName: 'Client Importateur International',
      importerCountry: 'ES',
      truckPlate: trip.truck?.plate_number || '12345-A-26',
      trailerPlate: trip.trailer?.plate_number || 'REM-001-B',
      cmrNumber: trip.cmr_export_number || trip.cmr_number || `CMR-${trip.id}`,
      commodityCodeHs: '0702000000',
      goodsDescription: trip.goods_description_export || 'Fruits & Légumes Primeurs',
      grossWeightKg: trip.weight_export || 22000,
      netWeightKg: (trip.weight_export || 22000) * 0.92,
      customsValueMad: (trip.price_export || 45000) * 2.5,
      packagesCount: 33,
    };

    const raw = buildBadrDumXml(dummyBadr);
    const signed = signCustomsXmlPayload(raw);
    setSignedXmlPreview(signed.signedXml);
    setInspectedXmlTrip(trip);
  };

  const copyXmlToClipboard = () => {
    if (!signedXmlPreview) return;
    navigator.clipboard.writeText(signedXmlPreview);
    setCopiedXml(true);
    setTimeout(() => setCopiedXml(false), 2000);
  };

  // Filtered trips
  const tripsList = data?.trips;
  const filteredTrips = useMemo(() => {
    if (!tripsList) return [];
    return tripsList.filter((trip) => {
      // Search
      const q = searchQuery.toLowerCase();
      const matchSearch =
        !q ||
        trip.id.toString().includes(q) ||
        (trip.route && trip.route.toLowerCase().includes(q)) ||
        (trip.customs_mrn && trip.customs_mrn.toLowerCase().includes(q)) ||
        (trip.cmr_export_number && trip.cmr_export_number.toLowerCase().includes(q)) ||
        (trip.driver?.name && trip.driver.name.toLowerCase().includes(q));

      // Corridor
      const isOverland = trip.corridor_type === 'african_overland' || trip.route?.toLowerCase().includes('guerguerat');
      const matchCorridor =
        corridorFilter === 'ALL' ||
        (corridorFilter === 'OVERLAND' && isOverland) ||
        (corridorFilter === 'MARITIME' && !isOverland);

      // Status
      const matchStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'CLEARED' && (trip.customs_status === 'CLEARED_BAE' || trip.customs_status === 'accepted')) ||
        (statusFilter === 'INSPECTION' && trip.customs_channel === 'RED') ||
        (statusFilter === 'PENDING' && (!trip.customs_status || trip.customs_status === 'pending' || trip.customs_status === 'DRAFT'));

      return matchSearch && matchCorridor && matchStatus;
    });
  }, [tripsList, searchQuery, corridorFilter, statusFilter]);

  const cert = data?.certificate;

  return (
    <div className="space-y-6" dir={dir}>
      {/* 1. Header & Sovereign Status Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white rounded-2xl shadow-xl border border-slate-800">
        <div className="space-y-2">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
                {t(
                  'منصة الامتثال والربط الجمركي المباشر (BADR & PortNet mTLS Gateway)',
                  'Guichet Unique & Passerelle EDI Douanière (BADR & PortNet)',
                  'Ventanilla Única y Pasarela Aduanera EDI (BADR y PortNet)'
                )}
              </h1>
              <p className="text-sm text-slate-300">
                {t(
                  'الربط السيادي بالشهادات الرقمية X.509 والتوقيع الإلكتروني XML-DSig RSA-SHA256 مع إدارة الجمارك (ADII)',
                  'Passerelle mTLS X.509 et signature XML-DSig RSA-SHA256 pour ADII BADR et PortNet',
                  'Pasarela mTLS X.509 y firma XML-DSig RSA-SHA256 para ADII BADR y PortNet'
                )}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Badge
            variant="outline"
            className="px-3 py-1.5 font-mono text-xs border-emerald-500/40 text-emerald-300 bg-emerald-950/40"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 me-2 animate-ping" />
            {t('mTLS v1.3 نَشِط', 'mTLS v1.3 ACTIF', 'mTLS v1.3 ACTIVO')}
          </Badge>

          <Button
            variant="outline"
            size="sm"
            onClick={() => loadDeskData(true)}
            disabled={loading || refreshing}
            className="border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-200"
          >
            <RefreshCw className={`w-4 h-4 me-2 ${refreshing ? 'animate-spin' : ''}`} />
            {t('تحديث', 'Actualiser', 'Actualizar')}
          </Button>
        </div>
      </div>

      {/* 1.5 View Switcher: BADR/PortNet EDI vs ONSSA Phytosanitary Dossiers */}
      <div className="flex rounded-xl bg-muted/60 p-1 border border-border/60 max-w-lg">
        <button
          onClick={() => setActiveDeskTab('edi_submissions')}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${
            activeDeskTab === 'edi_submissions'
              ? 'bg-card text-foreground shadow-xs'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <ShieldCheck className="w-4 h-4 text-emerald-500" />
          <span>{t('منظومة BADR & PortNet mTLS', 'Passerelle BADR & PortNet', 'Pasarela BADR y PortNet')}</span>
        </button>

        <button
          onClick={() => setActiveDeskTab('phyto_dossiers')}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${
            activeDeskTab === 'phyto_dossiers'
              ? 'bg-card text-foreground shadow-xs'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <FileCheck2 className="w-4 h-4 text-primary" />
          <span>{t('الملف الصحي والمطابقة (ONSSA)', 'Dossier ONSSA & Phyto', 'Expediente ONSSA y Fito')}</span>
        </button>
      </div>

      {activeDeskTab === 'phyto_dossiers' ? (
        <PhytosanitaryDossierTab />
      ) : (
        <>
          {/* 2. Top Bento Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Certificate Health Card */}
        <Card className="border-border/60 shadow-sm bg-card hover:border-primary/40 transition-colors">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {t('شهادة الربط الرقمي X.509', 'Certificat Barid e-Sign', 'Certificado Barid e-Sign')}
              </span>
              <Key className="w-4 h-4 text-emerald-500" />
            </div>
            <CardTitle className="text-xl font-bold flex items-center gap-2 mt-1">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
              {cert?.isValid
                ? t('صالحة ومعتمدة', 'Valide & Conforme', 'Válido y Conforme')
                : t('غير صالحة', 'Expiré / Invalide', 'Caducado / Inválido')}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground space-y-1">
            <div className="flex justify-between">
              <span>{t('المُصْدِر:', 'Émetteur :', 'Emisor:')}</span>
              <span className="font-mono text-foreground font-medium">Barid e-Sign CA</span>
            </div>
            <div className="flex justify-between">
              <span>{t('الصلاحية المتبقية:', 'Jours restants :', 'Días restantes:')}</span>
              <span className="font-mono text-emerald-600 font-bold">
                {cert?.daysUntilExpiry ?? 335} {t('يوم', 'jours', 'días')}
              </span>
            </div>
            <div className="flex justify-between text-[11px] pt-1 border-t border-border/40">
              <span>{t('الخوارزمية:', 'Algorithme :', 'Algoritmo:')}</span>
              <span className="font-mono text-slate-500">RSA-2048 / SHA-256</span>
            </div>
          </CardContent>
        </Card>

        {/* Inspection Channel (Circuit Vert) */}
        <Card className="border-border/60 shadow-sm bg-card hover:border-emerald-500/40 transition-colors">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">
                {t('المسار الأخضر (Circuit Vert)', 'Circuit Vert (BAE Direct)', 'Circuito Verde (BAE Directo)')}
              </span>
              <div className="w-3 h-3 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50" />
            </div>
            <CardTitle className="text-2xl font-bold text-emerald-600 mt-1">
              {data?.stats?.circuitVertCount || 0}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            <p>
              {t(
                'إذن الرفع الفوري (Mainlevée immédiate) لصادرات المنتجات الفلاحية والبحرية',
                'Mainlevée immédiate accordée pour primeurs et marée fraîche',
                'Autorización inmediata BAE para productos agrícolas y pesca'
              )}
            </p>
          </CardContent>
        </Card>

        {/* PortNet Ferry Gate Passes */}
        <Card className="border-border/60 shadow-sm bg-card hover:border-primary/40 transition-colors">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {t('بطاقات عبور PortNet', 'Pass Accès PortNet', 'Pases Puerto PortNet')}
              </span>
              <Anchor className="w-4 h-4 text-cyan-600" />
            </div>
            <CardTitle className="text-2xl font-bold text-foreground mt-1">
              {data?.stats?.clearedBaeCount || 0}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            <p>
              {t(
                'مانيفستات CUSCAR بحرية معتمدة لميناء طنجة المتوسط ➔ الجزيرة الخضراء',
                'Manifestes CUSCAR déposés Tanger Med ➔ Algésiras',
                'Manifiestos CUSCAR registrados Tánger Med ➔ Algeciras'
              )}
            </p>
          </CardContent>
        </Card>

        {/* Liquidation Taxes (Droits & Taxes MAD) */}
        <Card className="border-border/60 shadow-sm bg-card hover:border-primary/40 transition-colors">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {t('رسوم التصفية الجمركية', 'Droits & Taxes Liquidés', 'Tasas de Liquidación')}
              </span>
              <Building2 className="w-4 h-4 text-indigo-500" />
            </div>
            <CardTitle className="text-xl font-bold text-foreground mt-1 font-mono">
              {(data?.stats?.totalLiquidationMad || 0).toLocaleString()} <span className="text-xs text-muted-foreground">MAD</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            <p>
              {t(
                'الرسم الإحصائي وضريبة التنبر الجمركي محسوبة بدقة Decimal.js',
                'Calculs stricts Decimal.js (Taxe statistique + Timbre)',
                'Cálculos estrictos Decimal.js (Tasa estadística + Timbre)'
              )}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 3. Filters and Search Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-muted/30 p-3 rounded-xl border border-border/60">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute top-1/2 -translate-y-1/2 start-3 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t(
              'بحث برقم الرحلة، السائق، رقم MRN، أو مسار العبور...',
              'Rechercher par N° Voyage, Chauffeur, MRN, Trajet...',
              'Buscar por Nº Viaje, Conductor, MRN, Ruta...'
            )}
            className="ps-9 bg-background text-sm"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
          {/* Corridor Filter */}
          <div className="flex items-center rounded-lg border border-border/70 p-0.5 bg-background">
            <button
              onClick={() => setCorridorFilter('ALL')}
              className={`px-3 py-1 text-xs rounded-md font-medium transition-colors ${
                corridorFilter === 'ALL' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {t('كافة الممرات', 'Tous corridors', 'Todos corredores')}
            </button>
            <button
              onClick={() => setCorridorFilter('MARITIME')}
              className={`px-3 py-1 text-xs rounded-md font-medium transition-colors ${
                corridorFilter === 'MARITIME' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {t('الأوروبي (طنجة)', 'Maritime (Tanger)', 'Marítimo (Tánger)')}
            </button>
            <button
              onClick={() => setCorridorFilter('OVERLAND')}
              className={`px-3 py-1 text-xs rounded-md font-medium transition-colors ${
                corridorFilter === 'OVERLAND' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {t('الإفريقي (الكركارات)', 'Africain (Guerguerat)', 'Africano (Guerguerat)')}
            </button>
          </div>

          {/* Status Filter */}
          <div className="flex items-center rounded-lg border border-border/70 p-0.5 bg-background">
            <button
              onClick={() => setStatusFilter('ALL')}
              className={`px-3 py-1 text-xs rounded-md font-medium transition-colors ${
                statusFilter === 'ALL' ? 'bg-secondary text-secondary-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {t('الكل', 'Tous', 'Todos')}
            </button>
            <button
              onClick={() => setStatusFilter('CLEARED')}
              className={`px-3 py-1 text-xs rounded-md font-medium transition-colors ${
                statusFilter === 'CLEARED' ? 'bg-emerald-600 text-white' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {t('إذن رفع BAE', 'BAE Validé', 'BAE Concedido')}
            </button>
            <button
              onClick={() => setStatusFilter('INSPECTION')}
              className={`px-3 py-1 text-xs rounded-md font-medium transition-colors ${
                statusFilter === 'INSPECTION' ? 'bg-rose-600 text-white' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {t('تفتيش / سكانير', 'Inspection', 'Inspección')}
            </button>
          </div>
        </div>
      </div>

      {/* 4. Trips & Customs Dossiers Table */}
      <Card className="border-border/60 shadow-sm overflow-hidden">
        <CardHeader className="bg-muted/20 border-b border-border/50 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-primary" />
              <CardTitle className="text-base font-semibold">
                {t(
                  'سجل التصاريح والبيانات الجمركية الدولية (Customs Dossiers Registry)',
                  'Registre des Dossiers Douaniers Internationaux',
                  'Registro de Expedientes Aduaneros Internacionales'
                )}
              </CardTitle>
            </div>
            <span className="text-xs text-muted-foreground">
              {filteredTrips.length} {t('ملف شحنة', 'dossiers', 'expedientes')}
            </span>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {filteredTrips.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground space-y-2">
              <FileText className="w-10 h-10 mx-auto opacity-30" />
              <p className="text-sm font-medium">
                {t('لا توجد ملفات جمركية مطابقة للبحث', 'Aucun dossier douanier trouvé', 'No se encontraron expedientes aduaneros')}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-start">
                <thead className="bg-muted/40 text-muted-foreground font-semibold border-b border-border/40">
                  <tr>
                    <th className="py-3 px-4 text-start">{t('الرحلة والممر', 'Voyage & Corridor', 'Viaje y Corredor')}</th>
                    <th className="py-3 px-4 text-start">{t('المركبة والسائق', 'Véhicule & Chauffeur', 'Vehículo y Conductor')}</th>
                    <th className="py-3 px-4 text-start">{t('البضاعة والوزن', 'Marchandises & Poids', 'Mercancía y Peso')}</th>
                    <th className="py-3 px-4 text-start">{t('المرجع الجمركي MRN', 'Référence MRN', 'Referencia MRN')}</th>
                    <th className="py-3 px-4 text-start">{t('مسار المعاينة', 'Circuit Douane', 'Circuito Aduanero')}</th>
                    <th className="py-3 px-4 text-start">{t('الحالة وإذن BAE', 'Statut & BAE', 'Estado y BAE')}</th>
                    <th className="py-3 px-4 text-end">{t('الإجراءات السيادية', 'Actions EDI', 'Acciones EDI')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40 font-normal">
                  {filteredTrips.map((trip) => {
                    const isBadrSubmitting = submittingTripId?.id === trip.id && submittingTripId?.action === 'dum';
                    const isPortNetSubmitting = submittingTripId?.id === trip.id && submittingTripId?.action === 'manifest';
                    const isCleared = trip.customs_status === 'CLEARED_BAE' || trip.customs_status === 'accepted';
                    const isOverland = trip.corridor_type === 'african_overland' || trip.route?.toLowerCase().includes('guerguerat');

                    return (
                      <tr key={trip.id} className="hover:bg-muted/30 transition-colors">
                        {/* 1. Trip & Corridor */}
                        <td className="py-3 px-4 align-top">
                          <div className="font-semibold text-foreground flex items-center gap-1.5">
                            <span className="font-mono text-primary font-bold">#{trip.id}</span>
                            <span className="truncate max-w-[140px]">{trip.route || '—'}</span>
                          </div>
                          <div className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                            <Badge variant="outline" className="text-[10px] py-0 px-1 border-border/80">
                              {isOverland
                                ? t('إفريقي بري', 'Overland', 'Terrestre')
                                : t('بحري أوروبي', 'Maritime', 'Marítimo')}
                            </Badge>
                            <span>{trip.departure_date ? trip.departure_date.slice(0, 10) : ''}</span>
                          </div>
                        </td>

                        {/* 2. Vehicle & Driver */}
                        <td className="py-3 px-4 align-top">
                          <div className="flex items-center gap-1.5">
                            <MatriculeBadge plate={trip.truck?.plate_number} size="xs" variant="badge" />
                          </div>
                          <div className="text-[11px] text-muted-foreground mt-1 truncate max-w-[140px]">
                            {trip.driver?.name || '—'}
                          </div>
                        </td>

                        {/* 3. Goods & Weight */}
                        <td className="py-3 px-4 align-top">
                          <div className="font-medium text-foreground truncate max-w-[150px]">
                            {trip.goods_description_export || t('بضائع عامة', 'Générales', 'Generales')}
                          </div>
                          <div className="text-[11px] font-mono text-muted-foreground mt-0.5">
                            {(trip.weight_export || 22000).toLocaleString()} kg (SH 0702)
                          </div>
                        </td>

                        {/* 4. MRN Number */}
                        <td className="py-3 px-4 align-top font-mono">
                          {trip.customs_mrn ? (
                            <span className="bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 px-2 py-0.5 rounded text-[11px] font-semibold border border-slate-200 dark:border-slate-700">
                              {trip.customs_mrn}
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-[11px]">
                              {t('غير مسجل', 'Non assigné', 'Sin asignar')}
                            </span>
                          )}
                        </td>

                        {/* 5. Inspection Channel */}
                        <td className="py-3 px-4 align-top">
                          {trip.customs_channel === 'GREEN' ? (
                            <Badge className="bg-emerald-500/10 text-emerald-600 border border-emerald-500/30 text-[10px] py-0.5">
                              🟢 {t('أخضر (فوري)', 'Circuit Vert', 'Verde')}
                            </Badge>
                          ) : trip.customs_channel === 'ORANGE' ? (
                            <Badge className="bg-amber-500/10 text-amber-600 border border-amber-500/30 text-[10px] py-0.5">
                              🟠 {t('برتقالي (وثائق)', 'Circuit Orange', 'Naranja')}
                            </Badge>
                          ) : trip.customs_channel === 'RED' ? (
                            <Badge className="bg-rose-500/10 text-rose-600 border border-rose-500/30 text-[10px] py-0.5">
                              🔴 {t('أحمر (سكانير)', 'Circuit Rouge', 'Rojo')}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-[11px]">—</span>
                          )}
                        </td>

                        {/* 6. Status & BAE */}
                        <td className="py-3 px-4 align-top">
                          {isCleared ? (
                            <div className="space-y-0.5">
                              <Badge className="bg-emerald-600 text-white text-[10px] py-0.5">
                                <CheckCircle2 className="w-3 h-3 me-1" />
                                {t('مرفوع (BAE)', 'Dégagé (BAE)', 'Despachado')}
                              </Badge>
                              {trip.customs_bae_number && (
                                <div className="text-[10px] font-mono text-emerald-700 dark:text-emerald-400">
                                  {trip.customs_bae_number}
                                </div>
                              )}
                            </div>
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground text-[10px] py-0.5">
                              {trip.customs_status || t('قيد الإعداد', 'En attente', 'Pendiente')}
                            </Badge>
                          )}
                        </td>

                        {/* 7. Action Buttons */}
                        <td className="py-3 px-4 align-top text-end">
                          <div className="flex items-center justify-end gap-1.5 flex-wrap">
                            {/* Transmit BADR DUM */}
                            <Button
                              size="sm"
                              variant={isCleared ? 'ghost' : 'default'}
                              className="h-7 text-[11px] px-2.5 gap-1"
                              disabled={isBadrSubmitting}
                              onClick={() => handleTransmitBadrDum(trip)}
                            >
                              <Send className={`w-3 h-3 ${isBadrSubmitting ? 'animate-spin' : ''}`} />
                              {t('إيداع بدر', 'Transmettre DUM', 'Transmitir DUM')}
                            </Button>

                            {/* Transmit PortNet Manifest */}
                            {!isOverland && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-[11px] px-2.5 gap-1 border-cyan-500/30 text-cyan-700 dark:text-cyan-300 hover:bg-cyan-50 dark:hover:bg-cyan-950/30"
                                disabled={isPortNetSubmitting}
                                onClick={() => handleTransmitPortNetManifest(trip)}
                              >
                                <Anchor className={`w-3 h-3 ${isPortNetSubmitting ? 'animate-spin' : ''}`} />
                                {t('PortNet', 'PortNet', 'PortNet')}
                              </Button>
                            )}

                            {/* Inspect XML-DSig */}
                            <Button
                              size="sm"
                              variant="secondary"
                              className="h-7 text-[11px] px-2 gap-1"
                              onClick={() => handleInspectXml(trip)}
                              title={t('معاينة التوقيع الرقمي XML-DSig', 'Inspecter signature XML-DSig', 'Inspeccionar firma XML')}
                            >
                              <FileCode className="w-3 h-3" />
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
      </>
      )}

      {/* 5. XML-DSig Signature Inspection Modal */}
      <Dialog open={!!inspectedXmlTrip} onOpenChange={(open) => !open && setInspectedXmlTrip(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col" dir={dir}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <FileCode className="w-5 h-5 text-indigo-500" />
              {t(
                `فحص التوقيع الرقمي المعتمد XML-DSig للرحلة #${inspectedXmlTrip?.id}`,
                `Inspection Signature Numérique XML-DSig - Voyage #${inspectedXmlTrip?.id}`,
                `Inspección de Firma Digital XML-DSig - Viaje #${inspectedXmlTrip?.id}`
              )}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {t(
                'بصمة الوثيقة المشفرة بمفتاح Barid e-Sign RSA-2048 وفق معايير W3C XML-DSig المعمول بها لدى ADII',
                'Signature numérique W3C XML-DSig certifiée par Barid e-Sign pour les douanes marocaines',
                'Firma digital W3C XML-DSig certificada por Barid e-Sign para la aduana marroquí'
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-4 py-2">
            <div className="flex items-center justify-between bg-muted p-2.5 rounded-lg text-xs">
              <div>
                <span className="font-semibold text-foreground">{t('الخوارزمية:', 'Algorithme :', 'Algoritmo:')}</span>{' '}
                <span className="font-mono text-primary">RSA-SHA256 (W3C C14N)</span>
              </div>
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={copyXmlToClipboard}>
                {copiedXml ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedXml ? t('تم النسخ', 'Copié', 'Copiado') : t('نسخ XML', 'Copier XML', 'Copiar XML')}
              </Button>
            </div>

            <pre className="bg-slate-950 text-slate-100 p-4 rounded-xl text-[11px] font-mono overflow-x-auto max-h-[400px] border border-slate-800" dir="ltr">
              {signedXmlPreview}
            </pre>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

