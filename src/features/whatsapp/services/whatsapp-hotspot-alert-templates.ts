/**
 * Trans Bodanon TMS — Approaching Hotspot Driver WhatsApp Templates
 * Regulatory Standards: EU GDP (2013/C 343/01) / EN 12830 / ATP Treaty (FRC)
 * Urgent operational instructions delivered to drivers approaching critical excursion hotspots.
 */

import type { WhatsAppLocale } from '../types/whatsapp.types';
import type { DriverHotspotUrgentAlertPayload } from '@/features/tracking/types/hotspot-alert.types';

export class WhatsAppHotspotAlertTemplates {
  /**
   * Builds the official urgent text message sent to the driver upon proximity to a critical hotspot
   */
  public static buildDriverAlertMessage(payload: DriverHotspotUrgentAlertPayload): string {
    const locale = payload.locale || 'ar';
    const dist = payload.distanceKm.toFixed(1);
    const eta = Math.round(payload.etaMinutes);

    if (locale === 'fr') {
      return (
        `🚨 *ALERTE LOGISTIQUE — APPROCHE D'UN QUAI À HAUT RISQUE THERMIQUE*\n\n` +
        `👤 *Chauffeur:* ${payload.driverName} | 🚛 *Véhicule:* ${payload.truckPlate}\n` +
        `📦 *Mission:* ${payload.tripNumber}\n\n` +
        `📍 *Destination:* *${payload.dockName}* (${payload.city}, ${payload.countryCode})\n` +
        `🏢 *Site:* ${payload.facilityOrPort}\n` +
        `⚠️ *Indice de Vulnérabilité DVI:* *${payload.dviScore}/100 (FOYER CRITIQUE)*\n` +
        `📏 *Distance:* ~${dist} km | ⏱️ *ETA estimé:* ~${eta} min\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `❄️ *CONSIGNES OPÉRATIONNELLES OBLIGATOIRES (GDP / EN 12830):*\n` +
        `1. ❄️ *Verrouiller le groupe frigo en marche continue (Continuous Run)* — Interdiction formelle du mode éco (Cycle-Sentry).\n` +
        `2. 🚪 *Garder les portes arrière hermétiquement scellées* jusqu'au placage parfait du sas gonflable.\n` +
        `3. 🛡️ *Déployer immédiatement la cloison thermique mobile* lors de la rupture des scellés.\n` +
        `4. 🌡️ *Vérifier les consignes des compartiments:* C1 (-20°C Surgelé), C2 (+3°C Pharma/Frais).\n\n` +
        `Trans Bodanon — Surveillance Température & Intégrité de la Chaîne du Froid.`
      );
    }

    if (locale === 'es') {
      return (
        `🚨 *ALERTA LOGÍSTICA — APROXIMACIÓN A MUELLE DE ALTO RIESGO TÉRMICO*\n\n` +
        `👤 *Conductor:* ${payload.driverName} | 🚛 *Vehículo:* ${payload.truckPlate}\n` +
        `📦 *Viaje:* ${payload.tripNumber}\n\n` +
        `📍 *Destino:* *${payload.dockName}* (${payload.city}, ${payload.countryCode})\n` +
        `🏢 *Instalación:* ${payload.facilityOrPort}\n` +
        `⚠️ *Índice de Vulnerabilidad DVI:* *${payload.dviScore}/100 (PUNTO CRÍTICO)*\n` +
        `📏 *Distancia:* ~${dist} km | ⏱️ *Llegada estimada:* ~${eta} min\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `❄️ *PROTOCOLO OPERATIVO OBLIGATORIO (GDP / EN 12830):*\n` +
        `1. ❄️ *Activar frío continuo (Continuous Run)* — Prohibido terminantemente el modo Cycle-Sentry.\n` +
        `2. 🚪 *Mantener puertas traseras precintadas* hasta el acople total del abrigo inflable.\n` +
        `3. 🛡️ *Desplegar cortina térmica aislante móvil* inmediatamente al abrir los precintos.\n` +
        `4. 🌡️ *Verificar consignas de compartimentos:* C1 (-20°C Congelado), C2 (+3°C Pharma/Fresco).\n\n` +
        `Trans Bodanon — Monitorización y Control de Cadena de Frío.`
      );
    }

    // Default: Arabic (RTL)
    return (
      `🚨 *تنبيه لوجستي عاجل — اقتراب من رصيف عالي المخاطر الحرارية*\n\n` +
      `👤 *السائق:* ${payload.driverName} | 🚛 *الشاحنة:* ${payload.truckPlate}\n` +
      `📦 *الرحلة:* ${payload.tripNumber}\n\n` +
      `📍 *وجهة الرصيف:* *${payload.dockName}* (${payload.city} - ${payload.countryCode})\n` +
      `🏢 *المستودع / الميناء:* ${payload.facilityOrPort}\n` +
      `⚠️ *مؤشر هشاشة الرصيف DVI:* *${payload.dviScore}/100 (بؤرة حرجة 🔴)*\n` +
      `📏 *المسافة المتبقية:* ~${dist} كم | ⏱️ *الوصول المتوقع:* ~${eta} دقيقة\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `❄️ *البروتوكولات التشغيلية الإلزامية لحماية البضائع (GDP / EN 12830):*\n` +
      `1. ❄️ *ضبط جهاز التبريد فوراً على وضع التشغيل المستمر (Continuous Run)* — يُمنع منعاً باتاً وضع توفير الطاقة (Cycle-Sentry).\n` +
      `2. 🚪 *إبقاء أبواب المقطورة محكمة الإغلاق* حتى تمام التصاق الوسادة الهوائية (Dock Seal) للرصيف.\n` +
      `3. 🛡️ *نشر ستارة العزل الحراري المتنقلة* مباشرة بعد فك الأختام لتأمين الحجرات.\n` +
      `4. 🌡️ *التأكد من درجات حرارة الحجرات:* C1 (-20°C تجميد)، C2 (+3°C أدوية/طازج).\n\n` +
      `Trans Bodanon TMS — رادار الرقابة الحرارية وسلامة سلاسل التبريد الدولية.`
    );
  }

  /**
   * Generates localized summary bullet points for UI display
   */
  public static getLocalizedActionPoints(locale: WhatsAppLocale): string[] {
    if (locale === 'fr') {
      return [
        'Verrouiller le groupe en mode Continu (Continuous Run)',
        'Interdiction du mode veille / Cycle-Sentry',
        'Conserver les portes hermétiquement fermées jusqu’au quai',
        'Déployer la cloison thermique mobile',
      ];
    }
    if (locale === 'es') {
      return [
        'Activar modo de frío continuo (Continuous Run)',
        'Prohibido el modo Cycle-Sentry',
        'Mantener puertas cerradas hasta el sellado en muelle',
        'Desplegar cortina térmica aislante móvil',
      ];
    }
    return [
      'ضبط وحدة التبريد فوراً على وضع التشغيل المستمر (Continuous Run)',
      'منع استخدام وضع توفير الوقود (Cycle-Sentry)',
      'إبقاء الأبواب مغلقة ومحكمة حتى التصاق الرصيف',
      'نشر ستارة العزل الحراري المتنقلة لحماية الحجرات',
    ];
  }
}

