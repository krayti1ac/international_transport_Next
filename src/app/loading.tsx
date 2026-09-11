'use client';

import { Truck } from '@/components/icons/vehicle-icons';
import { useLanguage } from '@/components/language-provider';

export default function Loading() {
  const { t, dir } = useLanguage();

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center gap-4 text-slate-500" dir={dir}>
      <div className="relative flex items-center justify-center">
        <div className="w-16 h-16 rounded-full border-4 border-slate-200 border-t-primary animate-spin" />
        <Truck className="w-6 h-6 text-primary absolute" />
      </div>
      <p className="text-sm font-medium font-amiri animate-pulse">
        {t('جاري تحميل البيانات وتحديث الحالة...', 'Chargement des données et actualisation...')}
      </p>
    </div>
  );
}
