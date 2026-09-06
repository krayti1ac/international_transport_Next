'use server';

import { parseReceiptTextAdvanced, type ParsedReceiptData } from '@/lib/ocr-parser';

export async function processFuelReceiptOCR(base64Image: string): Promise<{
  success: boolean;
  data?: ParsedReceiptData;
  error?: string;
}> {
  try {
    const apiKey = process.env.OCR_API_KEY;

    if (!base64Image) {
      return { success: false, error: 'لم يتم إرسال صورة صالحة للمعالجة' };
    }

    const cleanBase64 = base64Image.replace(/^data:image\/[a-z]+;base64,/, '');

    let extractedText = '';

    if (apiKey) {
      try {
        const formData = new FormData();
        formData.append('base64Image', `data:image/jpeg;base64,${cleanBase64}`);
        formData.append('language', 'ara');
        formData.append('isOverlayRequired', 'false');
        formData.append('filetype', 'JPG');
        formData.append('detectOrientation', 'true');

        const ocrRes = await fetch('https://api.ocr.space/parse/image', {
          method: 'POST',
          headers: {
            apikey: apiKey,
          },
          body: formData,
        });

        const ocrJson = await ocrRes.json();
        if (ocrJson.ParsedResults && ocrJson.ParsedResults.length > 0) {
          extractedText = ocrJson.ParsedResults[0].ParsedText || '';
        }
      } catch (apiErr) {
        console.warn('OCR Cloud API call fallback:', apiErr);
      }
    }

    if (!extractedText.trim()) {
      return {
        success: false,
        error: 'تعذر استخراج النصوص آلياً من الصورة. يرجى إدخال البيانات يدوياً.',
      };
    }

    const parsedData = parseReceiptTextAdvanced(extractedText);

    return {
      success: true,
      data: parsedData,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'فشل تحليل إيصال الوقود';
    return { success: false, error: message };
  }
}
