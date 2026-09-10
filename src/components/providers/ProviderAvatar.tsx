'use client';

import React, { useState, useEffect } from 'react';
import { resolveProviderPhoto, getProviderPhotoFromCache } from '@/lib/provider-photos';

interface ProviderAvatarProps {
  name?: string;
  type?: string;
  logoUrl?: string | null;
  providerId?: number | string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  shape?: 'circle' | 'rounded' | 'square';
  className?: string;
}

const SIZE_CLASSES = {
  xs: 'w-6 h-6 text-[10px]',
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-12 h-12 text-base',
  xl: 'w-16 h-16 text-xl',
  '2xl': 'w-20 h-20 text-2xl',
};

const SHAPE_CLASSES = {
  circle: 'rounded-full',
  rounded: 'rounded-xl',
  square: 'rounded-lg',
};

// Deterministic gradients based on provider name
const GRADIENTS = [
  'from-amber-600 to-orange-700 text-amber-50',
  'from-blue-600 to-indigo-800 text-blue-50',
  'from-emerald-600 to-teal-800 text-emerald-50',
  'from-red-600 to-rose-800 text-rose-50',
  'from-purple-600 to-violet-800 text-purple-50',
  'from-cyan-600 to-blue-800 text-cyan-50',
  'from-slate-700 to-zinc-900 text-slate-100',
  'from-yellow-600 to-amber-800 text-yellow-50',
];

function getGradient(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return GRADIENTS[Math.abs(hash) % GRADIENTS.length];
}

function getInitials(name: string): string {
  if (!name) return 'م';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export function ProviderAvatar({
  name = 'مزود',
  type = '',
  logoUrl,
  providerId,
  size = 'md',
  shape = 'rounded',
  className = '',
}: ProviderAvatarProps) {
  const [imageError, setImageError] = useState(false);
  const [cachedUrl, setCachedUrl] = useState<string | null>(() =>
    providerId ? getProviderPhotoFromCache(providerId) : null
  );

  useEffect(() => {
    if (providerId) {
      const cached = getProviderPhotoFromCache(providerId);
      if (cached && cached !== cachedUrl) {
        setCachedUrl(cached);
      }
    }
  }, [providerId, cachedUrl]);

  useEffect(() => {
    const handleUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<{ providerKey: string | number; photoUrl: string }>;
      if (
        customEvent.detail &&
        (String(customEvent.detail.providerKey) === String(providerId) ||
          String(customEvent.detail.providerKey).toLowerCase() === name.trim().toLowerCase())
      ) {
        setCachedUrl(customEvent.detail.photoUrl);
        setImageError(false);
      }
    };
    window.addEventListener('transbodanon_provider_photos_updated', handleUpdate);
    return () => {
      window.removeEventListener('transbodanon_provider_photos_updated', handleUpdate);
    };
  }, [providerId, name]);

  const effectiveUrl =
    cachedUrl ||
    logoUrl ||
    resolveProviderPhoto({
      id: providerId,
      name,
      type,
      logo_url: logoUrl,
    });

  const sizeClass = SIZE_CLASSES[size] || SIZE_CLASSES.md;
  const shapeClass = SHAPE_CLASSES[shape] || SHAPE_CLASSES.rounded;

  if (effectiveUrl && !imageError) {
    return (
      <div
        className={`relative inline-flex items-center justify-center shrink-0 overflow-hidden bg-card border border-border/80 shadow-xs transition-transform hover:scale-105 ${sizeClass} ${shapeClass} ${className}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={effectiveUrl}
          alt={name}
          className="w-full h-full object-cover"
          onError={() => setImageError(true)}
          loading="lazy"
        />
      </div>
    );
  }

  // Fallback monogram badge with deterministic corporate gradient
  const gradient = getGradient(name);
  const initials = getInitials(name);

  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 font-bold font-mono tracking-wider bg-linear-to-br shadow-xs border border-white/15 select-none ${gradient} ${sizeClass} ${shapeClass} ${className}`}
      title={`${name} (${type || 'ورشة ومزود'})`}
    >
      <span>{initials}</span>
    </div>
  );
}
