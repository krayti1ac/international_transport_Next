'use client';

import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import type { Truck, TruckLocation, GeofenceZone } from '@/types/database';
import { MatriculeBadge } from '@/components/ui/matricule-badge';

delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const ZONE_TYPE_LABELS: Record<string, string> = {
  port: 'ميناء',
  border: 'منطقة حدودية',
  customs: 'جمارك',
  logistics_hub: 'محطة لوجستية',
  client_warehouse: 'مستودع عميل',
  other: 'أخرى',
};

function MapController({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  map.setView(center, zoom);
  return null;
}

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function findMatchingZone(lat: number, lon: number, zones: GeofenceZone[]) {
  let matched: GeofenceZone | null = null;
  let minDistance = Infinity;

  for (const zone of zones) {
    const distance = calculateDistance(lat, lon, zone.latitude, zone.longitude);
    if (distance <= zone.radius_km && distance < minDistance) {
      matched = zone;
      minDistance = distance;
    }
  }

  return matched ? { zone: matched, distance: minDistance } : null;
}

interface TrackingMapProps {
  locations: Map<number, TruckLocation[]>;
  selectedTruck: Truck | null;
  isSatellite: boolean;
  geofenceZones: GeofenceZone[];
}

export function TrackingMap({ locations, selectedTruck, isSatellite, geofenceZones }: TrackingMapProps) {
  const getTruckHistory = (truckId: number) => {
    return locations.get(truckId) || [];
  };

  const getMapCenter = (): [number, number] => {
    if (selectedTruck) {
      const history = getTruckHistory(selectedTruck.id);
      if (history.length > 0) {
        return [history[0].latitude, history[0].longitude];
      }
    }
    return [35.1686, -2.9335];
  };

  const activeZones = geofenceZones.filter((z) => z.is_active);

  return (
    <MapContainer
      center={getMapCenter()}
      zoom={6}
      style={{ height: '100%', width: '100%', borderRadius: '0.5rem' }}
    >
      <MapController center={getMapCenter()} zoom={6} />
      <TileLayer
        url={isSatellite
          ? 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
          : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'}
        attribution='© OpenStreetMap contributors'
      />

      {activeZones.map((zone) => (
        <Marker key={zone.id} position={[zone.latitude, zone.longitude]}>
          <Popup>
            <div className="text-right">
              <p className="font-bold">{zone.name}</p>
              <p className="text-sm">{ZONE_TYPE_LABELS[zone.zone_type] || zone.zone_type}</p>
              <p className="text-xs text-slate-500">نصف القطر: {zone.radius_km} كم</p>
            </div>
          </Popup>
        </Marker>
      ))}

      {selectedTruck && (() => {
        const history = getTruckHistory(selectedTruck.id);
        if (history.length === 0) return null;

        const positions: [number, number][] = history.map(loc => [loc.latitude, loc.longitude]);
        const latest = history[0];
        const geofenceMatch = findMatchingZone(latest.latitude, latest.longitude, activeZones);

        return (
          <>
            <Polyline positions={positions} color="blue" weight={3} />
            <Marker position={[latest.latitude, latest.longitude]}>
              <Popup>
                <div className="text-right">
                  <div className="mb-1">
                    <MatriculeBadge plate={selectedTruck.plate_number} variant="badge" size="xs" />
                  </div>
                  <p className="text-sm">الموقع الحالي</p>
                  <p className="text-xs text-slate-500">
                    {new Date(latest.timestamp).toLocaleString('ar-MA')}
                  </p>
                  {geofenceMatch && (
                    <p className="text-sm text-green-600 font-medium">
                      داخل: {geofenceMatch.zone.name} ({geofenceMatch.distance.toFixed(2)} كم)
                    </p>
                  )}
                </div>
              </Popup>
            </Marker>
          </>
        );
      })()}
    </MapContainer>
  );
}
