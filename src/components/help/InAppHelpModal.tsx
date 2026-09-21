'use client';

import React, { useState } from 'react';
import { usePathname } from 'next/navigation';
import { useLanguage } from '@/components/language-provider';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  HelpCircle,
  BookOpen,
  Shield,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Compass,
  Truck,
  DollarSign,
  Wrench,
  Building2,
  User,
  Radio,
  ExternalLink,
} from 'lucide-react';

interface InAppHelpModalProps {
  role: string;
}

interface ContextualHelp {
  title: { ar: string; fr: string; es: string };
  description: { ar: string; fr: string; es: string };
  tips: { ar: string[]; fr: string[]; es: string[] };
}

// Contextual screen tips mapped by route prefix
const ROUTE_HELP_MAP: Record<string, ContextualHelp> = {
  '/dashboard': {
    title: {
      ar: 'لوحة القيادة والمؤشرات الاستراتيجية',
      fr: 'Tableau de bord stratégique',
      es: 'Panel de control estratégico',
    },
    description: {
      ar: 'رصد فوري لأداء الممرين الأوروبي والإفريقي، ومتابعة الرحلات النشطة والأرصدة النقدية.',
      fr: 'Suivi en temps réel des corridors européen et africain, des voyages actifs et des liquidités.',
      es: 'Monitoreo en tiempo real de los corredores europeo y africano, viajes activos y liquidez.',
    },
    tips: {
      ar: [
        'افحص رادار التنبيهات الحمراء في الأعلى لمعالجة أي شاحنة تعاني من انحراف حراري فوراً.',
        'قارن النقد السائل الفعلي بمؤشرات التدفق المتوقعة بدقة Decimal.js.',
        'استخدم زر التحديث (F5) لجلب آخر نبضات Traccar وأوامر النقل الحديثة.',
      ],
      fr: [
        'Vérifiez le radar des alertes rouges en haut pour traiter immédiatement toute anomalie thermique.',
        'Comparez la trésorerie réelle avec les flux prévisionnels via Decimal.js.',
        'Utilisez le bouton actualiser (F5) pour charger les dernières positions Traccar.',
      ],
      es: [
        'Revise el radar de alertas rojas arriba para solucionar anomalías térmicas de inmediato.',
        'Compare la liquidez real con los flujos proyectados con precisión Decimal.js.',
        'Use el botón refrescar (F5) para obtener las últimas posiciones de Traccar.',
      ],
    },
  },
  '/trips': {
    title: {
      ar: 'إدارة الرحلات وأوامر النقل الدولي (CMR)',
      fr: 'Gestion des voyages et ordres de transport (CMR)',
      es: 'Gestión de viajes y órdenes de transporte (CMR)',
    },
    description: {
      ar: 'توليد ومتابعة الرحلات عبر الممرين، والتخليص الجمركي المباشر عبر PortNet و TIR-EPD.',
      fr: 'Création et suivi des voyages, dédouanement direct via PortNet et TIR-EPD.',
      es: 'Creación y seguimiento de viajes, despacho aduanero directo vía PortNet y TIR-EPD.',
    },
    tips: {
      ar: [
        'تأكد من إدخال رقم الـ ICE المكون من 15 رقماً للعميل قبل إصدار e-CMR.',
        'افتح زر "بوابة الجمارك" لفحص الجاهزية وإرسال بيانات PortNet و TIR-EPD بنقرة واحدة.',
        'شارك رابط التتبع المباشر (/track/[id]) مع المصدر عبر WhatsApp فور انطلاق الرحلة.',
      ],
      fr: [
        'Assurez-vous de saisir le numéro ICE à 15 chiffres du client avant de générer l e-CMR.',
        'Ouvrez le "Guichet douanier" pour valider et envoyer les données PortNet et TIR-EPD en un clic.',
        'Partagez le lien de suivi en direct (/track/[id]) avec l exportateur par WhatsApp.',
      ],
      es: [
        'Asegúrese de ingresar el número ICE de 15 dígitos del cliente antes de emitir la e-CMR.',
        'Abra la "Pasarela aduanera" para verificar y enviar datos de PortNet y TIR-EPD con un clic.',
        'Comparta el enlace de rastreo en vivo (/track/[id]) con el exportador por WhatsApp.',
      ],
    },
  },
  '/predictive-analytics': {
    title: {
      ar: 'التحليلات التنبؤية للأسطول والتدفقات النقدية',
      fr: 'Analyses prédictives de la flotte et flux de trésorerie',
      es: 'Analítica predictiva de flota y flujos de caja',
    },
    description: {
      ar: 'رادار تآكل الإطارات TWI، تدهور مبردات Frigo، واستشراف السيولة لـ 30 و60 و90 يوماً.',
      fr: 'Radar d usure des pneus TWI, dégradation frigo SDI et prévisions de trésorerie à 90 jours.',
      es: 'Radar de desgaste de neumáticos TWI, degradación frigorífica SDI y proyección de caja a 90 días.',
    },
    tips: {
      ar: [
        'أي شاحنة يبلغ تآكل إطاراتها 90% تُحظر آلياً من مأموريات المسافات الطويلة لحين تغيير الإطارات.',
        'تراقب بطاقة SDI ساعات عمل وحدات التبريد (دورة 1,500 ساعة) وتطبق غرامات الانحراف الحراري.',
        'يأخذ منحنى التدفقات النقدية في الحسبان مؤشر سرعة سداد كل عميل (PVI) والنفقات الإلزامية.',
      ],
      fr: [
        'Tout camion avec une usure de pneus ≥ 90% est interdit de longs trajets jusqu au remplacement.',
        'La carte SDI surveille les heures des groupes frigo (cycle 1500h) et pénalise les dérives.',
        'La courbe de trésorerie intègre l indice de vitesse de paiement client (PVI) et les coûts obligatoires.',
      ],
      es: [
        'Cualquier camión con desgaste de neumáticos ≥ 90% se bloquea para viajes largos hasta el cambio.',
        'La tarjeta SDI monitorea horas del equipo de frío (ciclo 1500h) y penaliza desvíos térmicos.',
        'La curva de flujo de caja integra el índice de velocidad de pago (PVI) y gastos obligatorios.',
      ],
    },
  },
  '/invoices': {
    title: {
      ar: 'إدارة الفواتير والتحصيل بنظام FIFO',
      fr: 'Facturation et recouvrement FIFO',
      es: 'Facturación y cobranza FIFO',
    },
    description: {
      ar: 'إصدار الفواتير الرسمية، التوزيع الذري للدفعات، ومطابقة أسعار الصرف بدقة Decimal.js.',
      fr: 'Émission des factures, allocation atomique FIFO et suivi de change avec Decimal.js.',
      es: 'Emisión de facturas, asignación atómica FIFO y seguimiento de cambio con Decimal.js.',
    },
    tips: {
      ar: [
        'يوزع محرك FIFO الدفعة البنكية تلقائياً على الفواتير الأقدم للمصدر لتفادي تراكم الديون القديمة.',
        'تُحتسب فروق أسعار الصرف المحققة (Forex Gain/Loss) تلقائياً عند التحصيل بعملة مختلفة.',
        'تفحص مهمة Vercel Cron الفواتير يومياً 08:00 صباحاً وتدرج التذكيرات وتجمد الحجز بعد 15 يوماً تأخر.',
      ],
      fr: [
        'Le moteur FIFO alloue automatiquement le paiement aux plus anciennes factures du client.',
        'Les gains/pertes de change réalisés sont comptabilisés automatiquement lors du paiement.',
        'Le Cron Vercel vérifie les factures chaque jour à 08:00 et bloque les réservations après 15j de retard.',
      ],
      es: [
        'El motor FIFO asigna automáticamente el pago a las facturas más antiguas del cliente.',
        'Las ganancias/pérdidas por tipo de cambio se registran automáticamente al recibir pagos.',
        'El Cron Vercel revisa facturas diario a las 08:00 y bloquea reservas tras 15 días de mora.',
      ],
    },
  },
  '/driver-tasks': {
    title: {
      ar: 'بوابة كابتن النقل الدولي (PWA Mobile)',
      fr: 'Portail chauffeur international (PWA Mobile)',
      es: 'Portal del conductor internacional (PWA Mobile)',
    },
    description: {
      ar: 'استلام المأموريات، مسح إيصالات الوقود، وتوثيق التسليم المشفر e-POD دون اتصال.',
      fr: 'Réception des missions, scan OCR carburant et signature e-POD hors ligne.',
      es: 'Recepción de misiones, escaneo OCR de combustible y firma e-POD fuera de línea.',
    },
    tips: {
      ar: [
        'فعل زر إشعارات الويب (Web Push) لضمان وصول التكليفات وإنذارات الطوارئ عند قفل الشاشة.',
        'التطبيق يعمل في الصحراء والمعابر دون إنترنت؛ سجل الوقود والتسليم وسيتم رفعه تلقائياً لاحقاً.',
        'تأكد من توقيع المستلم على الشاشة وقراءة حرارة الشحنة لإصدار الختم المشفر HMAC-SHA256.',
      ],
      fr: [
        'Activez les notifications Web Push pour recevoir les alertes même avec l écran verrouillé.',
        'L application fonctionne hors ligne dans le désert; les reçus et POD se synchronisent après.',
        'Faites signer le réceptionnaire et saisissez la température pour sceller le HMAC-SHA256.',
      ],
      es: [
        'Active las notificaciones Web Push para recibir alertas incluso con la pantalla bloqueada.',
        'La app funciona fuera de línea en el desierto; los recibos y POD se sincronizan al volver la red.',
        'Haga firmar al receptor e ingrese la temperatura para sellar el código HMAC-SHA256.',
      ],
    },
  },
  '/fleet': {
    title: {
      ar: 'إدارة أصول الأسطول والمقطورات المبردة',
      fr: 'Gestion de la flotte et remorques frigorifiques',
      es: 'Gestión de flota y remolques frigoríficos',
    },
    description: {
      ar: 'متابعة الرؤوس الجرارة، وحدات التبريد، واستهلاك الوقود وجدولة الصيانة الوقائية.',
      fr: 'Suivi des tracteurs, groupes frigo, consommation gasoil et maintenance préventive.',
      es: 'Monitoreo de tractores, equipos de frío, consumo de combustible y mantenimiento preventivo.',
    },
    tips: {
      ar: [
        'قارن معدل استهلاك الوقود الفعلي بالمعدل القياسي (36L/100km) للكشف عن أي تسريب أو هدر.',
        'راجع صفحة التنبيهات للتأكد من تجديد شهادات الفحص التقني وشهادات ATP قبل 30 يوماً.',
        'اضبط الأسوار الجغرافية (Geofences) لموانئ طنجة ومعبر الكركارات ومحطات التوقف الآمنة.',
      ],
      fr: [
        'Comparez la consommation réelle à la norme (36L/100km) pour détecter toute surconsommation.',
        'Consultez les alertes d expiration pour renouveler visites techniques et ATP 30 jours à l avance.',
        'Configurez les géofences pour Tanger Med, Guerguerat et les aires de repos sécurisées.',
      ],
      es: [
        'Compare el consumo real con el estándar (36L/100km) para detectar cualquier anomalía.',
        'Revise las alertas de vencimiento para renovar ITV y certificados ATP con 30 días de anticipación.',
        'Configure las geocercas para Tánger Med, Guerguerat y áreas de descanso seguras.',
      ],
    },
  },
  '/portal': {
    title: {
      ar: 'بوابة العميل والمصدر للخدمة الذاتية',
      fr: 'Portail client et exportateur libre-service',
      es: 'Portal de clientes y exportadores autoservicio',
    },
    description: {
      ar: 'حجز الشحنات مباشرة، متابعة درجات حرارة التبريد على الخريطة، وتحميل وثائق التسليم.',
      fr: 'Réservation directe, suivi de température en direct et téléchargement des documents.',
      es: 'Reserva directa, monitoreo de temperatura en vivo y descarga de documentos oficiales.',
    },
    tips: {
      ar: [
        'أدخل نوع الشحنة ودرجة الحرارة المطلوبة وموقع التحميل لجدولة الشاحنة فوراً.',
        'راقب خط سير الشاحنة وقراءة الحساسات الحرارية المباشرة عبر خريطة التتبع الفضائي.',
        'حمّل بوليصة e-CMR ووثيقة e-POD الموقعة إلكترونياً بصيغة PDF معتمدة فور التفريغ.',
      ],
      fr: [
        'Saisissez le type de marchandise, la température requise et le lieu pour planifier le camion.',
        'Suivez le trajet et la température en direct via la carte satellite.',
        'Téléchargez l e-CMR et l e-POD signé au format PDF certifié dès la livraison.',
      ],
      es: [
        'Ingrese tipo de carga, temperatura deseada y ubicación para programar el camión de inmediato.',
        'Siga el trayecto y la temperatura en vivo a través del mapa satelital.',
        'Descargue la e-CMR y la e-POD firmada en formato PDF certificado inmediatamente tras la entrega.',
      ],
    },
  },
};

