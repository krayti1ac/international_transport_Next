/**
 * Trans Bodanon TMS — Insurance Claim Dossier & e-POD Dispatch Gateway Service
 * Multi-Channel Dispatches: WhatsApp Cloud API & Self-Hosted Company SMTP Email
 * Standards: ATP Treaty / INCOTERMS 2020 / EU GDP Guidelines (2013/C 343/01)
 */

import { createHmac } from 'crypto';
import Decimal from 'decimal.js';
import { sendWhatsAppText } from '@/features/whatsapp/services/whatsapp-meta-client';
import { sendCompanyEmail } from '@/lib/email';
import { recordAuditLog } from '@/lib/audit.server';
import {
  type CargoCategory,
  type DispatchInsuranceClaimValidated,
  type InsuranceDispatchChannel,
  type InsuranceDispatchResult,
  type InsurerCompany,
  INSURER_PARTNER_PRESETS,
} from '../types/insurance-dispatch.types';

// In-memory cooldown storage to prevent spamming insurance adjusters
const dispatchCooldownMap = new Map<string, number>();
const COOLDOWN_DURATION_MS = 15 * 60 * 1000; // 15 minutes

// In-memory dispatch history cache for dashboard display
const dispatchHistoryStore = new Map<string, InsuranceDispatchResult[]>();

export function clearInsuranceDispatchCooldowns(): void {
  dispatchCooldownMap.clear();
  dispatchHistoryStore.clear();
}

/**
 * Builds cryptographic HMAC-SHA256 seal for tamper-proof insurance dossier verification
 */
export function generateDossierVerificationSeal(params: {
  claimReference: string;
  tripId: number;
  netIndemnityAmount: number;
  policyNumber: string;
}): { seal: string; verificationUrl: string } {
  Decimal.config({ precision: 20, rounding: Decimal.ROUND_HALF_UP });
  const normalizedNet = new Decimal(params.netIndemnityAmount).toFixed(2);
  const secretKey = process.env.REEFER_AUDIT_SECRET || 'TRANSBODANON_INSURANCE_SECRET_2026';

  const rawPayload = `${params.claimReference}:${params.tripId}:${normalizedNet}:${params.policyNumber}`;
  const seal = createHmac('sha256', secretKey).update(rawPayload).digest('hex');

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://tms.transbodanon.com';
  const verificationUrl = `${baseUrl}/verify/reefer-claim/${encodeURIComponent(params.claimReference)}?seal=${seal.substring(0, 32)}`;

  return { seal, verificationUrl };
}

/**
 * Maps cargo category to trilingual descriptive label
 */
export function getLocalizedCargoLabel(category: CargoCategory, locale: 'ar' | 'fr' | 'es'): string {
  switch (category) {
    case 'deep_frozen':
      return locale === 'ar'
        ? 'منتجات مجمدة وأسماك (-20°C)'
        : locale === 'es'
        ? 'Pescados y Congelados Ultracongelados (-20°C)'
        : 'Produits Surgelés & Poissons (-20°C)';
    case 'fresh_produce':
      return locale === 'ar'
        ? 'فواكه وخضروات طازجة (+4°C)'
        : locale === 'es'
        ? 'Frutas y Hortalizas Frescas (+4°C)'
        : 'Fruits & Légumes Frais (+4°C)';
    case 'pharma_cold':
      return locale === 'ar'
        ? 'أدوية ومستحضرات طبية GDP (+2°C إلى +8°C)'
        : locale === 'es'
        ? 'Farma y Vacunas Cadena de Frío GDP (+2°C a +8°C)'
        : 'Produits Pharmaceutiques GDP (+2°C à +8°C)';
    case 'meat_chilled':
      return locale === 'ar'
        ? 'لحوم مبردة (+0°C إلى +2°C)'
        : locale === 'es'
        ? 'Carnes Frescas Refrigeradas (+0°C a +2°C)'
        : 'Viandes Réfrigérées (+0°C à +2°C)';
    default:
      return category;
  }
}

/**
 * Builds WhatsApp notification message with full legal and financial details
 */
