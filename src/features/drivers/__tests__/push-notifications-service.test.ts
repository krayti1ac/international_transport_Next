import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  buildMissionPushPayload,
  buildCriticalAlertPushPayload,
  buildRouteUpdatePushPayload,
  EMERGENCY_VIBRATION_PATTERN,
  MISSION_VIBRATION_PATTERN,
  ROUTE_UPDATE_VIBRATION_PATTERN,
  VAPID_PUBLIC_KEY,
  VAPID_SUBJECT,
} from '../services/push-notifications.service';

describe('Driver Web Push Notifications & Background Service', () => {
  describe('1. VAPID Protocol & Key Configuration', () => {
    it('verifies VAPID subject starts with mailto protocol', () => {
      expect(VAPID_SUBJECT).toMatch(/^mailto:[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/);
    });

    it('verifies VAPID public key base64url length and structure', () => {
      expect(VAPID_PUBLIC_KEY).toHaveLength(87);
      expect(VAPID_PUBLIC_KEY).toMatch(/^[A-Za-z0-9_-]+$/);
    });
  });

  describe('2. Mission Dispatch Push Payload Construction', () => {
    it('constructs Arabic mission payload with correct RTL attributes and vibration pulses', () => {
      const payload = buildMissionPushPayload({
        tripId: 301,
        routeTitle: 'أكادير ➔ طنجة المتوسط',
        departureDate: '2026-10-15',
        locale: 'ar',
      });

      expect(payload.title).toBe('🚛 مأمورية شحن دولية جديدة!');
      expect(payload.body).toContain('أكادير ➔ طنجة المتوسط');
      expect(payload.dir).toBe('rtl');
      expect(payload.lang).toBe('ar');
      expect(payload.vibrate).toEqual(MISSION_VIBRATION_PATTERN);
      expect(payload.tag).toBe('mission-301');
      expect(payload.requireInteraction).toBe(true);
      expect(payload.data.tripId).toBe(301);
      expect(payload.actions).toHaveLength(2);
      expect(payload.actions?.[0].title).toBe('عرض تفاصيل الرحلة 🚛');
    });

    it('constructs French mission payload with LTR direction', () => {
      const payload = buildMissionPushPayload({
        tripId: 302,
        routeTitle: 'Agadir ➔ Dakar',
        departureDate: '2026-10-20',
        locale: 'fr',
      });

      expect(payload.title).toContain('Nouvelle mission');
      expect(payload.body).toContain('Départ prévu : 2026-10-20');
      expect(payload.dir).toBe('ltr');
      expect(payload.lang).toBe('fr');
      expect(payload.actions?.[0].title).toBe('Détails du voyage 🚛');
    });

    it('constructs Spanish mission payload with LTR direction', () => {
      const payload = buildMissionPushPayload({
        tripId: 303,
        routeTitle: 'Tánger ➔ Valencia',
        departureDate: '2026-10-25',
        locale: 'es',
      });

      expect(payload.title).toContain('¡Nueva misión de transporte internacional!');
      expect(payload.dir).toBe('ltr');
      expect(payload.lang).toBe('es');
      expect(payload.actions?.[0].title).toBe('Ver detalles 🚛');
    });
  });

  describe('3. Critical Fleet Emergency Alert Payloads', () => {
    it('formats Frigo cold-chain drift with emergency vibration pattern', () => {
      const payload = buildCriticalAlertPushPayload({
        alertType: 'frigo_drift',
        message: 'انحراف خطير: درجة حرارة حاوية التبريد ارتفعت إلى -11°C (المحدد -20°C)',
        tripId: 273,
        locale: 'ar',
      });

      expect(payload.title).toContain('انحراف حرارة حاوية التبريد');
      expect(payload.vibrate).toEqual(EMERGENCY_VIBRATION_PATTERN);
      expect(payload.requireInteraction).toBe(true);
      expect(payload.tag).toContain('emergency-alert-frigo_drift');
      expect(payload.data.alertType).toBe('frigo_drift');
      expect(payload.actions?.[0].title).toBe('فحص التنبيه فوراً ⚠️');
    });

    it('formats tyre wear critical warning (TWI >= 90%) in Spanish', () => {
      const payload = buildCriticalAlertPushPayload({
        alertType: 'tire_wear',
        message: 'Desgaste crítico detectado en el eje 2 derecho (TWI 94%).',
        locale: 'es',
      });

      expect(payload.title).toContain('Desgaste severo de neumáticos (TWI ≥ 90%)');
      expect(payload.dir).toBe('ltr');
      expect(payload.vibrate).toEqual(EMERGENCY_VIBRATION_PATTERN);
      expect(payload.actions?.[0].title).toBe('Inspeccionar ahora ⚠️');
    });

    it('formats geofence breach alert in French', () => {
      const payload = buildCriticalAlertPushPayload({
        alertType: 'geofence_breach',
        message: 'Le véhicule a quitté le corridor agréé Guerguerat.',
        locale: 'fr',
      });

      expect(payload.title).toContain('Déviation d’itinéraire');
      expect(payload.vibrate).toEqual(EMERGENCY_VIBRATION_PATTERN);
      expect(payload.data.alertType).toBe('geofence_breach');
    });
  });

  describe('4. Dynamic Route Update Push Payloads', () => {
    it('formats route modification with route update vibration pattern', () => {
      const payload = buildRouteUpdatePushPayload({
        tripId: 275,
        oldRoute: 'أكادير ➔ الجزيرة الخضراء',
        newRoute: 'أكادير ➔ برشلونة',
        reason: 'طلب العميل تحويل الشحنة إلى ميناء برشلونة',
        locale: 'ar',
      });

      expect(payload.title).toContain('تعديل مسار الرحلة #275');
      expect(payload.body).toContain('أكادير ➔ برشلونة');
      expect(payload.body).toContain('السبب: طلب العميل تحويل الشحنة');
      expect(payload.vibrate).toEqual(ROUTE_UPDATE_VIBRATION_PATTERN);
      expect(payload.actions?.[0].title).toBe('عرض المسار الجديد 🗺️');
    });
  });
});

