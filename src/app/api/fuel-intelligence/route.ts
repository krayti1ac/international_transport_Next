import { NextRequest, NextResponse } from 'next/server';
import { calculateFuelAnalytics, detectFuelAnomalies } from '@/features/fleet/services/fuel_intelligence.actions';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const truckId = searchParams.get('truckId');
    const truckIdNum = truckId ? parseInt(truckId) : undefined;

    if (truckId && isNaN(truckIdNum || 0)) {
      return NextResponse.json({ error: 'Invalid truckId parameter' }, { status: 400 });
    }

    const analyticsResult = await calculateFuelAnalytics();
    if (!analyticsResult.success) {
      return NextResponse.json({ error: analyticsResult.error }, { status: 500 });
    }

    let anomalies = analyticsResult.anomalies || [];
    if (truckIdNum) {
      const anomalyResult = await detectFuelAnomalies(truckIdNum);
      if (anomalyResult.success && anomalyResult.anomalies) {
        anomalies = anomalyResult.anomalies;
      }
    }

    const trucks = analyticsResult.trucks || [];
    const overallAvg =
      trucks.length > 0
        ? trucks.reduce((sum, t) => sum + t.lPer100km, 0) / trucks.length
        : 0;

    const truckStats = trucks.map((t) => ({
      truckId: t.truckId,
      plateNumber: t.truckName,
      totalLiters: t.totalLiters,
      totalDistanceKm: t.totalDistanceKm,
      avgLitersPer100Km: t.lPer100km,
      recordCount: t.receiptsCount,
    }));

    const mappedAnomalies = anomalies.map((a) => ({
      truckId: a.truckId,
      plateNumber: a.truckName,
      date: a.date,
      liters: a.liters,
      distanceKm: a.distanceKm,
      litersPer100Km: a.lPer100km,
      threshold: 35,
      severity: a.severity === 'high' ? 'critical' : a.severity === 'medium' ? 'warning' : 'warning',
    }));

    return NextResponse.json({
      truckStats,
      anomalies: mappedAnomalies,
      overallAvgConsumption: parseFloat(overallAvg.toFixed(2)),
      generatedAt: new Date().toISOString(),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
