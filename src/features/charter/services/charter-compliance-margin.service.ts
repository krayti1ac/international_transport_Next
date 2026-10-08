/**
 * Trans Bodanon TMS — Charter Compliance & Brokerage Margin Service
 * Calculates exact brokerage margins using Decimal.js and strictly validates carrier and vehicle legal compliance.
 */

import Decimal from 'decimal.js';
import type {
  SubcontractorCarrier,
  SubcontractorTruck,
  SubcontractorDriver,
  BrokerageMarginBreakdown,
  DocumentComplianceReport,
  SubcontractorComplianceStatus,
} from '../types/charter.types';

Decimal.config({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

export const MINIMUM_SAFE_BROKERAGE_MARGIN_PERCENT = 8.0; // 8% minimum threshold

/**
 * Calculates deterministic brokerage margins and safety levels via Decimal.js
 */
export function calculateBrokerageMargin(
  shipperAgreedRate: string | number,
  subcontractorBuyRate: string | number,
  currency: string = 'MAD',
  extraReinvoicedExpenses: string | number = 0
): BrokerageMarginBreakdown {
  const shipperDec = new Decimal(shipperAgreedRate || 0);
  const buyDec = new Decimal(subcontractorBuyRate || 0);
  const extraDec = new Decimal(extraReinvoicedExpenses || 0);

  // Gross Brokerage Margin = Shipper Agreed Rate - Subcontractor Buy Rate
  const grossMarginDec = shipperDec.minus(buyDec);

  const marginPercentDec = shipperDec.greaterThan(0)
    ? grossMarginDec.dividedBy(shipperDec).times(100)
    : new Decimal(0);

  const isProfitable = grossMarginDec.greaterThan(0);
  const negativeMarginAlert = grossMarginDec.isNegative();

  let marginSafetyLevel: 'optimum' | 'moderate' | 'hazard_negative' = 'optimum';
  if (negativeMarginAlert) {
    marginSafetyLevel = 'hazard_negative';
  } else if (marginPercentDec.lessThan(MINIMUM_SAFE_BROKERAGE_MARGIN_PERCENT)) {
    marginSafetyLevel = 'moderate';
  }

  return {
    shipperAgreedRate: shipperDec.toFixed(2),
    subcontractorBuyRate: buyDec.toFixed(2),
    extraReinvoicedExpenses: extraDec.toFixed(2),
    grossBrokerageMargin: grossMarginDec.toFixed(2),
    brokerageMarginPercent: marginPercentDec.toFixed(2),
    currency: currency.toUpperCase(),
    isProfitable,
    negativeMarginAlert,
    marginSafetyLevel,
  };
}

/**
 * Validates Moroccan ICE format (15 numerical digits)
 */
export function isValidMoroccanIce(ice?: string): boolean {
  if (!ice) return false;
  const cleaned = ice.trim();
  return /^\d{15}$/.test(cleaned);
}

/**
 * Helper to compute days until expiration
 */
export function getDaysUntilExpiration(expiryDateStr: string, refDateStr?: string): number {
  if (!expiryDateStr) return -999;
  const expiry = new Date(expiryDateStr);
  const ref = refDateStr ? new Date(refDateStr) : new Date();

  // Reset time portions for pure day calculation
  expiry.setHours(0, 0, 0, 0);
  ref.setHours(0, 0, 0, 0);

  const diffMs = expiry.getTime() - ref.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Performs rigorous multi-point document and legal compliance checks
 */
export function verifyCarrierAndFleetCompliance(params: {
  carrier: SubcontractorCarrier;
  truck?: SubcontractorTruck | null;
  driver?: SubcontractorDriver | null;
  corridor?: 'european_maritime' | 'african_overland' | 'domestic';
  referenceDate?: string;
}): DocumentComplianceReport {
  const { carrier, truck, driver, corridor = 'european_maritime', referenceDate } = params;

  const expiredDocuments: string[] = [];
  const expiringSoonDocuments: string[] = [];
  const blockingIssues: string[] = [];

  // 1. Blacklist Check
  if (carrier.isBlacklisted) {
    blockingIssues.push(`الناقل مدرج في القائمة السوداء (${carrier.companyName})`);
  }

  // 2. ICE Verification
  if (!isValidMoroccanIce(carrier.ice)) {
    blockingIssues.push(`المعرف الموحد للمقاولة (ICE) غير صحيح أو غير مكون من 15 رقماً: ${carrier.ice || 'غير محدد'}`);
  }

  // 3. CMR Goods Insurance Check
  const cmrDays = getDaysUntilExpiration(carrier.cmrInsuranceExpiryDate, referenceDate);
  if (cmrDays < 0) {
    expiredDocuments.push(`بوليصة تأمين البضائع CMR منتهية الصلاحية (${carrier.cmrInsurancePolicyNumber})`);
    blockingIssues.push('تأمين البضائع CMR منتهي');
  } else if (cmrDays <= 15) {
    expiringSoonDocuments.push(`بوليصة تأمين CMR تنتهي خلال ${cmrDays} يوم`);
  }

  // 4. International Transport License Check
  const licenseDays = getDaysUntilExpiration(carrier.internationalTransportLicenseExpiryDate, referenceDate);
  if (licenseDays < 0) {
    expiredDocuments.push(`ترخيص النقل الدولي منتهي الصلاحية (${carrier.internationalTransportLicenseNumber})`);
    blockingIssues.push('ترخيص النقل الدولي منتهي');
  } else if (licenseDays <= 15) {
    expiringSoonDocuments.push(`ترخيص النقل الدولي ينتهي خلال ${licenseDays} يوم`);
  }

  // 5. Truck Document Verification
  if (truck) {
    // Carte Grise
    const carteDays = getDaysUntilExpiration(truck.carteGriseExpiryDate, referenceDate);
    if (carteDays < 0) {
      expiredDocuments.push(`البطاقة الرمادية للشاحنة ${truck.plateNumber} منتهية`);
      blockingIssues.push('البطاقة الرمادية منتهية');
    } else if (carteDays <= 15) {
      expiringSoonDocuments.push(`البطاقة الرمادية للشاحنة تنتهي خلال ${carteDays} يوم`);
    }

    // Technical Inspection
    const techDays = getDaysUntilExpiration(truck.technicalInspectionExpiryDate, referenceDate);
    if (techDays < 0) {
      expiredDocuments.push(`الفحص التقني للشاحنة ${truck.plateNumber} منتهي`);
      blockingIssues.push('الفحص التقني للشاحنة منتهي');
    } else if (techDays <= 15) {
      expiringSoonDocuments.push(`الفحص التقني للشاحنة ينتهي خلال ${techDays} يوم`);
    }

    // Reefer ATP Certificate (Mandatory for frigo trucks)
    if (truck.hasReeferUnit && truck.atpCertificateExpiryDate) {
      const atpDays = getDaysUntilExpiration(truck.atpCertificateExpiryDate, referenceDate);
      if (atpDays < 0) {
        expiredDocuments.push(`شهادة مطابقة التبريد ATP للشاحنة ${truck.plateNumber} منتهية`);
        blockingIssues.push('شهادة تبريد ATP منتهية');
      } else if (atpDays <= 15) {
        expiringSoonDocuments.push(`شهادة تبريد ATP تنتهي خلال ${atpDays} يوم`);
      }
    }
  }

  // 6. Driver Document Verification
  if (driver) {
    const driverLicenseDays = getDaysUntilExpiration(driver.licenseExpiryDate, referenceDate);
    if (driverLicenseDays < 0) {
      expiredDocuments.push(`رخصة قيادة السائق ${driver.name} منتهية`);
      blockingIssues.push('رخصة القيادة منتهية');
    } else if (driverLicenseDays <= 15) {
      expiringSoonDocuments.push(`رخصة القيادة تنتهي خلال ${driverLicenseDays} يوم`);
    }

    // Schengen Visa for European Maritime Corridor
    if (corridor === 'european_maritime' && driver.schengenVisaExpiryDate) {
      const visaDays = getDaysUntilExpiration(driver.schengenVisaExpiryDate, referenceDate);
      if (visaDays < 0) {
        expiredDocuments.push(`تأشيرة شنغن للسائق ${driver.name} منتهية`);
        blockingIssues.push('تأشيرة شنغن منتهية للممر الأوروبي');
      } else if (visaDays <= 15) {
        expiringSoonDocuments.push(`تأشيرة شنغن تنتهي خلال ${visaDays} يوم`);
      }
    }
  }

  let status: SubcontractorComplianceStatus = 'compliant';
  if (blockingIssues.length > 0 || expiredDocuments.length > 0) {
    status = 'expired';
  } else if (expiringSoonDocuments.length > 0) {
    status = 'warning';
  }

  return {
    isFullyCompliant: status === 'compliant',
    status,
    expiredDocuments,
    expiringSoonDocuments,
    blockingIssues,
    carrierChecked: carrier.companyName,
  };
}

