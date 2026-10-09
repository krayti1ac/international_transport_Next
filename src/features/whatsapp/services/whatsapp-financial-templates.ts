import Decimal from 'decimal.js';
import type { WhatsAppLocale } from '../types/whatsapp.types';

type DecimalInstance = InstanceType<typeof Decimal>;

Decimal.config({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

export interface FuelTheftAlertPayload {
  plateNumber: string;
  driverName: string;
  droppedLiters: number | DecimalInstance;
  financialLossMad: number | DecimalInstance;
  locationName?: string;
  gpsLat?: number;
  gpsLng?: number;
  incidentType?: string;
  timestamp?: string;
}

export interface DriverClearanceAlertPayload {
  driverName: string;
  statementNumber: string;
  periodLabel: string;
  netPayoutMad: number | DecimalInstance;
  clearanceUrl: string;
  baseSalary?: number | DecimalInstance;
  approvedExpenses?: number | DecimalInstance;
  penaltyDeductions?: number | DecimalInstance;
}

export class WhatsAppFinancialTemplates {
  /**
   * 1. Emergency Fuel Theft & Rapid Siphoning Alert Template
   */
  public static buildFuelTheftAlert(
    payload: FuelTheftAlertPayload,
    locale: WhatsAppLocale = 'ar'
  ): string {
    const droppedDec = new Decimal(payload.droppedLiters);
    const lossMadDec = new Decimal(payload.financialLossMad);
    const lossEurDec = lossMadDec.dividedBy(10.8);

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
        `⚠️ *ALERTE CRITIQUE : DÉTECTION DE VOL / SIPHONAGE CARBURANT*\n` +
        `-----------------------------------------\n` +
        `🚛 *Véhicule :* ${payload.plateNumber}\n` +
        `👤 *Chauffeur :* ${payload.driverName}\n` +
        `⛽ *Volume perdu :* -${droppedDec.toFixed(1)} Litres\n` +
        `💰 *Perte financière :* -${lossMadDec.toFixed(2)} MAD (~${lossEurDec.toFixed(2)} €)\n` +
        `🕒 *Heure détectée :* ${timeStr}\n` +
        `📍 *Localisation :* ${payload.locationName || 'Position GPS en temps réel'}\n` +
        (mapsUrl ? `🗺️ *Lien direct carte :* ${mapsUrl}\n` : '') +
        `-----------------------------------------\n` +
        `🚨 *Action requise :* Veuillez inspecter immédiatement les réservoirs et confirmer la situation.`
      );
    }

    if (locale === 'es') {
      return (
        `⚠️ *ALERTA CRÍTICA: DETECCIÓN DE ROBO / SIFONAJE DE COMBUSTIBLE*\n` +
        `-----------------------------------------\n` +
        `🚛 *Vehículo:* ${payload.plateNumber}\n` +
        `👤 *Conductor:* ${payload.driverName}\n` +
        `⛽ *Volumen sustraído:* -${droppedDec.toFixed(1)} Litros\n` +
        `💰 *Pérdida financiera:* -${lossMadDec.toFixed(2)} MAD (~${lossEurDec.toFixed(2)} €)\n` +
        `🕒 *Hora detectada:* ${timeStr}\n` +
        `📍 *Ubicación:* ${payload.locationName || 'Posición GPS en tiempo real'}\n` +
        (mapsUrl ? `🗺️ *Mapa Google:* ${mapsUrl}\n` : '') +
        `-----------------------------------------\n` +
        `🚨 *Acción requerida:* Por favor verifique de inmediato los depósitos e informe al centro de control.`
      );
    }

    // Default: Arabic (RTL)
    return (
      `⚠️ *إنذار حرج: رصد عملية شفط وسرقة وقود مفاجئة!*\n` +
      `-----------------------------------------\n` +
      `🚛 *الشاحنة:* ${payload.plateNumber}\n` +
      `👤 *السائق:* ${payload.driverName}\n` +
      `⛽ *الكمية المفقودة:* -${droppedDec.toFixed(1)} لتر\n` +
      `💰 *الخسارة المقدرة:* -${lossMadDec.toFixed(2)} درهم (~${lossEurDec.toFixed(2)} أورو)\n` +
      `🕒 *توقيت الرصد:* ${timeStr}\n` +
      `📍 *الموقع:* ${payload.locationName || 'إحداثيات GPS الميدانية'}\n` +
      (mapsUrl ? `🗺️ *رابط الموقع المباشر:* ${mapsUrl}\n` : '') +
      `-----------------------------------------\n` +
      `🚨 *إجراء فوري:* يرجى معاينة خزان الشاحنة وإبلاغ إدارة الأسطول بالتوضيح الفني.`
    );
  }

  /**
   * 2. Driver Monthly Clearance Statement & Payslip Notification
   */
  public static buildDriverClearanceAlert(
    payload: DriverClearanceAlertPayload,
    locale: WhatsAppLocale = 'ar'
  ): string {
    const netPayoutDec = new Decimal(payload.netPayoutMad);
    const netPayoutEur = netPayoutDec.dividedBy(10.8);

    if (locale === 'fr') {
      return (
        `💼 *TRANS BODANON TMS — QUITUS FISCAL & DÉCHARGE FINANCIÈRE*\n` +
        `-----------------------------------------\n` +
        `👤 *Chauffeur :* ${payload.driverName}\n` +
        `📄 *N° Document :* ${payload.statementNumber}\n` +
        `📅 *Période fiscale :* ${payload.periodLabel}\n` +
        `💵 *Net à percevoir :* *${netPayoutDec.toFixed(2)} MAD* (~${netPayoutEur.toFixed(2)} €)\n` +
        `-----------------------------------------\n` +
        `✅ Votre décompte de frais de route et solde mensuel a été validé par la direction.\n` +
        `🔗 *Consulter et télécharger le PDF officiel avec QR Code :*\n` +
        `${payload.clearanceUrl}\n` +
        `-----------------------------------------\n` +
        `🔒 *Document officiel scellé par signature numérique HMAC-SHA256.*`
      );
    }

    if (locale === 'es') {
      return (
        `💼 *TRANS BODANON TMS — LIQUIDACIÓN Y FINIQUITO DE GASTOS*\n` +
        `-----------------------------------------\n` +
        `👤 *Conductor:* ${payload.driverName}\n` +
        `📄 *Nº Liquidación:* ${payload.statementNumber}\n` +
        `📅 *Periodo fiscal:* ${payload.periodLabel}\n` +
        `💵 *Neto a percibir:* *${netPayoutDec.toFixed(2)} MAD* (~${netPayoutEur.toFixed(2)} €)\n` +
        `-----------------------------------------\n` +
        `✅ Su liquidación de ruta y haberes mensuales ha sido aprobada.\n` +
        `🔗 *Ver y descargar PDF oficial con código QR verificado:*\n` +
        `${payload.clearanceUrl}\n` +
        `-----------------------------------------\n` +
        `🔒 *Documento oficial verificado con firma digital HMAC-SHA256.*`
      );
    }

    // Default: Arabic (RTL)
    return (
      `💼 *ترانس بودانون TMS — كشف تصفية المستحقات وإبراء الذمة المالية*\n` +
      `-----------------------------------------\n` +
      `👤 *السائق:* ${payload.driverName}\n` +
      `📄 *رقم المخالصة:* ${payload.statementNumber}\n` +
      `📅 *الفترة المالية:* ${payload.periodLabel}\n` +
      `💵 *الصافي القابل للصرف:* *${netPayoutDec.toFixed(2)} درهم* (~${netPayoutEur.toFixed(2)} أورو)\n` +
      `-----------------------------------------\n` +
      `✅ تم اعتماد تصفية مصاريف الطريق ومستحقاتكم الشهرية بنجاح من طرف الإدارة المالية.\n` +
      `🔗 *للاطلاع على الوثيقة الرسمية المعتمدة برمز QR والتنزيل:*\n` +
      `${payload.clearanceUrl}\n` +
      `-----------------------------------------\n` +
      `🔒 *وثيقة قانونية رسمية موثقة بختم التحقق الرقمي HMAC-SHA256.*`
    );
  }
}
