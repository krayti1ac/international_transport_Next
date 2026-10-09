/**
 * Trans Bodanon TMS — Tachograph Critical Rest & Safe Parking Alerts Service
 * Dispatches automated, geo-aware WhatsApp rest alerts with Google Maps links to
 * certified safe truck parking areas (EU SSTPA) when drivers reach critical urgency (<=15 min).
 */

import { createClient } from '@/lib/supabase/server';
import { sendWhatsAppText } from '@/features/whatsapp/services/whatsapp-meta-client';
import {
  findNearestSafeParking,
  SafeTruckParkingArea,
  CERTIFIED_SAFE_PARKING_AREAS,
} from '../types/safe-parking.types';
import type { TachographRadarStatus } from '../types/tachograph.types';

// In-memory cooldown tracker to avoid spamming drivers (driverId -> timestamp)
const alertCooldowns = new Map<number, number>();
const COOLDOWN_DURATION_MS = 45 * 60 * 1000; // 45 minutes

export interface TriggerRestAlertOptions {
  driverId: number;
  remainingMinutes?: number;
  radarStatus?: TachographRadarStatus;
  latitude?: number;
  longitude?: number;
  truckPlate?: string | null;
  forceSend?: boolean;
  language?: 'ar' | 'fr' | 'es';
}

export interface RestAlertDispatchResult {
  success: boolean;
  alertSent: boolean;
  reason?: string;
  driverName?: string;
  phone?: string;
  parking?: SafeTruckParkingArea;
  distanceKm?: number;
  messageId?: string;
  error?: string;
}

export class TachographRestAlertService {
  /**
   * Resets cooldown cache (primarily for unit tests and manual force triggers)
   */
  public static resetCooldown(driverId?: number) {
    if (driverId) {
      alertCooldowns.delete(driverId);
    } else {
      alertCooldowns.clear();
    }
  }

  /**
   * Checks if a driver is currently in cooldown period
   */
  public static isCooldownActive(driverId: number): boolean {
    const lastSent = alertCooldowns.get(driverId);
    if (!lastSent) return false;
    return Date.now() - lastSent < COOLDOWN_DURATION_MS;
  }

