import Decimal from 'decimal.js';
import type { WhatsAppLocale } from '../types/whatsapp.types';
import type { AtpReeferClass, ReeferCargoCategory } from '@/features/tracking/types/reefer-compliance.types';

Decimal.config({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

export interface GdpCertificateNotificationPayload {
  tripId: string | number;
  cmrNumber?: string;
  clientName?: string;
  route?: string;
  truckPlate: string;
  trailerPlate?: string;
  atpClass: AtpReeferClass;
  cargoCategory: ReeferCargoCategory;
  setpointTemp: number;
  mktTemperatureCelsius: number;
  avgSupplyTemp: number;
  avgReturnTemp: number;
  totalExcursionMinutes: number;
  doorBreachesCount: number;
  complianceScorePercent: number;
  certificateHash: string;
  issuedAt?: string;
}

export interface ReeferExcursionAlertPayload {
  tripId: string | number;
  truckPlate: string;
  trailerPlate?: string;
  driverName?: string;
  driverPhone?: string;
  incidentType: 'temp_high' | 'temp_low' | 'door_breach_transit' | 'compressor_failure' | string;
  severity: 'warning' | 'critical';
  currentTemp: number;
  setpointTemp: number;
  peakDeviationTemp: number;
  durationMinutes: number;
  locationName?: string;
  gpsLat?: number;
  gpsLng?: number;
  timestamp?: string;
}

export class WhatsAppReeferTemplates {
  /**
   * 1. Official GDP/ATP Cold Chain Certificate Notification Template
   */
  public static buildGdpCertificateNotification(
    payload: GdpCertificateNotificationPayload,
    locale: WhatsAppLocale = 'ar'
  ): string {
    const mktStr = payload.mktTemperatureCelsius > 0 ? `+${payload.mktTemperatureCelsius.toFixed(2)}` : payload.mktTemperatureCelsius.toFixed(2);
    const setpointStr = payload.setpointTemp > 0 ? `+${payload.setpointTemp.toFixed(1)}` : payload.setpointTemp.toFixed(1);
    const supplyStr = payload.avgSupplyTemp > 0 ? `+${payload.avgSupplyTemp.toFixed(1)}` : payload.avgSupplyTemp.toFixed(1);
    const returnStr = payload.avgReturnTemp > 0 ? `+${payload.avgReturnTemp.toFixed(1)}` : payload.avgReturnTemp.toFixed(1);

    const verificationUrl = `https://transbodanon.com/verify/cold-chain/${payload.certificateHash}`;

    if (locale === 'fr') {
      return (
        `❄️ *CERTIFICAT OFFICIEL DE CONFORMITÉ DE LA CHAÎNE DU FROID (GDP / ATP)*\n` +
        `-----------------------------------------\n` +
        `📋 *Expédition :* Voyage #${payload.tripId} ${payload.cmrNumber ? `(CMR : ${payload.cmrNumber})` : ''}\n` +
        `🚛 *Véhicule :* ${payload.truckPlate} ${payload.trailerPlate ? `/ ${payload.trailerPlate}` : ''}\n` +
        `🛣️ *Itinéraire :* ${payload.route || 'Ligne Internationale Frigorifique'}\n` +
        `📦 *Catégorie :* ${this.formatCargoCategory(payload.cargoCategory, 'fr')} (Classe ATP : ${payload.atpClass.toUpperCase()})\n` +
        `-----------------------------------------\n` +
        `🎯 *Consigne programmée :* ${setpointStr}°C\n` +
        `🧪 *Température Cinétique Moyenne (MKT) :* ${mktStr}°C\n` +
        `💨 *Moyennes Réelles :* Air soufflé ${supplyStr}°C | Air repris ${returnStr}°C\n` +
        `⏱️ *Excursion thermique :* ${payload.totalExcursionMinutes} min (Seuil respecté)\n` +
        `🔒 *Intégrité des portes en transit :* ${payload.doorBreachesCount === 0 ? '100% Sécurisé (0 brèche)' : `${payload.doorBreachesCount} ouverture(s)`}\n` +
        `⭐ *Score de conformité :* ${payload.complianceScorePercent}% (CONFORME)\n` +
        `-----------------------------------------\n` +
        `🔐 *Empreinte numérique SHA-256 :*\n` +
        `\`${payload.certificateHash}\`\n\n` +
        `📄 *Télécharger / Vérifier l'authenticité :*\n` +
        `${verificationUrl}\n\n` +
        `_Trans Bodanon International Freight • Direction Qualité & Chaîne du Froid_`
      );
    }

    if (locale === 'es') {
      return (
        `❄️ *CERTIFICADO OFICIAL DE CONFORMIDAD DE CADENA DE FRÍO (GDP / ATP)*\n` +
        `-----------------------------------------\n` +
        `📋 *Expedición:* Viaje #${payload.tripId} ${payload.cmrNumber ? `(CMR: ${payload.cmrNumber})` : ''}\n` +
        `🚛 *Vehículo:* ${payload.truckPlate} ${payload.trailerPlate ? `/ ${payload.trailerPlate}` : ''}\n` +
        `🛣️ *Ruta:* ${payload.route || 'Línea Internacional Frigorífica'}\n` +
        `📦 *Mercancía:* ${this.formatCargoCategory(payload.cargoCategory, 'es')} (Clase ATP: ${payload.atpClass.toUpperCase()})\n` +
        `-----------------------------------------\n` +
        `🎯 *Punto de consigna:* ${setpointStr}°C\n` +
        `🧪 *Temperatura Cinética Media (MKT):* ${mktStr}°C\n` +
        `💨 *Medias reales:* Aire impulsado ${supplyStr}°C | Aire retornado ${returnStr}°C\n` +
        `⏱️ *Excursión térmica:* ${payload.totalExcursionMinutes} min (Límite normativo respetado)\n` +
        `🔒 *Integridad de puertas en tránsito:* ${payload.doorBreachesCount === 0 ? '100% Seguro (0 incidencias)' : `${payload.doorBreachesCount} apertura(s)`}\n` +
        `⭐ *Índice de conformidad:* ${payload.complianceScorePercent}% (CONFORME)\n` +
        `-----------------------------------------\n` +
        `🔐 *Firma digital SHA-256:*\n` +
        `\`${payload.certificateHash}\`\n\n` +
        `📄 *Verificar y descargar certificado oficial:*\n` +
        `${verificationUrl}\n\n` +
        `_Trans Bodanon International Freight • Control de Calidad y Frío_`
      );
    }

    // Default: Arabic (RTL)
    return (
      `❄️ *شهادة الامتثال الرسمية لسلسلة التبريد الدولي (GDP / ATP / EN 12830)*\n` +
      `-----------------------------------------\n` +
      `📋 *بيانات الشحنة:* رحلة #${payload.tripId} ${payload.cmrNumber ? `(وثيقة CMR: ${payload.cmrNumber})` : ''}\n` +
      `🚛 *الشاحنة والمقطورة:* ${payload.truckPlate} ${payload.trailerPlate ? `| مقطورة: ${payload.trailerPlate}` : ''}\n` +
      `🛣️ *خط السير:* ${payload.route || 'ممر النقل الدولي المبرد'}\n` +
      `📦 *نوع البضاعة الحساسة:* ${this.formatCargoCategory(payload.cargoCategory, 'ar')} (تصنيف ATP: ${payload.atpClass.toUpperCase()})\n` +
      `-----------------------------------------\n` +
      `🎯 *نقطة الضبط المحددة:* ${setpointStr}°C\n` +
      `🧪 *الحرارة الحركية المتوسطة (MKT):* ${mktStr}°C (معادلة أرهينيوس المعتمدة)\n` +
      `💨 *معدلات الهواء الفعلية:* ضخ ${supplyStr}°C | إرجاع ${returnStr}°C\n` +
      `⏱️ *إجمالي الانحراف الحراري:* ${payload.totalExcursionMinutes} دقيقة (ضمن الهامش القانوني)\n` +
      `🔒 *أمان الأبواب بالترانزيت:* ${payload.doorBreachesCount === 0 ? 'مؤمنة 100% (صفر اختراق)' : `${payload.doorBreachesCount} فتحة مصرح بها`}\n` +
      `⭐ *مؤشر الامتثال الإجمالي:* ${payload.complianceScorePercent}% (مطابق للمعايير الدولية)\n` +
      `-----------------------------------------\n` +
      `🔐 *الختم الرقمي التشفيري SHA-256:*\n` +
      `\`${payload.certificateHash}\`\n\n` +
      `📄 *معاينة وتحميل الشهادة الرسمية للجمارك والمستورد:*\n` +
      `${verificationUrl}\n\n` +
      `_ترانس بودانون الدولية للشحن والتبريد • إدارة الجودة وضبط سلسلة التبريد_`
    );
  }

  /**
   * 2. Critical Temperature Excursion & Transit Breach WhatsApp Alert
   */
  public static buildReeferExcursionAlert(
    payload: ReeferExcursionAlertPayload,
    locale: WhatsAppLocale = 'ar'
  ): string {
    const currStr = payload.currentTemp > 0 ? `+${payload.currentTemp.toFixed(1)}` : payload.currentTemp.toFixed(1);
    const targetStr = payload.setpointTemp > 0 ? `+${payload.setpointTemp.toFixed(1)}` : payload.setpointTemp.toFixed(1);
    const peakStr = payload.peakDeviationTemp > 0 ? `+${payload.peakDeviationTemp.toFixed(1)}` : payload.peakDeviationTemp.toFixed(1);

    const mapsUrl =
      payload.gpsLat && payload.gpsLng
        ? `https://www.google.com/maps?q=${payload.gpsLat},${payload.gpsLng}`
        : null;

    const timeStr = payload.timestamp
      ? new Date(payload.timestamp).toLocaleTimeString(locale === 'ar' ? 'ar-MA' : 'fr-FR', {
          hour: '2-digit',
          minute: '2-digit',
        })
      : new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

    if (locale === 'fr') {
      return (
        `🚨 *ALERTE CRITIQUE : ANOMALIE DE TEMPÉRATURE GROUPE FRIGO*\n` +
        `-----------------------------------------\n` +
        `🚛 *Véhicule :* ${payload.truckPlate} ${payload.trailerPlate ? `(${payload.trailerPlate})` : ''}\n` +
        `👤 *Chauffeur :* ${payload.driverName || 'Équipe de bord'}\n` +
        `⚠️ *Nature du risque :* ${this.formatIncidentType(payload.incidentType, 'fr')}\n` +
        `🌡️ *Température actuelle :* ${currStr}°C (Consigne cible : ${targetStr}°C)\n` +
        `📈 *Écart thermique maximal :* ${peakStr}°C\n` +
        `⏱️ *Durée de l'anomalie :* ~${payload.durationMinutes} minutes\n` +
        `🕒 *Heure relevée :* ${timeStr}\n` +
        `📍 *Emplacement :* ${payload.locationName || 'Coordonnées GPS en temps réel'}\n` +
        (mapsUrl ? `🗺️ *Lien carte GPS :* ${mapsUrl}\n` : '') +
        `-----------------------------------------\n` +
        `⚡ *Action immédiate :* Vérifier le démarrage du compresseur, la fermeture hermétique des portes et le niveau de carburant frigo.`
      );
    }

    if (locale === 'es') {
      return (
        `🚨 *ALERTA CRÍTICA: ANOMALÍA TÉRMICA EN EQUIPO FRIGORÍFICO*\n` +
        `-----------------------------------------\n` +
        `🚛 *Vehículo:* ${payload.truckPlate} ${payload.trailerPlate ? `(${payload.trailerPlate})` : ''}\n` +
        `👤 *Conductor:* ${payload.driverName || 'Equipo a bordo'}\n` +
        `⚠️ *Tipo de incidencia:* ${this.formatIncidentType(payload.incidentType, 'es')}\n` +
        `🌡️ *Temperatura actual:* ${currStr}°C (Consigna objetivo: ${targetStr}°C)\n` +
        `📈 *Desviación máxima:* ${peakStr}°C\n` +
        `⏱️ *Duración estimada:* ~${payload.durationMinutes} minutos\n` +
        `🕒 *Hora detectada:* ${timeStr}\n` +
        `📍 *Ubicación:* ${payload.locationName || 'Posición GPS en tiempo real'}\n` +
        (mapsUrl ? `🗺️ *Mapa Google:* ${mapsUrl}\n` : '') +
        `-----------------------------------------\n` +
        `⚡ *Acción requerida:* Comprobar funcionamiento del compresor, cierre hermético de puertas y reserva de gasóleo.`
      );
    }

    // Default: Arabic (RTL)
    return (
      `🚨 *إنذار حرج: رصد اختراق حراري في مقصورة التبريد!*\n` +
      `-----------------------------------------\n` +
      `🚛 *الشاحنة والمقطورة:* ${payload.truckPlate} ${payload.trailerPlate ? `(${payload.trailerPlate})` : ''}\n` +
      `👤 *السائق:* ${payload.driverName || 'كابتن الرحلة'}\n` +
      `⚠️ *نوع الواقعة:* ${this.formatIncidentType(payload.incidentType, 'ar')}\n` +
      `🌡️ *درجة الحرارة اللحظية:* ${currStr}°C (المستهدف المعتمد: ${targetStr}°C)\n` +
      `📈 *أقصى انحراف مسجل:* ${peakStr}°C\n` +
      `⏱️ *مدة الانحراف:* ~${payload.durationMinutes} دقيقة\n` +
      `🕒 *وقت الرصد:* ${timeStr}\n` +
      `📍 *الموقع الميداني:* ${payload.locationName || 'إحداثيات GPS الحية'}\n` +
      (mapsUrl ? `🗺️ *موقع الشاحنة على الخريطة:* ${mapsUrl}\n` : '') +
      `-----------------------------------------\n` +
      `⚡ *تعليمات التدخل الفوري:* التأكد فوراً من عمل ضاغط التبريد، سلامة إغلاق الأبواب، ومستوى وقود الديزل بالوحدة.`
    );
  }

  private static formatCargoCategory(cat: ReeferCargoCategory, locale: WhatsAppLocale): string {
    switch (cat) {
      case 'fresh_produce':
        return locale === 'fr'
          ? 'Fruits & Légumes frais (+2°C à +6°C)'
          : locale === 'es'
          ? 'Frutas y verduras frescas (+2°C a +6°C)'
          : 'بواكير وخضار وفواكه طازجة (+2°C إلى +6°C)';
      case 'deep_frozen':
        return locale === 'fr'
          ? 'Poissons & Surgelés profonds (-18°C à -25°C)'
          : locale === 'es'
          ? 'Pescados y ultracongelados (-18°C a -25°C)'
          : 'أسماك ومجمدات عميقة (-18°C إلى -25°C)';
      case 'pharma_cold':
        return locale === 'fr'
          ? 'Produits pharmaceutiques GDP (+2°C à +8°C)'
          : locale === 'es'
          ? 'Productos farmacéuticos GDP (+2°C a +8°C)'
          : 'أدوية ومستحضرات صيدلانية GDP (+2°C إلى +8°C)';
      case 'meat_chilled':
        return locale === 'fr'
          ? 'Viandes réfrigérées (0°C à +4°C)'
          : locale === 'es'
          ? 'Carnes refrigeradas (0°C a +4°C)'
          : 'لحوم مبردة طازجة (0°C إلى +4°C)';
      default:
        return cat;
    }
  }

  private static formatIncidentType(type: string, locale: WhatsAppLocale): string {
    switch (type) {
      case 'temp_high':
        return locale === 'fr'
          ? 'Hausse thermique au-delà du seuil critique'
          : locale === 'es'
          ? 'Subida térmica por encima del límite crítico'
          : 'ارتفاع حراري تجاوز السقف الحرج المسموح';
      case 'temp_low':
        return locale === 'fr'
          ? 'Refroidissement excessif (Risque de congélation)'
          : locale === 'es'
          ? 'Enfriamiento excesivo (Riesgo de congelación)'
          : 'انخفاض حراري مفرط (اشتباه تجمد البضائع الطازجة)';
      case 'door_breach_transit':
        return locale === 'fr'
          ? 'Ouverture de portes non autorisée en plein transit'
          : locale === 'es'
          ? 'Apertura de puertas no autorizada en tránsito'
          : 'فتح أبواب المقطورة خارج المحطات المرخصة أثناء الترانزيت';
      case 'compressor_failure':
        return locale === 'fr'
          ? 'Arrêt intempestif du compresseur frigorifique'
          : locale === 'es'
          ? 'Fallo imprevisto del compresor de frío'
          : 'توقف مفاجئ في ضاغط وحدة التبريد أثناء الرحلة';
      default:
        return type;
    }
  }
}

