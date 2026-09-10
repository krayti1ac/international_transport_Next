'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Building2 } from 'lucide-react';
import { resolveClientLogo } from '@/lib/client-photos';

export interface ClientAvatarProps {
  name?: string | null;
  logoUrl?: string | null;
  clientId?: number | null;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  shape?: 'rounded' | 'circle';
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
}

const SIZE_MAP = {
  xs: { box: 'w-6 h-6 rounded-lg text-[10px]', icon: 'w-3 h-3' },
  sm: { box: 'w-8 h-8 rounded-xl text-xs', icon: 'w-4 h-4' },
  md: { box: 'w-10 h-10 rounded-xl text-sm', icon: 'w-5 h-5' },
  lg: { box: 'w-12 h-12 rounded-xl text-base', icon: 'w-6 h-6' },
  xl: { box: 'w-16 h-16 rounded-2xl text-xl', icon: 'w-8 h-8' },
};

const CORPORATE_PALETTES = [
  'from-blue-700 to-indigo-900 text-white',
  'from-emerald-700 to-teal-950 text-white',
  'from-slate-800 to-slate-950 text-white',
  'from-amber-600 to-amber-900 text-white',
  'from-cyan-700 to-blue-950 text-white',
  'from-purple-700 to-indigo-950 text-white',
  'from-teal-700 to-emerald-950 text-white',
  'from-sky-700 to-slate-900 text-white',
];

function getMonogram(name?: string | null): string {
  if (!name || !name.trim()) return 'CL';
  const clean = name.replace(/\([^)]*\)/g, '').trim();
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'CL';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function getPalette(name?: string | null): string {
  const str = name || 'client';
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % CORPORATE_PALETTES.length;
  return CORPORATE_PALETTES[index];
}

export function ClientAvatar({
  name,
  logoUrl,
  clientId,
  size = 'md',
  shape = 'rounded',
  className = '',
  onClick,
}: ClientAvatarProps) {
  const [imgError, setImgError] = useState(false);
  const [liveUrl, setLiveUrl] = useState<string | null>(logoUrl || null);

  useEffect(() => {
    const resolved = resolveClientLogo({ id: clientId || undefined, name, logo_url: logoUrl });
    setLiveUrl(resolved);
    setImgError(false);
  }, [logoUrl, name, clientId]);

  useEffect(() => {
    const handleUpdate = (e: any) => {
      const detail = e.detail;
      if (
        (clientId && detail?.identifier === clientId) ||
        (name && detail?.clientName && detail.clientName.toLowerCase() === name.toLowerCase())
      ) {
        setLiveUrl(detail.logoUrl);
        setImgError(false);
      }
    };
    window.addEventListener('client-logo-updated', handleUpdate);
    return () => window.removeEventListener('client-logo-updated', handleUpdate);
  }, [clientId, name]);

  const sizeCfg = SIZE_MAP[size] || SIZE_MAP.md;
  const shapeClass = shape === 'circle' ? 'rounded-full' : sizeCfg.box;
  const monogram = useMemo(() => getMonogram(name), [name]);
  const palette = useMemo(() => getPalette(name), [name]);

  const hasValidPhoto = Boolean(liveUrl && !imgError);

  return (
    <div
      onClick={onClick}
      className={`relative shrink-0 select-none overflow-hidden ${sizeCfg.box} ${shapeClass} ${className} ${
        onClick ? 'cursor-pointer hover:opacity-90 transition-opacity' : ''
      }`}
      title={name || undefined}
    >
      {hasValidPhoto ? (
        <img
          src={liveUrl!}
          alt={name || 'Client Logo'}
          onError={() => setImgError(true)}
          className="w-full h-full object-cover shadow-2xs border border-border/60"
          loading="lazy"
        />
      ) : (
        <div
          className={`w-full h-full flex items-center justify-center font-extrabold tracking-wider shadow-2xs bg-gradient-to-br border border-white/10 ${palette}`}
        >
          {monogram ? (
            <span className="leading-none drop-shadow-xs font-mono">{monogram}</span>
          ) : (
            <Building2 className={sizeCfg.icon} />
          )}
        </div>
      )}
    </div>
  );
}
