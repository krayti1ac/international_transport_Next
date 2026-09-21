import { createClient } from '@supabase/supabase-js';

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  console.log('--- Inspecting clients and treasury_transactions ---');

  const { data: clients, error: cErr } = await supabase.from('clients').select('*').limit(1);
  if (cErr) console.error('clients error:', cErr.message);
  else if (clients && clients.length > 0) console.log('clients columns:', Object.keys(clients[0]));

  const { data: tt, error: ttErr } = await supabase.from('treasury_transactions').select('*').limit(1);
  if (ttErr) console.error('treasury_transactions error:', ttErr.message);
  else if (tt && tt.length > 0) console.log('treasury_transactions columns:', Object.keys(tt[0]));

  const { data: cb } = await supabase.from('cash_boxes').select('id, name, currency');
  console.log('cash_boxes:', cb);

  const { data: ba } = await supabase.from('bank_accounts').select('id, name, currency');
  console.log('bank_accounts:', ba);
}

main().catch(console.error);

