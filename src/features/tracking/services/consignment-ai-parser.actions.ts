'use server';

/**
 * Trans Bodanon TMS — AI Transport Order & Packing List Parser Server Actions
 * Orchestrates multimodal document ingestion, audit logging, and batch consignment creation.
 */

import { createClient } from '@/lib/supabase/server';
import { recordAuditLog } from '@/lib/audit.server';
import {
  parseShippingDocumentInputSchema,
  batchCreateConsignmentsFromAiSchema,
  type ParseShippingDocumentInput,
  type BatchCreateConsignmentsFromAiInput,
  type PackingListParseResult,
  type PackingListParsingLog,
} from '../types/consignment-ai-parser.types';
import type { TripConsignment } from '../types/groupage-ltl.types';
import { parseShippingDocumentWithAI } from './consignment-ai-parser.service';
import { createLtlConsignmentAction } from './groupage-consignment.actions';

// In-memory fallback cache for logs (for offline and unit tests)
const parsingLogsStore = new Map<string, PackingListParsingLog>();

export async function clearParsingLogsCache(): Promise<void> {
  parsingLogsStore.clear();
}

/**
 * Server Action: Parses an uploaded transport document / packing list using AI
 */
export async function parseShippingDocumentAction(
  rawInput: ParseShippingDocumentInput
): Promise<{
  success: boolean;
  data?: PackingListParseResult;
  logId?: string;
  error?: string;
}> {
  try {
    const parsed = parseShippingDocumentInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', '),
      };
    }

    const input = parsed.data;

    // 1. Run AI analysis
    const parseResult = await parseShippingDocumentWithAI(input);

    const logId = `parse-log-${Date.now()}-${Math.floor(Math.random() * 9000 + 1000)}`;
    const nowIso = new Date().toISOString();

    const inMemoryLog: PackingListParsingLog = {
      id: logId,
      tripId: input.tripId || null,
      fileName: input.fileName,
      fileSizeBytes: input.fileSizeBytes || null,
      fileMimeType: input.mimeType,
      documentType: parseResult.documentType,
      extractedConsignmentsCount: parseResult.items.length,
      confidenceScore: parseResult.confidenceScore,
      aiModelUsed: parseResult.aiModelUsed,
      extractedData: parseResult.items,
      status: 'parsed',
      errorMessage: parseResult.error || null,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    parsingLogsStore.set(logId, inMemoryLog);

    // 2. Persist to Supabase packing_list_parsing_logs
    try {
      const supabase = await createClient();
      const { data: dbData, error: dbError } = await supabase
        .from('packing_list_parsing_logs')
        .insert({
          trip_id: input.tripId || null,
          file_name: input.fileName,
          file_size_bytes: input.fileSizeBytes || null,
          file_mime_type: input.mimeType,
          document_type: parseResult.documentType,
          extracted_consignments_count: parseResult.items.length,
          confidence_score: parseResult.confidenceScore,
          ai_model_used: parseResult.aiModelUsed,
          extracted_data: parseResult.items,
          status: 'parsed',
          error_message: parseResult.error || null,
        })
        .select('id')
        .maybeSingle();

      const finalLogId = dbData?.id || logId;

      await recordAuditLog({
        entityType: 'shipping_document',
        entityId: finalLogId,
        actionType: 'create',
        newData: {
          fileName: input.fileName,
          extractedCount: parseResult.items.length,
          confidenceScore: parseResult.confidenceScore,
          aiModel: parseResult.aiModelUsed,
        },
      });

      return {
        success: true,
        data: parseResult,
        logId: finalLogId,
      };
    } catch (dbErr) {
      console.warn('[parseShippingDocumentAction DB Fallback]:', dbErr);
    }

    return {
      success: true,
      data: parseResult,
      logId,
    };
  } catch (err) {
    console.error('[parseShippingDocumentAction Error]:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to parse shipping document',
    };
  }
}

/**
 * Server Action: Batch imports extracted AI items as official TripConsignments
 */
