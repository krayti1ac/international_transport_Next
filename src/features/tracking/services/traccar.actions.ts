'use server';

import { createClient } from '@/lib/supabase/server';
import type { TruckLocation, GeofenceZone } from '@/types/database';

export interface TraccarPosition {
  id: number;
  deviceId: number;
  latitude: number;
  longitude: number;
  speed?: number;
  course?: number;
  accuracy?: number;
  altitude?: number;
  batteryLevel?: number;
  timestamp: number;
  address?: string;
  attributes?: Record<string, unknown>;
}

export interface TraccarDevice {
  id: number;
  name: string;
  uniqueId: string;
  status: string;
  lastUpdate?: number;
  positionId?: number;
  latitude?: number;
  longitude?: number;
}

export interface DeviceMapping {
  id: number;
  company_id: number;
  traccar_device_id: number;
  traccar_unique_id: string;
  truck_id: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TraccarConfig {
  id: number;
  company_id: number;
  traccar_server_url: string;
  traccar_api_key?: string;
  traccar_username?: string;
  traccar_password?: string;
  is_active: boolean;
  sync_interval_minutes: number;
  created_at: string;
  updated_at: string;
}

export async function getTraccarConfig(): Promise<TraccarConfig | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from('users')
    .select('company_id, role')
    .eq('id', user.id)
    .single();

  if (!profile?.company_id) return null;

  const { data, error } = await supabase
    .from('traccar_configs')
    .select('*')
    .eq('company_id', profile.company_id)
    .eq('is_active', true)
    .single();

  if (error || !data) return null;
  return data as TraccarConfig;
}

export async function getDeviceMappings(): Promise<DeviceMapping[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: profile } = await supabase
    .from('users')
    .select('company_id, role')
    .eq('id', user.id)
    .single();

  if (!profile?.company_id) return [];

  const { data, error } = await supabase
    .from('traccar_device_mappings')
    .select('*')
    .eq('company_id', profile.company_id)
    .order('created_at', { ascending: false });

  if (error) return [];
  return (data || []) as DeviceMapping[];
}

export async function syncTraccarPositions(): Promise<{ success: boolean; count: number; error?: string }> {
  const config = await getTraccarConfig();
  if (!config) {
    return { success: false, count: 0, error: 'Traccar configuration not found' };
  }

  const deviceMappings = await getDeviceMappings();
  if (deviceMappings.length === 0) {
    return { success: false, count: 0, error: 'No device mappings configured' };
  }

  const supabase = await createClient();
  let syncedCount = 0;

  for (const mapping of deviceMappings) {
    if (!mapping.is_active) continue;

    try {
      const positions = await fetchTraccarPositions(config, mapping.traccar_device_id);
      if (!positions || positions.length === 0) continue;

      const latestPosition = positions[0];
      const recordTime = new Date(latestPosition.timestamp).toISOString();

      const { error } = await supabase.from('truck_locations').insert({
        truck_id: mapping.truck_id,
        latitude: latestPosition.latitude,
        longitude: latestPosition.longitude,
        speed: latestPosition.speed,
        heading: latestPosition.course,
        accuracy: latestPosition.accuracy,
        recorded_at: recordTime,
        timestamp: recordTime,
      });

      if (error) {
        console.error(`Failed to insert position for truck ${mapping.truck_id}:`, error);
        continue;
      }

      await supabase
        .from('trucks')
        .update({
          current_location: latestPosition.address || `${latestPosition.latitude.toFixed(4)}, ${latestPosition.longitude.toFixed(4)}`,
        })
        .eq('id', mapping.truck_id);

      syncedCount++;
    } catch (err) {
      console.error(`Error syncing device ${mapping.traccar_device_id}:`, err);
    }
  }

  return { success: true, count: syncedCount };
}

async function fetchTraccarPositions(config: TraccarConfig, deviceId: number): Promise<TraccarPosition[]> {
  const baseUrl = config.traccar_server_url.replace(/\/$/, '');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (config.traccar_api_key) {
    headers['Authorization'] = `Bearer ${config.traccar_api_key}`;
  } else if (config.traccar_username && config.traccar_password) {
    const auth = Buffer.from(`${config.traccar_username}:${config.traccar_password}`).toString('base64');
    headers['Authorization'] = `Basic ${auth}`;
  }

  const response = await fetch(
    `${baseUrl}/api/positions?deviceId=${deviceId}&limit=1`,
    { headers, next: { revalidate: 0 } }
  );

  if (!response.ok) {
    throw new Error(`Traccar API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data as TraccarPosition[];
}

export async function getTraccarDevices(): Promise<TraccarDevice[]> {
  const config = await getTraccarConfig();
  if (!config) return [];

  const baseUrl = config.traccar_server_url.replace(/\/$/, '');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (config.traccar_api_key) {
    headers['Authorization'] = `Bearer ${config.traccar_api_key}`;
  } else if (config.traccar_username && config.traccar_password) {
    const auth = Buffer.from(`${config.traccar_username}:${config.traccar_password}`).toString('base64');
    headers['Authorization'] = `Basic ${auth}`;
  }

  const response = await fetch(`${baseUrl}/api/devices`, { headers, next: { revalidate: 0 } });

  if (!response.ok) {
    throw new Error(`Traccar API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data as TraccarDevice[];
}

export async function getTruckLocationHistory(truckId: number, startDate?: string, endDate?: string): Promise<TruckLocation[]> {
  const supabase = await createClient();
  let query = supabase
    .from('truck_locations')
    .select('*')
    .eq('truck_id', truckId)
    .order('recorded_at', { ascending: true });

  if (startDate) {
    query = query.gte('recorded_at', startDate);
  }
  if (endDate) {
    query = query.lte('recorded_at', endDate);
  }

  const { data, error } = await query;
  if (error) return [];
  return (data || []) as TruckLocation[];
}

export async function getActiveGeofenceZones(): Promise<GeofenceZone[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('geofence_zones')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: true });

  if (error) return [];
  return (data || []) as GeofenceZone[];
}
