import { Suspense } from 'react';
import { FleetDocumentTypesScreen } from '@/features/fleet/components/FleetDocumentTypesScreen';

export const metadata = {
  title: 'أنواع وثائق الأسطول | Trans Bodanon',
  description: 'شاشة مستقلة للتحكم في أنواع وتصنيفات وثائق الشاحنات والمقطورات',
};

export default function DocumentTypesPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-center text-muted-foreground animate-pulse font-mono text-sm">
          جاري تحميل أنواع وثائق الأسطول...
        </div>
      }
    >
      <FleetDocumentTypesScreen />
    </Suspense>
  );
}

