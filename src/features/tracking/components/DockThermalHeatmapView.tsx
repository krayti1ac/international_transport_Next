'use client';

/**
 * Trans Bodanon TMS — Dock Thermal Heatmap & Excursion Risk Radar View
 * Real-time monitoring of dock vulnerabilities, DVI indexing, and multi-temp compartment impacts
 * Standards: EU GDP (2013/C 343/01) / EN 12830 / ATP Treaty (FRC)
 */

import React, { useState, useTransition, useMemo } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  Building2,
  CheckCircle2,
  Clock,
  Compass,
  ExternalLink,
  Eye,
  Filter,
  Flame,
  Globe2,
  Layers,
  MapPin,
  RefreshCw,
  Search,
  Send,
  Radio,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Snowflake,
  Thermometer,
  ThermometerSnowflake,
  Zap,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import {
  fetchDockRiskClustersAction,
  flagHighRiskDockAction,
} from '../services/dock-risk.actions';
import { simulateApproachingHotspotAlertAction } from '../services/hotspot-proximity-radar.actions';
import type {
  DockHeatmapSummaryKpi,
  DockRiskCluster,
  DockRiskLevel,
  DockWatchStatus,
} from '../types/dock-heatmap.types';

interface DockThermalHeatmapViewProps {
  initialClusters: DockRiskCluster[];
  initialSummary: DockHeatmapSummaryKpi;
}

