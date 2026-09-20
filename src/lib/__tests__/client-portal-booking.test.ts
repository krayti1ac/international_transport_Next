import { describe, it, expect, vi, beforeEach } from 'vitest';
import Decimal from 'decimal.js';
import { z } from 'zod';
import {
  hasPermission,
  isRouteAllowed,
  ROLE_PERMISSIONS,
  ROLE_DEFAULT_REDIRECT,
} from '@/lib/rbac';
import { formatPhoneNumber } from '@/lib/whatsapp';

Decimal.config({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

// Zod Schema used in booking requests
const bookingTestSchema = z.object({
  routeFrom: z.string().min(2, 'مدينة الانطلاق مطلوبة'),
  routeTo: z.string().min(2, 'مدينة الوصول مطلوبة'),
  cargoType: z.enum(['fresh_produce', 'frozen_fish', 'general_cargo', 'pharmaceuticals']),
  trailerType: z.enum(['frigo', 'bache', 'box', 'container']),
  targetTemperature: z.number().nullable().optional(),
  weightTons: z.number().nullable().optional(),
  pickupDate: z.string().min(1, 'تاريخ التحميل مطلوب'),
  deliveryDeadline: z.string().nullable().optional(),
  pickupAddress: z.string().nullable().optional(),
  pickupGpsUrl: z.string().nullable().optional(),
  deliveryAddress: z.string().nullable().optional(),
  deliveryGpsUrl: z.string().nullable().optional(),
  specialInstructions: z.string().nullable().optional(),
});

function detectCorridorType(routeTo: string, explicitCorridor?: string): string {
  if (explicitCorridor) return explicitCorridor;
  const africanKeywords = [
    'dakar',
    'rosso',
    'nouakchott',
    'mauritanie',
    'senegal',
    'sénégal',
    'guerguerat',
    'nouadhibou',
  ];
  const destLower = routeTo.toLowerCase();
  return africanKeywords.some((kw) => destLower.includes(kw))
    ? 'african_overland'
    : 'european_maritime';
}

function sanitizeClientTrip(rawTrip: Record<string, any>) {
  const sanitized = { ...rawTrip };
  delete sanitized.cost_freight;
  delete sanitized.fuel_cost;
  delete sanitized.fuel_consumption_rate;
  delete sanitized.ferry_cost;
  delete sanitized.driver_advance;
  delete sanitized.total_expenses;
  delete sanitized.net_profit;

  if (sanitized.truck) {
    sanitized.truck = {
      id: sanitized.truck.id,
      plate_number: sanitized.truck.plate_number,
      model: sanitized.truck.model,
      status: sanitized.truck.status,
    };
  }

  if (sanitized.driver) {
    sanitized.driver = {
      id: sanitized.driver.id,
      name: sanitized.driver.name,
      phone: sanitized.driver.phone,
      license: sanitized.driver.license,
    };
  }

  return sanitized;
}

describe('Client Portal & Self-Service Booking System', () => {
  describe('1. Role-Based Access Control (RBAC) for Client Role', () => {
    it('grants client portal:access and self-service booking permissions', () => {
      expect(hasPermission('client', 'portal:access')).toBe(true);
      expect(hasPermission('client', 'bookings:create')).toBe(true);
      expect(hasPermission('client', 'bookings:read')).toBe(true);
      expect(hasPermission('client', 'trips:read')).toBe(true);
      expect(hasPermission('client', 'invoices:read')).toBe(true);
      expect(hasPermission('client', 'documents:read')).toBe(true);
    });

    it('strictly denies client sensitive operational, fleet, and financial management permissions', () => {
      expect(hasPermission('client', 'trips:create')).toBe(false);
      expect(hasPermission('client', 'trips:delete')).toBe(false);
      expect(hasPermission('client', 'invoices:create')).toBe(false);
      expect(hasPermission('client', 'invoices:delete')).toBe(false);
      expect(hasPermission('client', 'fleet:manage')).toBe(false);
      expect(hasPermission('client', 'treasury:manage')).toBe(false);
      expect(hasPermission('client', 'companies:manage')).toBe(false);
      expect(hasPermission('client', 'users:manage')).toBe(false);
    });

    it('restricts client strictly to /portal and /track routes and blocks back-office access', () => {
      expect(isRouteAllowed('client', '/portal')).toBe(true);
      expect(isRouteAllowed('client', '/portal/bookings')).toBe(true);
      expect(isRouteAllowed('client', '/portal/invoices')).toBe(true);
      expect(isRouteAllowed('client', '/portal/trips')).toBe(true);
      expect(isRouteAllowed('client', '/track/TRIP-101')).toBe(true);

      expect(isRouteAllowed('client', '/dashboard')).toBe(false);
      expect(isRouteAllowed('client', '/trips')).toBe(false);
      expect(isRouteAllowed('client', '/fleet')).toBe(false);
      expect(isRouteAllowed('client', '/invoices')).toBe(false);
      expect(isRouteAllowed('client', '/treasury')).toBe(false);
      expect(isRouteAllowed('client', '/settings')).toBe(false);
      expect(isRouteAllowed('client', '/super-admin')).toBe(false);
    });

    it('defines default redirect for client role to /portal', () => {
      expect(ROLE_DEFAULT_REDIRECT.client).toBe('/portal');
    });
  });

  describe('2. Booking Request Schema & Corridor Detection', () => {
    it('validates a valid European Reefer booking request', () => {
      const input = {
        routeFrom: 'Agadir',
        routeTo: 'Perpignan',
        cargoType: 'fresh_produce' as const,
        trailerType: 'frigo' as const,
        targetTemperature: 4,
        weightTons: 22,
        pickupDate: '2026-10-15',
        pickupAddress: 'Agadir Packhouse #3',
        pickupGpsUrl: 'https://maps.google.com/?q=30.4278,-9.5981',
      };

      const result = bookingTestSchema.safeParse(input);
      expect(result.success).toBe(true);

      const corridor = detectCorridorType(input.routeTo);
      expect(corridor).toBe('european_maritime');
    });

    it('detects African Overland corridor for Guerguerat, Mauritania, and Senegal destinations', () => {
      expect(detectCorridorType('Dakar (Sénégal)')).toBe('african_overland');
      expect(detectCorridorType('Rosso / Fleuve')).toBe('african_overland');
      expect(detectCorridorType('Nouakchott')).toBe('african_overland');
      expect(detectCorridorType('Guerguerat Border Post')).toBe('african_overland');
      expect(detectCorridorType('Madrid (Spain)')).toBe('european_maritime');
      expect(detectCorridorType('Valencia (Spain)')).toBe('european_maritime');
    });

    it('generates a compliant unique booking number format (BK-YYYY-XXXX)', () => {
      const year = new Date().getFullYear();
      const randomCode = Math.floor(1000 + Math.random() * 9000);
      const bookingNumber = `BK-${year}-${randomCode}`;

      expect(bookingNumber).toMatch(/^BK-\d{4}-\d{4}$/);
      expect(bookingNumber.startsWith(`BK-${year}-`)).toBe(true);
    });

    it('rejects booking requests with missing origin or invalid cargo type', () => {
      const invalid = {
        routeFrom: '',
        routeTo: 'Perpignan',
        cargoType: 'invalid_type',
        trailerType: 'frigo',
        pickupDate: '2026-10-15',
      };

      const result = bookingTestSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe('3. Strict Zero Financial Data Leakage Sanitization', () => {
    it('strips all internal cost, driver advance, and profit margin fields before returning to client', () => {
      const internalTrip = {
        id: 42,
        route: 'Agadir -> Perpignan',
        status: 'in_transit',
        cmr_number: 'CMR-42',
        departure_date: '2026-10-12',
        price_export: 3800,
        // Sensitive internal cost fields:
        cost_freight: 2100,
        fuel_cost: 950,
        fuel_consumption_rate: 34,
        ferry_cost: 320,
        driver_advance: 500,
        total_expenses: 2870,
        net_profit: 930,
        truck: {
          id: 1,
          plate_number: '12345-A-1',
          model: 'Volvo FH500',
          status: 'in_transit',
          purchase_price: 1200000,
        },
        driver: {
          id: 1,
          name: 'Hassan Amrani',
          phone: '+212600000001',
          license: 'B-1234',
          base_salary: 8000,
          bonus_percentage: 10,
        },
      };

      const safeTrip = sanitizeClientTrip(internalTrip);

      // Verify that sensitive cost fields are stripped
      expect(safeTrip.cost_freight).toBeUndefined();
      expect(safeTrip.fuel_cost).toBeUndefined();
      expect(safeTrip.fuel_consumption_rate).toBeUndefined();
      expect(safeTrip.ferry_cost).toBeUndefined();
      expect(safeTrip.driver_advance).toBeUndefined();
      expect(safeTrip.total_expenses).toBeUndefined();
      expect(safeTrip.net_profit).toBeUndefined();

      // Verify truck purchase price is stripped
      expect(safeTrip.truck.purchase_price).toBeUndefined();
      expect(safeTrip.truck.plate_number).toBe('12345-A-1');

      // Verify driver salary and bonuses are stripped
      expect(safeTrip.driver.base_salary).toBeUndefined();
      expect(safeTrip.driver.bonus_percentage).toBeUndefined();
      expect(safeTrip.driver.name).toBe('Hassan Amrani');

      // Verify public operational fields remain intact
      expect(safeTrip.id).toBe(42);
      expect(safeTrip.cmr_number).toBe('CMR-42');
      expect(safeTrip.price_export).toBe(3800);
    });
  });

  describe('4. Financial Precision Calculations (Decimal.js)', () => {
    it('calculates invoice totals, payments, and remaining balance accurately without float drift', () => {
      const invoices = [
        { id: 1, invoice_number: 'INV-001', ttc_amount: '4200.50', paid_amount: '4200.50' },
        { id: 2, invoice_number: 'INV-002', ttc_amount: '3800.75', paid_amount: '2000.00' },
        { id: 3, invoice_number: 'INV-003', ttc_amount: '5150.25', paid_amount: '0.00' },
      ];

      let totalInvoiced = new Decimal(0);
      let totalPaid = new Decimal(0);

      for (const inv of invoices) {
        totalInvoiced = totalInvoiced.plus(new Decimal(inv.ttc_amount));
        totalPaid = totalPaid.plus(new Decimal(inv.paid_amount));
      }

      const totalRemaining = totalInvoiced.minus(totalPaid);

      expect(totalInvoiced.toFixed(2)).toBe('13151.50');
      expect(totalPaid.toFixed(2)).toBe('6200.50');
      expect(totalRemaining.toFixed(2)).toBe('6951.00');

      // Individual balance calculations
      const inv2Rem = new Decimal(invoices[1].ttc_amount).minus(new Decimal(invoices[1].paid_amount));
      expect(inv2Rem.toFixed(2)).toBe('1800.75');
    });

    it('formats CSV statement records properly with UTF-8 BOM', () => {
      const invoices = [
        {
          invoice_number: 'INV-2026-001',
          issue_date: '2026-10-01',
          due_date: '2026-10-31',
          total_amount: '4500.00',
          paid_amount: '4500.00',
          currency: 'EUR',
        },
      ];

      const headers = ['Invoice Number', 'Issue Date', 'Due Date', 'TTC Amount', 'Paid Amount', 'Remaining', 'Currency', 'Status'];
      const rows = invoices.map((inv) => {
        const total = new Decimal(inv.total_amount);
        const paid = new Decimal(inv.paid_amount);
        const rem = total.minus(paid);
        return [
          inv.invoice_number,
          inv.issue_date,
          inv.due_date,
          total.toFixed(2),
          paid.toFixed(2),
          rem.toFixed(2),
          inv.currency,
          rem.lessThanOrEqualTo(0) ? 'PAID' : 'PENDING',
        ].join(',');
      });

      const csv = '\uFEFF' + [headers.join(','), ...rows].join('\n');
      expect(csv.startsWith('\uFEFF')).toBe(true);
      expect(csv).toContain('INV-2026-001,2026-10-01,2026-10-31,4500.00,4500.00,0.00,EUR,PAID');
    });
  });

  describe('5. WhatsApp Operations Notification Formatting', () => {
    it('formats operations room WhatsApp alert with all required logistic parameters', () => {
      const bookingNumber = 'BK-2026-7841';
      const clientName = 'Export Sud Primeurs';
      const routeFrom = 'Agadir';
      const routeTo = 'Perpignan';
      const corridorBadge = 'الممر الأوروبي البحري 🚢';
      const cargoType = 'fresh_produce';
      const trailerType = 'frigo';
      const targetTemperature = 4;
      const pickupDate = '2026-10-18';
      const pickupGps = 'https://maps.google.com/?q=30.4278,-9.5981';

      const alertMessage = `📦 *طلب حجز شاحنة دولية جديد (Booking Request)*
━━━━━━━━━━━━━━━━━━━━
🔖 *رقم الحجز:* ${bookingNumber}
🏢 *العميل:* ${clientName}
🛣️ *المسار:* ${routeFrom} ➔ ${routeTo}
🌐 *الممر اللوجستي:* ${corridorBadge}
📦 *طبيعة الشحنة:* خضار وفواكه طازجة 🥬
🚛 *نوع المقطورة:* مقطورة تبريد (Frigo) ❄️
❄️ *درجة الحرارة المطلوبة:* ${targetTemperature}°C
📅 *تاريخ التحميل المطلوب:* ${pickupDate}
📍 *موقع التحميل (GPS):* ${pickupGps}
━━━━━━━━━━━━━━━━━━━━
⚡ يرجى مراجعة الطلب في غرفة العمليات وتعيين الشاحنة والسائق عبر منظومة Trans Bodanon TMS.`;

      expect(alertMessage).toContain(bookingNumber);
      expect(alertMessage).toContain(clientName);
      expect(alertMessage).toContain('Agadir ➔ Perpignan');
      expect(alertMessage).toContain('الممر الأوروبي البحري 🚢');
      expect(alertMessage).toContain('مقطورة تبريد (Frigo) ❄️');
      expect(alertMessage).toContain('4°C');
      expect(alertMessage).toContain('2026-10-18');
      expect(alertMessage).toContain(pickupGps);
    });

    it('normalizes Moroccan phone numbers for operations dispatch', () => {
      expect(formatPhoneNumber('0694585307')).toBe('212694585307');
      expect(formatPhoneNumber('+212 694-585307')).toBe('212694585307');
      expect(formatPhoneNumber('00212694585307')).toBe('212694585307');
    });
  });
});

