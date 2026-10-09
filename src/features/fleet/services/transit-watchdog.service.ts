import Decimal from 'decimal.js';
import type { Driver, Truck, Trailer, FleetDocument } from '@/types/database';
import type {
  TransitCorridorType,
  TransitComplianceStatus,
  DocumentCheckResult,
  TransitAuditResult,
  TransitExpiryAlertItem,
  TransitWatchdogSummary,
  DocumentAlertSeverity,
} from '../types/transit-watchdog.types';
import { calculateRemainingDays } from '@/lib/utils/document-radar';

Decimal.config({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

export class TransitWatchdogService {
  /**
   * Evaluates single document validity against expiration buffer rules
   */
  public static evaluateDocument(
    docType: string,
    nameAr: string,
    nameFr: string,
    nameEs: string,
    expiryDate: string | null | undefined,
    docNumber: string | undefined,
    isRequired: boolean,
    isBlocking: boolean,
    minWarningDays: number = 30,
    minBlockingDays: number = 15,
    baseDate: Date = new Date()
  ): DocumentCheckResult {
    if (!expiryDate || !expiryDate.trim()) {
      const isBlock = isRequired && isBlocking;
      return {
        documentType: docType,
        documentNameAr: nameAr,
        documentNameFr: nameFr,
        documentNameEs: nameEs,
        documentNumber: docNumber,
        expiryDate: null,
        daysRemaining: -999,
        status: isBlock ? 'critical_block' : 'warning',
        isRequiredForCorridor: isRequired,
        isBlockingIfMissingOrExpired: isBlock,
        messageAr: `وثيقة ${nameAr} غير مسجلة بالنظام`,
        messageFr: `Document ${nameFr} non renseigné dans le système`,
        messageEs: `Documento ${nameEs} no registrado en el sistema`,
      };
    }

    const days = calculateRemainingDays(expiryDate, baseDate);

    if (days < 0) {
      return {
        documentType: docType,
        documentNameAr: nameAr,
        documentNameFr: nameFr,
        documentNameEs: nameEs,
        documentNumber: docNumber,
        expiryDate,
        daysRemaining: days,
        status: 'expired',
        isRequiredForCorridor: isRequired,
        isBlockingIfMissingOrExpired: isBlocking,
        messageAr: `وثيقة ${nameAr} منتهية الصلاحية منذ ${Math.abs(days)} يوماً`,
        messageFr: `Document ${nameFr} expiré depuis ${Math.abs(days)} jours`,
        messageEs: `Documento ${nameEs} vencido hace ${Math.abs(days)} días`,
      };
    }

    if (days <= minBlockingDays) {
      return {
        documentType: docType,
        documentNameAr: nameAr,
        documentNameFr: nameFr,
        documentNameEs: nameEs,
        documentNumber: docNumber,
        expiryDate,
        daysRemaining: days,
        status: isBlocking ? 'critical_block' : 'warning',
        isRequiredForCorridor: isRequired,
        isBlockingIfMissingOrExpired: isBlocking,
        messageAr: `صلاحية ${nameAr} حرجة جداً (متبقي ${days} يوماً فقط - غير كافية لرحلة دولية)`,
        messageFr: `Validité de ${nameFr} critique (${days}j restants - insuffisant pour transit)`,
        messageEs: `Validez de ${nameEs} crítica (quedan ${days} días - insuficiente para tránsito)`,
      };
    }

    if (days <= minWarningDays) {
      return {
        documentType: docType,
        documentNameAr: nameAr,
        documentNameFr: nameFr,
        documentNameEs: nameEs,
        documentNumber: docNumber,
        expiryDate,
        daysRemaining: days,
        status: 'warning',
        isRequiredForCorridor: isRequired,
        isBlockingIfMissingOrExpired: false,
        messageAr: `صلاحية ${nameAr} تقترب من الانتهاء (متبقي ${days} يوماً)`,
        messageFr: `Validité de ${nameFr} expire bientôt (${days}j restants)`,
        messageEs: `Validez de ${nameEs} vence pronto (quedan ${days} días)`,
      };
    }

    return {
      documentType: docType,
      documentNameAr: nameAr,
      documentNameFr: nameFr,
      documentNameEs: nameEs,
      documentNumber: docNumber,
      expiryDate,
      daysRemaining: days,
      status: 'compliant',
      isRequiredForCorridor: isRequired,
      isBlockingIfMissingOrExpired: false,
      messageAr: `صلاحية ${nameAr} سارية ومؤهلة (متبقي ${days} يوماً)`,
      messageFr: `Document ${nameFr} valide et conforme (${days}j restants)`,
      messageEs: `Documento ${nameEs} válido y conforme (quedan ${days} días)`,
    };
  }

  /**
   * Audits a driver, truck, and trailer for international cross-border dispatch
   */
  public static auditTransitCompliance(params: {
    driver: Driver;
    truck?: Truck | null;
    trailer?: Trailer | null;
    fleetDocs?: FleetDocRowInput[];
    corridorType: TransitCorridorType;
    tripId?: number | null;
    tripCode?: string;
    tripDate?: string | Date;
  }): TransitAuditResult {
    const baseDate = params.tripDate ? new Date(params.tripDate) : new Date();
    const evaluatedDocs: DocumentCheckResult[] = [];
    const blockReasons: string[] = [];
    const warnings: string[] = [];

    const driver = params.driver;
    const corridor = params.corridorType;

    // 1. Passport Check (Universal international requirement: min 180 days buffer)
    if (corridor !== 'domestic_morocco') {
      const passportDoc = this.evaluateDocument(
        'passeport',
        'جواز السفر الدولي',
        'Passeport International',
        'Pasaporte Internacional',
        (driver as any).passport_expiry_date,
        (driver as any).passport_number,
        true,
        true,
        180, // warning under 6 months
        30,  // blocking under 30 days
        baseDate
      );
      evaluatedDocs.push(passportDoc);
      if (passportDoc.status === 'critical_block' || passportDoc.status === 'expired') {
        blockReasons.push(passportDoc.messageFr);
      } else if (passportDoc.status === 'warning') {
        warnings.push(passportDoc.messageFr);
      }
    }

    // 2. European Corridor Specific Checks
    if (corridor === 'european_maritime') {
      // Schengen Visa
      const schengenDoc = this.evaluateDocument(
        'visa_schengen',
        'تأشيرة شنغن الأوروبية',
        'Visa Schengen (Type C / Pro)',
        'Visado Schengen',
        driver.visa_expiry_date,
        driver.visa_number,
        true,
        true,
        30,
        15,
        baseDate
      );
      evaluatedDocs.push(schengenDoc);
      if (schengenDoc.status === 'critical_block' || schengenDoc.status === 'expired') {
        blockReasons.push(schengenDoc.messageFr);
      } else if (schengenDoc.status === 'warning') {
        warnings.push(schengenDoc.messageFr);
      }

      // Professional Driver Card (FIMO / CAP)
      const capDoc = this.evaluateDocument(
        'driver_card_qualification',
        'بطاقة السائق المهني (CAP / FIMO)',
        'Carte Qualification Conducteur (FIMO/CAP)',
        'Tarjeta Cualificación Conductor (CAP)',
        (driver as any).driver_card_qualification_expiry,
        undefined,
        false,
        false,
        30,
        7,
        baseDate
      );
      evaluatedDocs.push(capDoc);
      if (capDoc.status === 'warning') warnings.push(capDoc.messageFr);
    }

    // 3. African Overland Corridor Specific Checks
    if (corridor === 'african_overland') {
      // African Visa (Mauritania / Senegal)
      const africanDoc = this.evaluateDocument(
        'visa_afrique',
        'تأشيرة الممر الإفريقي (موريتانيا / السنغال)',
        'Visa Transit Africain (Mauritanie / Sénégal)',
        'Visado Corredor Africano',
        driver.african_visa_expiry_date,
        driver.african_visa_number,
        true,
        true,
        25,
        10,
        baseDate
      );
      evaluatedDocs.push(africanDoc);
      if (africanDoc.status === 'critical_block' || africanDoc.status === 'expired') {
        blockReasons.push(africanDoc.messageFr);
      } else if (africanDoc.status === 'warning') {
        warnings.push(africanDoc.messageFr);
      }

      // Yellow Fever Vaccination (WHO / OMS standard: life-long validity if administered >= 10 days ago)
      const vaccineDate = (driver as any).yellow_fever_vaccine_date;
      let yellowFeverDoc: DocumentCheckResult;
      if (!vaccineDate) {
        yellowFeverDoc = {
          documentType: 'certificat_fievre_jaune',
          documentNameAr: 'شهادة تلقيح الحمى الصفراء',
          documentNameFr: 'Certificat Fièvre Jaune (OMS)',
          documentNameEs: 'Certificado Fiebre Amarilla',
          expiryDate: null,
          daysRemaining: -999,
          status: 'warning',
          isRequiredForCorridor: true,
          isBlockingIfMissingOrExpired: false,
          messageAr: 'شهادة تلقيح الحمى الصفراء غير مسجلة (موصى بها للمرور بالسنغال)',
          messageFr: 'Certificat de vaccination fièvre jaune non renseigné (requis pour le Sénégal)',
          messageEs: 'Certificado de vacunación fiebre amarilla no registrado',
        };
        warnings.push(yellowFeverDoc.messageFr);
      } else {
        const adminDate = new Date(vaccineDate);
        const daysSinceVaccine = Math.round((baseDate.getTime() - adminDate.getTime()) / (1000 * 60 * 60 * 24));
        if (daysSinceVaccine >= 10) {
          yellowFeverDoc = {
            documentType: 'certificat_fievre_jaune',
            documentNameAr: 'شهادة تلقيح الحمى الصفراء',
            documentNameFr: 'Certificat Fièvre Jaune (OMS)',
            documentNameEs: 'Certificado Fiebre Amarilla',
            expiryDate: vaccineDate,
            daysRemaining: 9999,
            status: 'compliant',
            isRequiredForCorridor: true,
            isBlockingIfMissingOrExpired: false,
            messageAr: 'تلقيح الحمى الصفراء سارٍ مدى الحياة (وفق لوائح منظمة الصحة العالمية)',
            messageFr: 'Vaccin fièvre jaune valide à vie (Norme OMS / RSI)',
            messageEs: 'Vacuna fiebre amarilla válida de por vida (Norma OMS)',
          };
        } else {
          yellowFeverDoc = {
            documentType: 'certificat_fievre_jaune',
            documentNameAr: 'شهادة تلقيح الحمى الصفراء',
            documentNameFr: 'Certificat Fièvre Jaune (OMS)',
            documentNameEs: 'Certificado Fiebre Amarilla',
            expiryDate: vaccineDate,
            daysRemaining: 10 - daysSinceVaccine,
            status: 'warning',
            isRequiredForCorridor: true,
            isBlockingIfMissingOrExpired: false,
            messageAr: `التلقيح حديث ويسري مفعوله بعد ${10 - daysSinceVaccine} أيام`,
            messageFr: `Vaccin récent, prend effet dans ${10 - daysSinceVaccine} jours`,
            messageEs: `Vacuna reciente, surte efecto en ${10 - daysSinceVaccine} días`,
          };
          warnings.push(yellowFeverDoc.messageFr);
        }
      }
      evaluatedDocs.push(yellowFeverDoc);
    }

    // 4. Vehicle & Trailer Document Checks
    const fleetDocs = params.fleetDocs || [];
    if (params.truck) {
      const truckId = params.truck.id;
      const truckDocs = fleetDocs.filter((d) => d.entity_type === 'truck' && d.entity_id === truckId);

      // Green Card (Carte Verte) for Europe
      if (corridor === 'european_maritime') {
        const carteVerte = truckDocs.find((d) => d.document_type === 'carte_verte' || d.doc_type === 'carte_verte');
        const cvDoc = this.evaluateDocument(
          'carte_verte_camion',
          'البطاقة الخضراء للتأمين الدولي (شاحنة)',
          'Carte Verte Assurance Internationale (Tracteur)',
          'Carta Verde Seguro Internacional (Camión)',
          carteVerte?.expiry_date,
          carteVerte?.document_number,
          true,
          true,
          30,
          10,
          baseDate
        );
        evaluatedDocs.push(cvDoc);
        if (cvDoc.status === 'critical_block' || cvDoc.status === 'expired') blockReasons.push(cvDoc.messageFr);
        else if (cvDoc.status === 'warning') warnings.push(cvDoc.messageFr);
      }

      // Brown Card (Carte Brune CEDEAO) for Africa
      if (corridor === 'african_overland') {
        const carteBrune = truckDocs.find((d) => d.document_type === 'carte_brune_cedeao' || d.doc_type === 'carte_brune_cedeao');
        const cbDoc = this.evaluateDocument(
          'carte_brune_camion',
          'البطاقة البنية للتأمين الإفريقي (شاحنة)',
          'Carte Brune CEDEAO Assurance (Tracteur)',
          'Carta Marrón CEDEAO Seguro (Camión)',
          carteBrune?.expiry_date,
          carteBrune?.document_number,
          true,
          true,
          25,
          7,
          baseDate
        );
        evaluatedDocs.push(cbDoc);
        if (cbDoc.status === 'critical_block' || cbDoc.status === 'expired') blockReasons.push(cbDoc.messageFr);
        else if (cbDoc.status === 'warning') warnings.push(cbDoc.messageFr);
      }

      // Technical Inspection (Visite Technique)
      const vtDocItem = truckDocs.find((d) => d.document_type === 'visite_technique' || d.doc_type === 'visite_technique');
      const vtDoc = this.evaluateDocument(
        'visite_technique_camion',
        'الفحص التقني الدوري (شاحنة)',
        'Contrôle Technique / Visite (Tracteur)',
        'Inspección Técnica ITV (Camión)',
        vtDocItem?.expiry_date,
        vtDocItem?.document_number,
        true,
        true,
        20,
        5,
        baseDate
      );
      evaluatedDocs.push(vtDoc);
      if (vtDoc.status === 'critical_block' || vtDoc.status === 'expired') blockReasons.push(vtDoc.messageFr);
      else if (vtDoc.status === 'warning') warnings.push(vtDoc.messageFr);
    }

    // Determine Overall Status
    let overallStatus: TransitComplianceStatus = 'compliant';
    if (blockReasons.length > 0) {
      overallStatus = 'critical_block';
    } else if (warnings.length > 0) {
      overallStatus = 'warning';
    }

    return {
      trip_id: params.tripId,
      trip_code: params.tripCode,
      driver_id: driver.id,
      driver_name: driver.name,
      driver_phone: driver.phone,
      truck_id: params.truck?.id,
      truck_plate: params.truck?.plate_number,
      trailer_id: params.trailer?.id,
      trailer_plate: params.trailer?.plate_number,
      corridor_type: corridor,
      overall_status: overallStatus,
      is_dispatch_allowed: blockReasons.length === 0,
      block_reasons: blockReasons,
      warnings,
      evaluated_documents: evaluatedDocs,
      created_at: new Date().toISOString(),
    };
  }

  /**
   * Generates aggregated statistics and compliance rate across the entire fleet
   */
  public static generateWatchdogSummary(
    drivers: Driver[],
    trucks: Truck[],
    fleetDocs: FleetDocRowInput[] = []
  ): TransitWatchdogSummary {
    const totalDrivers = drivers.length;
    const totalVehicles = trucks.length;

    let compliantCount = 0;
    let upcomingExpiringCount = 0; // <= 30 days
    let criticalExpiringCount = 0; // <= 15 days
    let expiredOrBlockedCount = 0;
    let euReady = 0;
    let africaReady = 0;

    drivers.forEach((d) => {
      // Evaluate for EU
      const euAudit = this.auditTransitCompliance({
        driver: d,
        corridorType: 'european_maritime',
      });
      if (euAudit.is_dispatch_allowed) euReady++;

      // Evaluate for Africa
      const africaAudit = this.auditTransitCompliance({
        driver: d,
        corridorType: 'african_overland',
      });
      if (africaAudit.is_dispatch_allowed) africaReady++;

      if (euAudit.overall_status === 'critical_block' || africaAudit.overall_status === 'critical_block') {
        expiredOrBlockedCount++;
      } else if (euAudit.overall_status === 'warning' || africaAudit.overall_status === 'warning') {
        upcomingExpiringCount++;
      } else {
        compliantCount++;
      }
    });

    const totalAudits = totalDrivers;
    const complianceRate = totalAudits > 0
      ? new Decimal(compliantCount).dividedBy(totalAudits).times(100).toFixed(1)
      : '100.0';

    return {
      totalMonitoredDrivers: totalDrivers,
      totalMonitoredVehicles: totalVehicles,
      compliantCount,
      upcomingExpiringCount,
      criticalExpiringCount,
      expiredOrBlockedCount,
      europeanCorridorReadyCount: euReady,
      africanCorridorReadyCount: africaReady,
      complianceRatePercentage: `${complianceRate}%`,
    };
  }

  /**
   * Builds localized WhatsApp notification text for driver credential alert
   */
  public static buildDriverWhatsAppAlertText(params: {
    driverName: string;
    documentNameAr: string;
    documentNameFr: string;
    documentNameEs: string;
    daysRemaining: number;
    expiryDate: string;
    locale?: 'ar' | 'fr' | 'es';
  }): string {
    const { driverName, documentNameAr, documentNameFr, documentNameEs, daysRemaining, expiryDate, locale = 'ar' } = params;

    if (locale === 'fr') {
      return `⚠️ *Alerte Trans Bodanon TMS — Document Chauffeur*

Bonjour *${driverName}*,
Votre document *${documentNameFr}* expire dans *${daysRemaining} jours* (Date limite: ${expiryDate}).

Veuillez vous rapprocher du service administratif pour renouvellement immédiat afin d'éviter tout blocage de mission internationale.`;
    }

    if (locale === 'es') {
      return `⚠️ *Alerta Trans Bodanon TMS — Documento Conductor*

Estimado *${driverName}*,
Su documento *${documentNameEs}* vence en *${daysRemaining} días* (Fecha: ${expiryDate}).

Por favor contacte con administración para su renovación y evitar retenciones en frontera.`;
    }

    // Default Arabic
    return `⚠️ *تنبيه منصة ترانس بودانون — صلاحية وثيقة العبور*

مرحباً بك كابتن *${driverName}*،
نحيطكم علماً بأن وثيقة *${documentNameAr}* الخاصة بكم قاربت على الانتهاء:
⏱️ *المتبقي*: ${daysRemaining} يوماً
📅 *تاريخ الانتهاء*: ${expiryDate}

يرجى مراجعة إدارة العمليات لتجديد الوثيقة وتفادي أي توقف عند المعابر الحدودية والموانئ.`;
  }
}

export interface FleetDocRowInput {
  entity_type: string;
  entity_id: number;
  document_type?: string;
  doc_type?: string;
  document_number?: string;
  expiry_date?: string | null;
}

