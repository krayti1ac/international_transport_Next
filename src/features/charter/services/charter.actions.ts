'use server';

import { recordAuditLog } from '@/lib/audit.server';
import { sendWhatsAppCloudMessage } from '@/lib/whatsapp';
import { revalidatePath } from 'next/cache';
import type {
  SubcontractorCarrier,
  SubcontractorTruck,
  SubcontractorDriver,
  CharterOrder,
  CreateCharterOrderInput,
  ExternalEpodSubmissionInput,
  ExternalEpodResult,
  CharterOrderStatus,
} from '../types/charter.types';
import {
  calculateBrokerageMargin,
  verifyCarrierAndFleetCompliance,
} from './charter-compliance-margin.service';
import {
  generateEpodMagicToken,
  verifyEpodMagicToken,
  sealExternalEpodSubmission,
} from './charter-epod-token.service';

// Global In-Memory Store for Charter Exchange (Persists across hot reloads)
interface GlobalCharterStore {
  __TRANS_BODANON_CHARTER_CARRIERS__?: Map<string, SubcontractorCarrier>;
  __TRANS_BODANON_CHARTER_TRUCKS__?: Map<string, SubcontractorTruck>;
  __TRANS_BODANON_CHARTER_DRIVERS__?: Map<string, SubcontractorDriver>;
  __TRANS_BODANON_CHARTER_ORDERS__?: Map<string, CharterOrder>;
}

const gStore = globalThis as unknown as GlobalCharterStore;
if (!gStore.__TRANS_BODANON_CHARTER_CARRIERS__) {
  gStore.__TRANS_BODANON_CHARTER_CARRIERS__ = new Map();
}
if (!gStore.__TRANS_BODANON_CHARTER_TRUCKS__) {
  gStore.__TRANS_BODANON_CHARTER_TRUCKS__ = new Map();
}
if (!gStore.__TRANS_BODANON_CHARTER_DRIVERS__) {
  gStore.__TRANS_BODANON_CHARTER_DRIVERS__ = new Map();
}
if (!gStore.__TRANS_BODANON_CHARTER_ORDERS__) {
  gStore.__TRANS_BODANON_CHARTER_ORDERS__ = new Map();
}

const carriersMap = gStore.__TRANS_BODANON_CHARTER_CARRIERS__;
const trucksMap = gStore.__TRANS_BODANON_CHARTER_TRUCKS__;
const driversMap = gStore.__TRANS_BODANON_CHARTER_DRIVERS__;
const ordersMap = gStore.__TRANS_BODANON_CHARTER_ORDERS__;

