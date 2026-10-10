/**
 * Trans Bodanon TMS — Unloading Docks & Auto-Dispatch Audit Log Types & Schemas
 * Tracks real-time arrival of reefer vehicles at docks, geofence trigger history,
 * and automated multi-temp WhatsApp compliance dispatch to designated receivers.
 */

import { z } from 'zod';

export type DispatchDeliveryStatus =
  | 'sent'
  | 'delivered'
  | 'read'
  | 'simulated'
  | 'cooldown_skipped'
  | 'failed';

export type CompartmentColdStatus = 'compliant' | 'warning' | 'breached' | 'excursion' | 'critical';

export interface DockArrivalDispatchItem {
  id: string;
  auditLogId?: number | string;
  tripId: number;
  tripNumber: string;
  cmrNumber?: string;
  truckId?: number;
  truckPlate: string;
  trailerId?: number;
  trailerPlate?: string;
  zoneId?: string | number;
  zoneName: string;
  zoneType?: string;
  arrivedAt: string;
  receiverName: string;
  receiverPhone: string;
  compartmentCode: string; // 'C1' | 'C2' | 'C3'
  compartmentName?: string;
  cargoCategory?: string;
  setpointTempC?: number;
  mktTempC?: number;
  complianceScore?: number;
  status: CompartmentColdStatus;
  dispatchStatus: DispatchDeliveryStatus;
  messageId?: string;
  verificationHash?: string;
  verificationUrl?: string;
  isCooldownActive: boolean;
  cooldownRemainingMinutes?: number;
  idempotencyKey?: string;
  isGeofenceTriggered?: boolean;
}

export interface DockDispatchStats {
  totalArrivals: number;
  totalDispatches: number;
  successfulDispatches: number;
  cooldownProtected: number;
  successRatePct: number;
  topDocks: { zoneName: string; count: number }[];
  activeCompartmentsCount: { [code: string]: number };
}

// Zod Filter & Query Validation
export const dockDispatchFilterSchema = z.object({
  tripId: z.coerce.number().optional(),
  truckPlate: z.string().trim().optional(),
  zoneName: z.string().trim().optional(),
  compartmentCode: z.enum(['ALL', 'C1', 'C2', 'C3']).optional(),
  dispatchStatus: z.enum(['ALL', 'sent', 'delivered', 'simulated', 'cooldown_skipped', 'failed']).optional(),
  searchQuery: z.string().trim().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  limit: z.coerce.number().min(1).max(200).default(50).optional(),
  offset: z.coerce.number().min(0).default(0).optional(),
});

export type DockDispatchFilterInput = z.infer<typeof dockDispatchFilterSchema>;

// Zod Manual Resend Validation
export const resendTargetedDispatchSchema = z.object({
  tripId: z.number().int().positive('معرف الرحلة مطلوب'),
  compartmentCode: z.string().min(1, 'رمز الحجرة مطلوب'),
  receiverPhone: z.string().min(8, 'رقم هاتف المستلم غير صحيح'),
  receiverName: z.string().min(2, 'اسم المستلم مطلوب'),
  zoneName: z.string().optional(),
  locale: z.enum(['ar', 'fr', 'es']).default('ar').optional(),
  forceBypassCooldown: z.boolean().default(true).optional(),
});

export type ResendTargetedDispatchInput = z.input<typeof resendTargetedDispatchSchema>;
