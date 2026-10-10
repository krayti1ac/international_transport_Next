'use server';

/**
 * Trans Bodanon TMS — Dock Thermal Heatmap & Excursion Risk Server Actions
 * Evaluates geofence dock vulnerabilities, flags high-risk hubs, and tracks GDP excursion hotspots.
 * Regulatory Standards: EU GDP (2013/C 343/01) / EN 12830 / ATP Treaty (FRC)
 */

import { createClient } from '@/lib/supabase/server';
import { recordAuditLog } from '@/lib/audit.server';
import { fetchDockArrivalsAuditAction } from './dock-dispatch-audit.actions';
import { DockThermalRiskService } from './dock-thermal-risk.service';
import {
  dockRiskQuerySchema,
  flagDockSchema,
  type DockHeatmapSummaryKpi,
  type DockRiskCluster,
  type DockRiskQueryFilter,
  type DockWatchStatus,
  type FlagDockInput,
} from '../types/dock-heatmap.types';

// In-memory tenant watch cache for runtime reactivity
const MEMORY_DOCK_WATCHES = new Map<string, { status: DockWatchStatus; reason?: string }>();

/**
 * Fetches and clusters all unloading dock events with DVI vulnerability ratings and GeoJSON coordinates
 */
export async function fetchDockRiskClustersAction(
  filterInput?: DockRiskQueryFilter
): Promise<{
  success: boolean;
  clusters: DockRiskCluster[];
  summary: DockHeatmapSummaryKpi;
  error?: string;
}> {
  try {
    const validatedFilter = dockRiskQuerySchema.parse(filterInput || {});
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Pull dock arrivals history
    const auditRes = await fetchDockArrivalsAuditAction({});
    const arrivals = auditRes.success && auditRes.items ? auditRes.items : [];

    // Map arrivals into format needed by clustering engine
    const rawEvents = arrivals.map((item: any) => {
      // Derive dock ID from zone name or ID
      const dockId = (item.zoneName || 'DOCK-HUB')
        .replace(/[^a-zA-Z0-9-]/g, '-')
        .toUpperCase()
        .slice(0, 24);

      return {
        dockId,
        dockName: item.zoneName,
        zoneName: item.zoneName,
        status: item.status,
        unloadingDurationMins: 35, // average unloading dwell time
        setpointTempC: item.setpointTempC ?? 3.0,
        actualTempC: item.mktTempC ?? (item.status === 'compliant' ? item.setpointTempC ?? 3.0 : 6.8),
        timestamp: item.arrivedAt,
      };
    });

    // Query recent audit logs for flagged docks overrides
    const watchOverrides: Record<string, { status: DockWatchStatus; reason?: string }> = {};
    for (const [k, v] of MEMORY_DOCK_WATCHES.entries()) {
      watchOverrides[k] = v;
    }

    try {
      const { data: flagLogs } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('action', 'DOCK_WATCH_STATUS_UPDATED')
        .order('created_at', { ascending: false })
        .limit(50);

      if (flagLogs) {
        for (const log of flagLogs) {
          const dockId = log.entity_id;
          if (dockId && !watchOverrides[dockId]) {
            const details = typeof log.details === 'string' ? JSON.parse(log.details) : log.details;
            if (details?.watchStatus) {
              watchOverrides[dockId] = {
                status: details.watchStatus as DockWatchStatus,
                reason: details.reason,
              };
              MEMORY_DOCK_WATCHES.set(dockId, watchOverrides[dockId]);
            }
          }
        }
      }
    } catch {
      // Fallback silently if audit_logs table query is limited in test/local
    }

    // Cluster docks and calculate DVI metrics via strict Decimal.js precision
    const { clusters: allClusters, summary } = DockThermalRiskService.clusterDockArrivals(
      rawEvents,
      watchOverrides
    );

    // Apply filtering
    let filtered = allClusters;

    if (validatedFilter.riskLevel && validatedFilter.riskLevel !== 'all') {
      filtered = filtered.filter((c) => c.riskLevel === validatedFilter.riskLevel);
    }

    if (validatedFilter.minDvi !== undefined) {
      filtered = filtered.filter((c) => c.metrics.dviScore >= (validatedFilter.minDvi || 0));
    }

    if (validatedFilter.countryCode) {
      const cc = validatedFilter.countryCode.toUpperCase();
      filtered = filtered.filter((c) => c.countryCode.toUpperCase() === cc);
    }

    if (validatedFilter.search) {
      const query = validatedFilter.search.toLowerCase().trim();
      filtered = filtered.filter(
        (c) =>
          c.dockId.toLowerCase().includes(query) ||
          c.dockName.toLowerCase().includes(query) ||
          c.facilityOrPort.toLowerCase().includes(query) ||
          c.city.toLowerCase().includes(query)
      );
    }

    return {
      success: true,
      clusters: filtered,
      summary,
    };
  } catch (error: any) {
    console.error('Error fetching dock risk clusters:', error);
    return {
      success: false,
      clusters: [],
      summary: {
        totalDocksAnalyzed: 0,
        criticalHotspotsCount: 0,
        monitoredDocksCount: 0,
        safeDocksCount: 0,
        overallAverageDvi: 0,
        worstDviDock: null,
        coldChainPreservationPercent: 100,
      },
      error: error?.message || 'Failed to fetch dock thermal risk clusters',
    };
  }
}

/**
 * Updates the watch status (normal | monitored | blacklisted) of a specific dock hub
 */
export async function flagHighRiskDockAction(
  input: FlagDockInput
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const validated = flagDockSchema.parse(input);
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Store in memory cache
    MEMORY_DOCK_WATCHES.set(validated.dockId, {
      status: validated.watchStatus,
      reason: validated.reason,
    });

    // Record official audit log
    await recordAuditLog({
      actionType: 'update',
      entityType: 'dock',
      entityId: validated.dockId,
      reason: validated.reason,
      newData: {
        watchStatus: validated.watchStatus,
        reason: validated.reason,
        timestamp: new Date().toISOString(),
      },
    });

    return {
      success: true,
      message: `Dock ${validated.dockId} status updated to ${validated.watchStatus}`,
    };
  } catch (error: any) {
    console.error('Error updating dock watch status:', error);
    return {
      success: false,
      error: error?.message || 'Failed to update dock watch status',
    };
  }
}
