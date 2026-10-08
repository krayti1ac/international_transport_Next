'use client';

import { useEffect, useMemo } from 'react';
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Circle,
  Tooltip,
  useMap,
} from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useLanguage } from '@/components/language-provider';
import {
  STRATEGIC_PORT_ZONES,
  type StrategicPortZone,
} from '@/features/tracking/services/port-geofence.constants';
import { CARGO_THERMAL_PROFILES, type TelematicsTelemetry } from '../types';
import { Button } from '@/components/ui/button';
import {
  Snowflake,
  ShieldAlert,
  PhoneCall,
  MessageSquare,
  Navigation,
  Anchor,
  Flame,
} from 'lucide-react';

delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

function MapViewController({
  selectedAsset,
}: {
  selectedAsset: TelematicsTelemetry | null;
}) {
  const map = useMap();

  useEffect(() => {
    if (!map || !selectedAsset) return;
    try {
      map.invalidateSize();
      map.flyTo([selectedAsset.latitude, selectedAsset.longitude], 12, {
        duration: 1.2,
      });
    } catch (err) {
      console.warn('Map flyTo failed:', err);
    }
  }, [map, selectedAsset]);

  return null;
}

interface MissionControlRadarMapProps {
  telemetryList: TelematicsTelemetry[];
  selectedAsset: TelematicsTelemetry | null;
  onSelectAsset: (asset: TelematicsTelemetry) => void;
  onTriggerEmergency: (asset: TelematicsTelemetry) => void;
  tileTheme?: 'dark' | 'satellite' | 'streets';
}

