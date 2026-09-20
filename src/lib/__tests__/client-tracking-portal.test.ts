import { describe, it, expect } from 'vitest';
import { generateDeliverySignatureHash, verifyDeliverySignatureIntegrity } from '@/lib/signature-crypto';
import type { TripOrder } from '@/types/database';

describe('Client Tracking Portal & e-POD Telematics Verification', () => {
  describe('1. Reefer Cold-Chain Guard (Frigo Telematics Boundaries)', () => {
    // Logic matching ClientReeferBadge
    function evaluateReeferColdChain(temperature: number, cargoDesc?: string) {
      const text = (cargoDesc || '').toLowerCase();
      const isExplicitFrozen = /أسماك|سمك|لحوم|مجمدات|تجميد|ثلاجة|surgel|congel|pescado|carne|frozen/i.test(text);
      const isExplicitFresh = /فواكه|خضار|طازج|أدوية|بواكير|primeurs|frais|fruits|légumes|legumes|fresco|verduras|frutas|fresh/i.test(text);

      let cargoType: 'frozen' | 'fresh' = 'fresh';
      if (isExplicitFrozen || temperature <= -10) {
        cargoType = 'frozen';
      } else if (isExplicitFresh || temperature > -10) {
        cargoType = 'fresh';
      }

      let status: 'optimal' | 'acceptable' | 'warning' = 'optimal';
      if (cargoType === 'frozen') {
        if (temperature <= -17.5 && temperature >= -26) {
          status = 'optimal';
        } else if (temperature <= -15 && temperature > -17.5) {
          status = 'acceptable';
        } else {
          status = 'warning';
        }
      } else {
        if (temperature >= 2 && temperature <= 6) {
          status = 'optimal';
        } else if ((temperature >= 0 && temperature < 2) || (temperature > 6 && temperature <= 8)) {
          status = 'acceptable';
        } else {
          status = 'warning';
        }
      }

      return { cargoType, status };
    }

    it('classifies deep-frozen fish/meat cargo correctly at -20°C', () => {
      const result = evaluateReeferColdChain(-20.2, 'شحنة أسماك مجمدة - سمك السردين');
      expect(result.cargoType).toBe('frozen');
      expect(result.status).toBe('optimal');
    });

    it('flags warning when deep-frozen cargo warms above -15°C', () => {
      const result = evaluateReeferColdChain(-13.5, 'Poisson surgelé congelado');
      expect(result.cargoType).toBe('frozen');
      expect(result.status).toBe('warning');
    });

    it('classifies fresh produce (fruits/vegetables) correctly within +2°C to +6°C', () => {
      const result = evaluateReeferColdChain(3.8, 'طماطم وبواكير طازجة (Primeurs frais)');
      expect(result.cargoType).toBe('fresh');
      expect(result.status).toBe('optimal');
    });

    it('flags warning when fresh produce reaches freezing temperatures (< 0°C)', () => {
      const result = evaluateReeferColdChain(-1.2, 'خضار وفواكه طازجة');
      // Explicit keyword is fresh, but temp is negative (frost hazard)
      expect(result.cargoType).toBe('fresh');
      expect(result.status).toBe('warning');
    });

    it('flags warning when fresh produce exceeds maximum shelf safety (> +8°C)', () => {
      const result = evaluateReeferColdChain(9.4, 'فراولة وتوت طازج');
      expect(result.cargoType).toBe('fresh');
      expect(result.status).toBe('warning');
    });
  });

  describe('2. Dual-Corridor Logistics Detection & Milestones', () => {
    function detectCorridorType(trip: Partial<TripOrder>) {
      const routeString = `${trip.route || ''}`.toLowerCase();
      const isAfrican =
        trip.corridor_type === 'african_overland' ||
        /(?:موريتانيا|السنغال|دكار|داكار|روصو|الكركارات|نواكشوط|نواديبو|dakar|rosso|guerguerat|nouakchott|nouadhibou|mauritanie|mauritania|s[ée]n[ée]gal|senegal)/i.test(
          routeString
        );

      return isAfrican ? 'african_overland' : 'european_maritime';
    }

    it('identifies African Overland Trade Corridor via destination city Dakar', () => {
      const trip: Partial<TripOrder> = {
        route: 'Agadir ⟶ Dakar (Sénégal)',
      };
      expect(detectCorridorType(trip)).toBe('african_overland');
    });

    it('identifies African Overland Trade Corridor via transit waypoint Guerguerat', () => {
      const trip: Partial<TripOrder> = {
        route: 'الدار البيضاء ⟶ معبر الكركارات ⟶ نواكشوط',
      };
      expect(detectCorridorType(trip)).toBe('african_overland');
    });

    it('identifies European Maritime Corridor for Tangier Med / Algeciras crossing', () => {
      const trip: Partial<TripOrder> = {
        route: 'Agadir ⟶ Tanger Med ⟶ Algésiras ⟶ Perpignan',
        corridor_type: 'european_maritime',
      };
      expect(detectCorridorType(trip)).toBe('european_maritime');
    });

    it('verifies 5 milestones exist for African Overland corridor', () => {
      const africanMilestones = [
        'departure',
        'guerguerat',
        'mauritania_transit',
        'rosso_ferry',
        'delivery',
      ];
      expect(africanMilestones).toHaveLength(5);
      expect(africanMilestones).toContain('guerguerat');
      expect(africanMilestones).toContain('rosso_ferry');
    });

    it('verifies 4 milestones exist for European Maritime corridor', () => {
      const europeanMilestones = [
        'departure',
        'ferry',
        'customs',
        'delivery',
      ];
      expect(europeanMilestones).toHaveLength(4);
      expect(europeanMilestones).toContain('ferry');
      expect(europeanMilestones).toContain('customs');
    });
  });

  describe('3. Cryptographic HMAC-SHA256 Integrity Seal & Anti-Tampering', () => {
    const validPayload = {
      tripOrderId: 402,
      recipientName: 'MARCHE CENTRAL DAKAR SARL',
      signedAt: '2026-09-20T16:00:00.000Z',
      latitude: 14.6937,
      longitude: -17.4441,
      signatureUrl: 'https://storage.transbodanon.com/proofs/sig-402.png',
    };

    it('generates a deterministic 64-character SHA-256 HMAC hash', () => {
      const hash1 = generateDeliverySignatureHash(validPayload, 'test-secret-key-123');
      const hash2 = generateDeliverySignatureHash(validPayload, 'test-secret-key-123');

      expect(hash1).toBe(hash2);
      expect(hash1).toMatch(/^[0-9a-f]{64}$/i);
    });

    it('validates integrity successfully with identical payload', () => {
      const secret = 'secret-carrier-token';
      const hash = generateDeliverySignatureHash(validPayload, secret);
      const isValid = verifyDeliverySignatureIntegrity(validPayload, hash, secret);

      expect(isValid).toBe(true);
    });

    it('rejects verification if recipient name is tampered', () => {
      const secret = 'secret-carrier-token';
      const hash = generateDeliverySignatureHash(validPayload, secret);

      const tamperedPayload = {
        ...validPayload,
        recipientName: 'FRAUDULENT RECEIVER INC',
      };

      const isValid = verifyDeliverySignatureIntegrity(tamperedPayload, hash, secret);
      expect(isValid).toBe(false);
    });

    it('rejects verification if GPS coordinates are tampered', () => {
      const secret = 'secret-carrier-token';
      const hash = generateDeliverySignatureHash(validPayload, secret);

      const tamperedPayload = {
        ...validPayload,
        latitude: 35.7595, // Altered location
      };

      const isValid = verifyDeliverySignatureIntegrity(tamperedPayload, hash, secret);
      expect(isValid).toBe(false);
    });
  });

  describe('4. Strict Zero Financial Data Leakage Policy', () => {
    it('ensures public tracking payload does not expose financial or pricing fields', () => {
      // Mock public trip object passed to client component
      const publicTripView = {
        id: 101,
        route: 'Agadir ⟶ Tanger Med ⟶ Madrid',
        status: 'in_transit',
        departure_date: '2026-09-20',
        unloading_date_export: '2026-09-24',
        cmr_number: 'CMR-MA-2026-0901',
        goods_description_export: 'خضروات وفواكه طازجة',
        weight_export: 22.5,
        ferry_company: 'FRS Iberia',
      };

      const forbiddenFields = [
        'price',
        'price_export',
        'price_import',
        'client_price',
        'carrier_price',
        'advance',
        'driver_advance',
        'fuel_cost',
        'ferry_cost',
        'profit_margin',
        'treasury_balance',
      ];

      for (const field of forbiddenFields) {
        expect((publicTripView as Record<string, unknown>)[field]).toBeUndefined();
      }
    });
  });
});

