/**
 * Trans Bodanon TMS — Driver Hotspot Confirmation & Telematics Verification Unit Tests
 * Rigorous validation of dual-verification lock, Decimal.js scoring, discrepancy detection, and HMAC seals.
 * Standards: EU GDP (2013/C 343/01) / EN 12830 / ATP Treaty (FRC)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import Decimal from 'decimal.js';
import { HotspotComplianceVerifyService } from '../services/hotspot-compliance-verify.service';
import {
  submitDriverConfirmationSchema,
  verifyTelematicsQuerySchema,
} from '../types/hotspot-confirmation.types';
import {
  submitDriverHotspotConfirmationAction,
  verifyReeferTelematicsComplianceAction,
} from '../services/hotspot-confirmation.actions';

// Mock Supabase & Audit Log
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: { id: 'usr-driver-2026', email: 'driver@transbodanon.com' } },
        error: null,
      })),
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockResolvedValue({ data: null, error: null }),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          truck_id: 101,
          frigo_temperature: -19.4,
          recorded_at: new Date().toISOString(),
          attributes: {
            reefer_mode: 'continuous',
            compressor_status: 'running',
            door_open: false,
          },
        },
        error: null,
      }),
    })),
  })),
}));

vi.mock('@/lib/audit.server', () => ({
  recordAuditLog: vi.fn(async () => ({ success: true })),
}));

describe('Trans Bodanon TMS — Driver PWA Hotspot Confirmation & Telematics Engine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Pre-Docking Telematics Scoring & Dual-Verification Lock', () => {
    it('awards 100/100 score and verified_compliant status when all parameters match', () => {
      const res = HotspotComplianceVerifyService.calculatePreDockingScore({
        continuousRunActive: true,
        compressorRunning: true,
        doorsClosed: true,
        compartments: [
          { compartment: 'C1', actualTempC: -19.8, setpointTempC: -20.0, deviationC: 0.2, inTolerance: true },
          { compartment: 'C2', actualTempC: 3.1, setpointTempC: 3.0, deviationC: 0.1, inTolerance: true },
        ],
      });

      expect(res.score).toBe(100.0);
      expect(res.status).toBe('verified_compliant');
    });

    it('triggers discrepancy_warning when continuousRunActive is false (Cycle-Sentry active)', () => {
      const res = HotspotComplianceVerifyService.calculatePreDockingScore({
        continuousRunActive: false,
        compressorRunning: true,
        doorsClosed: true,
        compartments: [
          { compartment: 'C1', actualTempC: -19.8, setpointTempC: -20.0, deviationC: 0.2, inTolerance: true },
        ],
      });

      expect(res.status).toBe('discrepancy_warning');
      expect(res.score).toBe(80.0); // 20 (compressor only) + 30 (doors) + 30 (temp)
    });

    it('triggers discrepancy_warning when compressor is idle/off', () => {
      const res = HotspotComplianceVerifyService.calculatePreDockingScore({
        continuousRunActive: false,
        compressorRunning: false,
        doorsClosed: true,
        compartments: [],
      });

      expect(res.status).toBe('discrepancy_warning');
      expect(res.score).toBe(60.0); // 0 (compressor) + 30 (doors) + 30 (temp)
    });

    it('pro-rates thermal compliance score when some compartments exceed tolerance', () => {
      const res = HotspotComplianceVerifyService.calculatePreDockingScore({
        continuousRunActive: true,
        compressorRunning: true,
        doorsClosed: true,
        compartments: [
          { compartment: 'C1', actualTempC: -19.8, setpointTempC: -20.0, deviationC: 0.2, inTolerance: true },
          { compartment: 'C2', actualTempC: 6.5, setpointTempC: 3.0, deviationC: 3.5, inTolerance: false }, // breached
        ],
      });

      // 40 + 30 + (1/2 * 30) = 85.0
      expect(res.score).toBe(85.0);
      expect(res.status).toBe('verified_compliant');
    });
  });

  describe('2. HMAC-SHA256 Cryptographic Non-Repudiation Seal', () => {
    it('generates a deterministic 64-character hex signature', () => {
      const sig1 = HotspotComplianceVerifyService.generateConfirmationSignature({
        tripId: 8840,
        truckId: 101,
        driverId: 'drv-105',
        dockId: 'DOCK-MAD-04',
        score: 100,
        timestamp: '2026-10-10T12:00:00Z',
      });

      const sig2 = HotspotComplianceVerifyService.generateConfirmationSignature({
        tripId: 8840,
        truckId: 101,
        driverId: 'drv-105',
        dockId: 'DOCK-MAD-04',
        score: 100,
        timestamp: '2026-10-10T12:00:00Z',
      });

      expect(sig1).toHaveLength(64);
      expect(sig1).toBe(sig2);
    });

    it('changes signature if score or timestamp is altered', () => {
      const sig1 = HotspotComplianceVerifyService.generateConfirmationSignature({
        tripId: 8840,
        truckId: 101,
        driverId: 'drv-105',
        dockId: 'DOCK-MAD-04',
        score: 100,
        timestamp: '2026-10-10T12:00:00Z',
      });

      const sigTampered = HotspotComplianceVerifyService.generateConfirmationSignature({
        tripId: 8840,
        truckId: 101,
        driverId: 'drv-105',
        dockId: 'DOCK-MAD-04',
        score: 75, // tampered score
        timestamp: '2026-10-10T12:00:00Z',
      });

      expect(sig1).not.toBe(sigTampered);
    });
  });

  describe('3. Telematics Cross-Verification & Discrepancy Detection', () => {
    it('confirms driver affirmation when live telematics is compliant', async () => {
      const record = await HotspotComplianceVerifyService.processDriverConfirmation({
        tripId: 8840,
        tripNumber: 'TRIP-2026-8840',
        truckId: 101,
        truckPlate: '67890-A-40',
        driverId: 'drv-105',
        driverName: 'Mohamed El Idrissi',
        dockId: 'DOCK-MAD-04',
        dockName: 'Mercamadrid Hall 4 Frigo',
        facilityOrPort: 'Mercamadrid Plataforma Logística Frigorífica',
        dviScore: 85.0,
        riskLevel: 'critical',
        distanceKm: 4.8,
        continuousRunChecked: true,
        doorsSealedChecked: true,
        curtainsDeployedChecked: true,
      });

      expect(record.confirmationStatus).toBe('confirmed');
      expect(record.discrepancyDetected).toBe(false);
      expect(record.signatureHash).toBeDefined();
    });

    it('flags discrepancy_warning when driver affirms Continuous Run but telematics says Cycle-Sentry', async () => {
      const record = await HotspotComplianceVerifyService.processDriverConfirmation(
        {
          tripId: 8840,
          tripNumber: 'TRIP-2026-8840',
          truckId: 101,
          truckPlate: '67890-A-40',
          driverId: 'drv-105',
          driverName: 'Mohamed El Idrissi',
          dockId: 'DOCK-MAD-04',
          dockName: 'Mercamadrid Hall 4 Frigo',
          facilityOrPort: 'Mercamadrid Plataforma Logística Frigorífica',
          dviScore: 85.0,
          riskLevel: 'critical',
          distanceKm: 4.8,
          continuousRunChecked: true,
          doorsSealedChecked: true,
          curtainsDeployedChecked: true,
        },
        {
          continuousRunActive: false, // Cycle-Sentry active in reality!
          compressorRunning: false,
        }
      );

      expect(record.confirmationStatus).toBe('discrepancy_warning');
      expect(record.discrepancyDetected).toBe(true);
      expect(record.discrepancyNote).toContain('Discrepancy');
    });
  });

  describe('4. Zod Schema Validation & Input Guardrails', () => {
    it('validates correct driver affirmation payload', () => {
      const valid = submitDriverConfirmationSchema.safeParse({
        tripId: 8840,
        tripNumber: 'TRIP-2026-8840',
        truckId: 101,
        truckPlate: '67890-A-40',
        driverId: 105,
        driverName: 'Mohamed El Idrissi',
        dockId: 'DOCK-MAD-04',
        dockName: 'Mercamadrid Hall 4 Frigo',
        facilityOrPort: 'Mercamadrid Plataforma Logística Frigorífica',
        dviScore: 85.0,
        riskLevel: 'critical',
        distanceKm: 5.2,
        continuousRunChecked: true,
        doorsSealedChecked: true,
        curtainsDeployedChecked: true,
      });

      expect(valid.success).toBe(true);
    });

    it('rejects confirmation if continuous run is not affirmed', () => {
      const invalid = submitDriverConfirmationSchema.safeParse({
        tripId: 8840,
        tripNumber: 'TRIP-2026-8840',
        truckId: 101,
        truckPlate: '67890-A-40',
        driverId: 105,
        driverName: 'Mohamed El Idrissi',
        dockId: 'DOCK-MAD-04',
        dockName: 'Mercamadrid Hall 4 Frigo',
        facilityOrPort: 'Mercamadrid Plataforma Logística Frigorífica',
        dviScore: 85.0,
        continuousRunChecked: false, // Must be true!
        doorsSealedChecked: true,
      });

      expect(invalid.success).toBe(false);
    });
  });

  describe('5. Server Actions Execution', () => {
    it('submits driver confirmation via server action successfully', async () => {
      const res = await submitDriverHotspotConfirmationAction({
        tripId: 8840,
        tripNumber: 'TRIP-2026-8840',
        truckId: 101,
        truckPlate: '67890-A-40',
        driverId: 105,
        driverName: 'Mohamed El Idrissi',
        dockId: 'DOCK-MAD-04',
        dockName: 'Mercamadrid Hall 4 Frigo',
        facilityOrPort: 'Mercamadrid Plataforma Logística Frigorífica',
        dviScore: 85.0,
        riskLevel: 'critical',
        distanceKm: 5.2,
        continuousRunChecked: true,
        doorsSealedChecked: true,
        curtainsDeployedChecked: true,
      });

      expect(res.success).toBe(true);
      expect(res.record?.confirmationId).toBeDefined();
    });

    it('verifies live telematics compliance via server action', async () => {
      const res = await verifyReeferTelematicsComplianceAction({
        truckId: 101,
        tripId: 8840,
      });

      expect(res.success).toBe(true);
      expect(res.verification?.preDockingScore).toBeGreaterThanOrEqual(0);
      expect(res.verification?.compartments.length).toBeGreaterThan(0);
    });
  });
});

