export type AttachmentType = 'photo' | 'police_report' | 'insurance_document' | 'customs_document' | 'other';

export interface IncidentAttachment {
  id: number;
  incident_id: number;
  company_id: number;
  file_url: string;
  file_name: string;
  file_type: string;
  file_size?: number;
  attachment_type: AttachmentType;
  description?: string;
  uploaded_by?: string;
  created_at: string;
  updated_at: string;
}

export interface AttachmentUploadInput {
  incident_id: number;
  file_url: string;
  file_name: string;
  file_type: string;
  file_size?: number;
  attachment_type?: AttachmentType;
  description?: string;
}

export type IncidentStatus = 'open' | 'investigating' | 'resolved' | 'closed';
export type IncidentSeverity = 'minor' | 'moderate' | 'major' | 'critical';
export type IncidentType = 'accident' | 'delay' | 'damage' | 'theft' | 'customs_hold' | 'breakdown' | 'other';

export interface Incident {
  id: number;
  company_id?: number | null;
  trip_order_id?: number | null;
  truck_id?: number | null;
  trailer_id?: number | null;
  driver_id?: number | null;
  client_id?: number | null;
  incident_type: IncidentType;
  severity: IncidentSeverity;
  status: IncidentStatus;
  title: string;
  description?: string;
  location?: string;
  incident_date: string;
  estimated_cost?: number;
  actual_cost?: number;
  currency: string;
  insurance_reference?: string;
  police_report_number?: string;
  customs_reference?: string;
  resolution_notes?: string;
  resolved_at?: string;
  created_at: string;
  updated_at: string;
}

export interface IncidentCreateInput {
  trip_order_id?: number | null;
  truck_id?: number | null;
  trailer_id?: number | null;
  driver_id?: number | null;
  client_id?: number | null;
  incident_type: IncidentType;
  severity: IncidentSeverity;
  title: string;
  description?: string;
  location?: string;
  incident_date: string;
  estimated_cost?: number;
  currency?: string;
  insurance_reference?: string;
  police_report_number?: string;
  customs_reference?: string;
}

export interface IncidentUpdateInput extends Partial<IncidentCreateInput> {
  status?: IncidentStatus;
  actual_cost?: number;
  resolution_notes?: string;
  resolved_at?: string;
}

export interface IncidentFilterParams {
  status?: IncidentStatus;
  severity?: IncidentSeverity;
  incident_type?: IncidentType;
  trip_order_id?: number;
  driver_id?: number;
  fromDate?: string;
  toDate?: string;
}

export interface IncidentStats {
  total: number;
  open: number;
  investigating: number;
  resolved: number;
  closed: number;
  byType: Record<string, number>;
  bySeverity: Record<string, number>;
  totalEstimatedCost: number;
  totalActualCost: number;
}
