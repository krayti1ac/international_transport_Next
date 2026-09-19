'use server';

import { createClient } from '@/lib/supabase/server';
import { recordAuditLog } from '@/lib/audit.server';
import type {
  Incident,
  IncidentCreateInput,
  IncidentUpdateInput,
  IncidentFilterParams,
  IncidentAttachment,
  AttachmentUploadInput,
} from '../types';

export async function getIncidents(params: IncidentFilterParams = {}): Promise<{ success: boolean; data?: Incident[]; error?: string }> {
  try {
    const supabase = await createClient();
    let query = supabase.from('incidents').select('*').order('incident_date', { ascending: false });

    if (params.status) query = query.eq('status', params.status);
    if (params.severity) query = query.eq('severity', params.severity);
    if (params.incident_type) query = query.eq('incident_type', params.incident_type);
    if (params.trip_order_id) query = query.eq('trip_order_id', params.trip_order_id);
    if (params.driver_id) query = query.eq('driver_id', params.driver_id);
    if (params.fromDate) query = query.gte('incident_date', params.fromDate);
    if (params.toDate) query = query.lte('incident_date', params.toDate);

    const { data, error } = await query;
    if (error) throw error;
    return { success: true, data: data || [] };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch incidents';
    return { success: false, error: message };
  }
}

export async function getIncident(id: number): Promise<{ success: boolean; data?: Incident; error?: string }> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.from('incidents').select('*').eq('id', id).single();
    if (error) throw error;
    return { success: true, data: data as Incident };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch incident';
    return { success: false, error: message };
  }
}

export async function createIncident(input: IncidentCreateInput): Promise<{ success: boolean; data?: Incident; error?: string }> {
  try {
    const supabase = await createClient();
    const payload = {
      ...input,
      currency: input.currency || 'MAD',
      status: 'open',
    };

    const { data, error } = await supabase.from('incidents').insert(payload).select().single();
    if (error) throw error;

    await recordAuditLog({
      entityType: 'incident',
      entityId: data.id,
      actionType: 'create',
      reason: `New incident reported: ${input.title}`,
      newData: payload,
    });

    return { success: true, data: data as Incident };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create incident';
    return { success: false, error: message };
  }
}

export async function updateIncident(id: number, input: IncidentUpdateInput): Promise<{ success: boolean; data?: Incident; error?: string }> {
  try {
    const supabase = await createClient();
    const payload: Record<string, unknown> = { ...input };
    if (input.status === 'resolved' || input.status === 'closed') {
      payload.resolved_at = new Date().toISOString();
    }

    const { data, error } = await supabase.from('incidents').update(payload).eq('id', id).select().single();
    if (error) throw error;

    await recordAuditLog({
      entityType: 'incident',
      entityId: id,
      actionType: 'update',
      reason: `Incident updated: ${input.title || input.resolution_notes || 'status change'}`,
      newData: payload,
    });

    return { success: true, data: data as Incident };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update incident';
    return { success: false, error: message };
  }
}

export async function deleteIncident(id: number): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.from('incidents').delete().eq('id', id);
    if (error) throw error;

    await recordAuditLog({
      entityType: 'incident',
      entityId: id,
      actionType: 'soft_delete',
      reason: 'Incident record deleted',
    });

    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to delete incident';
    return { success: false, error: message };
  }
}

export async function getIncidentStats(params: { fromDate?: string; toDate?: string } = {}): Promise<{ success: boolean; data?: {
  total: number;
  open: number;
  investigating: number;
  resolved: number;
  closed: number;
  byType: Record<string, number>;
  bySeverity: Record<string, number>;
  totalEstimatedCost: number;
  totalActualCost: number;
}; error?: string }> {
  try {
    const supabase = await createClient();
    let query = supabase.from('incidents').select('*');
    if (params.fromDate) query = query.gte('incident_date', params.fromDate);
    if (params.toDate) query = query.lte('incident_date', params.toDate);

    const { data, error } = await query;
    if (error) throw error;

    const incidents = data || [];
    const stats = {
      total: incidents.length,
      open: incidents.filter(i => i.status === 'open').length,
      investigating: incidents.filter(i => i.status === 'investigating').length,
      resolved: incidents.filter(i => i.status === 'resolved').length,
      closed: incidents.filter(i => i.status === 'closed').length,
      byType: {} as Record<string, number>,
      bySeverity: {} as Record<string, number>,
      totalEstimatedCost: 0,
      totalActualCost: 0,
    };

    for (const inc of incidents) {
      stats.byType[inc.incident_type] = (stats.byType[inc.incident_type] || 0) + 1;
      stats.bySeverity[inc.severity] = (stats.bySeverity[inc.severity] || 0) + 1;
      stats.totalEstimatedCost += Number(inc.estimated_cost || 0);
      stats.totalActualCost += Number(inc.actual_cost || 0);
    }

    return { success: true, data: stats };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to calculate incident stats';
    return { success: false, error: message };
  }
}

export async function getIncidentAttachments(incidentId: number): Promise<{ success: boolean; data?: IncidentAttachment[]; error?: string }> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('incident_attachments')
      .select('*')
      .eq('incident_id', incidentId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return { success: true, data: data || [] };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch attachments';
    return { success: false, error: message };
  }
}

export async function uploadIncidentAttachment(input: AttachmentUploadInput): Promise<{ success: boolean; data?: IncidentAttachment; error?: string }> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile } = await supabase.from('users').select('company_id').eq('id', user?.id).maybeSingle();
    const companyId = profile?.company_id || 1;

    const payload = {
      incident_id: input.incident_id,
      company_id: companyId,
      file_url: input.file_url,
      file_name: input.file_name,
      file_type: input.file_type,
      file_size: input.file_size || null,
      attachment_type: input.attachment_type || 'photo',
      description: input.description || null,
      uploaded_by: user?.email || 'system',
    };

    const { data, error } = await supabase.from('incident_attachments').insert(payload).select().single();
    if (error) throw error;

    await recordAuditLog({
      entityType: 'incident_attachment',
      entityId: data.id,
      actionType: 'create',
      reason: `Uploaded attachment: ${input.file_name} for incident #${input.incident_id}`,
      newData: payload,
    });

    return { success: true, data: data as IncidentAttachment };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to upload attachment';
    return { success: false, error: message };
  }
}

export async function deleteIncidentAttachment(id: number): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.from('incident_attachments').delete().eq('id', id);
    if (error) throw error;

    await recordAuditLog({
      entityType: 'incident_attachment',
      entityId: id,
      actionType: 'soft_delete',
      reason: 'Incident attachment deleted',
    });

    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to delete attachment';
    return { success: false, error: message };
  }
}

export async function getAttachmentStats(incidentId: number): Promise<{ success: boolean; data?: { total: number; photos: number; documents: number }; error?: string }> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.from('incident_attachments').select('attachment_type').eq('incident_id', incidentId);
    if (error) throw error;

    const attachments = data || [];
    const photos = attachments.filter(a => a.attachment_type === 'photo').length;
    const documents = attachments.filter(a => a.attachment_type !== 'photo').length;

    return { success: true, data: { total: attachments.length, photos, documents } };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to calculate attachment stats';
    return { success: false, error: message };
  }
}
