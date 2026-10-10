/**
 * Trans Bodanon TMS — Insurance Claim Dossier & e-POD Dispatch Types
 * Standards: ATP Treaty / INCOTERMS 2020 / EU GDP Guidelines (2013/C 343/01)
 */

import { z } from 'zod';
import type { CargoCategory } from './reefer-claim-settlement.types';

export type { CargoCategory };

export type InsurerCompany = 'allianz' | 'rma' | 'axa' | 'sanlam' | 'other';
export type InsuranceDispatchChannel = 'whatsapp' | 'email' | 'both';
export type InsuranceDispatchStatus = 'pending' | 'sent' | 'partial' | 'failed';

export interface InsurerPartnerPreset {
  id: InsurerCompany;
  name: string;
  defaultEmail: string;
  defaultPhone: string;
  department: string;
}

export const INSURER_PARTNER_PRESETS: Record<InsurerCompany, InsurerPartnerPreset> = {
  allianz: {
    id: 'allianz',
    name: 'Allianz Maroc / Allianz Trade',
    defaultEmail: 'sinistres.transport@allianz.ma',
    defaultPhone: '+212522500100',
    department: 'Département Sinistres Fret & Terrestre',
  },
  rma: {
    id: 'rma',
    name: 'RMA Watanya',
    defaultEmail: 'claims.marine-cargo@rmaassurance.com',
    defaultPhone: '+212522203040',
    department: 'Direction Sinistres Flotte & Cargo',
  },
  axa: {
    id: 'axa',
    name: 'AXA Assurance Maroc',
    defaultEmail: 'sinistres.entreprises@axa.ma',
    defaultPhone: '+212522405060',
    department: 'Service Indemnisation Transport',
  },
  sanlam: {
    id: 'sanlam',
    name: 'Sanlam Maroc',
    defaultEmail: 'cargo.claims@sanlam.ma',
    defaultPhone: '+212522809010',
    department: 'Pôle Sinistres Transport International',
  },
  other: {
    id: 'other',
    name: 'Courtier / Expert d’assurance indépendant',
    defaultEmail: 'expert@cabinet-assurance.com',
    defaultPhone: '+212600000000',
    department: 'Expertise Sinistres Périssables',
  },
};

export interface InsuranceDispatchRecipient {
  insurerCompany: InsurerCompany;
  adjusterName: string;
  email?: string;
  phone?: string;
}

export interface InsuranceClaimDossierPayload {
  claimReference: string;
  tripId: number;
  tripNumber: string;
  truckPlate: string;
  driverName: string;
  cargoCategory: CargoCategory;
  annexId?: string | null;
  insuredCargoValue: number;
  grossLossAmount: number;
  deductibleAmount: number;
  netIndemnityAmount: number;
  currency: string;
  policyNumber: string;
  insurerCompany: InsurerCompany;
  adjusterName: string;
  dossierUrl: string;
  claimDossierHash: string;
  includeEpodAnnex: boolean;
  includeMktSummary: boolean;
  notes?: string;
  locale: 'ar' | 'fr' | 'es';
}

export interface ChannelDispatchOutcome {
  success: boolean;
  messageId?: string;
  error?: string;
  recipient?: string;
}

export interface InsuranceDispatchResult {
  success: boolean;
  claimReference: string;
  channel: InsuranceDispatchChannel;
  dispatchedAt: string;
  dossierVerificationUrl: string;
  dossierSeal: string;
  whatsapp?: ChannelDispatchOutcome;
  email?: ChannelDispatchOutcome;
  rateLimited?: boolean;
  errorMessage?: string;
}

export const dispatchInsuranceClaimSchema = z.object({
  claimReference: z.string().min(1),
  tripId: z.number().int().positive(),
  tripNumber: z.string().min(1),
  truckPlate: z.string().min(1),
  driverName: z.string().min(1),
  cargoCategory: z.enum([
    'deep_frozen',
    'fresh_produce',
    'pharma_cold',
    'meat_chilled',
  ]).default('fresh_produce'),
  annexId: z.string().optional().nullable(),
  insuredCargoValue: z.number().min(0),
  grossLossAmount: z.number().min(0),
  deductibleAmount: z.number().min(0),
  netIndemnityAmount: z.number().min(0),
  currency: z.string().default('MAD'),
  policyNumber: z.string().default('POL-FRIGO-2026-TANGIER'),
  insurerCompany: z.enum(['allianz', 'rma', 'axa', 'sanlam', 'other']).default('allianz'),
  adjusterName: z.string().min(1),
  channel: z.enum(['whatsapp', 'email', 'both']).default('both'),
  recipientEmail: z.string().email().optional().or(z.literal('')),
  recipientPhone: z.string().optional().or(z.literal('')),
  includeEpodAnnex: z.boolean().default(true),
  includeMktSummary: z.boolean().default(true),
  notes: z.string().optional(),
  forceBypassCooldown: z.boolean().default(false),
  locale: z.enum(['ar', 'fr', 'es']).default('fr'),
});

export type DispatchInsuranceClaimInput = z.input<typeof dispatchInsuranceClaimSchema>;
export type DispatchInsuranceClaimValidated = z.infer<typeof dispatchInsuranceClaimSchema>;

export const queryDispatchHistorySchema = z.object({
  claimReference: z.string().min(1),
});

export type QueryDispatchHistoryInput = z.infer<typeof queryDispatchHistorySchema>;