function ensureSeededCharterData() {
  if (carriersMap.size > 0) return;

  // 1. Seed Subcontractor Carriers
  const initialCarriers: SubcontractorCarrier[] = [
    {
      id: 'CAR-101',
      companyName: 'TRANS ATLAS SUD SARL',
      ice: '001827364000031',
      identifiantFiscal: '34891022',
      registreCommerce: '18942 Agadir',
      cnss: '4829104',
      phone: '+212 528 84 10 20',
      email: 'contact@transatlassud.ma',
      contactPerson: 'عمر التازي (مدير الأسطول)',
      address: 'Zone Industrielle Anza, Agadir',
      city: 'Agadir',
      country: 'MA',
      rating: 4.8,
      cmrInsurancePolicyNumber: 'WAFA-CMR-994821',
      cmrInsuranceExpiryDate: '2027-04-15',
      internationalTransportLicenseNumber: 'MT-LTI-2024-0412',
      internationalTransportLicenseExpiryDate: '2027-08-30',
      paymentTermsDays: 30,
      isBlacklisted: false,
      complianceStatus: 'compliant',
      activeTrucksCount: 14,
      createdAt: '2026-01-10',
    },
    {
      id: 'CAR-102',
      companyName: 'LOGISTICA IBERICA MAROC',
      ice: '002938475000088',
      identifiantFiscal: '45102938',
      registreCommerce: '22841 Tanger',
      cnss: '5920194',
      phone: '+212 539 94 88 55',
      email: 'operations@logistica-iberica.com',
      contactPerson: 'Carlos Martinez / سفيان العلمي',
      address: 'Zone Franche de Tanger, Lot 18',
      city: 'Tanger',
      country: 'MA',
      rating: 4.6,
      cmrInsurancePolicyNumber: 'AXA-MAR-840291',
      cmrInsuranceExpiryDate: '2027-01-20',
      internationalTransportLicenseNumber: 'MT-LTI-2024-0891',
      internationalTransportLicenseExpiryDate: '2027-05-10',
      paymentTermsDays: 45,
      isBlacklisted: false,
      complianceStatus: 'compliant',
      activeTrucksCount: 9,
      createdAt: '2026-02-15',
    },
    {
      id: 'CAR-103',
      companyName: 'SAHARA TRANS EXPRESS',
      ice: '003192847000099',
      identifiantFiscal: '58201948',
      registreCommerce: '9482 Laayoune',
      cnss: '3940192',
      phone: '+212 528 99 44 22',
      email: 'transit@saharatrans.ma',
      contactPerson: 'البشير أهل أحمد',
      address: 'Boulevard Smara, Laâyoune',
      city: 'Laayoune',
      country: 'MA',
      rating: 4.2,
      cmrInsurancePolicyNumber: 'SANLAM-CMR-449102',
      cmrInsuranceExpiryDate: '2026-10-22', // Expiring soon in ~14 days (warning)
      internationalTransportLicenseNumber: 'MT-LTI-2023-0199',
      internationalTransportLicenseExpiryDate: '2026-11-05',
      paymentTermsDays: 15,
      isBlacklisted: false,
      complianceStatus: 'warning',
      activeTrucksCount: 16,
      createdAt: '2026-03-01',
    },
  ];

  for (const c of initialCarriers) {
    carriersMap.set(String(c.id), c);
  }

  // 2. Seed Trucks
  const initialTrucks: SubcontractorTruck[] = [
    {
      id: 'TRK-201',
      carrierId: 'CAR-101',
      carrierName: 'TRANS ATLAS SUD SARL',
      plateNumber: '48201-A-33',
      truckType: 'refrigerated',
      maxPayloadTons: 24,
      hasReeferUnit: true,
      carteGriseExpiryDate: '2027-06-30',
      technicalInspectionExpiryDate: '2027-03-15',
      atpCertificateExpiryDate: '2027-09-01',
      isAvailable: true,
      complianceStatus: 'compliant',
    },
    {
      id: 'TRK-202',
      carrierId: 'CAR-102',
      carrierName: 'LOGISTICA IBERICA MAROC',
      plateNumber: '91842-B-40',
      truckType: 'tautliner',
      maxPayloadTons: 25,
      hasReeferUnit: false,
      carteGriseExpiryDate: '2027-05-15',
      technicalInspectionExpiryDate: '2027-04-10',
      isAvailable: true,
      complianceStatus: 'compliant',
    },
  ];

  for (const t of initialTrucks) {
    trucksMap.set(String(t.id), t);
  }

  // 3. Seed Drivers
  const initialDrivers: SubcontractorDriver[] = [
    {
      id: 'DRV-301',
      carrierId: 'CAR-101',
      name: 'عبد الرحيم المنصوري',
      phone: '+212 661 44 99 22',
      cinNationalId: 'JC482910',
      licenseNumber: 'PERMIS-EC-94812',
      licenseExpiryDate: '2028-09-10',
      passportNumber: 'MA-994821',
      passportExpiryDate: '2029-02-14',
      schengenVisaExpiryDate: '2027-07-20',
      complianceStatus: 'compliant',
    },
    {
      id: 'DRV-302',
      carrierId: 'CAR-102',
      name: 'هشام بلمختار',
      phone: '+212 662 11 88 44',
      cinNationalId: 'KB391024',
      licenseNumber: 'PERMIS-EC-88192',
      licenseExpiryDate: '2028-11-20',
      passportNumber: 'MA-884102',
      passportExpiryDate: '2028-12-01',
      schengenVisaExpiryDate: '2027-04-10',
      complianceStatus: 'compliant',
    },
  ];

  for (const d of initialDrivers) {
    driversMap.set(String(d.id), d);
  }

  // 4. Seed Initial Orders
  const carrier1 = initialCarriers[0];
  const truck1 = initialTrucks[0];
  const driver1 = initialDrivers[0];

  const margin1 = calculateBrokerageMargin('42000.00', '34500.00', 'MAD', 0);
  const tokenGen1 = generateEpodMagicToken({
    orderNumber: 'CHT-2026-0089',
    carrierId: carrier1.id,
    driverPhone: driver1.phone,
  });

  const order1: CharterOrder = {
    id: 'ORD-001',
    orderNumber: 'CHT-2026-0089',
    originCity: 'Agadir',
    destinationCity: 'Perpignan',
    corridor: 'european_maritime',
    loadingDate: '2026-10-24',
    deliveryDate: '2026-10-28',
    cargoDescription: 'طماطم كرزية وخضروات مبردة (Tomates Cerises)',
    cargoWeightKg: 22400,
    carrier: carrier1,
    truck: truck1,
    driver: driver1,
    margin: margin1,
    status: 'IN_TRANSIT',
    cmrNumber: 'CMR-CHT-2026-0089',
    epodMagicToken: tokenGen1.token,
    epodMagicLink: tokenGen1.magicLinkUrl,
    epodExpiresAt: tokenGen1.expiresAtIso,
    createdAt: '2026-10-23T08:00:00Z',
    updatedAt: '2026-10-23T08:00:00Z',
  };

  const margin2 = calculateBrokerageMargin('28000.00', '23000.00', 'MAD', 0);
  const order2: CharterOrder = {
    id: 'ORD-002',
    orderNumber: 'CHT-2026-0088',
    originCity: 'Tanger Med',
    destinationCity: 'Valencia',
    corridor: 'european_maritime',
    loadingDate: '2026-10-20',
    deliveryDate: '2026-10-22',
    cargoDescription: 'فواكه حمراء مبردة (Fruits Rouges)',
    cargoWeightKg: 19800,
    carrier: initialCarriers[1],
    truck: initialTrucks[1],
    driver: initialDrivers[1],
    margin: margin2,
    status: 'DELIVERED',
    cmrNumber: 'CMR-CHT-2026-0088',
    epodSubmittedAt: '2026-10-22T14:30:00Z',
    epodReceiverName: 'JUAN ALVAREZ (FRUTAS MEDITERRANEO)',
    epodDeliveryLatitude: 39.4699,
    epodDeliveryLongitude: -0.3763,
    epodNotes: 'Livraison effectuée avec succès sans dommage.',
    epodHmacSeal: '7f9a1b8c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a',
    createdAt: '2026-10-19T10:00:00Z',
    updatedAt: '2026-10-22T14:30:00Z',
  };

  ordersMap.set(order1.orderNumber, order1);
  ordersMap.set(order2.orderNumber, order2);
}

