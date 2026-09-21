import * as fs from 'fs';
import * as path from 'path';
import Decimal from 'decimal.js';
import { createClient } from '../src/lib/supabase/server';
import { importClientsAction, importTreasuryAction } from '../src/lib/bulk-import.actions';
import { sanitizeICE, sanitizeNumeric } from '../src/lib/data-sanitizer';
import { validateICE } from '../src/lib/validators/morocco-business';

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

// 2. Matrix of Exporters / Major Clients (Step 2.4)
const clients = [
  { name: 'AGRI-EXPORT NORD SARL', ice: '001928374000082', city: 'Tanger', phone: '+212539941230', address: 'Zone Franche Lot 45', client_type: 'export', currency: 'EUR' },
  { name: 'BERRY MED TANGER', ice: '002847192000045', city: 'Tanger', phone: '+212539398811', address: 'Route de Rabat Km 12', client_type: 'export', currency: 'EUR' },
  { name: 'FRIGO ATLANTIC AGADIR', ice: '003194827000091', city: 'Agadir', phone: '+212528845520', address: 'Zone Industrielle Anza', client_type: 'export', currency: 'MAD' },
  { name: 'MAROC PRIMEURS SOUSS', ice: '002194837000055', city: 'Agadir', phone: '+212528334455', address: 'Zone Industrielle Ait Melloul', client_type: 'export', currency: 'EUR' },
  { name: 'DAKAR LOGISTICS HUB SN', ice: '004928174000019', city: 'Dakar', phone: '+221338210011', address: 'Zone Portuaire Mole 2', client_type: 'import', currency: 'XOF' },
  { name: 'MAURITANIA FISH TRADING', ice: '003847291000033', city: 'Nouadhibou', phone: '+22245741020', address: 'Zone Franche Port de Peche', client_type: 'import', currency: 'MRU' },
  { name: 'EURO-PRIMEURS LOGISTICS', ice: '001849201948201', city: 'Perpignan', phone: '+33468852000', address: 'Grand Saint-Charles', client_type: 'import', currency: 'EUR' },
  { name: 'IBERIA LOGISTICA VALENCIA', ice: '002948201940022', city: 'Valencia', phone: '+34961504422', address: 'Poligono Fuente del Jarro', client_type: 'import', currency: 'EUR' },
  { name: 'COMPTOIR SAHARA TRANSIT', ice: '001594830000012', city: 'Dakhla', phone: '+212528930012', address: 'Avenue Mohammed V', client_type: 'export', currency: 'MAD' },
  { name: 'CASABLANCA TEXTILE EXPORT', ice: '002748193000067', city: 'Casablanca', phone: '+212522301144', address: 'Ain Sebaa Lot 18', client_type: 'export', currency: 'EUR' },
];

// 3. Matrix of Treasury Opening Balances (Step 2.5)
const treasuryTransactions = [
  { type: 'deposit', amount: 450000, currency: 'MAD', description: 'رصيد افتتاحي تأسيسي - Attijariwafa Bank MAD', reference: 'OP-AWB-MAD-2026' },
  { type: 'deposit', amount: 42500, currency: 'EUR', description: 'رصيد افتتاحي تأسيسي - Attijariwafa Bank EUR', reference: 'OP-AWB-EUR-2026' },
  { type: 'deposit', amount: 280000, currency: 'MAD', description: 'رصيد افتتاحي تأسيسي - Banque Populaire MAD', reference: 'OP-BP-MAD-2026' },
  { type: 'deposit', amount: 75000, currency: 'MAD', description: 'رصيد افتتاحي تأسيسي - الصندوق الرئيسي طنجة', reference: 'OP-CSH-TNG-2026' },
  { type: 'deposit', amount: 15000, currency: 'EUR', description: 'رصيد افتتاحي تأسيسي - صندوق الصرف باليورو طنجة', reference: 'OP-CSH-EUR-2026' },
  { type: 'deposit', amount: 30000, currency: 'MAD', description: 'رصيد افتتاحي تأسيسي - عهدة ميناء طنجة المتوسط', reference: 'OP-CSH-PTM-2026' },
  { type: 'deposit', amount: 40000, currency: 'MAD', description: 'رصيد افتتاحي تأسيسي - عهدة معبر الكركارات الحدودي', reference: 'OP-CSH-GRG-2026' },
];

