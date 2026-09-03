# النقل الدولي - Next.js

نظام إدارة النقل الدولي - نسخة ويب محولة من تطبيق Flutter الأصلي.

## التقنيات المستخدمة

- **Next.js 16** - إطار عمل React
- **TypeScript** - لكتابة كود آمن
- **Tailwind CSS v4** - للتنسيق
- **Supabase** - لقاعدة البيانات والمصادقة
- **Radix UI** - لمكونات الواجهة
- **Lucide React** - للأيقونات

## المتطلبات

- Node.js 18+
- npm أو yarn
- مشروع Supabase

## الإعداد

1. استنساخ المشروع:
```bash
git clone <repository-url>
cd international-transport_Next
```

2. تثبيت الاعتمادات:
```bash
npm install
```

3. إنشاء ملف `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=https://jgehdsmrmcpnvcnfrjai.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

4. تشغيل الخادم المحلي:
```bash
npm run dev
```

## الصفحات

- `/login` - تسجيل الدخول
- `/signup` - إنشاء حساب جديد
- `/dashboard` - لوحة التحكم الرئيسية
- `/trips` - إدارة الرحلات
- `/clients` - إدارة العملاء
- `/invoices` - إدارة الفواتير
- `/treasury` - إدارة الخزينة
- `/fleet` - إدارة الأسطول
- `/driver-tasks` - مهام السائق
- `/driver-advances` - سلف السائق
- `/fuel-receipt` - تسجيل إيصال الوقود
- `/reports` - التقارير
- `/settings` - الإعدادات

## الأدوار

- **admin** - مدير النظام (صلاحيات كاملة)
- **secretary** - سكرتيرة (رحلات، خزينة، عملاء، فواتير)
- **driver** - سائق (مهام، سلف، وقود)

## الميزات

- واجهة عربية RTL
- تصميم متجاوب
- مصادقة عبر Supabase
- إدارة أدوار المستخدمين
- تخزين الصور في Supabase Storage
