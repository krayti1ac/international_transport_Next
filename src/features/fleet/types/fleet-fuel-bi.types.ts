/**
 * Trans Bodanon TMS — Fleet Fuel & Telematics BI Analytics Types
 * Track B: Forensic Fuel Analytics, Tractor vs. Reefer Split (Carrier Transicold / Thermo King),
 * CAN-Bus / FMS Telematics Variance, OCR vs. GPS Station Verification, and Multi-Currency Cost Breakdown (MAD/EUR)
 */

export type FuelEfficiencyGrade = 'A+' | 'A' | 'B' | 'C' | 'D';

export type ReeferUnitBrand = 'carrier_transicold' | 'thermo_king' | 'none';

export type FuelAnomalyType =
  | 'consumption_variance'    // انحراف الاستهلاك الفعلي عن المعياري أو قراءة CAN-Bus
  | 'gps_station_mismatch'    // تباين إحداثيات التزود بالوقود بين إيصال OCR وموقع الشاحنة عبر GPS
  | 'manual_ocr_review'       // إيصال محال للمراجعة اليدوية (انخفاض ثقة OCR أو تجاوز سعة الخزان)
  | 'reefer_overburn';        // استهلاك مفرط لمحرك وحدة التبريد (L/h)

export type FuelAnomalySeverity = 'low' | 'medium' | 'high' | 'critical';

export type FuelAnomalyResolutionStatus = 'pending_review' | 'verified_legitimate' | 'confirmed_fraud';

/**
 * تفاصيل فصل استهلاك محرك الجر الأساسي عن محرك مقطورة التبريد
 * Tractor Engine (L/100km) vs. Reefer Auxiliary Engine (L/hour)
 */
export interface TractorReeferFuelSplit {
  tractorLiters: string;             // لترات الديزل المستهلكة في محرك الجر الأساسي
  reeferLiters: string;              // لترات الديزل المستهلكة في محرك التبريد المستقل (Carrier / Thermo King)
  totalLiters: string;               // إجمالي اللترات (الجر + التبريد)
  tractorSharePct: string;           // نسبة استهلاك محرك الجر (%)
  reeferSharePct: string;            // نسبة استهلاك محرك التبريد (%)
  reeferOperatingHours: string;      // ساعات تشغيل وحدة التبريد
  reeferBurnRateLPerHour: string;    // معدل استهلاك التبريد الفعلي (لتر / ساعة)
  reeferBaselineLPerHour: string;    // المعدل المعياري لوحدة التبريد (مثلاً 3.2 لتر/ساعة)
  reeferBrand: ReeferUnitBrand;
}

/**
 * مؤشرات كفاءة استهلاك الوقود لكل شاحنة وسائق في مصفوفة الترتيب (Fleet Efficiency Leaderboard)
 */
export interface TruckDriverEfficiencyRow {
  truckId: number;
  plateNumber: string;
  truckModel: string;
  driverId: number;
  driverName: string;
  driverPhotoUrl?: string;
  corridorCode: 'MA-ES-FR' | 'MA-MR-SN' | 'DOMESTIC-MA';
  corridorName: string;
  isReeferTrip: boolean;
  reeferBrand: ReeferUnitBrand;
  odometerDistanceKm: string;        // المسافة المقطوعة من عداد الكيلومترات (CAN-Bus Odometer)
  canBusFuelBurnLiters: string;      // الديزل المستهلك حسب قراءة حاسوب الشاحنة (CAN-Bus FMS)
  ocrReceiptsTotalLiters: string;    // إجمالي اللترات المفوترة في إيصالات المحطات (OCR)
  fuelSplit: TractorReeferFuelSplit; // فصل استهلاك محرك الجر عن محرك التبريد
  baselineLPer100Km: string;         // معدل الاستهلاك المعياري للشاحنة (L/100km)
  actualTractorLPer100Km: string;    // معدل الاستهلاك الفعلي لمحرك الجر (L/100km)
  combinedLPer100Km: string;         // المعدل الإجمالي الشامل للتبريد (L/100km)
  varianceLPer100Km: string;         // الانحراف باللتر لكل 100 كم (+ هدر / - وفر)
  variancePct: string;               // نسبة الانحراف المئوية (%)
  costPerKmMad: string;              // تكلفة الكيلومتر بالدرهم (CPK MAD)
  costPerKmEur: string;              // تكلفة الكيلومتر باليورو (CPK EUR)
  totalCostMad: string;              // التكلفة الإجمالية بالدرهم
  financialSavingsOrWasteMad: string;// قيمة الوفر (+) أو الهدر المالي (-) بالدرهم مقارنة بالمعياري
  efficiencyScore: number;           // النقاط من 0 إلى 100
  grade: FuelEfficiencyGrade;        // التصنيف (A+, A, B, C, D)
  rank: number;                      // الترتيب في لوحة الشرف
}

