const fs = require('fs');
const path = require('path');

const arPath = path.join(__dirname, '../src/i18n/messages/ar.json');
const frPath = path.join(__dirname, '../src/i18n/messages/fr.json');
const esPath = path.join(__dirname, '../src/i18n/messages/es.json');

const arData = JSON.parse(fs.readFileSync(arPath, 'utf8'));
const frData = JSON.parse(fs.readFileSync(frPath, 'utf8'));
const esData = JSON.parse(fs.readFileSync(esPath, 'utf8'));

const fuelFraudI18n = {
  ar: {
    title: "رادار كشف احتيال وشفط الوقود",
    subtitle: "الربط الميداني اللحظي بين حساسات الخزان وتدفقات TCO/FMS وفواتير التزود",
    activeAlerts: "إنذارات احتيال نشطة",
    confirmedDeductions: "خصومات معتمدة على السائقين",
    totalLossVolume: "إجمالي الوقود المفقود",
    totalLossFinancial: "إجمالي الخسارة المالية",
    siphoningCount: "حالات شفط الوقود",
    overflowCount: "تجاوز سعة الخزان",
    ghostCount: "تزود وهمي وتضخيم فواتير",
    radarScan: "تشغيل فحص الرادار اللحظي",
    scanning: "جاري تحليل تدفقات الوقود...",
    scanCompleted: "اكتمل فحص التدفقات بنجاح",
    tableTitle: "سجل وقائع الاشتباه والسرقة الميدانية",
    filterAll: "جميع الحالات",
    filterDetected: "قيد المراجعة",
    filterConfirmed: "تم الخصم",
    filterJustified: "مبرر ومقبول",
    filterDismissed: "مستبعد",
    incidentType: "نوع الواقعة",
    truck: "الشاحنة",
    driver: "السائق",
    lossLiters: "الوقود المفقود",
    lossFinancial: "الخسارة المقدرة",
    confidenceScore: "مؤشر الثقة",
    status: "الحالة",
    location: "الموقع الجغرافي",
    actions: "الإجراءات",
    viewDetails: "معاينة التفاصيل",
    confirmDeduction: "اعتماد الخصم من السائق",
    acceptJustification: "قبول التبرير",
    dismiss: "استبعاد الواقعة",
    confirmDeductionTitle: "تأكيد اقتطاع قيمة الوقود المسروق",
    confirmDeductionDesc: "سيتم تسجيل الخصم المالي مباشرة على حساب السائق وربطه بكشف التصفية النهائي.",
    justificationNotes: "ملاحظات التبرير أو تقرير المعاينة",
    confirmButton: "تأكيد واعتماد",
    cancel: "إلغاء",
    noIncidentsFound: "لا توجد وقائع احتيال أو شفط وقود مسجلة",
    cleanFleetMsg: "حالة الأسطول ممتازة - جميع تدفقات الوقود متطابقة مع الاستهلاك المعياري وحساسات الخزان."
  },
  fr: {
    title: "Radar Anti-Fraude & Siphonage Carburant",
    subtitle: "Corrélation en temps réel entre capteurs réservoir, flux TCO/FMS et factures",
    activeAlerts: "Alertes de fraude actives",
    confirmedDeductions: "Déductions confirmées chauffeurs",
    totalLossVolume: "Volume total de carburant perdu",
    totalLossFinancial: "Perte financière totale",
    siphoningCount: "Cas de siphonage",
    overflowCount: "Dépassement capacité réservoir",
    ghostCount: "Pleins fictifs & surfacturation",
    radarScan: "Lancer le scan radar en direct",
    scanning: "Analyse des flux télématiques en cours...",
    scanCompleted: "Audit des flux complété avec succès",
    tableTitle: "Registre des incidents et suspicions de vol",
    filterAll: "Tous les statuts",
    filterDetected: "En révision",
    filterConfirmed: "Déduit",
    filterJustified: "Justifié & accepté",
    filterDismissed: "Rejeté",
    incidentType: "Type d'incident",
    truck: "Véhicule",
    driver: "Chauffeur",
    lossLiters: "Carburant perdu",
    lossFinancial: "Perte estimée",
    confidenceScore: "Indice de confiance",
    status: "Statut",
    location: "Position géographique",
    actions: "Actions",
    viewDetails: "Voir détails",
    confirmDeduction: "Confirmer la déduction chauffeur",
    acceptJustification: "Accepter la justification",
    dismiss: "Écarter l'incident",
    confirmDeductionTitle: "Confirmation de retenue sur chauffeur",
    confirmDeductionDesc: "La déduction financière sera immédiatement imputée au compte du chauffeur et intégrée au quitus final.",
    justificationNotes: "Notes de justification ou rapport d'inspection",
    confirmButton: "Confirmer et valider",
    cancel: "Annuler",
    noIncidentsFound: "Aucun incident de fraude ou siphonage enregistré",
    cleanFleetMsg: "Flotte saine - Tous les flux de carburant sont conformes à la télématique et aux normes de consommation."
  },
  es: {
    title: "Radar Antifraude y Sifonaje de Combustible",
    subtitle: "Correlación en tiempo real entre sensores de tanque, flujo TCO/FMS y repostajes",
    activeAlerts: "Alertas de fraude activas",
    confirmedDeductions: "Deducciones confirmadas a conductores",
    totalLossVolume: "Volumen total de combustible perdido",
    totalLossFinancial: "Pérdida financiera total",
    siphoningCount: "Casos de sifonaje",
    overflowCount: "Exceso capacidad depósito",
    ghostCount: "Repostajes ficticios y sobrecoste",
    radarScan: "Ejecutar escaneo radar en vivo",
    scanning: "Analizando flujos telemáticos...",
    scanCompleted: "Auditoría de flujos completada con éxito",
    tableTitle: "Registro de incidentes y sospechas de robo",
    filterAll: "Todos los estados",
    filterDetected: "En revisión",
    filterConfirmed: "Deducido",
    filterJustified: "Justificado y aceptado",
    filterDismissed: "Descartado",
    incidentType: "Tipo de incidente",
    truck: "Camión",
    driver: "Conductor",
    lossLiters: "Combustible perdido",
    lossFinancial: "Pérdida estimada",
    confidenceScore: "Índice de confianza",
    status: "Estado",
    location: "Ubicación geográfica",
    actions: "Acciones",
    viewDetails: "Ver detalles",
    confirmDeduction: "Confirmar deducción al conductor",
    acceptJustification: "Aceptar justificación",
    dismiss: "Descartar incidente",
    confirmDeductionTitle: "Confirmación de retención al conductor",
    confirmDeductionDesc: "La deducción financiera se aplicará directamente en la cuenta del conductor y su liquidación final.",
    justificationNotes: "Notas de justificación o informe de revisión",
    confirmButton: "Confirmar y validar",
    cancel: "Cancelar",
    noIncidentsFound: "No hay incidentes de fraude o sifonaje registrados",
    cleanFleetMsg: "Flota en perfecto estado: todos los consumos coinciden con los sensores y parámetros normativos."
  }
};

arData.fuelFraud = fuelFraudI18n.ar;
frData.fuelFraud = fuelFraudI18n.fr;
esData.fuelFraud = fuelFraudI18n.es;

for (const [lang, data, filePath] of [["ar", arData, arPath], ["fr", frData, frPath], ["es", esData, esPath]]) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n", 'utf8');
}

console.log("Successfully synchronized fuelFraud i18n keys across AR, FR, and ES!");

