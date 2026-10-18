'use client';

import { useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useLanguage } from '@/components/language-provider';
import { CorridorPnlDashboardView } from './CorridorPnlDashboardView';
import { CorridorAnalyticsView } from './CorridorAnalyticsView';
import { GroupageMarginBiView } from './GroupageMarginBiView';
import type { CorridorPnlAnalyticsResult } from '../types/corridor-pnl.types';
import type { CorridorAnalyticsResult } from '../types/corridor.types';
import type { GroupageMarginBiResult } from '../types/groupage-margin-bi.types';
import { Gauge, Fuel, Layers } from 'lucide-react';

interface CorridorHubViewProps {
  pnlData: CorridorPnlAnalyticsResult;
  fuelData: CorridorAnalyticsResult;
  groupageData?: GroupageMarginBiResult;
}

export function CorridorHubView({ pnlData, fuelData, groupageData }: CorridorHubViewProps) {
  const { t, dir } = useLanguage();
  const [activeTab, setActiveTab] = useState<'pnl' | 'fuel' | 'groupage'>('pnl');

  return (
    <div className="space-y-6" dir={dir}>
      <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as 'pnl' | 'fuel' | 'groupage')} className="w-full">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <TabsList className="bg-slate-900 border border-slate-800 p-1 flex-wrap h-auto gap-1">
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
              value="groupage"
              className="gap-2 text-xs font-semibold data-[state=active]:bg-cyan-600 data-[state=active]:text-white"
            >
              <Layers className="w-4 h-4" />
              {t(
                'ربحية الشحن التجميعي مقابل الكامل (Groupage LTL vs FTL)',
                'Rentabilité Groupage LTL vs Complet FTL',
                'Rentabilidad Grupaje LTL vs Carga Completa FTL'
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

        <TabsContent value="groupage" className="mt-4 focus-visible:outline-none">
          {groupageData ? (
            <GroupageMarginBiView initialData={groupageData} />
          ) : (
            <div className="p-8 text-center text-slate-400">
              {t('جاري تحميل بيانات الشحن التجميعي...', 'Chargement du groupage...', 'Cargando datos de grupaje...')}
            </div>
          )}
        </TabsContent>

        <TabsContent value="fuel" className="mt-4 focus-visible:outline-none">
          <CorridorAnalyticsView initialData={fuelData} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

