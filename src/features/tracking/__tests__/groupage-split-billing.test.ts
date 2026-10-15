import { describe, it, expect, beforeEach, vi } from 'vitest';
import Decimal from 'decimal.js';
import {
  calculateTripTotalOperatingCost,
  calculateGroupageCostAllocation,
} from '../services/groupage-cost-allocator.service';
import {
  allocateGroupageCostsAction,
  generateConsignmentInvoicesAction,
  fetchGroupagePnlAction,
  clearSplitBillingCache,
} from '../services/groupage-split-billing.actions';
import type { TripConsignment } from '../types/groupage-ltl.types';
import type { TripOperatingCosts } from '../types/groupage-split-billing.types';

// Mock Supabase Server Client
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: {
              id: 8840,
              currency: 'MAD',
              ferry_cost: 7000,
              fuel_expenses: 3500,
              transit_almeria_cost: 400,
              marsa_maroc_cost: 500,
              triptik_cost: 300,
            },
            error: null,
          }),
          order: vi.fn().mockResolvedValue({
            data: [
              {
                id: 'consign-uuid-001',
                trip_id: 8840,
                consignment_reference: 'LTL-8840-001',
                client_id: 10,
                client_name: 'Atlas Agro Agadir',
                loading_city: 'Agadir',
                loading_country: 'MA',
                delivery_city: 'Perpignan',
                delivery_country: 'FR',
                cargo_description: 'Tomates Cerises',
                chargeable_weight_kg: 6000,
                ldm_meters: 3.2,
                freight_price: 24000,
                currency: 'MAD',
                cmr_number: 'CMR-8840-001',
                status: 'delivered',
              },
              {
                id: 'consign-uuid-002',
                trip_id: 8840,
                consignment_reference: 'LTL-8840-002',
                client_id: 20,
                client_name: 'Casablanca Logistics',
                loading_city: 'Casablanca',
                loading_country: 'MA',
                delivery_city: 'Madrid',
                delivery_country: 'ES',
                cargo_description: 'Textiles & Confection',
                chargeable_weight_kg: 4000,
                ldm_meters: 2.0,
                freight_price: 16000,
                currency: 'MAD',
                cmr_number: 'CMR-8840-002',
                status: 'delivered',
              },
            ],
            error: null,
          }),
        }),
      }),
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: { id: 9001 }, error: null }),
        }),
      }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
    }),
  }),
}));

// Mock Audit Logger
vi.mock('@/lib/audit.server', () => ({
  recordAuditLog: vi.fn().mockResolvedValue(undefined),
}));

