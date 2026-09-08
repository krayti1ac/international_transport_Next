'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { FileQuestion, ArrowRight } from 'lucide-react';
import { useLanguage } from '@/components/language-provider';

export default function NotFound() {
  const { t, dir } = useLanguage();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-slate-50 text-center" dir={dir}>
      <div className="p-4 bg-blue-50 text-primary rounded-full mb-4">
        <FileQuestion className="w-12 h-12" />
      </div>
      <h1 className="text-4xl font-bold font-amiri text-slate-900 mb-2">
        {t('404 - الصفحة غير موجودة', '404 - Page non trouvée')}
      </h1>
      <p className="text-slate-500 max-w-md mb-6">
        {t(
          'الصفحة التي تحاول الوصول إليها غير موجودة أو تم نقلها أو ليس لديك صلاحية لمشاهدتها.',
          'La page que vous recherchez n\'existe pas, a été déplacée ou vous n\'avez pas l\'autorisation d\'y accéder.'
        )}
      </p>
      <Link href="/dashboard">
        <Button className="flex items-center gap-2">
          <ArrowRight className="w-4 h-4" />
          {t('العودة للوحة التحكم الرئيسية', 'Retour au tableau de bord')}
        </Button>
      </Link>
    </div>
  );
}
