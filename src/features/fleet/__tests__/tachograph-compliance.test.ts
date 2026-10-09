import { describe, it, expect, vi, beforeEach } from 'vitest';
import Decimal from 'decimal.js';
import {
  TachographComplianceEngine,
  ActivitySegment,
} from '../services/tachograph-compliance.service';
import {
  TACHOGRAPH_REGULATION,
  DriverComplianceStatusResult,
} from '../types/tachograph.types';
import {
  logDriverActivityAction,
  getDriverComplianceRadarAction,
  getFleetComplianceRadarAction,
} from '../services/tachograph.actions';

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

const mockDriver = {
  id: 101,
  name: 'Mohammed El Mansouri',
  default_truck_id: 10,
  default_truck_name: '45821-B-40',
  status: 'active',
};

const mockLog = {
  id: 1,
  driver_id: 101,
  activity_type: 'drive',
  duration_minutes: 180,
  start_time: '2026-10-09T08:00:00.000Z',
  end_time: '2026-10-09T11:00:00.000Z',
};

const mockSnapshot = {
  id: 1,
  driver_id: 101,
  current_activity: 'drive',
  continuous_drive_minutes: 180,
  remaining_continuous_drive_minutes: 90,
  accumulated_break_minutes: 0,
  daily_drive_minutes: 180,
  remaining_daily_drive_minutes: 360,
  daily_10h_extensions_used_this_week: 0,
  reduced_daily_rests_used_this_week: 0,
  weekly_drive_minutes: 180,
  fortnightly_drive_minutes: 180,
  radar_status: 'compliant',
  infringement_severity: 'none',
  infringement_details: null,
  estimated_penalty_eur: '0.00',
  recommended_action: 'القيادة ضمن الحدود المسموحة نظامياً (EC 561/2006)',
};

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'usr-dispatcher-1' } } }),
    },
    from: (table: string) => {
      if (table === 'users') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: vi.fn().mockResolvedValue({ data: { company_id: 1 }, error: null }),
            }),
          }),
        };
      }
      if (table === 'trucks') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: vi.fn().mockResolvedValue({ data: { id: 10, plate_number: '45821-B-40' }, error: null }),
            }),
            in: () => Promise.resolve({ data: [{ id: 10, plate_number: '45821-B-40' }], error: null }),
          }),
        };
      }
      if (table === 'drivers') {
        const driversQueryObj: any = {
          maybeSingle: vi.fn().mockResolvedValue({ data: mockDriver, error: null }),
          ilike: vi.fn().mockImplementation(() => driversQueryObj),
          then: (resolve: any) => Promise.resolve({ data: [mockDriver], error: null }).then(resolve),
        };
        return {
          select: () => ({
            eq: () => driversQueryObj,
            ilike: () => driversQueryObj,
            in: () => Promise.resolve({ data: [mockDriver], error: null }),
          }),
        };
      }


      if (table === 'driver_tachograph_logs') {
        return {
          insert: () => ({
            select: () => ({
              single: vi.fn().mockResolvedValue({ data: mockLog, error: null }),
            }),
          }),
          select: () => ({
            eq: () => ({
              gte: () => ({
                order: vi.fn().mockResolvedValue({ data: [mockLog], error: null }),
              }),
            }),
          }),
        };
      }
      if (table === 'driver_compliance_snapshots') {
        return {
          upsert: vi.fn().mockResolvedValue({ data: null, error: null }),
          select: () => ({
            eq: () => ({
              maybeSingle: vi.fn().mockResolvedValue({ data: mockSnapshot, error: null }),
            }),
            in: vi.fn().mockResolvedValue({ data: [mockSnapshot], error: null }),
          }),
        };
      }
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      };
    },
  })),
}));

vi.mock('@/lib/audit.server', () => ({
  recordAuditLog: vi.fn().mockResolvedValue(true),
}));

