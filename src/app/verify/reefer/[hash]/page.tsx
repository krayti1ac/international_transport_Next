import React from 'react';
import type { Metadata } from 'next';
import { verifyReeferColdChainByHashAction } from '@/features/tracking/services/reefer-verification.actions';
import { PublicReeferVerifyView } from '@/features/tracking/components/PublicReeferVerifyView';

interface VerifyReeferPageProps {
  params: Promise<{ hash: string }>;
  searchParams?: Promise<{ trip?: string; lang?: 'ar' | 'fr' | 'es' }>;
}

export async function generateMetadata({ params }: VerifyReeferPageProps): Promise<Metadata> {
  const { hash } = await params;
  return {
    title: `التحقق من سلسلة التبريد • GDP / EN 12830 | ${hash.substring(0, 16)}`,
    description: 'بوابة التحقق الرسمية المعتمدة من سلامة سلسلة التبريد لشاحنات Frigo الدولية وفق معايير GDP و EN 12830 وميثاق ATP.',
  };
}

export default async function VerifyReeferPage({
  params,
  searchParams,
}: VerifyReeferPageProps) {
  const { hash } = await params;
  const resolvedQuery = searchParams ? await searchParams : undefined;
  const tripIdHint = resolvedQuery?.trip;
  const lang = resolvedQuery?.lang || 'ar';

  const initialResult = await verifyReeferColdChainByHashAction(hash, tripIdHint);

  return (
    <PublicReeferVerifyView
      initialResult={initialResult}
      candidateHash={hash}
      tripIdHint={tripIdHint}
      initialLang={lang}
    />
  );
}

