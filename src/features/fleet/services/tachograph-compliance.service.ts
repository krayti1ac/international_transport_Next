/**
 * Trans Bodanon TMS — EU Regulation (EC) 561/2006 Compliance Engine
 * Evaluates driver driving times, split/full breaks, daily & weekly ceilings,
 * calculates radar statuses, and estimates European infringement penalties via Decimal.js.
 */

import Decimal from 'decimal.js';
import {
  TACHOGRAPH_REGULATION,
  TachographActivityInput,
  DriverComplianceStatusResult,
  InfringementReport,
  TachographRadarStatus,
  TachographInfringementSeverity,
  FleetComplianceRadarSummary,
} from '../types/tachograph.types';

Decimal.config({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

export interface ActivitySegment {
  activity_type: 'drive' | 'rest' | 'work' | 'available';
  start_time: string;
  end_time?: string | null;
  duration_minutes: number;
}

export class TachographComplianceEngine {
  /**
   * Evaluates continuous driving and mandatory break compliance.
   * Handles 45-minute continuous break OR split break (15 min + 30 min in strict order).
   */
  public static evaluateContinuousDriving(activities: ActivitySegment[]): {
    continuousDriveMinutes: number;
    remainingContinuousMinutes: number;
    accumulatedBreakMinutes: number;
    isSplitBreakPending: boolean;
    hasInfringement: boolean;
    excessMinutes: number;
  } {
    // Sort chronologically ascending
    const sorted = [...activities].sort(
      (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
    );

    let continuousDrive = 0;
    let accumulatedBreak = 0;
    let hasPart1Split = false; // 15m completed

    for (const segment of sorted) {
      const duration = Math.max(0, segment.duration_minutes);

      if (segment.activity_type === 'rest') {
        accumulatedBreak += duration;

        if (duration >= TACHOGRAPH_REGULATION.MANDATORY_BREAK_MINUTES) {
          // Full 45+ minute break resets continuous driving
          continuousDrive = 0;
          accumulatedBreak = 0;
          hasPart1Split = false;
        } else if (!hasPart1Split && duration >= TACHOGRAPH_REGULATION.SPLIT_BREAK_PART1_MINUTES) {
          // Part 1 of split break (>= 15 minutes)
          hasPart1Split = true;
        } else if (hasPart1Split && duration >= TACHOGRAPH_REGULATION.SPLIT_BREAK_PART2_MINUTES) {
          // Part 2 of split break (>= 30 minutes) completes the split cycle
          continuousDrive = 0;
          accumulatedBreak = 0;
          hasPart1Split = false;
        }
      } else if (segment.activity_type === 'drive') {
        continuousDrive += duration;
      }
      // 'work' and 'available' interrupt rest continuity without adding to driving time
      else {
        if (!hasPart1Split) {
          accumulatedBreak = 0;
        }
      }
    }

    const maxContinuous = TACHOGRAPH_REGULATION.MAX_CONTINUOUS_DRIVE_MINUTES; // 270 min
    const remainingContinuous = Math.max(0, maxContinuous - continuousDrive);
    const hasInfringement = continuousDrive > maxContinuous;
    const excessMinutes = hasInfringement ? continuousDrive - maxContinuous : 0;

    return {
      continuousDriveMinutes: continuousDrive,
      remainingContinuousMinutes: remainingContinuous,
      accumulatedBreakMinutes: accumulatedBreak,
      isSplitBreakPending: hasPart1Split,
      hasInfringement,
      excessMinutes,
    };
  }

  /**
   * Evaluates daily driving limits (9h standard, extendable to 10h twice a week).
   */
  public static evaluateDailyDriving(
    dailyDriveMinutes: number,
    weeklyExtensionsUsed: number
  ): {
    ceilingMinutes: number;
    remainingDailyMinutes: number;
    extensionsRemaining: number;
    newExtensionsUsed: number;
    hasInfringement: boolean;
    excessMinutes: number;
  } {
    const standardLimit = TACHOGRAPH_REGULATION.STANDARD_DAILY_DRIVE_MINUTES; // 540 min
    const extendedLimit = TACHOGRAPH_REGULATION.EXTENDED_DAILY_DRIVE_MINUTES; // 600 min
    const maxExtensions = TACHOGRAPH_REGULATION.MAX_EXTENSIONS_PER_WEEK;       // 2

    let ceiling: number = standardLimit;
    let extensionsUsed = weeklyExtensionsUsed;
    let extensionsRemaining = Math.max(0, maxExtensions - extensionsUsed);

    if (dailyDriveMinutes > standardLimit) {
      if (extensionsUsed < maxExtensions) {
        // Driver can use one of their two weekly 10h extensions
        ceiling = extendedLimit;
        extensionsUsed += 1;
        extensionsRemaining = Math.max(0, maxExtensions - extensionsUsed);
      } else {
        // No extensions left, ceiling remains 540 min
        ceiling = standardLimit;
      }
    }

    const remaining = Math.max(0, ceiling - dailyDriveMinutes);
    const hasInfringement = dailyDriveMinutes > ceiling;
    const excessMinutes = hasInfringement ? dailyDriveMinutes - ceiling : 0;

    return {
      ceilingMinutes: ceiling,
      remainingDailyMinutes: remaining,
      extensionsRemaining,
      newExtensionsUsed: extensionsUsed,
      hasInfringement,
      excessMinutes,
    };
  }

  /**
   * Calculates European fine penalty for an infringement using strict Decimal.js.
   */
  public static calculatePenalty(
    infringementType: InfringementReport['type'],
    excessMinutes: number
  ): { severity: TachographInfringementSeverity; fineEur: InstanceType<typeof Decimal> } {
    if (excessMinutes <= 0) {
      return { severity: 'none', fineEur: new Decimal(0) };
    }

    const excess = new Decimal(excessMinutes);

    if (infringementType === 'continuous_drive') {
      if (excess.lessThanOrEqualTo(30)) {
        // Minor infringement: 100 EUR base + 1 EUR/min
        return {
          severity: 'minor_MI',
          fineEur: new Decimal('100.00').plus(excess.times('1.00')),
        };
      } else if (excess.lessThanOrEqualTo(90)) {
        // Serious infringement: 300 EUR base + 2 EUR/min
        return {
          severity: 'serious_SI',
          fineEur: new Decimal('300.00').plus(excess.times('2.00')),
        };
      } else {
        // Very serious: 800 EUR base + 3 EUR/min
        return {
          severity: 'very_serious_VSI',
          fineEur: new Decimal('800.00').plus(excess.times('3.00')),
        };
      }
    }

    if (infringementType === 'daily_drive') {
      if (excess.lessThanOrEqualTo(60)) {
        return {
          severity: 'minor_MI',
          fineEur: new Decimal('150.00').plus(excess.times('1.50')),
        };
      } else if (excess.lessThanOrEqualTo(120)) {
        return {
          severity: 'serious_SI',
          fineEur: new Decimal('400.00').plus(excess.times('2.50')),
        };
      } else if (excess.lessThanOrEqualTo(270)) {
        return {
          severity: 'very_serious_VSI',
          fineEur: new Decimal('900.00').plus(excess.times('3.50')),
        };
      } else {
        return {
          severity: 'most_serious_MSI',
          fineEur: new Decimal('2000.00').plus(excess.times('5.00')),
        };
      }
    }

    // Weekly / Fortnightly
    if (excess.lessThanOrEqualTo(180)) {
      return {
        severity: 'serious_SI',
        fineEur: new Decimal('350.00').plus(excess.times('2.00')),
      };
    } else {
      return {
        severity: 'very_serious_VSI',
        fineEur: new Decimal('1000.00').plus(excess.times('4.00')),
      };
    }
  }

  /**
   * Generates a comprehensive compliance status report for a single driver.
   */
  public static evaluateDriverCompliance(params: {
    driver_id: number;
    driver_name?: string;
    truck_plate?: string | null;
    current_activity: 'drive' | 'rest' | 'work' | 'available';
    activities: ActivitySegment[];
    daily_drive_minutes: number;
    weekly_drive_minutes: number;
    fortnightly_drive_minutes: number;
    weekly_10h_extensions_used?: number;
    reduced_daily_rests_used?: number;
  }): DriverComplianceStatusResult {
    const weeklyExtensionsUsed = params.weekly_10h_extensions_used ?? 0;
    const reducedRestsUsed = params.reduced_daily_rests_used ?? 0;

    // 1. Continuous Driving Evaluation
    const continuousResult = this.evaluateContinuousDriving(params.activities);

    // 2. Daily Driving Evaluation
    const dailyResult = this.evaluateDailyDriving(params.daily_drive_minutes, weeklyExtensionsUsed);

    // 3. Weekly & Fortnightly Driving
    const maxWeekly = TACHOGRAPH_REGULATION.MAX_WEEKLY_DRIVE_MINUTES;       // 3360 min
    const maxFortnightly = TACHOGRAPH_REGULATION.MAX_FORTNIGHTLY_DRIVE_MINUTES; // 5400 min
    const remainingWeekly = Math.max(0, maxWeekly - params.weekly_drive_minutes);
    const remainingFortnightly = Math.max(0, maxFortnightly - params.fortnightly_drive_minutes);

    const activeInfringements: InfringementReport[] = [];
    let totalPenaltyDecimal = new Decimal('0.00');
    let highestSeverity: TachographInfringementSeverity = 'none';

    // Check continuous driving infringement
    if (continuousResult.hasInfringement) {
      const penalty = this.calculatePenalty('continuous_drive', continuousResult.excessMinutes);
      totalPenaltyDecimal = totalPenaltyDecimal.plus(penalty.fineEur);
      highestSeverity = this.upgradeSeverity(highestSeverity, penalty.severity);

      activeInfringements.push({
        type: 'continuous_drive',
        severity: penalty.severity,
        description: `تجاوز الحد الأقصى للقيادة المتواصلة (4.5 س) بمقدار ${continuousResult.excessMinutes} دقيقة دون أخذ استراحة 45 دقيقة`,
        excess_minutes: continuousResult.excessMinutes,
        estimated_fine_eur: penalty.fineEur.toFixed(2),
      });
    }

    // Check daily driving infringement
    if (dailyResult.hasInfringement) {
      const penalty = this.calculatePenalty('daily_drive', dailyResult.excessMinutes);
      totalPenaltyDecimal = totalPenaltyDecimal.plus(penalty.fineEur);
      highestSeverity = this.upgradeSeverity(highestSeverity, penalty.severity);

      activeInfringements.push({
        type: 'daily_drive',
        severity: penalty.severity,
        description: `تجاوز السقف اليومي للقيادة (${dailyResult.ceilingMinutes / 60} س) بمقدار ${dailyResult.excessMinutes} دقيقة`,
        excess_minutes: dailyResult.excessMinutes,
        estimated_fine_eur: penalty.fineEur.toFixed(2),
      });
    }

    // Check weekly driving infringement
    if (params.weekly_drive_minutes > maxWeekly) {
      const excess = params.weekly_drive_minutes - maxWeekly;
      const penalty = this.calculatePenalty('weekly_drive', excess);
      totalPenaltyDecimal = totalPenaltyDecimal.plus(penalty.fineEur);
      highestSeverity = this.upgradeSeverity(highestSeverity, penalty.severity);

      activeInfringements.push({
        type: 'weekly_drive',
        severity: penalty.severity,
        description: `تجاوز سقف القيادة الأسبوعي (56 س) بمقدار ${excess} دقيقة`,
        excess_minutes: excess,
        estimated_fine_eur: penalty.fineEur.toFixed(2),
      });
    }

    // Check fortnightly driving infringement
    if (params.fortnightly_drive_minutes > maxFortnightly) {
      const excess = params.fortnightly_drive_minutes - maxFortnightly;
      const penalty = this.calculatePenalty('fortnightly_drive', excess);
      totalPenaltyDecimal = totalPenaltyDecimal.plus(penalty.fineEur);
      highestSeverity = this.upgradeSeverity(highestSeverity, penalty.severity);

      activeInfringements.push({
        type: 'fortnightly_drive',
        severity: penalty.severity,
        description: `تجاوز سقف الأسبوعين المتتاليين (90 س) بمقدار ${excess} دقيقة`,
        excess_minutes: excess,
        estimated_fine_eur: penalty.fineEur.toFixed(2),
      });
    }

    // Determine Radar Status and Urgency Level
    let radarStatus: TachographRadarStatus = 'compliant';
    let urgencyLevel: DriverComplianceStatusResult['urgency_level'] = 'green';
    let recommendedAction = 'القيادة ضمن الحدود المسموحة نظامياً (EC 561/2006)';

    if (activeInfringements.length > 0) {
      radarStatus = 'violation';
      urgencyLevel = 'critical_breach';
      recommendedAction = 'إيقاف الشاحنة فوراً في أقرب موقف وأخذ قسط الراحة الإلزامي لتفادي حجز المركبة والغرامات الأوروبية';
    } else if (
      continuousResult.remainingContinuousMinutes <= TACHOGRAPH_REGULATION.CRITICAL_THRESHOLD_MINUTES ||
      dailyResult.remainingDailyMinutes <= TACHOGRAPH_REGULATION.CRITICAL_THRESHOLD_MINUTES
    ) {
      radarStatus = 'critical_urgency';
      urgencyLevel = 'red';
      recommendedAction = 'تنبيه عاجل: تبقي أقل من 15 دقيقة! يجب الدخول إلى باحة استراحة فوراً';
    } else if (
      continuousResult.remainingContinuousMinutes <= TACHOGRAPH_REGULATION.WARNING_THRESHOLD_MINUTES ||
      dailyResult.remainingDailyMinutes <= 60
    ) {
      radarStatus = 'warning';
      urgencyLevel = 'yellow';
      recommendedAction = 'تنبيه مبكر: التخطيط للراحة أو تبديل السائق خلال 45 دقيقة القادمة';
    }

    return {
      driver_id: params.driver_id,
      driver_name: params.driver_name,
      truck_plate: params.truck_plate,
      current_activity: params.current_activity,
      snapshot_timestamp: new Date().toISOString(),

      continuous_drive_minutes: continuousResult.continuousDriveMinutes,
      remaining_continuous_drive_minutes: continuousResult.remainingContinuousMinutes,
      accumulated_break_minutes: continuousResult.accumulatedBreakMinutes,
      is_split_break_pending: continuousResult.isSplitBreakPending,

      daily_drive_minutes: params.daily_drive_minutes,
      remaining_daily_drive_minutes: dailyResult.remainingDailyMinutes,
      daily_drive_ceiling_minutes: dailyResult.ceilingMinutes,
      daily_10h_extensions_used_this_week: dailyResult.newExtensionsUsed,
      extensions_remaining_this_week: dailyResult.extensionsRemaining,
      reduced_daily_rests_used_this_week: reducedRestsUsed,

      weekly_drive_minutes: params.weekly_drive_minutes,
      remaining_weekly_drive_minutes: remainingWeekly,
      fortnightly_drive_minutes: params.fortnightly_drive_minutes,
      remaining_fortnightly_drive_minutes: remainingFortnightly,

      radar_status: radarStatus,
      infringement_severity: highestSeverity,
      active_infringements: activeInfringements,
      total_estimated_penalties_eur: totalPenaltyDecimal.toFixed(2),
      recommended_action: recommendedAction,
      urgency_level: urgencyLevel,
    };
  }

  /**
   * Aggregates fleet-wide compliance metrics into a high-level radar dashboard.
   */
  public static summarizeFleetCompliance(
    drivers: DriverComplianceStatusResult[]
  ): FleetComplianceRadarSummary {
    let compliantCount = 0;
    let warningCount = 0;
    let criticalUrgencyCount = 0;
    let violationCount = 0;
    let totalRiskEur = new Decimal('0.00');

    for (const driver of drivers) {
      totalRiskEur = totalRiskEur.plus(new Decimal(driver.total_estimated_penalties_eur || '0'));

      switch (driver.radar_status) {
        case 'compliant':
          compliantCount++;
          break;
        case 'warning':
          warningCount++;
          break;
        case 'critical_urgency':
          criticalUrgencyCount++;
          break;
        case 'violation':
          violationCount++;
          break;
      }
    }

    return {
      total_monitored_drivers: drivers.length,
      compliant_count: compliantCount,
      warning_count: warningCount,
      critical_urgency_count: criticalUrgencyCount,
      violation_count: violationCount,
      total_risk_exposure_eur: totalRiskEur.toFixed(2),
      drivers,
    };
  }

  /**
   * Internal helper to upgrade infringement severity level.
   */
  private static upgradeSeverity(
    current: TachographInfringementSeverity,
    incoming: TachographInfringementSeverity
  ): TachographInfringementSeverity {
    const weights: Record<TachographInfringementSeverity, number> = {
      none: 0,
      minor_MI: 1,
      serious_SI: 2,
      very_serious_VSI: 3,
      most_serious_MSI: 4,
    };

    return weights[incoming] > weights[current] ? incoming : current;
  }
}

