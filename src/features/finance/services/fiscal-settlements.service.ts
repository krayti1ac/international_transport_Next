import Decimal from 'decimal.js';
import type {
  CalculateDriverSettlementInput,
  DriverSettlementCalculationResult,
  CalculateTripPnlInput,
  TripPnlCalculationResult,
  ItemizedExpenseRecord,
} from '../types/fiscal-settlements.types';

// Strict financial precision configuration
Decimal.config({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

export class FiscalSettlementsService {
  /**
   * حساب تصفية مستحقات ومصروفات السائق الشهرية أو الدولية بدقة متناهية
   * Enforces zero floating-point arithmetic using Decimal.js
   */
  public static calculateDriverSettlement(
    input: CalculateDriverSettlementInput
  ): DriverSettlementCalculationResult {
    // 1. حساب المستحقات الأساسية والمكافآت
    const baseSalaryDec = new Decimal(input.baseSalary || 0);
    const bonusPctDec = new Decimal(input.bonusPercentage || 0).dividedBy(100);

    // حساب إجمالي إيرادات الرحلات المنجزة
    let totalTripRevenueDec = new Decimal(0);
    let totalDistanceDec = new Decimal(0);

    input.trips.forEach((t) => {
      const exportPrice = new Decimal(t.price_export || 0);
      const importPrice = new Decimal(t.price_import || 0);
      const roundTrip = exportPrice.plus(importPrice);
      const revenue = roundTrip.greaterThan(0) ? roundTrip : new Decimal(t.price || 0);
      totalTripRevenueDec = totalTripRevenueDec.plus(revenue);

      if (t.distance_km) {
        totalDistanceDec = totalDistanceDec.plus(new Decimal(t.distance_km));
      }
    });

    const missionBonusesDec = totalTripRevenueDec.times(bonusPctDec);

    // مكافأة السلامة والقيادة الآمنة (500 درهم عند مؤشر >= 90)
    const score = input.safetyScore !== undefined ? input.safetyScore : 100;
    const safetyBonusDec = score >= 90 ? new Decimal(500) : new Decimal(0);

    const grossEarningsDec = baseSalaryDec.plus(missionBonusesDec).plus(safetyBonusDec);

    // 2. تجميع السلف المسلمة للسائق
    let totalAdvancesDec = new Decimal(0);
    const itemizedExpenses: ItemizedExpenseRecord[] = [];

    input.advances.forEach((adv) => {
      const amt = new Decimal(adv.amount || 0);
      totalAdvancesDec = totalAdvancesDec.plus(amt);
      itemizedExpenses.push({
        id: `adv-${adv.id}`,
        category: 'advance',
        amount: amt.toDecimalPlaces(2).toNumber(),
        currency: 'MAD',
        date: adv.date,
        reference: `ADV-#${adv.id}`,
        description: adv.reason || 'سلفة تشغيلية على ذمة الرحلة / مصاريف طريق',
        isAttributableToDriver: true,
      });
    });

    // 3. تجميع مصاريف الوقود الموثقة
    let totalFuelDec = new Decimal(0);
    input.fuelExpenses.forEach((f) => {
      const amt = new Decimal(f.amount || 0);
      totalFuelDec = totalFuelDec.plus(amt);
      itemizedExpenses.push({
        id: `fuel-${f.id}`,
        category: 'fuel',
        amount: amt.toDecimalPlaces(2).toNumber(),
        currency: 'MAD',
        date: f.date || new Date().toISOString().split('T')[0],
        reference: f.invoice_number || `FUEL-#${f.id}`,
        description: f.description || 'تعبئة وقود الشاحنة (بونات / فواتير محطة)',
        isAttributableToDriver: false,
      });
    });

    // 4. تجميع رسوم الطرق الأوروبية والمحلية (Via-T / Télépéage / Vignettes)
    let totalTollsDec = new Decimal(0);
    input.tollExpenses.forEach((toll) => {
      // إذا كان المبلغ بالدرهم متوفراً نستخدمه، وإلا نحوله من اليورو بمعامل الصرف (10.85)
      const tollMad =
        toll.amount_mad !== undefined && toll.amount_mad !== null
          ? new Decimal(toll.amount_mad)
          : new Decimal(toll.amount_eur || 0).times(new Decimal(10.85));

      totalTollsDec = totalTollsDec.plus(tollMad);
      itemizedExpenses.push({
        id: `toll-${toll.id}`,
        category: 'toll',
        amount: tollMad.toDecimalPlaces(2).toNumber(),
        currency: 'MAD',
        date: toll.exit_time ? toll.exit_time.split('T')[0] : new Date().toISOString().split('T')[0],
        reference: `${toll.toll_system.toUpperCase()}-${toll.highway_code || toll.id}`,
        description: `رسوم طريق سريع دولية (${toll.toll_system} - ${toll.highway_code || 'بوابة عبور'})`,
        isAttributableToDriver: false,
      });
    });

    // 5. تجميع مصاريف العبّارات والترانزيت البحري
    let totalFerriesDec = new Decimal(0);
    input.ferryExpenses.forEach((fe) => {
      const amt = new Decimal(fe.amount || 0);
      totalFerriesDec = totalFerriesDec.plus(amt);
      itemizedExpenses.push({
        id: `ferry-${fe.id}`,
        category: 'ferry',
        amount: amt.toDecimalPlaces(2).toNumber(),
        currency: 'MAD',
        date: fe.date || new Date().toISOString().split('T')[0],
        reference: `FERRY-#${fe.id}`,
        description: `تذكرة عبّارة بحرية (${fe.ferry_company || 'ميناء طنجة المتوسط - الجزيرة الخضراء'})`,
        isAttributableToDriver: false,
      });
    });

    // 6. تجميع مصاريف الموانئ والجمارك (تريبتيك، ألميريا، مرسى المغرب، الكركرات)
    let totalPortCustomsDec = new Decimal(0);
    if (input.portCustomsExpenses) {
      input.portCustomsExpenses.forEach((pc) => {
        const amt = new Decimal(pc.amount || 0);
        totalPortCustomsDec = totalPortCustomsDec.plus(amt);
        itemizedExpenses.push({
          id: `pc-${pc.id}`,
          category: 'port_customs',
          amount: amt.toDecimalPlaces(2).toNumber(),
          currency: 'MAD',
          date: pc.date || new Date().toISOString().split('T')[0],
          reference: `PORT-${pc.id}`,
          description: pc.description || 'مصاريف ترانزيت جمركي ومينائي',
          isAttributableToDriver: false,
        });
      });
    }

    // 7. تجميع المصروفات النثرية الأخرى المقبولة
    let totalOtherDec = new Decimal(0);
    if (input.otherExpenses) {
      input.otherExpenses.forEach((oe) => {
        const amt = new Decimal(oe.amount || 0);
        totalOtherDec = totalOtherDec.plus(amt);
        itemizedExpenses.push({
          id: `oth-${oe.id}`,
          category: 'other',
          amount: amt.toDecimalPlaces(2).toNumber(),
          currency: 'MAD',
          date: oe.date || new Date().toISOString().split('T')[0],
          reference: `OTH-${oe.id}`,
          description: oe.description || 'مصاريف طارئة معتمدة',
          isAttributableToDriver: false,
        });
      });
    }

    // إجمالي مصاريف الطريق الموثقة بالفواتير والإيصالات
    const totalDriverExpensesDec = totalFuelDec
      .plus(totalTollsDec)
      .plus(totalFerriesDec)
      .plus(totalPortCustomsDec)
      .plus(totalOtherDec);

    // 8. موازنة السلف مقابل المصروفات (Reconciliation Balance)
    // موجب: السائق صرف من جيبه أكثر من السلف -> الشركة تعوضه
    // سالب: السائق صرف أقل من السلف -> يتبقى بذمته فائض سلف يخصم من راتبه
    const expensesVsAdvancesBalanceDec = totalDriverExpensesDec.minus(totalAdvancesDec);

    // 9. تجميع الغرامات والمخالفات المترتبة على إهمال السائق
    let totalFinesToDeductDec = new Decimal(0);
    input.fines.forEach((f) => {
      if (!f.deducted_from_settlement) {
        const amt = new Decimal(f.amount || 0);
        totalFinesToDeductDec = totalFinesToDeductDec.plus(amt);
        itemizedExpenses.push({
          id: `fine-${f.id}`,
          category: 'fine',
          amount: amt.toDecimalPlaces(2).toNumber(),
          currency: 'MAD',
          date: f.date || new Date().toISOString().split('T')[0],
          reference: `FINE-#${f.id}`,
          description: `خصم مخالفة تشغيلية (${f.fine_type})`,
          isAttributableToDriver: true,
        });
      }
    });

    // 10. صافي الصرف للسائق (Net Payout)
    // netPayout = grossEarnings + expensesVsAdvancesBalance - totalFinesToDeduct
    const netPayoutDec = grossEarningsDec
      .plus(expensesVsAdvancesBalanceDec)
      .minus(totalFinesToDeductDec);

    return {
      baseSalary: baseSalaryDec.toDecimalPlaces(2).toNumber(),
      missionBonuses: missionBonusesDec.toDecimalPlaces(2).toNumber(),
      safetyBonus: safetyBonusDec.toDecimalPlaces(2).toNumber(),
      grossEarnings: grossEarningsDec.toDecimalPlaces(2).toNumber(),

      totalAdvances: totalAdvancesDec.toDecimalPlaces(2).toNumber(),
      totalFuel: totalFuelDec.toDecimalPlaces(2).toNumber(),
      totalTolls: totalTollsDec.toDecimalPlaces(2).toNumber(),
      totalFerries: totalFerriesDec.toDecimalPlaces(2).toNumber(),
      totalPortCustoms: totalPortCustomsDec.toDecimalPlaces(2).toNumber(),
      totalOtherExpenses: totalOtherDec.toDecimalPlaces(2).toNumber(),
      totalDriverExpenses: totalDriverExpensesDec.toDecimalPlaces(2).toNumber(),

      expensesVsAdvancesBalance: expensesVsAdvancesBalanceDec.toDecimalPlaces(2).toNumber(),
      totalFinesToDeduct: totalFinesToDeductDec.toDecimalPlaces(2).toNumber(),
      netPayout: netPayoutDec.toDecimalPlaces(2).toNumber(),

      tripsCount: input.trips.length,
      totalDistanceKm: totalDistanceDec.toDecimalPlaces(2).toNumber(),
      itemizedExpenses,
    };
  }

  /**
   * حساب ومصادقة الربحية التشغيلية لرحلة دولية (Trip P&L) بدقة Decimal.js
   */
  public static calculateTripPnl(input: CalculateTripPnlInput): TripPnlCalculationResult {
    const revenueDec = new Decimal(input.revenue || 0);
    const fuelCostDec = new Decimal(input.fuelCost || 0);
    const tollsCostDec = new Decimal(input.tollsCost || 0);
    const ferryCostDec = new Decimal(input.ferryCost || 0);
    const customsPortsCostDec = new Decimal(input.customsPortsCost || 0);
    const driverCostDec = new Decimal(input.driverCost || 0);
    const otherCostsDec = new Decimal(input.otherCosts || 0);

    const totalCostsDec = fuelCostDec
      .plus(tollsCostDec)
      .plus(ferryCostDec)
      .plus(customsPortsCostDec)
      .plus(driverCostDec)
      .plus(otherCostsDec);

    const grossProfitDec = revenueDec.minus(totalCostsDec);

    const profitMarginPctDec = revenueDec.greaterThan(0)
      ? grossProfitDec.dividedBy(revenueDec).times(100)
      : new Decimal(0);

    const marginNumber = profitMarginPctDec.toDecimalPlaces(2).toNumber();

    let profitabilityTier: 'exceptional' | 'healthy' | 'tight' | 'loss' = 'loss';
    if (grossProfitDec.isNegative()) {
      profitabilityTier = 'loss';
    } else if (marginNumber >= 25) {
      profitabilityTier = 'exceptional';
    } else if (marginNumber >= 15) {
      profitabilityTier = 'healthy';
    } else if (marginNumber >= 0) {
      profitabilityTier = 'tight';
    } else {
      profitabilityTier = 'loss';
    }

    return {
      tripId: input.tripId,
      revenue: revenueDec.toDecimalPlaces(2).toNumber(),
      fuelCost: fuelCostDec.toDecimalPlaces(2).toNumber(),
      tollsCost: tollsCostDec.toDecimalPlaces(2).toNumber(),
      ferryCost: ferryCostDec.toDecimalPlaces(2).toNumber(),
      customsPortsCost: customsPortsCostDec.toDecimalPlaces(2).toNumber(),
      driverCost: driverCostDec.toDecimalPlaces(2).toNumber(),
      otherCosts: otherCostsDec.toDecimalPlaces(2).toNumber(),
      totalCosts: totalCostsDec.toDecimalPlaces(2).toNumber(),
      grossProfit: grossProfitDec.toDecimalPlaces(2).toNumber(),
      profitMarginPct: marginNumber,
      profitabilityTier,
    };
  }

  /**
   * إنشاء رقم تسوية فريد ورسمي
   * e.g. STMT-202610-D04-89B2
   */
  public static generateStatementNumber(driverId: number, periodStart: string): string {
    const cleanPeriod = periodStart.replace(/-/g, '').slice(0, 6); // e.g. 202610
    const padDriver = String(driverId).padStart(2, '0');
    const suffix = Math.floor(1000 + Math.random() * 9000);
    return `STMT-${cleanPeriod}-D${padDriver}-${suffix}`;
  }
}
