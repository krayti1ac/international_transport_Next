/**
 * Trans Bodanon TMS — AI Transport Order & Packing List Parser Unit Tests
 * Enforces Decimal.js precision for LDM calculations, Zod validation, and AI fallback resilience.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import Decimal from 'decimal.js';
import {
  normalizeExtractedItem,
  computeConsignmentSummaryMetrics,
  heuristicDocumentParser,
  parseShippingDocumentWithAI,
} from '../services/consignment-ai-parser.service';
import {
  parseShippingDocumentAction,
  batchCreateConsignmentsFromAiAction,
  clearParsingLogsCache,
} from '../services/consignment-ai-parser.actions';
import { clearConsignmentsCache } from '../services/groupage-consignment.actions';

describe('AI Packing List & Transport Order Parser Engine', () => {
  beforeEach(async () => {
    await clearParsingLogsCache();
    await clearConsignmentsCache();
  });

  describe('normalizeExtractedItem & Decimal.js Metric Computations', () => {
    it('accurately normalizes standard Euro-pallet (0.4 LDM) consignment', () => {
      const raw = {
        clientName: 'Agro Export Tanger',
        senderName: 'Agro Export Tanger Hub',
        receiverName: 'Mercamadrid Fruits SL',
        loadingCity: 'Tanger',
        deliveryCity: 'Madrid',
        cargoDescription: 'Tomates Fraîches',
        palletCount: 10,
        palletType: 'euro',
        isStackable: false,
        grossWeightKg: 5000,
        isTemperatureControlled: true,
        targetTemperatureC: 4.0,
      };

      const item = normalizeExtractedItem(raw, 0, 'MAD');

      expect(item.clientName).toBe('Agro Export Tanger');
      expect(item.palletCount).toBe(10);
      expect(item.palletType).toBe('euro');
      expect(item.isTemperatureControlled).toBe(true);
      expect(item.targetTemperatureC).toBe(4.0);
      // 10 euro pallets * 0.4 LDM = 4.00 LDM
      expect(item.calculatedMetrics.ldmMeters).toBe(4.0);
      expect(item.calculatedMetrics.chargeableWeightKg).toBeGreaterThanOrEqual(5000);
    });

    it('accurately adjusts LDM for stackable pallets (gerbable factor: 2 tiers)', () => {
      const rawNonStackable = {
        clientName: 'Automotive Cables',
        palletCount: 6,
        palletType: 'euro',
        isStackable: false,
        grossWeightKg: 2000,
      };
      const rawStackable = {
        ...rawNonStackable,
        isStackable: true,
      };

      const nonStackable = normalizeExtractedItem(rawNonStackable, 0);
      const stackable = normalizeExtractedItem(rawStackable, 1);

      // 6 * 0.4 = 2.4 LDM non-stackable; stackable should be 1.2 LDM
      expect(nonStackable.calculatedMetrics.ldmMeters).toBe(2.4);
      expect(stackable.calculatedMetrics.ldmMeters).toBe(1.2);
    });

    it('computes Industrial pallet (0.5 LDM) metrics correctly', () => {
      const raw = {
        clientName: 'Heavy Machinery Casablanca',
        palletCount: 4,
        palletType: 'industrial',
        isStackable: false,
        grossWeightKg: 3000,
      };

      const item = normalizeExtractedItem(raw, 0);
      // 4 industrial pallets * 0.5 LDM = 2.00 LDM
      expect(item.calculatedMetrics.ldmMeters).toBe(2.0);
    });
  });

  describe('computeConsignmentSummaryMetrics', () => {
    it('aggregates pallets, gross weight, and LDM using Decimal.js without precision drift', () => {
      const items = [
        normalizeExtractedItem({ palletCount: 5, palletType: 'euro', grossWeightKg: 2500, isStackable: false }, 0),
        normalizeExtractedItem({ palletCount: 4, palletType: 'industrial', grossWeightKg: 3200, isStackable: false }, 1),
      ];

      const totals = computeConsignmentSummaryMetrics(items);

      expect(totals.totalPallets).toBe(9);
      expect(totals.totalWeightKg).toBe(5700);
      // 5 * 0.4 = 2.0; 4 * 0.5 = 2.0 => Total 4.0 LDM
      expect(totals.totalLdm).toBe(4.0);
    });
  });

  describe('heuristicDocumentParser & Fallback Processing', () => {
    it('extracts structured consignments from textual packing list content', () => {
      const rawText = `
EXPEDITEUR: Atlas Agro Souss
DESTINATAIRE: Rungis Primeurs Import
DESTINATION: Paris
CARGO: Tomates et Poivrons Chilled Reefer
PALETTES: 6 palettes
POIDS: 3600 kg
`;
      const base64Data = Buffer.from(rawText).toString('base64');

      const result = heuristicDocumentParser({
        base64Data,
        mimeType: 'text/plain',
        fileName: 'packing-list-rungis.txt',
        targetCurrency: 'EUR',
      });

      expect(result.success).toBe(true);
      expect(result.documentType).toBe('packing_list');
      expect(result.items.length).toBeGreaterThan(0);
      expect(result.items[0].clientName).toBe('Atlas Agro Souss');
      expect(result.items[0].deliveryCity).toBe('Paris');
      expect(result.items[0].palletCount).toBe(6);
      expect(result.items[0].isTemperatureControlled).toBe(true);
      expect(result.items[0].currency).toBe('EUR');
    });

    it('identifies document types based on file naming patterns', () => {
      const dummyB64 = Buffer.from('Test dummy document').toString('base64');

      const invResult = heuristicDocumentParser({
        base64Data: dummyB64,
        mimeType: 'application/pdf',
        fileName: 'Facture_Commerciale_FC2026.pdf',
        targetCurrency: 'MAD',
      });
      expect(invResult.documentType).toBe('commercial_invoice');

      const transResult = heuristicDocumentParser({
        base64Data: dummyB64,
        mimeType: 'application/pdf',
        fileName: 'Ordre_Transport_OT8840.pdf',
        targetCurrency: 'MAD',
      });
      expect(transResult.documentType).toBe('transport_order');
    });

    it('parseShippingDocumentWithAI falls back gracefully without GEMINI_API_KEY', async () => {
      const dummyB64 = Buffer.from('Standard Moroccan Packing List').toString('base64');

      const result = await parseShippingDocumentWithAI({
        base64Data: dummyB64,
        mimeType: 'application/pdf',
        fileName: 'Packing_List_Tanger_Madrid.pdf',
        targetCurrency: 'MAD',
      });

      expect(result.success).toBe(true);
      expect(result.items.length).toBe(2);
      expect(result.totalPalletsExtracted).toBe(12);
      expect(result.confidenceScore).toBeGreaterThanOrEqual(85);
    });
  });

  describe('Server Actions & Batch Consignment Ingestion', () => {
    it('parses document and generates parsing log with audit trail', async () => {
      const dummyB64 = Buffer.from('Transport Ingestion Sample').toString('base64');

      const res = await parseShippingDocumentAction({
        base64Data: dummyB64,
        mimeType: 'application/pdf',
        fileName: 'ALBARAN_CARGA_8840.pdf',
        fileSizeBytes: 45000,
        tripId: 8840,
        targetCurrency: 'MAD',
      });

      expect(res.success).toBe(true);
      expect(res.data).toBeDefined();
      expect(res.logId).toBeDefined();
      expect(res.data?.items.length).toBeGreaterThan(0);
    }, 20000);

    it('batch imports extracted AI items as official TripConsignments', async () => {
      const dummyB64 = Buffer.from('Packing list').toString('base64');
      const parseRes = await parseShippingDocumentAction({
        base64Data: dummyB64,
        mimeType: 'application/pdf',
        fileName: 'PackingList_Bulk.pdf',
        tripId: 8840,
        targetCurrency: 'MAD',
      });

      const itemsToImport = parseRes.data!.items;

      const batchRes = await batchCreateConsignmentsFromAiAction({
        tripId: 8840,
        items: itemsToImport.map((i) => ({
          clientName: i.clientName,
          senderName: i.senderName,
          receiverName: i.receiverName,
          loadingCity: i.loadingCity,
          loadingCountry: i.loadingCountry,
          deliveryCity: i.deliveryCity,
          deliveryCountry: i.deliveryCountry,
          cargoDescription: i.cargoDescription,
          isTemperatureControlled: i.isTemperatureControlled,
          targetTemperatureC: i.targetTemperatureC,
          palletCount: i.palletCount,
          palletType: i.palletType,
          isStackable: i.isStackable,
          grossWeightKg: i.grossWeightKg,
          freightPrice: i.freightPrice,
          currency: i.currency,
          hsCode: i.hsCode,
        })),
        sourceDocumentName: 'PackingList_Bulk.pdf',
        parsingLogId: parseRes.logId,
      });

      expect(batchRes.success).toBe(true);
      expect(batchRes.count).toBe(itemsToImport.length);
      expect(batchRes.createdConsignments.length).toBe(itemsToImport.length);
      expect(batchRes.createdConsignments[0].consignmentReference).toContain('LTL-8840-');
      expect(batchRes.createdConsignments[0].cmrNumber).toContain('CMR-LTL-8840-');
    }, 20000);

    it('rejects batch import when items array is empty', async () => {
      const res = await batchCreateConsignmentsFromAiAction({
        tripId: 8840,
        items: [],
      });

      expect(res.success).toBe(false);
      expect(res.count).toBe(0);
    });

    it('rejects parse action when base64Data is missing or invalid', async () => {
      const res = await parseShippingDocumentAction({
        base64Data: '',
        mimeType: 'application/pdf',
        fileName: 'empty.pdf',
        targetCurrency: 'MAD',
      });

      expect(res.success).toBe(false);
      expect(res.error).toBeDefined();
    });
  });
});
