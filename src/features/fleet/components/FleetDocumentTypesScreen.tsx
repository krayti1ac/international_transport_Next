'use client';

import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Truck } from '@/components/icons/vehicle-icons';
import {
  FileText,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useLanguage } from '@/components/language-provider';
import { DocumentCategoriesView } from '@/features/fleet/components/DocumentCategoriesModal';

export function FleetDocumentTypesScreen() {
  const { dir, t } = useLanguage();
  const BackChevron = dir === 'rtl' ? ChevronLeft : ChevronRight;

  return (
    <div className="space-y-6 max-w-5xl mx-auto" dir={dir}>
      {/* Top Breadcrumbs & Navigation Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-border/40">
        <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
          <Link
            href="/documents"
            className="hover:text-foreground transition-colors flex items-center gap-1 font-medium"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>{t('إدارة وثائق الأسطول', 'Gestion des documents de flotte')}</span>
          </Link>
          <BackChevron className="w-3.5 h-3.5 text-muted-foreground/60" />
          <span className="text-foreground font-semibold">
            {t('أنواع وثائق الأسطول', 'Types de documents')}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/documents">
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl h-8 text-xs font-semibold gap-1.5 border-border hover:bg-muted/60"
            >
              <FileText className="w-3.5 h-3.5 text-primary" />
              <span>{t('مصفوفة الوثائق', 'Matrice des documents')}</span>
            </Button>
          </Link>
          <Link href="/fleet">
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl h-8 text-xs font-semibold gap-1.5 border-border hover:bg-muted/60"
            >
              <Truck className="w-3.5 h-3.5 text-blue-600" />
              <span>{t('قائمة الأسطول', 'Flotte')}</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Main Content Card */}
      <Card className="p-6 rounded-2xl border border-border/80 shadow-xs">
        <DocumentCategoriesView />
      </Card>
    </div>
  );
}

