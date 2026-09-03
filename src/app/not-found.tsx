import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { FileQuestion, ArrowRight } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-slate-50 text-center" dir="rtl">
      <div className="p-4 bg-blue-50 text-primary rounded-full mb-4">
        <FileQuestion className="w-12 h-12" />
      </div>
      <h1 className="text-4xl font-bold font-amiri text-slate-900 mb-2">404 - الصفحة غير موجودة</h1>
      <p className="text-slate-500 max-w-md mb-6">
        الصفحة التي تحاول الوصول إليها غير موجودة أو تم نقلها أو ليس لديك صلاحية لمشاهدتها.
      </p>
      <Link href="/dashboard">
        <Button className="flex items-center gap-2">
          <ArrowRight className="w-4 h-4" />
          العودة للوحة التحكم الرئيسية
        </Button>
      </Link>
    </div>
  );
}
