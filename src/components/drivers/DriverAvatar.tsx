'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { User } from 'lucide-react';
import { resolveDriverPhoto } from '@/lib/driver-photos';

export interface DriverAvatarProps {
  name?: string | null;
  photoUrl?: string | null;
  driverId?: number | null;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  status?: string;
  showStatusDot?: boolean;
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
}

const SIZE_MAP = {
  xs: { box: 'w-7 h-7 rounded-lg text-[10px]', icon: 'w-3.5 h-3.5', dot: 'w-2 h-2 -bottom-0.5 -right-0.5' },
  sm: { box: 'w-8 h-8 rounded-xl text-xs', icon: 'w-4 h-4', dot: 'w-2 h-2 -bottom-0.5 -right-0.5' },
  md: { box: 'w-10 h-10 rounded-xl text-sm', icon: 'w-5 h-5', dot: 'w-2.5 h-2.5 -bottom-0.5 -right-0.5' },
  lg: { box: 'w-12 h-12 rounded-2xl text-base', icon: 'w-6 h-6', dot: 'w-3 h-3 -bottom-0.5 -right-0.5' },
  xl: { box: 'w-14 h-14 rounded-2xl text-lg', icon: 'w-7 h-7', dot: 'w-3.5 h-3.5 -bottom-0.5 -right-0.5' },
  '2xl': { box: 'w-20 h-20 rounded-3xl text-2xl', icon: 'w-10 h-10', dot: 'w-4 h-4 -bottom-1 -right-1' },
};

const PALETTES = [
  'from-blue-600 to-indigo-700 text-white',
  'from-emerald-600 to-teal-700 text-white',
  'from-amber-500 to-orange-600 text-white',
  'from-purple-600 to-violet-700 text-white',
  'from-cyan-600 to-blue-700 text-white',
  'from-rose-600 to-pink-700 text-white',
  'from-teal-600 to-emerald-700 text-white',
  'from-slate-700 to-slate-900 text-white',
];

function getInitials(name?: string | null): string {
  if (!name || !name.trim()) return '';
  const clean = name.replace(/\([^)]*\)/g, '').trim(); // Remove text in parentheses
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function getPalette(name?: string | null): string {
  if (!name) return PALETTES[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % PALETTES.length;
  return PALETTES[index];
}

export function DriverAvatar({
  name,
  photoUrl,
  driverId,
  size = 'md',
  status,
  showStatusDot = false,
  className = '',
  onClick,
}: DriverAvatarProps) {
  const [imgError, setImgError] = useState(false);
  const [liveUrl, setLiveUrl] = useState<string | null>(photoUrl || null);

  // Sync with props or local cache
  useEffect(() => {
    const resolved = resolveDriverPhoto({ id: driverId || undefined, name: name || undefined, photo_url: photoUrl });
    setLiveUrl(resolved);
    setImgError(false);
  }, [photoUrl, name, driverId]);

  // Listen for live update events
  useEffect(() => {
    const handleUpdate = (e: any) => {
      const detail = e.detail;
      if (
        (driverId && detail?.identifier === driverId) ||
        (name && detail?.driverName && detail.driverName.toLowerCase() === name.toLowerCase())
      ) {
        setLiveUrl(detail.photoUrl);
        setImgError(false);
      }
    };
    window.addEventListener('driver-photo-updated', handleUpdate);
    return () => window.removeEventListener('driver-photo-updated', handleUpdate);
  }, [driverId, name]);

  const sizeCfg = SIZE_MAP[size] || SIZE_MAP.md;
  const initials = useMemo(() => getInitials(name), [name]);
  const palette = useMemo(() => getPalette(name), [name]);

  const statusDotColor = useMemo(() => {
    switch (status) {
      case 'active':
        return 'bg-emerald-500 ring-emerald-300 dark:ring-emerald-950';
      case 'in_trip':
        return 'bg-blue-500 ring-blue-300 dark:ring-blue-950';
      case 'vacation':
        return 'bg-purple-500 ring-purple-300 dark:ring-purple-950';
      case 'inactive':
        return 'bg-rose-500 ring-rose-300 dark:ring-rose-950';
      default:
        return 'bg-slate-400 ring-slate-200 dark:ring-slate-800';
    }
  }, [status]);

  const hasValidPhoto = Boolean(liveUrl && !imgError);

  return (
    <div
      onClick={onClick}
      className={`relative shrink-0 select-none ${sizeCfg.box} ${className} ${
        onClick ? 'cursor-pointer hover:opacity-90 transition-opacity' : ''
      }`}
      title={name || undefined}
    >
      {hasValidPhoto ? (
        <img
          src={liveUrl!}
          alt={name || 'Driver'}
          onError={() => setImgError(true)}
          className={`w-full h-full object-cover shadow-2xs border border-border/60 ${sizeCfg.box}`}
          loading="lazy"
        />
      ) : (
        <div
          className={`w-full h-full flex items-center justify-center font-bold tracking-wider shadow-2xs bg-gradient-to-br border border-white/10 ${palette} ${sizeCfg.box}`}
        >
          {initials ? (
            <span className="leading-none drop-shadow-xs">{initials}</span>
          ) : (
            <User className={sizeCfg.icon} />
          )}
        </div>
      )}

      {/* Optional Status Dot */}
      {showStatusDot && status && (
        <span
          className={`absolute ${sizeCfg.dot} rounded-full ring-2 shadow-xs ${statusDotColor}`}
        />
      )}
    </div>
  );
}
