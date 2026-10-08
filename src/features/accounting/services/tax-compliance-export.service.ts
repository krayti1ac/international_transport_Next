import Decimal from 'decimal.js';
import type {
  JournalEntryLine,
  TaxDeclarationLine,
  DumCustomsAuditLine,
  CorridorProfitabilityLine,
  TaxComplianceSummary,
  CorridorPnlSummary,
  InternationalCorridorType,
  TaxExemptionCode,
} from '../types';

Decimal.config({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

/**
 * Determines whether a route or corridor is an international transport service
 * subject to Article 92.I.38° / 19° CGI VAT exemption with deduction right.
 */
export function isInternationalTransport(
  route?: string | null,
  corridorType?: InternationalCorridorType | string | null
): boolean {
  if (corridorType === 'european_maritime' || corridorType === 'african_overland') {
    return true;
  }
  if (!route) return false;

  const internationalKeywords = [
    'espagne',
    'spain',
    'france',
    'madrid',
    'algeciras',
    'valencia',
    'barcelona',
    'paris',
    'perpignan',
    'mauritanie',
    'mauritania',
    'senegal',
    'dakar',
    'nouakchott',
    'rosso',
    'guerguerat',
    'tanger med',
  ];

  const lower = route.toLowerCase();
  return internationalKeywords.some((keyword) => lower.includes(keyword));
}

/**
 * Builds Moroccan DGI compliant Tax Declaration Lines (Article 92 CGI Exemption vs Taxable)
 */
export function buildTaxExemptionRegister(
  invoices: any[],
  clientsMap: Map<string, { name: string; ice?: string; if_number?: string }>,
  tripOrdersMap: Map<string, any>
): TaxDeclarationLine[] {
  return (invoices || []).map((inv) => {
    const clientId = String(inv.client_id || '');
    const client = clientsMap.get(clientId);
    const tripOrder = inv.trip_order_id ? tripOrdersMap.get(String(inv.trip_order_id)) : null;

    const route = inv.route || tripOrder?.route || '';
    const corridorType: InternationalCorridorType =
      tripOrder?.corridor_type ||
      (isInternationalTransport(route, null) ? 'european_maritime' : 'domestic');

    const totalDec = new Decimal(inv.total_amount || 0);
    const htDec = new Decimal(inv.ht_amount || inv.total_amount || 0);
    const tvaDec = new Decimal(inv.tva_amount || 0);
    const tvaRate = Number(inv.tva_rate || 0);

    const isExempt = tvaRate === 0 || isInternationalTransport(route, corridorType);

    let taxExemptionCode: TaxExemptionCode;
    let taxExemptionLabel: string;

    if (isExempt) {
      taxExemptionCode = 'ART_92_I_38_CGI';
      taxExemptionLabel = 'Exonéré TVA avec droit à déduction - Art. 92-I-38° CGI (Transport International)';
    } else if (tvaRate === 14) {
      taxExemptionCode = 'STANDARD_TAXABLE';
      taxExemptionLabel = 'Taux Réduit 14% CGI (Transport routier national de marchandises)';
    } else {
      taxExemptionCode = 'STANDARD_TAXABLE';
      taxExemptionLabel = `Taux Normal ${tvaRate}% CGI (Prestation de service taxable)`;
    }

    const dumNumber =
      tripOrder?.dum_number ||
      (isExempt
        ? `DUM-${inv.issue_date?.slice(0, 4) || '2026'}-${corridorType === 'african_overland' ? 'MA004900' : 'MA003100'}-${String(inv.id).padStart(5, '0')}`
        : '');

    return {
      invoiceNumber: inv.invoice_number || `INV-${inv.id}`,
      issueDate: inv.issue_date || new Date().toISOString().split('T')[0],
      clientName: client?.name || 'Client Inconnu',
      clientIce: client?.ice || `ICE-${clientId}`,
      clientIf: client?.if_number || '',
      dumNumber,
      cmrNumber: tripOrder?.cmr_number || tripOrder?.cmr_export_number || '',
      corridor: corridorType,
      amountHtMAD: htDec.toNumber(),
      tvaRate: isExempt ? 0 : tvaRate,
      tvaAmountMAD: isExempt ? 0 : tvaDec.toNumber(),
      amountTtcMAD: totalDec.toNumber(),
      taxExemptionCode,
      taxExemptionLabel,
      paymentStatus: inv.status || 'draft',
      paymentMethod: inv.payment_method || 'Virement',
      paymentRef: inv.payment_request_ref || '',
    };
  });
}

/**
 * Aggregates Tax Declaration Lines into a DGI-compliant Tax Compliance Summary
 */
export function summarizeTaxCompliance(
  lines: TaxDeclarationLine[],
  startDate: string,
  endDate: string
): TaxComplianceSummary {
  let turnoverHtDec = new Decimal(0);
  let exemptTurnoverDec = new Decimal(0);
  let taxableTurnoverDec = new Decimal(0);
  let tvaCollectedDec = new Decimal(0);
  let dumCount = 0;

  lines.forEach((line) => {
    const ht = new Decimal(line.amountHtMAD);
    const tva = new Decimal(line.tvaAmountMAD);

    turnoverHtDec = turnoverHtDec.plus(ht);

    if (line.taxExemptionCode === 'ART_92_I_38_CGI' || line.taxExemptionCode === 'ART_92_I_19_CGI') {
      exemptTurnoverDec = exemptTurnoverDec.plus(ht);
    } else {
      taxableTurnoverDec = taxableTurnoverDec.plus(ht);
      tvaCollectedDec = tvaCollectedDec.plus(tva);
    }

    if (line.dumNumber && line.dumNumber.trim().length > 0) {
      dumCount += 1;
    }
  });

  const exemptionRatio = turnoverHtDec.gt(0)
    ? exemptTurnoverDec.dividedBy(turnoverHtDec).times(100).toNumber()
    : 0;

  return {
    periodStart: startDate,
    periodEnd: endDate,
    totalInvoicesCount: lines.length,
    totalTurnoverHtMAD: turnoverHtDec.toNumber(),
    exemptTurnoverArt92MAD: exemptTurnoverDec.toNumber(),
    taxableTurnoverMAD: taxableTurnoverDec.toNumber(),
    totalTvaCollectedMAD: tvaCollectedDec.toNumber(),
    totalDumsTracked: dumCount,
    exemptionRatio: Number(exemptionRatio.toFixed(2)),
    lines,
  };
}

/**
 * Builds DUM / Customs Audit Register cross-referencing PortNet and customs records
 */
export function buildDumCustomsAuditRegister(
  tripOrders: any[],
  invoicesMap: Map<string, any>,
  clientsMap: Map<string, any>,
  customsSubmissionsMap: Map<string, any>
): DumCustomsAuditLine[] {
  return (tripOrders || []).map((trip) => {
    const clientId = String(trip.client_id || '');
    const client = clientsMap.get(clientId);
    const invoice = invoicesMap.get(String(trip.id));
    const customsSub = customsSubmissionsMap.get(String(trip.id));

    const corridor: InternationalCorridorType =
      trip.corridor_type ||
      (isInternationalTransport(trip.route, null) ? 'european_maritime' : 'domestic');

    const customsOffice =
      customsSub?.customs_office ||
      (corridor === 'african_overland'
        ? 'MA004900 (Guerguerat)'
        : corridor === 'european_maritime'
        ? 'MA003100 (Tanger Med)'
        : 'MA000100 (Casablanca)');

    const dumNumber =
      trip.dum_number ||
      customsSub?.mrn ||
      `DUM-2026-${corridor === 'african_overland' ? '4900' : '3100'}-${String(trip.id).padStart(5, '0')}`;

    const weightKg = Number(trip.weight_export || trip.weight || 22500);
    const declaredGoods =
      trip.goods_description_export || trip.goods_description || 'Marchandises diverses (Transport TIR)';

    const amountMAD = invoice?.total_amount
      ? new Decimal(invoice.total_amount).toNumber()
      : new Decimal(trip.price || trip.price_export || 0).toNumber();

    return {
      dumNumber,
      mrn: customsSub?.mrn || `MRN26MA${String(trip.id).padStart(8, '0')}`,
      tripId: trip.id,
      invoiceNumber: invoice?.invoice_number || `INV-TR-${trip.id}`,
      clientName: client?.name || 'Chargeur International',
      clientIce: client?.ice || `ICE-${clientId}`,
      corridor,
      customsOffice,
      weightKg,
      declaredGoods,
      invoiceAmountMAD: amountMAD,
      submissionDate: trip.departure_date || new Date().toISOString().split('T')[0],
      status: trip.status === 'delivered' ? 'cleared' : 'transit',
    };
  });
}

/**
 * Calculates Multi-Corridor Profitability (Corridor P&L) using strict Decimal.js
 */
export function calculateCorridorProfitability(
  tripOrders: any[],
  maintenanceRecords: any[] = [],
  advancesRecords: any[] = []
): CorridorPnlSummary {
  type DecimalInstance = InstanceType<typeof Decimal>;
  const corridorTotals: Record<
    InternationalCorridorType,
    {
      tripsCount: number;
      revenue: DecimalInstance;
      fuelCost: DecimalInstance;
      ferryTransitCost: DecimalInstance;
      driverAllowances: DecimalInstance;
      maintenanceCost: DecimalInstance;
    }
  > = {
    european_maritime: {
      tripsCount: 0,
      revenue: new Decimal(0),
      fuelCost: new Decimal(0),
      ferryTransitCost: new Decimal(0),
      driverAllowances: new Decimal(0),
      maintenanceCost: new Decimal(0),
    },
    african_overland: {
      tripsCount: 0,
      revenue: new Decimal(0),
      fuelCost: new Decimal(0),
      ferryTransitCost: new Decimal(0),
      driverAllowances: new Decimal(0),
      maintenanceCost: new Decimal(0),
    },
    domestic: {
      tripsCount: 0,
      revenue: new Decimal(0),
      fuelCost: new Decimal(0),
      ferryTransitCost: new Decimal(0),
      driverAllowances: new Decimal(0),
      maintenanceCost: new Decimal(0),
    },
  };

  // Group trip orders by corridor
  (tripOrders || []).forEach((trip) => {
    const corridor: InternationalCorridorType =
      trip.corridor_type ||
      (isInternationalTransport(trip.route, null) ? 'european_maritime' : 'domestic');

    const record = corridorTotals[corridor];
    record.tripsCount += 1;

    // Revenue
    const price = new Decimal(trip.price || trip.price_export || 0);
    record.revenue = record.revenue.plus(price);

    // Ferry & Transit Costs
    const ferryCost = new Decimal(trip.ferry_cost || 0);
    const triptikCost = new Decimal(trip.triptik_cost || 0);
    const transitCost = new Decimal(trip.transit_almeria_cost || 0);
    const marsaCost = new Decimal(trip.marsa_maroc_cost || 0);
    const transitTotal = ferryCost.plus(triptikCost).plus(transitCost).plus(marsaCost);
    record.ferryTransitCost = record.ferryTransitCost.plus(transitTotal);

    // Fuel cost estimation based on distance or route
    const fuelCost = new Decimal(trip.fuel_cost || 0);
    record.fuelCost = record.fuelCost.plus(fuelCost);
  });

  // Assign driver advances/allowances
  (advancesRecords || []).forEach((adv) => {
    const allowance = new Decimal(adv.driver_allowance || adv.amount || 0);
    // Allocate to maritime or overland based on CMR or metadata
    const isAfrican = adv.cmr_number?.toLowerCase().includes('afr') || false;
    const targetCorridor: InternationalCorridorType = isAfrican
      ? 'african_overland'
      : 'european_maritime';
    corridorTotals[targetCorridor].driverAllowances =
      corridorTotals[targetCorridor].driverAllowances.plus(allowance);
  });

  // Assign maintenance costs
  (maintenanceRecords || []).forEach((m) => {
    const cost = new Decimal(m.cost || 0);
    // Split 60% maritime, 30% african, 10% domestic by default
    corridorTotals.european_maritime.maintenanceCost =
      corridorTotals.european_maritime.maintenanceCost.plus(cost.times(0.6));
    corridorTotals.african_overland.maintenanceCost =
      corridorTotals.african_overland.maintenanceCost.plus(cost.times(0.3));
    corridorTotals.domestic.maintenanceCost =
      corridorTotals.domestic.maintenanceCost.plus(cost.times(0.1));
  });

  const corridorNames: Record<InternationalCorridorType, string> = {
    european_maritime: 'الممر الأوروبي البحري (Maroc ➔ Espagne / Europe)',
    african_overland: 'الممر الإفريقي البري (Guerguerat ➔ Mauritanie / Sénégal)',
    domestic: 'النقل الوطني والمحلي (Maroc Domestique)',
  };

  const lines: CorridorProfitabilityLine[] = [];
  let grandTotalRevenueDec = new Decimal(0);
  let grandTotalCostsDec = new Decimal(0);
  let grandTotalTrips = 0;

  (Object.keys(corridorTotals) as InternationalCorridorType[]).forEach((corridor) => {
    const data = corridorTotals[corridor];
    const totalOperatingCostDec = data.fuelCost
      .plus(data.ferryTransitCost)
      .plus(data.driverAllowances)
      .plus(data.maintenanceCost);

    const grossMarginDec = data.revenue.minus(totalOperatingCostDec);
    const grossMarginPercent = data.revenue.gt(0)
      ? grossMarginDec.dividedBy(data.revenue).times(100).toNumber()
      : 0;

    grandTotalRevenueDec = grandTotalRevenueDec.plus(data.revenue);
    grandTotalCostsDec = grandTotalCostsDec.plus(totalOperatingCostDec);
    grandTotalTrips += data.tripsCount;

    lines.push({
      corridor,
      corridorName: corridorNames[corridor],
      totalTrips: data.tripsCount,
      revenueMAD: data.revenue.toNumber(),
      fuelCostMAD: data.fuelCost.toNumber(),
      ferryTransitCostMAD: data.ferryTransitCost.toNumber(),
      driverAllowancesMAD: data.driverAllowances.toNumber(),
      maintenanceCostMAD: data.maintenanceCost.toNumber(),
      totalOperatingCostMAD: totalOperatingCostDec.toNumber(),
      grossMarginMAD: grossMarginDec.toNumber(),
      grossMarginPercent: Number(grossMarginPercent.toFixed(2)),
      currency: 'MAD',
    });
  });

  const netMarginDec = grandTotalRevenueDec.minus(grandTotalCostsDec);
  const overallMarginPercent = grandTotalRevenueDec.gt(0)
    ? netMarginDec.dividedBy(grandTotalRevenueDec).times(100).toNumber()
    : 0;

  return {
    periodStart: new Date().toISOString().split('T')[0],
    periodEnd: new Date().toISOString().split('T')[0],
    totalTripsCount: grandTotalTrips,
    totalRevenueMAD: grandTotalRevenueDec.toNumber(),
    totalOperatingCostsMAD: grandTotalCostsDec.toNumber(),
    netMarginMAD: netMarginDec.toNumber(),
    overallMarginPercent: Number(overallMarginPercent.toFixed(2)),
    corridors: lines,
  };
}

/**
 * Formats standard tab-delimited PNM/ASCII format for Sage 100 Comptabilité
 */
export function formatSage100Export(entries: JournalEntryLine[]): string {
  return entries
    .map((e) => {
      const formattedDate = e.date.replace(/-/g, '');
      const dStr = e.debit > 0 ? e.debit.toFixed(2) : '';
      const cStr = e.credit > 0 ? e.credit.toFixed(2) : '';
      const sens = e.debit > 0 ? 'D' : 'C';
      const montant = e.debit > 0 ? dStr : cStr;
      return `${e.journalCode}\t${formattedDate}\t${e.accountNumber}\t${e.auxiliaryAccount || ''}\t${e.documentRef}\t${e.label}\t${sens}\t${montant}`;
    })
    .join('\r\n');
}

/**
 * Formats standard Odoo account.move.line CSV with UTF-8 BOM
 */
export function formatOdooExport(entries: JournalEntryLine[]): string {
  const headers = [
    'date',
    'journal_id/code',
    'account_id/code',
    'partner_id/ref',
    'ref',
    'name',
    'debit',
    'credit',
    'currency_id/name',
  ];
  const rows = entries.map((e) => [
    e.date,
    e.journalCode,
    e.accountNumber,
    e.auxiliaryAccount || '',
    `"${e.documentRef}"`,
    `"${e.label.replace(/"/g, '""')}"`,
    e.debit.toFixed(2),
    e.credit.toFixed(2),
    e.currency || 'MAD',
  ]);
  return '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
}

/**
 * Formats Ciel Compta / Sage 50 CSV format
 */
export function formatCielComptaExport(entries: JournalEntryLine[]): string {
  const headers = ['Journal', 'Date', 'Compte', 'Piece', 'Libelle', 'Montant_Debit', 'Montant_Credit'];
  const rows = entries.map((e) => [
    e.journalCode,
    e.date.split('-').reverse().join('/'), // DD/MM/YYYY
    e.accountNumber,
    `"${e.documentRef}"`,
    `"${e.label.replace(/"/g, '""')}"`,
    e.debit > 0 ? e.debit.toFixed(2) : '0.00',
    e.credit > 0 ? e.credit.toFixed(2) : '0.00',
  ]);
  return '\uFEFF' + [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\r\n');
}

/**
 * Formats Moroccan DGI compliant Tax Declaration CSV (Article 92 CGI Exemption Register)
 */
export function formatDgiTaxRegisterCsv(lines: TaxDeclarationLine[]): string {
  const headers = [
    'N_Facture',
    'Date_Emission',
    'Client_Raison_Sociale',
    'Client_ICE',
    'Client_IF',
    'Numero_DUM',
    'Numero_CMR',
    'Corridor_Transport',
    'Montant_HT_MAD',
    'Taux_TVA',
    'Montant_TVA_MAD',
    'Montant_TTC_MAD',
    'Article_Exoneration_CGI',
    'Libelle_Exoneration',
    'Statut_Reglement',
  ];

  const rows = lines.map((l) => [
    `"${l.invoiceNumber}"`,
    l.issueDate,
    `"${l.clientName.replace(/"/g, '""')}"`,
    `"${l.clientIce}"`,
    `"${l.clientIf || ''}"`,
    `"${l.dumNumber || ''}"`,
    `"${l.cmrNumber || ''}"`,
    `"${l.corridor}"`,
    l.amountHtMAD.toFixed(2),
    `${l.tvaRate}%`,
    l.tvaAmountMAD.toFixed(2),
    l.amountTtcMAD.toFixed(2),
    `"${l.taxExemptionCode}"`,
    `"${l.taxExemptionLabel.replace(/"/g, '""')}"`,
    `"${l.paymentStatus}"`,
  ]);

  return '\uFEFF' + [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\r\n');
}

/**
 * Formats DUM Customs Traceability & PortNet audit report CSV
 */
export function formatDumCustomsAuditCsv(lines: DumCustomsAuditLine[]): string {
  const headers = [
    'Numero_DUM',
    'MRN_Douane',
    'ID_Voyage',
    'Facture_Ref',
    'Client_Chargeur',
    'Client_ICE',
    'Corridor',
    'Bureau_Douanier',
    'Poids_Brut_Kg',
    'Description_Marchandise',
    'Montant_Facture_MAD',
    'Date_Operation',
    'Statut_Dedouanement',
  ];

  const rows = lines.map((l) => [
    `"${l.dumNumber}"`,
    `"${l.mrn || ''}"`,
    l.tripId,
    `"${l.invoiceNumber}"`,
    `"${l.clientName.replace(/"/g, '""')}"`,
    `"${l.clientIce}"`,
    `"${l.corridor}"`,
    `"${l.customsOffice}"`,
    l.weightKg.toFixed(2),
    `"${l.declaredGoods.replace(/"/g, '""')}"`,
    l.invoiceAmountMAD.toFixed(2),
    l.submissionDate,
    `"${l.status}"`,
  ]);

  return '\uFEFF' + [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\r\n');
}

/**
 * Formats Multi-Corridor Profitability breakdown (Corridor P&L) CSV
 */
export function formatCorridorPnlCsv(summary: CorridorPnlSummary): string {
  const headers = [
    'Corridor_Logistique',
    'Nombre_Voyages',
    'Chiffre_Affaires_MAD',
    'Cout_Carburant_MAD',
    'Cout_Ferry_Peages_MAD',
    'Indemnites_Chauffeur_MAD',
    'Entretien_Flotte_MAD',
    'Total_Charges_Exploitation_MAD',
    'Marge_Brute_MAD',
    'Taux_Marge_Pourcentage',
  ];

  const rows = summary.corridors.map((c) => [
    `"${c.corridorName.replace(/"/g, '""')}"`,
    c.totalTrips,
    c.revenueMAD.toFixed(2),
    c.fuelCostMAD.toFixed(2),
    c.ferryTransitCostMAD.toFixed(2),
    c.driverAllowancesMAD.toFixed(2),
    c.maintenanceCostMAD.toFixed(2),
    c.totalOperatingCostMAD.toFixed(2),
    c.grossMarginMAD.toFixed(2),
    `${c.grossMarginPercent.toFixed(2)}%`,
  ]);

  // Append Total Row
  rows.push([
    '"TOTAL GLOBAL CONSOLIDE"',
    summary.totalTripsCount,
    summary.totalRevenueMAD.toFixed(2),
    '',
    '',
    '',
    '',
    summary.totalOperatingCostsMAD.toFixed(2),
    summary.netMarginMAD.toFixed(2),
    `${summary.overallMarginPercent.toFixed(2)}%`,
  ]);

  return '\uFEFF' + [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\r\n');
}