/**
 * Lists all subcontractor carriers with their real-time compliance status
 */
export async function listSubcontractorsAction(): Promise<{
  success: boolean;
  carriers: SubcontractorCarrier[];
  trucks: SubcontractorTruck[];
  drivers: SubcontractorDriver[];
}> {
  ensureSeededCharterData();
  const carriers = Array.from(carriersMap.values());
  const trucks = Array.from(trucksMap.values());
  const drivers = Array.from(driversMap.values());
  return { success: true, carriers, trucks, drivers };
}

/**
 * Lists all charter orders with optional status filtering
 */
export async function listCharterOrdersAction(
  statusFilter?: CharterOrderStatus
): Promise<{
  success: boolean;
  orders: CharterOrder[];
}> {
  ensureSeededCharterData();
  let orders = Array.from(ordersMap.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  if (statusFilter) {
    orders = orders.filter((o) => o.status === statusFilter);
  }

  return { success: true, orders };
}

/**
 * Issues a new Charter Order with negative margin protection and compliance verification
 */
export async function createCharterOrderAction(
  input: CreateCharterOrderInput
): Promise<{
  success: boolean;
  order?: CharterOrder;
  error?: string;
  blockingComplianceIssues?: string[];
}> {
  try {
    ensureSeededCharterData();

    // 1. Fetch Carrier, Truck, Driver
    const carrier = carriersMap.get(String(input.carrierId));
    if (!carrier) {
      return { success: false, error: 'الناقل من الباطن غير موجود' };
    }

    const truck = trucksMap.get(String(input.truckId)) || null;
    const driver = driversMap.get(String(input.driverId)) || null;

    // 2. Perform Multi-Point Legal Compliance Audit
    const compliance = verifyCarrierAndFleetCompliance({
      carrier,
      truck,
      driver,
      corridor: input.corridor,
    });

    if (!compliance.isFullyCompliant && compliance.status === 'expired') {
      return {
        success: false,
        error: 'تم حظر إنشاء أمر النقل: وثائق الناقل أو الشاحنة منتهية الصلاحية',
        blockingComplianceIssues: compliance.blockingIssues,
      };
    }

    // 3. Calculate Brokerage Margin via Decimal.js
    const margin = calculateBrokerageMargin(
      input.shipperAgreedRate,
      input.subcontractorBuyRate,
      input.currency,
      input.extraReinvoicedExpenses || 0
    );

    // Negative Margin Guard
    if (margin.negativeMarginAlert) {
      return {
        success: false,
        error: `حظر مالي (Negative Margin Guard): سعر الشراء (${margin.subcontractorBuyRate} ${margin.currency}) يتجاوز سعر البيع المتفق عليه مع العميل (${margin.shipperAgreedRate} ${margin.currency})!`,
      };
    }

    // 4. Generate Order Identifier & e-POD Magic Link
    const orderNumber = `CHT-2026-${String(ordersMap.size + 90).padStart(4, '0')}`;
    const tokenGen = generateEpodMagicToken({
      orderNumber,
      carrierId: carrier.id,
      driverPhone: driver?.phone || carrier.phone,
    });

    const newOrder: CharterOrder = {
      id: `ORD-${Date.now()}`,
      orderNumber,
      tripOrderId: input.tripOrderId,
      originCity: input.originCity,
      destinationCity: input.destinationCity,
      corridor: input.corridor,
      loadingDate: input.loadingDate,
      deliveryDate: input.deliveryDate,
      cargoDescription: input.cargoDescription,
      cargoWeightKg: input.cargoWeightKg,
      carrier,
      truck: truck || {
        id: 'TRK-GEN',
        carrierId: carrier.id,
        carrierName: carrier.companyName,
        plateNumber: 'EXTERNE-TMP',
        truckType: 'refrigerated',
        maxPayloadTons: 24,
        hasReeferUnit: true,
        carteGriseExpiryDate: '2027-12-31',
        technicalInspectionExpiryDate: '2027-12-31',
        isAvailable: true,
        complianceStatus: 'compliant',
      },
      driver: driver || {
        id: 'DRV-GEN',
        carrierId: carrier.id,
        name: carrier.contactPerson || 'سائق خارجي',
        phone: carrier.phone,
        cinNationalId: 'CIN-EXT',
        licenseNumber: 'LIC-EXT',
        licenseExpiryDate: '2028-12-31',
        complianceStatus: 'compliant',
      },
      margin,
      status: 'ASSIGNED',
      cmrNumber: input.cmrNumber || `CMR-${orderNumber}`,
      epodMagicToken: tokenGen.token,
      epodMagicLink: tokenGen.magicLinkUrl,
      epodExpiresAt: tokenGen.expiresAtIso,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    ordersMap.set(orderNumber, newOrder);

    // 5. Audit Trail
    await recordAuditLog({
      actionType: 'create',
      entityType: 'charter_order',
      entityId: orderNumber,
      reason: 'charter_order_assigned',
      newData: {
        orderNumber,
        carrierName: carrier.companyName,
        shipperRate: margin.shipperAgreedRate,
        buyRate: margin.subcontractorBuyRate,
        marginAmount: margin.grossBrokerageMargin,
        marginPercent: margin.brokerageMarginPercent,
        corridor: input.corridor,
      },
    });

    // 6. WhatsApp Dispatch to Subcontractor Driver
    const targetPhone = driver?.phone || carrier.phone;
    if (targetPhone) {
      const waMsg = `🚚 *أمر نقل واستئجار دولي جديد | Trans Bodanon TMS*
----------------------------------------
📋 *رقم الأمر:* ${orderNumber}
🏢 *الناقل المستأجر:* ${carrier.companyName}
🛣️ *المسار:* ${input.originCity} ➔ ${input.destinationCity}
📦 *الشحنة:* ${input.cargoDescription} (${input.cargoWeightKg} كغ)
📅 *تاريخ التحميل:* ${input.loadingDate}
📑 *بوليصة الـ CMR:* ${newOrder.cmrNumber}

📲 *رابط إثبات التسليم الرقمي الخارجي (e-POD Link):*
${tokenGen.magicLinkUrl}
_(الرابط آمن وصالح لمدة 72 ساعة لتوقيع المستلم مباشرة)_

----------------------------------------
_Société Trans Bodanon SARL • Tour de Contrôle Logistique_`;

      await sendWhatsAppCloudMessage({
        to: targetPhone,
        message: waMsg,
        auditEntity: {
          type: 'charter_order',
          id: orderNumber,
        },
      });
    }

    revalidatePath('/charter');

    return {
      success: true,
      order: newOrder,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'فشل إصدار أمر النقل بالباطن';
    return { success: false, error: message };
  }
}

/**
 * Updates status of a charter order
 */
export async function updateCharterOrderStatusAction(
  orderNumber: string,
  newStatus: CharterOrderStatus
): Promise<{ success: boolean; error?: string }> {
  ensureSeededCharterData();
  const order = ordersMap.get(orderNumber);
  if (!order) {
    return { success: false, error: 'أمر النقل غير موجود' };
  }

  order.status = newStatus;
  order.updatedAt = new Date().toISOString();
  ordersMap.set(orderNumber, order);

  await recordAuditLog({
    actionType: 'update',
    entityType: 'charter_order',
    entityId: orderNumber,
    reason: `status_changed_to_${newStatus}`,
    newData: { orderNumber, status: newStatus },
  });

  revalidatePath('/charter');
  return { success: true };
}

/**
 * Verifies external driver's magic token for guest e-POD submission
 */
export async function verifyEpodTokenAction(token: string): Promise<{
  isValid: boolean;
  order?: CharterOrder;
  error?: string;
}> {
  ensureSeededCharterData();
  const res = verifyEpodMagicToken(token);
  if (!res.isValid || !res.payload) {
    return { isValid: false, error: res.error || 'رمز الدخول غير صالح' };
  }

  const order = ordersMap.get(res.payload.orderNumber);
  if (!order) {
    return { isValid: false, error: 'أمر النقل المرتبط بالرمز غير موجود' };
  }

  return { isValid: true, order };
}

/**
 * Handles external driver guest e-POD submission without requiring login
 */
export async function submitExternalEpodAction(
  input: ExternalEpodSubmissionInput
): Promise<ExternalEpodResult> {
  try {
    ensureSeededCharterData();

    // 1. Verify token
    const tokenRes = verifyEpodMagicToken(input.token);
    if (!tokenRes.isValid || !tokenRes.payload) {
      return { success: false, error: tokenRes.error || 'رمز الدخول غير صالح أو منتهي الصلاحية' };
    }

    const orderNumber = tokenRes.payload.orderNumber;
    const order = ordersMap.get(orderNumber);
    if (!order) {
      return { success: false, error: 'أمر النقل غير موجود' };
    }

    if (order.status === 'DELIVERED' || order.status === 'SETTLED') {
      return {
        success: true,
        orderNumber,
        hmacSeal: order.epodHmacSeal,
        submittedAt: order.epodSubmittedAt,
      };
    }

    // 2. Cryptographic Forensic Seal
    const seal = sealExternalEpodSubmission(input);

    // 3. Update Order
    order.status = 'DELIVERED';
    order.epodReceiverName = input.receiverName.trim();
    order.epodReceiverSignatureUrl = input.signatureBase64;
    order.epodDeliveryLatitude = input.latitude;
    order.epodDeliveryLongitude = input.longitude;
    order.epodNotes = input.notes;
    order.epodSubmittedAt = seal.timestamp;
    order.epodHmacSeal = seal.hmacSeal;
    order.updatedAt = seal.timestamp;

    ordersMap.set(orderNumber, order);

    // 4. Audit Log
    await recordAuditLog({
      actionType: 'security_alert',
      entityType: 'charter_order',
      entityId: orderNumber,
      reason: 'external_epod_sealed',
      newData: {
        orderNumber,
        receiverName: input.receiverName,
        hmacSeal: seal.hmacSeal,
        timestamp: seal.timestamp,
        hasSignature: Boolean(input.signatureBase64),
      },
    });

    revalidatePath('/charter');

    return {
      success: true,
      orderNumber,
      hmacSeal: seal.hmacSeal,
      submittedAt: seal.timestamp,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'فشل تسجيل إثبات التسليم الخارجي';
    return { success: false, error: message };
  }
}

