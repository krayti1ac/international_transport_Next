'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { X, Building2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { BankAccount } from '@/types/database';

interface AddBankAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (newAccount: BankAccount) => void;
}

const COMMON_BANKS = [
  'Attijariwafa Bank',
  'Banque Populaire (Chaabi)',
  'Bank of Africa (BMCE)',
  'CIH Bank',
  'Société Générale Maroc',
  'BMCI (BNP Paribas)',
  'Crédit Agricole du Maroc',
  'CFG Bank',
  'Banco Santander',
  'BBVA',
  'CaixaBank',
  'BNP Paribas (France)',
];

export function AddBankAccountModal({
  isOpen,
  onClose,
  onSuccess,
}: AddBankAccountModalProps) {
  const [name, setName] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [currency, setCurrency] = useState<'MAD' | 'EUR' | 'USD'>('MAD');
  const [initialBalance, setInitialBalance] = useState('0');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast({ title: 'يرجى إدخال مسمى الحساب', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);
    try {
      const supabase = createClient();
      const payload: any = {
        name: name.trim(),
        bank_name: bankName.trim() || name.trim(),
        account_number: accountNumber.trim(),
        currency,
        account_type: 'checking',
        current_balance: parseFloat(initialBalance) || 0,
        is_active: true,
      };

      const { data, error } = await supabase
        .from('bank_accounts')
        .insert(payload)
        .select()
        .single();

      if (error) {
        throw new Error(error.message || error.details || 'فشل حفظ الحساب البنكي في قاعدة البيانات');
      }

      toast({
        title: '✅ تم إضافة الحساب البنكي بنجاح',
        description: `${name} (${currency})`,
      });

      setName('');
      setBankName('');
      setAccountNumber('');
      setInitialBalance('0');
      onSuccess?.(data as BankAccount);
      onClose();
    } catch (err: any) {
      toast({
        title: 'خطأ أثناء الإضافة',
        description: err.message || 'حدث خطأ غير متوقع',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 overflow-y-auto">
      <Card className="w-full max-w-md my-8 shadow-2xl border-border bg-card" dir="rtl">
        <CardHeader className="flex flex-row items-center justify-between border-b border-border pb-4">
          <CardTitle className="font-amiri text-lg flex items-center gap-2 text-foreground">
            <Building2 className="w-5 h-5 text-primary" />
            إضافة حساب بنكي جديد
          </CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 rounded-lg">
            <X className="w-4 h-4" />
          </Button>
        </CardHeader>
        <CardContent className="pt-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                اسم الحساب (لتمييزه في النظام) *
              </label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="مثال: الحساب التجاري الرئيسي (الدرهم) أو حساب اليورو"
                required
                className="text-xs rounded-xl"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                اسم المؤسسة البنكية
              </label>
              <Input
                list="common-banks"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                placeholder="اختر أو اكتب اسم البنك (مثل التجاري وفا بنك)"
                className="text-xs rounded-xl"
              />
              <datalist id="common-banks">
                {COMMON_BANKS.map((b) => (
                  <option key={b} value={b} />
                ))}
              </datalist>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">عملة الحساب *</label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value as any)}
                  className="w-full h-9 px-3 border border-input rounded-xl bg-card text-foreground text-xs font-mono font-bold focus:ring-1 focus:ring-primary shadow-2xs"
                >
                  <option value="MAD">MAD (درهم مغربي)</option>
                  <option value="EUR">EUR (يورو)</option>
                  <option value="USD">USD (دولار)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">الرصيد الافتتاحي</label>
                <Input
                  type="number"
                  step="0.01"
                  value={initialBalance}
                  onChange={(e) => setInitialBalance(e.target.value)}
                  placeholder="0.00"
                  dir="ltr"
                  className="text-xs rounded-xl font-mono"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                رقم الحساب / RIB / IBAN (اختياري)
              </label>
              <Input
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                placeholder="007 780 0000 123456789012 34"
                dir="ltr"
                className="text-xs rounded-xl font-mono"
              />
            </div>

            <div className="flex gap-2 pt-3 border-t border-border/40">
              <Button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-xl h-9 text-xs font-semibold shadow-xs"
              >
                {isSubmitting ? 'جاري الحفظ...' : 'إضافة الحساب'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                className="rounded-xl h-9 text-xs"
              >
                إلغاء
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
