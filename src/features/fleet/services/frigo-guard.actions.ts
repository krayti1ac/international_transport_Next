'use server';

import Decimal from 'decimal.js';
import { createClient } from '@/lib/supabase/server';
import { recordAuditLog } from '@/lib/audit.server';
import { sendWhatsAppCloudMessage } from '@/lib/whatsapp';

Decimal.config({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

export interface ReeferGuardResult {
  truckPlate: string;
  reeferTempC: number;
  cargoCategory: 'chilled' | 'frozen' | 'general';
  thresholdC: number;
  isBreached: boolean;
  severity: 'healthy' | 'warning' | 'critical';
  title_ar: string;
  title_fr: string;
  description_ar: string;
  description_fr: string;
  alertDispatched: boolean;
  timestamp: string;
}

export async function processFrigoTelematicsGuard(params: {
  truckPlate: string;
  truckId?: number;
  reeferTempC: number;
  cargoType?: 'chilled' | 'frozen' | 'general';
  timestamp?: string;
}): Promise<ReeferGuardResult> {
  const { truckPlate, reeferTempC } = params;
  const nowIso = params.timestamp || new Date().toISOString();
  const cleanPlate = (truckPlate || '').trim().toUpperCase();

  const supabase = await createClient();

  // 1. Resolve truck and active trip if truckId not provided
  let resolvedTruckId = params.truckId;
  if (!resolvedTruckId && cleanPlate) {
    const { data: truck } = await supabase
      .from('trucks')
      .select('id')
      .ilike('plate_number', `%${cleanPlate}%`)
      .maybeSingle();
    if (truck) resolvedTruckId = truck.id;
  }

  // 2. Resolve active trip and cargo type if not explicitly supplied
  let effectiveCargoType: 'chilled' | 'frozen' | 'general' = params.cargoType || 'chilled';
  let activeTripId: number | null = null;
  let driverPhone: string | null = null;

  if (resolvedTruckId) {
    const { data: activeTrip } = await supabase
      .from('trip_orders')
      .select('id, goods_description_export, goods_description_import, driver_id')
      .eq('truck_id', resolvedTruckId)
      .in('status', ['in_transit', 'loading', 'customs_export', 'pending'])
      .order('departure_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (activeTrip) {
      activeTripId = activeTrip.id;
      const desc = `${activeTrip.goods_description_export || ''} ${activeTrip.goods_description_import || ''}`.toLowerCase();
      if (desc.includes('frozen') || desc.includes('surgelé') || desc.includes('مجمد')) {
        effectiveCargoType = 'frozen';
      }

      if (activeTrip.driver_id) {
        const { data: driver } = await supabase
          .from('drivers')
          .select('phone')
          .eq('id', activeTrip.driver_id)
          .maybeSingle();
        if (driver?.phone) driverPhone = driver.phone;
      }
    }
  }

  // 3. Evaluate Temperature Against Biological Preservation Thresholds
  // Chilled (فواكه، خضروات، أسماك طازجة): الحد الأقصى الآمن +4.0°C
  // Frozen (لحوم، أسماك مجمدة): الحد الأقصى الآمن -12.0°C (المعيار المثالي -18°C)
  const thresholdC = effectiveCargoType === 'frozen' ? -12.0 : 4.0;
  const isBreached = reeferTempC > thresholdC;

  let severity: ReeferGuardResult['severity'] = 'healthy';
  let title_ar = 'حرارة التبريد طبيعية ومطابقة للمعايير';
  let title_fr = 'Température frigorifique conforme';
  let description_ar = `درجة حرارة حجرة التبريد ${reeferTempC.toFixed(1)}°C ضمن النطاق الآمن لشحنات (${effectiveCargoType}).`;
  let description_fr = `Température à ${reeferTempC.toFixed(1)}°C dans la plage sécurisée pour (${effectiveCargoType}).`;
  let alertDispatched = false;

  if (isBreached) {
    const isCritical =
      effectiveCargoType === 'frozen' ? reeferTempC > -8.0 : reeferTempC > 8.0;
    severity = isCritical ? 'critical' : 'warning';

    title_ar = isCritical
      ? '🚨 إنذار حرج: انقطاع التبريد وخطر تلف الشحنة الغذائية'
      : '⚠️ تنبيه أمني: ارتفاع حرارة مقطورة التبريد عن الحد المسموح';

    title_fr = isCritical
      ? '🚨 Alerte Critique: Rupture de la chaîne du froid'
      : '⚠️ Avertissement: Élévation anormale de la température frigo';

    description_ar = `حساس الحرارة يسجل ${reeferTempC.toFixed(1)}°C متجاوزاً الحد الأقصى الآمن (${thresholdC}°C). يرجى فحص وحدة التبريد (Carrier/ThermoKing) فوراً.`;
    description_fr = `Sonde frigo à ${reeferTempC.toFixed(1)}°C (seuil max ${thresholdC}°C dépassé). Contrôlez le groupe frigorifique immédiatement.`;

    const adminPhone = process.env.ADMIN_ALERT_PHONE || '212694585307';

    // 4. Dispatch Instant Emergency WhatsApp Alert to Operations & Driver
    if (process.env.WHATSAPP_API_TOKEN || process.env.CALLMEBOT_API_KEY) {
      const msgLines = [
        `🧊 *إنذار رقابة التبريد (Frigo Guard) - Trans Bodanon*`,
        `---------------------------`,
        `🚛 الشاحنة: *${cleanPlate}*`,
        `🌡️ درجة الحرارة الحالية: *${reeferTempC.toFixed(1)}°C* (الحد الأقصى: ${thresholdC}°C)`,
        `📦 تصنيف الشحنة: ${effectiveCargoType === 'frozen' ? 'مجمدات (-18°C)' : 'خضار وفواكه مبردة (+4°C)'}`,
        activeTripId ? `🚚 الرحلة رقم: #${activeTripId}` : null,
        `⚠️ الخطر: تهديد لسلامة البضائع وخطر تلف الحمولة.`,
        `---------------------------`,
        `الإجراء المطلوب: التحقق من عمل محرك التبريد، ضبط الثرموستات، والتأكد من إغلاق الأبواب الخلفية بإحكام.`,
      ]
        .filter(Boolean)
        .join('\n');

      // Dispatch to Operations
      await sendWhatsAppCloudMessage({
        to: adminPhone,
        message: msgLines,
      }).catch((err) => console.warn('Frigo Guard WhatsApp admin alert error:', err));

      // Dispatch to Driver if phone exists
      if (driverPhone && driverPhone !== adminPhone) {
        await sendWhatsAppCloudMessage({
          to: driverPhone,
          message: msgLines,
        }).catch((err) => console.warn('Frigo Guard WhatsApp driver alert error:', err));
      }

      alertDispatched = true;
    }

    // 5. Audit Log Entry
    await recordAuditLog({
      entityType: 'frigo_telematics_guard',
      entityId: String(resolvedTruckId || cleanPlate),
      actionType: 'security_alert',
      reason: `انحراف حرارة مقطورة التبريد للشاحنة ${cleanPlate}: ${reeferTempC.toFixed(1)}°C (الحد: ${thresholdC}°C)`,
      newData: {
        event: 'REEFER_TEMP_BREACH',
        plate: cleanPlate,
        truckId: resolvedTruckId,
        tripId: activeTripId,
        reeferTempC,
        thresholdC,
        cargoType: effectiveCargoType,
        severity,
        timestamp: nowIso,
      },
    });
  }

  return {
    truckPlate: cleanPlate,
    reeferTempC,
    cargoCategory: effectiveCargoType,
    thresholdC,
    isBreached,
    severity,
    title_ar,
    title_fr,
    description_ar,
    description_fr,
    alertDispatched,
    timestamp: nowIso,
  };
}

