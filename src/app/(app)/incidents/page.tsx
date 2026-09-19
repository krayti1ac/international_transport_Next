import type { Metadata } from 'next';
import { IncidentsView } from '@/features/incidents/components/IncidentsView';

export const metadata: Metadata = {
  title: 'إدارة الحوادث والمطالبات | Trans Bodanon TMS',
  description: 'تتبع الحوادث الميدانية، التوقيفات الجمركية، التأمين، والمطالبات',
};

export default function IncidentsPage() {
  return (
    <div className="container mx-auto p-4 md:p-6 max-w-7xl">
      <IncidentsView />
    </div>
  );
}
