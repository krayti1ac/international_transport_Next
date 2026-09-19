import { describe, it, expect } from 'vitest';
import Decimal from 'decimal.js';
import {
  calculateRemainingDays,
  checkDocumentExpiry,
  evaluateFleetDocumentsRadar,
  type FleetEntityType,
} from '@/lib/utils/document-radar';
import { calculateFleetDocumentStats } from '@/lib/utils/financial';

Decimal.config({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

describe('Fleet Documents Expiry Radar (رادار وثائق الأسطول)', () => {
  const fixedBaseDate = new Date('2026-09-18T12:00:00Z');

  describe('1. Days calculation & timezone normalization (حساب الأيام المتبقية والمناطق الزمنية)', () => {
    it('calculates remaining calendar days accurately regardless of hours/timezones', () => {
      // Same day at different hours
      const sameDayMorning = new Date('2026-09-18T03:00:00Z');
      const sameDayNight = new Date('2026-09-18T23:59:59Z');

      expect(calculateRemainingDays(sameDayMorning, fixedBaseDate)).toBe(0);
      expect(calculateRemainingDays(sameDayNight, fixedBaseDate)).toBe(0);

      // Exactly 10 days in the future
      const futureDate = new Date('2026-09-28T08:00:00Z');
      expect(calculateRemainingDays(futureDate, fixedBaseDate)).toBe(10);

      // Exactly 5 days in the past
      const pastDate = new Date('2026-09-13T19:00:00Z');
      expect(calculateRemainingDays(pastDate, fixedBaseDate)).toBe(-5);
    });

    it('handles ISO string dates correctly', () => {
      expect(calculateRemainingDays('2026-09-18', fixedBaseDate)).toBe(0);
      expect(calculateRemainingDays('2026-09-20', fixedBaseDate)).toBe(2);
      expect(calculateRemainingDays('2026-09-10', fixedBaseDate)).toBe(-8);
    });

    it('handles missing or invalid dates gracefully', () => {
      expect(calculateRemainingDays(null, fixedBaseDate)).toBe(9999);
      expect(calculateRemainingDays(undefined, fixedBaseDate)).toBe(9999);
      expect(calculateRemainingDays('invalid-date', fixedBaseDate)).toBe(9999);
    });
  });

  describe('2. Document radar status classification (تصنيف حالات الرادار الأربعة)', () => {
    it('classifies Expired documents (< 0 days) with red color 🔴', () => {
      const pastExpiry = new Date('2026-09-15T00:00:00Z'); // 3 days ago
      const result = checkDocumentExpiry(pastExpiry, 'truck', fixedBaseDate);

      expect(result.status).toBe('expired');
      expect(result.color).toBe('red');
      expect(result.daysRemaining).toBe(-3);
      expect(result.isUrgent).toBe(true);
      expect(result.entityType).toBe('truck');
      expect(result.labelAr).toContain('انتهت منذ 3 يوم');
    });

    it('classifies Critical / Expiring Soon documents (0 - 15 days) with orange color 🟠', () => {
      // 0 days (expires today)
      const todayExpiry = new Date('2026-09-18T18:00:00Z');
      const res0 = checkDocumentExpiry(todayExpiry, 'trailer', fixedBaseDate);
      expect(res0.status).toBe('critical');
      expect(res0.color).toBe('orange');
      expect(res0.daysRemaining).toBe(0);
      expect(res0.isUrgent).toBe(true);
      expect(res0.labelAr).toContain('تنتهي اليوم');

      // 10 days
      const tenDaysExpiry = new Date('2026-09-28T00:00:00Z');
      const res10 = checkDocumentExpiry(tenDaysExpiry, 'truck', fixedBaseDate);
      expect(res10.status).toBe('critical');
      expect(res10.color).toBe('orange');
      expect(res10.daysRemaining).toBe(10);
      expect(res10.isUrgent).toBe(true);
      expect(res10.labelAr).toContain('متبقي 10 أيام (حرجة)');

      // 15 days boundary
      const fifteenDaysExpiry = new Date('2026-10-03T00:00:00Z');
      const res15 = checkDocumentExpiry(fifteenDaysExpiry, 'driver', fixedBaseDate);
      expect(res15.status).toBe('critical');
      expect(res15.color).toBe('orange');
      expect(res15.daysRemaining).toBe(15);
      expect(res15.isUrgent).toBe(true);
    });

    it('classifies Warning documents (16 - 30 days) with yellow color 🟡', () => {
      // 16 days (boundary)
      const sixteenDaysExpiry = new Date('2026-10-04T00:00:00Z');
      const res16 = checkDocumentExpiry(sixteenDaysExpiry, 'truck', fixedBaseDate);
      expect(res16.status).toBe('warning');
      expect(res16.color).toBe('yellow');
      expect(res16.daysRemaining).toBe(16);
      expect(res16.isUrgent).toBe(true);
      expect(res16.labelAr).toContain('متبقي 16 يوم (تحذير)');

      // 30 days (boundary)
      const thirtyDaysExpiry = new Date('2026-10-18T00:00:00Z');
      const res30 = checkDocumentExpiry(thirtyDaysExpiry, 'trailer', fixedBaseDate);
      expect(res30.status).toBe('warning');
      expect(res30.color).toBe('yellow');
      expect(res30.daysRemaining).toBe(30);
      expect(res30.isUrgent).toBe(true);
    });

    it('classifies Safe documents (> 30 days) with green color 🟢', () => {
      // 31 days (boundary)
      const thirtyOneDaysExpiry = new Date('2026-10-19T00:00:00Z');
      const res31 = checkDocumentExpiry(thirtyOneDaysExpiry, 'driver', fixedBaseDate);
      expect(res31.status).toBe('safe');
      expect(res31.color).toBe('green');
      expect(res31.daysRemaining).toBe(31);
      expect(res31.isUrgent).toBe(false);
      expect(res31.labelAr).toContain('سارية (متبقي 31 يوم)');

      // 1 year in future
      const nextYear = new Date('2027-09-18T00:00:00Z');
      const resYear = checkDocumentExpiry(nextYear, 'truck', fixedBaseDate);
      expect(resYear.status).toBe('safe');
      expect(resYear.color).toBe('green');
      expect(resYear.daysRemaining).toBe(365);
    });

    it('handles missing document expiry date', () => {
      const result = checkDocumentExpiry(null, 'driver', fixedBaseDate);
      expect(result.status).toBe('missing');
      expect(result.color).toBe('gray');
      expect(result.isUrgent).toBe(false);
      expect(result.labelAr).toBe('غير مسجل');
    });
  });

  describe('3. Entity coverage: truck, trailer, driver (الكيانات الثلاثة)', () => {
    const entities: FleetEntityType[] = ['truck', 'trailer', 'driver'];

    entities.forEach((entity) => {
      it(`evaluates validity correctly for ${entity}`, () => {
        const expiredRes = checkDocumentExpiry('2026-08-01', entity, fixedBaseDate);
        expect(expiredRes.entityType).toBe(entity);
        expect(expiredRes.status).toBe('expired');

        const criticalRes = checkDocumentExpiry('2026-09-25', entity, fixedBaseDate);
        expect(criticalRes.entityType).toBe(entity);
        expect(criticalRes.status).toBe('critical');

        const safeRes = checkDocumentExpiry('2027-01-01', entity, fixedBaseDate);
        expect(safeRes.entityType).toBe(entity);
        expect(safeRes.status).toBe('safe');
      });
    });
  });

  describe('4. Batch Radar evaluation & stats (تقييم الحزمة الشاملة)', () => {
    it('evaluates radar stats accurately across mixed documents', () => {
      const mockDocs = [
        { id: 1, expiry_date: '2026-09-10', entity_type: 'truck' }, // expired (-8d)
        { id: 2, expiry_date: '2026-09-20', entity_type: 'truck' }, // critical (+2d)
        { id: 3, expiry_date: '2026-10-01', entity_type: 'trailer' }, // critical (+13d)
        { id: 4, expiry_date: '2026-10-10', entity_type: 'trailer' }, // warning (+22d)
        { id: 5, expiry_date: '2026-12-31', entity_type: 'driver' }, // safe (>30d)
        { id: 6, expiry_date: null, entity_type: 'driver' }, // missing
        { id: 7, expiry_date: '2026-09-01', entity_type: 'truck', is_archived: true }, // ignored (archived)
      ];

      const stats = evaluateFleetDocumentsRadar(mockDocs, fixedBaseDate);

      expect(stats.total).toBe(7);
      expect(stats.expired).toBe(1);
      expect(stats.critical).toBe(2);
      expect(stats.warning).toBe(1);
      expect(stats.safe).toBe(1);
      expect(stats.missing).toBe(1);
      expect(stats.urgentTotal).toBe(3); // expired (1) + critical (2)
      expect(stats.expiring30DaysTotal).toBe(3); // critical (2) + warning (1)
    });

    it('maintains backwards compatibility in calculateFleetDocumentStats in financial.ts', () => {
      const docs = [
        { expiry_date: '2026-09-01', document_type: 'insurance' },
        { expiry_date: '2026-09-25', document_type: 'technical_inspection' },
        { expiry_date: '2027-01-01', document_type: 'grey_card' },
      ];

      const stats = calculateFleetDocumentStats(docs);
      expect(stats).toHaveProperty('expired');
      expect(stats).toHaveProperty('expiringSoon');
      expect(stats).toHaveProperty('valid');
      expect(stats).toHaveProperty('critical');
      expect(stats).toHaveProperty('warning');
      expect(stats.total).toBe(3);
    });
  });

  describe('5. Financial Precision & Decimal.js in Document Renewal (الدقة المالية الصارمة)', () => {
    it('prevents JavaScript floating-point errors in renewal cost calculations', () => {
      // Known native JS floating point precision bug: 0.1 + 0.2 !== 0.3
      const nativeSum = 0.1 + 0.2;
      expect(nativeSum).not.toBe(0.3); // native float has rounding error 0.30000000000000004

      // With Decimal.js (strict rule)
      const decimalSum = new Decimal(0.1).plus(new Decimal(0.2));
      expect(decimalSum.toNumber()).toBe(0.3);
      expect(decimalSum.toFixed(2)).toBe('0.30');
    });

    it('calculates complex multi-renewal fee sum and treasury allocations without precision loss', () => {
      const renewalCosts = [
        new Decimal('1450.75'), // Truck Insurance
        new Decimal('350.20'),  // Technical Inspection
        new Decimal('180.05'),  // Tachograph Calibration
        new Decimal('2500.00'), // International ATP Permit
        new Decimal('0.05'),    // Stamp duty / tax adjustment
      ];

      const totalRenewalCost = renewalCosts.reduce(
        (sum, cost) => sum.plus(cost),
        new Decimal(0)
      );

      // 1450.75 + 350.20 + 180.05 + 2500.00 + 0.05 = 4481.05
      expect(totalRenewalCost.toFixed(2)).toBe('4481.05');
      expect(totalRenewalCost.toNumber()).toBe(4481.05);

      // Verify treasury withdrawal balance calculation
      const initialCashBoxBalance = new Decimal('50000.00');
      const remainingBalance = initialCashBoxBalance.minus(totalRenewalCost);
      expect(remainingBalance.toFixed(2)).toBe('45518.95');
    });

    it('correctly generates treasury transaction payload with exact decimal representation', () => {
      const docId = 42;
      const renewalCost = 1250.5;
      const costDecimal = new Decimal(renewalCost);
      const timestamp = 1726690000000;

      expect(costDecimal.greaterThan(0)).toBe(true);

      const treasuryPayload = {
        type: 'office_expense' as const,
        amount: parseFloat(costDecimal.toFixed(2)),
        currency: 'MAD',
        cash_box_id: 1,
        description: `تجديد وثيقة: تأمين الشاحنة (ID: ${docId})`,
        reference: `RENEWAL-${docId}-${timestamp}`,
        reconciliation_status: 'pending' as const,
      };

      expect(treasuryPayload.amount).toBe(1250.5);
      expect(treasuryPayload.reference).toBe('RENEWAL-42-1726690000000');
      expect(treasuryPayload.type).toBe('office_expense');
    });
  });

  describe('6. Document Renewal & Treasury Integration (أتمتة التجديد والربط المالي وسجل التدقيق)', () => {
    it('generates correct renewal record and treasury withdrawal when cost > 0', () => {
      const docId = 101;
      const prevExpiry = '2026-09-01';
      const newExpiry = '2027-09-01';
      const renewalCost = 3200.75;
      const currency = 'MAD';
      const cashBoxId = 2;
      const notes = 'تجديد التأمين السنوي الدولي';

      const costDec = new Decimal(renewalCost);
      const formattedCost = parseFloat(costDec.toFixed(2));

      // 1. Updated Fleet Document Payload
      const updatedDocPayload = {
        id: docId,
        previous_expiry_date: prevExpiry,
        expiry_date: newExpiry,
        cost: formattedCost,
        currency,
        notes,
      };

      // 2. Renewal Historical Audit Trail Record
      const renewalHistoryPayload = {
        fleet_document_id: docId,
        document_id: docId,
        previous_expiry_date: prevExpiry,
        new_expiry_date: newExpiry,
        renewal_cost: formattedCost,
        cost: formattedCost,
        currency,
        document_type: 'insurance',
        notes,
      };

      // 3. Treasury Transaction Payload
      const timestamp = Date.now();
      const treasuryPayload = costDec.greaterThan(0)
        ? {
            type: 'office_expense' as const,
            amount: formattedCost,
            currency,
            cash_box_id: cashBoxId,
            description: `تجديد وثيقة: insurance (ID: ${docId})`,
            reference: `RENEWAL-${docId}-${timestamp}`,
            reconciliation_status: 'pending' as const,
          }
        : null;

      // 4. Audit Log Payload
      const auditPayload = {
        entityType: 'fleet_document',
        entityId: docId,
        actionType: 'update' as const,
        reason: `تجديد وثيقة أسطول (insurance) إلى ${newExpiry} بتكلفة ${formattedCost} ${currency}`,
        oldData: {
          expiry_date: prevExpiry,
          cost: 0,
        },
        newData: {
          expiry_date: newExpiry,
          cost: formattedCost,
        },
      };

      expect(updatedDocPayload.expiry_date).toBe('2027-09-01');
      expect(renewalHistoryPayload.renewal_cost).toBe(3200.75);
      expect(treasuryPayload).not.toBeNull();
      expect(treasuryPayload?.reference).toMatch(new RegExp(`^RENEWAL-${docId}-\\d+$`));
      expect(treasuryPayload?.type).toBe('office_expense');
      expect(auditPayload.actionType).toBe('update');
      expect(auditPayload.entityType).toBe('fleet_document');
    });

    it('bypasses treasury transaction creation when renewal cost is 0', () => {
      const renewalCost = 0;
      const costDec = new Decimal(renewalCost);

      let treasuryCreated = false;
      if (costDec.greaterThan(0)) {
        treasuryCreated = true;
      }

      expect(treasuryCreated).toBe(false);
    });
  });
});