  /**
   * Dispatches proactive WhatsApp notification to the driver with nearest safe truck parking
   */
  public static async triggerCriticalRestAlert(
    options: TriggerRestAlertOptions
  ): Promise<RestAlertDispatchResult> {
    try {
      const { driverId, forceSend = false } = options;

      // 1. Check cooldown
      if (!forceSend && this.isCooldownActive(driverId)) {
        return {
          success: true,
          alertSent: false,
          reason: 'cooldown_active',
        };
      }

      const supabase = await createClient();

      // 2. Fetch driver profile
      const { data: driver, error: driverErr } = await supabase
        .from('drivers')
        .select('id, name, phone, default_truck_id')
        .eq('id', driverId)
        .maybeSingle();

      if (driverErr || !driver) {
        return {
          success: false,
          alertSent: false,
          error: 'لم يتم العثور على بيانات السائق',
        };
      }

      if (!driver.phone) {
        return {
          success: false,
          alertSent: false,
          error: 'السائق لا يمتلك رقم هاتف مسجل',
        };
      }

      // 3. Resolve truck plate
      let truckPlate = options.truckPlate;
      if (!truckPlate && driver.default_truck_id) {
        const { data: truck } = await supabase
          .from('trucks')
          .select('plate_number')
          .eq('id', driver.default_truck_id)
          .maybeSingle();
        truckPlate = truck?.plate_number || null;
      }

      // 4. Resolve GPS coordinates
      let lat = options.latitude;
      let lon = options.longitude;

      if (lat === undefined || lon === undefined) {
        // Fallback 1: Query last known telematics position from truck_tracking
        if (driver.default_truck_id) {
          const { data: latestPos } = await supabase
            .from('truck_tracking')
            .select('latitude, longitude')
            .eq('truck_id', driver.default_truck_id)
            .order('timestamp', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (latestPos?.latitude && latestPos?.longitude) {
            lat = Number(latestPos.latitude);
            lon = Number(latestPos.longitude);
          }
        }
      }

      // Fallback 2: Default to Mediterranean European Corridor gateway (La Jonquera, AP-7)
      if (lat === undefined || lon === undefined) {
        lat = 42.4172;
        lon = 2.8794;
      }

      // 5. Find nearest certified safe truck parking area
      const nearest = findNearestSafeParking(lat, lon);
      const parking = nearest?.parking || CERTIFIED_SAFE_PARKING_AREAS[0];
      const distanceKm = nearest?.distanceKm ?? 15.0;

      const remainingMin = options.remainingMinutes !== undefined ? options.remainingMinutes : 15;
      const lang = options.language || 'ar';

      // 6. Format localized WhatsApp message
      const message = this.buildRestAlertMessage({
        driverName: driver.name,
        truckPlate: truckPlate || 'International Truck',
        remainingMinutes: remainingMin,
        parking,
        distanceKm,
        language: lang,
      });

      // 7. Dispatch via Meta WhatsApp Cloud API Client
      const sendResult = await sendWhatsAppText({
        to: driver.phone,
        message,
        auditEntity: {
          type: 'driver',
          id: driver.id,
        },
      });

      if (sendResult.success) {
        // Record cooldown timestamp
        alertCooldowns.set(driverId, Date.now());

        return {
          success: true,
          alertSent: true,
          driverName: driver.name,
          phone: driver.phone,
          parking,
          distanceKm,
          messageId: sendResult.messageId,
        };
      } else {
        return {
          success: false,
          alertSent: false,
          driverName: driver.name,
          phone: driver.phone,
          error: sendResult.reason || 'فشل إرسال رسالة الواتساب',
        };
      }
    } catch (error: any) {
      console.error('Error in triggerCriticalRestAlert:', error);
      return {
        success: false,
        alertSent: false,
        error: error.message || 'حدث خطأ غير متوقع أثناء إرسال تنبيه الاستراحة',
      };
    }
  }

  /**
   * Builds localized rest alert notification text
   */
  public static buildRestAlertMessage(params: {
    driverName: string;
    truckPlate: string;
    remainingMinutes: number;
    parking: SafeTruckParkingArea;
    distanceKm: number;
    language: 'ar' | 'fr' | 'es';
  }): string {
    const { driverName, truckPlate, remainingMinutes, parking, distanceKm, language } = params;

    if (language === 'fr') {
      return (
        `🚨 *ALERTE TACHYGRAPHE URGENTE — Trans Bodanon TMS*\n` +
        `👤 Chauffeur: *${driverName}* | 🚛 Camion: *${truckPlate}*\n\n` +
        `⚠️ *Réglementation Européenne (CE 561/2006)*:\n` +
        `Temps de conduite restant avant pause obligatoire (4.5h): *${remainingMinutes} minutes* seulement !\n` +
        `Pour éviter les infractions et l'immobilisation du véhicule, rejoignez le parking sécurisé recommandé.\n\n` +
        `📍 *Aire de stationnement sécurisée (EU SSTPA)*:\n` +
        `🏢 *${parking.name}*\n` +
        `🛣️ Axe: ${parking.highway} (${parking.city})\n` +
        `📏 Distance estimée: ~${distanceKm} km\n` +
        `🔒 Sécurité: Niveau certifié (${parking.securityLevel.toUpperCase()})\n\n` +
        `🗺️ *Lien de navigation Google Maps*:\n` +
        `${parking.googleMapsUrl}`
      );
    }

    if (language === 'es') {
      return (
        `🚨 *AVISO URGENTE DE TACÓGRAFO — Trans Bodanon TMS*\n` +
        `👤 Conductor: *${driverName}* | 🚛 Camión: *${truckPlate}*\n\n` +
        `⚠️ *Normativa Europea (CE 561/2006)*:\n` +
        `Tiempo de conducción restante antes de pausa obligatoria (4.5h): *${remainingMinutes} minutos* solamente !\n` +
        `Para evitar sanciones e inmovilización, deténgase en el área de descanso recomendada.\n\n` +
        `📍 *Área de estacionamiento seguro certificada (SSTPA)*:\n` +
        `🏢 *${parking.name}*\n` +
        `🛣️ Vía: ${parking.highway} (${parking.city})\n` +
        `📏 Distancia estimada: ~${distanceKm} km\n` +
        `🔒 Nivel de seguridad: Certificado (${parking.securityLevel.toUpperCase()})\n\n` +
        `🗺️ *Enlace directo de navegación Google Maps*:\n` +
        `${parking.googleMapsUrl}`
      );
    }

    // Default: Arabic
    return (
      `🚨 *تنبيه تاكوغراف عاجل — شركة Trans Bodanon*\n` +
      `👤 السائق: *${driverName}* | 🚛 الشاحنة: *${truckPlate}*\n\n` +
      `⚠️ *تنبيه أوقات القيادة الأوروبية (EC 561/2006)*:\n` +
      `المتبقي قبل انتهاء سقف القيادة المتواصلة (4.5 س): *${remainingMinutes} دقيقة* فقط!\n` +
      `يجب الدخول إلى أقرب باحة استراحة نظامية فوراً لتفادي الغرامات المالية وحجز المركبة.\n\n` +
      `📍 *أقرب باحة شاحنات آمنة ومعتمدة (SSTPA)*:\n` +
      `🏢 *${parking.name}*\n` +
      `🛣️ الطريق: ${parking.highway} (${parking.city})\n` +
      `📏 المسافة التقديرية: ~${distanceKm} كم\n` +
      `🔒 تصنيف الأمان: معتمدة ومحروسة (${parking.securityLevel.toUpperCase()})\n\n` +
      `🗺️ *فتح الموقع في خرائط Google للبدء في الملاحة*:\n` +
      `${parking.googleMapsUrl}`
    );
  }
}

