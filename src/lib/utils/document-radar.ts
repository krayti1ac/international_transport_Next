/**
 * محرك فحص رادار وثائق الأسطول وحساب المهل الزمنية
 * Fleet Documents Expiry Radar & Timeframe Engine
 * يدعم الكيانات الثلاثة: الشاحنات (truck)، المقطورات (trailer)، والسائقين (driver)
 */

export type FleetEntityType = 'truck' | 'trailer' | 'driver';

export type DocumentRadarStatus = 'expired' | 'critical' | 'warning' | 'safe' | 'missing';

export interface DocumentRadarResult {
  status: DocumentRadarStatus;
  daysRemaining: number;
  color: 'red' | 'orange' | 'yellow' | 'green' | 'gray';
  colorHex: string;
  badgeClass: string;
  labelAr: string;
  labelFr: string;
  labelEs: string;
  isUrgent: boolean;
  entityType?: FleetEntityType;
}

export interface FleetDocumentRadarItem {
  id?: number | string;
  expiry_date?: string | Date | null;
  document_type?: string;
  doc_type?: string;
  entity_type?: string | FleetEntityType;
  entity_id?: number | string;
  is_archived?: boolean | null;
}

export interface FleetDocumentRadarStats {
  total: number;
  safe: number;
  warning: number;
  critical: number;
  expired: number;
  missing: number;
  urgentTotal: number; // expired + critical
  expiring30DaysTotal: number; // critical + warning
}

/**
 * حساب الأيام التقويمية المتبقية بدقة مع مراعاة المناطق الزمنية (Normalized Midnight UTC/Local)
 */
export function calculateRemainingDays(
  expiryDate: string | Date | null | undefined,
  baseDate: Date = new Date()
): number {
  if (!expiryDate) return 9999;

  let expYear: number;
  let expMonth: number;
  let expDay: number;

  if (typeof expiryDate === 'string') {
    // إذا كان التاريخ بتنسيق YYYY-MM-DD يتم استخراج الأجزاء مباشرة لمنع أي انزياح زمني
    const match = expiryDate.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      expYear = parseInt(match[1], 10);
      expMonth = parseInt(match[2], 10) - 1;
      expDay = parseInt(match[3], 10);
    } else {
      const exp = new Date(expiryDate);
      if (isNaN(exp.getTime())) return 9999;
      expYear = exp.getUTCFullYear();
      expMonth = exp.getUTCMonth();
      expDay = exp.getUTCDate();
    }
  } else {
    if (isNaN(expiryDate.getTime())) return 9999;
    expYear = expiryDate.getUTCFullYear();
    expMonth = expiryDate.getUTCMonth();
    expDay = expiryDate.getUTCDate();
  }

  const baseYear = baseDate.getUTCFullYear();
  const baseMonth = baseDate.getUTCMonth();
  const baseDay = baseDate.getUTCDate();

  const expMidnight = Date.UTC(expYear, expMonth, expDay);
  const baseMidnight = Date.UTC(baseYear, baseMonth, baseDay);

  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.round((expMidnight - baseMidnight) / msPerDay);
}


/**
 * فحص حالة صلاحية الوثيقة لجميع الكيانات الثلاثة (truck, trailer, driver)
 * - منتهية (Expired): < 0 (🔴 أحمر)
 * - حرجة (Critical / Expiring Soon): 0 - 15 يوماً (🟠 برتقالي)
 * - تحذيرية (Warning): 16 - 30 يوماً (🟡 أصفر)
 * - سارية وآمنة (Safe): > 30 يوماً (🟢 أخضر)
 */