export async function batchCreateConsignmentsFromAiAction(
  rawInput: BatchCreateConsignmentsFromAiInput
): Promise<{
  success: boolean;
  createdConsignments: TripConsignment[];
  count: number;
  errors?: string[];
  error?: string;
}> {
  try {
    const parsed = batchCreateConsignmentsFromAiSchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        success: false,
        createdConsignments: [],
        count: 0,
        error: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', '),
      };
    }

    const { tripId, items, sourceDocumentName, parsingLogId } = parsed.data;

    const createdConsignments: TripConsignment[] = [];
    const itemErrors: string[] = [];

    // Create each consignment sequentially via createLtlConsignmentAction
    for (const item of items) {
      const res = await createLtlConsignmentAction({
        tripId,
        clientName: item.clientName,
        clientId: item.clientId,
        senderName: item.senderName,
        senderAddress: item.senderAddress,
        receiverName: item.receiverName,
        receiverAddress: item.receiverAddress,
        loadingCity: item.loadingCity,
        loadingCountry: item.loadingCountry,
        deliveryCity: item.deliveryCity,
        deliveryCountry: item.deliveryCountry,
        cargoDescription: item.cargoDescription,
        isTemperatureControlled: item.isTemperatureControlled,
        targetTemperatureC: item.targetTemperatureC,
        palletCount: item.palletCount,
        palletType: item.palletType,
        isStackable: item.isStackable,
        lengthCm: item.lengthCm,
        widthCm: item.widthCm,
        heightCm: item.heightCm,
        grossWeightKg: item.grossWeightKg,
        freightPrice: item.freightPrice,
        currency: item.currency,
        customsMrn: item.customsMrn,
        hsCode: item.hsCode,
        sourceDocumentName: sourceDocumentName || item.sourceDocumentName || null,
        notes: item.notes,
      });

      if (res.success && res.data) {
        createdConsignments.push(res.data);
      } else {
        itemErrors.push(res.error || `Failed to create item for ${item.clientName}`);
      }
    }

    // Update parsing log status if logId provided
    if (parsingLogId) {
      const cached = parsingLogsStore.get(parsingLogId);
      if (cached) {
        cached.status = 'converted';
        cached.updatedAt = new Date().toISOString();
      }

      try {
        const supabase = await createClient();
        await supabase
          .from('packing_list_parsing_logs')
          .update({
            status: 'converted',
            updated_at: new Date().toISOString(),
          })
          .eq('id', parsingLogId);
      } catch (dbErr) {
        console.warn('[batchCreateConsignmentsFromAiAction DB update error]:', dbErr);
      }
    }

    await recordAuditLog({
      entityType: 'trip_consignments',
      entityId: String(tripId),
      actionType: 'create',
      newData: {
        tripId,
        consignmentsCreated: createdConsignments.length,
        sourceDocument: sourceDocumentName,
      },
    });

    return {
      success: createdConsignments.length > 0,
      createdConsignments,
      count: createdConsignments.length,
      errors: itemErrors.length > 0 ? itemErrors : undefined,
    };
  } catch (err) {
    console.error('[batchCreateConsignmentsFromAiAction Error]:', err);
    return {
      success: false,
      createdConsignments: [],
      count: 0,
      error: err instanceof Error ? err.message : 'Failed to batch create consignments',
    };
  }
}

/**
 * Server Action: Fetches recent AI parsing logs for audit or review
 */
export async function getParsingLogsAction(tripId?: number): Promise<{
  success: boolean;
  data: PackingListParsingLog[];
  error?: string;
}> {
  try {
    try {
      const supabase = await createClient();
      let query = supabase
        .from('packing_list_parsing_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

      if (tripId) {
        query = query.eq('trip_id', tripId);
      }

      const { data: dbData, error: dbError } = await query;
      if (!dbError && dbData) {
        const mapped: PackingListParsingLog[] = dbData.map((d: any) => ({
          id: d.id,
          companyId: d.company_id,
          tripId: d.trip_id,
          fileName: d.file_name,
          fileSizeBytes: d.file_size_bytes,
          fileMimeType: d.file_mime_type,
          documentType: d.document_type,
          extractedConsignmentsCount: d.extracted_consignments_count,
          confidenceScore: Number(d.confidence_score || 0),
          aiModelUsed: d.ai_model_used,
          extractedData: d.extracted_data || [],
          status: d.status,
          errorMessage: d.error_message,
          createdBy: d.created_by,
          createdAt: d.created_at,
          updatedAt: d.updated_at,
        }));
        return { success: true, data: mapped };
      }
    } catch (dbErr) {
      console.warn('[getParsingLogsAction DB Fallback]:', dbErr);
    }

    const all = Array.from(parsingLogsStore.values());
    const filtered = tripId ? all.filter((l) => l.tripId === tripId) : all;
    return { success: true, data: filtered };
  } catch (err) {
    console.error('[getParsingLogsAction Error]:', err);
    return {
      success: false,
      data: [],
      error: err instanceof Error ? err.message : 'Failed to fetch parsing logs',
    };
  }
}

