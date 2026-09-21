import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';

type BulkImportEntityType = 'client' | 'truck' | 'trailer' | 'driver' | 'trip' | 'provider' | 'treasury';

const TEMPLATES: Record<BulkImportEntityType, { headers: string[]; example: Record<string, any>; colWidths: number[] }> = {
  client: {
    headers: ['اسم_العميل', 'رقم_الهاتف', 'البريد_الإلكتروني', 'المدينة', 'العنوان', 'ICE', 'نوع_العميل', 'العملة'],
    example: {
      'اسم_العميل': 'شركة الأطلس للتصدير SARL (مثال)',
      'رقم_الهاتف': '0661234567',
      'البريد_الإلكتروني': 'contact@atlas.ma',
      'المدينة': 'طنجة',
      'العنوان': 'المنطقة الحرة كزناية',
      'ICE': '001928374000082',
      'نوع_العميل': 'export',
      'العملة': 'MAD',
    },
    colWidths: [28, 18, 25, 16, 30, 22, 14, 12],
  },
  truck: {
    headers: ['رقم_اللوحة', 'الموديل', 'الحالة', 'الحمولة_طن', 'معدل_استهلاك_الوقود'],
    example: {
      'رقم_اللوحة': '10101-أ-40 (مثال)',
      'الموديل': 'Volvo FH 500 Globetrotter',
      'الحالة': 'active',
      'الحمولة_طن': '25',
      'معدل_استهلاك_الوقود': '36.0',
    },
    colWidths: [20, 28, 15, 15, 22],
  },
  trailer: {
    headers: ['رقم_اللوحة', 'الموديل', 'الحالة'],
    example: {
      'رقم_اللوحة': 'REM-1001-MA (مثال)',
      'الموديل': 'Schmitz Cargobull S.KO COOL Frigo',
      'الحالة': 'active',
    },
    colWidths: [22, 32, 15],
  },
  driver: {
    headers: ['اسم_السائق', 'رقم_الهاتف', 'رقم_الرخصة', 'الراتب_الأساسي', 'نسبة_العمولة', 'نوع_التأشيرة', 'رقم_التأشيرة_شنغن', 'تأشيرة_إفريقيا'],
    example: {
      'اسم_السائق': 'محمد العلمي (مثال)',
      'رقم_الهاتف': '0661223344',
      'رقم_الرخصة': 'B/C/EC-48201',
      'الراتب_الأساسي': '6500',
      'نسبة_العمولة': '5',
      'نوع_التأشيرة': 'both',
      'رقم_التأشيرة_شنغن': 'V-ESP-2026-99',
      'تأشيرة_إفريقيا': 'MR-VISA-2026-44',
    },
    colWidths: [25, 18, 20, 16, 15, 16, 22, 22],
  },
  trip: {
    headers: ['مسار_الرحلة', 'تاريخ_الانطلاق', 'سعر_الرحلة', 'العملة', 'رقم_CMR_تصدير', 'لوحة_الشاحنة', 'اسم_السائق', 'اسم_العميل'],
    example: {
      'مسار_الرحلة': 'طنجة المتوسط -> الجزيرة الخضراء -> مدريد (مثال)',
      'تاريخ_الانطلاق': '2026-09-20',
      'سعر_الرحلة': '32000',
      'العملة': 'MAD',
      'رقم_CMR_تصدير': 'CMR-EXP-00105',
      'لوحة_الشاحنة': '10101-أ-40',
      'اسم_السائق': 'محمد العلمي',
      'اسم_العميل': 'شركة الأطلس للتصدير',
    },
    colWidths: [36, 18, 15, 12, 20, 18, 22, 25],
  },
  provider: {
    headers: ['اسم_المورد', 'نوع_الخدمة', 'رقم_الهاتف', 'المدينة', 'العنوان', 'ICE'],
    example: {
      'اسم_المورد': 'محطة وقود أفريقيا طنجة المتوسط (مثال)',
      'نوع_الخدمة': 'fuel',
      'رقم_الهاتف': '0539934010',
      'المدينة': 'طنجة',
      'العنوان': 'ميناء طنجة المتوسط',
      'ICE': '001594830000012',
    },
    colWidths: [32, 18, 18, 16, 28, 22],
  },
  treasury: {
    headers: ['نوع_الحركة', 'المبلغ', 'العملة', 'البيان_والوصف', 'المرجع', 'التاريخ_المرجعي'],
    example: {
      'نوع_الحركة': 'deposit',
      'المبلغ': '150000',
      'العملة': 'MAD',
      'البيان_والوصف': 'رصيد افتتاحي تأسيسي للصندوق الرئيسي بطنجة (مثال)',
      'المرجع': 'OP-BAL-2026',
      'التاريخ_المرجعي': '2026-01-01',
    },
    colWidths: [24, 16, 12, 36, 18, 18],
  },
};

function main() {
  const targetDir = path.resolve(process.cwd(), 'public/templates');
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  console.log('📄 Generating Smart Excel Templates in public/templates/...');
  for (const [entity, config] of Object.entries(TEMPLATES)) {
    const ws = XLSX.utils.json_to_sheet([config.example], { header: config.headers });
    ws['!cols'] = config.colWidths.map(w => ({ wch: w }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `نموذج_${entity}`);

    const filePath = path.join(targetDir, `template_${entity}.xlsx`);
    XLSX.writeFile(wb, filePath);
    console.log(`  ✓ Generated: template_${entity}.xlsx`);
  }
  console.log('✅ All 7 smart templates generated successfully.\n');
}

main();