describe('EU Regulation (EC) 561/2006 Tachograph Compliance Engine', () => {
  describe('Continuous Driving & Mandatory Breaks Analysis', () => {
    it('evaluates compliant continuous driving under 4.5 hours (270 min)', () => {
      const activities: ActivitySegment[] = [
        {
          activity_type: 'drive',
          start_time: '2026-10-09T08:00:00.000Z',
          duration_minutes: 180, // 3 hours
        },
      ];

      const result = TachographComplianceEngine.evaluateContinuousDriving(activities);

      expect(result.continuousDriveMinutes).toBe(180);
      expect(result.remainingContinuousMinutes).toBe(90); // 270 - 180 = 90
      expect(result.hasInfringement).toBe(false);
      expect(result.excessMinutes).toBe(0);
      expect(result.isSplitBreakPending).toBe(false);
    });

    it('resets continuous driving timer after a full 45-minute continuous break', () => {
      const activities: ActivitySegment[] = [
        {
          activity_type: 'drive',
          start_time: '2026-10-09T08:00:00.000Z',
          duration_minutes: 240, // 4 hours
        },
        {
          activity_type: 'rest',
          start_time: '2026-10-09T12:00:00.000Z',
          duration_minutes: 45, // 45 min mandatory break
        },
        {
          activity_type: 'drive',
          start_time: '2026-10-09T12:45:00.000Z',
          duration_minutes: 60, // 1 hour after break
        },
      ];

      const result = TachographComplianceEngine.evaluateContinuousDriving(activities);

      expect(result.continuousDriveMinutes).toBe(60);
      expect(result.remainingContinuousMinutes).toBe(210); // 270 - 60 = 210
      expect(result.hasInfringement).toBe(false);
    });

    it('correctly handles qualifying split break (15 min followed by 30 min)', () => {
      const activities: ActivitySegment[] = [
        {
          activity_type: 'drive',
          start_time: '2026-10-09T08:00:00.000Z',
          duration_minutes: 120, // 2h drive
        },
        {
          activity_type: 'rest',
          start_time: '2026-10-09T10:00:00.000Z',
          duration_minutes: 15, // Part 1: at least 15 min
        },
        {
          activity_type: 'drive',
          start_time: '2026-10-09T10:15:00.000Z',
          duration_minutes: 100, // Drive continues
        },
        {
          activity_type: 'rest',
          start_time: '2026-10-09T11:55:00.000Z',
          duration_minutes: 30, // Part 2: at least 30 min
        },
        {
          activity_type: 'drive',
          start_time: '2026-10-09T12:25:00.000Z',
          duration_minutes: 30, // New drive cycle
        },
      ];

      const result = TachographComplianceEngine.evaluateContinuousDriving(activities);

      expect(result.continuousDriveMinutes).toBe(30);
      expect(result.remainingContinuousMinutes).toBe(240);
      expect(result.hasInfringement).toBe(false);
      expect(result.isSplitBreakPending).toBe(false);
    });

    it('flags infringement when continuous drive exceeds 270 minutes without qualifying break', () => {
      const activities: ActivitySegment[] = [
        {
          activity_type: 'drive',
          start_time: '2026-10-09T08:00:00.000Z',
          duration_minutes: 300, // 5 hours continuous (30 min excess)
        },
      ];

      const result = TachographComplianceEngine.evaluateContinuousDriving(activities);

      expect(result.continuousDriveMinutes).toBe(300);
      expect(result.remainingContinuousMinutes).toBe(0);
      expect(result.hasInfringement).toBe(true);
      expect(result.excessMinutes).toBe(30);
    });
  });

  describe('Daily Driving Limits & 10h Extensions', () => {
    it('allows standard 9-hour (540 min) daily driving without using extension', () => {
      const result = TachographComplianceEngine.evaluateDailyDriving(480, 0); // 8 hours

      expect(result.ceilingMinutes).toBe(540);
      expect(result.remainingDailyMinutes).toBe(60);
      expect(result.hasInfringement).toBe(false);
      expect(result.newExtensionsUsed).toBe(0);
      expect(result.extensionsRemaining).toBe(2);
    });

    it('utilizes one 10h extension when daily driving exceeds 9 hours (up to 2 per week)', () => {
      const result = TachographComplianceEngine.evaluateDailyDriving(570, 0); // 9.5 hours, 0 extensions used

      expect(result.ceilingMinutes).toBe(600); // Ceiling expanded to 10h
      expect(result.remainingDailyMinutes).toBe(30); // 600 - 570 = 30
      expect(result.hasInfringement).toBe(false);
      expect(result.newExtensionsUsed).toBe(1);
      expect(result.extensionsRemaining).toBe(1);
    });

    it('flags daily infringement if exceeding 9h when all 2 weekly extensions are exhausted', () => {
      const result = TachographComplianceEngine.evaluateDailyDriving(570, 2); // 2 extensions already used

      expect(result.ceilingMinutes).toBe(540); // Cannot extend beyond 540
      expect(result.hasInfringement).toBe(true);
      expect(result.excessMinutes).toBe(30);
    });

    it('flags daily infringement if driving exceeds 10 hours (600 min) regardless of extensions', () => {
      const result = TachographComplianceEngine.evaluateDailyDriving(630, 0); // 10.5 hours

      expect(result.ceilingMinutes).toBe(600);
      expect(result.hasInfringement).toBe(true);
      expect(result.excessMinutes).toBe(30);
    });
  });

  describe('Financial Penalty Calculation (Strict Decimal.js)', () => {
    it('calculates minor infringement penalty (€100 base + €1/min excess)', () => {
      const penalty = TachographComplianceEngine.calculatePenalty('continuous_drive', 20);

      expect(penalty.severity).toBe('minor_MI');
      expect(penalty.fineEur.toFixed(2)).toBe('120.00'); // 100 + 20*1 = 120.00
      expect(penalty.fineEur instanceof Decimal).toBe(true);
    });

    it('calculates serious infringement penalty (€300 base + €2/min excess)', () => {
      const penalty = TachographComplianceEngine.calculatePenalty('continuous_drive', 45);

      expect(penalty.severity).toBe('serious_SI');
      expect(penalty.fineEur.toFixed(2)).toBe('390.00'); // 300 + 45*2 = 390.00
    });

    it('calculates very serious infringement penalty (€800 base + €3/min excess)', () => {
      const penalty = TachographComplianceEngine.calculatePenalty('continuous_drive', 100);

      expect(penalty.severity).toBe('very_serious_VSI');
      expect(penalty.fineEur.toFixed(2)).toBe('1100.00'); // 800 + 100*3 = 1100.00
    });

    it('returns zero fine for zero excess minutes', () => {
      const penalty = TachographComplianceEngine.calculatePenalty('continuous_drive', 0);

      expect(penalty.severity).toBe('none');
      expect(penalty.fineEur.toFixed(2)).toBe('0.00');
    });
  });

  describe('Comprehensive Driver & Fleet Compliance Evaluator', () => {
    it('evaluates compliant driver with green radar status (>45m remaining)', () => {
      const evaluation = TachographComplianceEngine.evaluateDriverCompliance({
        driver_id: 101,
        driver_name: 'Mohammed El Mansouri',
        current_activity: 'drive',
        activities: [
          {
            activity_type: 'drive',
            start_time: '2026-10-09T08:00:00.000Z',
            duration_minutes: 180,
          },
        ],
        daily_drive_minutes: 180,
        weekly_drive_minutes: 1200,
        fortnightly_drive_minutes: 2400,
      });

      expect(evaluation.radar_status).toBe('compliant');
      expect(evaluation.urgency_level).toBe('green');
      expect(evaluation.remaining_continuous_drive_minutes).toBe(90);
      expect(evaluation.total_estimated_penalties_eur).toBe('0.00');
    });

    it('sets warning radar status (yellow) when continuous drive remaining is <= 45 min', () => {
      const evaluation = TachographComplianceEngine.evaluateDriverCompliance({
        driver_id: 101,
        driver_name: 'Mohammed El Mansouri',
        current_activity: 'drive',
        activities: [
          {
            activity_type: 'drive',
            start_time: '2026-10-09T08:00:00.000Z',
            duration_minutes: 240, // 30m remaining
          },
        ],
        daily_drive_minutes: 240,
        weekly_drive_minutes: 1200,
        fortnightly_drive_minutes: 2400,
      });

      expect(evaluation.radar_status).toBe('warning');
      expect(evaluation.urgency_level).toBe('yellow');
      expect(evaluation.remaining_continuous_drive_minutes).toBe(30);
    });

    it('sets critical urgency radar status (red) when continuous drive remaining is <= 15 min', () => {
      const evaluation = TachographComplianceEngine.evaluateDriverCompliance({
        driver_id: 101,
        driver_name: 'Mohammed El Mansouri',
        current_activity: 'drive',
        activities: [
          {
            activity_type: 'drive',
            start_time: '2026-10-09T08:00:00.000Z',
            duration_minutes: 260, // only 10 min left
          },
        ],
        daily_drive_minutes: 260,
        weekly_drive_minutes: 1200,
        fortnightly_drive_minutes: 2400,
      });

      expect(evaluation.radar_status).toBe('critical_urgency');
      expect(evaluation.urgency_level).toBe('red');
      expect(evaluation.remaining_continuous_drive_minutes).toBe(10);
    });

    it('sets violation radar status and aggregates penalties when limits are breached', () => {
      const evaluation = TachographComplianceEngine.evaluateDriverCompliance({
        driver_id: 101,
        driver_name: 'Mohammed El Mansouri',
        current_activity: 'drive',
        activities: [
          {
            activity_type: 'drive',
            start_time: '2026-10-09T08:00:00.000Z',
            duration_minutes: 290, // 20m excess
          },
        ],
        daily_drive_minutes: 580, // Daily excess if extensions exhausted
        weekly_drive_minutes: 1200,
        fortnightly_drive_minutes: 2400,
        weekly_10h_extensions_used: 2,
      });

      expect(evaluation.radar_status).toBe('violation');
      expect(evaluation.urgency_level).toBe('critical_breach');
      expect(evaluation.active_infringements.length).toBeGreaterThan(0);
      expect(new Decimal(evaluation.total_estimated_penalties_eur).greaterThan(0)).toBe(true);
    });

    it('summarizes fleet-wide compliance with total EUR risk exposure via Decimal.js', () => {
      const driver1: DriverComplianceStatusResult = {
        driver_id: 1,
        driver_name: 'Driver 1',
        truck_plate: '1111-A-1',
        current_activity: 'drive',
        snapshot_timestamp: new Date().toISOString(),
        continuous_drive_minutes: 120,
        remaining_continuous_drive_minutes: 150,
        accumulated_break_minutes: 0,
        is_split_break_pending: false,
        daily_drive_minutes: 120,
        remaining_daily_drive_minutes: 420,
        daily_drive_ceiling_minutes: 540,
        daily_10h_extensions_used_this_week: 0,
        extensions_remaining_this_week: 2,
        reduced_daily_rests_used_this_week: 0,
        weekly_drive_minutes: 500,
        remaining_weekly_drive_minutes: 2860,
        fortnightly_drive_minutes: 1000,
        remaining_fortnightly_drive_minutes: 4400,
        radar_status: 'compliant',
        infringement_severity: 'none',
        active_infringements: [],
        total_estimated_penalties_eur: '0.00',
        recommended_action: 'OK',
        urgency_level: 'green',
      };

      const driver2: DriverComplianceStatusResult = {
        ...driver1,
        driver_id: 2,
        driver_name: 'Driver 2',
        radar_status: 'violation',
        infringement_severity: 'minor_MI',
        total_estimated_penalties_eur: '120.00',
      };

      const summary = TachographComplianceEngine.summarizeFleetCompliance([driver1, driver2]);

      expect(summary.total_monitored_drivers).toBe(2);
      expect(summary.compliant_count).toBe(1);
      expect(summary.violation_count).toBe(1);
      expect(summary.total_risk_exposure_eur).toBe('120.00');
    });
  });

  describe('Server Actions Integration', () => {
    it('logDriverActivityAction logs segment and returns updated evaluation', async () => {
      const res = await logDriverActivityAction({
        driver_id: 101,
        activity_type: 'drive',
        start_time: '2026-10-09T08:00:00.000Z',
        end_time: '2026-10-09T11:00:00.000Z',
        duration_minutes: 180,
      });

      expect(res.success).toBe(true);
      expect(res.log).toBeDefined();
      expect(res.evaluation).toBeDefined();
    });

    it('getDriverComplianceRadarAction fetches radar snapshot', async () => {
      const res = await getDriverComplianceRadarAction(101);

      expect(res.success).toBe(true);
      expect(res.result).toBeDefined();
      expect(res.result?.driver_name).toBe('Mohammed El Mansouri');
    });

    it('getFleetComplianceRadarAction returns fleet summary', async () => {
      const res = await getFleetComplianceRadarAction({ radar_status: 'all' });

      expect(res.success).toBe(true);
      expect(res.summary).toBeDefined();
      expect(res.summary?.total_monitored_drivers).toBeGreaterThanOrEqual(1);
    });
  });
});