const ROLE_NAMES: Record<string, { ar: string; fr: string; es: string; icon: any }> = {
  super_admin: { ar: 'مشرف عام المنصة', fr: 'Super Admin', es: 'Superadministrador', icon: Shield },
  admin: { ar: 'المدير العام', fr: 'Directeur Général', es: 'Director General', icon: Building2 },
  secretary: { ar: 'السكرتارية والعمليات', fr: 'Secrétariat & Opérations', es: 'Secretaría y Operaciones', icon: Compass },
  driver: { ar: 'كابتن النقل الدولي', fr: 'Chauffeur TIR', es: 'Conductor TIR', icon: Truck },
  accountant: { ar: 'المحاسب المالي', fr: 'Contrôleur Financier', es: 'Contador Financiero', icon: DollarSign },
  fleet_manager: { ar: 'مدير الأسطول والصيانة', fr: 'Gestionnaire de Flotte', es: 'Jefe de Flota', icon: Wrench },
  client: { ar: 'العميل المصدر', fr: 'Client Exportateur', es: 'Cliente Exportador', icon: User },
};

export function InAppHelpModal({ role }: InAppHelpModalProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { dir, locale, t } = useLanguage();

  // Match current route help
  const currentHelp = React.useMemo(() => {
    for (const [routePrefix, helpData] of Object.entries(ROUTE_HELP_MAP)) {
      if (pathname === routePrefix || (routePrefix !== '/dashboard' && pathname.startsWith(routePrefix))) {
        return helpData;
      }
    }
    // Fallback default help
    return {
      title: {
        ar: 'منظومة Trans Bodanon لإدارة النقل الدولي',
        fr: 'Système Trans Bodanon TMS',
        es: 'Sistema Trans Bodanon TMS',
      },
      description: {
        ar: 'إدارة متكاملة لرحلات النقل الدولي عبر الممرين الأوروبي والإفريقي بدقة وسرعة وأمان.',
        fr: 'Gestion intégrée du transport international sur les corridors européen et africain.',
        es: 'Gestión integrada del transporte internacional en los corredores europeo y africano.',
      },
      tips: {
        ar: [
          'استخدم القائمة الجانبية للتنقل بين شاشات الرحلات، الأسطول، الفواتير، والتحليلات.',
          'كافة العمليات المالية مدققة بمكتبة Decimal.js وتخضع لسجل تدقيق مؤسسي آمن.',
          'راجع بطاقات المهام الميدانية السريعة في قسم التوثيق للاطلاع على إجراءات دورك.',
        ],
        fr: [
          'Utilisez le menu latéral pour naviguer entre voyages, flotte, factures et analyses.',
          'Toutes les opérations financières sont sécurisées avec Decimal.js et tracées.',
          'Consultez les fiches réflexes (SOP) pour les procédures propres à votre rôle.',
        ],
        es: [
          'Utilice el menú lateral para navegar entre viajes, flota, facturas y analítica.',
          'Todas las operaciones financieras están aseguradas con Decimal.js y auditadas.',
          'Consulte las tarjetas de tareas rápidas (SOP) para los procedimientos de su rol.',
        ],
      },
    };
  }, [pathname]);

  const cleanRole = role.replace('-', '_');
  const roleMeta = ROLE_NAMES[cleanRole] || ROLE_NAMES.admin;
  const RoleIcon = roleMeta.icon;

  const roleLabel = locale === 'es' ? roleMeta.es : locale === 'fr' ? roleMeta.fr : roleMeta.ar;
  const helpTitle = locale === 'es' ? currentHelp.title.es : locale === 'fr' ? currentHelp.title.fr : currentHelp.title.ar;
  const helpDesc = locale === 'es' ? currentHelp.description.es : locale === 'fr' ? currentHelp.description.fr : currentHelp.description.ar;
  const helpTips = locale === 'es' ? currentHelp.tips.es : locale === 'fr' ? currentHelp.tips.fr : currentHelp.tips.ar;

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => setOpen(true)}
        title={t('دليل المساعدة السريع (?)', 'Aide contextuelle (?)', 'Ayuda contextual (?)')}
        aria-label={t('دليل المساعدة السريع (?)', 'Aide contextuelle (?)', 'Ayuda contextual (?)')}
        className="w-9 h-9 rounded-xl border border-indigo-500/30 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 transition-all shadow-2xs flex items-center justify-center cursor-pointer scale-95 sm:scale-100"
      >
        <HelpCircle className="w-4 h-4 stroke-[2.3]" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl" dir={dir}>
          <DialogHeader className="border-b pb-3 text-start">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-primary">
                <BookOpen className="w-4 h-4" />
                <span>{t('دليل الاستخدام والمساعدة السياقي', 'Guide d utilisation contextuel', 'Guía de uso contextual')}</span>
              </div>
              <Badge variant="outline" className="flex items-center gap-1 text-[11px] font-medium border-primary/40 bg-primary/5 text-primary">
                <RoleIcon className="w-3 h-3" />
                <span>{roleLabel}</span>
              </Badge>
            </div>
            <DialogTitle className="text-lg sm:text-xl font-bold font-amiri text-foreground mt-1">
              {helpTitle}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-0.5">
              {helpDesc}
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="tips" className="w-full mt-2">
            <TabsList className="grid grid-cols-3 w-full rounded-xl bg-muted/60 p-1">
              <TabsTrigger value="tips" className="text-xs rounded-lg font-bold">
                {t('إرشادات الصفحة', 'Conseils de page', 'Consejos de página')}
              </TabsTrigger>
              <TabsTrigger value="sop" className="text-xs rounded-lg font-bold">
                {t('بطاقة المهام (SOP)', 'Fiche réflexe (SOP)', 'Tarjeta SOP')}
              </TabsTrigger>
              <TabsTrigger value="protocols" className="text-xs rounded-lg font-bold">
                {t('بروتوكول الطوارئ', 'Protocoles d urgence', 'Protocolos urgentes')}
              </TabsTrigger>
            </TabsList>

            {/* Tab 1: Current Page Tips */}
            <TabsContent value="tips" className="space-y-3 pt-3">
              <div className="space-y-2">
                {helpTips.map((tip, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl border border-border/70 bg-card/60 flex items-start gap-2.5 text-xs text-foreground leading-relaxed shadow-2xs"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                    <span>{tip}</span>
                  </div>
                ))}
              </div>
            </TabsContent>

            {/* Tab 2: SOP Quick Cheat Sheet */}
            <TabsContent value="sop" className="space-y-3 pt-3">
              <div className="p-3.5 rounded-xl border border-primary/25 bg-primary/5 space-y-2 text-xs">
                <div className="flex items-center gap-2 text-primary font-bold">
                  <RoleIcon className="w-4 h-4" />
                  <span>{t('القواعد القياسية لدورك الوظيفي', 'Règles standard pour votre rôle', 'Reglas estándar de su rol')}</span>
                </div>
                <p className="text-muted-foreground text-[11px] leading-relaxed">
                  {cleanRole === 'driver' && t(
                    'تأكد من تفعيل إشعارات الويب ومسح وصولات الوقود بالكاميرا وإتمام التوقيع e-POD قبل مغادرة نقطة التفريغ.',
                    'Activez les notifications Web Push, scannez le carburant et validez l e-POD avant de quitter le déchargement.',
                    'Active notificaciones Web Push, escanee combustible y valide la e-POD antes de abandonar el destino.'
                  )}
                  {cleanRole === 'secretary' && t(
                    'دقق رقم ICE (15 رقماً) للعميل، وتحقق من صلاحية التأشيرات، واستخدم بوابة الجمارك للبث المباشر لـ PortNet و TIR-EPD.',
                    'Vérifiez l ICE (15 chiffres), la validité des visas et utilisez le guichet pour diffuser PortNet et TIR-EPD.',
                    'Compruebe el ICE (15 dígitos), la validez de visados y use la pasarela para emitir PortNet y TIR-EPD.'
                  )}
                  {cleanRole === 'accountant' && t(
                    'كافة العمليات المالية تخضع لحسابات Decimal.js، ويسدد محرك FIFO الفواتير القديمة أولاً، وتُرحل فروق الصرف آلياً.',
                    'Toutes les opérations financières utilisent Decimal.js; le moteur FIFO règle d abord les anciennes factures.',
                    'Toda operación financiera usa Decimal.js; el motor FIFO salda primero facturas antiguas con cambio automático.'
                  )}
                  {cleanRole === 'fleet_manager' && t(
                    'راقب رادار TWI (حظر عند 90%)، وساعات مبردات Frigo (SDI)، وتأكد من تجديد الفحص والـ ATP قبل 30 يوماً من الانتهاء.',
                    'Surveillez le radar TWI (blocage à 90%), les heures frigo SDI et renouvelez visites et ATP 30 jours à l avance.',
                    'Monitoree el radar TWI (bloqueo al 90%), horas frigo SDI y renueve ITV y ATP con 30 días de anticipación.'
                  )}
                  {(cleanRole === 'admin' || cleanRole === 'super_admin' || cleanRole === 'client') && t(
                    'راجع تقارير استشراف التدفقات النقدية 30/60/90 يوماً ومؤشر سرعة سداد المصدرين PVI للحفاظ على سيولة مستقرة.',
                    'Consultez les prévisions de trésorerie à 90 jours et l indice PVI pour maintenir une liquidité stable.',
                    'Revise la proyección de caja a 90 días y el índice PVI de clientes para asegurar liquidez estable.'
                  )}
                </p>
              </div>

              <div className="flex flex-col gap-2 pt-1">
                <div className="text-[11px] font-bold text-muted-foreground">
                  {t('ملفات التوثيق المرجعية الكاملة بالمستودع:', 'Documents de référence dans le dépôt:', 'Documentos de referencia en el repositorio:')}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
                  <div className="p-2 rounded-lg bg-muted/40 border border-border/60 flex items-center justify-between">
                    <span className="truncate">SOP_ROLE_CHEAT_SHEETS.md</span>
                    <Badge variant="secondary" className="text-[9px]">DOCS</Badge>
                  </div>
                  <div className="p-2 rounded-lg bg-muted/40 border border-border/60 flex items-center justify-between">
                    <span className="truncate">UAT_ACCEPTANCE_TEST.md</span>
                    <Badge variant="secondary" className="text-[9px]">DOCS</Badge>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Tab 3: Emergency Protocols */}
            <TabsContent value="protocols" className="space-y-2.5 pt-3">
              <div className="p-3 rounded-xl border border-rose-500/30 bg-rose-500/10 flex items-start gap-2.5 text-xs text-foreground">
                <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block mb-0.5">
                    {t('طوارئ انحراف حرارة المبرد (> 2°C لمدة > 45 دقيقة)', 'Dérive thermique frigo (> 2°C pendant > 45 min)', 'Desvío térmico frigorífico (> 2°C por > 45 min)')}
                  </span>
                  <p className="text-muted-foreground text-[11px] leading-relaxed">
                    {t(
                      'يُطلق النظام تنبيهاً أحمر واهتزازاً طارئاً على هاتف السائق. على الكابتن التوقف فوراً وفحص المحرك والوقود والتواصل عبر /chat.',
                      'Alerte rouge et vibration sur le téléphone chauffeur. Arrêt immédiat et vérification du groupe puis contact /chat.',
                      'Alerta roja y vibración en el móvil del conductor. Parada inmediata, revisión del motor y contacto por /chat.'
                    )}
                  </p>
                </div>
              </div>

              <div className="p-3 rounded-xl border border-amber-500/30 bg-amber-500/10 flex items-start gap-2.5 text-xs text-foreground">
                <Radio className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block mb-0.5">
                    {t('انقطاع الإنترنت في معبر الكركارات وموريتانيا', 'Perte de réseau à Guerguerat et Mauritanie', 'Pérdida de red en Guerguerat y Mauritania')}
                  </span>
                  <p className="text-muted-foreground text-[11px] leading-relaxed">
                    {t(
                      'التطبيق يستمر في تسجيل الوقود وتوقيع e-POD في ذاكرة IndexedDB، وتتم المزامنة التلقائية فور توفر أول شبكة.',
                      'L application continue d enregistrer dans IndexedDB; synchronisation automatique dès le retour du réseau.',
                      'La aplicación sigue registrando en IndexedDB; sincronización automática en cuanto vuelva la conexión.'
                    )}
                  </p>
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <div className="border-t pt-3 mt-3 flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground font-mono">
              Trans Bodanon TMS • v2.0 Production
            </span>
            <Button size="sm" variant="outline" onClick={() => setOpen(false)} className="rounded-xl text-xs">
              {t('إغلاق النافذة', 'Fermer', 'Cerrar')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

