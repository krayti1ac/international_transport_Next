import { describe, it, expect } from 'vitest';
import {
  validateICE,
  validateMoroccanPlate,
  validateEmail,
  validatePhone,
  validateICEField,
  validateMoroccanPlateField,
  validateEmailField,
  validatePhoneField,
} from './morocco-business';
import { validateRows } from '@/lib/excel-importer';

describe('Moroccan Business Validators', () => {
  describe('validateICE', () => {
    it('should validate exact 15-digit Moroccan ICE', () => {
      const result = validateICE('001928374000082');
      expect(result.valid).toBe(true);
      expect(result.message).toBeUndefined();
    });

    it('should validate 15-digit ICE containing whitespace', () => {
      const result = validateICE('001 928 374 000 082');
      expect(result.valid).toBe(true);
    });

    it('should reject ICE with less than 15 digits', () => {
      const result = validateICE('12345678901234');
      expect(result.valid).toBe(false);
      expect(result.message).toContain('15 رقماً');
    });

    it('should reject ICE with more than 15 digits', () => {
      const result = validateICE('00192837400008299');
      expect(result.valid).toBe(false);
      expect(result.message).toContain('15 رقماً');
    });

    it('should reject ICE containing non-digit characters', () => {
      const result = validateICE('00192837400008A');
      expect(result.valid).toBe(false);
      expect(result.message).toContain('15 رقماً');
    });

    it('should reject empty or null ICE', () => {
      expect(validateICE('').valid).toBe(false);
      expect(validateICE('   ').valid).toBe(false);
      expect(validateICE(null).valid).toBe(false);
      expect(validateICE(undefined).valid).toBe(false);
    });
  });

  describe('validateMoroccanPlate', () => {
    it('should validate standard Arabic Moroccan plate (12345-أ-6)', () => {
      const result = validateMoroccanPlate('12345-أ-6');
      expect(result.valid).toBe(true);
    });

    it('should validate standard Latin Moroccan plate (12345-A-6)', () => {
      const result = validateMoroccanPlate('12345-A-6');
      expect(result.valid).toBe(true);
    });

    it('should validate plates with 2-digit prefecture codes (e.g. 26 Marrakech, 40 Tanger)', () => {
      expect(validateMoroccanPlate('24134-A-26').valid).toBe(true);
      expect(validateMoroccanPlate('67890-B-40').valid).toBe(true);
      expect(validateMoroccanPlate('11223-د-26').valid).toBe(true);
    });

    it('should validate plates with alternative delimiters (| or / or spaces)', () => {
      expect(validateMoroccanPlate('12345 | أ | 6').valid).toBe(true);
      expect(validateMoroccanPlate('12345 / A / 6').valid).toBe(true);
      expect(validateMoroccanPlate('12345 A 6').valid).toBe(true);
    });

    it('should validate trailer plates with prefixes (REM / R / مقطورة)', () => {
      expect(validateMoroccanPlate('REM-8921-MA').valid).toBe(true);
      expect(validateMoroccanPlate('REM-4402-MA').valid).toBe(true);
      expect(validateMoroccanPlate('R-12345-A').valid).toBe(true);
      expect(validateMoroccanPlate('م-12345-6').valid).toBe(true);
    });

    it('should validate temporary WW plates', () => {
      expect(validateMoroccanPlate('12345-WW').valid).toBe(true);
      expect(validateMoroccanPlate('12345-A').valid).toBe(true);
    });

    it('should reject invalid plate formats', () => {
      expect(validateMoroccanPlate('not-a-plate').valid).toBe(false);
      expect(validateMoroccanPlate('123').valid).toBe(false);
      expect(validateMoroccanPlate('ABC-DEF').valid).toBe(false);
      expect(validateMoroccanPlate('').valid).toBe(false);
      expect(validateMoroccanPlate(null).valid).toBe(false);
    });
  });

  describe('validateEmail & validatePhone', () => {
    it('should validate proper emails and reject invalid ones', () => {
      expect(validateEmail('test@transport.ma').valid).toBe(true);
      expect(validateEmail('admin@transbodanon.com').valid).toBe(true);
      expect(validateEmail('invalid-email').valid).toBe(false);
      expect(validateEmail('@domain.com').valid).toBe(false);
      expect(validateEmail('').valid).toBe(false);
    });

    it('should validate Moroccan and international phone numbers', () => {
      expect(validatePhone('0612345678').valid).toBe(true);
      expect(validatePhone('+212612345678').valid).toBe(true);
      expect(validatePhone('+212 5 22 12 34 56').valid).toBe(true);
      expect(validatePhone('0522-123456').valid).toBe(true);
      expect(validatePhone('123').valid).toBe(false);
      expect(validatePhone('').valid).toBe(false);
    });
  });

  describe('Field Adapters for Importers', () => {
    it('should return null for valid values and error message for invalid values', () => {
      expect(validateICEField('001928374000082')).toBeNull();
      expect(validateICEField('123')).not.toBeNull();
      expect(validateICEField('')).toBeNull(); // Empty values are ignored by field validators (handled by requiredFields)

      expect(validateMoroccanPlateField('12345-A-6')).toBeNull();
      expect(validateMoroccanPlateField('12345-أ-6')).toBeNull();
      expect(validateMoroccanPlateField('bad-plate')).not.toBeNull();
      expect(validateMoroccanPlateField('')).toBeNull();

      expect(validateEmailField('user@example.com')).toBeNull();
      expect(validateEmailField('bad-email')).not.toBeNull();

      expect(validatePhoneField('+212612345678')).toBeNull();
      expect(validatePhoneField('bad-phone')).not.toBeNull();
    });
  });

  describe('Integration with Excel validateRows', () => {
    it('should validate row data correctly using unified validators', () => {
      const rows = [
        {
          name: 'شركة النقل السريع',
          phone: '0612345678',
          ice: '001928374000082',
          plate_number: '12345-أ-6',
        },
        {
          name: 'شركة غير صالحة',
          phone: 'bad-phone',
          ice: '123',
          plate_number: 'invalid-plate',
        },
      ];

      const result = validateRows(rows, {
        requiredFields: ['name', 'phone', 'ice', 'plate_number'],
        fieldValidators: {
          ice: validateICEField,
          phone: validatePhoneField,
          plate_number: validateMoroccanPlateField,
        },
      });

      expect(result.validRows.length).toBe(1);
      expect(result.invalidRows.length).toBe(1);
      expect(result.invalidRows[0].errors.length).toBe(3);
    });
  });
});

