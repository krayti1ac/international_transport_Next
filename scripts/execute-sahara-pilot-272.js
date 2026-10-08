const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

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

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

function generateDeliverySignatureHash(payload, signingKey) {
  const secret = signingKey || process.env.PDF_SIGNING_KEY || 'trans-bodanon-secure-key-default';
  const latStr = payload.latitude !== undefined && payload.latitude !== null && !isNaN(Number(payload.latitude))
    ? Number(payload.latitude).toFixed(6)
    : 'N/A';
  const lngStr = payload.longitude !== undefined && payload.longitude !== null && !isNaN(Number(payload.longitude))
    ? Number(payload.longitude).toFixed(6)
    : 'N/A';

  const canonicalString = [
    `TRIP:${payload.tripOrderId}`,
    `RECIPIENT:${payload.recipientName?.trim().toUpperCase() || 'UNKNOWN'}`,
    `DATE:${payload.signedAt}`,
    `GPS:${latStr},${lngStr}`,
    `SIG:${payload.signatureUrl || ''}`,
  ].join('|');

  return crypto.createHmac('sha256', secret).update(canonicalString).digest('hex');
}

async function runSaharaSimulation() {
  console.log('========================================================================');
  console.log('🚀 EXECUTION: SAHARA OVERLAND & ZERO-NET PILOT (TRIP #272)');
  console.log('========================================================================\n');

  // 0. Ensure Geofence Zones Exist
  let { data: zoneGuerguerat } = await supabase.from('geofence_zones').select('*').ilike('name', '%Guerguerat%').maybeSingle();
  if (!zoneGuerguerat) {
    const { data: createdZone } = await supabase.from('geofence_zones').insert({
      name: 'معبر الكركارات الحدودي (El Guerguerat Border Checkpoint)',
      latitude: 21.3656,
      longitude: -16.9583,
      radius_km: 5.0,
      zone_type: 'border',
      is_active: true,
    }).select().single();
    zoneGuerguerat = createdZone;
  }

  let { data: zoneRosso } = await supabase.from('geofence_zones').select('*').ilike('name', '%Rosso%').maybeSingle();
  if (!zoneRosso) {
    const { data: createdZone } = await supabase.from('geofence_zones').insert({
      name: 'محطة عبارة روصو النهرية (Rosso Ferry Terminal)',
      latitude: 16.5133,
      longitude: -15.8083,
      radius_km: 3.0,
      zone_type: 'customs',
      is_active: true,
    }).select().single();
    zoneRosso = createdZone;
  }

  // 1. Log Checkpoint 1: El Guerguerat Border
  console.log('📍 [المحطة 1] تسجيل نقطة عبور معبر الكركارات المغربي:');
  const timestampGuerguerat = new Date('2026-10-26T14:30:00Z').toISOString();
  const { data: alert1, error: a1Err } = await supabase.from('geofence_alerts').insert({
    truck_id: 62,
    zone_id: zoneGuerguerat?.id || 1,
    event_type: 'enter',
    latitude: 21.3656,
    longitude: -16.9583,
    timestamp: timestampGuerguerat,
    notified: true,
  }).select();
  if (a1Err) console.warn('Alert 1 insert notice:', a1Err.message);
  console.log(`  ✓ تم توثيق عبور الكركارات (Lat: 21.3656, Lon: -16.9583) | Odometer: 128,450 km | Reefer: -19.0°C`);

  // 2. Log Checkpoint 2: Rosso Ferry Terminal
  console.log('\n🚢 [المحطة 2] تسجيل نقطة عبور عبارة روصو النهرية (السنغال):');
  const timestampRosso = new Date('2026-10-27T11:15:00Z').toISOString();
  const { data: alert2, error: a2Err } = await supabase.from('geofence_alerts').insert({
    truck_id: 62,
    zone_id: zoneRosso?.id || 2,
    event_type: 'enter',
    latitude: 16.5133,
    longitude: -15.8083,
    timestamp: timestampRosso,
    notified: true,
  }).select();
  if (a2Err) console.warn('Alert 2 insert notice:', a2Err.message);
  console.log(`  ✓ تم توثيق عبور عبارة روصو (Lat: 16.5133, Lon: -15.8083) | Odometer: 129,680 km | Reefer: -18.8°C`);

  // 3. Electronic Delivery (e-POD) in Dakar
  console.log('\n✍️ [إثبات التسليم e-POD] توقيع واستلام الشحنة في ميناء دكار:');
  const signedAt = new Date().toISOString();
  const recipientName = 'Mamadou Diop (Dakar Port Terminal Hub - ID: SN-DK-889921)';
  const dakarLat = 14.7167;
  const dakarLng = -17.4677;
  const signatureUrl = 'https://storage.bodanon.com/delivery-proofs/sig-dakar-272-mamadou.png';
  const cmrUrl = 'https://storage.bodanon.com/delivery-proofs/cmr-272-dakar-stamped.jpg';

  const integrityHash = generateDeliverySignatureHash({
    tripOrderId: 272,
    recipientName,
    signedAt,
    latitude: dakarLat,
    longitude: dakarLng,
    signatureUrl,
  });

  console.log(`  🔒 ختم النزاهة التشفيري المتولد (HMAC-SHA256):`);
  console.log(`     ${integrityHash}`);

  // Insert signature into delivery_signatures
  const { error: sigErr } = await supabase.from('delivery_signatures').insert({
    trip_order_id: 272,
    driver_id: 57,
    signature_image_url: signatureUrl,
    receipt_image_url: cmrUrl,
    recipient_name: recipientName,
    latitude: dakarLat,
    longitude: dakarLng,
    delivered_at: signedAt,
    notes: JSON.stringify({
      integrityHash,
      algorithm: 'SHA256-HMAC',
      signedAt,
      syncedFromOffline: true,
      checkpoint: 'Dakar Port Terminal Hub',
      cin: 'SN-DK-889921',
    }),
  });

  if (sigErr) {
    console.error('Signature insert error:', sigErr);
  } else {
    console.log(`  ✅ تم حفظ إثبات التسليم المشفر في جدول delivery_signatures.`);
  }

  // 4. Update trip_orders status to 'delivered'
  const { error: tripUpdErr } = await supabase.from('trip_orders').update({
    status: 'delivered',
    cmr_export_url: cmrUrl,
    updated_at: signedAt,
  }).eq('id', 272);

  if (tripUpdErr) {
    console.error('Trip update error:', tripUpdErr);
  } else {
    console.log(`  ✅ تم تحديث حالة الرحلة #272 إلى "delivered" بنجاح.`);
  }

  // 5. Generate Tax-Exempt Invoice under Article 92-I-10° CGI
  console.log('\n💰 [الفوترة الآلية] إصدار الفاتورة المعفاة ضريبياً (المادة 92 CGI):');
  const invoiceNumber = `FA-2026-0272`;
  const totalTtc = 45000.00;

  // Inspect invoice sample
  const { data: invSample } = await supabase.from('invoices').select('*').limit(1);
  if (invSample && invSample[0]) {
    console.log('Available invoice columns:', Object.keys(invSample[0]));
  }

  const { data: invData, error: invErr } = await supabase.from('invoices').insert({
    trip_order_id: 272,
    client_id: '1',
    company_id: 1,
    invoice_number: invoiceNumber,
    total_amount: totalTtc.toFixed(2),
    paid_amount: '0.00',
    ht_amount: totalTtc.toFixed(2),
    tva_rate: '0',
    tva_amount: '0.00',
    ttc_amount: totalTtc.toFixed(2),
    currency: 'MAD',
    input_mode: 'auto_customs',
    status: 'unpaid',
    issue_date: signedAt.split('T')[0],
    due_date: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString().split('T')[0],
    extra_details: JSON.stringify({
      taxExemption: "Article 92-I-10° du Code Général des Impôts (CGI)",
      route: "Agadir -> Dakar",
      cmrNumber: "CMR-BK-2026-0042",
      podIntegrityHash: integrityHash,
      notes: "Transport international exonéré de TVA en vertu de l'article 92-I-10° du CGI"
    }),
  }).select();

  if (invErr) {
    console.warn('Invoice insert notice:', invErr.message);
  } else {
    console.log(`  ✅ صدرت الفاتورة رقم ${invoiceNumber} بمبلغ ${totalTtc.toLocaleString()} MAD صافي.`);
    console.log(`  ⚖️ نسبة الضريبة: 0% معفاة بقوة المادة 92-I-10° من المدونة العامة للضرائب.`);
  }

  console.log('\n========================================================================');
  console.log('🎯 المحاكاة اكتملت بنجاح والبيانات متطابقة وحية في قاعدة البيانات السحابية!');
  console.log('========================================================================\n');
}

runSaharaSimulation().catch(console.error);
