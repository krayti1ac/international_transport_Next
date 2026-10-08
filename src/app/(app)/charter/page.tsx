import React, { Suspense } from 'react';
import { CharterExchangeView } from '@/features/charter/components/CharterExchangeView';
import { Loader2 } from 'lucide-react';

export default function CharterPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      }
    >
      <CharterExchangeView />
    </Suspense>
  );
}

