import type { Metadata } from 'next';
import { MissionControlView } from '@/features/mission-control/components/MissionControlView';

export const metadata: Metadata = {
  title: 'غرفة العمليات ورادار المبردات TIR | Trans Bodanon TMS',
  description:
    'المركز العصبي للرصد الجيومكاني الميداني، رادار سلاسل التبريد Frigo، وحماية الممرات الدولية',
};

export default function MissionControlPage() {
  return (
    <div className="container mx-auto p-2 sm:p-4 lg:p-6 max-w-[1920px]">
      <MissionControlView />
    </div>
  );
}

