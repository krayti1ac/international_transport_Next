# 🌐 Trans Bodanon TMS — دليل إعداد وربط النطاق المخصص والشهادات الأمنية (Custom Domain & SSL Setup)

> **الإصدار**: 1.0.0 (Production-Ready)  
> **تاريخ الاعتماد**: سبتمبر 2026  
> **النطاق المعتمد**: `transbodanon.ma`  
> **المنصة السحابية المستضيفة**: Vercel Edge Network & Global Anycast AnyCDN  
> **محرك الأمان والتشفير**: Let's Encrypt / TLS 1.3 256-bit ECC Certificate  

---

## 📑 الفهرس التنفيذي
1. [المعمارية الشبكية وتوزيع النطاقات الفرعية (Subdomains Architecture)](#1-المعمارية-الشبكية-وتوزيع-النطاقات-الفرعية)
2. [مصفوفة سجلات الـ DNS الكاملة (DNS Configuration Matrix)](#2-مصفوفة-سجلات-الـ-dns-الكاملة)
3. [خطوات الربط لدى مزود النطاق الوطني (Registrar Configuration)](#3-خطوات-الربط-لدى-مزود-النطاق-الوطني)
4. [التحقق وتأكيد الملكية في Vercel (Vercel Domain Verification)](#4-التحقق-وتأكيد-الملكية-في-vercel)
5. [شهادات الأمان والتشفير SSL/TLS والهيدرز الأمنية الصارمة](#5-شهادات-الأمان-والتشفير-ssltls-والهيدرز-الأمنية-الصارمة)
6. [فحوصات الجاهزية والتحقق عبر موجه الأوامر (Terminal Diagnostic Commands)](#6-فحوصات-الجاهزية-والتحقق-عبر-موجه-الأوامر)

---

## 1. المعمارية الشبكية وتوزيع النطاقات الفرعية

تعتمد منصة **Trans Bodanon TMS** على بنية شبكية متفرعة تفصل بين المنظومة التشغيلية وبوابة العملاء، وبوابة التتبع المباشر، مع توجيه دائم ومشفر:

```
                               ┌─────────────────────────────┐
                               │       transbodanon.ma       │
                               │        (Apex Domain)        │
                               └──────────────┬──────────────┘
                                              │ HTTP 308 Permanent Redirect
                                              ▼
                    ┌───────────────────────────────────────────────────┐
                    │               app.transbodanon.ma                 │
                    │   (النطاق المعتمد الرئيسي - المنظومة وبوابة العملاء)   │
                    └──────────┬─────────────────────────────┬──────────┘
                               │                             │
                               ▼                             ▼
                    ┌──────────────────────┐      ┌─────────────────────┐
                    │  غرفة العمليات TMS   │      │  بوابة كبار المصدرين │
                    │   (/trips, /fleet)   │      │       (/portal)     │
                    └──────────────────────┘      └─────────────────────┘

                               ┌─────────────────────────────┐
                               │     track.transbodanon.ma   │
                               │ (بوابة التتبع المباشر للرحلات)│
                               └─────────────────────────────┘
```

---

## 2. مصفوفة سجلات الـ DNS الكاملة

يتم تسجيل السجلات التالية بدقة في لوحة تحكم مزود النطاق الوطني المغربي (مثل MTDS أو Genious أو Cloudflare):

| نوع السجل (Type) | الاسم / المضيف (Name / Host) | القيمة المستهدفة (Target / Value) | مدة الصلاحية (TTL) | الغرض التشغيلي (Purpose) |
| :--- | :--- | :--- | :--- | :--- |
| **A** | `@` (Root Apex) | `76.76.21.21` | 3600 (1 Hour) | ربط النطاق الجذري `transbodanon.ma` بسحابة Vercel Anycast IP |
| **CNAME** | `app` | `cname.vercel-dns.com.` | 3600 (1 Hour) | **النطاق التشغيلي الأساسي**: `app.transbodanon.ma` |
| **CNAME** | `track` | `cname.vercel-dns.com.` | 3600 (1 Hour) | **بوابة التتبع الحي**: `track.transbodanon.ma` |
| **CNAME** | `www` | `cname.vercel-dns.com.` | 3600 (1 Hour) | إعادة توجيه الزوار من `www.transbodanon.ma` إلى النطاق الرئيسي |
| **TXT** | `_vercel` | *`vc-domain-verify=app.transbodanon.ma,xxxxxxxx`* | 300 (5 Min) | رمز التحقق السحابي الفوري لإثبات الملكية وتوليد شهادة SSL تلقائياً |
| **CAA** | `@` | `0 issue "letsencrypt.org"` | 86400 (Auto) | تقييد إصدار الشهادات الأمنية حصراً لمؤسسة Let's Encrypt لمنع تزوير الشهادات |
| **CAA** | `@` | `0 issuewild "letsencrypt.org"` | 86400 (Auto) | السماح بإصدار شهادات النطاقات الفرعية (Wildcard) الآمنة |

> ⚠️ **ملاحظة هامة (Cloudflare Users)**:  
> في حال استخدام Cloudflare لإدارة الـ DNS، يجب جعل خيار الـ Proxy في وضعية **DNS Only (الرمادي)** أثناء عملية إصدار الشهادة الأولى للتحقق السريع من ملكية Vercel.

---

## 3. خطوات الربط لدى مزود النطاق الوطني

### الخطوة 1: الدخول إلى لوحة إدارة النطاق
1. سجل الدخول إلى المزود المعتمد (مثل **Genious.ma** أو **MTDS** أو **CapConnect**).
2. توجه إلى قسم **Zone DNS** أو **Gestion DNS**.

### الخطوة 2: تنظيف السجلات القديمة المتعارضة
- احذف أي سجل من نوع `A` أو `CNAME` سابق كان يشير إلى استضافة سابقة لنفس الأسماء (`@` أو `app` أو `www`).

### الخطوة 3: إضافة سجلات Vercel
- قم بإضافة سجل `A` للاسم `@` بالقيمة `76.76.21.21`.
- قم بإضافة سجل `CNAME` للاسم `app` بالقيمة `cname.vercel-dns.com.`.
- قم بإضافة سجل `CNAME` للاسم `track` بالقيمة `cname.vercel-dns.com.`.

---

## 4. التحقق وتأكيد الملكية في Vercel

1. الدخول إلى لوحة تحكم مشروع **Trans Bodanon TMS** في Vercel:
   `Project Settings ➔ Domains`
2. إضافة النطاقات التالية:
   - `transbodanon.ma` (مع تفعيل خيار **Redirect to app.transbodanon.ma** برمز `308 Permanent Redirect`).
   - `app.transbodanon.ma` (النطاق الرئيسي للإنتاج Production Domain).
   - `track.transbodanon.ma` (النطاق الثانوي لبوابة تتبع الشاحنات المباشرة).
3. بمجرد اكتمال نشر الـ DNS (عادة بين 5 دقائق و 60 دقيقة في النطاقات الوطنية `.ma`):
   - ستتحول حالة النطاق إلى **Valid Configuration ✅**.
   - سيقوم Vercel تلقائياً بتوليد شهادة SSL/TLS مجانية ومجددة ذاتياً.

---

## 5. شهادات الأمان والتشفير SSL/TLS والهيدرز الأمنية الصارمة

تم ضبط وتضمين أحدث معايير الأمان الموصى بها دولياً في ملف إعدادات المشروع [`next.config.ts`](file:///c:/international_transport_Next/next.config.ts):

### 🛡️ ترويسات الاستجابة الأمنية (HTTP Security Headers)
تُحقن هذه الترويسات مع كل طلب لضمان تصنيف **A+** في اختبارات الأمان الدولية (SecurityHeaders.com & Mozilla Observatory):

```typescript
// مقتطف من next.config.ts
{
  key: 'Strict-Transport-Security',
  value: 'max-age=63072000; includeSubDomains; preload' // فرض التشفير الإجباري HSTS لمدة سنتين
},
{
  key: 'X-Frame-Options',
  value: 'DENY' // حماية المنظومة من هجمات Clickjacking
},
{
  key: 'X-Content-Type-Options',
  value: 'nosniff' // منع متصفحات الويب من تخمين أنواع الملفات الخطرة MIME-sniffing
},
{
  key: 'Referrer-Policy',
  value: 'strict-origin-when-cross-origin'
},
{
  key: 'Permissions-Policy',
  value: 'camera=(self), geolocation=(self), microphone=()' // تقييد الوصول للمستشعرات حصراً للـ PWA والتوقيع الإلكتروني
},
{
  key: 'Content-Security-Policy',
  // عزل آمن يسمح فقط بـ Supabase و OpenStreetMap وخرائط التتبع وواجهات WhatsApp الرسمية
}
```

---

## 6. فحوصات الجاهزية والتحقق عبر موجه الأوامر (Terminal Diagnostic Commands)

للتأكد من اكتمال نشر سجلات الـ DNS وسلامة شهادات الـ SSL قبل إعلان الإطلاق الرسمي، يتم تنفيذ الأوامر التالية من أي جهاز متصل بالإنترنت:

### 1️⃣ فحص استجابة سجل CNAME لنطاق المنظومة:
```powershell
# التحقق من توجيه app.transbodanon.ma
nslookup -q=cname app.transbodanon.ma
# النتيجة المتوقعة: app.transbodanon.ma canonical name = cname.vercel-dns.com
```

### 2️⃣ فحص سجل A للنطاق الجذري:
```powershell
# التحقق من ربط النطاق الجذري
nslookup transbodanon.ma
# النتيجة المتوقعة: Address: 76.76.21.21
```

### 3️⃣ فحص ترويسات الأمان وشهادة الـ SSL عبر cURL:
```bash
curl -I https://app.transbodanon.ma
```
**المخرجات المتوقعة**:
```http
HTTP/2 200
server: Vercel
strict-transport-security: max-age=63072000; includeSubDomains; preload
x-frame-options: DENY
x-content-type-options: nosniff
content-security-policy: default-src 'self' ...
```

### 4️⃣ فحص سلامة إعادة التوجيه التلقائي (308 Redirect):
```bash
curl -I http://transbodanon.ma
# النتيجة: HTTP/1.1 308 Permanent Redirect -> https://app.transbodanon.ma
```

---
**الخلاصة**: بمجرد تطبيق سجلات الـ DNS الواردة في الجدول أعلاه لدى مزود النطاق، تصبح المنظومة جاهزة للعمل على مدار الساعة برابطها المؤسسي الرسمي الآمن ومحمية بأعلى معايير التشفير العالمية.

