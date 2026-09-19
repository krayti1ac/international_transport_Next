'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/browser';
import type { TraccarConfig, TraccarDeviceMapping } from '@/types/database';
import { useToast } from '@/hooks/use-toast';
import { RefreshCw, Settings, Link2, History } from 'lucide-react';
import { useLanguage } from '@/components/language-provider';
import TraccarConfigForm from '@/features/tracking/components/TraccarConfigForm';
import DeviceMappingTable from '@/features/tracking/components/DeviceMappingTable';
import HistoricalTracking from '@/features/tracking/components/HistoricalTracking';

type Tab = 'config' | 'devices' | 'history';

export default function TrackingSettingsPage() {
  const { t, dir } = useLanguage();
  const [activeTab, setActiveTab] = useState<Tab>('config');
  const [config, setConfig] = useState<TraccarConfig | null>(null);
  const [mappings, setMappings] = useState<TraccarDeviceMapping[]>([]);
  const [trucks, setTrucks] = useState<{ id: number; plate_number: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const supabase = useCallback(() => createClient(), []);

  const fetchData = useCallback(async () => {
    try {
      const [configRes, mappingsRes, trucksRes] = await Promise.all([
        supabase().from('traccar_configs').select('*').eq('is_active', true).single(),
        supabase().from('traccar_device_mappings').select('*').order('created_at', { ascending: false }),
        supabase().from('trucks').select('id, plate_number').order('plate_number'),
      ]);

      if (configRes.error && configRes.error.code !== 'PGRST116') {
        console.error('Error fetching traccar config:', configRes.error);
      }
      setConfig((configRes.data as TraccarConfig) || null);
      setMappings((mappingsRes.data || []) as TraccarDeviceMapping[]);
      setTrucks((trucksRes.data || []) as { id: number; plate_number: string }[]);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : t('خطأ غير معروف', 'Erreur inconnue');
      toast({
        title: t('خطأ في تحميل البيانات', 'Erreur lors du chargement des données'),
        description: message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [supabase, toast, t]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleConfigSaved = () => {
    fetchData();
  };

  const handleMappingSaved = () => {
    fetchData();
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-3" dir={dir}>
        <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{t('جاري تحميل البيانات...', 'Chargement des données...')}</p>
      </div>
    );
  }

  const tabs = [
    { id: 'config' as Tab, label: t('إعدادات Traccar', 'Configuration Traccar'), icon: Settings },
    { id: 'devices' as Tab, label: t('ربط الأجهزة', 'Appareils liés'), icon: Link2 },
    { id: 'history' as Tab, label: t('التتبع التاريخي', 'Suivi historique'), icon: History },
  ];

  return (
    <div className="space-y-6" dir={dir}>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold font-amiri text-foreground">
          {t('إدارة التتبع GPS', 'Gestion du Tracking GPS')}
        </h1>
      </div>

      <div className="flex gap-2 border-b border-border">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 ${
                activeTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === 'config' && (
        <TraccarConfigForm config={config} onSaved={handleConfigSaved} />
      )}

      {activeTab === 'devices' && (
        <DeviceMappingTable
          mappings={mappings}
          trucks={trucks}
          onSaved={handleMappingSaved}
          config={config}
        />
      )}

      {activeTab === 'history' && (
        <HistoricalTracking trucks={trucks} />
      )}
    </div>
  );
}
