'use client';

import { useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useLanguage } from '@/components/language-provider';
import { CorridorPnlDashboardView } from './CorridorPnlDashboardView';
import { CorridorAnalyticsView } from './CorridorAnalyticsView';
import type { CorridorPnlAnalyticsResult } from '../types/corridor-pnl.types';
import type { CorridorAnalyticsResult } from '../types/corridor.types';
import { Gauge, Fuel } from 'lucide-react';

interface CorridorHubViewProps {
  pnlData: CorridorPnlAnalyticsResult;
  fuelData: CorridorAnalyticsResult;
}

export function CorridorHubView({ pnlData, fuelData }: CorridorHubViewProps) {
  const { t, dir } = useLanguage();
  const [activeTab, setActiveTab] = useState<'pnl' | 'fuel'>('pnl');

  return (
    <div className="space-y-6" dir={dir}>
      <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as 'pnl' | 'fuel')} className="w-full">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <TabsList className="bg-slate-900 border border-slate-800 p-1">
            <TabsTrigger
              value="pnl"
              className="gap-2 text-xs font-semibold data-[state=active]:bg-emerald-600 data-[state=active]:text-white"
            >
              <Gauge className="w-4 h-4" />
              {t(
                'ذكاء الممرات وتكلفة الكيلومتر (CPK & P&L Engine)',
                'Intelligence des Corridors & Coût au Km (CPK & P&L)',
                'Inteligencia de Corredores y Coste por Km (CPK & P&L)'
              )}
            </TabsTrigger>
            <TabsTrigger
              value="fuel"
              className="gap-2 text-xs font-semibold data-[state=active]:bg-blue-600 data-[state=active]:text-white"
            >
              <Fuel className="w-4 h-4" />
              {t(
                'رادار كفاءة المحروقات والمبردات (Fuel Telematics)',
                'Télématique Carburant & Frigos',
                'Telemática de Combustible y Frigos'
              )}
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="pnl" className="mt-4 focus-visible:outline-none">
          <CorridorPnlDashboardView initialData={pnlData} />
        </TabsContent>

        <TabsContent value="fuel" className="mt-4 focus-visible:outline-none">
          <CorridorAnalyticsView initialData={fuelData} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

