const fs = require('fs');
const path = require('path');
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

async function main() {
  const isReset = process.argv.includes('--reset');

  if (isReset) {
    console.log('Cleaning old test data for Trip 272...');
    await supabase.from('delivery_signatures').delete().eq('trip_order_id', 272);
    await supabase.from('invoices').delete().eq('trip_order_id', 272);
    await supabase.from('trip_orders').update({
      status: 'in_transit',
      driver_id: 57,
      cmr_export_url: null,
      cmr_import_url: null,
      updated_at: new Date().toISOString(),
    }).eq('id', 272);
    console.log('Trip 272 reset to clean "in_transit" status.');
  }

  const isDedup = process.argv.includes('--dedup');
  if (isDedup) {
    const { data: allSigs } = await supabase.from('delivery_signatures').select('id').eq('trip_order_id', 272).order('id', { ascending: false });
    if (allSigs && allSigs.length > 1) {
      const idsToDelete = allSigs.slice(1).map(s => s.id);
      await supabase.from('delivery_signatures').delete().in('id', idsToDelete);
      console.log('Deleted old duplicate signature IDs:', idsToDelete);
    }
  }

  const { data: trip } = await supabase.from('trip_orders').select('id, status, cmr_number, route, updated_at').eq('id', 272).single();
  const { data: sigs } = await supabase.from('delivery_signatures').select('*').eq('trip_order_id', 272);
  const { data: invoices } = await supabase.from('invoices').select('id, invoice_number, total_amount, tva_rate, status').eq('trip_order_id', 272);

  console.log('--- TRIP 272 CURRENT STATUS ---');
  console.log('Trip Status:', trip?.status, '| Last update:', trip?.updated_at);
  console.log('Signatures Count:', sigs?.length || 0);
  if (sigs && sigs.length > 0) {
    console.log('Latest Signature:', sigs[sigs.length - 1]);
  }
  console.log('Invoices for 272:', invoices);
}

main().catch(console.error);

