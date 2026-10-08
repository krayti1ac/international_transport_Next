'use client';

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { ShieldCheck, ShieldAlert, Clock } from 'lucide-react';
import { useLanguage } from '@/components/language-provider';
import type { DgiComplianceStatus } from '../types/einvoice.types';

interface DgiComplianceBadgeProps {
  status?: DgiComplianceStatus | string;
  className?: string;
  showIcon?: boolean;
}

export function DgiComplianceBadge({
  status = 'compliant',
  className = '',
  showIcon = true,
}: DgiComplianceBadgeProps) {
  const { t } = useLanguage();

  if (status === 'compliant') {
    return (
      <Badge
        variant="outline"
        className={`bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800 font-semibold gap-1 text-[11px] px-2 py-0.5 ${className}`}
      >
        {showIcon && <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />}
        <span>{t('DGI معتمد ومختوم', 'DGI Conforme & Scellé', 'DGI Certificado & Sellado')}</span>
      </Badge>
    );
  }

  if (status === 'tampered') {
    return (
      <Badge
        variant="destructive"
        className={`bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800 font-bold gap-1 text-[11px] px-2 py-0.5 animate-pulse ${className}`}
      >
        {showIcon && <ShieldAlert className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 shrink-0" />}
        <span>{t('إنذار: تلاعب بالبيانات', 'Alerte: Altération Détectée', 'Alerta: Alteración Detectada')}</span>
      </Badge>
    );
  }

  return (
    <Badge
      variant="outline"
      className={`bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800 font-medium gap-1 text-[11px] px-2 py-0.5 ${className}`}
    >
      {showIcon && <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />}
      <span>{t('قيد الختم الضريبي', 'En attente de scellé DGI', 'Pendiente de sellado DGI')}</span>
    </Badge>
  );
}

