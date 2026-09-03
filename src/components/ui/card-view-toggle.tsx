'use client';

import { useState, useEffect } from 'react';
import { LayoutGrid, LayoutList } from 'lucide-react';

export type CardViewMode = 'grid' | 'list';

interface CardViewToggleProps {
  viewMode: CardViewMode;
  onChange: (mode: CardViewMode) => void;
  className?: string;
  gridLabel?: string;
  listLabel?: string;
  size?: 'sm' | 'default';
  showLabels?: boolean;
}

export function CardViewToggle({
  viewMode,
  onChange,
  className = '',
  gridLabel = 'عرض البطاقات (شبكة)',
  listLabel = 'عرض القائمة ببطاقات',
  size = 'default',
  showLabels = true,
}: CardViewToggleProps) {
  return (
    <div
      role="group"
      aria-label="نمط عرض البطاقات"
      className={`inline-flex items-center rounded-xl bg-muted/60 p-1 border border-border/70 shadow-2xs ${className}`}
    >
      <button
        type="button"
        onClick={() => onChange('grid')}
        aria-pressed={viewMode === 'grid'}
        title="عرض البطاقات (Grid Cards / Card View)"
        className={`flex items-center gap-1.5 rounded-lg font-semibold transition-all select-none ${
          size === 'sm' ? 'px-2 py-1 text-[11px]' : 'px-2.5 py-1.5 text-xs'
        } ${
          viewMode === 'grid'
            ? 'bg-background text-foreground shadow-xs font-bold'
            : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        <LayoutGrid className="w-3.5 h-3.5" />
        {showLabels && <span className="hidden sm:inline">{gridLabel}</span>}
      </button>

      <button
        type="button"
        onClick={() => onChange('list')}
        aria-pressed={viewMode === 'list'}
        title="عرض القائمة ببطاقات (List View Cards)"
        className={`flex items-center gap-1.5 rounded-lg font-semibold transition-all select-none ${
          size === 'sm' ? 'px-2 py-1 text-[11px]' : 'px-2.5 py-1.5 text-xs'
        } ${
          viewMode === 'list'
            ? 'bg-background text-foreground shadow-xs font-bold'
            : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        <LayoutList className="w-3.5 h-3.5" />
        {showLabels && <span className="hidden sm:inline">{listLabel}</span>}
      </button>
    </div>
  );
}

/**
 * Hook to persist the user's view mode preference in localStorage
 */
export function useCardViewMode(storageKey: string, defaultMode: CardViewMode = 'grid') {
  const [viewMode, setViewMode] = useState<CardViewMode>(defaultMode);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(`view_mode_${storageKey}`);
      if (saved === 'grid' || saved === 'list') {
        setViewMode(saved as CardViewMode);
      }
    } catch {
      // Ignore localStorage errors in restricted environments
    }
  }, [storageKey]);

  const updateViewMode = (mode: CardViewMode) => {
    setViewMode(mode);
    try {
      localStorage.setItem(`view_mode_${storageKey}`, mode);
    } catch {
      // Ignore
    }
  };

  return [viewMode, updateViewMode] as const;
}

