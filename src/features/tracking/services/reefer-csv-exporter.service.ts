/**
 * Trans Bodanon TMS — Reefer DataCOLD CSV Exporter Service
 * Standard EN 12830 & GDP Compliant Temperature Telematics CSV Generation
 * Uses UTF-8 BOM for seamless Microsoft Excel compatibility across AR, FR, ES.
 */

import Decimal from 'decimal.js';
import type { ReeferReportExportContext } from '../types/reefer-export.types';

export class ReeferCsvExporterService {
  /**
   * Generates an official EN 12830 / DataCOLD CSV string with UTF-8 BOM
   */
  public static generateReeferCsv(context: ReeferReportExportContext): string {
    const { company, trip, profile, evaluation, logs, locale, verificationHash } = context;

    const BOM = '\uFEFF';

    const labels = {
      ar: {
        docTitle: 'سجل تفريغ درجات حرارة التبريد المعتمد (EN 12830 / DataCOLD)',
        company: 'الشركة الناقلة',
        tripId: 'رقم الرحلة المرجعي',
        cmr: 'رقم وثيقة النقل الدولي (CMR)',
        route: 'المسار التشغيلي',
        truckTrailer: 'الشاحنة / المقطورة',
        driver: 'السائق المكلف',
        reeferUnit: 'وحدة التبريد والمواصفة',
        cargoType: 'نوع البضاعة الحساسة',
        setpoint: 'نقطة الضبط المحددة',
        mkt: 'الحرارة الحركية المتوسطة (MKT)',
        compliance: 'حالة الامتثال لمعايير GDP',
        score: 'نسبة الالتزام الحراري',
        hash: 'البصمة الرقمية للنزاهة (HMAC-SHA256)',
        colIndex: 'الرقم',
        colTimestampIso: 'التوقيت القياسي (ISO 8601)',
        colSupplyAir: 'حرارة الضخ (°C)',
        colReturnAir: 'حرارة الراجع (°C)',
        colAmbient: 'الحرارة المحيطة (°C)',
        colEvaporator: 'حرارة المبخر (°C)',
        colCompressor: 'حالة الضاغط',
        colDefrost: 'إذابة الجليد',
        colDoor: 'حساس الأبواب',
        colFuelLevel: 'مستوى الوقود (لتر)',
        colFuelBurnRate: 'معدل الاستهلاك (لتر/ساعة)',
        colLatitude: 'خط العرض',
        colLongitude: 'خط الطول',
        colGeofence: 'الأمان الجغرافي',
        doorClosed: 'مغلق',
        doorOpen: 'مفتوح',
        yes: 'نعم',
        no: 'لا',
        safe: 'آمن',
        breached: 'مخترق',
      },
      fr: {
        docTitle: 'Rapport Télématique Certifié EN 12830 (DataCOLD / TracKing)',
        company: 'Transporteur Officiel',
        tripId: 'ID Mission / Voyage',
        cmr: 'Lettre de Voiture (CMR)',
        route: 'Corridor Opérationnel',
        truckTrailer: 'Tracteur / Remorque Frigo',
        driver: 'Chauffeur Assigné',
        reeferUnit: 'Groupe Frigorifique & Norme',
        cargoType: 'Marchandise Sous Température Dirigée',
        setpoint: 'Consigne Programmée',
        mkt: 'Température Cinétique Moyenne (MKT)',
        compliance: 'Statut de Conformité GDP',
        score: 'Score de Conformité',
        hash: 'Empreinte Numérique Intégrité (HMAC-SHA256)',
        colIndex: 'Index',
        colTimestampIso: 'Horodatage (ISO 8601)',
        colSupplyAir: 'Air Soufflé (°C)',
        colReturnAir: 'Air Repris (°C)',
        colAmbient: 'Air Ambiant (°C)',
        colEvaporator: 'Évaporateur (°C)',
        colCompressor: 'Compresseur',
        colDefrost: 'Dégivrage',
        colDoor: 'Capteur Portes',
        colFuelLevel: 'Niveau Gazole (L)',
        colFuelBurnRate: 'Conso Gazole (L/h)',
        colLatitude: 'Latitude',
        colLongitude: 'Longitude',
        colGeofence: 'Sécurité Géo',
        doorClosed: 'Fermé',
        doorOpen: 'Ouvert',
        yes: 'Oui',
        no: 'Non',
        safe: 'Sûr',
        breached: 'Violé',
      },
      es: {
        docTitle: 'Informe Telemático Certificado EN 12830 (DataCOLD / TracKing)',
        company: 'Transportista Oficial',
        tripId: 'ID Viaje / Misión',
        cmr: 'Carta de Porte (CMR)',
        route: 'Ruta Operativa',
        truckTrailer: 'Tractora / Semirremolque Frigo',
        driver: 'Conductor Asignado',
        reeferUnit: 'Equipo Frigorífico y Norma',
        cargoType: 'Mercancía a Temperatura Controlada',
        setpoint: 'Punto de Consigna',
        mkt: 'Temperatura Cinética Media (MKT)',
        compliance: 'Estado de Conformidad GDP',
        score: 'Puntuación de Cumplimiento',
        hash: 'Huella Digital de Integridad (HMAC-SHA256)',
        colIndex: 'Índice',
        colTimestampIso: 'Marca Temporal (ISO 8601)',
        colSupplyAir: 'Aire Impulsado (°C)',
        colReturnAir: 'Aire Retorno (°C)',
        colAmbient: 'Aire Ambiente (°C)',
        colEvaporator: 'Evaporador (°C)',
        colCompressor: 'Compresor',
        colDefrost: 'Desescarche',
        colDoor: 'Sensor Puertas',
        colFuelLevel: 'Nivel Combustible (L)',
        colFuelBurnRate: 'Consumo (L/h)',
        colLatitude: 'Latitud',
        colLongitude: 'Longitud',
        colGeofence: 'Seguridad Geo',
        doorClosed: 'Cerrado',
        doorOpen: 'Abierto',
        yes: 'Sí',
        no: 'No',
        safe: 'Seguro',
        breached: 'Vulnerado',
      },
    }[locale];

    const lines: string[] = [];

    // 1. Metadata Comment Block
    lines.push(`# ${labels.docTitle}`);
    lines.push(`# ${labels.company}: ${company.name} | ICE: ${company.ice} | RC: ${company.rc}`);
    lines.push(`# ${labels.tripId}: ${trip.tripId} | ${labels.cmr}: ${trip.cmrNumber || 'N/A'} | ${labels.route}: ${trip.routeName || 'International Corridor'}`);
    lines.push(`# ${labels.truckTrailer}: ${trip.truckPlate || 'N/A'} / ${trip.trailerPlate || 'Frigo'} | ${labels.driver}: ${trip.driverName || 'N/A'}`);
    lines.push(`# ${labels.reeferUnit}: ${profile.coolingUnitBrand} (ATP ${profile.atpClass.toUpperCase()}) | ${labels.cargoType}: ${profile.cargoCategory}`);
    lines.push(`# ${labels.setpoint}: ${profile.setpointTemp > 0 ? `+${profile.setpointTemp}` : profile.setpointTemp}°C | ${labels.mkt}: ${evaluation.mktTemperatureCelsius > 0 ? `+${evaluation.mktTemperatureCelsius}` : evaluation.mktTemperatureCelsius}°C`);
    lines.push(`# ${labels.compliance}: ${evaluation.complianceStatus.toUpperCase()} (${labels.score}: ${evaluation.complianceScorePercent}%)`);
    lines.push(`# ${labels.hash}: ${verificationHash}`);
    lines.push('# --------------------------------------------------------------------------------');

    // 2. CSV Column Headers
    const headers = [
      labels.colIndex,
      labels.colTimestampIso,
      labels.colSupplyAir,
      labels.colReturnAir,
      labels.colAmbient,
      labels.colEvaporator,
      labels.colCompressor,
      labels.colDefrost,
      labels.colDoor,
      labels.colFuelLevel,
      labels.colFuelBurnRate,
      labels.colLatitude,
      labels.colLongitude,
      labels.colGeofence,
    ];
    lines.push(headers.join(','));

    // 3. Data Rows
    logs.forEach((log, index) => {
      const supplyTempStr = new Decimal(log.supplyAirTemp).toFixed(2);
      const returnTempStr = new Decimal(log.returnAirTemp).toFixed(2);
      const ambientTempStr = log.ambientTemp !== undefined ? new Decimal(log.ambientTemp).toFixed(2) : '';
      const evapTempStr = log.evaporatorTemp !== undefined ? new Decimal(log.evaporatorTemp).toFixed(2) : '';
      const fuelLevelStr = log.dieselFuelLevelLiters !== undefined ? new Decimal(log.dieselFuelLevelLiters).toFixed(1) : '';
      const burnRateStr = log.dieselBurnRateLph !== undefined ? new Decimal(log.dieselBurnRateLph).toFixed(2) : '';

      const row = [
        index + 1,
        `"${log.recordedAt}"`,
        supplyTempStr,
        returnTempStr,
        ambientTempStr,
        evapTempStr,
        `"${log.compressorStatus}"`,
        `"${log.isDefrostActive ? labels.yes : labels.no}"`,
        `"${log.doorOpenSensor ? labels.doorOpen : labels.doorClosed}"`,
        fuelLevelStr,
        burnRateStr,
        log.latitude !== undefined ? log.latitude.toFixed(6) : '',
        log.longitude !== undefined ? log.longitude.toFixed(6) : '',
        `"${log.isGeofenceSafe ? labels.safe : labels.breached}"`,
      ];
      lines.push(row.join(','));
    });

    return BOM + lines.join('\r\n');
  }
}

