export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Haversine formula to compute great-circle distance between two GPS coordinates in kilometers
 */
export function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  return calculateDistance(lat1, lon1, lat2, lon2);
}

/**
 * Compute initial bearing between two coordinates in radians
 */
export function calculateBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const phi1 = toRad(lat1);
  const phi2 = toRad(lat2);
  const deltaLambda = toRad(lon2 - lon1);

  const y = Math.sin(deltaLambda) * Math.cos(phi2);
  const x =
    Math.cos(phi1) * Math.sin(phi2) -
    Math.cos(phi1) * Math.sin(phi2) * Math.cos(deltaLambda);

  return Math.atan2(y, x);
}

/**
 * Compute Cross-track distance (perpendicular offset from route corridor in km)
 * Formula: dxt = asin(sin(d13) * sin(theta13 - theta12)) * R
 */
export function calculateCrossTrackDistance(
  pLat: number,
  pLon: number,
  startLat: number,
  startLon: number,
  destLat: number,
  destLon: number
): number {
  const earthRadiusKm = 6371;
  const d13 = calculateHaversineDistance(startLat, startLon, pLat, pLon) / earthRadiusKm;
  const theta13 = calculateBearing(startLat, startLon, pLat, pLon);
  const theta12 = calculateBearing(startLat, startLon, destLat, destLon);

  const dXtRad = Math.asin(Math.sin(d13) * Math.sin(theta13 - theta12));
  return Math.abs(dXtRad * earthRadiusKm);
}

export interface ZoneMatch {
  zoneId: number;
  zoneName: string;
  distance: number;
}

export function findMatchingZone(lat: number, lon: number, zones: Array<{ id: number; name: string; latitude: number; longitude: number; radius_km: number }>) {
  let matched: ZoneMatch | null = null;

  for (const zone of zones) {
    const distance = calculateDistance(lat, lon, zone.latitude, zone.longitude);
    if (distance <= zone.radius_km) {
      if (!matched || distance < matched.distance) {
        matched = { zoneId: zone.id, zoneName: zone.name, distance };
      }
    }
  }

  return matched;
}
