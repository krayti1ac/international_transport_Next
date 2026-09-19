export interface AdaptiveCompressionConfig {
  maxWidth: number;
  maxHeight: number;
  quality: number;
  isRoamingOrWeak: boolean;
  effectiveType?: string;
  saveData?: boolean;
}

/**
 * Inspects client network conditions (NetworkInformation API, saveData, effectiveType, downlink, rtt)
 * to automatically determine optimal image dimensions and quality:
 * - Roaming / Weak Network (Roaming/2G/3G/SaveData): quality 0.5, max dimension 800px.
 * - Fast Network / Wi-Fi / 4G: quality 0.75, max dimension 1280px.
 */
export function getAdaptiveCompressionSettings(): AdaptiveCompressionConfig {
  if (typeof navigator === 'undefined') {
    return {
      maxWidth: 1280,
      maxHeight: 1280,
      quality: 0.75,
      isRoamingOrWeak: false,
    };
  }

  const nav = navigator as unknown as {
    connection?: {
      saveData?: boolean;
      effectiveType?: 'slow-2g' | '2g' | '3g' | '4g' | string;
      type?: string;
      downlink?: number;
      rtt?: number;
    };
    mozConnection?: {
      saveData?: boolean;
      effectiveType?: string;
      type?: string;
      downlink?: number;
      rtt?: number;
    };
    webkitConnection?: {
      saveData?: boolean;
      effectiveType?: string;
      type?: string;
      downlink?: number;
      rtt?: number;
    };
  };

  const connection = nav.connection || nav.mozConnection || nav.webkitConnection;
  const saveData = Boolean(connection?.saveData);
  const effectiveType = connection?.effectiveType;
  const downlink = connection?.downlink;
  const rtt = connection?.rtt;

  // Roaming & Weak Network Detection:
  // 1. Data Saver mode enabled
  // 2. Slow connection type: slow-2g, 2g, 3g
  // 3. Low throughput (< 1.5 Mbps) or high latency (> 600 ms)
  const isWeakType = effectiveType === 'slow-2g' || effectiveType === '2g' || effectiveType === '3g';
  const isSlowDownlink = typeof downlink === 'number' && downlink > 0 && downlink < 1.5;
  const isHighLatency = typeof rtt === 'number' && rtt > 600;

  const isRoamingOrWeak = saveData || isWeakType || isSlowDownlink || isHighLatency;

  if (isRoamingOrWeak) {
    return {
      maxWidth: 800,
      maxHeight: 800,
      quality: 0.5,
      isRoamingOrWeak: true,
      effectiveType,
      saveData,
    };
  }

  return {
    maxWidth: 1280,
    maxHeight: 1280,
    quality: 0.75,
    isRoamingOrWeak: false,
    effectiveType,
    saveData,
  };
}

/**
 * Compresses an image File using an adaptive compression profile or specific overrides.
 */
export async function compressImage(
  file: File,
  maxWidth?: number,
  maxHeight?: number,
  quality?: number
): Promise<File> {
  const adaptive = getAdaptiveCompressionSettings();
  const targetMaxWidth = maxWidth ?? adaptive.maxWidth;
  const targetMaxHeight = maxHeight ?? adaptive.maxHeight;
  const targetQuality = quality ?? adaptive.quality;

  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      return resolve(file);
    }

    if (typeof window === 'undefined' || typeof document === 'undefined' || typeof Image === 'undefined') {
      return resolve(file);
    }

    const img = new Image();
    const reader = new FileReader();

    reader.onload = (e) => {
      img.src = e.target?.result as string;
    };

    img.onload = () => {
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > targetMaxWidth) {
          height = Math.round((height * targetMaxWidth) / width);
          width = targetMaxWidth;
        }
      } else {
        if (height > targetMaxHeight) {
          width = Math.round((width * targetMaxHeight) / height);
          height = targetMaxHeight;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        return resolve(file);
      }

      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            return resolve(file);
          }
          const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, '.jpg'), {
            type: 'image/jpeg',
            lastModified: Date.now(),
          });
          resolve(compressedFile);
        },
        'image/jpeg',
        targetQuality
      );
    };

    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}

/**
 * Compresses an image and converts it directly to a Base64 data URL for easy offline storage.
 */
export async function compressImageToBase64(
  file: File,
  maxWidth?: number,
  maxHeight?: number,
  quality?: number
): Promise<string> {
  const compressed = await compressImage(file, maxWidth, maxHeight, quality);
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(compressed);
  });
}
