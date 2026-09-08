'use client';

import { useState } from 'react';
import Decimal from 'decimal.js';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ArrowRightLeft, RefreshCw, Copy, Check, Coins } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/components/language-provider';

interface ForexConverterWidgetProps {
  currentRate: number;
  onRefreshRate?: () => void;
  isLoading?: boolean;
}

export function ForexConverterWidget({
  currentRate,
  onRefreshRate,
  isLoading,
}: ForexConverterWidgetProps) {
  const { t, dir } = useLanguage();
  const { toast } = useToast();
  const [amount, setAmount] = useState('1000');
  const [direction, setDirection] = useState<'EUR_TO_MAD' | 'MAD_TO_EUR'>('EUR_TO_MAD');
  const [copied, setCopied] = useState(false);

  const calculateConversion = () => {
    const val = new Decimal(parseFloat(amount) || 0);
    const rate = new Decimal(currentRate || 10.85);

    if (direction === 'EUR_TO_MAD') {
      return val.times(rate).toFixed(2);
    } else {
      return val.div(rate).toFixed(2);
    }
  };

  const convertedValue = calculateConversion();

  const toggleDirection = () => {
    setDirection((prev) => (prev === 'EUR_TO_MAD' ? 'MAD_TO_EUR' : 'EUR_TO_MAD'));
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(convertedValue);
    setCopied(true);
    toast({ title: t('تم نسخ المبلغ المحول', 'Montant converti copié') });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card className="border-border bg-card shadow-xs" dir={dir}>
      <CardHeader className="border-b border-border/70 py-3.5 px-4 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-bold font-amiri flex items-center gap-2">
          <Coins className="w-4 h-4 text-primary" />
          <span>{t('محول العملات المباشر (EUR ↔ MAD)', 'Convertisseur de Devises Direct (EUR ↔ MAD)')}</span>
        </CardTitle>
        {onRefreshRate && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onRefreshRate}
            disabled={isLoading}
            className="h-7 w-7 p-0 rounded-lg"
            title={t('تحديث سعر الصرف', 'Actualiser le taux')}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        )}
      </CardHeader>

      <CardContent className="p-4 space-y-4">
        <div className="flex items-center justify-between text-xs bg-muted/40 p-2.5 rounded-xl border border-border/50">
          <span className="text-muted-foreground">{t('سعر الصرف المعتمد:', 'Taux de change appliqué :')}</span>
          <span className="font-mono font-bold text-foreground" dir="ltr">
            1 EUR = {currentRate.toFixed(4)} MAD
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 items-center">
          <div className="sm:col-span-2 space-y-1">
            <label className="text-xs text-muted-foreground">
              {direction === 'EUR_TO_MAD' ? t('المبلغ باليورو (€)', 'Montant en Euros (€)') : t('المبلغ بالدرهم (MAD)', 'Montant en Dirhams (MAD)')}
            </label>
            <Input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="font-mono text-base font-bold rounded-xl"
              dir="ltr"
            />
          </div>

          <div className="flex justify-center pt-5 sm:pt-0">
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={toggleDirection}
              className="rounded-full w-9 h-9"
              title={t('عكس اتجاه التحويل', 'Inverser le sens de conversion')}
            >
              <ArrowRightLeft className="w-4 h-4 text-primary" />
            </Button>
          </div>

          <div className="sm:col-span-2 space-y-1">
            <label className="text-xs text-muted-foreground">
              {direction === 'EUR_TO_MAD' ? t('الناتج بالدرهم (MAD)', 'Résultat en Dirhams (MAD)') : t('الناتج باليورو (€)', 'Résultat en Euros (€)')}
            </label>
            <div className="flex items-center gap-1.5">
              <Input
                value={convertedValue}
                readOnly
                className="font-mono text-base font-bold bg-muted/50 rounded-xl"
                dir="ltr"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleCopy}
                className="h-10 w-10 p-0 rounded-xl shrink-0"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
