import { importTrucksAction, importTrailersAction } from '../src/lib/bulk-import.actions';
import { sanitizeMoroccanPlate } from '../src/lib/data-sanitizer';
import { createClient } from '../src/lib/supabase/server';

const TRUCKS_DATA = [
  { plate_number: '10101 / أ / 40', model: 'Volvo FH 500 Globetrotter', status: 'active', weight_capacity: 25, fuel_consumption_rate: 36 },
  { plate_number: '10102 | أ | 40', model: 'Volvo FH 500 I-Save', status: 'active', weight_capacity: 25, fuel_consumption_rate: 34.5 },
  { plate_number: '10201-ب-40', model: 'Scania R 500 V8 Streamline', status: 'active', weight_capacity: 25, fuel_consumption_rate: 36 },
  { plate_number: '10202 ب 40', model: 'Scania R 450 Highline', status: 'active', weight_capacity: 25, fuel_consumption_rate: 35 },
  { plate_number: '20301/د/26', model: 'Mercedes Actros 1848 GigaSpace', status: 'active', weight_capacity: 25, fuel_consumption_rate: 36 },
  { plate_number: '20302 | د | 26', model: 'Mercedes Actros 1851 Edition', status: 'active', weight_capacity: 25, fuel_consumption_rate: 36 },
  { plate_number: '30401-أ-40', model: 'Renault Trucks T-High 480', status: 'active', weight_capacity: 25, fuel_consumption_rate: 35.5 },
  { plate_number: '30402 أ 40', model: 'Renault Trucks T 460 Optifuel', status: 'active', weight_capacity: 25, fuel_consumption_rate: 34 },
  { plate_number: '40501-هـ-40', model: 'MAN TGX 18.510 EfficientLine 3', status: 'active', weight_capacity: 25, fuel_consumption_rate: 36 },
  { plate_number: '40502-هـ-40', model: 'DAF XF 480 Super Space Cab', status: 'active', weight_capacity: 25, fuel_consumption_rate: 35.5 },
];

const TRAILERS_DATA = [
  { plate_number: 'REM 1001 MA', model: 'Schmitz Cargobull S.KO COOL Frigo', status: 'active' },
  { plate_number: 'REM/1002/MA', model: 'Schmitz Cargobull S.KO COOL Carrier', status: 'active' },
  { plate_number: 'REM 1003 MA', model: 'Krone Cool Liner Duplex Advancer', status: 'active' },
  { plate_number: 'REM-1004-MA', model: 'Krone Cool Liner Carrier Vector', status: 'active' },
  { plate_number: 'REM 1005 MA', model: 'Lamberet SR2 Futura Frigo', status: 'active' },
  { plate_number: 'REM-1006-MA', model: 'Lamberet Heavy Duty Frigo', status: 'active' },
  { plate_number: 'REM 1007 MA', model: 'Chereau Inogam Multi-Temp', status: 'active' },
  { plate_number: 'REM-1008-MA', model: 'Chereau Inogam Heavy Frigo', status: 'active' },
  { plate_number: 'REM 1009 MA', model: 'Schmitz Cargobull Pharma Certified', status: 'active' },
  { plate_number: 'REM-1010-MA', model: 'Krone Reefer Deep Freeze A-500', status: 'active' },
];

async function main() {
  console.log('====================================================');
  console.log('🚛 Trans Bodanon TMS — Live Fleet Onboarding Seed');
  console.log('====================================================\n');

  console.log('🔍 1. Plate Sanitization Audit:');
  console.log('----------------------------------------------------');
  for (const t of TRUCKS_DATA) {
    const clean = sanitizeMoroccanPlate(t.plate_number);
    console.log(`  Truck:   "${t.plate_number}" ➔ "${clean}" (${t.model})`);
  }
  for (const tr of TRAILERS_DATA) {
    const clean = sanitizeMoroccanPlate(tr.plate_number);
    console.log(`  Trailer: "${tr.plate_number}" ➔ "${clean}" (${tr.model})`);
  }

  console.log('\n🚀 2. Executing importTrucksAction (10 Tracteurs)...');
  const truckRes = await importTrucksAction(TRUCKS_DATA);
  console.log('  Result:', JSON.stringify(truckRes, null, 2));

  console.log('\n❄️ 3. Executing importTrailersAction (10 Reefer Trailers)...');
  const trailerRes = await importTrailersAction(TRAILERS_DATA);
  console.log('  Result:', JSON.stringify(trailerRes, null, 2));

  console.log('\n📊 4. Database Verification Query...');
  const supabase = await createClient();
  const { data: trucks, count: truckCount } = await supabase.from('trucks').select('id, plate_number, model, weight_capacity, fuel_consumption_rate', { count: 'exact' });
  const { data: trailers, count: trailerCount } = await supabase.from('trailers').select('id, plate_number, model', { count: 'exact' });

  console.log(`  Total Trucks in DB:   ${truckCount || trucks?.length || 0}`);
  if (trucks && trucks.length > 0) {
    console.log('  Sample Trucks in DB:', trucks.slice(-3).map(t => `${t.plate_number} (${t.model})`));
  }

  console.log(`  Total Trailers in DB: ${trailerCount || trailers?.length || 0}`);
  if (trailers && trailers.length > 0) {
    console.log('  Sample Trailers in DB:', trailers.slice(-3).map(t => `${t.plate_number} (${t.model})`));
  }

  console.log('\n✅ Fleet Onboarding Complete.');
}

main().catch((err) => {
  console.error('Fatal Fleet Onboarding Error:', err);
  process.exit(1);
});

