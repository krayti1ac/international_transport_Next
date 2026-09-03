'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { createClient } from '@/lib/supabase/client';
import { processFIFOPayment } from '@/lib/fifo-payment';
import { Calculator, CheckCircle2, Loader2, Landmark } from 'lucide-react';
import type { CashBox, BankAccount, Client } from '@/types/database';
import { DEFAULT_CASH_BOXES, DEFAULT_BANK_ACCOUNTS, fallbackArray } from '@/lib/default-data';

interface FifoPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  client: Client;
  totalDue: number;
}

export function FifoPaymentModal({ isOpen, onClose, onSuccess, client, totalDue }: FifoPaymentModalProps) {
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('bank_transfer');
  const [destinationType, setDestinationType] = useState<'bank' | 'cashbox'>('bank');
  const [destinationId, setDestinationId] = useState<string>('');
  const [reference, setReference] = useState('');

  const [loading, setLoading] = useState(false);
  const [cashBoxes, setCashBoxes] = useState<CashBox[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);

  const { toast } = useToast();
  const supabase = createClient();

  useEffect(() => {
    if (isOpen) {
      fetchDestinations();
      setAmount(totalDue > 0 ? totalDue.toString() : '');
    }
  }, [isOpen, totalDue]);

  const fetchDestinations = async () => {
    try {
      const [banksRes, cashRes] = await Promise.all([
        supabase.from('bank_accounts').select('*').eq('is_active', true),
        supabase.from('cash_boxes').select('*')
      ]);
      setBankAccounts(fallbackArray(banksRes.data, DEFAULT_BANK_ACCOUNTS));
      setCashBoxes(fallbackArray(cashRes.data, DEFAULT_CASH_BOXES));
    } catch (error) {
      console.error(error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);

    if (isNaN(numAmount) || numAmount <= 0) {
      toast({ title: 'يرجى إدخال مبلغ صحيح أكبر من الصفر', variant: 'destructive' });
      return;
    }

    if (!destinationId) {
      toast({ title: 'يرجى اختيار حساب الإيداع', variant: 'destructive' });
      return;
    }

    setLoading(true);

    try {
      const result = await processFIFOPayment(supabase, {
        clientId: client.id,
        amount: numAmount,
        currency: client.currency || 'MAD',
        paymentMethod,
        bankAccountId: destinationType === 'bank' ? parseInt(destinationId) : undefined,
        cashBoxId: destinationType === 'cashbox' ? parseInt(destinationId) : undefined,
        reference,
        notes: `دفعة محصلة بنظام FIFO من العميل: ${client.name}`,
      });

      if (!result.success) throw new Error(result.error);

      toast({
        title: 'تم توزيع الدفعة بنجاح (FIFO)',
        description: `تم تغطية ${result.affectedInvoicesCount} فاتورة بمبلغ ${result.totalAllocated.toFixed(2)} ${client.currency}`,
      });

      onSuccess();
      onClose();
    } catch (error: any) {
      toast({
        title: 'خطأ أثناء المعالجة',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md" dir="rtl">
        <DialogHeader>
          <div className="flex items-center gap-2 text-emerald-600 font-bold text-xs uppercase tracking-wide mb-1">
            <Calculator className="w-4 h-4" />
            <span>نظام التوزيع التلقائي للمدفوعات (FIFO)</span>
          </div>
          <DialogTitle className="font-amiri text-xl">
            استلام دفعة من {client.name}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground mt-1">
            إجمالي الديون المعلقة: <span className="font-bold text-rose-500">{totalDue.toLocaleString()} {client.currency}</span>
            <br/>
            سيقوم النظام بتسديد الفواتير الأقدم تلقائياً بناءً على المبلغ المدخل.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold">المبلغ المستلم ({client.currency})</label>
            <Input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              required
              dir="ltr"
              className="font-mono text-lg h-12"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold">طريقة الدفع</label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bank_transfer">تحويل بنكي</SelectItem>
                  <SelectItem value="check">شيك</SelectItem>
                  <SelectItem value="cash">نقداً</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold">وجهة الإيداع</label>
              <Select value={destinationType} onValueChange={(val: 'bank'|'cashbox') => { setDestinationType(val); setDestinationId(''); }}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bank">حساب بنكي</SelectItem>
                  <SelectItem value="cashbox">صندوق نقدي</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Landmark className="w-3.5 h-3.5 text-blue-500" />
              اختر {destinationType === 'bank' ? 'الحساب البنكي' : 'الصندوق'}
            </label>
            <Select value={destinationId} onValueChange={setDestinationId}>
              <SelectTrigger className="rounded-xl">
                <SelectValue placeholder="-- اضغط للاختيار --" />
              </SelectTrigger>
              <SelectContent>
                {destinationType === 'bank' ? (
                  bankAccounts.map((b) => (
                    <SelectItem key={b.id} value={b.id.toString()}>{b.name} ({b.currency})</SelectItem>
                  ))
                ) : (
                  cashBoxes.map((c) => (
                    <SelectItem key={c.id} value={c.id.toString()}>{c.name} ({c.currency})</SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold">رقم المرجع / الشيك (اختياري)</label>
            <Input
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Ref: VIR-1029..."
              className="font-mono text-sm"
            />
          </div>

          <div className="flex gap-2 pt-3 border-t border-border/50">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading} className="flex-1">
              إلغاء
            </Button>
            <Button type="submit" disabled={loading} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white">
              {loading ? <Loader2 className="w-4 h-4 ml-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 ml-2" />}
              تأكيد وتوزيع
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}