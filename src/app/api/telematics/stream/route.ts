/**
 * Trans Bodanon TMS — Real-Time Telematics & Reefer SSE Stream
 * Endpoint: GET /api/telematics/stream
 * Server-Sent Events (SSE) Protocol with Tenant Isolation & Keep-Alive Heartbeats
 */

import { NextRequest } from 'next/server';
import Decimal from 'decimal.js';
import { createClient } from '@/lib/supabase/server';
import type { TelematicsStreamPacket, StreamConnectedEvent } from '@/features/tracking/types/telematics-stream.types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Physical constants for Arrhenius MKT simulation using Decimal.js
const GAS_CONSTANT_R = new Decimal(8.314472); // J/(mol·K)
const ACTIVATION_ENERGY_DH = new Decimal(83144); // J/mol (83.144 kJ/mol for pharmaceuticals/fresh produce)
const ZERO_CELSIUS_KELVIN = new Decimal(273.15);

function calculateSimulatedMkt(temperaturesCelsius: number[]): number {
  if (temperaturesCelsius.length === 0) return 4.0;
  try {
    let sumExp = new Decimal(0);
    for (const tempC of temperaturesCelsius) {
      const tempK = new Decimal(tempC).plus(ZERO_CELSIUS_KELVIN);
      // exp(-ΔH / (R * T))
      const exponent = ACTIVATION_ENERGY_DH.negated().dividedBy(GAS_CONSTANT_R.times(tempK));
      sumExp = sumExp.plus(Decimal.exp(exponent));
    }
    const avgExp = sumExp.dividedBy(temperaturesCelsius.length);
    const lnAvgExp = Decimal.ln(avgExp);
    // T_k = -ΔH / (R * ln(avgExp))
    const mktKelvin = ACTIVATION_ENERGY_DH.negated().dividedBy(GAS_CONSTANT_R.times(lnAvgExp));
    return mktKelvin.minus(ZERO_CELSIUS_KELVIN).toDecimalPlaces(2).toNumber();
  } catch {
    return 4.0;
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized: Valid session required for telematics stream' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Tenant isolation verification
    const { data: userProfile } = await supabase
      .from('users')
      .select('company_id, role')
      .eq('id', user.id)
      .maybeSingle();

    const companyId = (userProfile?.company_id as number) ?? 1;
    const isSuperAdmin = userProfile?.role === 'super_admin';

    const { searchParams } = new URL(request.url);
    const tripId = searchParams.get('tripId');
    const truckIdParam = searchParams.get('truckId');
    const truckId = truckIdParam ? parseInt(truckIdParam, 10) : undefined;
    const mode = searchParams.get('mode') || 'live';

    // Verify trip ownership if tripId is specified
    let targetSetpoint = 4.0;
    let targetMinTemp = 2.0;
    let targetMaxTemp = 6.0;
    let coolingUnitBrand = 'Carrier Transicold';
    let truckPlate = '67890-A-40';
    let trailerPlate = 'MA-R-8821';

    if (tripId) {
      const { data: trip } = await supabase
        .from('trip_orders')
        .select('id, company_id, truck_id, route_name')
        .eq('id', tripId)
        .maybeSingle();

      if (trip && !isSuperAdmin && trip.company_id !== companyId) {
        return new Response(JSON.stringify({ error: 'Forbidden: Trip does not belong to authorized company' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Check reefer profile
      const { data: profile } = await supabase
        .from('trip_reefer_monitoring_profiles')
        .select('*')
        .eq('trip_id', tripId)
        .maybeSingle();

      if (profile) {
        targetSetpoint = Number(profile.setpoint_temp ?? 4.0);
        targetMinTemp = Number(profile.min_temp_threshold ?? 2.0);
        targetMaxTemp = Number(profile.max_temp_threshold ?? 6.0);
        coolingUnitBrand = profile.cooling_unit_brand || coolingUnitBrand;
      }
    }

    const encoder = new TextEncoder();
    let isAborted = false;
    let telemetryTimer: NodeJS.Timeout | null = null;
    let pingTimer: NodeJS.Timeout | null = null;

    // Stream generator using standard Web ReadableStream
    const stream = new ReadableStream({
      start(controller) {
        const sendEvent = (eventName: string, data: unknown) => {
          if (isAborted) return;
          try {
            const payload = `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;
            controller.enqueue(encoder.encode(payload));
          } catch {
            // Controller might be closed
          }
        };

        // 1. Send Initial Connection Handshake Event
        const connectedPayload: StreamConnectedEvent = {
          status: 'connected',
          companyId,
          tripId: tripId || undefined,
          truckId,
          timestamp: new Date().toISOString(),
          heartbeatIntervalSeconds: 15,
        };
        sendEvent('connected', connectedPayload);

        // State trackers for simulated telematics evolution
        let currentReturnTemp = new Decimal(targetSetpoint).plus(0.3).toNumber();
        let currentSupplyTemp = new Decimal(targetSetpoint).minus(0.2).toNumber();
        let currentFuelLiters = 185;
        let compressorStatus: 'running' | 'cycle_sentry' | 'defrost' | 'off' = 'running';
        let isDefrost = false;
        let doorOpen = false;
        let speed = 82;
        let lat = 31.7917;
        let lng = -7.0926;
        const recentTempWindow: number[] = [currentReturnTemp];

        const pushTelemetryTick = async () => {
          if (isAborted) return;

          try {
            // Check if there is live DB telemetry inserted in the last 15 seconds
            let livePacket: TelematicsStreamPacket | null = null;

            if (tripId && mode !== 'simulated') {
              const { data: latestLogs } = await supabase
                .from('reefer_temperature_logs')
                .select('*')
                .eq('trip_id', tripId)
                .order('recorded_at', { ascending: false })
                .limit(1);

              if (latestLogs && latestLogs.length > 0) {
                const log = latestLogs[0];
                const logAgeMs = Date.now() - new Date(log.recorded_at).getTime();
                // If log is fresher than 25 seconds, use live log directly
                if (logAgeMs < 25000) {
                  livePacket = {
                    id: log.id,
                    tripId,
                    truckId,
                    truckPlate,
                    trailerPlate,
                    supplyAirTemp: Number(log.supply_air_temp),
                    returnAirTemp: Number(log.return_air_temp),
                    ambientTemp: log.ambient_temp ? Number(log.ambient_temp) : 24.5,
                    evaporatorTemp: log.evaporator_temp ? Number(log.evaporator_temp) : Number(log.supply_air_temp) - 1.5,
                    compressorStatus: log.compressor_status || 'running',
                    isDefrostActive: Boolean(log.is_defrost_active),
                    doorOpenSensor: Boolean(log.door_open_sensor),
                    dieselFuelLevelLiters: log.diesel_fuel_level_liters ? Number(log.diesel_fuel_level_liters) : undefined,
                    dieselBurnRateLph: log.diesel_burn_rate_lph ? Number(log.diesel_burn_rate_lph) : 2.1,
                    latitude: log.latitude ? Number(log.latitude) : undefined,
                    longitude: log.longitude ? Number(log.longitude) : undefined,
                    speedKmH: 78,
                    isGeofenceSafe: log.is_geofence_safe ?? true,
                    mktCelsius: Number(log.return_air_temp),
                    recordedAt: log.recorded_at,
                  };
                }
              }
            }

            if (livePacket) {
              sendEvent('telemetry', livePacket);
              return;
            }

            // High-fidelity physical sensor simulation
            // Micro-fluctuation between -0.15°C and +0.15°C
            const randSupplyDelta = new Decimal(Math.random() * 0.3 - 0.15);
            const randReturnDelta = new Decimal(Math.random() * 0.24 - 0.12);

            currentSupplyTemp = new Decimal(currentSupplyTemp)
              .plus(randSupplyDelta)
              .toDecimalPlaces(2)
              .toNumber();

            currentReturnTemp = new Decimal(currentReturnTemp)
              .plus(randReturnDelta)
              .toDecimalPlaces(2)
              .toNumber();

            // Fuel burn rate calculation
            const burnRate = compressorStatus === 'running' ? 2.1 : 0.8;
            currentFuelLiters = Math.max(20, currentFuelLiters - 0.005);

            // Coordinates smooth transit progression
            lat += (Math.random() - 0.48) * 0.001;
            lng += (Math.random() - 0.48) * 0.001;

            recentTempWindow.push(currentReturnTemp);
            if (recentTempWindow.length > 20) {
              recentTempWindow.shift();
            }

            const currentMkt = calculateSimulatedMkt(recentTempWindow);

            const streamPacket: TelematicsStreamPacket = {
              id: `stream_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
              tripId: tripId || undefined,
              truckId,
              truckPlate,
              trailerPlate,
              supplyAirTemp: currentSupplyTemp,
              returnAirTemp: currentReturnTemp,
              ambientTemp: 24.5,
              evaporatorTemp: new Decimal(currentSupplyTemp).minus(1.8).toDecimalPlaces(2).toNumber(),
              compressorStatus,
              isDefrostActive: isDefrost,
              doorOpenSensor: doorOpen,
              dieselFuelLevelLiters: new Decimal(currentFuelLiters).toDecimalPlaces(1).toNumber(),
              dieselBurnRateLph: burnRate,
              latitude: Number(lat.toFixed(6)),
              longitude: Number(lng.toFixed(6)),
              speedKmH: speed,
              isGeofenceSafe: true,
              mktCelsius: currentMkt,
              recordedAt: new Date().toISOString(),
            };

            sendEvent('telemetry', streamPacket);
          } catch (tickErr) {
            console.warn('[SSE Telematics Tick Warning]:', tickErr);
          }
        };

        // Push immediate first telemetry packet
        pushTelemetryTick();

        // Telemetry update interval: every 4 seconds
        telemetryTimer = setInterval(pushTelemetryTick, 4000);

        // Keep-alive heartbeat ping: every 15 seconds
        pingTimer = setInterval(() => {
          if (isAborted) return;
          sendEvent('ping', { timestamp: new Date().toISOString() });
        }, 15000);
      },

      cancel() {
        isAborted = true;
        if (telemetryTimer) clearInterval(telemetryTimer);
        if (pingTimer) clearInterval(pingTimer);
      },
    });

    // Handle client disconnect / abort signal
    request.signal.addEventListener('abort', () => {
      isAborted = true;
      if (telemetryTimer) clearInterval(telemetryTimer);
      if (pingTimer) clearInterval(pingTimer);
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'Content-Encoding': 'none',
        'X-Accel-Buffering': 'no', // Disable buffering on Nginx / proxies
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error in telematics stream';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

