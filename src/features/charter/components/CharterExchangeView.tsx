'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/components/language-provider';
import Decimal from 'decimal.js';
import type {
  CharterOrder,
  SubcontractorCarrier,
  SubcontractorTruck,
  SubcontractorDriver,
  CreateCharterOrderInput,
  CharterOrderStatus,
} from '../types/charter.types';
import {
  listCharterOrdersAction,
  listSubcontractorsAction,
  createCharterOrderAction,
  updateCharterOrderStatusAction,
} from '../services/charter.actions';
import { calculateBrokerageMargin } from '../services/charter-compliance-margin.service';
import {
  Users,
  Truck,
  TrendingUp,
  DollarSign,
  ShieldCheck,
  ShieldAlert,
  Clock,
  Plus,
  Send,
  Copy,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  FileText,
  MapPin,
  Calendar,
  Sparkles,
  Search,
  Percent,
} from 'lucide-react';

export function CharterExchangeView() {
  const { t, dir, locale } = useLanguage();
  const { toast } = useToast();

  const [orders, setOrders] = useState<CharterOrder[]>([]);
  const [carriers, setCarriers] = useState<SubcontractorCarrier[]>([]);
  const [trucks, setTrucks] = useState<SubcontractorTruck[]>([]);
  const [drivers, setDrivers] = useState<SubcontractorDriver[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'orders' | 'subcontractors'>('orders');

  // Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [submittingOrder, setSubmittingOrder] = useState(false);
  const [newOrder, setNewOrder] = useState<CreateCharterOrderInput>({
    originCity: 'Agadir',
    destinationCity: 'Perpignan',
    corridor: 'european_maritime',
    loadingDate: new Date().toISOString().split('T')[0],
    deliveryDate: new Date(Date.now() + 4 * 24 * 3600 * 1000).toISOString().split('T')[0],
    cargoDescription: 'طماطم وفواكه طازجة (Fruits & Légumes)',
    cargoWeightKg: 22000,
    shipperAgreedRate: '38000.00',
    subcontractorBuyRate: '31000.00',
    extraReinvoicedExpenses: '0',
    currency: 'MAD',
    carrierId: '',
    truckId: '',
    driverId: '',
    cmrNumber: '',
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [ordersRes, subsRes] = await Promise.all([
        listCharterOrdersAction(),
        listSubcontractorsAction(),
      ]);
      if (ordersRes.success) setOrders(ordersRes.orders);
      if (subsRes.success) {
        setCarriers(subsRes.carriers);
        setTrucks(subsRes.trucks);
        setDrivers(subsRes.drivers);
        if (subsRes.carriers.length > 0 && !newOrder.carrierId) {
          setNewOrder((prev) => ({
            ...prev,
            carrierId: String(subsRes.carriers[0].id),
            truckId: String(subsRes.trucks[0]?.id || ''),
            driverId: String(subsRes.drivers[0]?.id || ''),
          }));
        }
      }
    } catch (err) {
      console.error('Failed to load charter data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Brokerage KPIs computed strictly via Decimal.js
  const kpis = useMemo(() => {
    let totalRevenueDec = new Decimal(0);
    let totalPayoutDec = new Decimal(0);
    let totalGrossMarginDec = new Decimal(0);

    for (const o of orders) {
      if (o.status !== 'CANCELLED') {
        const rev = new Decimal(o.margin.shipperAgreedRate || 0);
        const pay = new Decimal(o.margin.subcontractorBuyRate || 0);
        const mrg = rev.minus(pay);

        totalRevenueDec = totalRevenueDec.plus(rev);
        totalPayoutDec = totalPayoutDec.plus(pay);
        totalGrossMarginDec = totalGrossMarginDec.plus(mrg);
      }
    }

    const avgMarginPercent = totalRevenueDec.greaterThan(0)
      ? totalGrossMarginDec.dividedBy(totalRevenueDec).times(100).toFixed(1)
      : '0.0';

    return {
      totalRevenue: totalRevenueDec.toFixed(2),
      totalPayout: totalPayoutDec.toFixed(2),
      totalGrossMargin: totalGrossMarginDec.toFixed(2),
      avgMarginPercent,
      activeOrdersCount: orders.filter((o) => o.status === 'ASSIGNED' || o.status === 'IN_TRANSIT').length,
    };
  }, [orders]);

  // Real-time calculation for modal preview
  const modalMarginPreview = useMemo(() => {
    return calculateBrokerageMargin(
      newOrder.shipperAgreedRate,
      newOrder.subcontractorBuyRate,
      newOrder.currency,
      newOrder.extraReinvoicedExpenses
    );
  }, [newOrder.shipperAgreedRate, newOrder.subcontractorBuyRate, newOrder.currency, newOrder.extraReinvoicedExpenses]);

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingOrder(true);
    try {
      const res = await createCharterOrderAction(newOrder);
      if (res.success && res.order) {
        toast({
          title: t('تم إصدار أمر النقل بالباطن', "Ordre d'Affrètement Émis", 'Orden de Fletamento Emitida'),
          description: `${res.order.orderNumber} • ${res.order.margin.grossBrokerageMargin} ${res.order.margin.currency}`,
        });
        setIsCreateModalOpen(false);
        loadData();
      } else {
        toast({
          title: t('فشل الإصدار', "Échec d'émission", 'Error de emisión'),
          description: res.error || t('يرجى التحقق من المدخلات والوثائق', 'Vérifiez les données', 'Verifique los datos'),
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: t('خطأ غير متوقع', 'Erreur inattendue', 'Error inesperado'),
        variant: 'destructive',
      });
    } finally {
      setSubmittingOrder(false);
    }
  };

  const handleCopyMagicLink = (link?: string) => {
    if (!link) return;
    navigator.clipboard.writeText(link);
    toast({
      title: t('تم نسخ الرابط', 'Lien Copié', 'Enlace Copiado'),
      description: t('تم نسخ رابط الـ e-POD المخصص للسائق الخارجي', 'Lien e-POD externe copié', 'Enlace e-POD externo copiado'),
    });
  };

  const filteredOrders = orders.filter((o) => {
    const matchesQuery =
      o.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.carrier.companyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.originCity.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.destinationCity.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.cmrNumber.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'all' || o.status === statusFilter;
    return matchesQuery && matchesStatus;
  });

  const getStatusBadge = (status: CharterOrderStatus) => {
    switch (status) {
      case 'ASSIGNED':
        return <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/30 font-semibold">{t('تم الإسناد', 'Assigné', 'Asignado')}</Badge>;
      case 'IN_TRANSIT':
        return <Badge variant="outline" className="bg-purple-500/10 text-purple-600 border-purple-500/30 font-semibold">{t('في الطريق', 'En Transit', 'En Tránsito')}</Badge>;
      case 'DELIVERED':
        return <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 font-semibold">{t('تم التسليم (e-POD)', 'Livré (e-POD)', 'Entregado (e-POD)')}</Badge>;
      case 'SETTLED':
        return <Badge variant="outline" className="bg-slate-500/10 text-slate-600 border-slate-500/30 font-semibold">{t('تمت التسوية المالية', 'Réglé', 'Liquidado')}</Badge>;
      case 'CANCELLED':
        return <Badge variant="destructive">{t('ملغي', 'Annulé', 'Cancelado')}</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto" dir={dir}>
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-2 border-b border-border/40">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            <span>{t('إدارة الأسطول المستأجر والناقلين من الباطن', "Bourse d'Affrètement & Sous-Traitance", 'Bolsa de Fletamento y Subcontratación')}</span>
          </div>
          <h1 className="text-2xl lg:text-3xl font-bold font-amiri tracking-tight text-foreground">
            {t('بورصة الاستئجار وعقود النقل بالباطن', "Bourse d'Affrètement & Flotte Partenaire", 'Bolsa de Fletamento')}
          </h1>
          <p className="text-muted-foreground text-xs sm:text-sm mt-1">
            {t(
              'حوكمة استئجار الشاحنات الخارجية، التحقق القانوني والتأميني (CMR Insurance)، حساب هوامش الوساطة بدقة Decimal.js، وروابط e-POD اللاتلامسية.',
              'Affrètement de camions partenaires, conformité assurances CMR, calcul des marges de courtage et e-POD sans contact.'
            )}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            disabled={loading}
            className="h-10 text-xs gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>{t('تحديث البيانات', 'Actualiser', 'Actualizar')}</span>
          </Button>

          <Button
            onClick={() => setIsCreateModalOpen(true)}
            className="bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs sm:text-sm h-10 px-4 rounded-xl gap-1.5 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>{t('أمر استئجار جديد', "Nouvel Affrètement", 'Nuevo Fletamento')}</span>
          </Button>
        </div>
      </div>

      {/* Bento KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Revenue */}
        <Card className="border-border/80 shadow-xs bg-card">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-bold text-muted-foreground uppercase">
              {t('إيرادات النقل بالباطن', "C.A. Affrètement", 'Ingresos Fletamento')}
            </CardTitle>
            <DollarSign className="w-4 h-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black font-mono text-foreground">
              {kpis.totalRevenue} <span className="text-xs font-sans text-muted-foreground">MAD</span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              {t('سعر البيع المتفق عليه مع الشاحنين', 'Tarif convenu avec les chargeurs', 'Tarifa acordada con cargadores')}
            </p>
          </CardContent>
        </Card>

        {/* Subcontractor Payout */}
        <Card className="border-border/80 shadow-xs bg-card">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-bold text-muted-foreground uppercase">
              {t('مستحقات الناقلين', 'Paiements Sous-Traitants', 'Pagos a Subcontratistas')}
            </CardTitle>
            <Truck className="w-4 h-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black font-mono text-foreground">
              {kpis.totalPayout} <span className="text-xs font-sans text-muted-foreground">MAD</span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              {t('تكلفة شراء خدمات النقل الخارجي', "Coût d'achat du transport partenaire", 'Costo de compra del transporte')}
            </p>
          </CardContent>
        </Card>

        {/* Net Brokerage Margin */}
        <Card className="border-emerald-500/30 bg-emerald-500/5 shadow-xs">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-bold text-emerald-800 dark:text-emerald-300 uppercase">
              {t('صافي هامش الوساطة', 'Marge Nette Courtage', 'Margen Neto Intermediación')}
            </CardTitle>
            <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black font-mono text-emerald-700 dark:text-emerald-400">
              +{kpis.totalGrossMargin} <span className="text-xs font-sans text-emerald-600">MAD</span>
            </div>
            <p className="text-[11px] text-emerald-800/80 dark:text-emerald-300/80 mt-1">
              {t('الربح الصافي المحقق لمنظومة Trans Bodanon', 'Bénéfice net réalisé par Trans Bodanon', 'Beneficio neto realizado')}
            </p>
          </CardContent>
        </Card>

        {/* Margin Percent & Active Orders */}
        <Card className="border-border/80 shadow-xs bg-card">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-bold text-muted-foreground uppercase">
              {t('معدل الهامش والنشاط', 'Taux de Marge & Activité', 'Tasa de Margen')}
            </CardTitle>
            <Percent className="w-4 h-4 text-indigo-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black font-mono text-foreground">
              {kpis.avgMarginPercent}%
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              {kpis.activeOrdersCount} {t('رحلات خارجية قيد التنفيذ الميداني', 'expéditions actives en cours', 'envíos activos en curso')}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs Navigation */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
        <TabsList className="grid grid-cols-2 max-w-md">
          <TabsTrigger value="orders" className="text-xs gap-1.5">
            <FileText className="w-3.5 h-3.5" />
            <span>{t('أوامر النقل بالباطن', "Ordres d'Affrètement", 'Órdenes de Fletamento')}</span>
            <Badge variant="secondary" className="text-[10px] h-4 px-1">{orders.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="subcontractors" className="text-xs gap-1.5">
            <Users className="w-3.5 h-3.5" />
            <span>{t('دليل الناقلين والأسطول', 'Répertoire Transporteurs', 'Directorio de Transportistas')}</span>
            <Badge variant="secondary" className="text-[10px] h-4 px-1">{carriers.length}</Badge>
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: Charter Orders Board */}
        <TabsContent value="orders" className="space-y-4 pt-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 absolute top-2.5 start-3 text-muted-foreground" />
              <Input
                placeholder={t('بحث برقم الأمر، الناقل، المسار...', 'Rechercher par n° ordre, transporteur...')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 text-xs ps-9"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-9 text-xs px-3 rounded-lg border border-border bg-card text-foreground"
              >
                <option value="all">{t('كافة الحالات', 'Tous les statuts')}</option>
                <option value="ASSIGNED">{t('تم الإسناد', 'Assigné')}</option>
                <option value="IN_TRANSIT">{t('في الطريق', 'En Transit')}</option>
                <option value="DELIVERED">{t('تم التسليم (e-POD)', 'Livré')}</option>
                <option value="SETTLED">{t('تمت التسوية', 'Réglé')}</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {filteredOrders.map((order) => (
              <Card key={order.id} className="border-border/80 hover:shadow-md transition-all">
                <CardContent className="p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Left: Order Info & Route */}
                  <div className="space-y-1.5 min-w-[260px]">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-sm text-foreground">{order.orderNumber}</span>
                      {getStatusBadge(order.status)}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <MapPin className="w-3.5 h-3.5 text-primary" />
                      <span className="font-semibold text-foreground">{order.originCity}</span>
                      <span>➔</span>
                      <span className="font-semibold text-foreground">{order.destinationCity}</span>
                      <span className="font-mono text-[11px] text-muted-foreground">({order.cmrNumber})</span>
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {order.carrier.companyName} • {order.driver.name} ({order.driver.phone})
                    </div>
                  </div>

                  {/* Middle: Margin Breakdown via Decimal.js */}
                  <div className="flex flex-wrap items-center gap-3 text-xs">
                    <div className="p-2 bg-muted/40 rounded-lg border border-border/50 text-center min-w-[100px]">
                      <span className="text-[10px] text-muted-foreground block">{t('سعر الشاحن', 'Prix Chargeur')}</span>
                      <span className="font-mono font-bold text-foreground text-xs">
                        {order.margin.shipperAgreedRate} {order.margin.currency}
                      </span>
                    </div>

                    <div className="p-2 bg-muted/40 rounded-lg border border-border/50 text-center min-w-[100px]">
                      <span className="text-[10px] text-muted-foreground block">{t('تكلفة الناقل', 'Prix Partenaire')}</span>
                      <span className="font-mono font-bold text-amber-600 dark:text-amber-400 text-xs">
                        {order.margin.subcontractorBuyRate} {order.margin.currency}
                      </span>
                    </div>

                    <div className="p-2 bg-emerald-500/10 rounded-lg border border-emerald-500/20 text-center min-w-[110px]">
                      <span className="text-[10px] text-emerald-800 dark:text-emerald-300 block">{t('هامش الوساطة', 'Marge Courtage')}</span>
                      <span className="font-mono font-black text-emerald-600 dark:text-emerald-400 text-xs">
                        +{order.margin.grossBrokerageMargin} ({order.margin.brokerageMarginPercent}%)
                      </span>
                    </div>
                  </div>

                  {/* Right: Actions & e-POD Magic Link */}
                  <div className="flex flex-col sm:flex-row items-center gap-2 shrink-0">
                    {order.epodMagicLink && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCopyMagicLink(order.epodMagicLink)}
                        className="h-8 text-xs gap-1.5 w-full sm:w-auto"
                        title={t('نسخ رابط إثبات التسليم السحري للسائق الخارجي', 'Copier le lien e-POD')}
                      >
                        <Copy className="w-3.5 h-3.5" />
                        <span>{t('نسخ رابط e-POD', 'Lien e-POD', 'Copiar e-POD')}</span>
                      </Button>
                    )}

                    {order.status === 'DELIVERED' && order.epodHmacSeal && (
                      <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300 text-[10px] py-1 gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        <span>e-POD معتمد ومختوم</span>
                      </Badge>
                    )}

                    {order.status === 'ASSIGNED' && (
                      <Button
                        size="sm"
                        onClick={async () => {
                          await updateCharterOrderStatusAction(order.orderNumber, 'IN_TRANSIT');
                          loadData();
                        }}
                        className="h-8 text-xs bg-purple-600 hover:bg-purple-700 text-white w-full sm:w-auto"
                      >
                        {t('بدء الرحلة (في الطريق)', 'Démarrer')}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}

            {filteredOrders.length === 0 && (
              <div className="text-center py-12 bg-card rounded-xl border border-dashed border-border text-muted-foreground text-xs">
                {t('لا توجد أوامر استئجار مطابقة لمعايير البحث', "Aucun ordre d'affrètement trouvé")}
              </div>
            )}
          </div>
        </TabsContent>

        {/* TAB 2: Subcontractors Directory */}
        <TabsContent value="subcontractors" className="space-y-4 pt-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {carriers.map((c) => (
              <Card key={c.id} className="border-border/80">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-bold text-foreground">{c.companyName}</CardTitle>
                    {c.complianceStatus === 'compliant' ? (
                      <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-[10px] gap-1">
                        <ShieldCheck className="w-3 h-3" />
                        <span>{t('معتمد ومؤمن', 'Conforme')}</span>
                      </Badge>
                    ) : (
                      <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/30 text-[10px] gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        <span>{t('تنبيه وثائق', 'Attention')}</span>
                      </Badge>
                    )}
                  </div>
                  <CardDescription className="text-xs font-mono">
                    ICE: {c.ice} • RC: {c.registreCommerce || '-'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 text-xs">
                  <div className="p-2.5 bg-muted/40 rounded-lg space-y-1">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t('تأمين البضائع CMR:', 'Assurance CMR:')}</span>
                      <span className="font-mono text-foreground font-semibold">{c.cmrInsuranceExpiryDate}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t('ترخيص النقل الدولي:', 'Licence Transport:')}</span>
                      <span className="font-mono text-foreground font-semibold">{c.internationalTransportLicenseExpiryDate}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t('الشاحنات المتاحة:', 'Camions actifs:')}</span>
                      <span className="font-semibold text-primary">{c.activeTrucksCount} {t('شاحنة', 'camions')}</span>
                    </div>
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    👤 {c.contactPerson} • 📞 {c.phone}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* CREATE CHARTER ORDER MODAL */}
      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir={dir}>
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <Truck className="w-5 h-5 text-amber-500" />
              <span>{t('إصدار أمر نقل بالباطن جديد', "Nouvel Ordre d'Affrètement", 'Nueva Orden de Fletamento')}</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              {t(
                'تحديد الناقل المستأجر، الشاحنة، ومحرك حساب هامش الوساطة مع صمام منع الخسارة.',
                "Saisie de l'affrètement avec contrôle de marge et conformité partenaire."
              )}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateOrder} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="font-semibold block mb-1">{t('مدينة الشحن (المغادرة)', 'Origine')}</label>
                <Input
                  value={newOrder.originCity}
                  onChange={(e) => setNewOrder({ ...newOrder, originCity: e.target.value })}
                  required
                  className="h-8 text-xs"
                />
              </div>

              <div>
                <label className="font-semibold block mb-1">{t('مدينة التفريغ (الوصول)', 'Destination')}</label>
                <Input
                  value={newOrder.destinationCity}
                  onChange={(e) => setNewOrder({ ...newOrder, destinationCity: e.target.value })}
                  required
                  className="h-8 text-xs"
                />
              </div>

              <div>
                <label className="font-semibold block mb-1">{t('وصف البضاعة', 'Marchandise')}</label>
                <Input
                  value={newOrder.cargoDescription}
                  onChange={(e) => setNewOrder({ ...newOrder, cargoDescription: e.target.value })}
                  required
                  className="h-8 text-xs"
                />
              </div>

              <div>
                <label className="font-semibold block mb-1">{t('الوزن الإجمالي (كغ)', 'Poids (kg)')}</label>
                <Input
                  type="number"
                  value={newOrder.cargoWeightKg}
                  onChange={(e) => setNewOrder({ ...newOrder, cargoWeightKg: Number(e.target.value) })}
                  required
                  className="h-8 text-xs font-mono"
                />
              </div>

              <div>
                <label className="font-semibold block mb-1">{t('الناقل المستأجر', 'Transporteur Partenaire')}</label>
                <select
                  value={newOrder.carrierId}
                  onChange={(e) => setNewOrder({ ...newOrder, carrierId: e.target.value })}
                  className="w-full h-8 text-xs px-2 rounded-lg border border-border bg-card text-foreground"
                  required
                >
                  {carriers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.companyName} ({c.complianceStatus})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-semibold block mb-1">{t('الممر الدولي', 'Corridor')}</label>
                <select
                  value={newOrder.corridor}
                  onChange={(e) => setNewOrder({ ...newOrder, corridor: e.target.value as any })}
                  className="w-full h-8 text-xs px-2 rounded-lg border border-border bg-card text-foreground"
                >
                  <option value="european_maritime">{t('الممر الأوروبي البحري (طنجة Med ➔ إسبانيا)', 'Européen Maritime')}</option>
                  <option value="african_overland">{t('الممر الإفريقي البري (الكركارات ➔ موريتانيا / السنغال)', 'Africain Overland')}</option>
                  <option value="domestic">{t('النقل الوطني الداخلي', 'National')}</option>
                </select>
              </div>
            </div>

            {/* FINANCIAL BROKERAGE MARGIN SECTION (Decimal.js) */}
            <div className="p-3.5 bg-amber-500/10 rounded-xl border border-amber-500/20 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                  <DollarSign className="w-4 h-4 text-amber-600" />
                  <span>{t('تسعير الوساطة وهامش الربح الصافي (Decimal.js)', 'Tarification & Marge Courtage')}</span>
                </span>
                <Badge
                  variant={modalMarginPreview.isProfitable ? 'outline' : 'destructive'}
                  className={modalMarginPreview.isProfitable ? 'bg-emerald-500/20 text-emerald-700 border-emerald-500/30' : ''}
                >
                  {modalMarginPreview.isProfitable ? `ربح: +${modalMarginPreview.brokerageMarginPercent}%` : 'خسارة! هامش سالب'}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="font-semibold block mb-1 text-muted-foreground">
                    {t('سعر البيع المتفق عليه مع الشاحن (MAD)', 'Prix Vente Chargeur')}
                  </label>
                  <Input
                    type="number"
                    value={newOrder.shipperAgreedRate}
                    onChange={(e) => setNewOrder({ ...newOrder, shipperAgreedRate: e.target.value })}
                    required
                    className="h-8 text-xs font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="font-semibold block mb-1 text-muted-foreground">
                    {t('سعر الشراء من الناقل من الباطن (MAD)', 'Prix Achat Transporteur')}
                  </label>
                  <Input
                    type="number"
                    value={newOrder.subcontractorBuyRate}
                    onChange={(e) => setNewOrder({ ...newOrder, subcontractorBuyRate: e.target.value })}
                    required
                    className="h-8 text-xs font-mono font-bold text-amber-700 dark:text-amber-400"
                  />
                </div>
              </div>

              <div className="p-2.5 bg-card/80 rounded-lg flex items-center justify-between text-xs font-mono">
                <span className="text-muted-foreground">{t('صافي ربح الوساطة:', 'Marge Brute:')}</span>
                <span className={`font-black text-sm ${modalMarginPreview.isProfitable ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'}`}>
                  {modalMarginPreview.grossBrokerageMargin} MAD ({modalMarginPreview.brokerageMarginPercent}%)
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsCreateModalOpen(false)}>
                {t('إلغاء', 'Annuler')}
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={submittingOrder || modalMarginPreview.negativeMarginAlert}
                className="bg-amber-600 hover:bg-amber-700 text-white font-semibold gap-1.5"
              >
                {submittingOrder ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                <span>{t('إصدار وإرسال الرابط للناقل', 'Émettre et Notifier')}</span>
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

