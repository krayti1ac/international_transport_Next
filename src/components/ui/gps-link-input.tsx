'use client';

import React from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { MapPin, ExternalLink, Clipboard, Check, Trash2 } from 'lucide-react';
import { normalizeGoogleMapsUrl } from '@/lib/gps-utils';
import { useLanguage } from '@/components/language-provider';

interface GpsLinkInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  description?: string;
  required?: boolean;
  className?: string;
  id?: string;
}

export function GpsLinkInput({
  label,
  value,
  onChange,
  placeholder,
  description,
  required = false,
  className = '',
  id,
}: GpsLinkInputProps) {
  const { t, dir } = useLanguage();
  const [copied, setCopied] = React.useState(false);

  const normalizedUrl = normalizeGoogleMapsUrl(value);
  const hasValidLink = Boolean(normalizedUrl && (normalizedUrl.startsWith('http://') || normalizedUrl.startsWith('https://')));

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        onChange(text.trim());
      }
    } catch {
      // Clipboard access might be denied in some browsers
    }
  };

  const handleOpenMap = () => {
    if (hasValidLink) {
      window.open(normalizedUrl, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div className={`space-y-1.5 ${className}`}>
      <div className="flex items-center justify-between">
        <label htmlFor={id} className="text-sm font-medium text-foreground flex items-center gap-1.5">
          <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
          <span>{label}</span>
          {required && <span className="text-destructive">*</span>}
        </label>
        {hasValidLink && (
          <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
            <Check className="w-3 h-3" />
            {t('رابط GPS جاهز', 'Lien GPS valide')}
          </span>
        )}
      </div>

      <div className="flex gap-2 items-center">
        <div className="relative flex-1">
          <Input
            id={id}
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder || 'https://maps.app.goo.gl/...'}
            dir="ltr"
            className="text-xs font-mono pr-8 bg-card"
            required={required}
          />
          {value && (
            <button
              type="button"
              onClick={() => onChange('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5 rounded"
              title={t('مسح', 'Effacer')}
            >
              <Trash2 className="w-3 h-3 text-muted-foreground hover:text-destructive" />
            </button>
          )}
        </div>

        {/* Action Button: Open Google Maps */}
        {hasValidLink ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleOpenMap}
            className="h-9 px-2.5 text-xs rounded-lg gap-1.5 border-emerald-500/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/10 shrink-0"
            title={t('فتح وتجربة الموقع في خرائط Google', 'Ouvrir dans Google Maps')}
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t('فتح في الخريطة', 'Ouvrir')}</span>
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handlePaste}
            className="h-9 px-2.5 text-xs rounded-lg gap-1.5 text-muted-foreground hover:text-foreground shrink-0"
            title={t('لصق من الحافظة', 'Coller')}
          >
            <Clipboard className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t('لصق', 'Coller')}</span>
          </Button>
        )}
      </div>

      <p className="text-[11px] text-muted-foreground">
        {description || t(
          'الصق رابط موقع خرائط جوجل كما يرسله العميل عبر الواتساب (مثل: https://maps.app.goo.gl/...)',
          'Collez le lien Google Maps envoyé par le client sur WhatsApp (ex: https://maps.app.goo.gl/...)'
        )}
      </p>
    </div>
  );
}

