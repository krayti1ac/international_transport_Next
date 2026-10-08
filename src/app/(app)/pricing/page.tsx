import type { Metadata } from 'next';
import { InstantQuotationCalculatorView } from '@/features/pricing/components/InstantQuotationCalculatorView';

export const metadata: Metadata = {
  title: 'التسعير الديناميكي الذكي وعروض الأسعار الفورية | Trans Bodanon TMS',
  description: 'محرك التسعير الفوري لرحلات الشحن الدولي وتوليد عروض الأسعار الرسمية والتحويل إلى CMR',
};

export default function PricingPage() {
  return (
    <div className="container mx-auto p-4 md:p-6 max-w-7xl">
      <InstantQuotationCalculatorView />
    </div>
  );
}

