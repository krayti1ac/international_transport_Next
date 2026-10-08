import Decimal from 'decimal.js';
import { createClient } from '@/lib/supabase/server';
import { calculateDistance } from '@/lib/geofence';
import { STRATEGIC_PORT_ZONES, type StrategicPortZone } from '@/features/tracking/services/port-geofence.constants';
import { computeReeferHealth } from '@/features/predictive/services/fleet-predictive.service';
import type { Truck, Trailer, TripOrder, Driver, TruckLocation } from '@/types/database';
import type { RawTripOrderWithRelations } from '@/features/analytics/services/corridor-comparison.service';
import {
  CARGO_THERMAL_PROFILES,
  type CargoThermalProfile,
  type TelematicsTelemetry,
  type ThermalDriftSeverity,
  type IncidentAlert,
  type MissionControlSummary,
  type MissionControlDashboardData,
} from '../types';

Decimal.config({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

/**
 * Evaluates temperature deviation against cargo thermal setpoint using Decimal.js.
 */
export function evaluateThermalDeviation(
  currentTemp: number,
  targetTemp: number,
  profile: CargoThermalProfile
): {
  tempDeviation: number;
  tempStatus: ThermalDriftSeverity;
} {
  const curDec = new Decimal(currentTemp);
  const targetDec = new Decimal(targetTemp);
  const diffDec = curDec.minus(targetDec).abs();
  const tempDeviation = Number(diffDec.toFixed(2));

  const config = CARGO_THERMAL_PROFILES[profile] || CARGO_THERMAL_PROFILES.frozen_fish;
  const toleranceDec = new Decimal(config.allowedTolerance);
  const warningLimitDec = toleranceDec.plus(2.5); // Warning bracket

  let tempStatus: ThermalDriftSeverity = 'optimal';
  if (diffDec.greaterThan(warningLimitDec)) {
    tempStatus = 'critical_drift';
  } else if (diffDec.greaterThan(toleranceDec)) {
    tempStatus = 'warning';
  }

  return { tempDeviation, tempStatus };
}

/**
 * Checks security risks for unexpected reefer door opening.
 * A door open while moving (speed > 10 km/h) is classified as an immediate security breach.
 */
export function evaluateDoorBreachRisk(speed: number, doorOpen: boolean): boolean {
  return doorOpen && speed > 10;
}

/**
 * Resolves whether coordinates lie inside any of the strategic international ports or border crossings.
 */
export function resolveCurrentGeofenceZone(
  latitude: number,
  longitude: number
): StrategicPortZone | null {
  for (const zone of STRATEGIC_PORT_ZONES) {
    const dist = calculateDistance(latitude, longitude, zone.latitude, zone.longitude);
    if (dist <= zone.radiusKm) {
      return zone;
    }
  }
  return null;
}

/**
 * Computes overall cold chain fleet integrity score (0 - 100%) using Decimal.js.
 */
export function calculateColdChainIntegrityScore(
  telemetryList: TelematicsTelemetry[]
): number {
  if (telemetryList.length === 0) return 100;

  const totalDec = new Decimal(telemetryList.length);
  let penaltyDec = new Decimal(0);

  for (const item of telemetryList) {
    if (item.tempStatus === 'critical_drift') {
      penaltyDec = penaltyDec.plus(25);
    } else if (item.tempStatus === 'warning') {
      penaltyDec = penaltyDec.plus(10);
    }

    if (item.doorBreachRisk) {
      penaltyDec = penaltyDec.plus(15);
    }

    if (item.reeferStatus === 'high_risk') {
      penaltyDec = penaltyDec.plus(10);
    }
  }

  const avgPenalty = penaltyDec.dividedBy(totalDec);
  let scoreDec = new Decimal(100).minus(avgPenalty);
  if (scoreDec.lessThan(0)) scoreDec = new Decimal(0);
  if (scoreDec.greaterThan(100)) scoreDec = new Decimal(100);

  return Math.round(scoreDec.toNumber());
}

/**
 * Generates automated incident alerts from processed telematics.
 */
export function generateIncidentAlerts(telemetryList: TelematicsTelemetry[]): IncidentAlert[] {
  const alerts: IncidentAlert[] = [];

  for (const t of telemetryList) {
    // 1. Critical Temperature Drift Alarm
    if (t.tempStatus === 'critical_drift') {
      alerts.push({
        id: `alert-drift-${t.truckId}-${Date.now()}`,
        truckId: t.truckId,
        truckPlate: t.truckPlate,
        tripId: t.tripId,
        alertType: 'temp_drift',
        severity: 'critical',
        titleAr: `🚨 انحراف حراري حرج بمبرد الشاحنة ${t.truckPlate}`,
        titleFr: `🚨 Dérive thermique critique sur camion ${t.truckPlate}`,
        titleEs: `🚨 Desviación térmica crítica en camión ${t.truckPlate}`,
        messageAr: `بلغت الحرارة ${t.currentTemp}°C بانحراف ${t.tempDeviation}°C عن المعيار المستهدف (${t.targetTemp}°C). نوع البضاعة: ${CARGO_THERMAL_PROFILES[t.cargoProfile].nameAr}.`,
        messageFr: `Température mesurée à ${t.currentTemp}°C (écart de +${t.tempDeviation}°C par rapport à la consigne ${t.targetTemp}°C).`,
        messageEs: `Temperatura registrada a ${t.currentTemp}°C (desviación de +${t.tempDeviation}°C sobre la consigna ${t.targetTemp}°C).`,
        currentTemp: t.currentTemp,
        targetTemp: t.targetTemp,
        deviationCelsius: t.tempDeviation,
        speed: t.speed,
        timestamp: t.recordedAt,
        driverPhone: t.driverPhone,
        driverName: t.driverName,
        acknowledged: false,
      });
    }

    // 2. Door breach while moving
    if (t.doorBreachRisk) {
      alerts.push({
        id: `alert-door-${t.truckId}-${Date.now()}`,
        truckId: t.truckId,
        truckPlate: t.truckPlate,
        tripId: t.tripId,
        alertType: 'door_open_moving',
        severity: 'critical',
        titleAr: `⚠️ إنذار أمني: باب حاوية التبريد مفتوح أثناء الحركة (${t.truckPlate})`,
        titleFr: `⚠️ Alerte Sécurité : Porte ouverte en mouvement (${t.truckPlate})`,
        titleEs: `⚠️ Alerta de Seguridad: Puerta abierta en movimiento (${t.truckPlate})`,
        messageAr: `حساس الباب يشير إلى فتح المقطورة بينما تسير الشاحنة بسرعة ${t.speed} كم/س. خطر تعرض البضائع للتلف أو السرقة.`,
        messageFr: `Capteur de porte ouvert alors que le véhicule roule à ${t.speed} km/h. Risque de rupture de chaîne ou vol.`,
        messageEs: `Sensor de puerta abierto con el camión circulando a ${t.speed} km/h. Riesgo de rotura térmica o intrusión.`,
        speed: t.speed,
        timestamp: t.recordedAt,
        driverPhone: t.driverPhone,
        driverName: t.driverName,
        acknowledged: false,
      });
    }

    // 3. Geofence presence in international customs port
    if (t.currentZoneId) {
      alerts.push({
        id: `alert-geo-${t.truckId}-${t.currentZoneId}`,
        truckId: t.truckId,
        truckPlate: t.truckPlate,
        tripId: t.tripId,
        alertType: 'geofence_entry',
        severity: 'info',
        titleAr: `📍 الشاحنة ${t.truckPlate} داخل نطاق ${t.currentZoneName}`,
        titleFr: `📍 Camion ${t.truckPlate} dans la zone ${t.currentZoneName}`,
        titleEs: `📍 Camión ${t.truckPlate} en la zona de ${t.currentZoneName}`,
        messageAr: `تم رصد التموضع الميداني داخل محيط المعبر الجمركي/الميناء بنجاح.`,
        messageFr: `Positionnement détecté dans le périmètre portuaire / frontalier.`,
        messageEs: `Posicionamiento detectado en el perímetro portuario o fronterizo.`,
        timestamp: t.recordedAt,
        driverPhone: t.driverPhone,
        driverName: t.driverName,
        acknowledged: true,
      });
    }
  }

  return alerts;
}

/**
 * Builds realistic live telemetry pins for fleet assets if database coordinates are sparse.
 */
export function buildSimulatedTelemetryList(
  trucks: Truck[],
  trailers: Trailer[],
  activeTrips: TripOrder[],
  drivers: Driver[]
): TelematicsTelemetry[] {
  const driverMap = new Map<number, Driver>();
  drivers.forEach((d) => driverMap.set(d.id, d));

  const trailerMap = new Map<number, Trailer>();
  trailers.forEach((tr) => trailerMap.set(tr.id, tr));

  const tripByTruckMap = new Map<number, TripOrder>();
  activeTrips.forEach((tp) => {
    if (tp.truck_id) tripByTruckMap.set(tp.truck_id, tp);
  });

  // Reference waypoints for Corridor visualization
  const CORRIDOR_WAYPOINTS = [
    { lat: 35.885, lng: -5.505, name: 'Tanger Med Port', zoneId: 'port_tanger_med', speed: 25 },
    { lat: 36.132, lng: -5.438, name: 'Algeciras Port', zoneId: 'port_algeciras', speed: 15 },
    { lat: 33.573, lng: -7.589, name: 'Casablanca Logistics Hub', zoneId: undefined, speed: 82 },
    { lat: 30.427, lng: -9.598, name: 'Agadir Souss Export Center', zoneId: undefined, speed: 78 },
    { lat: 21.353, lng: -16.953, name: 'Guerguerat Border Post', zoneId: 'border_guerguerat', speed: 10 },
    { lat: 14.716, lng: -17.467, name: 'Dakar Maritime Terminal', zoneId: 'port_dakar', speed: 30 },
  ];

  return trucks.map((truck, idx) => {
    const waypoint = CORRIDOR_WAYPOINTS[idx % CORRIDOR_WAYPOINTS.length];
    const trip = tripByTruckMap.get(truck.id);
    const driver = trip?.driver_id ? driverMap.get(trip.driver_id) : undefined;
    const trailer = trip?.trailer_id ? trailerMap.get(trip.trailer_id) : trailers[idx % (trailers.length || 1)];

    // Assign cargo profile based on route or index
    let cargoProfile: CargoThermalProfile = 'frozen_fish';
    if (idx % 3 === 1) cargoProfile = 'fresh_produce';
    else if (idx % 3 === 2) cargoProfile = 'frozen_meat';

    const targetTemp = CARGO_THERMAL_PROFILES[cargoProfile].defaultSetpoint;

    // Simulate realistic temperatures (one truck with drift for radar alert demonstration)
    let currentTemp = targetTemp;
    if (idx === 1) {
      // Intentional warning drift (+2.2°C)
      currentTemp = targetTemp + 2.2;
    } else if (idx === 3) {
      // Intentional critical drift (+4.8°C)
      currentTemp = targetTemp + 4.8;
    } else {
      currentTemp = targetTemp + (idx % 2 === 0 ? 0.3 : -0.2);
    }

    const { tempDeviation, tempStatus } = evaluateThermalDeviation(
      currentTemp,
      targetTemp,
      cargoProfile
    );

    // Simulate door state (one moving breach on index 3)
    const doorOpen = idx === 3;
    const speed = waypoint.speed;
    const doorBreachRisk = evaluateDoorBreachRisk(speed, doorOpen);

    const reeferHealth = trailer
      ? computeReeferHealth(trailer, trip ? [trip as RawTripOrderWithRelations] : [], idx === 3 ? 2 : 0)
      : { healthScore: 92, status: 'optimal' as const, engineHours: 480 };

    return {
      truckId: truck.id,
      truckPlate: truck.plate_number,
      truckModel: truck.model || 'Volvo FH 500 Globetrotter',
      trailerId: trailer?.id,
      trailerPlate: trailer?.plate_number || 'REM-1001-MA',
      reeferModel: trailer?.model || 'Carrier Vector 1550 Multitemp',
      driverId: driver?.id,
      driverName: driver?.name || 'كابتن الأسطول الدولي',
      driverPhone: driver?.phone || '0661000000',
      tripId: trip?.id || 100 + idx,
      tripRoute: trip?.route || (idx % 2 === 0 ? 'Agadir -> Dakar' : 'Tanger Med -> Algeciras'),
      corridorType: (trip?.corridor_type as any) || (idx % 2 === 0 ? 'african_overland' : 'european_maritime'),
      tripStage: trip?.status || 'in_transit',
      latitude: waypoint.lat + (idx * 0.05),
      longitude: waypoint.lng + (idx * 0.05),
      speed,
      heading: 180,
      ignition: speed > 0,
      fuelLevel: 85 - (idx * 10),
      batteryLevel: 24.2,
      recordedAt: new Date().toISOString(),
      cargoProfile,
      currentTemp: Number(currentTemp.toFixed(1)),
      targetTemp,
      tempDeviation,
      tempStatus,
      doorOpen,
      doorBreachRisk,
      reeferEngineHours: reeferHealth.engineHours,
      reeferSdiScore: reeferHealth.healthScore,
      reeferStatus: reeferHealth.status,
      currentZoneId: waypoint.zoneId,
      currentZoneName: waypoint.name,
    };
  });
}

/**
 * Core query service compiling Mission Control Dashboard data.
 */
export async function fetchMissionControlData(): Promise<MissionControlDashboardData> {
  const supabase = await createClient();

  // Query trucks, trailers, active trips, drivers, and recent pings
  const [trucksRes, trailersRes, tripsRes, driversRes, locationsRes] = await Promise.all([
    supabase.from('trucks').select('*').order('id', { ascending: true }),
    supabase.from('trailers').select('*').order('id', { ascending: true }),
    supabase
      .from('trip_orders')
      .select('*')
      .in('status', ['loading', 'in_transit', 'customs_export', 'delivered'])
      .order('departure_date', { ascending: false }),
    supabase.from('drivers').select('*').order('name', { ascending: true }),
    supabase
      .from('truck_locations')
      .select('*')
      .order('recorded_at', { ascending: false })
      .limit(100),
  ]);

  const trucks = (trucksRes.data || []) as Truck[];
  const trailers = (trailersRes.data || []) as Trailer[];
  const activeTrips = (tripsRes.data || []) as TripOrder[];
  const drivers = (driversRes.data || []) as Driver[];
  const rawLocations = (locationsRes.data || []) as TruckLocation[];

  let telemetryList: TelematicsTelemetry[] = [];

  if (rawLocations.length > 0 && trucks.length > 0) {
    // Group latest location by truck_id
    const latestLocationByTruck = new Map<number, TruckLocation>();
    for (const loc of rawLocations) {
      if (!latestLocationByTruck.has(loc.truck_id)) {
        latestLocationByTruck.set(loc.truck_id, loc);
      }
    }

    const trailerMap = new Map<number, Trailer>();
    trailers.forEach((tr) => trailerMap.set(tr.id, tr));

    const driverMap = new Map<number, Driver>();
    drivers.forEach((d) => driverMap.set(d.id, d));

    const tripByTruckMap = new Map<number, TripOrder>();
    activeTrips.forEach((tp) => {
      if (tp.truck_id) tripByTruckMap.set(tp.truck_id, tp);
    });

    telemetryList = trucks
      .map((truck) => {
        const loc = latestLocationByTruck.get(truck.id);
        if (!loc) return null;

        const trip = tripByTruckMap.get(truck.id);
        const driver = trip?.driver_id ? driverMap.get(trip.driver_id) : undefined;
        const trailer = trip?.trailer_id ? trailerMap.get(trip.trailer_id) : undefined;

        const cargoProfile: CargoThermalProfile =
          trip?.goods_description_export?.toLowerCase().includes('fish') ||
          trip?.goods_description_export?.toLowerCase().includes('poisson')
            ? 'frozen_fish'
            : 'fresh_produce';

        const targetTemp = CARGO_THERMAL_PROFILES[cargoProfile].defaultSetpoint;
        const rawTemp = loc.frigo_temperature ?? loc.temperature;
        const currentTemp = rawTemp !== null && rawTemp !== undefined ? rawTemp : targetTemp;

        const { tempDeviation, tempStatus } = evaluateThermalDeviation(
          currentTemp,
          targetTemp,
          cargoProfile
        );

        const doorOpen = loc.door_open === true;
        const speed = loc.speed || 0;
        const doorBreachRisk = evaluateDoorBreachRisk(speed, doorOpen);

        const geofenceZone = resolveCurrentGeofenceZone(loc.latitude, loc.longitude);

        const reeferHealth = trailer
          ? computeReeferHealth(trailer, trip ? [trip as RawTripOrderWithRelations] : [], tempStatus === 'critical_drift' ? 1 : 0)
          : { healthScore: 90, status: 'optimal' as const, engineHours: 450 };

        return {
          truckId: truck.id,
          truckPlate: truck.plate_number,
          truckModel: truck.model || 'Volvo FH 500',
          trailerId: trailer?.id,
          trailerPlate: trailer?.plate_number,
          reeferModel: trailer?.model || 'Thermo King SLXi',
          driverId: driver?.id,
          driverName: driver?.name,
          driverPhone: driver?.phone,
          tripId: trip?.id,
          tripRoute: trip?.route,
          corridorType: (trip?.corridor_type as any) || 'european_maritime',
          tripStage: trip?.status || 'in_transit',
          latitude: loc.latitude,
          longitude: loc.longitude,
          speed,
          heading: 0,
          ignition: Boolean(loc.ignition),
          fuelLevel: loc.fuel_level || 80,
          batteryLevel: loc.battery_level || 24.0,
          recordedAt: loc.recorded_at || loc.timestamp || new Date().toISOString(),
          cargoProfile,
          currentTemp: Number(currentTemp.toFixed(1)),
          targetTemp,
          tempDeviation,
          tempStatus,
          doorOpen,
          doorBreachRisk,
          reeferEngineHours: reeferHealth.engineHours,
          reeferSdiScore: reeferHealth.healthScore,
          reeferStatus: reeferHealth.status,
          currentZoneId: geofenceZone?.id,
          currentZoneName: geofenceZone?.name,
        } as TelematicsTelemetry;
      })
      .filter(Boolean) as TelematicsTelemetry[];
  }

  // Fallback to simulated fleet telemetry if database telemetry pings are not yet populated
  if (telemetryList.length === 0) {
    const fallbackTrucks = trucks.length > 0 ? trucks : ([
      { id: 101, plate_number: '12345-A-1', model: 'Volvo FH 540', status: 'active', fuel_consumption_rate: 36.0, created_at: '2026-01-01' },
      { id: 102, plate_number: '67890-B-2', model: 'Scania R500', status: 'active', fuel_consumption_rate: 37.0, created_at: '2026-01-01' },
      { id: 103, plate_number: '11223-D-7', model: 'Mercedes Actros 1845', status: 'active', fuel_consumption_rate: 35.5, created_at: '2026-01-01' },
      { id: 104, plate_number: '44556-H-9', model: 'MAN TGX 18.500', status: 'active', fuel_consumption_rate: 38.0, created_at: '2026-01-01' },
    ] as Truck[]);

    const fallbackTrailers = trailers.length > 0 ? trailers : ([
      { id: 201, plate_number: 'REM-1001-MA', model: 'Schmitz Frigo (Carrier Vector 1550)', status: 'active', created_at: '2026-01-01' },
      { id: 202, plate_number: 'REM-1002-MA', model: 'Krone Cool Liner (Thermo King SLXi)', status: 'active', created_at: '2026-01-01' },
    ] as Trailer[]);

    telemetryList = buildSimulatedTelemetryList(
      fallbackTrucks,
      fallbackTrailers,
      activeTrips,
      drivers
    );
  }

  const activeAlerts = generateIncidentAlerts(telemetryList);

  const activeFleetCount = telemetryList.length;
  const inTransitCount = telemetryList.filter((t) => t.speed > 5).length;
  const portCustomsCount = telemetryList.filter((t) => t.currentZoneId !== undefined).length;
  const criticalDriftCount = telemetryList.filter((t) => t.tempStatus === 'critical_drift').length;
  const doorBreachCount = telemetryList.filter((t) => t.doorBreachRisk).length;
  const highRiskReefersCount = telemetryList.filter((t) => t.reeferStatus === 'high_risk').length;
  const overallColdChainIntegrity = calculateColdChainIntegrityScore(telemetryList);

  const summary: MissionControlSummary = {
    activeFleetCount,
    inTransitCount,
    portCustomsCount,
    deliveredCount: activeTrips.filter((t) => t.status === 'delivered').length,
    totalReefersAudited: telemetryList.length,
    criticalDriftCount,
    doorBreachCount,
    highRiskReefersCount,
    overallColdChainIntegrity,
    lastUpdated: new Date().toISOString(),
  };

  return {
    summary,
    telemetryList,
    activeAlerts,
  };
}
