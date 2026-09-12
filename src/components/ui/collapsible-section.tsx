'use client';

import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';

export interface CollapsibleSectionProps {
  title: string;
  subtitle?: string;
  description?: string;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  isOpen?: boolean;
  onToggle?: () => void;
  defaultOpen?: boolean;
  variant?: 'default' | 'emerald' | 'blue' | 'amber' | 'purple' | 'slate' | 'rose';
  children: React.ReactNode;
  className?: string;
  headerClassName?: string;
  contentClassName?: string;
}

const variantStyles: Record<
  NonNullable<CollapsibleSectionProps['variant']>,
  {
    container: string;
    header: string;
    headerOpen: string;
    iconBg: string;
    titleColor: string;
  }
> = {
  default: {
    container: 'border-border bg-card/60',
    header: 'hover:bg-muted/40 text-foreground',
    headerOpen: 'bg-muted/30 border-b border-border/70',
    iconBg: 'bg-muted text-foreground',
    titleColor: 'text-foreground',
  },
  emerald: {
    container: 'border-emerald-500/25 bg-emerald-500/[0.02] dark:bg-emerald-950/[0.08]',
    header: 'hover:bg-emerald-500/10 text-foreground',
    headerOpen: 'bg-emerald-500/[0.08] border-b border-emerald-500/20',
    iconBg: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
    titleColor: 'text-emerald-950 dark:text-emerald-200',
  },
  blue: {
    container: 'border-blue-500/25 bg-blue-500/[0.02] dark:bg-blue-950/[0.08]',
    header: 'hover:bg-blue-500/10 text-foreground',
    headerOpen: 'bg-blue-500/[0.08] border-b border-blue-500/20',
    iconBg: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
    titleColor: 'text-blue-950 dark:text-blue-200',
  },
  amber: {
    container: 'border-amber-500/25 bg-amber-500/[0.02] dark:bg-amber-950/[0.08]',
    header: 'hover:bg-amber-500/10 text-foreground',
    headerOpen: 'bg-amber-500/[0.08] border-b border-amber-500/20',
    iconBg: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
    titleColor: 'text-amber-950 dark:text-amber-200',
  },
  purple: {
    container: 'border-purple-500/25 bg-purple-500/[0.02] dark:bg-purple-950/[0.08]',
    header: 'hover:bg-purple-500/10 text-foreground',
    headerOpen: 'bg-purple-500/[0.08] border-b border-purple-500/20',
    iconBg: 'bg-purple-500/15 text-purple-600 dark:text-purple-400',
    titleColor: 'text-purple-950 dark:text-purple-200',
  },
  slate: {
    container: 'border-slate-500/25 bg-slate-500/[0.02] dark:bg-slate-900/[0.15]',
    header: 'hover:bg-slate-500/10 text-foreground',
    headerOpen: 'bg-slate-500/[0.08] border-b border-slate-500/20',
    iconBg: 'bg-slate-500/15 text-slate-700 dark:text-slate-300',
    titleColor: 'text-slate-900 dark:text-slate-200',
  },
  rose: {
    container: 'border-rose-500/25 bg-rose-500/[0.02] dark:bg-rose-950/[0.08]',
    header: 'hover:bg-rose-500/10 text-foreground',
    headerOpen: 'bg-rose-500/[0.08] border-b border-rose-500/20',
    iconBg: 'bg-rose-500/15 text-rose-600 dark:text-rose-400',
    titleColor: 'text-rose-950 dark:text-rose-200',
  },
};

export function CollapsibleSection({
  title,
  subtitle,
  description,
  icon,
  badge,
  isOpen: controlledIsOpen,
  onToggle: controlledOnToggle,
  defaultOpen = false,
  variant = 'default',
  children,
  className = '',
  headerClassName = '',
  contentClassName = '',
}: CollapsibleSectionProps) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const isControlled = controlledIsOpen !== undefined;
  const open = isControlled ? controlledIsOpen : internalOpen;

  const handleToggle = () => {
    if (isControlled) {
      controlledOnToggle?.();
    } else {
      setInternalOpen((prev) => !prev);
    }
  };

  const style = variantStyles[variant] || variantStyles.default;
  const subText = subtitle || description;

  return (
    <div
      className={`rounded-xl border transition-all duration-200 overflow-hidden shadow-2xs ${style.container} ${className}`}
    >
      <button
        type="button"
        onClick={handleToggle}
        className={`w-full flex items-center justify-between p-3.5 text-start transition-colors cursor-pointer select-none ${
          style.header
        } ${open ? style.headerOpen : ''} ${headerClassName}`}
        aria-expanded={open}
      >
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          {icon && (
            <div
              className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-transform ${style.iconBg}`}
            >
              {icon}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-xs md:text-sm font-bold ${style.titleColor}`}>
                {title}
              </span>
              {badge && (
                <div className="shrink-0 animate-in fade-in duration-150">
                  {badge}
                </div>
              )}
            </div>
            {subText && (
              <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                {subText}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 ps-2 shrink-0">
          <span
            className={`p-1 rounded-md text-muted-foreground transition-transform duration-200 ${
              open ? 'rotate-180 bg-muted/60 text-foreground' : 'rotate-0'
            }`}
          >
            <ChevronDown className="w-4 h-4" />
          </span>
        </div>
      </button>

      {open && (
        <div
          className={`p-3.5 space-y-3 animate-in fade-in-50 slide-in-from-top-1 duration-200 ${contentClassName}`}
        >
          {children}
        </div>
      )}
    </div>
  );
}

