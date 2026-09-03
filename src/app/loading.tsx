import { Loader2, Truck } from 'lucide-react';

export default function Loading() {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center gap-4 text-slate-500" dir="rtl">
      <div className="relative flex items-center justify-center">
        <div className="w-16 h-16 rounded-full border-4 border-slate-200 border-t-primary animate-spin" />
        <Truck className="w-6 h-6 text-primary absolute" />
      </div>
      <p className="text-sm font-medium font-amiri animate-pulse">جاري تحميل البيانات وتحديث الحالة...</p>
    </div>
  );
}
