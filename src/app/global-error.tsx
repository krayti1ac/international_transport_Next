'use client';

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error, {
      tags: {
        error_boundary: 'global',
        digest: error.digest ?? 'unknown',
      },
    });
  }, [error]);

  return (
    <html lang="fr" dir="rtl">
      <body>
        <div className="min-h-screen flex items-center justify-center p-4 bg-slate-100">
          <Card className="w-full max-w-md text-center p-6 space-y-4">
            <CardHeader className="flex flex-col items-center gap-2">
              <div className="p-3 bg-red-100 text-red-600 rounded-full">
                <AlertTriangle className="w-8 h-8" />
              </div>
              <CardTitle className="text-xl font-bold font-amiri text-slate-900">
                Une erreur est survenue
              </CardTitle>
              <CardTitle className="text-lg font-amiri text-slate-700">
                حدث خطأ غير متوقع
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-slate-600">
                {error.message || "Impossible de terminer l'opération. Veuillez réessayer ou contacter le support technique. | تعذر استكمال العملية المطلوبة. يرجى إعادة المحاولة أو التواصل مع الدعم الفني."}
              </p>
              <Button onClick={() => reset()} className="w-full flex items-center justify-center gap-2">
                <RefreshCw className="w-4 h-4" />
                Réessayer / إعادة المحاولة
              </Button>
            </CardContent>
          </Card>
        </div>
      </body>
    </html>
  );
}
