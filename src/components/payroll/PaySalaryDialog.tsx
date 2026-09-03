'use client';

import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCashBoxes } from '@/lib/query/queries';
import { Wallet, X, Loader2, FileText } from 'lucide-react';
import type { CashBox } from '@/types/database';
import { formatCurrency } from '@/lib/forex';
import { payDriverSalary } from '@/features/hr/services/payroll.actions';

interface PaySalaryDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  driverName: string;
  netPay: number;
  currency: string;
  driverId: number;
  month: number;
  year: number;
}

export function PaySalaryDialog({
  isOpen,
  onClose,
  onSuccess,
  driverName,
  netPay,
  currency,
  driverId,
  month,
  year,
}: PaySalaryDialogProps) {
  const [selectedCashBoxId, setSelectedCashBoxId] = useState<number | ''>('');
  const [details, setDetails] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const { data: cashBoxes = [] } = useCashBoxes();

  const handleClose = () => {
    setSelectedCashBoxId('');
    setDetails('');
    onClose();
  };

  const handleSubmit = async () => {
    if (!selectedCashBoxId) {
      toast({
        title: 'خطأ',
        description: 'يرجى اختيار الصندوق النقدي',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await payDriverSalary({
        driverId,
        netPay,
        cashBoxId: selectedCashBoxId as number,
        month,
        year,
        details: details || undefined,
      });

      if (!result.success) {
        throw new Error(result.error);
      }

      toast({
        title: 'تم صرف الراتب بنجاح',
        description: `تم صرف ${formatCurrency(netPay, currency)} من الصندوق المختار`,
      });

      handleClose();
      onSuccess();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'حدث خطأ غير متوقع';
      toast({
        title: 'خطأ أثناء صرف الراتب',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="font-amiri flex items-center gap-2">
            <Wallet className="w-5 h-5 text-primary" />
            صرف راتب شهري
          </DialogTitle>
          <DialogDescription>
            تأكيد عملية صرف راتب السائق من الصندوق النقدي
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="p-4 bg-muted/50 rounded-xl border border-border space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">السائق:</span>
              <span className="font-bold text-foreground">{driverName}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">الفترة:</span>
              <span className="font-medium text-foreground">
                {new Date(year, month - 1).toLocaleDateString('ar-MA', { month: 'long', year: 'numeric' })}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">صافي المستحق:</span>
              <span className="font-bold font-mono text-emerald-700 dark:text-emerald-300">
                {formatCurrency(netPay, currency)}
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">الصندوق النقدي / الحساب البنكي</label>
            <Select
              value={selectedCashBoxId ? String(selectedCashBoxId) : ''}
              onValueChange={(value) => setSelectedCashBoxId(Number(value))}
            >
              <SelectTrigger>
                <SelectValue placeholder="اختر الصندوق" />
              </SelectTrigger>
              <SelectContent>
                {cashBoxes.map((box) => (
                  <SelectItem key={box.id} value={String(box.id)}>
                    {box.name} ({box.code}) - {box.currency}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {cashBoxes.length === 0 && (
              <p className="text-xs text-muted-foreground">لا توجد صناديق نقدية مسجلة</p>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground flex items-center gap-2">
              <FileText className="w-4 h-4 text-muted-foreground" />
              ملاحظات / تفاصيل العملية (اختياري)
            </label>
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="أضف تفاصيل حول هذه العملية..."
              className="w-full min-h-[80px] px-3 py-2 border border-input bg-background text-foreground rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
            إلغاء
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !selectedCashBoxId || cashBoxes.length === 0}
            className="gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                جاري الصرف...
              </>
            ) : (
              `تأكيد صرف ${formatCurrency(netPay, currency)}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