export function buildInsuranceWhatsAppMessage(
  payload: DispatchInsuranceClaimValidated,
  verificationUrl: string,
  dossierSeal: string
): string {
  Decimal.config({ precision: 20, rounding: Decimal.ROUND_HALF_UP });
  const grossLoss = new Decimal(payload.grossLossAmount).toFixed(2);
  const deductible = new Decimal(payload.deductibleAmount).toFixed(2);
  const netIndemnity = new Decimal(payload.netIndemnityAmount).toFixed(2);
  const insuredValue = new Decimal(payload.insuredCargoValue).toFixed(2);
  const cargoLabel = getLocalizedCargoLabel(payload.cargoCategory, payload.locale);
  const insurerPreset = INSURER_PARTNER_PRESETS[payload.insurerCompany] || INSURER_PARTNER_PRESETS.other;

  if (payload.locale === 'ar') {
    return [
      `🛡️ *إخطار رسمي بمطالبة تأمينية لتلف حمولة مبردة*`,
      `━━━━━━━━━━━━━━━━━━━━`,
      `📋 *رقم ملف المطالبة:* ${payload.claimReference}`,
      `🏢 *الجهة المؤمنة:* ${insurerPreset.name}`,
      `👤 *الخبير المكلف:* ${payload.adjusterName}`,
      `📄 *رقم البوليصة:* ${payload.policyNumber}`,
      `━━━━━━━━━━━━━━━━━━━━`,
      `🚚 *بيانات الشحنة والرحلة:*`,
      `• رقم الرحلة: ${payload.tripNumber} (ID: #${payload.tripId})`,
      `• الشاحنة: ${payload.truckPlate} | السائق: ${payload.driverName}`,
      `• صنف البضاعة: ${cargoLabel}`,
      `• القيمة المؤمنة: ${insuredValue} ${payload.currency}`,
      `━━━━━━━━━━━━━━━━━━━━`,
      `💰 *التقييم المالي والتعويض المستحق:*`,
      `• إجمالي الخسارة المقدرة: ${grossLoss} ${payload.currency}`,
      `• مبلغ التحمل (Franchise): -${deductible} ${payload.currency}`,
      `• *صافي التعويض المطالب به: ${netIndemnity} ${payload.currency}*`,
      `━━━━━━━━━━━━━━━━━━━━`,
      payload.includeEpodAnnex && payload.annexId
        ? `📎 *المرفقات القانونية:* ملحق e-POD لفتح الأبواب والانحراف الحراري (مرجع: ${payload.annexId})`
        : `📎 *المرفقات:* وثائق استلام وتفريغ رسمية`,
      payload.includeMktSummary ? `📊 يتضمن تقرير درجة الحرارة الحركية المعتمدة (MKT / EN 12830)` : '',
      `🔐 *الختم الرقمي المشفر:* \`${dossierSeal.substring(0, 24)}...\``,
      `🌐 *رابط تدقيق الملف الرسمي وتحميل المحضر المعتمد:*`,
      `${verificationUrl}`,
      `━━━━━━━━━━━━━━━━━━━━`,
      `🏢 *Trans Bodanon Logistics S.A.R.L — قسم إدارة المخاطر وسلاسل التبريد*`,
    ]
      .filter(Boolean)
      .join('\n');
  }

  if (payload.locale === 'es') {
    return [
      `🛡️ *NOTIFICACIÓN FORMAL DE SINIESTRO DE TRANSPORTE FRIGORÍFICO*`,
      `━━━━━━━━━━━━━━━━━━━━`,
      `📋 *Expediente de Siniestro:* ${payload.claimReference}`,
      `🏢 *Aseguradora:* ${insurerPreset.name}`,
      `👤 *Perito / Tramitador:* ${payload.adjusterName}`,
      `📄 *Póliza Nº:* ${payload.policyNumber}`,
      `━━━━━━━━━━━━━━━━━━━━`,
      `🚚 *Datos de Expedición y Transporte:*`,
      `• Viaje: ${payload.tripNumber} (ID: #${payload.tripId})`,
      `• Vehículo: ${payload.truckPlate} | Conductor: ${payload.driverName}`,
      `• Naturaleza de Carga: ${cargoLabel}`,
      `• Valor Asegurado Declarado: ${insuredValue} ${payload.currency}`,
      `━━━━━━━━━━━━━━━━━━━━`,
      `💰 *Evaluación de Daños e Indemnización:*`,
      `• Pérdida Bruta Evaluada: ${grossLoss} ${payload.currency}`,
      `• Franquicia Aplicable: -${deductible} ${payload.currency}`,
      `• *Indemnización Neta Reclamada: ${netIndemnity} ${payload.currency}*`,
      `━━━━━━━━━━━━━━━━━━━━`,
      payload.includeEpodAnnex && payload.annexId
        ? `📎 *Anexos Legales:* Acta e-POD de apertura de puertas y pérdida térmica (Ref: ${payload.annexId})`
        : `📎 *Anexos:* Justificantes y albarán de entrega`,
      payload.includeMktSummary ? `📊 Incluye auditoría térmica cinética media (MKT / EN 12830)` : '',
      `🔐 *Sello Digital Criptográfico:* \`${dossierSeal.substring(0, 24)}...\``,
      `🌐 *Enlace de Verificación del Dossier y Descarga Certificada:*`,
      `${verificationUrl}`,
      `━━━━━━━━━━━━━━━━━━━━`,
      `🏢 *Trans Bodanon Logistics S.A.R.L — Departamento de Siniestros & Cadena de Frío*`,
    ]
      .filter(Boolean)
      .join('\n');
  }

  // Default: French (Standard for Moroccan & EU Insurers: Allianz, RMA, AXA, Sanlam)
  return [
    `🛡️ *NOTIFICATION OFFICIELLE DE SINISTRE FRET FRIGORIFIQUE*`,
    `━━━━━━━━━━━━━━━━━━━━`,
    `📋 *Dossier de Sinistre N° :* ${payload.claimReference}`,
    `🏢 *Compagnie d'Assurance :* ${insurerPreset.name}`,
    `👤 *Expert / Gestionnaire :* ${payload.adjusterName}`,
    `📄 *Police d'Assurance :* ${payload.policyNumber}`,
    `━━━━━━━━━━━━━━━━━━━━`,
    `🚚 *Détails du Fret & Expédition :*`,
    `• Voyage : ${payload.tripNumber} (ID : #${payload.tripId})`,
    `• Véhicule : ${payload.truckPlate} | Conducteur : ${payload.driverName}`,
    `• Catégorie de Marchandise : ${cargoLabel}`,
    `• Valeur Marchande Assurée : ${insuredValue} ${payload.currency}`,
    `━━━━━━━━━━━━━━━━━━━━`,
    `💰 *Décompte d'Indemnisation Réclamée :*`,
    `• Perte Brute Constatée : ${grossLoss} ${payload.currency}`,
    `• Franchise Contractuelle : -${deductible} ${payload.currency}`,
    `• *Indemnité Nette Due : ${netIndemnity} ${payload.currency}*`,
    `━━━━━━━━━━━━━━━━━━━━`,
    payload.includeEpodAnnex && payload.annexId
      ? `📎 *Pièces Justificatives :* Annexe e-POD de déviation thermique aux quais (Réf: ${payload.annexId})`
      : `📎 *Pièces Justificatives :* Preuve de livraison e-POD`,
    payload.includeMktSummary ? `📊 Intègre le relevé cinétique de température MKT (EN 12830 / ATP)` : '',
    `🔐 *Sceau Cryptographique :* \`${dossierSeal.substring(0, 24)}...\``,
    `🌐 *Lien de Consultation Certifié & Téléchargement du Dossier :*`,
    `${verificationUrl}`,
    `━━━━━━━━━━━━━━━━━━━━`,
    `🏢 *Trans Bodanon Logistics S.A.R.L — Direction Qualité & Gestion des Sinistres*`,
  ]
    .filter(Boolean)
    .join('\n');
}

