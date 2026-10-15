import React from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getPublicConsignmentTrackingAction } from '@/features/tracking/services/consignment-epod.actions';
import { ConsignmentTrackingPortal } from '@/features/tracking/components/ConsignmentTrackingPortal';

interface ConsignmentTrackPageProps {
  params: Promise<{ reference: string }>;
}

export async function generateMetadata({ params }: ConsignmentTrackPageProps): Promise<Metadata> {
  const { reference } = await params;
  return {
    title: `تتبع الشحنة ${decodeURIComponent(reference)} | Trans Bodanon TMS`,
    description: `البوابة الرسمية لتتبع الشحنة المستقلة، وثيقة CMR، وبصمة إثبات التسليم الجنائي e-POD`,
  };
}

export default async function ConsignmentTrackingPage({ params }: ConsignmentTrackPageProps) {
  const { reference } = await params;
  const decodedRef = decodeURIComponent(reference);

  const res = await getPublicConsignmentTrackingAction(decodedRef);

  if (!res.success || !res.data) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-10 px-4">
      <ConsignmentTrackingPortal data={res.data} />
    </div>
  );
}