/**
 * مدخلات فحص ومطابقة إيصال محطة الوقود (OCR) مع إحداثيات الشاحنة (GPS) وقراءات CAN-Bus
 */
export interface OcrFuelReceiptAuditInput {
  receiptId: string;
  truckId: number;
  plateNumber: string;
  driverId: number;
  driverName: string;
  stationName: string;
  currency: 'MAD' | 'EUR';
  exchangeRateToMad?: string | number;
  receiptLiters: string | number;
  receiptTotalAmount: string | number;
  receiptTimestamp: string;
  stationLat: number;
  stationLng: number;
  truckGpsLat: number;
  truckGpsLng: number;
  truckGpsTimestamp: string;
  canBusTankLevelBeforeLiters: string | number;
  canBusTankLevelAfterLiters: string | number;
  tankCapacityLiters?: string | number;
  ocrConfidenceScore: number; // 0 to 100
}

/**
 * تنبيه الشذوذ الجنائي للوقود وإيصالات المحطات
 */
export interface FuelBiAnomalyAlert {
  id: string;
  anomalyType: FuelAnomalyType;
  severity: FuelAnomalySeverity;
  status: FuelAnomalyResolutionStatus;
  truckId: number;
  plateNumber: string;
  driverId: number;
  driverName: string;
  stationName: string;
  detectedAt: string;
  gpsDistanceDeviationKm: string;    // المسافة الفاصلة بين إحداثيات المحطة وموقع الشاحنة الفعلي (كم)
  timeDeviationMinutes: number;      // الفارق الزمني بالدقائق بين الفاتورة وتواجد الشاحنة
  claimedLiters: string;             // اللترات المسجلة في الفاتورة (OCR)
  telematicsObservedLiters: string;  // اللترات المرصودة فعلياً في الخزان (CAN-Bus)
  discrepancyLiters: string;         // فارق اللترات غير المبرر
  financialImpactMad: string;        // الأثر المالي بالدرهم المغربي
  originalCurrency: 'MAD' | 'EUR';
  originalAmount: string;
  ocrConfidenceScore: number;
  reasonSummary: string;
}

/**
 * توزيع تكاليف المحروقات حسب العملة (MAD / EUR) والممرات الدولية
 */
export interface CurrencyFuelCostBreakdown {
  madTotalLiters: string;
  madTotalCost: string;
  eurTotalLiters: string;
  eurTotalCostInEur: string;
  eurTotalCostInMad: string;
  exchangeRateUsed: string;
  combinedTotalCostMad: string;
  madSharePct: string;
  eurSharePct: string;
}

/**
 * مقارنة الاستهلاك المعياري بالفعلي عبر الممرات اللوجستية للرسوم البيانية
 */
export interface CorridorConsumptionChartPoint {
  corridorCode: 'MA-ES-FR' | 'MA-MR-SN' | 'DOMESTIC-MA';
  corridorName: string;
  tripsCount: number;
  totalDistanceKm: string;
  baselineLPer100Km: string;
  actualTractorLPer100Km: string;
  reeferAvgLPerHour: string;
  totalTractorLiters: string;
  totalReeferLiters: string;
  totalCostMad: string;
  netSavingsOrWasteMad: string; // موجب = وفر مالي، سالب = هدر مالي
}

/**
 * الملخص التنفيذي الشامل للوحة تحكم ذكاء الأعمال للمحروقات والأسطول
 */
export interface FleetFuelBiDashboardData {
  periodStart: string;
  periodEnd: string;
  activeTrucksCount: number;
  totalTripsAnalyzed: number;
  totalDistanceKm: string;
  totalFuelLiters: string;
  totalTractorLiters: string;
  totalReeferLiters: string;
  fleetBaselineLPer100Km: string;
  fleetActualTractorLPer100Km: string;
  fleetAverageCpkMad: string;
  fleetAverageCpkEur: string;
  netFuelSavingsOrWasteMad: string; // موجب = وفورات، سالب = هدر
  preventedFraudLossMad: string;
  pendingManualReviewCount: number;
  geoMismatchAlertsCount: number;
  currencyBreakdown: CurrencyFuelCostBreakdown;
  corridorChartData: CorridorConsumptionChartPoint[];
  leaderboard: TruckDriverEfficiencyRow[];
  anomalyAlerts: FuelBiAnomalyAlert[];
}

export interface FleetFuelBiFilterInput {
  periodStart?: string;
  periodEnd?: string;
  corridorCode?: 'ALL' | 'MA-ES-FR' | 'MA-MR-SN' | 'DOMESTIC-MA';
  onlyReeferTrips?: boolean;
  anomalySeverity?: 'ALL' | FuelAnomalySeverity;
}

