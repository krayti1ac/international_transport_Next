import { getGroupageMarginBiAction } from '@/features/analytics/services/groupage-margin-bi.actions';
import { GroupageMarginBiView } from '@/features/analytics/components/GroupageMarginBiView';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'تحليلات ربحية الشحن التجميعي (Groupage LTL vs FTL Margin BI) | TransSalges',
  description: 'تحليل دقيق لربحية المتر الطولي (LDM) وتكلفة الكيلومتر (CPK) عبر الممرين الأوروبي والإفريقي بدقة Decimal.js',
};

export default async function GroupageMarginBiPage() {
  const res = await getGroupageMarginBiAction();

  if (!res.success || !res.data) {
    return (
      <div className="container mx-auto px-4 py-8 text-center text-slate-400">
        فشل في تحميل تحليلات ربحية الشحن التجميعي
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl">
      <GroupageMarginBiView initialData={res.data} />
    </div>
  );
}