export function DockThermalHeatmapView({
  initialClusters,
  initialSummary,
}: DockThermalHeatmapViewProps) {
  const t = useTranslations('dockHeatmap');
  const tDriverAlert = useTranslations('hotspotDriverAlert');
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const [clusters, setClusters] = useState<DockRiskCluster[]>(initialClusters);
  const [summary, setSummary] = useState<DockHeatmapSummaryKpi>(initialSummary);
  const [activeFilter, setActiveFilter] = useState<'all' | 'critical' | 'monitored' | 'safe'>('all');
  const [countryFilter, setCountryFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedDockId, setSelectedDockId] = useState<string | null>(
    initialClusters.length > 0 ? initialClusters[0].dockId : null
  );

  // Modal state for updating watch status
  const [flagModalDock, setFlagModalDock] = useState<DockRiskCluster | null>(null);
  const [newWatchStatus, setNewWatchStatus] = useState<DockWatchStatus>('monitored');
  const [flagReason, setFlagReason] = useState<string>('');
  const [isSavingFlag, setIsSavingFlag] = useState<boolean>(false);

  // Reload data
  const handleRefresh = () => {
    startTransition(async () => {
      const res = await fetchDockRiskClustersAction({
        riskLevel: activeFilter,
        countryCode: countryFilter === 'all' ? undefined : countryFilter,
        search: searchQuery || undefined,
      });

      if (res.success) {
        setClusters(res.clusters);
        setSummary(res.summary);
        toast({
          title: t('refresh'),
          description: t('flagSuccess'),
        });
      } else {
        toast({
          title: 'Error',
          description: res.error || 'Failed to refresh dock radar',
          variant: 'destructive',
        });
      }
    });
  };

  // Filtered clusters
  const filteredClusters = useMemo(() => {
    return clusters.filter((item) => {
      if (activeFilter === 'critical' && item.riskLevel !== 'critical') return false;
      if (activeFilter === 'monitored' && item.riskLevel !== 'monitored') return false;
      if (activeFilter === 'safe' && item.riskLevel !== 'safe') return false;

      if (countryFilter !== 'all' && item.countryCode.toUpperCase() !== countryFilter.toUpperCase()) {
        return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchId = item.dockId.toLowerCase().includes(q);
        const matchName = item.dockName.toLowerCase().includes(q);
        const matchFacility = item.facilityOrPort.toLowerCase().includes(q);
        const matchCity = item.city.toLowerCase().includes(q);
        if (!matchId && !matchName && !matchFacility && !matchCity) return false;
      }

      return true;
    });
  }, [clusters, activeFilter, countryFilter, searchQuery]);

  const selectedDock = useMemo(() => {
    return clusters.find((c) => c.dockId === selectedDockId) || (clusters.length > 0 ? clusters[0] : null);
  }, [clusters, selectedDockId]);

  // Handle watch status save
  const handleSaveWatchStatus = async () => {
    if (!flagModalDock) return;
    setIsSavingFlag(true);

    try {
      const res = await flagHighRiskDockAction({
        dockId: flagModalDock.dockId,
        watchStatus: newWatchStatus,
        reason: flagReason || `Updated by logistics safety manager to ${newWatchStatus}`,
      });

      if (res.success) {
        toast({
          title: t('flagSuccess'),
          description: `${flagModalDock.dockName} -> ${newWatchStatus}`,
        });

        // Update local state
        setClusters((prev) =>
          prev.map((c) =>
            c.dockId === flagModalDock.dockId
              ? {
                  ...c,
                  watchStatus: newWatchStatus,
                  flaggedReason: flagReason,
                }
              : c
          )
        );

        setFlagModalDock(null);
        setFlagReason('');
      } else {
        toast({
          title: 'Error',
          description: res.error || 'Failed to update dock watch status',
          variant: 'destructive',
        });
      }
    } finally {
      setIsSavingFlag(false);
    }
  };

  // Simulate urgent approaching hotspot alert dispatch to driver
  const handleSimulateDriverAlert = async (dock: DockRiskCluster) => {
    try {
      const res = await simulateApproachingHotspotAlertAction({
        truckId: 101,
        latitude: dock.coordinates.lat + 0.05, // simulated ~5 km away
        longitude: dock.coordinates.lng + 0.05,
        speedKmh: 50,
        truckPlate: '45892-A-10',
      });

      if (res.dispatched || res.approachingHotspot) {
        toast({
          title: tDriverAlert('hotspotAlertSent'),
          description: `${dock.dockName} — DVI ${dock.metrics.dviScore}/100`,
        });
      } else {
        toast({
          title: tDriverAlert('title'),
          description: res.error || 'Evaluation completed',
        });
      }
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err?.message || 'Failed to simulate driver alert',
        variant: 'destructive',
      });
    }
  };

  // Map coordinate normalization for SVG corridor canvas (Lat 28 to 51, Lng -12 to 5)
  const projectCoordsToSvg = (lat: number, lng: number) => {
    const minLat = 28.0;
    const maxLat = 51.5;
    const minLng = -12.5;
    const maxLng = 6.0;

    const x = ((lng - minLng) / (maxLng - minLng)) * 800;
    const y = 500 - ((lat - minLat) / (maxLat - minLat)) * 500;
    return { x: Math.max(40, Math.min(760, x)), y: Math.max(30, Math.min(470, y)) };
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Actions */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-rose-500/10 p-2 text-rose-500">
              <Flame className="h-6 w-6" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
            <Badge variant="outline" className="border-rose-500/30 text-rose-600 bg-rose-500/5">
              GDP / EN 12830
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/fleet/dock-dispatches">
            <Button variant="outline" size="sm" className="gap-2">
              <Building2 className="h-4 w-4" />
              <span>{t('linkToDockDispatches')}</span>
            </Button>
          </Link>

          <Link href="/fleet/reefer-multi-temp">
            <Button variant="outline" size="sm" className="gap-2">
              <Snowflake className="h-4 w-4" />
              <span>{t('linkToReeferMultiTemp')}</span>
            </Button>
          </Link>

          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isPending}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isPending ? 'animate-spin' : ''}`} />
            <span>{t('refresh')}</span>
          </Button>
        </div>
      </div>

      {/* Bento KPI Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Monitored Docks */}
        <Card className="border border-border/60 shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('totalDocks')}
            </CardTitle>
            <Building2 className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.totalDocksAnalyzed}</div>
            <p className="mt-1 text-xs text-muted-foreground">
              {summary.safeDocksCount} {t('legendSafe')} | {summary.monitoredDocksCount} {t('legendMonitored')}
            </p>
          </CardContent>
        </Card>

        {/* Critical Hotspots */}
        <Card className="border border-rose-500/20 bg-rose-500/5 shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-rose-600 dark:text-rose-400">
              {t('criticalHotspots')}
            </CardTitle>
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span>
            </span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-rose-600 dark:text-rose-400">
              {summary.criticalHotspotsCount}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {summary.worstDviDock ? `${summary.worstDviDock.dockName} (${summary.worstDviDock.dviScore})` : '—'}
            </p>
          </CardContent>
        </Card>

        {/* Average DVI Score */}
        <Card className="border border-border/60 shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('avgDviScore')}
            </CardTitle>
            <Activity className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold">{summary.overallAverageDvi}</span>
              <span className="text-xs text-muted-foreground">/ 100</span>
            </div>
            <div className="mt-2 h-1.5 w-full rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full ${
                  summary.overallAverageDvi >= 60
                    ? 'bg-rose-500'
                    : summary.overallAverageDvi >= 25
                    ? 'bg-amber-500'
                    : 'bg-emerald-500'
                }`}
                style={{ width: `${Math.min(100, summary.overallAverageDvi)}%` }}
              />
            </div>
          </CardContent>
        </Card>

        {/* Cold Chain Preservation Rate */}
        <Card className="border border-emerald-500/20 bg-emerald-500/5 shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
              {t('coldChainPreservation')}
            </CardTitle>
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {summary.coldChainPreservationPercent}%
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              EN 12830 / GDP Compliant Hubs
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Interactive Corridor Radar Heatmap Canvas */}
      <Card className="border border-border/60 overflow-hidden shadow-xs">
        <CardHeader className="border-b bg-muted/20 pb-4">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Compass className="h-4 w-4 text-primary" />
                <span>{t('radarMapTitle')}</span>
              </CardTitle>
              <CardDescription className="text-xs">
                {t('radarMapSubtitle')}
              </CardDescription>
            </div>

            {/* Heatmap Legend */}
            <div className="flex items-center gap-3 text-xs bg-background/80 px-3 py-1.5 rounded-md border">
              <span className="text-muted-foreground font-medium">{t('heatmapLegend')}:</span>
              <span className="flex items-center gap-1 text-emerald-600">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                {t('legendSafe')}
              </span>
              <span className="flex items-center gap-1 text-amber-600">
                <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                {t('legendMonitored')}
              </span>
              <span className="flex items-center gap-1 text-rose-600 font-bold">
                <span className="h-2.5 w-2.5 rounded-full bg-rose-500 animate-pulse" />
                {t('legendCritical')}
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="relative w-full h-[360px] bg-slate-950 overflow-hidden select-none">
            {/* Background Grid & Corridor Radar Concentric Rings */}
            <svg
              className="absolute inset-0 w-full h-full"
              viewBox="0 0 800 500"
              preserveAspectRatio="xMidYMid slice"
            >
              <defs>
                <radialGradient id="radarScan" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.12" />
                  <stop offset="100%" stopColor="#0284c7" stopOpacity="0" />
                </radialGradient>
                <pattern id="gridPattern" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1e293b" strokeWidth="0.5" />
                </pattern>
              </defs>

              <rect width="800" height="500" fill="url(#gridPattern)" />

              {/* Trade Corridor Sea & Coastline Guide (Morocco - Spain - France) */}
              <path
                d="M 120 480 Q 240 400 320 370 T 400 320 T 480 250 T 560 160 T 640 80"
                fill="none"
                stroke="#0369a1"
                strokeWidth="2"
                strokeDasharray="6 4"
                opacity="0.4"
              />

              {/* Radar Rings */}
              <circle cx="400" cy="250" r="100" fill="none" stroke="#334155" strokeWidth="1" strokeDasharray="4 4" />
              <circle cx="400" cy="250" r="180" fill="none" stroke="#1e293b" strokeWidth="1" strokeDasharray="4 4" />

              {/* Corridor Node Connections */}
              {clusters.map((c, i) => {
                if (i === 0) return null;
                const prev = clusters[i - 1];
                const p1 = projectCoordsToSvg(prev.coordinates.lat, prev.coordinates.lng);
                const p2 = projectCoordsToSvg(c.coordinates.lat, c.coordinates.lng);
                return (
                  <line
                    key={`line-${c.dockId}`}
                    x1={p1.x}
                    y1={p1.y}
                    x2={p2.x}
                    y2={p2.y}
                    stroke="#475569"
                    strokeWidth="1"
                    strokeOpacity="0.3"
                  />
                );
              })}

              {/* Render Docks as Interactive Radar Beacons */}
              {clusters.map((dock) => {
                const { x, y } = projectCoordsToSvg(dock.coordinates.lat, dock.coordinates.lng);
                const isSelected = selectedDock?.dockId === dock.dockId;
                const isCritical = dock.riskLevel === 'critical';
                const isMonitored = dock.riskLevel === 'monitored';

                const color = isCritical ? '#ef4444' : isMonitored ? '#f59e0b' : '#10b981';
                const radius = 6 + dock.intensityWeight * 14;

                return (
                  <g
                    key={`marker-${dock.dockId}`}
                    className="cursor-pointer transition-transform duration-200 hover:scale-125"
                    onClick={() => setSelectedDockId(dock.dockId)}
                  >
                    {/* Pulsing Aura for Critical Docks */}
                    {isCritical && (
                      <circle
                        cx={x}
                        cy={y}
                        r={radius * 1.8}
                        fill={color}
                        opacity="0.25"
                        className="animate-ping"
                      />
                    )}

                    {/* Heatmap Glow */}
                    <circle
                      cx={x}
                      cy={y}
                      r={radius}
                      fill={color}
                      opacity={isSelected ? '0.6' : '0.35'}
                    />

                    {/* Central Core Point */}
                    <circle
                      cx={x}
                      cy={y}
                      r={isSelected ? '5' : '3.5'}
                      fill="#ffffff"
                      stroke={color}
                      strokeWidth="2"
                    />

                    {/* Selection Reticle Ring */}
                    {isSelected && (
                      <circle
                        cx={x}
                        cy={y}
                        r={radius + 8}
                        fill="none"
                        stroke="#38bdf8"
                        strokeWidth="1.5"
                        strokeDasharray="3 3"
                      />
                    )}

                    {/* Label */}
                    <text
                      x={x}
                      y={y - radius - 5}
                      textAnchor="middle"
                      fill="#f8fafc"
                      fontSize="10"
                      fontWeight={isSelected ? 'bold' : 'normal'}
                      className="pointer-events-none drop-shadow-md select-none font-mono"
                    >
                      {dock.city} (DVI: {dock.metrics.dviScore})
                    </text>
                  </g>
                );
              })}
            </svg>

            {/* Quick Floating Overlay with Selected Dock Snapshot */}
            {selectedDock && (
              <div className="absolute top-3 end-3 max-w-xs rounded-lg border border-border/70 bg-background/90 p-3 shadow-lg backdrop-blur-md text-xs space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold truncate text-sm">{selectedDock.dockName}</span>
                  <Badge
                    variant="outline"
                    className={
                      selectedDock.riskLevel === 'critical'
                        ? 'border-rose-500 text-rose-500 bg-rose-500/10'
                        : selectedDock.riskLevel === 'monitored'
                        ? 'border-amber-500 text-amber-500 bg-amber-500/10'
                        : 'border-emerald-500 text-emerald-500 bg-emerald-500/10'
                    }
                  >
                    DVI: {selectedDock.metrics.dviScore}
                  </Badge>
                </div>
                <p className="text-muted-foreground truncate">{selectedDock.facilityOrPort}</p>
                <div className="grid grid-cols-2 gap-1 pt-1 border-t text-[11px]">
                  <div>
                    <span className="text-muted-foreground">{t('excursions')}: </span>
                    <span className="font-semibold">{selectedDock.metrics.excursionCount}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">{t('peakDeviation')}: </span>
                    <span className="font-semibold text-rose-500">+{selectedDock.metrics.peakDeviationC}°C</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Filter & Search Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {/* Risk Level Filter Tabs */}
          <Button
            variant={activeFilter === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveFilter('all')}
          >
            {t('filterAll')}
          </Button>
          <Button
            variant={activeFilter === 'critical' ? 'destructive' : 'outline'}
            size="sm"
            onClick={() => setActiveFilter('critical')}
            className={activeFilter !== 'critical' ? 'text-rose-600 border-rose-500/30' : ''}
          >
            {t('filterCritical')}
          </Button>
          <Button
            variant={activeFilter === 'monitored' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveFilter('monitored')}
            className={activeFilter !== 'monitored' ? 'text-amber-600 border-amber-500/30' : ''}
          >
            {t('filterMonitored')}
          </Button>
          <Button
            variant={activeFilter === 'safe' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveFilter('safe')}
            className={activeFilter !== 'safe' ? 'text-emerald-600 border-emerald-500/30' : ''}
          >
            {t('filterSafe')}
          </Button>

          {/* Country Filter */}
          <select
            value={countryFilter}
            onChange={(e) => setCountryFilter(e.target.value)}
            className="h-8 rounded-md border border-input bg-background px-2.5 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="all">{t('countryAll')}</option>
            <option value="MA">{t('countryMA')} (MA)</option>
            <option value="ES">{t('countryES')} (ES)</option>
            <option value="FR">{t('countryFR')} (FR)</option>
          </select>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="absolute start-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder={t('searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="ps-8 h-8 text-xs"
          />
        </div>
      </div>

      {/* Docks Detailed Grid & Compartment Impacts */}
      {filteredClusters.length === 0 ? (
        <Card className="border-dashed p-8 text-center text-muted-foreground text-sm">
          {t('emptyState')}
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {filteredClusters.map((dock) => {
            const isSelected = selectedDock?.dockId === dock.dockId;
            const isCritical = dock.riskLevel === 'critical';
            const isMonitored = dock.riskLevel === 'monitored';

            return (
              <Card
                key={dock.dockId}
                className={`transition-all border shadow-xs cursor-pointer ${
                  isSelected
                    ? 'ring-2 ring-primary border-primary/50'
                    : 'hover:border-primary/30'
                }`}
                onClick={() => setSelectedDockId(dock.dockId)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className={
                            isCritical
                              ? 'border-rose-500/40 text-rose-500 bg-rose-500/10'
                              : isMonitored
                              ? 'border-amber-500/40 text-amber-500 bg-amber-500/10'
                              : 'border-emerald-500/40 text-emerald-500 bg-emerald-500/10'
                          }
                        >
                          DVI {dock.metrics.dviScore}
                        </Badge>
                        <span className="font-bold text-base">{dock.dockName}</span>
                        <span className="text-xs text-muted-foreground font-mono">[{dock.countryCode}]</span>
                      </div>
                      <CardDescription className="text-xs mt-1">
                        {dock.facilityOrPort} — {dock.city}
                      </CardDescription>
                    </div>

                    {/* Watch Status Badge */}
                    <div className="flex items-center gap-1.5">
                      {dock.watchStatus === 'blacklisted' && (
                        <Badge variant="destructive" className="text-[10px]">
                          {t('flagBlacklisted')}
                        </Badge>
                      )}
                      {dock.watchStatus === 'monitored' && (
                        <Badge variant="outline" className="text-[10px] border-amber-500 text-amber-600 bg-amber-500/10">
                          {t('flagMonitored')}
                        </Badge>
                      )}
                      {dock.watchStatus === 'normal' && (
                        <Badge variant="secondary" className="text-[10px]">
                          {t('flagNormal')}
                        </Badge>
                      )}

                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        title={t('updateWatchStatus')}
                        onClick={(e) => {
                          e.stopPropagation();
                          setFlagModalDock(dock);
                          setNewWatchStatus(dock.watchStatus);
                          setFlagReason(dock.flaggedReason || '');
                        }}
                      >
                        <Shield className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-3 pt-0 text-xs">
                  {/* Key Thermal Metrics Bento */}
                  <div className="grid grid-cols-4 gap-2 rounded-lg bg-muted/30 p-2.5 text-center">
                    <div>
                      <div className="text-muted-foreground text-[10px]">{t('arrivals')}</div>
                      <div className="font-bold text-sm">{dock.metrics.totalArrivals}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground text-[10px]">{t('excursions')}</div>
                      <div className="font-bold text-sm text-rose-500">
                        {dock.metrics.excursionCount} ({dock.metrics.excursionFrequencyPercent}%)
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground text-[10px]">{t('avgUnloadingTime')}</div>
                      <div className="font-bold text-sm">
                        {dock.metrics.avgUnloadingMins} {t('minutesUnit')}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground text-[10px]">{t('peakDeviation')}</div>
                      <div className="font-bold text-sm text-amber-500">
                        +{dock.metrics.peakDeviationC}°C
                      </div>
                    </div>
                  </div>

                  {/* Multi-Temp Compartment Impact Status */}
                  <div>
                    <div className="text-[11px] font-semibold text-muted-foreground mb-1.5 flex items-center gap-1.5">
                      <Layers className="h-3 w-3" />
                      <span>{t('compartmentImpact')} (C1 / C2 / C3):</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {dock.compartmentImpacts.map((ci) => (
                        <div
                          key={ci.compartment}
                          className="rounded-md border p-2 bg-background flex flex-col justify-between"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold font-mono">{ci.compartment}</span>
                            <Badge
                              variant="outline"
                              className={`text-[9px] px-1 py-0 ${
                                ci.riskProbability === 'high'
                                  ? 'border-rose-500 text-rose-500 bg-rose-500/10'
                                  : ci.riskProbability === 'moderate'
                                  ? 'border-amber-500 text-amber-500 bg-amber-500/10'
                                  : 'border-emerald-500 text-emerald-500 bg-emerald-500/10'
                              }`}
                            >
                              {ci.riskProbability}
                            </Badge>
                          </div>
                          <div className="mt-1 text-[10px] text-muted-foreground truncate">
                            {ci.setpointTempC}°C → {ci.avgExcursionTempC}°C
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Recommended Operational Protocols */}
                  <div>
                    <div className="text-[11px] font-semibold text-muted-foreground mb-1 flex items-center gap-1.5">
                      <Zap className="h-3 w-3 text-amber-500" />
                      <span>{t('operationalProtocols')}:</span>
                    </div>
                    <ul className="space-y-1 ps-3 text-[11px] list-disc text-foreground/90">
                      {dock.recommendedProtocols.map((protoKey) => (
                        <li key={protoKey}>{t(protoKey as any)}</li>
                      ))}
                    </ul>
                  </div>

                  {dock.flaggedReason && (
                    <div className="rounded-md bg-amber-500/10 p-2 text-[11px] text-amber-700 dark:text-amber-300 border border-amber-500/20">
                      <span className="font-semibold">{t('flagStatus')}: </span>
                      {dock.flaggedReason}
                    </div>
                  )}

                  {/* Proactive Driver Alert Trigger for Critical / Monitored Docks */}
                  <div className="pt-2 border-t flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1 font-mono">
                      <Radio className="h-3 w-3 text-rose-500 animate-pulse" />
                      &lt; 15 km / 30 min Radar
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-[11px] gap-1.5 border-rose-500/30 text-rose-600 hover:bg-rose-500/10"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSimulateDriverAlert(dock);
                      }}
                    >
                      <Send className="h-3 w-3" />
                      <span>{tDriverAlert('simulateAlert')}</span>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Flag / Watch Status Modal */}
      {flagModalDock && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <Card className="w-full max-w-md border shadow-xl bg-background">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-amber-500" />
                <span>{t('updateWatchStatus')}</span>
              </CardTitle>
              <CardDescription>
                {flagModalDock.dockName} ({flagModalDock.facilityOrPort})
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="space-y-2">
                <label className="text-xs font-medium">{t('flagStatus')}</label>
                <div className="grid grid-cols-3 gap-2">
                  <Button
                    type="button"
                    variant={newWatchStatus === 'normal' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setNewWatchStatus('normal')}
                  >
                    {t('flagNormal')}
                  </Button>
                  <Button
                    type="button"
                    variant={newWatchStatus === 'monitored' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setNewWatchStatus('monitored')}
                    className={newWatchStatus === 'monitored' ? 'bg-amber-600 hover:bg-amber-700' : ''}
                  >
                    {t('flagMonitored')}
                  </Button>
                  <Button
                    type="button"
                    variant={newWatchStatus === 'blacklisted' ? 'destructive' : 'outline'}
                    size="sm"
                    onClick={() => setNewWatchStatus('blacklisted')}
                  >
                    {t('flagBlacklisted')}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium">{t('reasonPlaceholder')}</label>
                <Input
                  value={flagReason}
                  onChange={(e) => setFlagReason(e.target.value)}
                  placeholder={t('reasonPlaceholder')}
                  className="text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setFlagModalDock(null)}
                  disabled={isSavingFlag}
                >
                  {t('cancel')}
                </Button>
                <Button
                  size="sm"
                  onClick={handleSaveWatchStatus}
                  disabled={isSavingFlag}
                >
                  {isSavingFlag ? <RefreshCw className="h-4 w-4 animate-spin" /> : t('saveChanges')}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

