# Trans Bodanon TMS — قواعد وتعليمات Antigravity للتنفيذ الذاتي

## 1. وضع التنفيذ التلقائي والذاتي (Autonomous Execution Mode)
- **الاستقلالية في العمليات**: نفّذ الأوامر، فحص الكود، والتحقق تلقائياً دون مقاطعة المستخدم بأسئلة بديهية.
- **إصلاح الأخطاء ذاتياً**: في حال وجود أخطاء في الـ Lint أو TypeScript (`tsc`) أو البناء (`next build`)، قم بتحليل سجل الخطأ فوراً وتعديل الكود والتحقق مرة أخرى حتى يكتمل البناء بنجاح.
- **عدم التوقف غير المبرر**: استمر في تنفيذ خطوات التطوير والمهام حتى إتمام المطلوب والتحقق منه.

---

## 2. القاعدة المالية الصارمة (غير قابلة للنقاش - NON-NEGOTIABLE)
**يُمنع منعاً باتاً استخدام أرقام JavaScript العادية (`number` أو حسابات `+` `-` `*` `/` أو `Math.round`) في أي عملية مالية أو عملات أو رصيد أو ديون أو وقود أو سلفيات أو فواتير. يجب دائماً استخدام مكتبة `decimal.js`.**

```typescript
// صحيح دائماً
import Decimal from 'decimal.js';
const total = new Decimal(trip.price);
const advance = new Decimal(amountGiven);
const balance = total.minus(advance).toFixed(2);

// ممنوع تماماً
const balance = trip.price - amountGiven; // خطأ دقة الفاصلة العائمة
```

---

## 3. معمارية المشروع (Feature-First)
- أي ميزة جديدة أو تعديل يوضع حصراً في: `src/features/[feature_name]/`
  - المكونات: `src/features/[feature_name]/components/`
  - طفرات البيانات (Server Actions): في `src/features/[feature_name]/services/*.actions.ts` مع التحقق بواسطة Zod.
  - جلب البيانات (React Query): في `src/features/[feature_name]/services/*.queries.ts`.
  - إدارة الحالة المحلية: في `src/features/[feature_name]/stores/` عبر Zustand.
- يُمنع وضع منطق الأعمال مباشرة داخل مسارات `src/app/` أو المكونات العامة `src/components/`.

---

## 4. التعامل مع Supabase و الأمان
- **من جانب السيرفر (Server Components / Server Actions)**:
  ```typescript
  import { createClient } from '@/lib/supabase/server';
  const supabase = await createClient();
  ```
- **من جانب المتصفح (Client Components)**:
  ```typescript
  import { createClient } from '@/lib/supabase/browser';
  const supabase = createClient();
  ```
- لا تقم بتجاوز سياسات الأمان على مستوى الصف (RLS). لا تسرب `service_role` إلى كود العميل.

---

## 5. دعم اللغة العربية وواجهات RTL
- النظام ثنائي اللغة: العربية (RTL هي الأساسية) والفرنسية (LTR).
- استخدم فئات Tailwind التوافقية مع الاتجاهين: `ms-*` و `me-*`، `ps-*` و `pe-*`.
- احرص دائماً على إضافة وتحديث مفاتيح الترجمة في `src/i18n/messages/ar.json` و `fr.json`.

---

## 6. بوابة فحص الجودة (Quality Assurance)
قبل إنهاء أي مهمة برمجية:
1. تحقق من عدم وجود أخطاء أنواع عبر: `npx tsc --noEmit`
2. تحقق من الـ Lint عبر: `npm run lint`
3. قم بتشغيل فحص الجودة المسبق: `node scripts/pre-flight-check.js`

