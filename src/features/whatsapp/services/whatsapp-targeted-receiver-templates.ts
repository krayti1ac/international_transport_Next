/**
 * Trans Bodanon TMS — Targeted Receiver WhatsApp Dispatch Templates
 * Standards: EN 12830 / EU GDP Guidelines (2013/C 343/01) / ATP Treaty (FRC / FRA)
 * Custom targeted templates per compartment (C1, C2, C3) and designated cargo receiver.
 */

import Decimal from 'decimal.js';
import type { WhatsAppLocale } from '../types/whatsapp.types';
import type { CargoCategory, CompartmentCode } from '@/features/tracking/types/multi-temp.types';

Decimal.config({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

export interface TargetedReceiverCertificatePayload {
  receiverName: string;
  receiverPhone: string;
  compartmentCode: CompartmentCode;
  compartmentName: string;
  cargoCategory: CargoCategory;
  trailerPlate: string;
  tripNumber?: string;
  cmrNumber?: string;
  clientName?: string;
  setpointTempC: number;
  mktTempC: number;
  avgSupplyTempC: number;
  avgReturnTempC: number;
  status: 'compliant' | 'warning' | 'breached';
  complianceScore: number;
  verificationHash: string;
  verificationUrl: string;
  arrivalLocationName?: string;
  isGeofenceTriggered?: boolean;
  issuedAt?: string;
}

export class WhatsAppTargetedReceiverTemplates {
  /**
   * Helper to format cargo category per language
   */
  public static formatCargoCategory(category: CargoCategory, locale: WhatsAppLocale): string {
    switch (category) {
      case 'deep_frozen':
        return locale === 'fr'
          ? 'Surgelé Profond (-20°C)'
          : locale === 'es'
          ? 'Congelado Profundo (-20°C)'
          : 'تجميد عميق (-20°C)';
      case 'fresh_produce':
        return locale === 'fr'
          ? 'Fruits & Légumes Frais (+4°C)'
          : locale === 'es'
          ? 'Frutas y Hortalizas Frescas (+4°C)'
          : 'فواكه وخضروات طازجة (+4°C)';
      case 'pharma_cold':
        return locale === 'fr'
          ? 'Produits Pharmaceutiques & Vaccins (GDP)'
          : locale === 'es'
          ? 'Fármacos y Vacunas (GDP)'
          : 'أدوية ولقاحات طبية حساسة (GDP)';
      case 'meat_chilled':
        return locale === 'fr'
          ? 'Viandes Fraîches Réfrigérées (+2°C)'
          : locale === 'es'
          ? 'Carnes Frescas Refrigeradas (+2°C)'
          : 'لحوم طازجة مبردة (+2°C)';
      default:
        return category;
    }
  }

  /**
   * Helper to format compliance status badge per language
   */
  public static formatStatus(status: 'compliant' | 'warning' | 'breached', locale: WhatsAppLocale): string {
    switch (status) {
      case 'compliant':
        return locale === 'fr'
          ? '✅ 100% CONFORME (Normes GDP / EN 12830)'
          : locale === 'es'
          ? '✅ 100% CONFORME (Normas GDP / EN 12830)'
          : '✅ مطابق تماماً لمعايير GDP / EN 12830';
      case 'warning':
        return locale === 'fr'
          ? '⚠️ AVERTISSEMENT (Fluctuations Mineures)'
          : locale === 'es'
          ? '⚠️ AVISO (Fluctuaciones Menores)'
          : '⚠️ تحذير: تقلبات حرارية طفيفة';
      case 'breached':
        return locale === 'fr'
          ? '❌ RUPTURE DE LA CHAÎNE DU FROID'
          : locale === 'es'
          ? '❌ INCUMPLIMIENTO DE CADENA DE FRÍO'
          : '❌ خرق حرج لسلسلة التبريد';
      default:
        return status;
    }
  }

  /**
   * Builds custom WhatsApp message targeted specifically to a compartment cargo receiver
   */
  public static buildTargetedReceiverNotification(
    payload: TargetedReceiverCertificatePayload,
    locale: WhatsAppLocale = 'ar'
  ): string {
    const formatSigned = (val: number, decimals: number = 1) => {
      const d = new Decimal(val);
      const str = d.toFixed(decimals);
      return d.gt(0) ? `+${str}` : str;
    };

    const mktStr = formatSigned(payload.mktTempC, 2);
    const setpointStr = formatSigned(payload.setpointTempC, 1);
    const supplyStr = formatSigned(payload.avgSupplyTempC, 1);
    const returnStr = formatSigned(payload.avgReturnTempC, 1);

    const compEmoji =
      payload.compartmentCode === 'C1'
        ? '🧊'
        : payload.compartmentCode === 'C2'
        ? '🍏'
        : '💊';

    const geofenceNotice = payload.isGeofenceTriggered
      ? locale === 'fr'
        ? `📍 *Arrivée sur site :* Le véhicule est entré dans votre zone de déchargement (${payload.arrivalLocationName || 'Plateforme Logistique'}).`
        : locale === 'es'
        ? `📍 *Llegada a destino:* El vehículo ha entrado en su zona de descarga (${payload.arrivalLocationName || 'Plataforma Logística'}).`
        : `📍 *إشعار وصول للمستودع:* دخلت الشاحنة نطاق التفريغ الجغرافي الخاص بكم (${payload.arrivalLocationName || 'رصيف المستلم'}).`
      : '';

    if (locale === 'fr') {
      return (
        `❄️ *CERTIFICAT DE CONFORMITÉ THERMIQUE — ZONE ${payload.compartmentCode}*\n` +
        `-----------------------------------------\n` +
        `👤 *Destinataire :* ${payload.receiverName}\n` +
        (geofenceNotice ? `${geofenceNotice}\n` : '') +
        `🚛 *Semi-Remorque Frigo :* ${payload.trailerPlate}\n` +
        (payload.cmrNumber ? `📋 *Lettre de Voiture (CMR) :* ${payload.cmrNumber}\n` : '') +
        (payload.tripNumber ? `🧭 *Mission TMS :* ${payload.tripNumber}\n` : '') +
        `${compEmoji} *Compartiment Dédié :* ${payload.compartmentName} (${payload.compartmentCode})\n` +
        `📦 *Nature du Fret :* ${this.formatCargoCategory(payload.cargoCategory, 'fr')}\n` +
        `-----------------------------------------\n` +
        `🎯 *Température de Consigne :* ${setpointStr}°C\n` +
        `🧪 *Température Cinétique Moyenne (MKT) :* ${mktStr}°C\n` +
        `💨 *Moyennes Réelles :* Soufflé ${supplyStr}°C | Repris ${returnStr}°C\n` +
        `⭐ *Score d'Intégrité :* ${payload.complianceScore}/100\n` +
        `📋 *Statut Officiel :* ${this.formatStatus(payload.status, 'fr')}\n` +
        `-----------------------------------------\n` +
        `🔐 *Sceau Numérique HMAC-SHA256 :*\n` +
        `\`${payload.verificationHash.substring(0, 32)}...\`\n\n` +
        `📄 *Consulter le Rapport Officiel & Télécharger le PDF :*\n` +
        `${payload.verificationUrl}\n\n` +
        `_Trans Bodanon International Freight • Département Qualité & GDP_`
      );
    }

    if (locale === 'es') {
      return (
        `❄️ *CERTIFICADO DE CONFORMIDAD TÉRMICA — ZONA ${payload.compartmentCode}*\n` +
        `-----------------------------------------\n` +
        `👤 *Destinatario:* ${payload.receiverName}\n` +
        (geofenceNotice ? `${geofenceNotice}\n` : '') +
        `🚛 *Semirremolque Frigo:* ${payload.trailerPlate}\n` +
        (payload.cmrNumber ? `📋 *Carta de Porte (CMR):* ${payload.cmrNumber}\n` : '') +
        (payload.tripNumber ? `🧭 *Misión TMS:* ${payload.tripNumber}\n` : '') +
        `${compEmoji} *Compartimento Asignado:* ${payload.compartmentName} (${payload.compartmentCode})\n` +
        `📦 *Tipo de Carga:* ${this.formatCargoCategory(payload.cargoCategory, 'es')}\n` +
        `-----------------------------------------\n` +
        `🎯 *Temperatura de Consigna:* ${setpointStr}°C\n` +
        `🧪 *Temperatura Cinética Media (MKT):* ${mktStr}°C\n` +
        `💨 *Medias Reales:* Impulsado ${supplyStr}°C | Retorno ${returnStr}°C\n` +
        `⭐ *Puntuación de Integridad:* ${payload.complianceScore}/100\n` +
        `📋 *Estado Oficial:* ${this.formatStatus(payload.status, 'es')}\n` +
        `-----------------------------------------\n` +
        `🔐 *Sello Digital HMAC-SHA256:*\n` +
        `\`${payload.verificationHash.substring(0, 32)}...\`\n\n` +
        `📄 *Ver Informe Oficial y Descargar PDF:*\n` +
        `${payload.verificationUrl}\n\n` +
        `_Trans Bodanon International Freight • Departamento de Calidad & GDP_`
      );
    }

    // Default Arabic (RTL)
    return (
      `❄️ *شهادة الامتثال الحراري الرسمية — الحجرة ${payload.compartmentCode}*\n` +
      `-----------------------------------------\n` +
      `👤 *مستلم الشحنة المعتمد:* ${payload.receiverName}\n` +
      (geofenceNotice ? `${geofenceNotice}\n` : '') +
      `🚛 *المقطورة المبردة (Frigo):* ${payload.trailerPlate}\n` +
      (payload.cmrNumber ? `📋 *رقم وثيقة النقل (CMR):* ${payload.cmrNumber}\n` : '') +
      (payload.tripNumber ? `🧭 *معرّف الرحلة:* ${payload.tripNumber}\n` : '') +
      `${compEmoji} *الحجرة المخصصة:* ${payload.compartmentName} (${payload.compartmentCode})\n` +
      `📦 *صنف البضاعة المعزولة:* ${this.formatCargoCategory(payload.cargoCategory, 'ar')}\n` +
      `-----------------------------------------\n` +
      `🎯 *درجة الضبط المقررة (Setpoint):* ${setpointStr}°C\n` +
      `🧪 *الحرارة الحركية المعتمدة (MKT):* ${mktStr}°C\n` +
      `💨 *المتوسط الفعلي:* ضخ ${supplyStr}°C | إرجاع ${returnStr}°C\n` +
      `⭐ *مؤشر النزاهة الحرارية:* ${payload.complianceScore}/100\n` +
      `📋 *حالة الامتثال القانوني:* ${this.formatStatus(payload.status, 'ar')}\n` +
      `-----------------------------------------\n` +
      `🔐 *الختم الرقمي المشفر (HMAC-SHA256):*\n` +
      `\`${payload.verificationHash.substring(0, 32)}...\`\n\n` +
      `📄 *رابط فحص السجل الرقمي وتحميل الشهادة (PDF):*\n` +
      `${payload.verificationUrl}\n\n` +
      `_ترانس بودانون للشحن الدولي • إدارة الجودة وسلسلة التبريد المعتمدة_`
    );
  }
}