/**
 * Builds responsive HTML email template for Insurers
 */
export function buildInsuranceEmailHtml(
  payload: DispatchInsuranceClaimValidated,
  verificationUrl: string,
  dossierSeal: string
): { subject: string; html: string; text: string } {
  Decimal.config({ precision: 20, rounding: Decimal.ROUND_HALF_UP });
  const grossLoss = new Decimal(payload.grossLossAmount).toFixed(2);
  const deductible = new Decimal(payload.deductibleAmount).toFixed(2);
  const netIndemnity = new Decimal(payload.netIndemnityAmount).toFixed(2);
  const insuredValue = new Decimal(payload.insuredCargoValue).toFixed(2);
  const cargoLabel = getLocalizedCargoLabel(payload.cargoCategory, payload.locale);
  const insurerPreset = INSURER_PARTNER_PRESETS[payload.insurerCompany] || INSURER_PARTNER_PRESETS.other;

  const subject = `[TRANS BODANON / ${insurerPreset.name}] Déclaration Sinistre Fret Frigo — Dossier ${payload.claimReference} (Police: ${payload.policyNumber})`;

  const text = buildInsuranceWhatsAppMessage(payload, verificationUrl, dossierSeal);

  const html = `
<!DOCTYPE html>
<html lang="fr" dir="ltr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Dossier Sinistre ${payload.claimReference}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #1e293b; margin: 0; padding: 24px; }
    .container { max-width: 640px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
    .header { background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); color: #ffffff; padding: 28px 24px; text-align: left; }
    .badge { display: inline-block; background: #dc2626; color: #ffffff; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; padding: 4px 10px; border-radius: 9999px; margin-bottom: 12px; }
    .title { font-size: 20px; font-weight: 800; margin: 0 0 6px 0; color: #ffffff; }
    .subtitle { font-size: 13px; color: #94a3b8; margin: 0; }
    .content { padding: 24px; }
    .section-title { font-size: 13px; font-weight: 700; text-transform: uppercase; color: #64748b; letter-spacing: 0.05em; margin-bottom: 12px; border-bottom: 1px solid #f1f5f9; padding-bottom: 6px; }
    .grid { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    .grid td { padding: 8px 12px; font-size: 13px; border-bottom: 1px solid #f1f5f9; }
    .grid td.label { width: 40%; color: #64748b; font-weight: 500; }
    .grid td.value { width: 60%; color: #0f172a; font-weight: 600; text-align: right; }
    .finance-box { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px; margin-bottom: 24px; }
    .finance-row { display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 13px; }
    .finance-net { border-top: 1px dashed #86efac; padding-top: 8px; margin-top: 8px; font-size: 16px; font-weight: 800; color: #15803d; }
    .btn-container { text-align: center; margin: 28px 0; }
    .btn { display: inline-block; background: #2563eb; color: #ffffff !important; text-decoration: none; font-size: 14px; font-weight: 700; padding: 12px 28px; border-radius: 8px; box-shadow: 0 2px 4px rgba(37,99,235,0.2); }
    .seal-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px; font-size: 11px; font-family: monospace; color: #475569; word-break: break-all; margin-top: 20px; }
    .footer { background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 18px 24px; font-size: 11px; color: #94a3b8; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <span class="badge">Sinistre Marchandises Frigorifiques</span>
      <h1 class="title">Déclaration de Sinistre & Réclamation</h1>
      <p class="subtitle">Dossier Réf : <strong>${payload.claimReference}</strong> | Police N° : ${payload.policyNumber}</p>
    </div>

    <div class="content">
      <div class="section-title">Destinataire & Compagnie d'Assurance</div>
      <table class="grid">
        <tr>
          <td class="label">Compagnie d'Assurance :</td>
          <td class="value">${insurerPreset.name}</td>
        </tr>
        <tr>
          <td class="label">Gestionnaire / Expert :</td>
          <td class="value">${payload.adjusterName}</td>
        </tr>
        <tr>
          <td class="label">Département :</td>
          <td class="value">${insurerPreset.department}</td>
        </tr>
      </table>

      <div class="section-title">Informations de Transport & Marchandises</div>
      <table class="grid">
        <tr>
          <td class="label">Expédition / Voyage :</td>
          <td class="value">${payload.tripNumber} (ID: #${payload.tripId})</td>
        </tr>
        <tr>
          <td class="label">Véhicule Frigorifique :</td>
          <td class="value">${payload.truckPlate}</td>
        </tr>
        <tr>
          <td class="label">Conducteur Affecté :</td>
          <td class="value">${payload.driverName}</td>
        </tr>
        <tr>
          <td class="label">Catégorie de Denrées :</td>
          <td class="value">${cargoLabel}</td>
        </tr>
        <tr>
          <td class="label">Valeur Déclarée Assurée :</td>
          <td class="value">${insuredValue} ${payload.currency}</td>
        </tr>
        ${
          payload.annexId
            ? `<tr><td class="label">Annexe e-POD Déviation :</td><td class="value" style="color: #2563eb;">${payload.annexId}</td></tr>`
            : ''
        }
      </table>

      <div class="section-title">Décompte Financier du Sinistre</div>
      <div class="finance-box">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="font-size: 13px; color: #dc2626;">Perte Brute Évaluée :</td>
            <td style="font-size: 13px; font-weight: 700; color: #dc2626; text-align: right;">${grossLoss} ${payload.currency}</td>
          </tr>
          <tr>
            <td style="font-size: 13px; color: #64748b;">Franchise Déductible :</td>
            <td style="font-size: 13px; font-weight: 600; color: #64748b; text-align: right;">- ${deductible} ${payload.currency}</td>
          </tr>
          <tr style="border-top: 1px dashed #86efac;">
            <td style="font-size: 15px; font-weight: 800; color: #15803d; padding-top: 8px;">Indemnité Nette Réclamée :</td>
            <td style="font-size: 16px; font-weight: 800; color: #15803d; text-align: right; padding-top: 8px;">${netIndemnity} ${payload.currency}</td>
          </tr>
        </table>
      </div>

      <div class="btn-container">
        <a href="${verificationUrl}" class="btn" target="_blank">Consulter le Dossier & Télécharger l'e-POD Certifié</a>
      </div>

      <div class="seal-box">
        <strong>Sceau d'Intégrité Cryptographique (HMAC-SHA256) :</strong><br>
        ${dossierSeal}
      </div>
    </div>

    <div class="footer">
      Trans Bodanon Logistics S.A.R.L — Système de Gestion du Fret International & Chaîne du Froid (GDP / ATP)<br>
      Ce message et ses annexes sont certifiés conformes au protocole de traçabilité EN 12830.
    </div>
  </div>
</body>
</html>
  `;

  return { subject, html, text };
}

