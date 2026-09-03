import React from 'react';

export interface MatriculeParts {
  number: string;
  letter: string;
  region?: string;
  prefix?: string;
  model?: string;
  isFormatted: boolean;
  raw: string;
}

/**
 * Parses Moroccan and international license plate formats safely
 */
export function parseMatricule(rawPlate?: string | null): MatriculeParts | null {
  if (!rawPlate || !rawPlate.trim()) return null;

  let raw = rawPlate.trim();
  let model: string | undefined;

  // Check if plate has (Model) suffix attached (e.g. "24134-A-5 (Volvo FH)")
  const modelMatch = raw.match(/^(.*?)\s*\((.*?)\)$/);
  if (modelMatch && modelMatch[1].trim()) {
    raw = modelMatch[1].trim();
    model = modelMatch[2].trim();
  }

  // Pattern 1: Standard Moroccan Plate (e.g. 24134-A-5, 24134-أ-5, 24134|A|5, 24134 / A / 5)
  const standardMoroccan = raw.match(/^(\d{1,6})\s*[-/| ]\s*([\u0600-\u06FFa-zA-Z]{1,3})\s*[-/| ]\s*(\d{1,3})$/);
  if (standardMoroccan) {
    return {
      number: standardMoroccan[1],
      letter: standardMoroccan[2],
      region: standardMoroccan[3],
      model,
      isFormatted: true,
      raw,
    };
  }

  // Pattern 2: Moroccan Trailer format with prefix (e.g. R-12345-A, R-12345-5, REM-1234-A)
  const trailerPrefix = raw.match(/^([rR]|REM|rem|م|مقطورة)\s*[-/| ]\s*(\d{1,6})\s*[-/| ]\s*([\u0600-\u06FFa-zA-Z0-9]{1,3})$/);
  if (trailerPrefix) {
    return {
      prefix: trailerPrefix[1].toUpperCase(),
      number: trailerPrefix[2],
      letter: trailerPrefix[3],
      model,
      isFormatted: true,
      raw,
    };
  }

  // Pattern 3: 2-Part Moroccan format (e.g. 24134-A, 24134-أ, 24134-WW)
  const twoPartMoroccan = raw.match(/^(\d{1,6})\s*[-/| ]\s*([\u0600-\u06FFa-zA-Z]{1,4})$/);
  if (twoPartMoroccan) {
    return {
      number: twoPartMoroccan[1],
      letter: twoPartMoroccan[2],
      model,
      isFormatted: true,
      raw,
    };
  }

  return {
    number: raw,
    letter: '',
    model,
    isFormatted: false,
    raw,
  };
}

/**
 * Formats a matricule string into clean unified format e.g. "24134 | A | 5" or returns raw string
 */
export function formatMatricule(rawPlate?: string | null, separator = ' | '): string {
  const parts = parseMatricule(rawPlate);
  if (!parts) return '—';
  if (!parts.isFormatted) return parts.raw;

  if (parts.prefix) {
    return `${parts.prefix}${separator}${parts.number}${separator}${parts.letter}`;
  }
  if (parts.region) {
    return `${parts.number}${separator}${parts.letter}${separator}${parts.region}`;
  }
  return `${parts.number}${separator}${parts.letter}`;
}

export interface MatriculeBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  plate?: string | null;
  variant?: 'badge' | 'inline' | 'header' | 'print' | 'subtle';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  placeholder?: string;
  showIcon?: boolean;
}

