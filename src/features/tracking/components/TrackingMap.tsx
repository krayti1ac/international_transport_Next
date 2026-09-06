'use client';

import { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import type { Truck, TruckLocation, GeofenceZone } from '@/types/database';
import { findMatchingZone } from '@/lib/geofence';
import { MatriculeBadge } from '@/components/ui/matricule-badge';

delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});


function MapController({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  const [lat, lng] = center;

  useEffect(() => {
    if (!map) return;
    try {
      const container = map.getContainer();
      if (!container) return;

      if (typeof lat === 'number' && typeof lng === 'number' && !isNaN(lat) && !isNaN(lng)) {
        map.invalidateSize();
        map.setView([lat, lng], zoom);
      }
    } catch (err) {
      console.warn('MapController failed to set view:', err);
    }
  }, [map, lat, lng, zoom]);

  return null;
}

interface TrackingMapProps {
  locations: Map<number, TruckLocation[]>;
  selectedTruck: Truck | null;
  isSatellite: boolean;
  geofenceZones: GeofenceZone[];
}

import { useLanguage } from '@/components/language-provider';

export function TrackingMap({ locations, selectedTruck, isSatellite, geofenceZones }: TrackingMapProps) {
  const { t, dir, locale } = useLanguage();

  const getZoneTypeLabel = (type: string) => {
    switch (type) {
      case 'port': return t('ميناء', 'Port');
      case 'border': return t('منطقة حدودية', 'Poste frontière');
      case 'customs': return t('جمارك', 'Douane');
      case 'logistics_hub': return t('محطة لوجستية', 'Hub logistique');
      case 'client_warehouse': return t('مستودع عميل', 'Entrepôt client');
      default: return t('أخرى', 'Autre');
    }
  };

  const getTruckHistory = (truckId: number) => {
    return locations.get(truckId) || [];
  };

  const center = useMemo<[number, number]>(() => {
    if (selectedTruck) {
      const history = locations.get(selectedTruck.id) || [];
      if (history.length > 0) {
        const lat = Number(history[0].latitude);
        const lng = Number(history[0].longitude);
        if (!isNaN(lat) && !isNaN(lng)) {
          return [lat, lng];
        }
      }
    }
    return [35.1686, -2.9335];
  }, [selectedTruck, locations]);

  const activeZones = useMemo(() => (geofenceZones || []).filter((z) => z.is_active), [geofenceZones]);

  return (
    <MapContainer
      center={center}
      zoom={6}
      style={{ height: '100%', width: '100%', borderRadius: '0.5rem' }}
    >
      <MapController center={center} zoom={6} />
      <TileLayer
        url={isSatellite
          ? 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
          : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'}
        attribution='© OpenStreetMap contributors'
      />

      {activeZones.map((zone) => {
        const lat = Number(zone.latitude);
        const lng = Number(zone.longitude);
        if (isNaN(lat) || isNaN(lng)) return null;

        return (
          <Marker key={zone.id} position={[lat, lng]}>
            <Popup>
              <div className={dir === 'rtl' ? 'text-right' : 'text-left'} dir={dir}>
                <p className="font-bold">{zone.name}</p>
                <p className="text-sm">{getZoneTypeLabel(zone.zone_type)}</p>
                <p className="text-xs text-slate-500">{t('نصف القطر: ', 'Rayon : ')}{zone.radius_km} {t('كم', 'km')}</p>
              </div>
            </Popup>
          </Marker>
        );
      })}

      {selectedTruck && (() => {
        const history = getTruckHistory(selectedTruck.id);
        if (history.length === 0) return null;

        const positions: [number, number][] = history
          .map((loc): [number, number] => [Number(loc.latitude), Number(loc.longitude)])
          .filter(([lat, lng]) => !isNaN(lat) && !isNaN(lng));

        if (positions.length === 0) return null;

        const latest = history[0];
        const latestLat = Number(latest.latitude);
        const latestLng = Number(latest.longitude);
        if (isNaN(latestLat) || isNaN(latestLng)) return null;

        const geofenceMatch = findMatchingZone(latestLat, latestLng, activeZones);

        return (
          <>
            <Polyline positions={positions} color="blue" weight={3} />
            <Marker position={[latestLat, latestLng]}>
              <Popup>
                <div className={dir === 'rtl' ? 'text-right' : 'text-left'} dir={dir}>
                  <div className="mb-1">
                    <MatriculeBadge plate={selectedTruck.plate_number} variant="badge" size="xs" />
                  </div>
                  <p className="text-sm font-medium">{t('الموقع الحالي', 'Position actuelle')}</p>
                  <p className="text-xs text-slate-500 font-mono">
                    {new Date(latest.recorded_at || latest.timestamp || '').toLocaleString(locale === 'ar' ? 'ar-MA' : 'fr-FR')}
                  </p>
                  {geofenceMatch && (
                    <p className="text-sm text-green-600 font-medium">
                      {t('داخل: ', 'Dans : ')}{geofenceMatch.zoneName} ({geofenceMatch.distance.toFixed(2)} {t('كم', 'km')})
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

export default TrackingMap;
