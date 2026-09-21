import { describe, it, expect } from 'vitest';
import {
  validateTripTransition,
  TRIP_STAGES,
  ALLOWED_STAGE_TRANSITIONS,
  normalizeTripStage,
} from '@/features/trips/services/trip-state-machine';
import type { TripOrder, Driver, Truck, Trailer, DeliverySignature } from '@/types/database';

describe('Trip Lifecycle State Machine & Transition Guards', () => {
  const baseTrip: TripOrder = {
    id: 101,
    route: 'Agadir -> Dakar',
    price: 35000,
    departure_date: '2026-10-01',
    status: 'draft',
    created_at: '2026-09-20T10:00:00Z',
    corridor_type: 'african_overland',
    goods_description_export: 'خضروات وفواكه طازجة',
    weight_export: 22000,
  };

  const validDriver: Driver = {
    id: 1,
    name: 'سعيد التازي',
    phone: '+212600000001',
    license: 'B-12345',
    status: 'available',
    base_salary: 5000,
    bonus_percentage: 5,
    has_valid_visa: true,
    african_visa_number: 'AFR-VISA-999',
    african_visa_expiry_date: '2027-12-31',
  };

  const validTruck: Truck = {
    id: 1,
    plate_number: '12345-A-26',
    model: 'Volvo FH500 2023',
    status: 'available',
    created_at: '2026-01-01',
  };

  const validTrailer: Trailer = {
    id: 1,
    plate_number: 'REM-9988',
    model: 'Schmitz Cargobull Reefer',
    status: 'available',
    created_at: '2026-01-01',
  };

  const validPod: DeliverySignature = {
    id: 1,
    trip_order_id: 101,
    signed_by: 'Amadou Diallo',
    signature_url: 'data:image/png;base64,mockSignature',
    signed_at: '2026-10-05T12:00:00Z',
    latitude: 14.7167,
    longitude: -17.4677,
    created_at: '2026-10-05T12:00:00Z',
  };

  describe('1. Normalization & Stage Constants', () => {
    it('normalizes legacy or lowercase stages accurately', () => {
      expect(normalizeTripStage('pending')).toBe('draft');
      expect(normalizeTripStage('planned')).toBe('draft');
      expect(normalizeTripStage('completed')).toBe('delivered');
      expect(normalizeTripStage('in_transit')).toBe('in_transit');
      expect(normalizeTripStage(null)).toBe('draft');
    });

    it('rejects completely invalid target stages', () => {
      const result = validateTripTransition('draft', 'unknown_stage', {
        trip: baseTrip,
      });
      expect(result.valid).toBe(false);
      expect(result.code).toBe('INVALID_TARGET_STAGE');
    });
  });

  describe('2. Transition Guards: Draft -> Assigned', () => {
    it('blocks assignment if driver is missing', () => {
      const result = validateTripTransition('draft', 'assigned', {
        trip: baseTrip,
        truck: validTruck,
        driver: null,
      });
      expect(result.valid).toBe(false);
      expect(result.code).toBe('MISSING_DRIVER');
    });

    it('blocks assignment if truck is missing', () => {
      const result = validateTripTransition('draft', 'assigned', {
        trip: baseTrip,
        truck: null,
        driver: validDriver,
      });
      expect(result.valid).toBe(false);
      expect(result.code).toBe('MISSING_TRUCK');
    });

    it('blocks African overland assignment if African visa is expired', () => {
      const expiredDriver: Driver = {
        ...validDriver,
        african_visa_expiry_date: '2024-01-01', // Expired
      };
      const result = validateTripTransition('draft', 'assigned', {
        trip: { ...baseTrip, corridor_type: 'african_overland' },
        truck: validTruck,
        driver: expiredDriver,
      });
      expect(result.valid).toBe(false);
      expect(result.code).toBe('AFRICAN_VISA_INVALID');
    });

    it('blocks European maritime assignment if Schengen visa is invalid', () => {
      const driverNoSchengen: Driver = {
        ...validDriver,
        has_valid_visa: false,
      };
      const result = validateTripTransition('draft', 'assigned', {
        trip: { ...baseTrip, corridor_type: 'european_maritime' },
        truck: validTruck,
        driver: driverNoSchengen,
      });
      expect(result.valid).toBe(false);
      expect(result.code).toBe('SCHENGEN_VISA_REQUIRED');
    });

    it('approves assignment when crew, vehicle, and corridor visa are valid', () => {
      const result = validateTripTransition('draft', 'assigned', {
        trip: baseTrip,
        truck: validTruck,
        trailer: validTrailer,
        driver: validDriver,
      });
      expect(result.valid).toBe(true);
    });
  });

  describe('3. Transition Guards: Loading -> In_Transit', () => {
    it('blocks in_transit if weight is missing or zero', () => {
      const result = validateTripTransition('loading', 'in_transit', {
        trip: { ...baseTrip, weight_export: 0 },
        truck: validTruck,
        driver: validDriver,
      });
      expect(result.valid).toBe(false);
      expect(result.code).toBe('INVALID_WEIGHT');
    });

    it('blocks in_transit if cargo description and route are missing', () => {
      const result = validateTripTransition('loading', 'in_transit', {
        trip: { ...baseTrip, goods_description_export: '', route: '' },
        truck: validTruck,
        driver: validDriver,
      });
      expect(result.valid).toBe(false);
      expect(result.code).toBe('MISSING_CARGO_DATA');
    });

    it('allows transition to in_transit when weight and cargo description exist', () => {
      const result = validateTripTransition('loading', 'in_transit', {
        trip: baseTrip,
        truck: validTruck,
        driver: validDriver,
      });
      expect(result.valid).toBe(true);
    });
  });

  describe('4. Transition Guards: In_Transit -> Delivered', () => {
    it('blocks delivery if e-POD proof is missing', () => {
      const result = validateTripTransition('in_transit', 'delivered', {
        trip: baseTrip,
        deliveryProof: null,
      });
      expect(result.valid).toBe(false);
      expect(result.code).toBe('MISSING_EPOD');
    });

    it('allows transition to delivered when e-POD signature exists', () => {
      const result = validateTripTransition('in_transit', 'delivered', {
        trip: baseTrip,
        deliveryProof: validPod,
      });
      expect(result.valid).toBe(true);
    });
  });

  describe('5. Transition Guards: Delivered -> Settled -> Closed', () => {
    it('blocks settlement if driver advances/expenses are unsettled', () => {
      const result = validateTripTransition('delivered', 'settled', {
        trip: baseTrip,
        hasSettlementClosed: false,
      });
      expect(result.valid).toBe(false);
      expect(result.code).toBe('SETTLEMENT_UNCLOSED');
    });

    it('permits transition to settled when all advances are settled', () => {
      const result = validateTripTransition('delivered', 'settled', {
        trip: baseTrip,
        hasSettlementClosed: true,
      });
      expect(result.valid).toBe(true);
    });

    it('permits transition from settled to closed', () => {
      const result = validateTripTransition('settled', 'closed', {
        trip: baseTrip,
      });
      expect(result.valid).toBe(true);
    });
  });

  describe('6. Illegal Stage Jumps & Cancellation Guards', () => {
    it('blocks illegal stage jumps directly from draft to delivered', () => {
      const result = validateTripTransition('draft', 'delivered', {
        trip: baseTrip,
      });
      expect(result.valid).toBe(false);
      expect(result.code).toBe('ILLEGAL_STAGE_JUMP');
    });

    it('blocks cancellation of active trips in transit or delivered', () => {
      const result = validateTripTransition('in_transit', 'cancelled', {
        trip: baseTrip,
      });
      expect(result.valid).toBe(false);
      expect(result.code).toBe('CANNOT_CANCEL_ACTIVE_TRIP');
    });

    it('permits cancellation during draft or assigned stage', () => {
      const result = validateTripTransition('draft', 'cancelled', {
        trip: baseTrip,
      });
      expect(result.valid).toBe(true);
    });
  });
});

