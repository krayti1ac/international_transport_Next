import { createClient } from '@/lib/supabase/client';

export interface MfaEnrollmentResponse {
  id: string;
  qrCodeSvg: string;
  secret: string;
}

export async function enrollMfaFactor(): Promise<{ success: boolean; data?: MfaEnrollmentResponse; error?: string }> {
  const supabase = createClient();
  try {
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: 'totp',
      issuer: 'Trans Bodanon ERP',
    });

    if (error || !data) {
      return { success: false, error: error?.message || 'فشل توليد رمز التحقق الثنائي' };
    }

    return {
      success: true,
      data: {
        id: data.id,
        qrCodeSvg: data.totp.qr_code,
        secret: data.totp.secret,
      },
    };
  } catch (err: any) {
    return { success: false, error: err?.message || 'حدث خطأ غير متوقع' };
  }
}

export async function verifyMfaChallenge(factorId: string, code: string): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient();
  try {
    const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });
    if (challengeError || !challengeData) {
      return { success: false, error: challengeError?.message || 'فشل بدء التحدي الأمني' };
    }

    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challengeData.id,
      code,
    });

    if (verifyError) {
      return { success: false, error: verifyError.message };
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from('users').update({ mfa_enabled: true }).eq('id', user.id);
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'فشل التحقق من الرمز' };
  }
}

export async function unenrollMfaFactor(factorId: string): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient();
  try {
    const { error } = await supabase.auth.mfa.unenroll({ factorId });
    if (error) return { success: false, error: error.message };

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from('users').update({ mfa_enabled: false }).eq('id', user.id);
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'فشل إلغاء التفعيل' };
  }
}