describe('Groupage Split-Billing & Cost Allocation Engine', () => {
  beforeEach(async () => {
    await clearSplitBillingCache();
    vi.clearAllMocks();
  });

  const sampleConsignments: TripConsignment[] = [
    {
      id: 'c1',
      tripId: 8840,
      consignmentReference: 'LTL-8840-001',
      clientId: 10,
      clientName: 'Atlas Agro Agadir',
      loadingCity: 'Agadir',
      loadingCountry: 'MA',
      deliveryCity: 'Perpignan',
      deliveryCountry: 'FR',
      cargoDescription: 'Tomates Cerises',
      isTemperatureControlled: true,
      palletCount: 8,
      palletType: 'euro',
      isStackable: false,
      ldmMeters: 3.2,
      volumeM3: 11.52,
      grossWeightKg: 4800,
      chargeableWeightKg: 6000, // 60% of total 10,000 kg
      freightPrice: 24000,
      currency: 'MAD',
      cmrNumber: 'CMR-8840-001',
      status: 'delivered',
      createdAt: '2026-10-15T10:00:00Z',
      updatedAt: '2026-10-15T10:00:00Z',
    },
    {
      id: 'c2',
      tripId: 8840,
      consignmentReference: 'LTL-8840-002',
      clientId: 20,
      clientName: 'Casablanca Logistics',
      loadingCity: 'Casablanca',
      loadingCountry: 'MA',
      deliveryCity: 'Madrid',
      deliveryCountry: 'ES',
      cargoDescription: 'Textiles & Confection',
      isTemperatureControlled: false,
      palletCount: 5,
      palletType: 'euro',
      isStackable: true,
      ldmMeters: 1.0,
      volumeM3: 7.2,
      grossWeightKg: 2000,
      chargeableWeightKg: 4000, // 40% of total 10,000 kg
      freightPrice: 16000,
      currency: 'MAD',
      cmrNumber: 'CMR-8840-002',
      status: 'delivered',
      createdAt: '2026-10-15T10:00:00Z',
      updatedAt: '2026-10-15T10:00:00Z',
    },
  ];

  const sampleOperatingCosts: TripOperatingCosts = {
    fuelCost: 3500,
    ferryCost: 7000,
    tollsCost: 1800,
    customsCost: 1200,
    driverCost: 2500,
    totalSharedCost: 16000,
    currency: 'MAD',
  };

  describe('Mathematical Precision via Decimal.js', () => {
    it('calculates total shared trip operating costs with precision', () => {
      const costs = calculateTripTotalOperatingCost({
        fuelCost: 3450.75,
        ferryCost: 7000.0,
        tollsCost: 1845.5,
        customsCost: 1200.25,
        driverCost: 2500.0,
      });

      // 3450.75 + 7000 + 1845.50 + 1200.25 + 2500 = 15996.50
      expect(costs.totalSharedCost).toBe(15996.5);
    });

    it('allocates shared costs proportionally by Chargeable Weight (Mode A)', () => {
      const pnl = calculateGroupageCostAllocation(
        sampleConsignments,
        sampleOperatingCosts,
        'chargeable_weight'
      );

      expect(pnl.totalRevenue).toBe(40000); // 24000 + 16000
      expect(pnl.totalAllocatedCost).toBe(16000);
      expect(pnl.totalNetProfit).toBe(24000); // 40000 - 16000
      expect(pnl.overallProfitMarginPct).toBe(60.0); // 24000 / 40000 * 100
      expect(pnl.isProfitable).toBe(true);

      // Consignment 1: 6,000 / 10,000 = 60% share
      const c1 = pnl.items[0];
      expect(c1.shareRatioPct).toBe(60.0);
      expect(c1.allocatedCost).toBe(9600); // 16000 * 0.60
      expect(c1.netMargin).toBe(14400); // 24000 - 9600
      expect(c1.profitMarginPct).toBe(60.0);
      expect(c1.isProfitable).toBe(true);

      // Consignment 2: 4,000 / 10,000 = 40% share
      const c2 = pnl.items[1];
      expect(c2.shareRatioPct).toBe(40.0);
      expect(c2.allocatedCost).toBe(6400); // 16000 * 0.40
      expect(c2.netMargin).toBe(9600); // 16000 - 6400
      expect(c2.profitMarginPct).toBe(60.0);
      expect(c2.isProfitable).toBe(true);

      // Reconciles exactly: 9600 + 6400 === 16000
      expect(c1.allocatedCost + c2.allocatedCost).toBe(16000);
    });

    it('allocates shared costs proportionally by Loading Meters LDM (Mode B)', () => {
      // Total LDM = 3.2 + 1.0 = 4.2 LDM
      const pnl = calculateGroupageCostAllocation(
        sampleConsignments,
        sampleOperatingCosts,
        'ldm'
      );

      const c1 = pnl.items[0];
      const c2 = pnl.items[1];

      // Total allocated cost must equal total shared cost exactly
      Decimal.config({ precision: 20, rounding: Decimal.ROUND_HALF_UP });
      const sumAllocated = new Decimal(c1.allocatedCost).plus(new Decimal(c2.allocatedCost));
      expect(sumAllocated.toNumber()).toBe(16000);

      // c1: 3.2 / 4.2 = ~76.19%
      expect(c1.shareRatioPct).toBe(76.19);
      // c2: 1.0 / 4.2 = ~23.81%
      expect(c2.shareRatioPct).toBe(23.81);
    });

    it('detects loss when allocated costs exceed freight revenue', () => {
      const expensiveCosts: TripOperatingCosts = {
        ...sampleOperatingCosts,
        totalSharedCost: 50000, // Exceeds 40,000 revenue
      };

      const pnl = calculateGroupageCostAllocation(
        sampleConsignments,
        expensiveCosts,
        'chargeable_weight'
      );

      expect(pnl.isProfitable).toBe(false);
      expect(pnl.totalNetProfit).toBe(-10000);
      expect(pnl.overallProfitMarginPct).toBe(-25.0);
    });

    it('handles empty consignments gracefully', () => {
      const pnl = calculateGroupageCostAllocation([], sampleOperatingCosts);
      expect(pnl.consignmentsCount).toBe(0);
      expect(pnl.totalRevenue).toBe(0);
      expect(pnl.totalNetProfit).toBe(-16000);
      expect(pnl.isProfitable).toBe(false);
    });
  });

  describe('Server Actions & Multi-Consignment Invoicing', () => {
    it('executes cost allocation and returns full P&L summary', async () => {
      const res = await allocateGroupageCostsAction({
        tripId: 8840,
        allocationMode: 'chargeable_weight',
        fuelCost: 3500,
        ferryCost: 7000,
        tollsCost: 1800,
        customsCost: 1200,
        driverCost: 2500,
      });

      expect(res.success).toBe(true);
      expect(res.data).toBeDefined();
      expect(res.data?.tripId).toBe(8840);
      expect(res.data?.consignmentsCount).toBe(2);
      expect(res.data?.totalRevenue).toBe(40000);
      expect(res.data?.totalAllocatedCost).toBe(16000);
      expect(res.data?.totalNetProfit).toBe(24000);
    });

    it('generates independent split invoices for consignments', async () => {
      const res = await generateConsignmentInvoicesAction({
        tripId: 8840,
        paymentDueDays: 30,
      });

      expect(res.success).toBe(true);
      expect(res.data).toBeDefined();
      expect(res.data?.generatedInvoicesCount).toBe(2);
      expect(res.data?.invoiceNumbers.length).toBe(2);
      expect(res.data?.invoiceNumbers[0]).toMatch(/^INV-LTL-8840-\d{4}$/);
    });

    it('enforces idempotency and skips already invoiced consignments', async () => {
      // First generation
      const firstRes = await generateConsignmentInvoicesAction({
        tripId: 8840,
        paymentDueDays: 30,
      });
      expect(firstRes.success).toBe(true);
      expect(firstRes.data?.generatedInvoicesCount).toBe(2);

      // Second generation without forceRecreate -> 0 new invoices
      const secondRes = await generateConsignmentInvoicesAction({
        tripId: 8840,
        paymentDueDays: 30,
        forceRecreate: false,
      });
      expect(secondRes.success).toBe(true);
      expect(secondRes.data?.generatedInvoicesCount).toBe(0);
    });

    it('retrieves cached P&L summary via fetchGroupagePnlAction', async () => {
      // First allocate
      await allocateGroupageCostsAction({
        tripId: 8840,
        allocationMode: 'chargeable_weight',
      });

      // Then fetch
      const fetchRes = await fetchGroupagePnlAction(8840);
      expect(fetchRes.success).toBe(true);
      expect(fetchRes.data?.tripId).toBe(8840);
      expect(fetchRes.data?.items.length).toBe(2);
    });

    it('rejects invalid inputs with Zod validation', async () => {
      const res = await allocateGroupageCostsAction({
        tripId: -1,
      } as any);

      expect(res.success).toBe(false);
      expect(res.error).toBeDefined();
    });
  });
});

