'use client';

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { CreditCard, CheckCircle2, Clock, Ban } from 'lucide-react';
import type { PaymentGateway, PaymentLinkStatus } from '../types/payment-gateway.types';
import { useLanguage } from '@/components/language-provider';

interface PaymentLinkBadgeProps {
  status: PaymentLinkStatus;
  gateway?: PaymentGateway;
  className?: string;
}

export function PaymentLinkBadge({ status, gateway, className = '' }: PaymentLinkBadgeProps) {
  const { locale } = useLanguage();
  const language = locale;

  const getStatusConfig = () => {
    switch (status) {
      case 'paid':
        return {
          icon: CheckCircle2,
          color: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800',
          labelAr: 'تم السداد رقمياً',
          labelFr: 'Payé en ligne',
          labelEs: 'Pagado en línea',
        };
      case 'active':
        return {
          icon: Clock,
          color: 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-300 dark:border-blue-800',
          labelAr: 'رابط دفع مفعّل',
          labelFr: 'Lien actif',
          labelEs: 'Enlace activo',
        };
      case 'expired':
        return {
          icon: Ban,
          color: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-800',
          labelAr: 'منتهي الصلاحية',
          labelFr: 'Expiré',
          labelEs: 'Expirado',
        };
      case 'cancelled':
        return {
          icon: Ban,
          color: 'bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-300 dark:border-rose-800',
          labelAr: 'ملغي',
          labelFr: 'Annulé',
          labelEs: 'Cancelado',
        };
      default:
        return {
          icon: CreditCard,
          color: 'bg-muted text-muted-foreground border-border',
          labelAr: 'غير محدد',
          labelFr: 'Non défini',
          labelEs: 'Indefinido',
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;
  const label =
    language === 'es' ? config.labelEs : language === 'fr' ? config.labelFr : config.labelAr;

  const gatewayBadgeText = gateway
    ? gateway === 'stripe'
      ? 'Stripe'
      : gateway === 'cmi'
        ? 'CMI'
        : gateway === 'bank_transfer'
          ? 'RIB'
          : 'Multi'
    : null;

  return (
    <div className={`inline-flex items-center gap-1.5 ${className}`}>
      <Badge
        variant="outline"
        className={`inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-semibold rounded-full border shadow-2xs ${config.color}`}
      >
        <Icon className="w-3.5 h-3.5 shrink-0" />
        <span>{label}</span>
      </Badge>
      {gatewayBadgeText && (
        <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-muted/80 text-muted-foreground border border-border">
          {gatewayBadgeText}
        </span>
      )}
    </div>
  );
}
