import { createClient } from '../src/lib/supabase/server';

async function main() {
  const supabase = await createClient();

  console.log('--- Inspecting DB Tables ---');

  const { data: trucksData, error: trucksError } = await supabase.from('trucks').select('*').limit(1);
  if (trucksError) console.error('trucks error:', trucksError.message);
  else if (trucksData && trucksData.length > 0) console.log('trucks columns:', Object.keys(trucksData[0]));
  else {
    // If table is empty, try an insert of dummy to see column error or select single
    console.log('trucks table is empty');
  }

  const { data: trailersData, error: trailersError } = await supabase.from('trailers').select('*').limit(1);
  if (trailersError) console.error('trailers error:', trailersError.message);
  else if (trailersData && trailersData.length > 0) console.log('trailers columns:', Object.keys(trailersData[0]));
  else console.log('trailers table is empty');

  const { data: driversData, error: driversError } = await supabase.from('drivers').select('*').limit(1);
  if (driversError) console.error('drivers error:', driversError.message);
  else if (driversData && driversData.length > 0) console.log('drivers columns:', Object.keys(driversData[0]));
  else console.log('drivers table is empty');
}

main().catch(console.error);