export function checkDocumentExpiry(
  expiryDate: string | Date | null | undefined,
  entityType?: FleetEntityType | string,
  baseDate: Date = new Date()
): DocumentRadarResult {
  const normEntityType = (entityType?.toLowerCase().trim() as FleetEntityType) || undefined;

  if (!expiryDate) {
    return {
      status: 'missing',
      daysRemaining: 9999,
      color: 'gray',
      colorHex: '#6b7280',
      badgeClass: 'bg-muted text-muted-foreground border-border',
      labelAr: 'غير مسجل',
      labelFr: 'Non enregistré',
      labelEs: 'No registrado',
      isUrgent: false,
      entityType: normEntityType,
    };
  }

  const days = calculateRemainingDays(expiryDate, baseDate);

  // 1. منتهية (Expired): الأيام أصغر من 0 (🔴 أحمر)
  if (days < 0) {
    const absDays = Math.abs(days);
    return {
      status: 'expired',
      daysRemaining: days,
      color: 'red',
      colorHex: '#ef4444',
      badgeClass: 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30',
      labelAr: absDays === 1 ? 'انتهت منذ يوم' : `انتهت منذ ${absDays} يوم`,
      labelFr: absDays === 1 ? 'Expiré depuis 1 j' : `Expiré depuis ${absDays} j`,
      labelEs: absDays === 1 ? 'Expirado hace 1 d' : `Expirado hace ${absDays} d`,
      isUrgent: true,
      entityType: normEntityType,
    };
  }

  // 2. حرجة (Expiring Soon): 15 يوماً أو أقل (🟠 برتقالي)
  if (days <= 15) {
    return {
      status: 'critical',
      daysRemaining: days,
      color: 'orange',
      colorHex: '#f97316',
      badgeClass: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30',
      labelAr: days === 0 ? 'تنتهي اليوم' : days === 1 ? 'متبقي يوم واحد' : `متبقي ${days} أيام (حرجة)`,
      labelFr: days === 0 ? "Expire aujourd'hui" : `${days} jours restants (critique)`,
      labelEs: days === 0 ? 'Expira hoy' : `${days} días restantes (crítico)`,
      isUrgent: true,
      entityType: normEntityType,
    };
  }

  // 3. تحذيرية (Warning): بين 16 و30 يوماً (🟡 أصفر)
  if (days <= 30) {
    return {
      status: 'warning',
      daysRemaining: days,
      color: 'yellow',
      colorHex: '#eab308',
      badgeClass: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25',
      labelAr: `متبقي ${days} يوم (تحذير)`,
      labelFr: `${days} jours restants (attention)`,
      labelEs: `${days} días restantes (aviso)`,
      isUrgent: true,
      entityType: normEntityType,
    };
  }

  // 4. سارية وآمنة (Safe): أكثر من 30 يوماً (🟢 أخضر)
  return {
    status: 'safe',
    daysRemaining: days,
    color: 'green',
    colorHex: '#10b981',
    badgeClass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25',
    labelAr: `سارية (متبقي ${days} يوم)`,
    labelFr: `Valide (${days} j restants)`,
    labelEs: `Válido (${days} d restantes)`,
    isUrgent: false,
    entityType: normEntityType,
  };
}

/**
 * فحص وتقييم شامل لمجموعة وثائق الأسطول وإرجاع الإحصائيات الدقيقة
 */
export function evaluateFleetDocumentsRadar(
  documents: FleetDocumentRadarItem[],
  baseDate: Date = new Date()
): FleetDocumentRadarStats {
  const stats: FleetDocumentRadarStats = {
    total: documents.length,
    safe: 0,
    warning: 0,
    critical: 0,
    expired: 0,
    missing: 0,
    urgentTotal: 0,
    expiring30DaysTotal: 0,
  };

  for (const doc of documents) {
    if (doc.is_archived) continue;

    const res = checkDocumentExpiry(doc.expiry_date, doc.entity_type, baseDate);
    switch (res.status) {
      case 'expired':
        stats.expired++;
        stats.urgentTotal++;
        break;
      case 'critical':
        stats.critical++;
        stats.urgentTotal++;
        stats.expiring30DaysTotal++;
        break;
      case 'warning':
        stats.warning++;
        stats.expiring30DaysTotal++;
        break;
      case 'safe':
        stats.safe++;
        break;
      case 'missing':
        stats.missing++;
        break;
    }
  }

  return stats;
}
