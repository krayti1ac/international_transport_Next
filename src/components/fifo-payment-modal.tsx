'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { X, CheckCircle2, ArrowRightLeft, DollarSign, Layers } from 'lucide-react';
import type { Client, BankAccount, CashBox } from '@/types/database';
import { processFIFOPayment, FIFOPaymentResult } from '@/lib/fifo-payment';
import { createClient } from '@/lib/supabase/client';
import { DEFAULT_CLIENTS, DEFAULT_BANK_ACCOUNTS, DEFAULT_CASH_BOXES, fallbackArray } from '@/lib/default-data';

interface FIFOPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  clients: Client[];
  bankAccounts?: BankAccount[];
  cashBoxes?: CashBox[];
  onPaymentProcessed?: () => void;
}

export function FIFOPaymentModal({
  isOpen,
  onClose,
  clients,
  bankAccounts = [],
  cashBoxes = [],
  onPaymentProcessed,
}: FIFOPaymentModalProps) {
  const availableClients = fallbackArray(clients, DEFAULT_CLIENTS);
  const availableBankAccounts = fallbackArray(bankAccounts, DEFAULT_BANK_ACCOUNTS);
  const availableCashBoxes = fallbackArray(cashBoxes, DEFAULT_CASH_BOXES);

  const [selectedClientId, setSelectedClientId] = useState<number | ''>('');
  const [amount, setAmount] = useState<string>('');
  const [currency, setCurrency] = useState<string>('MAD');
  const [method, setMethod] = useState<string>('bank_transfer');
  const [bankAccountId, setBankAccountId] = useState<number | ''>('');
  const [cashBoxId, setCashBoxId] = useState<number | ''>('');
  const [reference, setReference] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<FIFOPaymentResult | null>(null);

  const { toast } = useToast();
  const supabase = createClient();

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClientId) {
      toast({ title: 'يرجى اختيار العميل', variant: 'destructive' });
      return;
    }

    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount <= 0) {
      toast({ title: 'يرجى إدخال مبلغ صحيح أكبر من الصفر', variant: 'destructive' });
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const res = await processFIFOPayment(supabase, {
        clientId: Number(selectedClientId),
        amount: numAmount,
        currency,
        paymentMethod: method,
        bankAccountId: bankAccountId ? Number(bankAccountId) : undefined,
        cashBoxId: cashBoxId ? Number(cashBoxId) : undefined,
        reference,
        notes,
      });

      if (!res.success) {
        toast({
          title: 'خطأ في معالجة الدفعة',
          description: res.error,
          variant: 'destructive',
        });
      } else {
        setResult(res);
        toast({
          title: '✅ تمت معالجة الدفعة بنجاح',
          description: `تم توزيع المبلغ على ${res.affectedInvoicesCount} فاتورة مستحقة.`,
        });
        if (onPaymentProcessed) {
          onPaymentProcessed();
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setResult(null);
    setAmount('');
    setReference('');
    setNotes('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 overflow-y-auto" dir="rtl">
      <Card className="w-full max-w-2xl my-8 shadow-2xl border-border bg-card">
        <CardHeader className="flex flex-row items-center justify-between border-b border-border pb-4">
          <CardTitle className="font-amiri text-xl flex items-center gap-2 text-foreground">
            <Layers className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            تحصيل دفعة عميل بنظام FIFO (تسوية الأقدم أولاً)
          </CardTitle>
          <Button variant="ghost" size="icon" onClick={handleReset}>
            <X className="w-5 h-5" />
          </Button>
        </CardHeader>
        <CardContent className="pt-5">
          {result ? (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-900 dark:text-emerald-200">
                <div className="flex items-center gap-2 font-bold text-base mb-1">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  تم تسجيل التحصيل وتوزيع الدفعة بنجاح
                </div>
                <p className="text-xs text-muted-foreground">
                  المبلغ الموزع على الفواتير: <span className="font-bold text-foreground">{result.totalAllocated.toFixed(2)} {currency}</span>
                  {result.unallocatedCredit > 0 && (
                    <span className="mr-3 text-amber-600 dark:text-amber-400">
                      (رصيد متبقي كفائض للعميل: {result.unallocatedCredit.toFixed(2)} {currency})
                    </span>
                  )}
                </p>
              </div>

              {result.allocations.length > 0 ? (
                <div>
                  <h4 className="text-sm font-semibold text-foreground mb-2">تفاصيل تسوية الفواتير الأقدم:</h4>
                  <div className="border border-border rounded-lg overflow-hidden divide-y divide-border text-sm">
                    {result.allocations.map((alloc) => (
                      <div key={alloc.invoiceId} className="p-3 flex items-center justify-between bg-muted/20">
                        <div>
                          <p className="font-bold text-foreground">فاتورة رقم: {alloc.invoiceNumber}</p>
                          <span className={`inline-block text-[11px] px-2 py-0.5 rounded-full mt-1 ${
                            alloc.newStatus === 'paid'
                              ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                              : 'bg-amber-500/20 text-amber-700 dark:text-amber-300'
                          }`}>
                            {alloc.newStatus === 'paid' ? 'تم السداد بالكامل' : 'سداد جزئي'}
                          </span>
                        </div>
                        <div className="text-left font-mono">
                          <p className="text-xs text-muted-foreground">المبلغ المسدد:</p>
                          <p className="font-bold text-emerald-600 dark:text-emerald-400">
                            +{alloc.allocatedAmount.toFixed(2)} {currency}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">لا توجد فواتير غير مدفوعة حالياً لهذا العميل. تم حفظ المبلغ كرصيد مستحق.</p>
              )}

              <Button onClick={handleReset} className="w-full mt-4">
                إغلاق
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">العميل *</label>
                  <select
                    value={selectedClientId}
                    onChange={(e) => setSelectedClientId(e.target.value ? Number(e.target.value) : '')}
                    className="w-full h-10 px-3 py-2 border border-input bg-card rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring shadow-2xs transition-colors [color-scheme:light] dark:[color-scheme:dark]"
                    required
                  >
                    <option value="">-- اختر العميل --</option>
                    {availableClients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.city ? `(${c.city})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">مبلغ الدفعة المستلمة *</label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      required
                      dir="ltr"
                      className="flex-1"
                    />
                    <select
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value)}
                      className="h-10 px-3 py-2 border border-input bg-card rounded-lg text-sm text-foreground focus:ring-2 focus:ring-ring [color-scheme:light] dark:[color-scheme:dark]"
                    >
                      <option value="MAD">MAD</option>
                      <option value="EUR">EUR</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">طريقة الدفع *</label>
                  <select
                    value={method}
                    onChange={(e) => setMethod(e.target.value)}
                    className="w-full h-10 px-3 py-2 border border-input bg-card rounded-lg text-sm text-foreground focus:ring-2 focus:ring-ring [color-scheme:light] dark:[color-scheme:dark]"
                  >
                    <option value="bank_transfer">تحويل بنكي (Virement)</option>
                    <option value="check">شيك بنكي (Chèque)</option>
                    <option value="cash">نقداً (Espèces)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">
                    {method === 'cash' ? 'صندوق الخزينة المستلم' : 'الحساب البنكي المودع به'}
                  </label>
                  {method === 'cash' ? (
                    <select
                      value={cashBoxId}
                      onChange={(e) => setCashBoxId(e.target.value ? Number(e.target.value) : '')}
                      className="w-full h-10 px-3 py-2 border border-input bg-card rounded-lg text-sm text-foreground focus:ring-2 focus:ring-ring [color-scheme:light] dark:[color-scheme:dark]"
                    >
                      <option value="">-- الصندوق المكتبي الافتراضي --</option>
                      {availableCashBoxes.map((box) => (
                        <option key={box.id} value={box.id}>
                          {box.name} ({box.currency})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <select
                      value={bankAccountId}
                      onChange={(e) => setBankAccountId(e.target.value ? Number(e.target.value) : '')}
                      className="w-full h-10 px-3 py-2 border border-input bg-card rounded-lg text-sm text-foreground focus:ring-2 focus:ring-ring [color-scheme:light] dark:[color-scheme:dark]"
                    >
                      <option value="">-- الحساب البنكي الافتراضي --</option>
                      {availableBankAccounts.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.bank_name} - {b.account_number} ({b.currency})
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">رقم المرجع / الشيك / التحويل</label>
                  <Input
                    placeholder="مثال: CHQ-89021 أو VIR-4412"
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    dir="ltr"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">ملاحظات التحصيل</label>
                  <Input
                    placeholder="ملاحظات اختيارية..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>
              </div>

              <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg text-xs text-blue-900 dark:text-blue-200">
                💡 <strong>مبدأ FIFO:</strong> سيقوم النظام تلقائياً بالبحث عن أقدم الفواتير المستحقة لهذا العميل وسدادها أولاً بأول حتى اكتمال المبلغ بالكامل.
              </div>

              <div className="flex gap-2 pt-4 border-t border-border">
                <Button type="submit" disabled={loading} className="flex-1 flex items-center justify-center gap-2">
                  <ArrowRightLeft className="w-4 h-4" />
                  {loading ? 'جاري المعالجة وتوزيع الدفعة...' : 'تنفيذ التحصيل وتوزيع FIFO'}
                </Button>
                <Button type="button" variant="outline" onClick={handleReset}>
                  إلغاء
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

