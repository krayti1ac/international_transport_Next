/**
 * Trans Bodanon TMS — Reefer Cargo Loss & Insurance Claim Assessment Engine
 * Strict Financial Precision via Decimal.js (NON-NEGOTIABLE)
 * Standards: ATP Treaty / INCOTERMS 2020 / EU GDP Guidelines (2013/C 343/01)
 */

import crypto from 'crypto';
import Decimal from 'decimal.js';
import { recordAuditLog } from '@/lib/audit.server';
import {
  calculateDepreciationSchema,
  createInsuranceClaimSchema,
  type CalculateDepreciationInput,
  type CargoDepreciationResult,
  type CreateInsuranceClaimInput,
  type QueryReeferClaimsInput,
  type ReeferCargoInsuranceClaim,
  type ReeferClaimSettlementLine,
  type UpdateClaimStatusInput,
} from '../types/reefer-claim-settlement.types';

Decimal.config({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

const CLAIM_HMAC_SECRET =
  process.env.PDF_SIGNING_KEY || 'trans-bodanon-reefer-claim-hmac-secret-2026';

// Runtime in-memory cache for claims
const CLAIMS_CACHE = new Map<string, ReeferCargoInsuranceClaim>();

export class CargoLossAssessmentService {
  /**
   * Calculates cargo depreciation percentage and loss indemnity strictly via Decimal.js
   */
  public static calculateDepreciation(
    rawParams: CalculateDepreciationInput
  ): CargoDepreciationResult {
    const params = calculateDepreciationSchema.parse(rawParams);
    const insuredVal = new Decimal(params.insuredCargoValue);
    const deductible = new Decimal(params.deductibleAmount);
    const deltaT = new Decimal(params.tempRiseDeltaC);
    const duration = new Decimal(params.durationMinutes);
    const closeTemp = new Decimal(params.tempAtCloseC);
    const maxTemp = new Decimal(params.maxAllowedTempC);

    let depreciationRate = new Decimal(0);
    let isTotalLoss = false;
    let explanation = '';

    switch (params.cargoCategory) {
      case 'pharma_cold': {
        // EU GDP Rule: Severe thermal excursion on biologics/vaccines causes irreversible protein degradation
        const exceedsSevereDuration = duration.greaterThanOrEqualTo(120);
        const exceedsSevereDelta = deltaT.greaterThanOrEqualTo(5.0);
        const exceedsCriticalThreshold = closeTemp.greaterThan(maxTemp.plus(4.0));

        if (exceedsSevereDuration || exceedsSevereDelta || exceedsCriticalThreshold) {
          depreciationRate = new Decimal(100);
          isTotalLoss = true;
          explanation = 'GDP Non-Compliance: Irreversible biologic denaturing (Total Loss 100%)';
        } else if (closeTemp.greaterThan(maxTemp)) {
          const excess = closeTemp.minus(maxTemp);
          const durationHours = duration.dividedBy(60);
          depreciationRate = Decimal.min(
            new Decimal(100),
            excess.times(20).plus(durationHours.times(15))
          );
          explanation = `GDP Minor Excursion: Partial quarantine depreciation at ${depreciationRate.toFixed(1)}%`;
        } else {
          depreciationRate = new Decimal(0);
          explanation = 'Within allowable GDP cold chain parameters (No loss)';
        }
        break;
      }

      case 'deep_frozen': {
        // ATP Frozen Seafood Formula: Min(100%, (ΔT / 8 * 40%) + (ExposureMins / 180 * 60%))
        const tempComponent = deltaT.dividedBy(8).times(40);
        const timeComponent = duration.dividedBy(180).times(60);
        depreciationRate = Decimal.min(new Decimal(100), tempComponent.plus(timeComponent));

        // Critical thaw penalty if product rose above -10°C (structural recrystallization)
        if (closeTemp.greaterThan(-10.0)) {
          depreciationRate = Decimal.min(
            new Decimal(100),
            depreciationRate.plus(new Decimal(25))
          );
          explanation = `Frozen Thaw Hazard: Temperature rose to ${closeTemp.toFixed(1)}°C (Recrystallization factor)`;
        } else {
          explanation = `ATP Seafood Depreciation: Computed at ${depreciationRate.toFixed(1)}%`;
        }

        if (depreciationRate.greaterThanOrEqualTo(100)) {
          isTotalLoss = true;
        }
        break;
      }

      case 'fresh_produce': {
        // Fresh Berries / Fruits: Min(100%, (ΔT / 6 * 50%) + (ExposureMins / 120 * 50%))
        const tempFactor = deltaT.dividedBy(6).times(50);
        const timeFactor = duration.dividedBy(120).times(50);
        depreciationRate = Decimal.min(new Decimal(100), tempFactor.plus(timeFactor));

        if (closeTemp.greaterThan(maxTemp)) {
          const excess = closeTemp.minus(maxTemp);
          depreciationRate = Decimal.min(
            new Decimal(100),
            depreciationRate.plus(excess.times(5))
          );
        }

        explanation = `Perishable Softening & Respiration Acceleration: ${depreciationRate.toFixed(1)}%`;
        if (depreciationRate.greaterThanOrEqualTo(100)) {
          isTotalLoss = true;
        }
        break;
      }

      case 'meat_chilled':
      default: {
        // Chilled Meat: Min(100%, (ΔT / 5 * 45%) + (ExposureMins / 150 * 55%))
        const tempFactor = deltaT.dividedBy(5).times(45);
        const timeFactor = duration.dividedBy(150).times(55);
        depreciationRate = Decimal.min(new Decimal(100), tempFactor.plus(timeFactor));

        if (closeTemp.greaterThan(8.0)) {
          depreciationRate = Decimal.max(new Decimal(50), depreciationRate);
          explanation = 'Microbial Growth Danger: Temperature exceeded 8.0°C safety cap';
        } else {
          explanation = `Chilled Meat Thermal Deterioration: ${depreciationRate.toFixed(1)}%`;
        }

        if (depreciationRate.greaterThanOrEqualTo(100)) {
          isTotalLoss = true;
        }
        break;
      }
    }

    const ratePct = depreciationRate.toDecimalPlaces(2);
    const grossLoss = insuredVal.times(ratePct).dividedBy(100).toDecimalPlaces(2);
    const netIndemnity = Decimal.max(new Decimal(0), grossLoss.minus(deductible)).toDecimalPlaces(2);

    return {
      depreciationRatePct: ratePct.toNumber(),
      isTotalLoss,
      grossLossAmount: grossLoss.toNumber(),
      deductibleAmount: deductible.toNumber(),
      netIndemnityAmount: netIndemnity.toNumber(),
      explanation,
    };
  }

  /**
   * Generates HMAC-SHA256 non-repudiation cryptographic seal for the insurance claim dossier
   */
  public static generateClaimDossierSeal(params: {
    claimReference: string;
    tripId: number;
    cargoCategory: string;
    insuredCargoValue: number;
    depreciationRatePct: number;
    grossLossAmount: number;
    netIndemnityAmount: number;
    policyNumber: string;
    timestamp: string;
  }): string {
    const canonicalString = [
      params.claimReference,
      params.tripId,
      params.cargoCategory,
      new Decimal(params.insuredCargoValue).toFixed(2),
      new Decimal(params.depreciationRatePct).toFixed(2),
      new Decimal(params.grossLossAmount).toFixed(2),
      new Decimal(params.netIndemnityAmount).toFixed(2),
      params.policyNumber,
      params.timestamp,
    ].join('|');

    return crypto
      .createHmac('sha256', CLAIM_HMAC_SECRET)
      .update(canonicalString)
      .digest('hex');
  }

  /**
   * Creates a formal insurance claim record based on e-POD Incident Annex and cargo parameters
   */
  public static async processInsuranceClaim(
    rawInput: CreateInsuranceClaimInput
  ): Promise<ReeferCargoInsuranceClaim> {
    const input = createInsuranceClaimSchema.parse(rawInput);
    const calculation = this.calculateDepreciation({
      cargoCategory: input.cargoCategory,
      durationMinutes: input.durationMinutes,
      tempRiseDeltaC: input.tempRiseDeltaC,
      maxAllowedTempC: input.maxAllowedTempC,
      tempAtCloseC: input.tempAtCloseC,
      mktElevationC: input.mktElevationC,
      insuredCargoValue: input.insuredCargoValue,
      deductibleAmount: input.deductibleAmount,
    });

    const id = `CLM-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 900 + 100)}`;
    const claimReference = `CLM-${input.tripId}-${Date.now().toString(36).toUpperCase()}`;
    const timestamp = new Date().toISOString();

    const claimDossierHash = this.generateClaimDossierSeal({
      claimReference,
      tripId: input.tripId,
      cargoCategory: input.cargoCategory,
      insuredCargoValue: input.insuredCargoValue,
      depreciationRatePct: calculation.depreciationRatePct,
      grossLossAmount: calculation.grossLossAmount,
      netIndemnityAmount: calculation.netIndemnityAmount,
      policyNumber: input.policyNumber,
      timestamp,
    });

    const lines: ReeferClaimSettlementLine[] = (input.lines || []).map((line, idx) => {
      const lineLoss = new Decimal(line.affectedQuantity)
        .times(line.unitValue)
        .times(line.depreciationPct)
        .dividedBy(100)
        .toDecimalPlaces(2)
        .toNumber();

      return {
        id: `LINE-${idx + 1}-${Date.now().toString(36)}`,
        claimId: id,
        itemDescription: line.itemDescription,
        affectedQuantity: line.affectedQuantity,
        unitOfMeasure: line.unitOfMeasure,
        unitValue: line.unitValue,
        depreciationPct: line.depreciationPct,
        lineLossAmount: lineLoss,
        createdAt: timestamp,
      };
    });

    const claim: ReeferCargoInsuranceClaim = {
      id,
      claimReference,
      annexId: input.annexId || null,
      tripId: input.tripId,
      tripNumber: input.tripNumber,
      truckPlate: input.truckPlate,
      driverName: input.driverName,
      cargoCategory: input.cargoCategory,
      insuredCargoValue: input.insuredCargoValue,
      currency: input.currency,
      depreciationRatePct: calculation.depreciationRatePct,
      grossLossAmount: calculation.grossLossAmount,
      deductibleAmount: calculation.deductibleAmount,
      netIndemnityAmount: calculation.netIndemnityAmount,
      insurerName: input.insurerName,
      policyNumber: input.policyNumber,
      claimStatus: 'under_review',
      settlementType: input.settlementType,
      creditNoteNumber:
        input.settlementType === 'credit_note'
          ? `CN-2026-${input.tripId}-${Math.floor(Math.random() * 900 + 100)}`
          : null,
      claimDossierHash,
      lines,
      notes: input.notes || calculation.explanation,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    CLAIMS_CACHE.set(claim.id, claim);

    try {
      await recordAuditLog({
        actionType: 'security_alert',
        entityType: 'trip_orders',
        entityId: input.tripId,
        reason: 'REEFER_INSURANCE_CLAIM_FILED',
        newData: {
          claimReference,
          grossLossAmount: calculation.grossLossAmount,
          netIndemnityAmount: calculation.netIndemnityAmount,
          depreciationRatePct: calculation.depreciationRatePct,
          dossierHash: claimDossierHash.slice(0, 16),
        },
      });
    } catch (e) {
      console.warn('[CargoLossAssessmentService] Audit log skipped:', e);
    }

    return claim;
  }

  /**
   * Updates status of an existing claim (e.g. approved, settled, credit note issued)
   */
  public static async updateClaimStatus(
    input: UpdateClaimStatusInput
  ): Promise<ReeferCargoInsuranceClaim> {
    const claim = CLAIMS_CACHE.get(input.claimId);
    if (!claim) {
      throw new Error(`Insurance claim with ID ${input.claimId} not found`);
    }

    claim.claimStatus = input.status;
    claim.updatedAt = new Date().toISOString();
    if (input.creditNoteNumber) {
      claim.creditNoteNumber = input.creditNoteNumber;
    }
    if (input.status === 'settled') {
      claim.settledAt = new Date().toISOString();
    }
    if (input.notes) {
      claim.notes = `${claim.notes || ''} | ${input.notes}`;
    }

    CLAIMS_CACHE.set(claim.id, claim);

    try {
      await recordAuditLog({
        actionType: 'update',
        entityType: 'trip_orders',
        entityId: claim.tripId,
        reason: `REEFER_CLAIM_STATUS_${input.status.toUpperCase()}`,
        newData: {
          claimReference: claim.claimReference,
          status: input.status,
          creditNoteNumber: claim.creditNoteNumber,
        },
      });
    } catch (e) {
      console.warn('[CargoLossAssessmentService] Audit log skipped:', e);
    }

    return claim;
  }

  /**
   * Queries recorded claims with realistic demo persistence
   */
  public static async queryClaims(
    query: QueryReeferClaimsInput
  ): Promise<{ items: ReeferCargoInsuranceClaim[]; totalCount: number }> {
    let items = Array.from(CLAIMS_CACHE.values());

    if (items.length === 0) {
      const now = Date.now();
      items = [
        {
          id: 'CLM-DEMO-01',
          claimReference: 'CLM-2026-8840-A1',
          annexId: 'ANNEX-8840-A1',
          tripId: 8840,
          tripNumber: 'TRIP-2026-8840',
          truckPlate: '67890-A-40',
          driverName: 'Mohamed El Idrissi',
          cargoCategory: 'fresh_produce',
          insuredCargoValue: 145000.0,
          currency: 'MAD',
          depreciationRatePct: 42.5,
          grossLossAmount: 61625.0,
          deductibleAmount: 5000.0,
          netIndemnityAmount: 56625.0,
          insurerName: 'Allianz Maroc (Transport Frigo)',
          policyNumber: 'POL-FRIGO-2026-TANGIER',
          claimStatus: 'approved_by_insurer',
          settlementType: 'credit_note',
          creditNoteNumber: 'CN-2026-8840-01',
          claimDossierHash: 'f4d92b3a8e716c59048a1b2d7e8f90c4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0',
          lines: [
            {
              id: 'LINE-1',
              claimId: 'CLM-DEMO-01',
              itemDescription: 'Fraise de Larache (Grade A Export)',
              affectedQuantity: 12000,
              unitOfMeasure: 'kg',
              unitValue: 12.0,
              depreciationPct: 42.5,
              lineLossAmount: 61200.0,
            },
          ],
          notes: 'Excessive dock door exposure at Mercamadrid (+5.6°C rise)',
          createdAt: new Date(now - 86400000).toISOString(),
          updatedAt: new Date(now - 3600000).toISOString(),
        },
        {
          id: 'CLM-DEMO-02',
          claimReference: 'CLM-2026-8842-B2',
          annexId: 'ANNEX-8842-B2',
          tripId: 8842,
          tripNumber: 'TRIP-2026-8842',
          truckPlate: '44521-B-1',
          driverName: 'Rachid Bennani',
          cargoCategory: 'deep_frozen',
          insuredCargoValue: 280000.0,
          currency: 'MAD',
          depreciationRatePct: 18.0,
          grossLossAmount: 50400.0,
          deductibleAmount: 5000.0,
          netIndemnityAmount: 45400.0,
          insurerName: 'RMA Watanya',
          policyNumber: 'POL-SEAFOOD-2026-DAKHLA',
          claimStatus: 'settled',
          settlementType: 'insurance_wire',
          claimDossierHash: 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2',
          lines: [
            {
              id: 'LINE-2',
              claimId: 'CLM-DEMO-02',
              itemDescription: 'Poulpe Congelé Dakhla (-20°C IQF)',
              affectedQuantity: 3500,
              unitOfMeasure: 'kg',
              unitValue: 80.0,
              depreciationPct: 18.0,
              lineLossAmount: 50400.0,
            },
          ],
          settledAt: new Date(now - 7200000).toISOString(),
          notes: 'Settled via RMA Wire transfer to commercial escrow',
          createdAt: new Date(now - 172800000).toISOString(),
          updatedAt: new Date(now - 7200000).toISOString(),
        },
      ];

      items.forEach((c) => CLAIMS_CACHE.set(c.id, c));
    }

    if (query.tripId) {
      items = items.filter((c) => c.tripId === query.tripId);
    }
    if (query.status) {
      items = items.filter((c) => c.claimStatus === query.status);
    }
    if (query.cargoCategory) {
      items = items.filter((c) => c.cargoCategory === query.cargoCategory);
    }

    return {
      items: items.slice(0, query.limit),
      totalCount: items.length,
    };
  }
}
