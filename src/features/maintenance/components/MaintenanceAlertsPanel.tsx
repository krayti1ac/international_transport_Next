'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, ShieldCheck, Wrench, Truck as TruckIcon } from 'lucide-react';
import type { Truck, TruckMaintenance } from '@/types/database';
import { MatriculeBadge } from '@/components/ui/matricule-badge';

interface Props {
  trucks: Truck[];
  maintenance: TruckMaintenance[];
}

const STALE_DAYS = 90;
const CRITICAL_DAYS = 180;

function daysBetween(a: string | Date, b: string | Date): number {
  return Math.floor((new Date(b).getTime() - new Date(a).getTime()) / 86400000);
}

export function MaintenanceAlertsPanel({ trucks, maintenance }: Props) {
  const alerts = useMemo(() => {
    const lastByTruck = new Map<number, string>();
    for (const m of maintenance) {
      const prev = lastByTruck.get(m.truck_id);
      if (!prev || new Date(m.date) > new Date(prev)) {
        lastByTruck.set(m.truck_id, m.date);
      }
    }

    const now = new Date();
    const items = trucks.map((truck) => {
      const lastDate = lastByTruck.get(truck.id);
      const ageDays = lastDate ? daysBetween(lastDate, now) : null;
      let severity: 'fresh' | 'aging' | 'critical' | 'unknown' = 'unknown';
      if (ageDays === null) severity = 'unknown';
      else if (ageDays > CRITICAL_DAYS) severity = 'critical';
      else if (ageDays > STALE_DAYS) severity = 'aging';
      else severity = 'fresh';
      return { truck, lastDate, ageDays, severity };
    });

    return {
      critical: items.filter((i) => i.severity === 'critical'),
      aging: items.filter((i) => i.severity === 'aging'),
      unknown: items.filter((i) => i.severity === 'unknown'),
      fresh: items.filter((i) => i.severity === 'fresh'),
    };
  }, [trucks, maintenance]);

  const totalAlerts = alerts.critical.length + alerts.aging.length + alerts.unknown.length;

  if (trucks.length === 0) return null;

  return (
    <Card className="border-amber-500/20">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base text-foreground">
          <ShieldCheck className="w-5 h-5 text-amber-500" />
          تنبيهات الصيانة الوقائية
          <Badge variant="outline" className="mr-1 border-amber-500/30 text-amber-700 dark:text-amber-400">
            {totalAlerts} تنبيه
          </Badge>
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          شاحنات تجاوزت {STALE_DAYS} يوماً بدون صيانة مسجلة ({'>'} {CRITICAL_DAYS} يوم = حرج)
        </p>
      </CardHeader>
      <CardContent>
        {totalAlerts === 0 ? (
          <div className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400 p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/15">
            <ShieldCheck className="w-4 h-4" />
            جميع الشاحنات ({alerts.fresh.length}) خضعت لصيانة خلال آخر {STALE_DAYS} يوماً.
          </div>
        ) : (
          <div className="space-y-3">
            {alerts.critical.map((a) => (
              <AlertRow key={`c-${a.truck.id}`} severity="critical" data={a} />
            ))}
            {alerts.aging.map((a) => (
              <AlertRow key={`a-${a.truck.id}`} severity="aging" data={a} />
            ))}
            {alerts.unknown.map((a) => (
              <AlertRow key={`u-${a.truck.id}`} severity="unknown" data={a} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AlertRow({
  severity,
  data,
}: {
  severity: 'critical' | 'aging' | 'unknown';
  data: { truck: Truck; lastDate?: string; ageDays: number | null };
}) {
  const styles = {
    critical: 'bg-rose-500/5 border-rose-500/20 text-rose-700 dark:text-rose-400',
    aging: 'bg-amber-500/5 border-amber-500/20 text-amber-700 dark:text-amber-400',
    unknown: 'bg-slate-500/5 border-slate-500/20 text-slate-700 dark:text-slate-400',
  } as const;
  const labels = {
    critical: 'حرج • فحص فوري',
    aging: 'تحذير • جدولة صيانة',
    unknown: 'لا توجد سجلات',
  } as const;
  const Icon = severity === 'critical' ? AlertTriangle : Wrench;

  return (
    <div className={`flex items-center justify-between gap-3 p-3 rounded-xl border ${styles[severity]}`}>
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-9 h-9 rounded-xl bg-card border border-border/40 flex items-center justify-center shrink-0">
          <TruckIcon className="w-4 h-4 text-muted-foreground" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <MatriculeBadge plate={data.truck.plate_number} variant="badge" size="xs" />
            <span className="text-xs text-muted-foreground truncate">{data.truck.model}</span>
          </div>
          <p className="text-xs mt-1">
            {data.ageDays === null
              ? 'لم تُسجَّل أي صيانة لهذه الشاحنة'
              : `آخر صيانة قبل ${data.ageDays} يوم${data.lastDate ? ` (${data.lastDate})` : ''}`}
          </p>
        </div>
      </div>
      <Badge variant="outline" className="text-[10px] shrink-0">
        <Icon className="w-3 h-3 ml-1" />
        {labels[severity]}
      </Badge>
    </div>
  );
}