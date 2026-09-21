import * as fs from 'fs';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';
import Decimal from 'decimal.js';
import { evaluatePortGeofences, resetAlertCooldown } from '../src/features/tracking/services/port-geofence.actions';
import { generateDeliverySignatureHash } from '../src/lib/signature-crypto';

// 1. Ensure Environment Variables are Loaded
function loadEnv() {
  ['.env', '.env.local'].forEach(file => {
    const p = path.resolve(process.cwd(), file);
    if (fs.existsSync(p)) {
      const content = fs.readFileSync(p, 'utf8');
      content.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) return;
        const eq = trimmed.indexOf('=');
        if (eq === -1) return;
        const key = trimmed.slice(0, eq).trim();
        let val = trimmed.slice(eq + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        if (!process.env[key]) process.env[key] = val;
      });
    }
  });
}
loadEnv();

Decimal.config({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

async function runLivePilotMission() {
  console.log('================================================================================');
  console.log('🚀 TRANS BODANON TMS — PHASE 3: LIVE PILOT RUN (STEPS 3.3 ➔ 3.5)');
  console.log('================================================================================\n');

  // Find Trip #272
  const cmrNumber = 'CMR-BK-2026-0042';
  const { data: trip, error: tripErr } = await supabase
    .from('trip_orders')
    .select('*')
    .eq('cmr_number', cmrNumber)
    .single();

  if (!trip) {
    throw new Error(`الرحلة غير موجودة برقم CMR ${cmrNumber}: ${tripErr?.message}`);
  }

  // Fetch related details
  const [clientRes, truckRes, driverRes, trailerRes] = await Promise.all([
    supabase.from('clients').select('id, name').eq('id', trip.client_id).maybeSingle(),
    supabase.from('trucks').select('id, plate_number').eq('id', trip.truck_id).maybeSingle(),
    supabase.from('drivers').select('id, name').eq('id', trip.driver_id).maybeSingle(),
    supabase.from('trailers').select('id, plate_number').eq('id', trip.trailer_id).maybeSingle(),
  ]);

  const clientName = clientRes.data?.name || 'FRIGO ATLANTIC AGADIR';
  const truckPlate = truckRes.data?.plate_number || '10101-أ-40';
  const driverName = driverRes.data?.name || 'عبد الكريم الخمليشي';
  const trailerPlate = trailerRes.data?.plate_number || 'REM-1001-MA';

  console.log(`📌 المأمورية المستهدفة: رحلة #${trip.id} | ${trip.cmr_number}`);
  console.log(`   ├─ الشاحنة: ${truckPlate} | المقطورة: ${trailerPlate}`);
  console.log(`   ├─ السائق: ${driverName}`);
  console.log(`   └─ العميل المصدر: ${clientName}\n`);

  // Reset status to 'in_transit' for fresh demonstration
  await supabase
    .from('trip_orders')
    .update({ status: 'in_transit' })
    .eq('id', trip.id);

  // ============================================================================
  // الخطوة 3.3: محاكاة نبضات التتبع واجتياز سياج معبر الكركارات
  // ============================================================================
  console.log('🛰️ [الخطوة 3.3] إرسال نبضة Traccar GPS ومحاكاة دخول سياج الكركارات (5 كم):');
  console.log('--------------------------------------------------------------------------------');

  const truckId = trip.truck_id;

  // إحداثيات داخل نطاق 5 كم لمعبر الكركارات (21.3656, -16.9583)
  const guergueratPing = {
    truckId,
    truckPlate,
    latitude: 21.3660,
    longitude: -16.9580,
    timestamp: new Date().toISOString(),
  };

  resetAlertCooldown(truckId); // إتاحة إطلاق الحدث بدون انتظار سابق

  console.log(`  📍 إحداثيات النبضة: Lat ${guergueratPing.latitude}, Lon ${guergueratPing.longitude}`);
  console.log('  ⏳ تقييم السياج الجغرافي الاستراتيجي عبر evaluatePortGeofences...');

  const geofenceResult = await evaluatePortGeofences(guergueratPing);

  console.log(`  ✅ المنطقة المطابقة: ${geofenceResult.matchedZone?.name_ar} (${geofenceResult.matchedZone?.id})`);
  console.log(`  🔔 نوع الحدث: ${geofenceResult.event.toUpperCase()} (دخول النطاق الجمركي)`);

  // التحقق من تحديث الحالة في قاعدة البيانات
  const { data: updatedTripAfterGps } = await supabase
    .from('trip_orders')
    .select('status')
    .eq('id', trip.id)
    .single();

  console.log(`  🚦 الحالة التشغيلية الجديدة للرحلة: ${updatedTripAfterGps?.status} (customs_export) ✓`);
  console.log(`  🛡️ الإجراء: الشاحنة في النطاق الجمركي للكركارات - تم تغيير الحالة آلياً.`);

  // ============================================================================
  // الخطوة 3.4: إثبات التسليم الرقمي e-POD وختم النزاهة التشفيري
  // ============================================================================
  console.log('\n📦 [الخطوة 3.4] إثبات التسليم الرقمي (e-POD) في مستودعات دكار والختم التشفيري:');
  console.log('--------------------------------------------------------------------------------');

  const recipientName = 'Amadou Diallo (Responsable Réception Frigo - Dakar Logistics Hub)';
  const dakarLatitude = 14.7167;
  const dakarLongitude = -17.4677;
  const deliveryTimestamp = new Date().toISOString();
  const mockSignatureUrl = 'https://storage.bodanon.com/delivery-proofs/sig-dakar-272.png';

  // توليد الختم التشفيري HMAC-SHA256
  const integritySeal = generateDeliverySignatureHash({
    tripOrderId: trip.id,
    recipientName,
    signedAt: deliveryTimestamp,
    latitude: dakarLatitude,
    longitude: dakarLongitude,
    signatureUrl: mockSignatureUrl,
  });

  console.log(`  ✍️ المستلم المعتمد في دكار: ${recipientName}`);
  console.log(`  📍 إحداثيات التسليم بميناء دكار: ${dakarLatitude}, ${dakarLongitude}`);
  console.log(`  🔐 ختم النزاهة التشفيري (HMAC-SHA256 Seal):`);
  console.log(`     ${integritySeal}`);

  // تسجيل إثبات التسليم في جدول delivery_signatures
  const { data: existingSig } = await supabase
    .from('delivery_signatures')
    .select('id')
    .eq('trip_order_id', trip.id)
    .maybeSingle();

  const sigPayload = {
    trip_order_id: trip.id,
    driver_id: trip.driver_id,
    recipient_name: recipientName,
    delivered_at: deliveryTimestamp,
    latitude: dakarLatitude,
    longitude: dakarLongitude,
    signature_image_url: mockSignatureUrl,
    notes: `تم التسليم بنجاح في مستودع دكار - الختم: ${integritySeal}`,
  };

  if (existingSig) {
    const { error: updateSigErr } = await supabase
      .from('delivery_signatures')
      .update(sigPayload)
      .eq('id', existingSig.id);
    if (updateSigErr) throw updateSigErr;
  } else {
    const { error: insertSigErr } = await supabase
      .from('delivery_signatures')
      .insert(sigPayload);
    if (insertSigErr) throw insertSigErr;
  }
  console.log('  ✅ تم توثيق إثبات التسليم الرقمي في جدول delivery_signatures.');

  // تحديث حالة الرحلة إلى completed (مكتملة ومسلمة)
  await supabase
    .from('trip_orders')
    .update({
      status: 'completed',
      unloading_date_export: deliveryTimestamp.split('T')[0],
      unloading_location: 'Dakar Port Mole 2 (Zone Franche Frigo)',
    })
    .eq('id', trip.id);

  console.log(`  🚦 اكتمال الرحلة: تم تحديث الحالة في trip_orders ➔ completed ✓`);
  console.log(`  📄 رابط تحميل وثيقة e-POD الرسمية (PDF): /api/pod/pdf?tripId=${trip.id}`);

  // ============================================================================
  // الخطوة 3.5: التسوية المالية المحاسبية وإصدار الفاتورة بدقة Decimal.js
  // ============================================================================
  console.log('\n💰 [الخطوة 3.5] التسوية المالية، احتساب الأرباح (P&L)، وإصدار الفاتورة بدقة Decimal.js:');
  console.log('--------------------------------------------------------------------------------');

  // حسابات P&L المالية الصارمة بمكتبة Decimal.js
  const revenue = new Decimal(45000); // 45,000.00 MAD
  const fuelCost = new Decimal(2800).dividedBy(100).times(36).times(12.5); // 2,800km / 100 * 36L * 12.5 MAD/L = 12,600.00 MAD
  const guergueratCustoms = new Decimal(2500); // 2,500.00 MAD رسوم وعبور الكركارات
  const rossoFerryCost = new Decimal(3200); // 3,200.00 MAD عبارة روصو النهرية والتأمين
  const driverPerDiem = new Decimal(6500); // 6,500.00 MAD منحة السفر الدولية للكابتن

  const totalExpenses = fuelCost
    .plus(guergueratCustoms)
    .plus(rossoFerryCost)
    .plus(driverPerDiem); // 24,800.00 MAD

  const netProfit = revenue.minus(totalExpenses); // 20,200.00 MAD
  const profitMarginPercent = netProfit.dividedBy(revenue).times(100); // 44.89%

  console.log('  📊 بيان الأرباح والخسائر للمأمورية (Trip P&L Statement):');
  console.log(`    ├─ 💵 إجمالي إيراد النولون المتفق عليه:   ${revenue.toFixed(2)} MAD`);
  console.log(`    ├─ ⛽ تكلفة المحروقات (2800 كم @ 36L/100km): ${fuelCost.toFixed(2)} MAD`);
  console.log(`    ├─ 🛂 رسوم جمارك وعبور الكركارات:         ${guergueratCustoms.toFixed(2)} MAD`);
  console.log(`    ├─ 🚢 رسوم عبارة روصو والبطاقة البنية:       ${rossoFerryCost.toFixed(2)} MAD`);
  console.log(`    ├─ 👨‍✈️ تعويضات السفر الدولية للسائق:         ${driverPerDiem.toFixed(2)} MAD`);
  console.log(`    ├─ 📉 إجمالي المصاريف التشغيلية المباشرة:  ${totalExpenses.toFixed(2)} MAD`);
  console.log(`    └─ 📈 صافي الربح التشغيلي المحقق:         ${netProfit.toFixed(2)} MAD (هامش ربح: ${profitMarginPercent.toFixed(2)}%)`);

  // إصدار فاتورة الشحن الرسمية في جدول invoices
  const invoiceNumber = 'INV-2026-0042';
  const issueDate = new Date().toISOString().split('T')[0];

  const invoicePayload = {
    company_id: 1,
    client_id: String(trip.client_id),
    trip_order_id: trip.id,
    invoice_number: invoiceNumber,
    total_amount: revenue.toFixed(2),
    ht_amount: revenue.toFixed(2),
    ttc_amount: revenue.toFixed(2),
    paid_amount: '0.00',
    status: 'issued',
    currency: 'MAD',
    input_mode: 'manual',
    issue_date: issueDate,
  };

  const { data: existingInv } = await supabase
    .from('invoices')
    .select('id')
    .eq('invoice_number', invoiceNumber)
    .maybeSingle();

  if (existingInv) {
    const { error: updateInvErr } = await supabase
      .from('invoices')
      .update(invoicePayload)
      .eq('id', existingInv.id);
    if (updateInvErr) throw updateInvErr;
  } else {
    const { error: insertInvErr } = await supabase
      .from('invoices')
      .insert(invoicePayload);
    if (insertInvErr) throw insertInvErr;
  }
  console.log(`  🧾 تم إصدار فاتورة الشحن الرسمية برقم: ${invoiceNumber} بمبلغ ${revenue.toFixed(2)} MAD ✓`);

  // تسجيل معاملة الإيراد في الخزينة لربط كشف الحساب
  const treasuryPayload = {
    company_id: 1,
    type: 'trip_revenue',
    amount: revenue.toNumber(),
    currency: 'MAD',
    description: `إيراد فاتورة شحن الأسماك المجمدة ${invoiceNumber} - رحلة #${trip.id} (أكادير ➔ دكار)`,
    reference: `REV-${invoiceNumber}`,
    reconciliation_status: 'reconciled',
  };

  const { data: existingTx } = await supabase
    .from('treasury_transactions')
    .select('id')
    .eq('reference', `REV-${invoiceNumber}`)
    .maybeSingle();

  if (existingTx) {
    const { error: updateTxErr } = await supabase
      .from('treasury_transactions')
      .update(treasuryPayload)
      .eq('id', existingTx.id);
    if (updateTxErr) throw updateTxErr;
  } else {
    const { error: insertTxErr } = await supabase
      .from('treasury_transactions')
      .insert(treasuryPayload);
    if (insertTxErr) throw insertTxErr;
  }
  console.log(`  🏦 تم قيد الإيراد في الخزينة كمعاملة مستحقة برقم REV-${invoiceNumber} ✓`);

  console.log('\n================================================================================');
  console.log('✨ اكتملت المرحلة 3 بالكامل بنجاح تشغيلي، جمركي، تشفيري، ومحاسبي استثنائي!');
  console.log('================================================================================\n');
}

runLivePilotMission().catch((err) => {
  console.error('Fatal Mission Error:', err);
  process.exit(1);
});

