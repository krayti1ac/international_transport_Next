'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useLanguage } from '@/components/language-provider';
import { Button } from '@/components/ui/button';
import {
  PlusCircle,
  FilePlus2,
  Wallet,
  Fuel,
  FileCheck2,
  Sparkles,
} from 'lucide-react';
import { QuickCashExpenseModal } from './QuickCashExpenseModal';

interface QuickDataEntryBarProps {
  onRefresh?: () => void;
  currency?: string;
}

export function QuickDataEntryBar({ onRefresh, currency = 'MAD' }: QuickDataEntryBarProps) {
  const { t, dir } = useLanguage();
  const [showExpenseModal, setShowExpenseModal] = useState(false);

  return (
    <>
      <div className="bg-card border border-border/80 p-4 rounded-2xl shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-xs font-bold font-amiri text-foreground uppercase tracking-wider">
                {t('مركز إدخال البيانات السريع', 'Centre de Saisie Rapide')}
              </h2>
              <p className="text-[11px] text-muted-foreground">
                {t('إنشاء العمليات والمستندات اليومية بنقرة واحدة', 'Création immédiate des opérations et pièces')}
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5">
          {/* 1. New Trip Order */}
          <Button
            asChild
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs rounded-xl h-11 shadow-xs transition-all justify-start px-3.5"
          >
            <Link href="/trips">
              <PlusCircle className={`w-4 h-4 shrink-0 ${dir === 'rtl' ? 'ms-1.5' : 'me-1.5'}`} />
              <div className="truncate text-start">
                <span className="block font-bold">{t('تسجيل رحلة جديدة', 'Nouveau trajet')}</span>
                <span className="text-[10px] font-normal opacity-80 block">CMR & تعيين</span>
              </div>
            </Link>
          </Button>

          {/* 2. New Invoice */}
          <Button
            asChild
            variant="outline"
            className="border-border bg-card hover:bg-muted text-foreground text-xs rounded-xl h-11 transition-all justify-start px-3.5"
          >
            <Link href="/invoices">
              <FilePlus2 className={`w-4 h-4 text-indigo-500 shrink-0 ${dir === 'rtl' ? 'ms-1.5' : 'me-1.5'}`} />
              <div className="truncate text-start">
                <span className="block font-bold">{t('إصدار فاتورة', 'Créer facture')}</span>
                <span className="text-[10px] font-normal text-muted-foreground block">HT / TTC & FIFO</span>
              </div>
            </Link>
          </Button>

          {/* 3. Secretary Cash Expense */}
          <Button
            type="button"
            variant="outline"
            onClick={() => setShowExpenseModal(true)}
            className="border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10 text-amber-700 dark:text-amber-300 text-xs rounded-xl h-11 transition-all justify-start px-3.5"
          >
            <Wallet className={`w-4 h-4 text-amber-500 shrink-0 ${dir === 'rtl' ? 'ms-1.5' : 'me-1.5'}`} />
            <div className="truncate text-start">
              <span className="block font-bold">{t('صرف من الصندوق', 'Dépense caisse')}</span>
              <span className="text-[10px] font-normal text-amber-600/80 dark:text-amber-400/80 block">
                {t('مصروف نثري فوري', 'Frais immédiat')}
              </span>
            </div>
          </Button>

          {/* 4. Fuel Receipt OCR */}
          <Button
            asChild
            variant="outline"
            className="border-border bg-card hover:bg-muted text-foreground text-xs rounded-xl h-11 transition-all justify-start px-3.5"
          >
            <Link href="/fuel-receipt">
              <Fuel className={`w-4 h-4 text-emerald-500 shrink-0 ${dir === 'rtl' ? 'ms-1.5' : 'me-1.5'}`} />
              <div className="truncate text-start">
                <span className="block font-bold">{t('إيصال وقود', 'Ticket carburant')}</span>
                <span className="text-[10px] font-normal text-muted-foreground block">مسح بالذكاء الاصطناعي</span>
              </div>
            </Link>
          </Button>

          {/* 5. Document Upload */}
          <Button
            asChild
            variant="outline"
            className="border-border bg-card hover:bg-muted text-foreground text-xs rounded-xl h-11 transition-all justify-start px-3.5 col-span-2 sm:col-span-1"
          >
            <Link href="/documents">
              <FileCheck2 className={`w-4 h-4 text-blue-500 shrink-0 ${dir === 'rtl' ? 'ms-1.5' : 'me-1.5'}`} />
              <div className="truncate text-start">
                <span className="block font-bold">{t('رفع وثيقة أسطول', 'Ajouter document')}</span>
                <span className="text-[10px] font-normal text-muted-foreground block">تأمين / فحص تقني</span>
              </div>
            </Link>
          </Button>
        </div>
      </div>

      <QuickCashExpenseModal
        isOpen={showExpenseModal}
        onClose={() => {
          setShowExpenseModal(false);
          onRefresh?.();
        }}
        currency={currency}
      />
    </>
  );
}
