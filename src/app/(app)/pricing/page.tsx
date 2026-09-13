import type { Metadata } from 'next';
import { DynamicPricingCalculator } from '@/features/pricing/components/DynamicPricingCalculator';

export const metadata: Metadata = {
  title: 'التسعير الديناميكي الذكي للشحن الدولي | Trans Bodanon TMS',
  description: 'محرك التسعير الفوري لرحلات الشحن الدولي TIR بناء على الوقود والعبارات والمواسم الفلاحية',
};

export default function PricingPage() {
  return (
    <div className="container mx-auto p-4 md:p-6 max-w-7xl">
      <DynamicPricingCalculator />
    </div>
  );
}

