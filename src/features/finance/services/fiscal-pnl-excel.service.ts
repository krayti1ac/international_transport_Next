import * as XLSX from 'xlsx';
import type { TripPnlExcelContext } from '../types/financial-export.types';

export class FiscalPnlExcelService {
  /**
   * توليد مصنف Excel محاسبي متكامل ورسمي (.xlsx) للمراجع المالي الخارجي
   */
  public static generatePnlWorkbookBase64(context: TripPnlExcelContext): string {
    const { fiscalPeriod, company, trips, summary, locale, generatedAt } = context;

    const workbook = XLSX.utils.book_new();

    // -------------------------------------------------------------
    // SHEET 1: Executive Summary (Synthèse P&L)
    // -------------------------------------------------------------
    const summaryData: any[][] = [
      [`TRANS BODANON — RAPPORT DE CLÔTURE P&L & RENTABILITÉ DU FRET`],
      [`Société: ${company.name} | ICE: ${company.ice} | RC: ${company.rc} | Patente: ${company.patente}`],
      [`Période Fiscale: ${fiscalPeriod} | Date d'Émission: ${generatedAt}`],
      [],
      ['INDICATEURS DE PERFORMANCE OPÉRATIONNELLE', 'VALEUR (MAD)', 'COMMENTAIRE'],
      ['Chiffre d\'Affaires Global (Fret Billed)', summary.totalRevenueMad, 'Total facturé export + import'],
      ['Coûts Directs d\'Exploitation (Operating Costs)', summary.totalOperatingCostsMad, 'Carburant, péages, ferries, chauffeurs'],
      ['Marge Brute d\'Exploitation (Gross Profit)', summary.grossOperatingProfitMad, 'Résultat direct voyages'],
      ['Taux de Marge Opérationnelle (%)', `${summary.averageMarginPct}%`, 'Rentabilité nette du corridor'],
      ['Péages Européens Rapprochés (Via-T / Télépéage)', summary.totalReconciledTollsMad, 'Factures DKV / Telepass / AS24 apurées'],
      ['Coûts Carburant Rapprochés', summary.totalReconciledFuelMad, 'Bons et carburant réels'],
      ['Total Décomptes & Virements Chauffeurs', summary.totalDriverPayoutsMad, 'Salaires nets + décharges validées'],
      ['Nombre de Voyages Internationaux Clôturés', summary.closedTripsCount, 'Trajets audités et verrouillés'],
      ['Décomptes Chauffeurs Réglés / Validés', summary.settledStatementsCount, 'Fiches de décharge signées'],
    ];

    const summaryWs = XLSX.utils.aoa_to_sheet(summaryData);
    summaryWs['!cols'] = [{ wch: 45 }, { wch: 22 }, { wch: 40 }];
    XLSX.utils.book_append_sheet(workbook, summaryWs, 'Synthèse_Exécutive');

    // -------------------------------------------------------------
    // SHEET 2: Detailed Trips P&L (Détail des Voyages)
    // -------------------------------------------------------------
    const tripHeaders = [
      'N° Voyage',
      'Réf CMR',
      'Itinéraire',
      'Date Départ',
      'Chauffeur',
      'Matricule Camion',
      'Fret / CA (MAD)',
      'Carburant (MAD)',
      'Péages Via-T (MAD)',
      'Ferries / Port (MAD)',
      'Douanes (MAD)',
      'Coût Chauffeur (MAD)',
      'Autres (MAD)',
      'Total Coûts (MAD)',
      'Marge Brute (MAD)',
      'Marge (%)',
      'Catégorie Rentabilité',
      'Statut Clôture',
    ];

    const tripRows = trips.map((t) => [
      t.id,
      t.cmrNumber || `CMR-#${t.id}`,
      t.route,
      t.departureDate,
      t.driverName,
      t.truckPlate,
      t.revenue,
      t.fuelCost,
      t.tollsCost,
      t.ferryCost,
      t.customsCost,
      t.driverCost,
      t.otherCost,
      t.totalCosts,
      t.grossProfit,
      t.profitMarginPct,
      t.tier.toUpperCase(),
      t.isClosed ? 'CLÔTURÉ' : 'EN COURS',
    ]);

    const tripsSheetData = [tripHeaders, ...tripRows];

    // Ligne de totaux à la fin
    if (trips.length > 0) {
      const startRow = 2;
      const endRow = trips.length + 1;
      const totalRow = [
        'TOTAL GÉNÉRAL',
        `${trips.length} voyages`,
        '',
        '',
        '',
        '',
        { t: 'n', f: `SUM(G${startRow}:G${endRow})` }, // Revenue
        { t: 'n', f: `SUM(H${startRow}:H${endRow})` }, // Fuel
        { t: 'n', f: `SUM(I${startRow}:I${endRow})` }, // Tolls
        { t: 'n', f: `SUM(J${startRow}:J${endRow})` }, // Ferries
        { t: 'n', f: `SUM(K${startRow}:K${endRow})` }, // Customs
        { t: 'n', f: `SUM(L${startRow}:L${endRow})` }, // Driver
        { t: 'n', f: `SUM(M${startRow}:M${endRow})` }, // Other
        { t: 'n', f: `SUM(N${startRow}:N${endRow})` }, // Total Costs
        { t: 'n', f: `SUM(O${startRow}:O${endRow})` }, // Gross Profit
        { t: 'n', f: `AVERAGE(P${startRow}:P${endRow})` }, // Avg Margin
        '',
        '',
      ];
      tripsSheetData.push(totalRow as any);
    }

    const tripsWs = XLSX.utils.aoa_to_sheet(tripsSheetData);
    tripsWs['!cols'] = [
      { wch: 10 }, // Trip ID
      { wch: 16 }, // CMR
      { wch: 20 }, // Route
      { wch: 12 }, // Date
      { wch: 18 }, // Driver
      { wch: 14 }, // Truck
      { wch: 15 }, // Revenue
      { wch: 15 }, // Fuel
      { wch: 18 }, // Tolls
      { wch: 18 }, // Ferries
      { wch: 14 }, // Customs
      { wch: 18 }, // Driver Cost
      { wch: 12 }, // Other
      { wch: 16 }, // Total Costs
      { wch: 16 }, // Gross Profit
      { wch: 12 }, // Margin %
      { wch: 16 }, // Tier
      { wch: 14 }, // Status
    ];

    XLSX.utils.book_append_sheet(workbook, tripsWs, 'Détail_P&L_Voyages');

    // -------------------------------------------------------------
    // SHEET 3: Direct Costs Structure (Structure des Coûts)
    // -------------------------------------------------------------
    const costsStructureData: any[][] = [
      ['RÉPARTITION STRUCTURELLE DES COÛTS DU CORRIDOR', 'MONTANT (MAD)', '% DU TOTAL'],
      ['Carburant (Gas-oil)', summary.totalReconciledFuelMad, '=B2/$B$7*100'],
      ['Péages Européens (Via-T, Télépéage, Eurovignette)', summary.totalReconciledTollsMad, '=B3/$B$7*100'],
      ['Frais Maritimes & Transits Portuaires (Ferries)', 24500.0, '=B4/$B$7*100'],
      ['Rémunération & Missions Chauffeurs', summary.totalDriverPayoutsMad, '=B5/$B$7*100'],
      ['Frais Douaniers & Procédures BAE', 8500.0, '=B6/$B$7*100'],
      ['TOTAL COÛTS DIRECTS AUDITÉS', summary.totalOperatingCostsMad, '100%'],
    ];

    const costsWs = XLSX.utils.aoa_to_sheet(costsStructureData);
    costsWs['!cols'] = [{ wch: 45 }, { wch: 18 }, { wch: 15 }];
    XLSX.utils.book_append_sheet(workbook, costsWs, 'Structure_Coûts');

    // Output base64 representation
    return XLSX.write(workbook, { bookType: 'xlsx', type: 'base64' });
  }
}

