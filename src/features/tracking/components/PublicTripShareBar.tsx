'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/components/language-provider';
import {
  Copy,
  Check,
  MessageSquare,
  Globe,
} from 'lucide-react';

interface PublicTripShareBarProps {
  tripId: number;
  cmrNumber: string;
  route: string;
}

export function PublicTripShareBar({ tripId, cmrNumber, route }: PublicTripShareBarProps) {
  const { t, locale, setLocale } = useLanguage();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const getTrackingUrl = () => {
    if (typeof window !== 'undefined') {
      return window.location.href;
    }
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://transbodanon.com';
    return `${baseUrl}/track/${tripId}`;
  };

  const handleCopyLink = async () => {
    try {
      const url = getTrackingUrl();
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast({
        title: t('تم نسخ رابط التتبع', 'Lien copié', 'Link copied'),
        description: t('يمكنك الآن مشاركة الرابط مع العميل أو المستلم', 'Lien prêt à être partagé'),
      });
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast({
        title: t('تعذر النسخ', 'Échec de copie'),
        variant: 'destructive',
      });
    }
  };

  const handleShareWhatsApp = () => {
    const trackingUrl = getTrackingUrl();
    const textAr = `مرحباً،\nيمكنك تتبع مسار الشحنة الدولية مباشرة (CMR: ${cmrNumber})\nالمسار: ${route}\nرابط التتبع الحي:\n${trackingUrl}`;
    const textFr = `Bonjour,\nSuivez en direct l'acheminement de l'expédition (CMR: ${cmrNumber})\nItinéraire: ${route}\nLien de suivi direct:\n${trackingUrl}`;
    const textEs = `Hola,\nSiga en directo el envío internacional (CMR: ${cmrNumber})\nItinerario: ${route}\nEnlace de seguimiento:\n${trackingUrl}`;

    const message = locale === 'es' ? textEs : locale === 'fr' ? textFr : textAr;
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-card/80 backdrop-blur-md rounded-2xl border border-border shadow-xs">
      {/* Action Buttons */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button
          variant="outline"
          size="sm"
          onClick={handleCopyLink}
          className="rounded-xl text-xs h-8 gap-1.5 border-border"
        >
          {copied ? (
            <Check className="w-3.5 h-3.5 text-emerald-600" />
          ) : (
            <Copy className="w-3.5 h-3.5" />
          )}
          <span>{copied ? t('تم النسخ', 'Copié', 'Copied') : t('نسخ رابط التتبع', 'Copier le lien', 'Copy Link')}</span>
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={handleShareWhatsApp}
          className="rounded-xl text-xs h-8 gap-1.5 border-emerald-500/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10"
        >
          <MessageSquare className="w-3.5 h-3.5" />
          <span>{t('مشاركة عبر WhatsApp', 'Partager WhatsApp', 'Share via WhatsApp')}</span>
        </Button>
      </div>

      {/* Language Switcher */}
      <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-xl border border-border/50">
        <Globe className="w-3.5 h-3.5 text-muted-foreground ms-1.5 me-0.5" />
        <button
          type="button"
          onClick={() => setLocale('ar')}
          className={`px-2 py-0.5 rounded-lg text-xs font-semibold transition-colors ${
            locale === 'ar'
              ? 'bg-primary text-primary-foreground shadow-xs'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          العربية
        </button>
        <button
          type="button"
          onClick={() => setLocale('fr')}
          className={`px-2 py-0.5 rounded-lg text-xs font-semibold transition-colors ${
            locale === 'fr'
              ? 'bg-primary text-primary-foreground shadow-xs'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Français
        </button>
        <button
          type="button"
          onClick={() => setLocale('es')}
          className={`px-2 py-0.5 rounded-lg text-xs font-semibold transition-colors ${
            locale === 'es'
              ? 'bg-primary text-primary-foreground shadow-xs'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Español
        </button>
      </div>
    </div>
  );
}

