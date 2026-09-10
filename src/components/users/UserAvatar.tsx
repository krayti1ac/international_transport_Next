'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { User as UserIcon } from 'lucide-react';
import { resolveUserPhoto } from '@/lib/user-photos';

export interface UserAvatarProps {
  name?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
  userId?: string | null;
  role?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  shape?: 'circle' | 'rounded';
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
}

const SIZE_MAP = {
  xs: { box: 'w-6 h-6 text-[10px]', icon: 'w-3 h-3' },
  sm: { box: 'w-8 h-8 text-xs', icon: 'w-4 h-4' },
  md: { box: 'w-10 h-10 text-sm', icon: 'w-5 h-5' },
  lg: { box: 'w-12 h-12 text-base', icon: 'w-6 h-6' },
  xl: { box: 'w-16 h-16 text-xl', icon: 'w-8 h-8' },
  '2xl': { box: 'w-20 h-20 text-2xl', icon: 'w-10 h-10' },
};

const PALETTES = [
  'from-blue-600 to-indigo-700 text-white',
  'from-emerald-600 to-teal-700 text-white',
  'from-amber-500 to-orange-600 text-white',
  'from-purple-600 to-violet-700 text-white',
  'from-cyan-600 to-blue-700 text-white',
  'from-rose-600 to-pink-700 text-white',
  'from-teal-600 to-emerald-700 text-white',
  'from-indigo-600 to-slate-900 text-white',
];

function getInitials(name?: string | null, email?: string | null): string {
  const str = name?.trim() || email?.split('@')[0]?.trim() || '';
  if (!str) return 'U';
  const clean = str.replace(/\([^)]*\)/g, '').trim();
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'U';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function getPalette(name?: string | null, email?: string | null): string {
  const str = name || email || 'user';
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % PALETTES.length;
  return PALETTES[index];
}

export function UserAvatar({
  name,
  email,
  avatarUrl,
  userId,
  role,
  size = 'md',
  shape = 'circle',
  className = '',
  onClick,
}: UserAvatarProps) {
  const [imgError, setImgError] = useState(false);
  const [liveUrl, setLiveUrl] = useState<string | null>(avatarUrl || null);

  useEffect(() => {
    const resolved = resolveUserPhoto({ id: userId || undefined, name, email, avatar_url: avatarUrl });
    setLiveUrl(resolved);
    setImgError(false);
  }, [avatarUrl, name, email, userId]);

  useEffect(() => {
    const handleUpdate = (e: any) => {
      const detail = e.detail;
      if (
        (userId && detail?.identifier === userId) ||
        (name && detail?.userName && detail.userName.toLowerCase() === name.toLowerCase()) ||
        (email && detail?.userEmail && detail.userEmail.toLowerCase() === email.toLowerCase())
      ) {
        setLiveUrl(detail.photoUrl);
        setImgError(false);
      }
    };
    window.addEventListener('user-photo-updated', handleUpdate);
    return () => window.removeEventListener('user-photo-updated', handleUpdate);
  }, [userId, name, email]);

  const sizeCfg = SIZE_MAP[size] || SIZE_MAP.md;
  const shapeClass = shape === 'circle' ? 'rounded-full' : 'rounded-2xl';
  const initials = useMemo(() => getInitials(name, email), [name, email]);
  const palette = useMemo(() => getPalette(name, email), [name, email]);

  const hasValidPhoto = Boolean(liveUrl && !imgError);

  return (
    <div
      onClick={onClick}
      className={`relative shrink-0 select-none overflow-hidden ${shapeClass} ${sizeCfg.box} ${className} ${
        onClick ? 'cursor-pointer hover:opacity-90 transition-opacity' : ''
      }`}
      title={name || email || undefined}
    >
      {hasValidPhoto ? (
        <img
          src={liveUrl!}
          alt={name || 'User'}
          onError={() => setImgError(true)}
          className={`w-full h-full object-cover shadow-2xs border border-border/60 ${shapeClass}`}
          loading="lazy"
        />
      ) : (
        <div
          className={`w-full h-full flex items-center justify-center font-bold tracking-wider shadow-2xs bg-gradient-to-br border border-white/10 ${palette} ${shapeClass}`}
        >
          {initials ? (
            <span className="leading-none drop-shadow-xs">{initials}</span>
          ) : (
            <UserIcon className={sizeCfg.icon} />
          )}
        </div>
      )}
    </div>
  );
}
