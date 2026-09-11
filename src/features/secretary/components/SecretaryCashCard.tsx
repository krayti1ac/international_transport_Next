'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Decimal from 'decimal.js';
import { useLanguage } from '@/components/language-provider';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Wallet,
  ArrowDownRight,
  ArrowUpRight,
  Plus,
  ArrowRight,
  Coins,
  Receipt,
  RotateCw,
} from 'lucide-react';
import { useSecretaryCash } from '../services/secretary.queries';
import { QuickCashExpenseModal } from './QuickCashExpenseModal';

export function SecretaryCashCard() {
  const { t, dir, locale } = useLanguage();
  const { data, isLoading, refetch, isRefetching } = useSecretaryCash();
  const [showModal, setShowModal] = useState(false);

  const balance = data?.balance || '0.00';
  const currency = data?.currency || 'MAD';
  const recentTxs = data?.recentTransactions || [];

  const balanceDec = new Decimal(balance);
  const isNegative = balanceDec.isNegative();

  return (
    <>
      <Card className="rounded-2xl border border-border/80 bg-card shadow-xs overflow-hidden flex flex-col justify-between">
        <div>
          {/* Header */}
          <CardHeader className="p-4 pb-3 flex flex-row items-center justify-between border-b border-border/60 bg-muted/20">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                <Wallet className="w-4 h-4" />
              </div>
              <div>
                <CardTitle className="text-sm font-bold font-amiri text-foreground flex items-center gap-2">
                  {t('صندوق السكرتيرة (نقدية المكتب)', 'Caisse Secrétaire / Dépenses Bureau')}
                  <Badge variant="outline" className="text-[10px] font-mono border-amber-500/30 text-amber-600 dark:text-amber-400">
                    {currency}
                  </Badge>
                </CardTitle>
                <p className="text-[11px] text-muted-foreground">
                  {t('الرصيد النقدي الفعلي المتاح للمصاريف اليومية والعهد', 'Solde disponible pour les dépenses immédiates')}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => refetch()}
                disabled={isRefetching}
                title={t('تحديث الرصيد', 'Actualiser')}
                className="h-8 w-8 rounded-xl text-muted-foreground hover:text-foreground"
              >
                <RotateCw className={`w-3.5 h-3.5 ${isRefetching ? 'animate-spin' : ''}`} />
              </Button>
              <Button
                size="sm"
                onClick={() => setShowModal(true)}
                className="h-8 px-3 text-xs rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold"
              >
                <Plus className={`w-3.5 h-3.5 ${dir === 'rtl' ? 'ms-1' : 'me-1'}`} />
                {t('تسجيل مصروف', 'Nouvelle dépense')}
              </Button>
            </div>
          </CardHeader>

          {/* Balance Display */}
          <CardContent className="p-4 space-y-4">
            <div className="bg-muted/30 border border-border/70 p-4 rounded-xl flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">
                  {t('الرصيد الصافي المتاح بالصندوق', 'Solde disponible')}
                </span>
                <div
                  className={`text-2xl sm:text-3xl font-extrabold font-mono flex items-baseline gap-1.5 mt-1 ${
                    isNegative ? 'text-rose-600 dark:text-rose-400' : 'text-foreground'
                  }`}
                  dir="ltr"
                >
                  {isLoading ? (
                    '...'
                  ) : (
                    <>
                      <span>{balanceDec.toFixed(2)}</span>
                      <span className="text-xs font-normal text-muted-foreground">{currency}</span>
                    </>
                  )}
                </div>
              </div>

              <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-600 dark:text-amber-400">
                <Coins className="w-5 h-5" />
              </div>
            </div>

            {/* Recent Cash Movements */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold font-amiri text-foreground flex items-center gap-1.5">
                  <Receipt className="w-3.5 h-3.5 text-muted-foreground" />
                  {t('آخر الحركات المسجلة بالصندوق', 'Derniers mouvements')}
                </span>
                <Link
                  href="/treasury"
                  className="text-[11px] text-primary hover:underline font-medium flex items-center gap-1"
                >
                  <span>{t('عرض سجل الخزينة', 'Détails')}</span>
                  <ArrowRight className={`w-3 h-3 ${dir === 'rtl' ? 'rotate-180' : ''}`} />
                </Link>
              </div>

              {isLoading ? (
                <div className="py-4 text-center text-xs text-muted-foreground">
                  {t('جاري تحميل الحركات...', 'Chargement...')}
                </div>
              ) : recentTxs.length === 0 ? (
                <div className="py-4 text-center text-xs text-muted-foreground border border-dashed border-border rounded-xl bg-muted/10">
                  {t('لا توجد حركات مسجلة مؤخراً في الصندوق', 'Aucun mouvement récent')}
                </div>
              ) : (
                <div className="space-y-2">
                  {recentTxs.slice(0, 4).map((tx) => {
                    const isWithdrawal = [
                      'owner_withdrawal',
                      'office_expense',
                      'salary',
                      'trip_expense',
                      'expense',
                      'withdrawal',
                    ].includes(tx.type);
                    const txAmountDec = new Decimal(tx.amount || 0);

                    return (
                      <div
                        key={tx.id}
                        className="flex items-center justify-between p-2.5 rounded-xl border border-border/60 bg-card hover:bg-muted/30 transition-colors text-xs"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${
                              isWithdrawal
                                ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                                : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                            }`}
                          >
                            {isWithdrawal ? (
                              <ArrowDownRight className="w-3.5 h-3.5" />
                            ) : (
                              <ArrowUpRight className="w-3.5 h-3.5" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-foreground truncate">
                              {tx.description || t('معاملة نقدية', 'Opération caisse')}
                            </p>
                            <span className="text-[10px] text-muted-foreground block font-mono">
                              {tx.created_at ? new Date(tx.created_at).toLocaleDateString(locale === 'ar' ? 'ar-MA' : 'fr-FR') : ''}
                            </span>
                          </div>
                        </div>

                        <div className="text-end font-mono font-bold shrink-0 ps-2" dir="ltr">
                          <span className={isWithdrawal ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}>
                            {isWithdrawal ? '-' : '+'} {txAmountDec.toFixed(2)} {currency}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </CardContent>
        </div>
      </Card>

      <QuickCashExpenseModal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          refetch();
        }}
        currency={currency}
      />
    </>
  );
}

