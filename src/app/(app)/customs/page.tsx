import type { Metadata } from 'next';
import { CustomsComplianceDeskView } from '@/features/customs/components/CustomsComplianceDeskView';

export const metadata: Metadata = {
  title: 'منصة الامتثال والربط الجمركي المباشر (BADR & PortNet mTLS) | Trans Bodanon TMS',
  description:
    'بوابة الربط السيادي المباشر بالشهادات الرقمية والتوقيع الإلكتروني XML-DSig لإدارة الجمارك المغربية وبوابة PortNet',
};

export default function CustomsComplianceDeskPage() {
  return (
    <div className="container mx-auto p-2 sm:p-4 lg:p-6 max-w-[1920px]">
      <CustomsComplianceDeskView />
    </div>
  );
}

