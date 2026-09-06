export interface NavigationTarget {
  latitude?: number | null;
  longitude?: number | null;
  addressOrCity?: string | null;
  label?: string;
}

export function buildGoogleMapsNavigationUrl(target: NavigationTarget): string {
  if (target.latitude && target.longitude) {
    return `https://www.google.com/maps/dir/?api=1&destination=${target.latitude},${target.longitude}&travelmode=driving`;
  }
  if (target.addressOrCity) {
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(target.addressOrCity)}&travelmode=driving`;
  }
  return 'https://maps.google.com';
}

export function buildWazeNavigationUrl(target: NavigationTarget): string {
  if (target.latitude && target.longitude) {
    return `https://waze.com/ul?ll=${target.latitude},${target.longitude}&navigate=yes`;
  }
  if (target.addressOrCity) {
    return `https://waze.com/ul?q=${encodeURIComponent(target.addressOrCity)}&navigate=yes`;
  }
  return 'https://waze.com';
}

export function buildAppleMapsNavigationUrl(target: NavigationTarget): string {
  if (target.latitude && target.longitude) {
    return `maps://?daddr=${target.latitude},${target.longitude}&dirflg=d`;
  }
  if (target.addressOrCity) {
    return `maps://?daddr=${encodeURIComponent(target.addressOrCity)}&dirflg=d`;
  }
  return 'maps://';
}
