// src/features/super-admin/services/gemini-diagnostics.ts
import { GoogleGenAI } from '@google/genai';

export interface GeminiDiagnosticResponse {
  success: boolean;
  diagnosis?: string;
  codeSuggestion?: string;
  userGuidanceAr?: string;
  userGuidanceFr?: string;
  rawText?: string;
  usedModel?: string;
  error?: string;
}

export async function runGeminiDiagnostic(prompt: string): Promise<GeminiDiagnosticResponse> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GEMIN_API_KEY || '';

  if (!apiKey) {
    return {
      success: false,
      error: 'مفتاح الذكاء الاصطناعي (GEMINI_API_KEY) غير مبرمج في ملف البيئة .env.local أو إعدادات السيرفر.',
    };
  }

  const ai = new GoogleGenAI({ apiKey });

  // سلسلة النماذج المرتبة حسب الأولوية للتراجع التلقائي في حال تقادم أو ترقية أي إصدار
  const candidateModels = [
    process.env.GEMINI_MODEL, // 1. أولوية للموديل المعين في البيئة إن وجد
    'gemini-2.5-flash',       // 2. الموديل الأساسي فائق السرعة
    'gemini-1.5-flash',       // 3. الموديل الاحتياطي المستقر طويل الأمد
    'gemini-1.5-pro',         // 4. موديل استرجاع بديل في حال تعثر الـ Flash
  ].filter(Boolean) as string[];

  const systemInstruction = `
أنت مهندس أنظمة خبير واستشاري رئيسي في فحص أخطاء واجهات الإدخال والتحقق ونظم الـ TMS/ERP اللوجستية (Trans Bodanon).
المهمة: تحليل تقرير الخطأ التشخيصي المُرسل إليك، وتقديم إجابة حاسمة واحترافية بالماركداون تشمل:
1. **السبب الجذري (Root Cause):** لماذا رفض النظام الإدخال مع ربطه ببيئة الجهاز (شاشة، نظام تشغيل، متصفح).
2. **التعديل البرمجي المقترح (Code / Schema Fix):** كود Zod أو منطق تصحيحي جاهز للتطبيق.
3. **رسالة توجيهية للمستخدم (User Guidance):** صياغة إرشادية لطيفة بالعربية وبالفرنسية تظهر للمستخدم لمنع تكرار الخطأ.
`;

  let lastError = 'فشل الاتصال بنموذج الذكاء الاصطناعي';

  // المحاولة عبر سلسلة الموديلات لضمان استمرارية الخدمة إذا تم إيقاف أي موديل
  for (const modelName of candidateModels) {
    try {
      const response = await ai.models.generateContent({
        model: modelName,
        contents: prompt,
        config: {
          systemInstruction,
          temperature: 0.2,
        },
      });

      const rawText = response.text || 'لم يتم استرجاع محتوى من النموذج.';

      return {
        success: true,
        rawText,
        usedModel: modelName,
      };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      lastError = `[${modelName}]: ${errorMsg}`;

      const lowerErr = errorMsg.toLowerCase();
      // إذا كان الخطأ متعلقاً بعدم العثور على الموديل أو توقفه، نستمر للموديل التالي
      const isModelMissing =
        lowerErr.includes('not found') ||
        lowerErr.includes('404') ||
        lowerErr.includes('deprecated') ||
        lowerErr.includes('unsupported') ||
        lowerErr.includes('not supported') ||
        lowerErr.includes('is not available');

      if (!isModelMissing) {
        // إذا كان الخطأ في الحصة أو المفتاح نوقف المحاولة ونعيده مباشرة
        break;
      }
    }
  }

  return {
    success: false,
    error: lastError,
  };
}
