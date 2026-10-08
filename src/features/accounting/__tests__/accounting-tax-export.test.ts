import { describe, it, expect } from 'vitest';
import Decimal from 'decimal.js';
import {
  isInternationalTransport,
  buildTaxExemptionRegister,
  summarizeTaxCompliance,
  buildDumCustomsAuditRegister,
  calculateCorridorProfitability,
  formatSage100Export,
  formatOdooExport,
  formatCielComptaExport,
  formatDgiTaxRegisterCsv,
  formatDumCustomsAuditCsv,
  formatCorridorPnlCsv,
} from '../services/tax-compliance-export.service';
import type { JournalEntryLine } from '../types';

describe('Accounting & Tax Compliance Export Engine (Pathway 3)', () => {
  describe('1. International Transport & Tax Exemption (Article 92 CGI Maroc)', () => {
    it('accurately identifies international transport corridors and cities', () => {
      expect(isInternationalTransport('Tanger Med ➔ Algeciras', null)).toBe(true);
      expect(isInternationalTransport('Agadir ➔ Nouakchott ➔ Dakar', null)).toBe(true);
      expect(isInternationalTransport('Casablanca ➔ Madrid', null)).toBe(true);
      expect(isInternationalTransport(null, 'european_maritime')).toBe(true);
      expect(isInternationalTransport(null, 'african_overland')).toBe(true);
      expect(isInternationalTransport('Casablanca ➔ Marrakech', 'domestic')).toBe(false);
      expect(isInternationalTransport('Tanger Ville ➔ Fes', null)).toBe(false);
    });

    it('builds tax exemption register with Article 92-I-38° CGI for international trips', () => {
      const mockInvoices = [
        {
          id: 501,
          invoice_number: 'FA-2026-0501',
          total_amount: '32000.00',
          ht_amount: '32000.00',
          tva_amount: '0.00',
          tva_rate: '0',
          client_id: '1',
          route: 'Agadir ➔ Perpignan (France)',
          issue_date: '2026-10-01',
          status: 'paid',
        },
        {
          id: 502,
          invoice_number: 'FA-2026-0502',
          total_amount: '12000.00',
          ht_amount: '10000.00',
          tva_amount: '2000.00',
          tva_rate: '20',
          client_id: '2',
          route: 'Casablanca ➔ Tanger Ville',
          issue_date: '2026-10-02',
          status: 'pending',
        },
      ];

      const clientsMap = new Map([
        ['1', { name: 'Atlas Primeurs Export SARL', ice: '001234567890001', if_number: '12345678' }],
        ['2', { name: 'Maroc Distrib SA', ice: '009876543210002', if_number: '87654321' }],
      ]);

      const tripOrdersMap = new Map();

      const lines = buildTaxExemptionRegister(mockInvoices, clientsMap, tripOrdersMap);

      expect(lines).toHaveLength(2);

      // Line 1: International TIR (Article 92 CGI)
      const line1 = lines[0];
      expect(line1.invoiceNumber).toBe('FA-2026-0501');
      expect(line1.clientName).toBe('Atlas Primeurs Export SARL');
      expect(line1.clientIce).toBe('001234567890001');
      expect(line1.taxExemptionCode).toBe('ART_92_I_38_CGI');
      expect(line1.tvaRate).toBe(0);
      expect(line1.tvaAmountMAD).toBe(0);
      expect(line1.amountHtMAD).toBe(32000);
      expect(line1.dumNumber).toContain('MA003100');

      // Line 2: Domestic Taxable (20%)
      const line2 = lines[1];
      expect(line2.invoiceNumber).toBe('FA-2026-0502');
      expect(line2.taxExemptionCode).toBe('STANDARD_TAXABLE');
      expect(line2.tvaRate).toBe(20);
      expect(line2.tvaAmountMAD).toBe(2000);
      expect(line2.amountHtMAD).toBe(10000);
    });

    it('summarizes tax compliance metrics strictly using Decimal.js', () => {
      const mockInvoices = [
        {
          id: 1,
          total_amount: '50000.00',
          ht_amount: '50000.00',
          tva_amount: '0.00',
          tva_rate: '0',
          client_id: '1',
          route: 'Tanger Med ➔ Algeciras',
        },
        {
          id: 2,
          total_amount: '50000.00',
          ht_amount: '50000.00',
          tva_amount: '0.00',
          tva_rate: '0',
          client_id: '1',
          route: 'Guerguerat ➔ Dakar',
        },
        {
          id: 3,
          total_amount: '24000.00',
          ht_amount: '20000.00',
          tva_amount: '4000.00',
          tva_rate: '20',
          client_id: '2',
          route: 'Casablanca ➔ Marrakech',
        },
      ];

      const clientsMap = new Map([
        ['1', { name: 'Export Leader', ice: '001111111111111' }],
        ['2', { name: 'Local Logistics', ice: '002222222222222' }],
      ]);

      const lines = buildTaxExemptionRegister(mockInvoices, clientsMap, new Map());
      const summary = summarizeTaxCompliance(lines, '2026-10-01', '2026-10-31');

      expect(summary.totalTurnoverHtMAD).toBe(120000);
      expect(summary.exemptTurnoverArt92MAD).toBe(100000);
      expect(summary.taxableTurnoverMAD).toBe(20000);
      expect(summary.totalTvaCollectedMAD).toBe(4000);
      expect(summary.exemptionRatio).toBe(83.33); // 100000 / 120000 = 83.33%
    });
  });

  describe('2. DUM & Customs Traceability Register', () => {
    it('cross-references PortNet customs submissions, weights, and bureaus', () => {
      const mockTripOrders = [
        {
          id: 701,
          client_id: 1,
          route: 'Tanger Med ➔ Algeciras',
          corridor_type: 'european_maritime',
          price: 26000,
          weight_export: 23400,
          goods_description_export: 'Fraises fraîches de Larache',
          status: 'delivered',
          departure_date: '2026-10-05',
        },
        {
          id: 702,
          client_id: 2,
          route: 'Guerguerat ➔ Rosso ➔ Dakar',
          corridor_type: 'african_overland',
          price: 48000,
          weight_export: 25000,
          goods_description_export: 'Sardines congelées de Dakhla',
          status: 'transit',
          departure_date: '2026-10-06',
        },
      ];

      const invoicesMap = new Map([
        ['701', { invoice_number: 'FA-701', total_amount: 26000 }],
        ['702', { invoice_number: 'FA-702', total_amount: 48000 }],
      ]);

      const clientsMap = new Map([
        ['1', { name: 'Agro Export Nord', ice: '001000000000001' }],
        ['2', { name: 'Sahara Peche Sud', ice: '002000000000002' }],
      ]);

      const customsSubmissionsMap = new Map([
        ['701', { mrn: '26MA003100A998877', customs_office: 'MA003100 (Tanger Med)' }],
      ]);

      const dumLines = buildDumCustomsAuditRegister(
        mockTripOrders,
        invoicesMap,
        clientsMap,
        customsSubmissionsMap
      );

      expect(dumLines).toHaveLength(2);

      const maritimeLine = dumLines[0];
      expect(maritimeLine.tripId).toBe(701);
      expect(maritimeLine.customsOffice).toBe('MA003100 (Tanger Med)');
      expect(maritimeLine.mrn).toBe('26MA003100A998877');
      expect(maritimeLine.weightKg).toBe(23400);
      expect(maritimeLine.status).toBe('cleared');

      const africanLine = dumLines[1];
      expect(africanLine.tripId).toBe(702);
      expect(africanLine.customsOffice).toBe('MA004900 (Guerguerat)');
      expect(africanLine.status).toBe('transit');
    });
  });

  describe('3. Multi-Corridor Profitability (Corridor P&L)', () => {
    it('strictly calculates gross margin and margin percentage by corridor with Decimal.js', () => {
      const mockTripOrders = [
        {
          id: 1,
          corridor_type: 'european_maritime',
          price: 30000,
          ferry_cost: 6000,
          triptik_cost: 200,
          transit_almeria_cost: 400,
          marsa_maroc_cost: 150,
          fuel_cost: 8000,
        },
        {
          id: 2,
          corridor_type: 'african_overland',
          price: 50000,
          ferry_cost: 0,
          triptik_cost: 0,
          fuel_cost: 16000,
        },
      ];

      const mockMaintenance = [
        { cost: 5000 }, // Allocated: 3000 maritime, 1500 african, 500 domestic
      ];

      const mockAdvances = [
        { amount: 4000, driver_allowance: 4000, cmr_number: 'CMR-EUR-01' }, // European
        { amount: 7000, driver_allowance: 7000, cmr_number: 'CMR-AFR-01' }, // African
      ];

      const summary = calculateCorridorProfitability(
        mockTripOrders,
        mockMaintenance,
        mockAdvances
      );

      expect(summary.totalTripsCount).toBe(2);
      expect(summary.totalRevenueMAD).toBe(80000);

      const maritime = summary.corridors.find((c) => c.corridor === 'european_maritime');
      expect(maritime).toBeDefined();
      expect(maritime?.revenueMAD).toBe(30000);
      expect(maritime?.fuelCostMAD).toBe(8000);
      expect(maritime?.ferryTransitCostMAD).toBe(6750); // 6000 + 200 + 400 + 150
      expect(maritime?.driverAllowancesMAD).toBe(4000);
      expect(maritime?.maintenanceCostMAD).toBe(3000); // 5000 * 0.6
      // Total operating cost = 8000 + 6750 + 4000 + 3000 = 21750
      expect(maritime?.totalOperatingCostMAD).toBe(21750);
      expect(maritime?.grossMarginMAD).toBe(8250); // 30000 - 21750
      expect(maritime?.grossMarginPercent).toBe(27.5); // 8250 / 30000 = 27.5%

      const african = summary.corridors.find((c) => c.corridor === 'african_overland');
      expect(african).toBeDefined();
      expect(african?.revenueMAD).toBe(50000);
      expect(african?.fuelCostMAD).toBe(16000);
      expect(african?.driverAllowancesMAD).toBe(7000);
      expect(african?.maintenanceCostMAD).toBe(1500); // 5000 * 0.3
      // Total operating cost = 16000 + 0 + 7000 + 1500 = 24500
      expect(african?.totalOperatingCostMAD).toBe(24500);
      expect(african?.grossMarginMAD).toBe(25500); // 50000 - 24500
      expect(african?.grossMarginPercent).toBe(51); // 25500 / 50000 = 51.0%

      // Net consolidated margin
      expect(summary.netMarginMAD).toBe(33250); // 8250 + 25500 - 500(domestic maint)
      expect(summary.overallMarginPercent).toBe(41.56);
    });
  });

  describe('4. Export Format Generators (Sage 100, Odoo, Ciel, DGI CSV)', () => {
    const mockEntries: JournalEntryLine[] = [
      {
        date: '2026-10-01',
        journalCode: 'VT',
        accountNumber: '34210000',
        auxiliaryAccount: '001234567890001',
        documentRef: 'FA-2026-001',
        label: 'Facture FA-2026-001 - Client Export',
        debit: 35000,
        credit: 0,
        currency: 'MAD',
      },
      {
        date: '2026-10-01',
        journalCode: 'VT',
        accountNumber: '71242000',
        auxiliaryAccount: '',
        documentRef: 'FA-2026-001',
        label: 'Prestation transport - International Art 92 CGI',
        debit: 0,
        credit: 35000,
        currency: 'MAD',
      },
    ];

    it('generates Sage 100 tab-delimited PNM export format', () => {
      const sage = formatSage100Export(mockEntries);
      const lines = sage.split('\r\n');
      expect(lines).toHaveLength(2);

      const parts = lines[0].split('\t');
      expect(parts[0]).toBe('VT');
      expect(parts[1]).toBe('20261001');
      expect(parts[2]).toBe('34210000');
      expect(parts[3]).toBe('001234567890001');
      expect(parts[4]).toBe('FA-2026-001');
      expect(parts[6]).toBe('D');
      expect(parts[7]).toBe('35000.00');
    });

    it('generates Odoo account.move.line CSV with UTF-8 BOM', () => {
      const odoo = formatOdooExport(mockEntries);
      expect(odoo.startsWith('\uFEFF')).toBe(true);
      expect(odoo).toContain('date,journal_id/code,account_id/code,partner_id/ref,ref,name,debit,credit,currency_id/name');
      expect(odoo).toContain('2026-10-01,VT,34210000,001234567890001,"FA-2026-001"');
    });

    it('generates Ciel Compta / Sage 50 semicolon-delimited CSV with DD/MM/YYYY dates', () => {
      const ciel = formatCielComptaExport(mockEntries);
      expect(ciel.startsWith('\uFEFF')).toBe(true);
      expect(ciel).toContain('Journal;Date;Compte;Piece;Libelle;Montant_Debit;Montant_Credit');
      expect(ciel).toContain('VT;01/10/2026;34210000;"FA-2026-001"');
      expect(ciel).toContain('35000.00;0.00');
    });

    it('generates DGI Tax Register CSV with Article 92 CGI headers', () => {
      const taxLine = {
        invoiceNumber: 'FA-2026-001',
        issueDate: '2026-10-01',
        clientName: 'Agro Export SARL',
        clientIce: '001234567890001',
        clientIf: '12345678',
        dumNumber: 'DUM-2026-MA3100-001',
        cmrNumber: 'CMR-9901',
        corridor: 'european_maritime' as const,
        amountHtMAD: 35000,
        tvaRate: 0,
        tvaAmountMAD: 0,
        amountTtcMAD: 35000,
        taxExemptionCode: 'ART_92_I_38_CGI' as const,
        taxExemptionLabel: 'Exonéré TVA Art 92 CGI',
        paymentStatus: 'paid',
      };

      const csv = formatDgiTaxRegisterCsv([taxLine]);
      expect(csv).toContain('Article_Exoneration_CGI;Libelle_Exoneration');
      expect(csv).toContain('"FA-2026-001";2026-10-01;"Agro Export SARL";"001234567890001"');
      expect(csv).toContain('"ART_92_I_38_CGI"');
    });

    it('generates Corridor P&L CSV with breakdown and consolidated total', () => {
      const mockSummary = {
        periodStart: '2026-10-01',
        periodEnd: '2026-10-31',
        totalTripsCount: 10,
        totalRevenueMAD: 400000,
        totalOperatingCostsMAD: 250000,
        netMarginMAD: 150000,
        overallMarginPercent: 37.5,
        corridors: [
          {
            corridor: 'european_maritime' as const,
            corridorName: 'الممر الأوروبي البحري',
            totalTrips: 6,
            revenueMAD: 240000,
            fuelCostMAD: 60000,
            ferryTransitCostMAD: 40000,
            driverAllowancesMAD: 24000,
            maintenanceCostMAD: 16000,
            totalOperatingCostMAD: 140000,
            grossMarginMAD: 100000,
            grossMarginPercent: 41.67,
            currency: 'MAD' as const,
          },
        ],
      };

      const pnlCsv = formatCorridorPnlCsv(mockSummary);
      expect(pnlCsv).toContain('Corridor_Logistique;Nombre_Voyages;Chiffre_Affaires_MAD');
      expect(pnlCsv).toContain('"الممر الأوروبي البحري";6;240000.00');
      expect(pnlCsv).toContain('"TOTAL GLOBAL CONSOLIDE";10;400000.00');
    });
  });
});
