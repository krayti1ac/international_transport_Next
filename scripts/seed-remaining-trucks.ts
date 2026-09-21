import { importTrucksAction } from '../src/lib/bulk-import.actions';

async function main() {
  const remainingTrucks = [
    { plate_number: '40501-هـ-40', model: 'MAN TGX 18.510 EfficientLine 3', status: 'active', fuel_consumption_rate: 36 },
    { plate_number: '40502-هـ-40', model: 'DAF XF 480 Super Space Cab', status: 'active', fuel_consumption_rate: 35.5 },
  ];

  const res = await importTrucksAction(remainingTrucks);
  console.log('Import Remaining Trucks Result:', JSON.stringify(res, null, 2));
}

main().catch(console.error);