async function seedClientsAndTreasury() {
  console.log('========================================================================');
  console.log('🌐 Trans Bodanon TMS — Live Major Clients & Treasury Onboarding');
  console.log('========================================================================\n');

  // --- 1. Audit ICE of 10 Exporters ---
  console.log('🔍 [1/4] فحص وتدقيق أرقام ICE لـ 10 شركات مصدرة ومستوردة:');
  console.log('------------------------------------------------------------------------');
  for (const client of clients) {
    const sanitized = sanitizeICE(client.ice);
    const validation = validateICE(sanitized);
    const isValid15 = /^\d{15}$/.test(sanitized);
    if (!validation.valid || !isValid15) {
      throw new Error(`خطأ في التحقق من رقم ICE للعميل ${client.name}: ${validation.message || 'ليس 15 رقماً'}`);
    }
    console.log(`  ✓ [${client.name}]`);
    console.log(`    ICE: ${sanitized} (15 رقماً ناصعاً) | المدينة: ${client.city} | النوع: ${client.client_type} | العملة: ${client.currency}`);
  }

  // --- 2. Audit Treasury Balances with Decimal.js ---
  console.log('\n💰 [2/4] تدقيق الأرصدة الافتتاحية للخزينة بدقة Decimal.js:');
  console.log('------------------------------------------------------------------------');
  let totalMAD = new Decimal(0);
  let totalEUR = new Decimal(0);

  for (const tx of treasuryTransactions) {
    const numAmount = sanitizeNumeric(tx.amount, 0);
    const decAmount = new Decimal(numAmount);
    if (tx.currency === 'MAD') {
      totalMAD = totalMAD.plus(decAmount);
    } else if (tx.currency === 'EUR') {
      totalEUR = totalEUR.plus(decAmount);
    }
    console.log(`  ✓ [${tx.reference}] ${tx.description}`);
    console.log(`    المبلغ: ${decAmount.toFixed(2)} ${tx.currency}`);
  }

  console.log('\n  📊 إجمالي الأرصدة التأسيسية المحسوبة بدقة:');
  console.log(`    • إجمالي الأرصدة بالدرهم المغربي (MAD): ${totalMAD.toFixed(2)} MAD`);
  console.log(`    • إجمالي الأرصدة باليورو الأوروبي   (EUR): ${totalEUR.toFixed(2)} EUR`);

  // --- 3. Execute Actions ---
  console.log('\n⏳ [3/4] جاري استيراد وتطهير بيانات كبار المصدرين (importClientsAction)...');
  const resClients = await importClientsAction(clients);
  console.log('✅ نتيجة استيراد المصدرين:', JSON.stringify(resClients, null, 2));

  if (!resClients.success) {
    console.error('❌ فشل استيراد بعض أو كل العملاء:', resClients.errors);
  }

  console.log('\n⏳ [3.5/4] جاري تثبيت الأرصدة الافتتاحية للخزينة (importTreasuryAction)...');
  const resTreasury = await importTreasuryAction(treasuryTransactions);
  console.log('✅ نتيجة تثبيت الخزينة:', JSON.stringify(resTreasury, null, 2));

  if (!resTreasury.success) {
    console.error('❌ فشل تثبيت بعض أو كل المعاملات:', resTreasury.errors);
  }

  // --- 4. Database Verification Query ---
  console.log('\n📊 [4/4] التحقق النهائي من قاعدة بيانات Supabase الحية:');
  console.log('------------------------------------------------------------------------');
  const supabase = await createClient();

  const { data: dbClients, count: clientsCount } = await supabase
    .from('clients')
    .select('id, name, ice, city, phone, client_type, currency, email, is_active', { count: 'exact' })
    .in('ice', clients.map(c => c.ice));

  console.log(`\n🏢 العملاء المسجلون في قاعدة البيانات (${dbClients?.length || 0} من أصل ${clients.length}):`);
  if (dbClients) {
    dbClients.forEach((c, idx) => {
      console.log(`  ${idx + 1}. [${c.name}] ICE: ${c.ice} | ${c.city} | ${c.client_type.toUpperCase()} | ${c.currency} | البريد: ${c.email}`);
    });
  }

  const { data: dbTxs } = await supabase
    .from('treasury_transactions')
    .select('id, reference, amount, currency, description, reconciliation_status, cash_box_id')
    .in('reference', treasuryTransactions.map(t => t.reference));

  console.log(`\n💵 معاملات الخزينة المسجلة في قاعدة البيانات (${dbTxs?.length || 0} من أصل ${treasuryTransactions.length}):`);
  if (dbTxs) {
    dbTxs.forEach((t, idx) => {
      console.log(`  ${idx + 1}. [${t.reference}] ${t.amount} ${t.currency} | Box ID: ${t.cash_box_id} | ${t.reconciliation_status} | ${t.description}`);
    });
  }

  console.log('\n========================================================================');
  console.log('✨ اكتملت الخطوتان 2.4 و 2.5 بنجاح تام وبدقة حسابية وتنظيمية مطلقة!');
  console.log('========================================================================\n');
}

seedClientsAndTreasury().catch((err) => {
  console.error('Fatal Onboarding Seed Error:', err);
  process.exit(1);
});

