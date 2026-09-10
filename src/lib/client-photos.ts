/**
 * Trans Bodanon TMS — Client Logos & Photos Utility
 * Provides logo retrieval, caching, presets gallery, and compression for transport clients.
 */

export const PRESET_CLIENT_LOGOS = [
  {
    id: 'client-agro',
    label: 'صادرات زراعية وفواكه (Agri-Export & Fruits)',
    url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=240&auto=format&fit=crop&q=80',
  },
  {
    id: 'client-berry',
    label: 'توت وفواكه طازجة (Berry & Fresh Produce)',
    url: 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=240&auto=format&fit=crop&q=80',
  },
  {
    id: 'client-frigo',
    label: 'سلسلة التبريد والشحن المبرد (Cold Chain & Frigo)',
    url: 'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?w=240&auto=format&fit=crop&q=80',
  },
  {
    id: 'client-transit',
    label: 'عبور جمركي ووكالة شحن (Transit & Forwarding)',
    url: 'https://images.unsplash.com/photo-1557683316-973673baf926?w=240&auto=format&fit=crop&q=80',
  },
  {
    id: 'client-pasta',
    label: 'صناعات غذائية ومكرونة (Agro-Alimentaire & Pasta)',
    url: 'https://images.unsplash.com/photo-1557682250-33bd709cbe85?w=240&auto=format&fit=crop&q=80',
  },
  {
    id: 'client-trading',
    label: 'تجارة دولية وتوزيع (Global Trading & Commerce)',
    url: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=240&auto=format&fit=crop&q=80',
  },
  {
    id: 'client-logistics',
    label: 'لوجستيك وتوزيع قاري (Logistics & Distribution)',
    url: 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=240&auto=format&fit=crop&q=80',
  },
  {
    id: 'client-corp',
    label: 'مجموعة تجارية واستيراد (Corporate Import/Export)',
    url: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=240&auto=format&fit=crop&q=80',
  },
];

const LOCAL_STORAGE_KEY = 'transbodanon_client_logos_cache';

export function getClientPhotosCache(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveClientPhotoLocal(identifier: string | number, logoUrl: string, clientName?: string): void {
  if (typeof window === 'undefined') return;
  try {
    const cache = getClientPhotosCache();
    if (identifier) cache[`id_${identifier}`] = logoUrl;
    if (clientName) cache[`name_${clientName.trim().toLowerCase()}`] = logoUrl;
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(cache));
    window.dispatchEvent(new CustomEvent('client-logo-updated', { detail: { identifier, logoUrl, clientName } }));
  } catch (err) {
    console.warn('Failed to cache client logo locally:', err);
  }
}

export function resolveClientLogo(client?: { id?: number; name?: string | null; logo_url?: string | null } | null): string | null {
  if (!client) return null;
  if (client.logo_url && client.logo_url.trim().length > 0) {
    return client.logo_url;
  }

  // Check local storage cache
  if (typeof window !== 'undefined') {
    const cache = getClientPhotosCache();
    if (client.id && cache[`id_${client.id}`]) {
      return cache[`id_${client.id}`];
    }
    if (client.name) {
      const nameKey = `name_${client.name.trim().toLowerCase()}`;
      if (cache[nameKey]) return cache[nameKey];
    }
  }

  // Deterministic preset matching for existing clients
  const nameLower = (client.name || '').toLowerCase();

  if (nameLower.includes('aajja') || nameLower.includes('aicha')) {
    return PRESET_CLIENT_LOGOS[0].url;
  }
  if (nameLower.includes('agrispa')) {
    return PRESET_CLIENT_LOGOS[1].url;
  }
  if (nameLower.includes('alma') || nameLower.includes('transitaires')) {
    return PRESET_CLIENT_LOGOS[3].url;
  }
  if (nameLower.includes('assoufi') || nameLower.includes('pasta')) {
    return PRESET_CLIENT_LOGOS[4].url;
  }
  if (nameLower.includes('berkane') || nameLower.includes('trading')) {
    return PRESET_CLIENT_LOGOS[5].url;
  }
  if (nameLower.includes('agri-export') || nameLower.includes('agri')) {
    return PRESET_CLIENT_LOGOS[0].url;
  }
  if (nameLower.includes('berry')) {
    return PRESET_CLIENT_LOGOS[1].url;
  }
  if (nameLower.includes('frigo')) {
    return PRESET_CLIENT_LOGOS[2].url;
  }
  if (nameLower.includes('primeurs') || nameLower.includes('euro')) {
    return PRESET_CLIENT_LOGOS[6].url;
  }
  if (nameLower.includes('client01')) {
    return PRESET_CLIENT_LOGOS[7].url;
  }

  return null;
}
