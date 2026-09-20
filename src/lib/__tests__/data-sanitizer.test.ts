import { describe, it, expect, vi } from 'vitest';
import {
  sanitizeICE,
  sanitizeMoroccanPlate,
  sanitizePhoneNumber,
  sanitizeNumeric,
  sanitizeClientRow,
  sanitizeVehicleRow,
  sanitizeDriverRow,
  sanitizeTripRow,
  sanitizeProviderRow,
  sanitizeTreasuryRow,
} from '@/lib/data-sanitizer';
import { validateRows } from '@/lib/excel-importer';
import { validateICE, validateMoroccanPlate, validatePhone } from '@/lib/validators/morocco-business';
import {
  validateBulkRows,
  generateSmartExcelTemplate,
  type BulkImportEntityType,
} from '@/lib/bulk-import';
import * as XLSX from 'xlsx';

describe('Data Sanitizer Engine (data-sanitizer.ts)', () => {
  describe('sanitizeICE', () => {
    it('should strip all whitespace from ICE', () => {
      const raw = '001 928 374 000 082';
      expect(sanitizeICE(raw)).toBe('001928374000082');
    });

    it('should strip dashes, dots, and non-digit characters', () => {
      const raw = '001-928-374.000/082';
      expect(sanitizeICE(raw)).toBe('001928374000082');
    });

    it('should handle empty or null values gracefully', () => {
      expect(sanitizeICE('')).toBe('');
      expect(sanitizeICE(null)).toBe('');
      expect(sanitizeICE(undefined)).toBe('');
    });
  });

  describe('sanitizeMoroccanPlate', () => {
    it('should convert slashes to standard dashes for Latin plates', () => {
      expect(sanitizeMoroccanPlate('12345/A/40')).toBe('12345-A-40');
    });

    it('should convert vertical bars and spaces to standard dashes for Arabic plates', () => {
      expect(sanitizeMoroccanPlate('12345 | أ | 40')).toBe('12345-أ-40');
    });

    it('should convert pure spaced format into standard dashed format', () => {
      expect(sanitizeMoroccanPlate('12345 أ 40')).toBe('12345-أ-40');
      expect(sanitizeMoroccanPlate('12345 B 6')).toBe('12345-B-6');
    });

    it('should standardize Moroccan trailer plates', () => {
      expect(sanitizeMoroccanPlate('REM 8921 MA')).toBe('REM-8921-MA');
      expect(sanitizeMoroccanPlate('rem/1234/ma')).toBe('rem-1234-ma');
    });

    it('should handle empty or null values', () => {
      expect(sanitizeMoroccanPlate('')).toBe('');
      expect(sanitizeMoroccanPlate(null)).toBe('');
    });
  });

  describe('sanitizePhoneNumber', () => {
    it('should convert local Moroccan 06 number to +212 international standard', () => {
      expect(sanitizePhoneNumber('0612345678')).toBe('+212612345678');
    });

    it('should convert local Moroccan 05 number to +212 international standard', () => {
      expect(sanitizePhoneNumber('0522123456')).toBe('+212522123456');
    });

    it('should convert 00212 prefix to +212 prefix', () => {
      expect(sanitizePhoneNumber('00212612345678')).toBe('+212612345678');
    });

    it('should strip extraneous spaces, hyphens, and parentheses', () => {
      expect(sanitizePhoneNumber('(06) 12-34 56 78')).toBe('+212612345678');
    });

    it('should preserve already valid + international formats', () => {
      expect(sanitizePhoneNumber('+212612345678')).toBe('+212612345678');
      expect(sanitizePhoneNumber('+34612345678')).toBe('+34612345678');
    });

    it('should handle 9-digit numbers missing leading zero', () => {
      expect(sanitizePhoneNumber('612345678')).toBe('+212612345678');
    });
  });

  describe('sanitizeNumeric (Decimal.js backed)', () => {
    it('should parse standard numeric strings', () => {
      expect(sanitizeNumeric('15000.50')).toBe(15000.5);
      expect(sanitizeNumeric('25')).toBe(25);
    });

    it('should clean currency symbols and commas', () => {
      expect(sanitizeNumeric('25,000 MAD')).toBe(25000);
      expect(sanitizeNumeric('34.50 L/100km')).toBe(34.5);
    });

    it('should return fallback on invalid input', () => {
      expect(sanitizeNumeric('invalid', 10)).toBe(10);
      expect(sanitizeNumeric('', 0)).toBe(0);
      expect(sanitizeNumeric(null, 5)).toBe(5);
    });
  });

  describe('Row sanitization helpers (Phase 2 Entities)', () => {
    it('should sanitize full client row', () => {
      const raw = {
        name: '  شركة النور اللوجستية  ',
        phone: '0661223344',
        ice: '001 888 999 000 111',
        city: '  طنجة  ',
      };
      const cleaned = sanitizeClientRow(raw);
      expect(cleaned.name).toBe('شركة النور اللوجستية');
      expect(cleaned.phone).toBe('+212661223344');
      expect(cleaned.ice).toBe('001888999000111');
      expect(cleaned.city).toBe('طنجة');
    });

    it('should sanitize full vehicle row', () => {
      const raw = {
        plate_number: '  12345 / أ / 40  ',
        model: '  Volvo FH 500  ',
        weight_capacity: '25 tonnes',
        fuel_consumption_rate: '34.5 %',
      };
      const cleaned = sanitizeVehicleRow(raw);
      expect(cleaned.plate_number).toBe('12345-أ-40');
      expect(cleaned.model).toBe('Volvo FH 500');
      expect(cleaned.weight_capacity).toBe(25);
      expect(cleaned.fuel_consumption_rate).toBe(34.5);
    });

    it('should sanitize full driver row with Decimal.js salary', () => {
      const raw = {
        name: '  أحمد الصديقي  ',
        phone: '0661998877',
        license: '  B/C/EC-99201  ',
        base_salary: '  6,500 MAD  ',
        bonus_percentage: '5 %',
        visa_number: '  V-ESP-2026-11  ',
      };
      const cleaned = sanitizeDriverRow(raw);
      expect(cleaned.name).toBe('أحمد الصديقي');
      expect(cleaned.phone).toBe('+212661998877');
      expect(cleaned.license).toBe('B/C/EC-99201');
      expect(cleaned.base_salary).toBe(6500);
      expect(cleaned.bonus_percentage).toBe(5);
      expect(cleaned.visa_number).toBe('V-ESP-2026-11');
    });

    it('should sanitize trip row with price and route', () => {
      const raw = {
        route: '  طنجة -> الجزيرة الخضراء -> مدريد  ',
        departure_date: '  2026-09-20  ',
        price: '32,000.00 MAD',
        truck_plate: '  12345 / A / 40  ',
        cmr_number: '  CMR-EXP-00105  ',
      };
      const cleaned = sanitizeTripRow(raw);
      expect(cleaned.route).toBe('طنجة -> الجزيرة الخضراء -> مدريد');
      expect(cleaned.departure_date).toBe('2026-09-20');
      expect(cleaned.price).toBe(32000);
      expect(cleaned.truck_plate).toBe('12345-A-40');
      expect(cleaned.cmr_number).toBe('CMR-EXP-00105');
    });

    it('should sanitize provider row with ICE and phone', () => {
      const raw = {
        name: '  محطة وقود أفريقيا  ',
        type: '  FUEL  ',
        phone: '0539934010',
        ice: '001 594 830 000 012',
      };
      const cleaned = sanitizeProviderRow(raw);
      expect(cleaned.name).toBe('محطة وقود أفريقيا');
      expect(cleaned.type).toBe('fuel');
      expect(cleaned.phone).toBe('+212539934010');
      expect(cleaned.ice).toBe('001594830000012');
    });

    it('should sanitize treasury row with amount and currency', () => {
      const raw = {
        type: '  DEPOSIT  ',
        amount: '  150,000 MAD  ',
        currency: '  mad  ',
        description: '  رصيد افتتاحي تأسيسي  ',
      };
      const cleaned = sanitizeTreasuryRow(raw);
      expect(cleaned.type).toBe('deposit');
      expect(cleaned.amount).toBe(150000);
      expect(cleaned.currency).toBe('MAD');
      expect(cleaned.description).toBe('رصيد افتتاحي تأسيسي');
    });
  });

  describe('Integration with validateRows (Smart Staging & Auto-Sanitization)', () => {
    it('should automatically sanitize dirty data before validation so it passes successfully', () => {
      const dirtyRows = [
        {
          'اسم العميل': 'شركة المغرب الدولي',
          'الهاتف': '06 12 34 56 78',
          'ICE': '001 928 374 000 082',
        },
      ];

      const result = validateRows(dirtyRows, {
        requiredFields: ['name', 'phone', 'ice'],
        fieldValidators: {
          ice: validateICE,
          phone: validatePhone,
        },
        headerAliases: {
          name: ['اسم العميل', 'name'],
          phone: ['الهاتف', 'phone'],
          ice: ['ICE', 'ice'],
        },
      });

      expect(result.success).toBe(true);
      expect(result.validRows.length).toBe(1);
      expect(result.invalidRows.length).toBe(0);

      const sanitized = result.validRows[0];
      expect(sanitized.ice).toBe('001928374000082');
      expect(sanitized.phone).toBe('+212612345678');
    });

    it('should skip sample/help rows automatically', () => {
      const rowsWithSample = [
        {
          'اسم العميل': 'شركة الأطلس (مثال)',
          'الهاتف': '0661234567',
          'ICE': '001928374000082',
        },
        {
          'اسم العميل': 'شركة حقيقية',
          'الهاتف': '0612345678',
          'ICE': '001928374000082',
        },
      ];

      const result = validateRows(rowsWithSample, {
        requiredFields: ['name', 'phone', 'ice'],
        fieldValidators: {
          ice: validateICE,
          phone: validatePhone,
        },
        headerAliases: {
          name: ['اسم العميل', 'name'],
          phone: ['الهاتف', 'phone'],
          ice: ['ICE', 'ice'],
        },
      });

      expect(result.validRows.length).toBe(1);
      expect(result.validRows[0].name).toBe('شركة حقيقية');
    });

    it('should sanitize vehicle plate numbers before validation in validateRows', () => {
      const dirtyVehicleRows = [
        {
          'لوحة الشاحنة': '12345 / A / 40',
          'الموديل': 'Volvo FH 16',
        },
      ];

      const result = validateRows(dirtyVehicleRows, {
        requiredFields: ['plate_number', 'model'],
        fieldValidators: {
          plate_number: validateMoroccanPlate,
        },
        headerAliases: {
          plate_number: ['لوحة الشاحنة', 'plate_number'],
          model: ['الموديل', 'model'],
        },
      });

      expect(result.success).toBe(true);
      expect(result.validRows.length).toBe(1);
      expect(result.validRows[0].plate_number).toBe('12345-A-40');
    });
  });

  describe('Bulk Validation for Phase 2 Entities (validateBulkRows)', () => {
    it('should validate driver rows and skip help rows', () => {
      const rows = [
        { name: 'محمد (مثال)', phone: '0612345678', license: 'B-123' },
        { name: 'رشيد بنعمر', phone: '0661122334', license: 'B/C/EC-8821' },
      ];
      const res = validateBulkRows(rows, 'driver');
      expect(res.validRows.length).toBe(1);
      expect(res.validRows[0].data.name).toBe('رشيد بنعمر');
      expect(res.validRows[0].data.phone).toBe('+212661122334');
    });

    it('should validate trip rows with price Decimal sanitization', () => {
      const rows = [
        { departure_date: '2026-09-20', price: '32000.50 MAD', route: 'طنجة -> مدريد' },
      ];
      const res = validateBulkRows(rows, 'trip');
      expect(res.validRows.length).toBe(1);
      expect(res.validRows[0].data.price).toBe(32000.5);
    });

    it('should validate provider rows with ICE checking', () => {
      const rows = [
        { name: 'محطة طنجة', type: 'fuel', ice: '001594830000012' },
      ];
      const res = validateBulkRows(rows, 'provider');
      expect(res.validRows.length).toBe(1);
      expect(res.validRows[0].data.ice).toBe('001594830000012');
    });

    it('should validate treasury rows with amount sanitization', () => {
      const rows = [
        { type: 'deposit', amount: '150,000', currency: 'MAD' },
      ];
      const res = validateBulkRows(rows, 'treasury');
      expect(res.validRows.length).toBe(1);
      expect(res.validRows[0].data.amount).toBe(150000);
    });
  });

  describe('Smart Excel Template Generation for All 7 Entities', () => {
    const writeFileSpy = vi.spyOn(XLSX, 'writeFile').mockImplementation(() => {});

    it('should generate valid templates for all 7 entity types without error', () => {
      const entities: BulkImportEntityType[] = [
        'client',
        'truck',
        'trailer',
        'driver',
        'trip',
        'provider',
        'treasury',
      ];

      for (const entity of entities) {
        expect(() => generateSmartExcelTemplate(entity)).not.toThrow();
      }

      expect(writeFileSpy).toHaveBeenCalledTimes(7);
      writeFileSpy.mockRestore();
    });
  });
});