export function MissionControlRadarMap({
  telemetryList,
  selectedAsset,
  onSelectAsset,
  onTriggerEmergency,
  tileTheme = 'dark',
}: MissionControlRadarMapProps) {
  const { t, dir } = useLanguage();

  const tileLayerUrl = useMemo(() => {
    if (tileTheme === 'satellite') {
      return 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
    }
    if (tileTheme === 'dark') {
      return 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
    }
    return 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
  }, [tileTheme]);

  const tileAttribution = useMemo(() => {
    if (tileTheme === 'satellite') return '&copy; Esri World Imagery';
    if (tileTheme === 'dark') return '&copy; CARTO &copy; OpenStreetMap contributors';
    return '&copy; OpenStreetMap contributors';
  }, [tileTheme]);

  // Center on Gibraltar / North Africa corridor view
  const defaultCenter: [number, number] = [31.5, -7.5];
  const defaultZoom = 5;

  const createAssetMarkerIcon = (asset: TelematicsTelemetry) => {
    const isCritical = asset.tempStatus === 'critical_drift' || asset.doorBreachRisk;
    const isWarning = asset.tempStatus === 'warning';
    const isPort = asset.currentZoneId !== undefined;

    let bgClass = 'bg-emerald-500 border-emerald-300';
    let pulseClass = '';
    let iconChar = '🚛';

    if (isCritical) {
      bgClass = 'bg-rose-600 border-rose-300 animate-pulse';
      pulseClass = 'ring-4 ring-rose-500/50';
      iconChar = '🚨';
    } else if (isWarning) {
      bgClass = 'bg-amber-500 border-amber-300';
      iconChar = '❄️';
    } else if (isPort) {
      bgClass = 'bg-blue-600 border-blue-300';
      iconChar = '⚓';
    }

    const html = `
      <div class="relative flex items-center justify-center">
        <div class="w-9 h-9 rounded-full ${bgClass} ${pulseClass} border-2 text-white flex items-center justify-center shadow-lg text-sm transition-transform hover:scale-110">
          <span>${iconChar}</span>
        </div>
        <div class="absolute -bottom-5 bg-slate-900/90 text-white font-mono text-[9px] px-1.5 py-0.5 rounded shadow border border-slate-700 whitespace-nowrap">
          ${asset.truckPlate}
        </div>
      </div>
    `;

    return L.divIcon({
      className: 'custom-mission-pin',
      html,
      iconSize: [36, 36],
      iconAnchor: [18, 18],
      popupAnchor: [0, -20],
    });
  };

  return (
    <div className="relative w-full h-full min-h-[500px] rounded-2xl overflow-hidden border border-border shadow-md">
      <MapContainer
        center={defaultCenter}
        zoom={defaultZoom}
        style={{ width: '100%', height: '100%', minHeight: '520px' }}
        scrollWheelZoom={true}
      >
        <TileLayer url={tileLayerUrl} attribution={tileAttribution} />
        <MapViewController selectedAsset={selectedAsset} />

        {/* 1. Strategic Port & Border Geofence Zones */}
        {STRATEGIC_PORT_ZONES.map((zone) => {
          const isTangerOrGuerguerat =
            zone.id === 'port_tanger_med' || zone.id === 'border_guerguerat';
          const circleColor = isTangerOrGuerguerat ? '#06b6d4' : '#6366f1';

          return (
            <Circle
              key={zone.id}
              center={[zone.latitude, zone.longitude]}
              radius={zone.radiusKm * 1000}
              pathOptions={{
                color: circleColor,
                fillColor: circleColor,
                fillOpacity: 0.15,
                weight: isTangerOrGuerguerat ? 2.5 : 1.5,
                dashArray: '5, 5',
              }}
            >
              <Tooltip direction="top" opacity={0.9} permanent={false}>
                <div className="text-xs font-bold font-amiri text-center">
                  <span>{zone.name_ar}</span>
                  <div className="text-[10px] text-muted-foreground font-sans">
                    {zone.name_fr} ({zone.radiusKm} km)
                  </div>
                </div>
              </Tooltip>
            </Circle>
          );
        })}

        {/* 2. Live Fleet Telemetry Markers */}
        {telemetryList.map((asset) => (
          <Marker
            key={asset.truckId}
            position={[asset.latitude, asset.longitude]}
            icon={createAssetMarkerIcon(asset)}
            eventHandlers={{
              click: () => onSelectAsset(asset),
            }}
          >
            <Popup className="mission-control-popup" minWidth={280}>
              <div className="p-1 space-y-2.5 font-sans" dir={dir}>
                {/* Header */}
                <div className="flex items-center justify-between border-b pb-2 border-slate-200 dark:border-slate-800">
                  <div>
                    <h4 className="font-extrabold text-sm text-foreground flex items-center gap-1.5">
                      <span>{asset.truckPlate}</span>
                      <span className="text-xs font-normal text-muted-foreground font-mono">
                        ({asset.trailerPlate || 'مقطورة Frigo'})
                      </span>
                    </h4>
                    <p className="text-[11px] text-muted-foreground">
                      {asset.tripRoute || 'ممر النقل الدولي'}
                    </p>
                  </div>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      asset.tempStatus === 'critical_drift'
                        ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300 animate-pulse'
                        : asset.tempStatus === 'warning'
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-emerald-100 text-emerald-700'
                    }`}
                  >
                    {asset.tempStatus === 'critical_drift'
                      ? t('انحراف حرج 🚨', 'Dérive Critique 🚨')
                      : asset.tempStatus === 'warning'
                      ? t('تحذير تبريد ⚠️', 'Avertissement ⚠️')
                      : t('حرارة سليمة ✅', 'Conforme ✅')}
                  </span>
                </div>

                {/* Telemetry Matrix Strip */}
                <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 dark:bg-slate-900/60 p-2 rounded-lg border border-slate-100 dark:border-slate-800">
                  <div>
                    <span className="text-[10px] text-muted-foreground block">
                      {t('الحرارة الحالية', 'Temp Actuelle')}:
                    </span>
                    <span
                      className={`font-mono font-bold text-sm ${
                        asset.currentTemp > asset.targetTemp + 2
                          ? 'text-rose-600'
                          : 'text-blue-600 dark:text-blue-400'
                      }`}
                    >
                      {asset.currentTemp}°C
                    </span>
                    <span className="text-[10px] text-muted-foreground ms-1">
                      (المستهدف: {asset.targetTemp}°C)
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] text-muted-foreground block">
                      {t('حالة الباب', 'État Porte')}:
                    </span>
                    <span
                      className={`font-semibold text-xs ${
                        asset.doorBreachRisk
                          ? 'text-rose-600 font-bold animate-pulse'
                          : 'text-emerald-600'
                      }`}
                    >
                      {asset.doorOpen
                        ? asset.doorBreachRisk
                          ? t('مفتوح أثناء الحركة ⛔', 'Ouvert en Mouvement ⛔')
                          : t('مفتوح (متوقف)', 'Ouvert (Stationné)')
                        : t('محكم الإغلاق 🔒', 'Fermé Sécurisé 🔒')}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] text-muted-foreground block">
                      {t('السرعة', 'Vitesse')}:
                    </span>
                    <span className="font-mono font-semibold text-foreground">
                      {asset.speed} km/h
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] text-muted-foreground block">
                      {t('صحة المبرد SDI', 'Santé Frigo SDI')}:
                    </span>
                    <span className="font-mono font-semibold text-foreground">
                      {asset.reeferSdiScore}%
                    </span>
                  </div>
                </div>

                {/* Current Port Zone Alert */}
                {asset.currentZoneName && (
                  <div className="text-[11px] text-cyan-700 bg-cyan-50 dark:bg-cyan-950/40 p-1.5 rounded flex items-center gap-1.5 border border-cyan-200 dark:border-cyan-800 font-medium">
                    <Anchor className="w-3.5 h-3.5 shrink-0" />
                    <span>
                      {t('متواجد ضمن:', 'Dans le port:')} {asset.currentZoneName}
                    </span>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-2 pt-1">
                  {asset.driverPhone && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 h-8 text-xs gap-1.5"
                      onClick={() => window.open(`tel:${asset.driverPhone}`, '_self')}
                    >
                      <PhoneCall className="w-3.5 h-3.5 text-blue-600" />
                      {t('اتصال بالكابتن', 'Appeler')}
                    </Button>
                  )}

                  <Button
                    size="sm"
                    variant={
                      asset.tempStatus === 'critical_drift' || asset.doorBreachRisk
                        ? 'destructive'
                        : 'secondary'
                    }
                    className="flex-1 h-8 text-xs gap-1.5"
                    onClick={() => onTriggerEmergency(asset)}
                  >
                    <ShieldAlert className="w-3.5 h-3.5" />
                    {t('إنذار طوارئ', 'Alerte Urgence')}
                  </Button>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}

