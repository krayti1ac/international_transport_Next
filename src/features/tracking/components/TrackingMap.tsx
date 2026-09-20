'use client';

import { useEffect, useMemo } from 'react';
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  Circle,
  Tooltip,
  useMap,
} from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import type { Truck, TruckLocation, GeofenceZone } from '@/types/database';
import { calculateDistance, findMatchingZone } from '@/lib/geofence';
import { MatriculeBadge } from '@/components/ui/matricule-badge';
import { useLanguage } from '@/components/language-provider';
import {
  STRATEGIC_PORT_ZONES,
  type StrategicPortZone,
} from '@/features/tracking/services/port-geofence.constants';
import { Button } from '@/components/ui/button';
import { Eye, Navigation, Key, Snowflake, ShieldCheck } from 'lucide-react';

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
  trucks?: Truck[];
  locations: Map<number, TruckLocation[]>;
  selectedTruck: Truck | null;
  onSelectTruck?: (truck: Truck) => void;
  isSatellite: boolean;
  geofenceZones: GeofenceZone[];
}

function createTruckDivIcon(options: {
  heading?: number;
  speed?: number;
  status: 'moving' | 'stopped' | 'in_port';
  hasFrigoAlert?: boolean;
  frigoTemp?: number | null;
  isSelected?: boolean;
}) {
  const { heading = 0, speed = 0, status, hasFrigoAlert, frigoTemp, isSelected } = options;

  let bgClass = 'bg-emerald-600 text-white border-emerald-300';
  if (status === 'in_port') {
    bgClass = 'bg-sky-600 text-white border-sky-300';
  } else if (status === 'stopped' || speed <= 5) {
    bgClass = 'bg-amber-600 text-white border-amber-300';
  }

  const alertRing = hasFrigoAlert
    ? '<span class="absolute -top-1.5 -right-1.5 flex h-3.5 w-3.5"><span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-80"></span><span class="relative inline-flex rounded-full h-3.5 w-3.5 bg-rose-600 border border-white"></span></span>'
    : '';

  const tempBadge =
    frigoTemp !== undefined && frigoTemp !== null
      ? `<span class="absolute -bottom-3 left-1/2 -translate-x-1/2 px-1 py-0.2 text-[9px] font-mono font-bold rounded shadow bg-slate-950/90 ${
          hasFrigoAlert
            ? 'text-rose-400 border border-rose-500/70 animate-pulse'
            : 'text-cyan-300 border border-cyan-500/50'
        } whitespace-nowrap">${frigoTemp > 0 ? '+' : ''}${frigoTemp.toFixed(1)}°C</span>`
      : '';

  const selectedRing = isSelected
    ? 'ring-4 ring-primary ring-offset-2 scale-110 shadow-2xl'
    : 'shadow-md';

  const html = `
    <div class="relative flex items-center justify-center cursor-pointer transition-all duration-300 group">
      <div class="w-8 h-8 rounded-full border-2 flex items-center justify-center ${bgClass} ${selectedRing}">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="transform: rotate(${heading}deg); transition: transform 0.4s ease;">
          <polygon points="12 2 19 21 12 17 5 21 12 2"></polygon>
        </svg>
      </div>
      ${alertRing}
      ${tempBadge}
    </div>
  `;

  return L.divIcon({
    className: 'custom-truck-marker bg-transparent border-0',
    html,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -20],
  });
}

