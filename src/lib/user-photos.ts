/**
 * Trans Bodanon TMS — User Photos & Avatar Management Utility
 * Provides photo retrieval, local caching, presets gallery, and compression for system users.
 */

// Curated high-resolution professional avatars for TMS staff, admins, and secretaries
export const PRESET_USER_AVATARS = [
  {
    id: 'user-admin-m',
    label: 'هشام / المدير العام (Executive Admin)',
    url: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=240&auto=format&fit=crop&q=80',
  },
  {
    id: 'user-sec-f',
    label: 'إيمان / السكرتارية التنفيذية (Executive Secretary)',
    url: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=240&auto=format&fit=crop&q=80',
  },
  {
    id: 'user-ops-m',
    label: 'حمزة / مسؤول العمليات واللوجستيك (Operations Manager)',
    url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=240&auto=format&fit=crop&q=80',
  },
  {
    id: 'user-mgr-m',
    label: 'مدير الأسطول والحسابات (Fleet Supervisor)',
    url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=240&auto=format&fit=crop&q=80',
  },
  {
    id: 'user-dispatch-f',
    label: 'منسقة النقل والشحن الدولي (Freight Dispatcher)',
    url: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=240&auto=format&fit=crop&q=80',
  },
  {
    id: 'user-support-m',
    label: 'مسؤول المتابعة والميناء (Port Transit Agent)',
    url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=240&auto=format&fit=crop&q=80',
  },
  {
    id: 'user-tech-m',
    label: 'المسؤول التقني والأنظمة (Technical Lead)',
    url: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=240&auto=format&fit=crop&q=80',
  },
  {
    id: 'user-admin-f',
    label: 'مديرة العمليات والشؤون الإدارية (Admin Manager)',
    url: 'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=240&auto=format&fit=crop&q=80',
  },
];

const LOCAL_STORAGE_KEY = 'transbodanon_user_photos_cache';

/**
 * Get all cached user photos from localStorage
 */
export function getUserPhotosCache(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/**
 * Persist a user photo to localStorage and dispatch event
 */
export function saveUserPhotoLocal(identifier: string | number, photoUrl: string, userName?: string, userEmail?: string): void {
  if (typeof window === 'undefined') return;
  try {
    const cache = getUserPhotosCache();
    if (identifier) cache[`id_${identifier}`] = photoUrl;
    if (userName) cache[`name_${userName.trim().toLowerCase()}`] = photoUrl;
    if (userEmail) cache[`email_${userEmail.trim().toLowerCase()}`] = photoUrl;
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(cache));
    window.dispatchEvent(new CustomEvent('user-photo-updated', { detail: { identifier, photoUrl, userName, userEmail } }));
  } catch (err) {
    console.warn('Failed to cache user photo locally:', err);
  }
}

/**
 * Resolve user photo from available sources
 */
export function resolveUserPhoto(user?: { id?: string; name?: string | null; email?: string | null; avatar_url?: string | null } | null): string | null {
  if (!user) return null;
  if (user.avatar_url && user.avatar_url.trim().length > 0) {
    return user.avatar_url;
  }

  // Check local cache
  if (typeof window !== 'undefined') {
    const cache = getUserPhotosCache();
    if (user.id && cache[`id_${user.id}`]) {
      return cache[`id_${user.id}`];
    }
    if (user.email) {
      const emailKey = `email_${user.email.trim().toLowerCase()}`;
      if (cache[emailKey]) return cache[emailKey];
    }
    if (user.name) {
      const nameKey = `name_${user.name.trim().toLowerCase()}`;
      if (cache[nameKey]) return cache[nameKey];
    }
  }

  // Pre-seed known users from the system
  const nameLower = (user.name || '').toLowerCase();
  const emailLower = (user.email || '').toLowerCase();

  // Hicham / Admin
  if (nameLower.includes('hicham') || emailLower.startsWith('admin') || emailLower.includes('hicham')) {
    return PRESET_USER_AVATARS[0].url;
  }

  // Iman Secretary
  if (nameLower.includes('iman') || emailLower.startsWith('iman') || nameLower.includes('إيمان')) {
    return PRESET_USER_AVATARS[1].url;
  }

  // Hamza
  if (nameLower.includes('hamza') || emailLower.startsWith('hamza') || nameLower.includes('حمزة')) {
    return PRESET_USER_AVATARS[2].url;
  }

  return null;
}
