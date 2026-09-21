import { createClient } from '@supabase/supabase-js';

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  const { data: trucks, error: tErr } = await supabase.from('trucks').select('id, plate_number, model, fuel_consumption_rate, status');
  console.log('Trucks count in DB:', trucks?.length, 'error:', tErr?.message);
  if (trucks) console.log('Trucks in DB:', trucks);

  const { data: trailers, error: trErr } = await supabase.from('trailers').select('id, plate_number, type, status');
  console.log('Trailers count in DB:', trailers?.length, 'error:', trErr?.message);
  if (trailers) console.log('Trailers in DB:', trailers);
}

main().catch(console.error);