export function TrackingMap({
  trucks = [],
  locations,
  selectedTruck,
  onSelectTruck,
  isSatellite,
  geofenceZones,
}: TrackingMapProps) {
  const { t, dir, locale } = useLanguage();

  const getZoneTypeBadge = (zone: StrategicPortZone) => {
    switch (zone.zoneType) {
      case 'seaport':
        return { label: t('ميناء بحري دولي', 'Port Maritime International', 'Puerto Marítimo Internacional'), color: '#0284c7' };
      case 'border_crossing':
        return { label: t('معبر حدودي قاري', 'Poste Frontière Continental', 'Paso Fronterizo Continental'), color: '#ea580c' };
      case 'customs_hub':
        return { label: t('منطقة جمركية حرة', 'Zone Franche Douanière', 'Zona Franca Aduanera'), color: '#8b5cf6' };
      case 'logistics_platform':
        return { label: t('مركز لوجستي وتفريغ', 'Plateforme Logistique', 'Centro Logístico'), color: '#10b981' };
      default:
        return { label: t('نطاق استراتيجي', 'Zone Stratégique', 'Zona Estratégica'), color: '#64748b' };
    }
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
    return [26.5, -12.5];
  }, [selectedTruck, locations]);

  const activeCustomZones = useMemo(
    () => (geofenceZones || []).filter((z) => z.is_active),
    [geofenceZones]
  );

  const checkTruckStrategicZone = (lat: number, lon: number): StrategicPortZone | null => {
    for (const zone of STRATEGIC_PORT_ZONES) {
      const distance = calculateDistance(lat, lon, zone.latitude, zone.longitude);
      if (distance <= zone.radiusKm) {
        return zone;
      }
    }
    return null;
  };

  return (
    <MapContainer
      center={center}
      zoom={selectedTruck ? 12 : 5}
      style={{ height: '100%', width: '100%', borderRadius: '0.75rem' }}
    >
      <MapController center={center} zoom={selectedTruck ? 12 : 5} />
      <TileLayer
        url={
          isSatellite
            ? 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
            : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
        }
        attribution="© OpenStreetMap contributors | Trans Bodanon Fleet Radar"
      />

      {STRATEGIC_PORT_ZONES.map((zone) => {
        const isSeaport = zone.zoneType === 'seaport';
        const isBorder = zone.zoneType === 'border_crossing';
        const strokeColor = isSeaport ? '#0284c7' : isBorder ? '#ea580c' : '#7c3aed';
        const fillColor = isSeaport ? '#38bdf8' : isBorder ? '#fb923c' : '#a78bfa';
        const zoneBadge = getZoneTypeBadge(zone);

        return (
          <Circle
            key={zone.id}
            center={[zone.latitude, zone.longitude]}
            radius={zone.radiusKm * 1000}
            pathOptions={{
              color: strokeColor,
              fillColor: fillColor,
              fillOpacity: 0.16,
              weight: 2,
              dashArray: isBorder ? '5, 5' : undefined,
            }}
          >
            <Tooltip direction="top" opacity={0.9} sticky>
              <div className="text-xs font-bold font-amiri text-slate-900" dir={dir}>
                {zone.name_ar}
                <div className="text-[10px] font-normal font-sans text-slate-600">
                  {zone.name_fr} ({zone.radiusKm} km)
                </div>
              </div>
            </Tooltip>
            <Popup>
              <div className={dir === 'rtl' ? 'text-right' : 'text-left'} dir={dir}>
                <div className="font-bold text-sm text-foreground mb-1">{zone.name_ar}</div>
                <div className="text-xs text-muted-foreground mb-2 font-mono">{zone.name_fr}</div>
                <div className="flex items-center gap-1.5 mb-2">
                  <span
                    className="inline-block w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: zoneBadge.color }}
                  />
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    {zoneBadge.label}
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 font-mono space-y-0.5">
                  <p>
                    {t('نصف القطر: ', 'Rayon : ', 'Radio: ')}
                    <span className="font-bold text-foreground">{zone.radiusKm}</span> {t('كم', 'km', 'km')}
                  </p>
                  <p>
                    {t('الإحداثيات: ', 'Coordonnées : ', 'Coordenadas: ')}
                    {zone.latitude.toFixed(4)}, {zone.longitude.toFixed(4)}
                  </p>
                </div>
              </div>
            </Popup>
          </Circle>
        );
      })}

      {activeCustomZones.map((zone) => {
        const lat = Number(zone.latitude);
        const lng = Number(zone.longitude);
        if (isNaN(lat) || isNaN(lng)) return null;

        return (
          <Circle
            key={`custom-${zone.id}`}
            center={[lat, lng]}
            radius={zone.radius_km * 1000}
            pathOptions={{
              color: '#059669',
              fillColor: '#34d399',
              fillOpacity: 0.14,
              weight: 1.5,
              dashArray: '3, 4',
            }}
          >
            <Popup>
              <div className={dir === 'rtl' ? 'text-right' : 'text-left'} dir={dir}>
                <p className="font-bold text-sm">{zone.name}</p>
                <p className="text-xs text-slate-500">{t('منطقة مخصصة', 'Zone personnalisée', 'Zona personalizada')}</p>
                <p className="text-xs text-slate-500 font-mono mt-1">
                  {t('نصف القطر: ', 'Rayon : ', 'Radio: ')}{zone.radius_km} {t('كم', 'km', 'km')}
                </p>
              </div>
            </Popup>
          </Circle>
        );
      })}

      {selectedTruck &&
        (() => {
          const history = locations.get(selectedTruck.id) || [];
          if (history.length < 2) return null;

          const positions: [number, number][] = history
            .map((loc): [number, number] => [Number(loc.latitude), Number(loc.longitude)])
            .filter(([lat, lng]) => !isNaN(lat) && !isNaN(lng));

          if (positions.length < 2) return null;

          return (
            <Polyline
              positions={positions}
              pathOptions={{
                color: '#2563eb',
                weight: 4,
                opacity: 0.85,
                dashArray: '6, 6',
              }}
            />
          );
        })()}

      {trucks.map((truck) => {
        const history = locations.get(truck.id) || [];
        if (history.length === 0) return null;

        const latest = history[0];
        const lat = Number(latest.latitude);
        const lng = Number(latest.longitude);
        if (isNaN(lat) || isNaN(lng)) return null;

        const speed = Number(latest.speed || 0);
        const heading = Number(latest.heading || 0);
        const strategicZone = checkTruckStrategicZone(lat, lng);
        const customZoneMatch = findMatchingZone(lat, lng, activeCustomZones);

        const status: 'moving' | 'stopped' | 'in_port' = strategicZone
          ? 'in_port'
          : speed > 5
          ? 'moving'
          : 'stopped';

        const frigoTemp =
          latest.frigo_temperature !== undefined && latest.frigo_temperature !== null
            ? Number(latest.frigo_temperature)
            : null;

        const hasFrigoAlert = frigoTemp !== null && frigoTemp > 4;
        const isSelected = selectedTruck?.id === truck.id;

        const markerIcon = createTruckDivIcon({
          heading,
          speed,
          status,
          hasFrigoAlert,
          frigoTemp,
          isSelected,
        });

        return (
          <Marker
            key={`truck-marker-${truck.id}`}
            position={[lat, lng]}
            icon={markerIcon}
            eventHandlers={{
              click: () => onSelectTruck?.(truck),
            }}
          >
            <Popup>
              <div
                className={`min-w-[240px] text-xs space-y-2 ${
                  dir === 'rtl' ? 'text-right' : 'text-left'
                }`}
                dir={dir}
              >
                <div className="flex items-center justify-between border-b pb-1.5">
                  <MatriculeBadge plate={truck.plate_number} variant="badge" size="xs" />
                  <span
                    className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                      status === 'in_port'
                        ? 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300'
                        : status === 'moving'
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                        : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                    }`}
                  >
                    {status === 'in_port'
                      ? t('داخل ميناء / معبر', 'Au Port / Frontière', 'En Puerto / Frontera')
                      : status === 'moving'
                      ? t('في حركة', 'En Mouvement', 'En Movimiento')
                      : t('متوقفة', 'À l’Arrêt', 'Detenido')}
                  </span>
                </div>

                <div className="text-[11px] text-muted-foreground space-y-0.5">
                  <p>
                    <span className="font-semibold text-foreground">
                      {t('السائق: ', 'Conducteur : ', 'Conductor: ')}
                    </span>
                    {truck.default_driver_name || t('سائق دولي', 'Chauffeur International', 'Conductor')}
                  </p>
                  {truck.model && (
                    <p>
                      <span className="font-semibold text-foreground">
                        {t('الموديل: ', 'Modèle : ', 'Modelo: ')}
                      </span>
                      {truck.model}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-1.5 bg-slate-50 dark:bg-slate-900 p-2 rounded-lg border border-slate-200 dark:border-slate-800 font-mono text-[11px]">
                  <div className="flex items-center gap-1">
                    <Navigation className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <span>
                      {speed > 0 ? `${Math.round(speed)} ${t('كم/س', 'km/h', 'km/h')}` : t('صفر', '0 km/h', '0 km/h')}
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    <Key className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <span>
                      {latest.ignition === true
                        ? t('المحرك يعمل', 'Contact ON', 'Contacto ON')
                        : latest.ignition === false
                        ? t('محرك متوقف', 'Contact OFF', 'Contacto OFF')
                        : t('غير محدد', 'N/A', 'N/A')}
                    </span>
                  </div>

                  {frigoTemp !== null ? (
                    <div
                      className={`col-span-2 flex items-center justify-between px-1.5 py-0.5 rounded border ${
                        hasFrigoAlert
                          ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300'
                          : 'bg-cyan-50 dark:bg-cyan-950/40 border-cyan-300 dark:border-cyan-800 text-cyan-800 dark:text-cyan-300'
                      }`}
                    >
                      <span className="flex items-center gap-1 text-[10px] font-sans font-semibold">
                        <Snowflake className="w-3 h-3" />
                        {t('حرارة التبريد Frigo:', 'Temp Frigo :', 'Temp Frigorífico:')}
                      </span>
                      <span className="font-bold">
                        {frigoTemp > 0 ? `+${frigoTemp.toFixed(1)}` : frigoTemp.toFixed(1)}°C
                      </span>
                    </div>
                  ) : null}
                </div>

                {strategicZone && (
                  <div className="text-[11px] font-medium text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-950/50 p-1.5 rounded border border-sky-200 dark:border-sky-800 flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                    <span>
                      {t('متواجدة داخل: ', 'Présent dans : ', 'Presente en: ')}
                      {strategicZone.name_ar}
                    </span>
                  </div>
                )}

                {customZoneMatch && !strategicZone && (
                  <div className="text-[11px] font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 p-1.5 rounded border border-emerald-200 dark:border-emerald-800">
                    {t('داخل منطقة: ', 'Dans : ', 'En: ')}
                    {customZoneMatch.zoneName} ({customZoneMatch.distance.toFixed(1)} {t('كم', 'km', 'km')})
                  </div>
                )}

                <div className="pt-1 flex items-center justify-between text-[10px] text-muted-foreground font-mono">
                  <span>
                    {new Date(latest.recorded_at || latest.timestamp || '').toLocaleTimeString(
                      locale === 'ar' ? 'ar-MA' : 'fr-FR'
                    )}
                  </span>
                  <Button
                    size="sm"
                    variant={isSelected ? 'default' : 'outline'}
                    className="h-6 text-[10px] px-2 rounded-md"
                    onClick={() => onSelectTruck?.(truck)}
                  >
                    <Eye className={`w-3 h-3 ${dir === 'rtl' ? 'ml-1' : 'mr-1'}`} />
                    {isSelected
                      ? t('مسار الرحلة نشط', 'Tracé actif', 'Trazado activo')
                      : t('تتبع المسار', 'Suivre tracé', 'Seguir ruta')}
                  </Button>
                </div>
              </div>
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}

export default TrackingMap;
