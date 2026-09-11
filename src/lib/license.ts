const DEVICE_ID_KEY = 'app_device_id';

export function getOrCreateDeviceId(): string {
  if (typeof window === 'undefined') {
    return 'dev_server_' + Math.random().toString(36).slice(2, 10);
  }

  try {
    let deviceId = localStorage.getItem(DEVICE_ID_KEY);
    if (!deviceId) {
      deviceId = 'dev_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now().toString(36);
      localStorage.setItem(DEVICE_ID_KEY, deviceId);
    }
    return deviceId;
  } catch {
    return 'dev_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now().toString(36);
  }
}

export function generateLicenseNumber(companyId: number, deviceId: string): string {
  const idPart = String(companyId);
  const devPart = deviceId.slice(-4).toUpperCase();
  return `TB-${idPart}-${devPart}`;
}

export function getDeviceTypeLabel(type: string): string {
  switch (type) {
    case 'mobile':
      return 'MOB';
    case 'tablet':
      return 'TAB';
    default:
      return 'PC';
  }
}
