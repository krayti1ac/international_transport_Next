import { describe, it, expect } from 'vitest';
import { TransitWatchdogService } from '../services/transit-watchdog.service';
import type { Driver, Truck, Trailer } from '@/types/database';
import {
  auditTripDispatchSchema,
  sendDriverExpiryAlertSchema,
} from '../schemas/transit-watchdog.schemas';

describe('Transit Watchdog & Cross-Border Visa Expiry Engine', () => {
  const baseDate = new Date('2026-10-10T12:00:00Z');

  describe('1. Document Expiry & Buffer Evaluation', () => {
    it('evaluates compliant document with ample validity (>30 days)', () => {
      const res = TransitWatchdogService.evaluateDocument(
        'visa_schengen',
        'تأشيرة شنغن',
        'Visa Schengen',
        'Visado Schengen',
        '2026-12-15', // ~66 days remaining
        'SCH-99881',
        true,
        true,
        30,
        15,
        baseDate
      );

      expect(res.status).toBe('compliant');
      expect(res.daysRemaining).toBeGreaterThan(60);
      expect(res.isRequiredForCorridor).toBe(true);
      expect(res.messageFr).toContain('valide et conforme');
    });

    it('evaluates warning document nearing expiry (between 15 and 30 days)', () => {
      const res = TransitWatchdogService.evaluateDocument(
        'visa_schengen',
        'تأشيرة شنغن',
        'Visa Schengen',
        'Visado Schengen',
        '2026-10-28', // 18 days remaining
        'SCH-99881',
        true,
        true,
        30,
        15,
        baseDate
      );

      expect(res.status).toBe('warning');
      expect(res.daysRemaining).toBe(18);
      expect(res.messageFr).toContain('expire bientôt');
    });

    it('flags critical blocking status when remaining days are under minimum threshold (<=15 days)', () => {
      const res = TransitWatchdogService.evaluateDocument(
        'visa_schengen',
        'تأشيرة شنغن',
        'Visa Schengen',
        'Visado Schengen',
        '2026-10-18', // 8 days remaining
        'SCH-99881',
        true,
        true,
        30,
        15,
        baseDate
      );

      expect(res.status).toBe('critical_block');
      expect(res.daysRemaining).toBe(8);
      expect(res.messageFr).toContain('insuffisant pour transit');
    });

    it('flags expired document and creates illegal transit warning', () => {
      const res = TransitWatchdogService.evaluateDocument(
        'visa_schengen',
        'تأشيرة شنغن',
        'Visa Schengen',
        'Visado Schengen',
        '2026-09-30', // expired 10 days ago
        'SCH-99881',
        true,
        true,
        30,
        15,
        baseDate
      );

      expect(res.status).toBe('expired');
      expect(res.daysRemaining).toBeLessThan(0);
      expect(res.messageFr).toContain('expiré');
    });

    it('flags missing mandatory document as critical blocker', () => {
      const res = TransitWatchdogService.evaluateDocument(
        'visa_schengen',
        'تأشيرة شنغن',
        'Visa Schengen',
        'Visado Schengen',
        null,
        undefined,
        true,
        true,
        30,
        15,
        baseDate
      );

      expect(res.status).toBe('critical_block');
      expect(res.messageFr).toContain('non renseigné');
    });
  });

  describe('2. European Maritime Corridor Audit (Schengen & Carte Verte)', () => {
    const validDriver: Driver = {
      id: 1,
      name: 'Rachid Benali',
      phone: '+212600112233',
      license: 'B-12345',
      status: 'active',
      base_salary: 5000,
      bonus_percentage: 10,
      has_valid_visa: true,
      visa_number: 'SCH-77112',
      visa_expiry_date: '2026-12-31',
      passport_expiry_date: '2027-06-30',
      driver_card_qualification_expiry: '2027-01-01',
    } as any;

    const validTruck: Truck = {
      id: 10,
      plate_number: '12345-A-26',
      model: 'Volvo FH540',
      status: 'active',
      created_at: '2026-01-01',
    } as any;

    const validDocs = [
      {
        entity_type: 'truck',
        entity_id: 10,
        document_type: 'carte_verte',
        expiry_date: '2026-12-31',
      },
      {
        entity_type: 'truck',
        entity_id: 10,
        document_type: 'visite_technique',
        expiry_date: '2026-11-30',
      },
    ];

    it('authorizes dispatch when driver and vehicle meet all European compliance rules', () => {
      const audit = TransitWatchdogService.auditTransitCompliance({
        driver: validDriver,
        truck: validTruck,
        fleetDocs: validDocs,
        corridorType: 'european_maritime',
        tripDate: baseDate,
      });

      expect(audit.is_dispatch_allowed).toBe(true);
      expect(audit.overall_status).toBe('compliant');
      expect(audit.block_reasons).toHaveLength(0);
    });

    it('blocks dispatch when Schengen visa is expired or expiring in <= 15 days', () => {
      const expiringDriver: Driver = {
        ...validDriver,
        visa_expiry_date: '2026-10-18', // only 8 days left
      };

      const audit = TransitWatchdogService.auditTransitCompliance({
        driver: expiringDriver,
        truck: validTruck,
        fleetDocs: validDocs,
        corridorType: 'european_maritime',
        tripDate: baseDate,
      });

      expect(audit.is_dispatch_allowed).toBe(false);
      expect(audit.overall_status).toBe('critical_block');
      expect(audit.block_reasons.some((r) => r.includes('Schengen'))).toBe(true);
    });

    it('blocks European dispatch when truck lacks Carte Verte insurance', () => {
      const audit = TransitWatchdogService.auditTransitCompliance({
        driver: validDriver,
        truck: validTruck,
        fleetDocs: [], // No Carte Verte
        corridorType: 'european_maritime',
        tripDate: baseDate,
      });

      expect(audit.is_dispatch_allowed).toBe(false);
      expect(audit.block_reasons.some((r) => r.includes('Carte Verte'))).toBe(true);
    });
  });

  describe('3. African Overland Corridor Audit (Mauritania/Senegal & Carte Brune)', () => {
    const africanDriver: Driver = {
      id: 2,
      name: 'Youssef Mansouri',
      phone: '+212666778899',
      license: 'C-9988',
      status: 'active',
      base_salary: 5000,
      bonus_percentage: 10,
      has_valid_visa: false,
      african_visa_number: 'MR-SN-5544',
      african_visa_expiry_date: '2026-12-20',
      passport_expiry_date: '2027-08-15',
      yellow_fever_vaccine_date: '2026-01-10',
    } as any;

    const truck: Truck = {
      id: 20,
      plate_number: '98765-B-40',
      model: 'Scania R500',
      status: 'active',
      created_at: '2026-01-01',
    } as any;

    const africanDocs = [
      {
        entity_type: 'truck',
        entity_id: 20,
        document_type: 'carte_brune_cedeao',
        expiry_date: '2026-12-15',
      },
      {
        entity_type: 'truck',
        entity_id: 20,
        document_type: 'visite_technique',
        expiry_date: '2026-11-20',
      },
    ];

    it('authorizes African overland dispatch with valid African visa and Carte Brune', () => {
      const audit = TransitWatchdogService.auditTransitCompliance({
        driver: africanDriver,
        truck,
        fleetDocs: africanDocs,
        corridorType: 'african_overland',
        tripDate: baseDate,
      });

      expect(audit.is_dispatch_allowed).toBe(true);
      expect(audit.overall_status).toBe('compliant');
    });

    it('blocks African overland dispatch when African visa is missing or expired', () => {
      const driverWithoutVisa: Driver = {
        ...africanDriver,
        african_visa_expiry_date: undefined,
        african_visa_number: undefined,
      };

      const audit = TransitWatchdogService.auditTransitCompliance({
        driver: driverWithoutVisa,
        truck,
        fleetDocs: africanDocs,
        corridorType: 'african_overland',
        tripDate: baseDate,
      });

      expect(audit.is_dispatch_allowed).toBe(false);
      expect(audit.block_reasons.some((r) => r.includes('Transit Africain'))).toBe(true);
    });
  });

  describe('4. WhatsApp Localized Message Generation', () => {
    it('generates clear Arabic notification message', () => {
      const msg = TransitWatchdogService.buildDriverWhatsAppAlertText({
        driverName: 'عمر القادري',
        documentNameAr: 'تأشيرة شنغن',
        documentNameFr: 'Visa Schengen',
        documentNameEs: 'Visado Schengen',
        daysRemaining: 12,
        expiryDate: '2026-10-22',
        locale: 'ar',
      });

      expect(msg).toContain('عمر القادري');
      expect(msg).toContain('تأشيرة شنغن');
      expect(msg).toContain('12 يوماً');
      expect(msg).toContain('المعابر الحدودية');
    });

    it('generates clear French notification message', () => {
      const msg = TransitWatchdogService.buildDriverWhatsAppAlertText({
        driverName: 'Omar Kadiri',
        documentNameAr: 'تأشيرة شنغن',
        documentNameFr: 'Visa Schengen',
        documentNameEs: 'Visado Schengen',
        daysRemaining: 14,
        expiryDate: '2026-10-24',
        locale: 'fr',
      });

      expect(msg).toContain('Omar Kadiri');
      expect(msg).toContain('Visa Schengen');
      expect(msg).toContain('14 jours');
      expect(msg).toContain('mission internationale');
    });
  });

  describe('5. Zod Schema Validations', () => {
    it('validates correct trip dispatch audit input', () => {
      const valid = auditTripDispatchSchema.safeParse({
        driver_id: 1,
        truck_id: 10,
        corridor_type: 'european_maritime',
      });
      expect(valid.success).toBe(true);
    });

    it('rejects invalid corridor or negative driver ID', () => {
      const invalid = auditTripDispatchSchema.safeParse({
        driver_id: -5,
        corridor_type: 'unknown_corridor',
      });
      expect(invalid.success).toBe(false);
    });

    it('validates driver WhatsApp expiry alert schema', () => {
      const valid = sendDriverExpiryAlertSchema.safeParse({
        driver_id: 2,
        document_name_ar: 'تأشيرة شنغن',
        document_name_fr: 'Visa Schengen',
        document_name_es: 'Visado Schengen',
        days_remaining: 10,
        expiry_date: '2026-10-20',
        locale: 'ar',
      });
      expect(valid.success).toBe(true);
    });
  });
});