/**
 * Dispatches an insurance dossier via WhatsApp, Email, or both
 */
export async function dispatchInsuranceClaimDossier(
  rawPayload: DispatchInsuranceClaimValidated
): Promise<InsuranceDispatchResult> {
  const { claimReference, channel, forceBypassCooldown } = rawPayload;

  // 1. Anti-spam Cooldown Check
  const cooldownKey = `ins_claim_${claimReference}_${channel}`;
  const lastSent = dispatchCooldownMap.get(cooldownKey);
  const now = Date.now();

  if (lastSent && now - lastSent < COOLDOWN_DURATION_MS && !forceBypassCooldown) {
    const remainingMins = Math.ceil((COOLDOWN_DURATION_MS - (now - lastSent)) / 60000);
    return {
      success: false,
      claimReference,
      channel,
      dispatchedAt: new Date().toISOString(),
      dossierVerificationUrl: '',
      dossierSeal: '',
      rateLimited: true,
      errorMessage: `Anti-spam cooldown active. Please wait ${remainingMins} minute(s) before resending.`,
    };
  }

  // 2. Generate Cryptographic Seal & Verification URL
  const { seal, verificationUrl } = generateDossierVerificationSeal({
    claimReference: rawPayload.claimReference,
    tripId: rawPayload.tripId,
    netIndemnityAmount: rawPayload.netIndemnityAmount,
    policyNumber: rawPayload.policyNumber,
  });

  const outcome: InsuranceDispatchResult = {
    success: false,
    claimReference,
    channel,
    dispatchedAt: new Date().toISOString(),
    dossierVerificationUrl: verificationUrl,
    dossierSeal: seal,
  };

  let whatsappSuccess = false;
  let emailSuccess = false;

  // 3. Dispatch WhatsApp if requested
  if (channel === 'whatsapp' || channel === 'both') {
    const targetPhone =
      rawPayload.recipientPhone ||
      INSURER_PARTNER_PRESETS[rawPayload.insurerCompany]?.defaultPhone ||
      '+212522500100';

    const waText = buildInsuranceWhatsAppMessage(rawPayload, verificationUrl, seal);

    try {
      const waRes = await sendWhatsAppText({
        to: targetPhone,
        message: waText,
        auditEntity: {
          type: 'insurance_claim',
          id: rawPayload.tripId,
        },
      });

      outcome.whatsapp = {
        success: waRes.success,
        messageId: waRes.targetPhone,
        error: waRes.success ? undefined : waRes.reason || 'WhatsApp delivery failed',
        recipient: targetPhone,
      };

      whatsappSuccess = waRes.success;
    } catch (err) {
      outcome.whatsapp = {
        success: false,
        error: err instanceof Error ? err.message : 'Unknown WhatsApp error',
        recipient: targetPhone,
      };
    }
  }

  // 4. Dispatch Email if requested
  if (channel === 'email' || channel === 'both') {
    const targetEmail =
      rawPayload.recipientEmail ||
      INSURER_PARTNER_PRESETS[rawPayload.insurerCompany]?.defaultEmail ||
      'sinistres@allianz.ma';

    const emailContent = buildInsuranceEmailHtml(rawPayload, verificationUrl, seal);

    try {
      const mailRes = await sendCompanyEmail({
        to: targetEmail,
        subject: emailContent.subject,
        html: emailContent.html,
        text: emailContent.text,
        tripId: rawPayload.tripId,
        senderName: 'Trans Bodanon — Département Sinistres & Assurance',
      });

      outcome.email = {
        success: mailRes.success,
        messageId: typeof mailRes.data === 'object' && mailRes.data && 'id' in mailRes.data
          ? String((mailRes.data as { id: string }).id)
          : undefined,
        error: mailRes.success ? undefined : mailRes.error || 'Email dispatch failed',
        recipient: targetEmail,
      };

      emailSuccess = mailRes.success;
    } catch (err) {
      outcome.email = {
        success: false,
        error: err instanceof Error ? err.message : 'Unknown Email error',
        recipient: targetEmail,
      };
    }
  }

  // 5. Overall success criteria
  if (channel === 'both') {
    outcome.success = whatsappSuccess || emailSuccess; // At least one channel delivered
  } else if (channel === 'whatsapp') {
    outcome.success = whatsappSuccess;
  } else {
    outcome.success = emailSuccess;
  }

  // Record timestamp in cooldown map if successful
  if (outcome.success) {
    dispatchCooldownMap.set(cooldownKey, now);

    // Save in memory history
    const existing = dispatchHistoryStore.get(claimReference) || [];
    dispatchHistoryStore.set(claimReference, [outcome, ...existing]);

    // Record Audit Log (Non-blocking)
    await recordAuditLog({
      entityType: 'insurance_claim_dossier',
      entityId: claimReference,
      actionType: 'whatsapp_notification',
      reason: `Dispatched insurance claim dossier for ${claimReference} to ${rawPayload.insurerCompany} via ${channel}`,
      newData: {
        claimReference,
        channel,
        insurerCompany: rawPayload.insurerCompany,
        adjusterName: rawPayload.adjusterName,
        netIndemnityAmount: rawPayload.netIndemnityAmount,
        dossierSeal: seal,
        dispatchedAt: outcome.dispatchedAt,
      },
    });
  }

  return outcome;
}

/**
 * Retrieves dispatch history for a specific insurance claim
 */
export async function getInsuranceDispatchHistory(
  claimReference: string
): Promise<InsuranceDispatchResult[]> {
  return dispatchHistoryStore.get(claimReference) || [];
}

