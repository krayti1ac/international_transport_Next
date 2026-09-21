import { importDriversAction } from '../src/lib/bulk-import.actions';
import { createClient } from '@supabase/supabase-js';

const DRIVERS_DATA = [
  { name: 'محمد العلمي (Mohamed El Alami)', phone: '0661245589', license: 'B/C/EC-48201', base_salary: 6500, bonus_percentage: 5, visa_type: 'both', visa_number: 'V-ESP-2026-991', african_visa_number: 'AFR-MR-2026-101', status: 'active', visa_expiry_date: '2027-08-30' },
  { name: 'رشيد بنجلون (Rachid Benjelloun)', phone: '0663881940', license: 'B/C/EC-39281', base_salary: 6800, bonus_percentage: 5, visa_type: 'both', visa_number: 'V-FRA-2026-882', african_visa_number: 'AFR-SN-2026-102', status: 'active', visa_expiry_date: '2027-06-15' },
  { name: 'يوسف التازي (Youssef Tazi)', phone: '0670114932', license: 'B/C/EC-59201', base_salary: 6200, bonus_percentage: 4.5, visa_type: 'schengen', visa_number: 'V-ESP-2026-773', status: 'active', visa_expiry_date: '2027-04-20' },
  { name: 'عمر الصنهاجي (Omar Senhaji)', phone: '0662903315', license: 'B/C/EC-94820', base_salary: 6400, bonus_percentage: 5, visa_type: 'schengen', visa_number: 'V-FRA-2026-664', status: 'active', visa_expiry_date: '2027-05-10' },
  { name: 'عبد الكريم الخمليشي (Abdelkrim Khamlichi)', phone: '0668447790', license: 'B/C/EC-82710', base_salary: 6000, bonus_percentage: 4.5, visa_type: 'african_transit', african_visa_number: 'AFR-VISA-2026-9912', status: 'active', visa_expiry_date: '2027-12-31' },
  { name: 'سعيد التوزاني (Said Touzani)', phone: '0661998877', license: 'B/C/EC-71620', base_salary: 7000, bonus_percentage: 5.5, visa_type: 'african_transit', african_visa_number: 'AFR-VISA-2026-5521', status: 'active', visa_expiry_date: '2027-11-20' },
  { name: 'حمزة المراكشي (Hamza El Marrakchi)', phone: '0662114455', license: 'B/C/EC-60391', base_salary: 6300, bonus_percentage: 4.5, visa_type: 'both', visa_number: 'V-ESP-2026-331', african_visa_number: 'AFR-MR-2026-303', status: 'active', visa_expiry_date: '2027-09-15' },
  { name: 'طارق الفاسي (Tariq El Fassi)', phone: '0663772211', license: 'B/C/EC-51209', base_salary: 6100, bonus_percentage: 4, visa_type: 'schengen', visa_number: 'V-ESP-2026-442', status: 'active', visa_expiry_date: '2027-03-30' },
  { name: 'إدريس البوعناني (Driss El Bouanani)', phone: '0668553399', license: 'B/C/EC-40192', base_salary: 6600, bonus_percentage: 5, visa_type: 'african_transit', african_visa_number: 'AFR-VISA-2026-7734', status: 'active', visa_expiry_date: '2027-10-05' },
  { name: 'هشام الصويري (Hicham Essouiri)', phone: '0670889900', license: 'B/C/EC-39014', base_salary: 6400, bonus_percentage: 5, visa_type: 'both', visa_number: 'V-FRA-2026-119', african_visa_number: 'AFR-SN-2026-404', status: 'active', visa_expiry_date: '2027-07-25' },
];

async function main() {
  console.log('====================================================');
  console.log('👨‍✈️ Trans Bodanon TMS — Live Drivers Onboarding Seed');
  console.log('====================================================\n');

  console.log('⏳ Executing importDriversAction (10 International Captains)...');
  const res = await importDriversAction(DRIVERS_DATA);
  console.log('Result:', JSON.stringify(res, null, 2));

  console.log('\n📊 Database Verification Query...');
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  const { data: drivers, count } = await supabase
    .from('drivers')
    .select('id, name, phone, license, base_salary, bonus_percentage, visa_number, visa_expiry_date, has_valid_visa')
    .order('id', { ascending: false })
    .limit(10);

  console.log(`\n✅ Total Recently Added Drivers in DB: ${drivers?.length || 0}`);
  if (drivers) {
    drivers.forEach((d, idx) => {
      console.log(`  ${idx + 1}. [${d.name}] Tel: ${d.phone} | License: ${d.license} | Visa: ${d.visa_number} | Valid: ${d.has_valid_visa}`);
    });
  }
}

main().catch((err) => {
  console.error('Fatal Drivers Onboarding Error:', err);
  process.exit(1);
});

