/**
 * Trans Bodanon TMS — WhatsApp Cloud API & Interactive Gateway Types
 * Strictly aligned with Meta WhatsApp Graph API v20.0 specification
 */

export type WhatsAppLocale = 'ar' | 'fr' | 'es';

export type WhatsAppMessageType =
  | 'text'
  | 'interactive'
  | 'location'
  | 'document'
  | 'template'
  | 'status';

export type WhatsAppDeliveryStatus =
  | 'received'
  | 'queued'
  | 'sent'
  | 'delivered'
  | 'read'
  | 'failed';

export type BotSenderRole = 'driver' | 'client' | 'admin' | 'unknown';

export type BotIntent =
  | 'track_trip'
  | 'get_invoice'
  | 'pay_invoice'
  | 'driver_mission'
  | 'driver_start_trip'
  | 'driver_report_arrival'
  | 'emergency_alert'
  | 'help_menu'
  | 'unknown';

// ==========================================
// Meta Webhook Payloads (Inbound)
// ==========================================

export interface MetaWebhookButtonReply {
  id: string;
  title: string;
}

export interface MetaWebhookListReply {
  id: string;
  title: string;
  description?: string;
}

export interface MetaWebhookInteractive {
  type: 'button_reply' | 'list_reply';
  button_reply?: MetaWebhookButtonReply;
  list_reply?: MetaWebhookListReply;
}

export interface MetaWebhookLocation {
  latitude: number;
  longitude: number;
  name?: string;
  address?: string;
}

export interface MetaWebhookDocument {
  id: string;
  caption?: string;
  filename?: string;
  mime_type?: string;
  sha256?: string;
}

export interface MetaWebhookMessage {
  from: string;
  id: string;
  timestamp: string;
  type: 'text' | 'interactive' | 'location' | 'document' | 'button';
  text?: { body: string };
  interactive?: MetaWebhookInteractive;
  location?: MetaWebhookLocation;
  document?: MetaWebhookDocument;
}

export interface MetaWebhookStatus {
  id: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  timestamp: string;
  recipient_id: string;
  conversation?: {
    id: string;
    origin?: { type: string };
    expiration_timestamp?: string;
  };
  pricing?: {
    billable: boolean;
    pricing_model: string;
    category: string;
  };
  errors?: Array<{
    code: number;
    title: string;
    message?: string;
    error_data?: { details: string };
  }>;
}

export interface MetaWebhookChangeValue {
  messaging_product: 'whatsapp';
  metadata: {
    display_phone_number: string;
    phone_number_id: string;
  };
  contacts?: Array<{
    profile: { name: string };
    wa_id: string;
  }>;
  messages?: MetaWebhookMessage[];
  statuses?: MetaWebhookStatus[];
}

export interface MetaWebhookPayload {
  object: 'whatsapp_business_account' | string;
  entry?: Array<{
    id: string;
    changes: Array<{
      field: string;
      value: MetaWebhookChangeValue;
    }>;
  }>;
}

// ==========================================
// Outbound Message Payloads
// ==========================================

export interface WhatsAppQuickReplyButton {
  id: string;
  title: string; // Max 20 chars per Meta guidelines
}

export interface WhatsAppListRow {
  id: string;
  title: string; // Max 24 chars
  description?: string; // Max 72 chars
}

export interface WhatsAppListSection {
  title: string;
  rows: WhatsAppListRow[];
}

export interface SendInteractiveButtonsOptions {
  to: string;
  body: string;
  headerText?: string;
  footerText?: string;
  buttons: WhatsAppQuickReplyButton[]; // Max 3 buttons
  auditEntity?: {
    type: string;
    id: string | number;
  };
}

export interface SendInteractiveListOptions {
  to: string;
  body: string;
  buttonText: string; // Title of the list picker button (Max 20 chars)
  headerText?: string;
  footerText?: string;
  sections: WhatsAppListSection[]; // Max 10 sections
  auditEntity?: {
    type: string;
    id: string | number;
  };
}

export interface SendDocumentOptions {
  to: string;
  documentUrl: string;
  filename: string;
  caption?: string;
  auditEntity?: {
    type: string;
    id: string | number;
  };
}

// ==========================================
// Bot Engine Context & Results
// ==========================================

export interface BotContext {
  senderPhone: string;
  cleanPhone: string;
  role: BotSenderRole;
  locale: WhatsAppLocale;
  matchedDriverId?: number;
  matchedDriverName?: string;
  matchedClientId?: number;
  matchedClientName?: string;
}

export interface BotExecutionResult {
  processed: boolean;
  intent: BotIntent;
  replySent: boolean;
  replyMessage?: string;
  actionExecuted?: string;
  wamid?: string;
  error?: string;
}

// ==========================================
// Automated Dispatch Events
// ==========================================

export interface AutomatedTripDispatchPayload {
  tripId: number;
  sendToClient?: boolean;
  sendToDriver?: boolean;
  customNote?: string;
}

export interface AutomatedInvoiceReminderPayload {
  invoiceId: number;
  includePaymentLink?: boolean;
  customMessage?: string;
}

