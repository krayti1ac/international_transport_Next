/**
 * Trans Bodanon TMS — Driver Photos & Avatar Utility
 * Provides photo retrieval, local caching, presets gallery, and image compression.
 */

// Curated high-quality, professional portraits for transport drivers
export const PRESET_DRIVER_AVATARS = [
  {
    id: 'driver-1',
    label: 'كابتن أحمد (شاحنات ثقيلة)',
    url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=240&auto=format&fit=crop&q=80',
  },
  {
    id: 'driver-2',
    label: 'كابتن رشيد (نقل دولي)',
    url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=240&auto=format&fit=crop&q=80',
  },
  {
    id: 'driver-3',
    label: 'كابتن يوسف (مقطورات مبردة)',
    url: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=240&auto=format&fit=crop&q=80',
  },
  {
    id: 'driver-4',
    label: 'كابتن عمر (مسارات أوروبية)',
    url: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=240&auto=format&fit=crop&q=80',
  },
  {
    id: 'driver-5',
    label: 'كابتن كريم (شحن سريع)',
    url: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=240&auto=format&fit=crop&q=80',
  },
  {
    id: 'driver-6',
    label: 'كابتن حمزة (نقل لوجستي)',
    url: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=240&auto=format&fit=crop&q=80',
  },
  {
    id: 'driver-7',
    label: 'كابتن بنعلي (سائق محترف)',
    url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=240&auto=format&fit=crop&q=80',
  },
  {
    id: 'driver-8',
    label: 'كابتن طارق (عبور مينائي)',
    url: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=240&auto=format&fit=crop&q=80',
  },
];

const LOCAL_STORAGE_KEY = 'transbodanon_driver_photos_cache';

/**
 * Get all cached driver photos from localStorage
 */
export function getDriverPhotosCache(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/**
 * Persist a driver photo to localStorage and dispatch event
 */
export function saveDriverPhotoLocal(identifier: string | number, photoUrl: string, driverName?: string): void {
  if (typeof window === 'undefined') return;
  try {
    const cache = getDriverPhotosCache();
    if (identifier) cache[`id_${identifier}`] = photoUrl;
    if (driverName) cache[`name_${driverName.trim().toLowerCase()}`] = photoUrl;
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(cache));
    window.dispatchEvent(new CustomEvent('driver-photo-updated', { detail: { identifier, photoUrl, driverName } }));
  } catch (err) {
    console.warn('Failed to cache driver photo locally:', err);
  }
}

/**
 * Resolve driver photo from available sources
 */
export function resolveDriverPhoto(driver?: { id?: number; name?: string; photo_url?: string | null } | null): string | null {
  if (!driver) return null;
  if (driver.photo_url && driver.photo_url.trim().length > 0) {
    return driver.photo_url;
  }

  // Check local cache
  if (typeof window !== 'undefined') {
    const cache = getDriverPhotosCache();
    if (driver.id && cache[`id_${driver.id}`]) {
      return cache[`id_${driver.id}`];
    }
    if (driver.name) {
      const nameKey = `name_${driver.name.trim().toLowerCase()}`;
      if (cache[nameKey]) return cache[nameKey];
    }
  }

  // Pre-seed known names if matching
  if (driver.name) {
    const lower = driver.name.toLowerCase();
    if (lower.includes('benali') || lower.includes('بنعلي')) {
      return PRESET_DRIVER_AVATARS[0].url;
    }
    if (lower.includes('alami') || lower.includes('العلمي')) {
      return PRESET_DRIVER_AVATARS[1].url;
    }
    if (lower.includes('benjelloun') || lower.includes('بنجلون')) {
      return PRESET_DRIVER_AVATARS[2].url;
    }
    if (lower.includes('tazi') || lower.includes('التازي')) {
      return PRESET_DRIVER_AVATARS[3].url;
    }
    if (lower.includes('senhaji') || lower.includes('الصنهاجي')) {
      return PRESET_DRIVER_AVATARS[4].url;
    }
    if (lower.includes('khamlichi') || lower.includes('الخمليشي')) {
      return PRESET_DRIVER_AVATARS[5].url;
    }
  }

  return null;
}

/**
 * Client-side image resize & compression to ensure quick uploads and low storage footprint
 */
export function compressImageFile(file: File, maxDimension = 320, quality = 0.85): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > height) {
          if (width > maxDimension) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          }
        } else {
          if (height > maxDimension) {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(e.target?.result as string);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
      };
      img.onerror = () => reject(new Error('Failed to load image for compression'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.readAsDataURL(file);
  });
}
