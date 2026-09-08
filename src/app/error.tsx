'use client';

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { useLanguage } from '@/components/language-provider';

export default function ErrorBoundary({
  error,
  reset,
  retry,
}: {
  error: Error & { digest?: string };
  reset?: () => void;
  retry?: () => void;
}) {
  const { t, dir } = useLanguage();

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
    t('تعذر استكمال العملية المطلوبة. يرجى إعادة المحاولة أو التواصل مع الدعم الفني.', 'Impossible de terminer l\'opération. Veuillez réessayer ou contacter le support technique.');

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-100" dir={dir}>
      <Card className="w-full max-w-md text-center p-6">
        <CardHeader className="flex flex-col items-center gap-2">
          <div className="p-3 bg-red-100 text-red-600 rounded-full">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <CardTitle className="text-xl font-bold font-amiri text-slate-900">
            {t('حدث خطأ غير متوقع', 'Une erreur inattendue est survenue')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-slate-600">
            {errorMessage}
          </p>
          {error?.digest && (
            <p className="text-xs font-mono text-slate-400">
              {t('رمز الخطأ:', 'Code d\'erreur :')} {error.digest}
            </p>
          )}
          <div className="flex gap-2 justify-center pt-2">
            <Button
              onClick={handleRetry}
              className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white"
            >
              <RefreshCw className="w-4 h-4" />
              {t('إعادة المحاولة', 'Réessayer')}
            </Button>
            <Button
              variant="outline"
              onClick={() => { window.location.href = '/dashboard'; }}
            >
              {t('الرئيسية', 'Accueil')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
