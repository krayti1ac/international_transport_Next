export interface EmailAttachmentMeta {
  filename: string;
  contentType?: string;
  size?: number;
}

export interface EmailMessage {
  id: number;
  company_id: number;
  trip_id: number | null;
  message_id: string;
  sender_email: string;
  sender_name: string | null;
  recipient_email: string;
  subject: string | null;
  body_text: string | null;
  body_html: string | null;
  attachments: EmailAttachmentMeta[];
  is_read: boolean;
  direction: 'inbound' | 'outbound';
  created_at: string;
  trip?: {
    id: number;
    cmr_number: string | null;
    route: string | null;
  } | null;
}

export interface EmailFilterParams {
  direction?: 'all' | 'inbound' | 'outbound';
  tripId?: number | null;
  unreadOnly?: boolean;
  search?: string;
}