export function MatriculeBadge({
  plate,
  variant = 'badge',
  size = 'md',
  placeholder = '—',
  className = '',
  ...props
}: MatriculeBadgeProps) {
  const parsed = parseMatricule(plate);

  if (!parsed) {
    return (
      <span
        dir="ltr"
        className={`font-mono text-muted-foreground ${className}`}
        style={{ unicodeBidi: 'isolate' }}
        {...props}
      >
        {placeholder}
      </span>
    );
  }

  // Inline Variant: Plain LTR monospace text without outer box
  if (variant === 'inline') {
    const sizeClasses = {
      xs: 'text-[11px]',
      sm: 'text-xs',
      md: 'text-sm',
      lg: 'text-base font-bold',
    }[size];

    return (
      <bdi
        dir="ltr"
        className={`font-mono font-semibold text-foreground tracking-wider inline-block ${sizeClasses} ${className}`}
        style={{ unicodeBidi: 'isolate' }}
        {...props}
      >
        {formatMatricule(parsed.raw, ' - ')}
      </bdi>
    );
  }

  // Print Variant: High contrast monochrome plate style with sharp borders
  if (variant === 'print') {
    return (
      <bdi
        dir="ltr"
        className={`inline-flex items-center gap-1.5 px-2 py-0.5 border border-slate-900 bg-white text-slate-950 font-mono font-bold rounded text-xs tracking-wider ${className}`}
        style={{ unicodeBidi: 'isolate' }}
        {...props}
      >
        {parsed.isFormatted ? (
          <>
            {parsed.prefix && (
              <>
                <span className="font-extrabold text-[10px] text-slate-700">{parsed.prefix}</span>
                <span className="text-slate-400">|</span>
              </>
            )}
            <span className="font-bold">{parsed.number}</span>
            <span className="text-slate-400">|</span>
            <span className="font-bold px-0.5">{parsed.letter}</span>
            {parsed.region && (
              <>
                <span className="text-slate-400">|</span>
                <span className="font-bold">{parsed.region}</span>
              </>
            )}
          </>
        ) : (
          <span>{parsed.raw}</span>
        )}
      </bdi>
    );
  }

  // Sizing for Badge & Header & Subtle
  const sizeStyles = {
    xs: {
      container: 'text-[10px] px-1.5 py-0.5 gap-1 rounded-md',
      divider: 'h-2.5',
      letter: 'px-0.5 text-[9px]',
    },
    sm: {
      container: 'text-[11px] px-2 py-0.5 gap-1 rounded-md',
      divider: 'h-3',
      letter: 'px-0.5 text-[10px]',
    },
    md: {
      container: 'text-xs px-2.5 py-1 gap-1.5 rounded-lg',
      divider: 'h-3.5',
      letter: 'px-1 text-[11px]',
    },
    lg: {
      container: 'text-sm md:text-base px-3 py-1.5 gap-2 rounded-xl',
      divider: 'h-4',
      letter: 'px-1.5 text-xs md:text-sm',
    },
  }[size];

  const variantStyles = {
    badge: 'bg-slate-900/5 dark:bg-slate-100/10 text-slate-900 dark:text-slate-100 border border-slate-300/80 dark:border-slate-700/80 shadow-2xs font-semibold',
    header: 'bg-gradient-to-r from-slate-900/10 via-slate-900/5 to-slate-900/10 dark:from-slate-100/15 dark:via-slate-100/10 dark:to-slate-100/15 text-foreground border border-border shadow-xs font-bold',
    subtle: 'bg-muted/50 text-foreground border border-border/50 font-medium',
  }[variant === 'header' ? 'header' : variant === 'subtle' ? 'subtle' : 'badge'];

  return (
    <bdi
      dir="ltr"
      className={`inline-flex items-center font-mono tracking-wider select-all transition-colors ${sizeStyles.container} ${variantStyles} ${className}`}
      style={{ unicodeBidi: 'isolate' }}
      title={`رقم اللوحة: ${parsed.raw}`}
      {...props}
    >
      {parsed.isFormatted ? (
        <>
          {parsed.prefix && (
            <>
              <span className="font-extrabold text-primary dark:text-primary/90">{parsed.prefix}</span>
              <span className={`w-px bg-border/80 dark:bg-slate-700 ${sizeStyles.divider}`} />
            </>
          )}
          <span className="font-bold tracking-tight">{parsed.number}</span>
          <span className={`w-px bg-border/80 dark:bg-slate-700 ${sizeStyles.divider}`} />
          <span className={`font-black text-primary dark:text-blue-400 bg-primary/10 dark:bg-blue-400/10 rounded ${sizeStyles.letter}`}>
            {parsed.letter}
          </span>
          {parsed.region && (
            <>
              <span className={`w-px bg-border/80 dark:bg-slate-700 ${sizeStyles.divider}`} />
              <span className="font-bold text-muted-foreground dark:text-slate-300">{parsed.region}</span>
            </>
          )}
        </>
      ) : (
        <span className="font-bold">{parsed.raw}</span>
      )}
    </bdi>
  );
}

export default MatriculeBadge;
