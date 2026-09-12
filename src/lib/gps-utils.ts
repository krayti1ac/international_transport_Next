/**
 * Utility functions for parsing, validating, and generating Google Maps GPS links
 * received from clients via WhatsApp, SMS, or direct links.
 */

/**
 * Extracts coordinates from Google Maps URLs or coordinate strings.
 * Supports:
 * - @lat,lng (e.g. /@35.7721,-5.7999,15z)
 * - q=lat,lng or query=lat,lng
 * - destination=lat,lng
 * - ll=lat,lng
 * - Raw "35.7721, -5.7999"
 */
export function extractCoordinatesFromInput(input?: string | null): { latitude?: number; longitude?: number } {
  if (!input || !input.trim()) return {};
  const str = input.trim();

  // Pattern 1: Raw numbers "35.7721, -5.7999" or "35.7721,-5.7999"
  const rawPair = str.match(/^(-?\d{1,3}(?:\.\d+)?)[,\s]+(-?\d{1,3}(?:\.\d+)?)$/);
  if (rawPair) {
    const lat = parseFloat(rawPair[1]);
    const lng = parseFloat(rawPair[2]);
    if (isValidLatLng(lat, lng)) return { latitude: lat, longitude: lng };
  }

  // Pattern 2: @lat,lng
  const atMatch = str.match(/@(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/);
  if (atMatch) {
    const lat = parseFloat(atMatch[1]);
    const lng = parseFloat(atMatch[2]);
    if (isValidLatLng(lat, lng)) return { latitude: lat, longitude: lng };
  }

  // Pattern 3: q=lat,lng or query=lat,lng or destination=lat,lng or ll=lat,lng
  const paramMatch = str.match(/[?&](?:q|query|destination|ll)=(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/);
  if (paramMatch) {
    const lat = parseFloat(paramMatch[1]);
    const lng = parseFloat(paramMatch[2]);
    if (isValidLatLng(lat, lng)) return { latitude: lat, longitude: lng };
  }

  return {};
}

export function isValidLatLng(lat: number, lng: number): boolean {
  return !isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

/**
 * Normalizes user input (Google Maps short link, full link, or coordinates)
 * into a clean, clickable Google Maps link.
 */
export function normalizeGoogleMapsUrl(input?: string | null): string {
  if (!input || !input.trim()) return '';
  const str = input.trim();

  // Already a web link
  if (str.startsWith('http://') || str.startsWith('https://')) {
    return str;
  }

  // Raw coordinates
  const coords = extractCoordinatesFromInput(str);
  if (coords.latitude !== undefined && coords.longitude !== undefined) {
    return `https://www.google.com/maps?q=${coords.latitude},${coords.longitude}`;
  }

  // Fallback: search query on Google Maps
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(str)}`;
}

/**
 * Generates a Google Maps URL from latitude and longitude if available.
 */
export function coordsToGoogleMapsUrl(lat?: number | null, lng?: number | null): string {
  if (lat !== undefined && lat !== null && lng !== undefined && lng !== null) {
    return `https://www.google.com/maps?q=${lat},${lng}`;
  }
  return '';
}

/**
 * Returns a human-friendly short display label for a Google Maps URL.
 */
export function formatGpsDisplay(url?: string | null): string {
  if (!url || !url.trim()) return '';
  const trimmed = url.trim();
  
  if (trimmed.includes('maps.app.goo.gl/')) {
    const parts = trimmed.split('maps.app.goo.gl/');
    return `maps.app.goo.gl/${parts[1] || ''}`;
  }
  
  if (trimmed.includes('goo.gl/maps/')) {
    const parts = trimmed.split('goo.gl/maps/');
    return `goo.gl/maps/${parts[1] || ''}`;
  }

  const coords = extractCoordinatesFromInput(trimmed);
  if (coords.latitude !== undefined && coords.longitude !== undefined) {
    return `${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}`;
  }

  if (trimmed.length > 35) {
    return `${trimmed.slice(0, 32)}...`;
  }

  return trimmed;
}

