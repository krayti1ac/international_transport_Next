import * as fs from 'fs';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';
import Decimal from 'decimal.js';
import { buildCMRQrSummaryText, generateCMRQrCodeBase64, buildCMRVerificationUrl } from '../src/lib/cmr-qr';

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

async function main() {
  console.log('================================================================================');
  console.log('🚛 TRANS BODANON TMS — PHASE 3.2: LIVE DISPATCH & e-CMR ISSUANCE');
  console.log('================================================================================\n');

  // --- 1. Audit Target Entities ---
  console.log('🔍 [1/4] فحص الكيانات المخصصة للمأمورية الإفريقية:');
  console.log('--------------------------------------------------------------------------------');

  // A. العميل المصدر
  const { data: client, error: clientErr } = await supabase
    .from('clients')
    .select('id, name, ice, city, phone, currency')
    .eq('ice', '003194827000091')
    .maybeSingle();

  if (!client) throw new Error(`العميل المصدر غير موجود: ${clientErr?.message}`);
  console.log(`  🏢 العميل المصدر: ${client.name} | ICE: ${client.ice} | المدينة: ${client.city}`);

  // B. الشاحنة المعتمدة
  const { data: truck, error: truckErr } = await supabase
    .from('trucks')
    .select('id, plate_number, model, fuel_consumption_rate')
    .eq('plate_number', '10101-أ-40')
    .maybeSingle();

  if (!truck) throw new Error(`الشاحنة غير موجودة: ${truckErr?.message}`);
  console.log(`  🚛 رأس الشاحنة: ${truck.plate_number} (${truck.model}) | معدل الاستهلاك: ${truck.fuel_consumption_rate}%`);

  // C. مقطورة التبريد
  const { data: trailer, error: trailerErr } = await supabase
    .from('trailers')
    .select('id, plate_number, type, status')
    .eq('plate_number', 'REM-1001-MA')
    .maybeSingle();

  if (!trailer) throw new Error(`المقطورة غير موجودة: ${trailerErr?.message}`);
  console.log(`  ❄️ مقطورة التبريد: ${trailer.plate_number} (${trailer.type}) | الحالة: ${trailer.status}`);

  // D. السائق الدولي وتدقيق التأشيرة الإفريقية
  const { data: driver, error: driverErr } = await supabase
    .from('drivers')
    .select('id, name, phone, license, visa_number, has_valid_visa')
    .ilike('name', '%عبد الكريم الخمليشي%')
    .maybeSingle();

  if (!driver) throw new Error(`السائق غير موجود: ${driverErr?.message}`);
  
  // فحص التأشيرة الإفريقية الصارم
  const isAfrVisaValid = Boolean(driver.visa_number && (driver.visa_number.includes('AFR') || driver.visa_number.includes('9912')));
  if (!isAfrVisaValid) {
    throw new Error(`❌ انتهاك أمني: السائق ${driver.name} لا يمتلك تأشيرة إفريقية صالحة لممر السنغال.`);
  }
  console.log(`  👨‍✈️ كابتن الشحنة: ${driver.name} | رخصة: ${driver.license} | هاتف: ${driver.phone}`);
  console.log(`  🛂 فحص التأشيرة الإفريقية: معتمد بنجاح ✓ (${driver.visa_number})`);

  // --- 2. Create or Update Official Trip Order in trip_orders ---
  console.log('\n📋 [2/4] تسجيل واعتماد أمر النقل الرسمي في جدول trip_orders:');
  console.log('--------------------------------------------------------------------------------');

  const cmrNumber = 'CMR-BK-2026-0042';
  const freightPrice = new Decimal(45000); // 45,000.00 MAD
  const departureDate = new Date().toISOString().split('T')[0];
  const routeText = 'أكادير (أنزا / المغرب) ➔ دكار (مول 2 / السنغال)';

  // Check if trip already exists for this CMR
  const { data: existingTrip } = await supabase
    .from('trip_orders')
    .select('*')
    .eq('cmr_number', cmrNumber)
    .maybeSingle();

  let tripId: number;

  const tripPayload = {
    company_id: 1,
    client_id: client.id,
    driver_id: driver.id,
    truck_id: truck.id,
    trailer_id: trailer.id,
    route: routeText,
    route_export: routeText,
    price: freightPrice.toNumber(),
    agreed_price: freightPrice.toNumber(),
    price_export: freightPrice.toNumber(),
    currency: 'MAD',
    departure_date: departureDate,
    status: 'in_transit',
    cmr_number: cmrNumber,
    cmr_export_number: cmrNumber,
    shipping_location: 'Agadir (Anza)',
    unloading_location: 'Dakar (Mole 2)',
    weight_export: 22.0,
    goods_description_export: 'أسماك مجمدة (22.00 طن) - ضبط الحرارة: -19.0°C - مقطورة تبريد REM-1001-MA',
  };

  if (existingTrip) {
    console.log(`  ℹ️ تحديث الرحلة القائمة برقم ID: #${existingTrip.id}`);
    const { error: updateErr } = await supabase
      .from('trip_orders')
      .update(tripPayload)
      .eq('id', existingTrip.id);
    if (updateErr) throw updateErr;
    tripId = existingTrip.id;
  } else {
    console.log('  ⏳ إدراج أمر نقل جديد...');
    const { data: inserted, error: insertErr } = await supabase
      .from('trip_orders')
      .insert(tripPayload)
      .select('id')
      .single();
    if (insertErr) throw insertErr;
    tripId = inserted.id;
    console.log(`  ✅ تم إنشاء الرحلة برقم ID: #${tripId}`);
  }

  // --- 3. Generate e-CMR & Encrypted QR Code ---
  console.log('\n📱 [3/4] توليد وثيقة النقل الدولي الإلكترونية e-CMR ورمز QR المشفر:');
  console.log('--------------------------------------------------------------------------------');

  const trackingBaseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://transport.bodanon.com';
  const publicTrackingUrl = buildCMRVerificationUrl(tripId, trackingBaseUrl);

  const qrSummaryText = buildCMRQrSummaryText({
    trip: {
      id: tripId,
      cmr_number: cmrNumber,
      cmr_export_number: cmrNumber,
      route: routeText,
      route_export: routeText,
      departure_date: departureDate,
      status: 'in_transit',
    } as any,
    client: client as any,
    driver: driver as any,
    truck: truck as any,
    trailer: trailer as any,
    baseUrl: trackingBaseUrl,
  });

  const qrCodeBase64 = await generateCMRQrCodeBase64(qrSummaryText, { width: 260 });

  console.log(`  📄 كود وثيقة e-CMR: ${cmrNumber}`);
  console.log(`  🔗 رابط التتبع المباشر (Public Tracking URL): ${publicTrackingUrl}`);
  console.log(`  🔐 محتوى التشفير المرجعي المضمن بالـ QR:`);
  console.log(`     ${qrSummaryText}`);
  console.log(`  📸 توليد رمز الاستجابة السريعة (QR Code Base64): تم بنجاح ✓ (${qrCodeBase64.substring(0, 48)}...)`);

  // --- 4. Operations Room Dispatch Summary ---
  console.log('\n================================================================================');
  console.log('🚀 ملخص اعتماد المأمورية في غرفة العمليات (DISPATCH AUTHORIZED):');
  console.log('================================================================================');
  console.log(`  • رقم الرحلة الداخلي: #${tripId}`);
  console.log(`  • رقم وثيقة e-CMR: ${cmrNumber}`);
  console.log(`  • الحجز الأصلي: BK-2026-0042`);
  console.log(`  • العميل: ${client.name}`);
  console.log(`  • القاطرة: ${truck.plate_number} (${truck.model})`);
  console.log(`  • المقطورة: ${trailer.plate_number} (${trailer.type})`);
  console.log(`  • السائق المعتمد: ${driver.name} (تأشيرة إفريقية: ${driver.visa_number})`);
  console.log(`  • الحمولة: 22.00 طن أسماك مجمدة (-19.0°C)`);
  console.log(`  • المسار: ${routeText}`);
  console.log(`  • الحالة التشغيلية: in_transit (تحت التتبع المباشر GPS)`);
  console.log('================================================================================\n');
}

main().catch((err) => {
  console.error('Fatal Dispatch Error:', err);
  process.exit(1);
});

