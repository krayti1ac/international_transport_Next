'use client';

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default function ErrorBoundary({
  error,
  reset,
  retry,
}: {
  error: Error & { digest?: string };
  reset?: () => void;
  retry?: () => void;
}) {
  useEffect(() => {
    if (error) {
      Sentry.captureException(error, {
        tags: {
          error_boundary: 'app',
          digest: error.digest ?? 'unknown',
        },
      });
      // Log the full error object directly rather than a fragile destructured object
      console.error(error);
    }
  }, [error]);

  const handleRetry = () => {
    if (retry) {
      retry();
    } else if (reset) {
      reset();
    }
  };

  const errorMessage =
    error?.message ||
    (typeof error === 'string' ? error : '') ||
    'تعذر استكمال العملية المطلوبة. يرجى إعادة المحاولة أو التواصل مع الدعم الفني.';

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-100" dir="rtl">
      <Card className="w-full max-w-md text-center p-6">
        <CardHeader className="flex flex-col items-center gap-2">
          <div className="p-3 bg-red-100 text-red-600 rounded-full">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <CardTitle className="text-xl font-bold font-amiri text-slate-900">
            حدث خطأ غير متوقع
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-slate-600">
            {errorMessage}
          </p>
          {error?.digest && (
            <p className="text-xs font-mono text-slate-400">
              كود الخطأ: {error.digest}
            </p>
          )}
          <Button onClick={handleRetry} className="w-full flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4" />
            إعادة المحاولة
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
