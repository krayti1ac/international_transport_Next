'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { generateAccountingExport } from '../services/accounting-export.actions';
import type { AccountingSoftware } from '../types';
import { Download, FileSpreadsheet, RefreshCw } from 'lucide-react';
import { formatCurrency } from '@/lib/forex';

interface AccountingExportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AccountingExportModal({ isOpen, onClose }: AccountingExportModalProps) {
  const { toast } = useToast();
  const now = new Date();
  const currentYear = now.getFullYear();

  const [startDate, setStartDate] = useState(`${currentYear}-01-01`);
  const [endDate, setEndDate] = useState(`${currentYear}-12-31`);
  const [software, setSoftware] = useState<AccountingSoftware>('sage100');
  const [includeSales, setIncludeSales] = useState(true);
  const [includeTreasury, setIncludeTreasury] = useState(true);
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    const journalTypes: ('sales' | 'purchases' | 'treasury' | 'forex')[] = [];
    if (includeSales) journalTypes.push('sales');
    if (includeTreasury) journalTypes.push('treasury');

    if (journalTypes.length === 0) {
      toast({ title: 'تنبيه', description: 'يرجى تحديد دفتر يومية واحد على الأقل', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      const res = await generateAccountingExport({
        startDate,
        endDate,
        journalTypes,
        software,
      });

      if (!res.success || !res.content) {
        throw new Error(res.error || 'فشل توليد ملف التصدير');
      }

      // تنزيل الملف المولد تلقائياً في المتصفح
      const blob = new Blob([res.content], { type: res.mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = res.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: '✅ تم تصدير القيود المحاسبية بنجاح',
        description: `تم توليد ${res.totalEntries} قيد محاسبي متوازن بإجمالي ${formatCurrency(res.totalDebit, 'MAD')}.`,
      });
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'خطأ أثناء التصدير';
      toast({ title: 'خطأ', description: msg, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md" dir="rtl">
        <DialogHeader className="text-start">
          <DialogTitle className="text-lg font-bold flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
            تصدير قيود اليومية لبرامج المحاسبة (ERP Bridge)
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            توليد قيود مزدوجة متوازنة متوافقة مع المخطط المحاسبي العام وجاهزة للاستيراد المباشر.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2 text-sm">
          {/* اختيار البرنامج المحاسبي */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-foreground">البرنامج المحاسبي المستهدف:</label>
            <Select value={software} onValueChange={(val) => setSoftware(val as AccountingSoftware)}>
              <SelectTrigger className="w-full h-9 rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sage100">Sage 100 Comptabilité (.txt tabulé)</SelectItem>
                <SelectItem value="odoo">Odoo Accounting (.csv move lines)</SelectItem>
                <SelectItem value="standard_csv">ملف قيود عام (.csv موحد)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* تحديد النطاق الزمني */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">من تاريخ:</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full h-9 px-3 rounded-xl border border-border bg-background text-xs font-mono"
                dir="ltr"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">إلى تاريخ:</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full h-9 px-3 rounded-xl border border-border bg-background text-xs font-mono"
                dir="ltr"
              />
            </div>
          </div>

          {/* دفاتر اليومية المشمولة */}
          <div className="p-3 bg-muted/40 rounded-xl border border-border/80 space-y-2.5">
            <label className="text-xs font-bold text-foreground block">دفاتر اليومية المراد إدراجها:</label>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="sales"
                checked={includeSales}
                onChange={(e) => setIncludeSales(e.target.checked)}
                className="h-4 w-4 rounded border-border text-indigo-600 focus:ring-indigo-500 accent-indigo-600 cursor-pointer"
              />
              <label htmlFor="sales" className="text-xs cursor-pointer select-none">
                يومية المبيعات والفواتير الدولية (Journal des Ventes - VT)
              </label>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="treasury"
                checked={includeTreasury}
                onChange={(e) => setIncludeTreasury(e.target.checked)}
                className="h-4 w-4 rounded border-border text-indigo-600 focus:ring-indigo-500 accent-indigo-600 cursor-pointer"
              />
              <label htmlFor="treasury" className="text-xs cursor-pointer select-none">
                يومية الخزينة والمقبوضات بنظام FIFO (Journal de Trésorerie - BQ/CA)
              </label>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t">
          <Button variant="outline" size="sm" onClick={onClose} disabled={loading} className="rounded-xl">
            إلغاء
          </Button>
          <Button
            size="sm"
            onClick={handleExport}
            disabled={loading}
            className="rounded-xl gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
          >
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            <span>تصدير القيود الآن</span>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
