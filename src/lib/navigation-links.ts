import { extractCoordinatesFromInput } from './gps-utils';

export interface NavigationTarget {
  latitude?: number | null;
  longitude?: number | null;
  gpsUrl?: string | null;
  addressOrCity?: string | null;
  label?: string;
}

export function buildGoogleMapsNavigationUrl(target: NavigationTarget): string {
  if (target.gpsUrl && (target.gpsUrl.startsWith('http://') || target.gpsUrl.startsWith('https://'))) {
    return target.gpsUrl;
  }
  if (target.latitude && target.longitude) {
    return `https://www.google.com/maps/dir/?api=1&destination=${target.latitude},${target.longitude}&travelmode=driving`;
  }
  if (target.addressOrCity) {
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(target.addressOrCity)}&travelmode=driving`;
  }
  return 'https://maps.google.com';
}

export function buildWazeNavigationUrl(target: NavigationTarget): string {
  const coords = target.latitude && target.longitude
    ? { latitude: target.latitude, longitude: target.longitude }
    : extractCoordinatesFromInput(target.gpsUrl);

  if (coords.latitude && coords.longitude) {
    return `https://waze.com/ul?ll=${coords.latitude},${coords.longitude}&navigate=yes`;
  }
  if (target.addressOrCity) {
    return `https://waze.com/ul?q=${encodeURIComponent(target.addressOrCity)}&navigate=yes`;
  }
  return 'https://waze.com';
}

export function buildAppleMapsNavigationUrl(target: NavigationTarget): string {
  const coords = target.latitude && target.longitude
    ? { latitude: target.latitude, longitude: target.longitude }
    : extractCoordinatesFromInput(target.gpsUrl);

  if (coords.latitude && coords.longitude) {
    return `maps://?daddr=${coords.latitude},${coords.longitude}&dirflg=d`;
  }
  if (target.addressOrCity) {
    return `maps://?daddr=${encodeURIComponent(target.addressOrCity)}&dirflg=d`;
  }
  if (target.gpsUrl && (target.gpsUrl.startsWith('http://') || target.gpsUrl.startsWith('https://'))) {
    return target.gpsUrl;
  }
  return 'maps://';
}

