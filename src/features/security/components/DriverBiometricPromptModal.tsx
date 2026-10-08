'use client';

import { useState, useCallback } from 'react';
import { useLanguage } from '@/components/language-provider';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import {
  Fingerprint,
  ShieldCheck,
  AlertCircle,
  RefreshCw,
  Smartphone,
  Lock,
} from 'lucide-react';
import {
  generateDriverBiometricChallengeAction,
  verifyDriverBiometricAssertionAction,
} from '../services/device-binding.actions';
import type {
  BiometricEpodStamp,
  ChallengePurpose,
  WebAuthnAuthenticationResponse,
} from '../types/webauthn-device.types';

interface DriverBiometricPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (stamp: BiometricEpodStamp) => void;
  driverId: number;
  purpose?: ChallengePurpose;
  targetReference?: string;
  title?: string;
  description?: string;
}

export function DriverBiometricPromptModal({
  isOpen,
  onClose,
  onSuccess,
  driverId,
  purpose = 'epod_signature',
  targetReference,
  title,
  description,
}: DriverBiometricPromptModalProps) {
  const { t, dir } = useLanguage();
  const { toast } = useToast();

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const getPurposeLabel = useCallback(
    (p: ChallengePurpose) => {
      switch (p) {
        case 'epod_signature':
          return t(
            'توقيع إثبات التسليم الإلكتروني (e-POD Signature)',
            'Signature Preuve de Livraison (e-POD)',
            'Firma Comprobante de Entrega (e-POD)'
          );
        case 'trip_stage':
          return t(
            'تأكيد نقطة عبور المأمورية (Mission Checkpoint)',
            'Validation Point de Passage',
            'Validación Punto de Control'
          );
        case 'fuel_receipt':
          return t(
            'توثيق وصل التزود بالوقود (Fuel Receipt Attestation)',
            'Attestation Reçu Carburant',
            'Comprobante de Combustible'
          );
        default:
          return t(
            'المصادقة الأمنية لعتاد السائق (Driver Hardware Verification)',
            'Vérification Matérielle Conducteur',
            'Verificación de Hardware del Conductor'
          );
      }
    },
    [t]
  );

  const handleTriggerBiometric = async () => {
    setLoading(true);
    setErrorMsg(null);

    try {
      // 1. Request authentication options & challenge from server
      const chalRes = await generateDriverBiometricChallengeAction({
        driverId,
        purpose,
        targetReference,
      });

      if (!chalRes.success || !chalRes.options) {
        setErrorMsg(chalRes.error || t('فشل إنشاء تحدي البصمة', 'Échec du challenge biométrique', 'Error en el desafío biométrico'));
        setLoading(false);
        return;
      }

      const options = chalRes.options;

      // 2. Client WebAuthn Credential Request
      // Check if WebAuthn is supported in this browser/PWA
      if (typeof window !== 'undefined' && window.PublicKeyCredential) {
        try {
          const challengeBuffer = Uint8Array.from(atob(options.challenge.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
          
          const allowCredentials = options.allowCredentials.map((c) => ({
            id: Uint8Array.from(atob(c.id.replace(/-/g, '+').replace(/_/g, '/')), (char) => char.charCodeAt(0)),
            type: c.type,
          }));

          const assertion = (await navigator.credentials.get({
            publicKey: {
              challenge: challengeBuffer,
              timeout: options.timeout || 60000,
              rpId: options.rpId,
              allowCredentials,
              userVerification: 'required',
            },
          })) as any;

          if (assertion) {
            const rawIdBase64 = btoa(String.fromCharCode(...new Uint8Array(assertion.rawId)))
              .replace(/\+/g, '-')
              .replace(/\//g, '_')
              .replace(/=/g, '');

            const clientDataBase64 = btoa(String.fromCharCode(...new Uint8Array(assertion.response.clientDataJSON)))
              .replace(/\+/g, '-')
              .replace(/\//g, '_')
              .replace(/=/g, '');

            const authDataBase64 = btoa(String.fromCharCode(...new Uint8Array(assertion.response.authenticatorData)))
              .replace(/\+/g, '-')
              .replace(/\//g, '_')
              .replace(/=/g, '');

            const sigBase64 = btoa(String.fromCharCode(...new Uint8Array(assertion.response.signature)))
              .replace(/\+/g, '-')
              .replace(/\//g, '_')
              .replace(/=/g, '');

            const authPayload: WebAuthnAuthenticationResponse = {
              id: assertion.id,
              rawId: rawIdBase64,
              type: 'public-key',
              response: {
                clientDataJSON: clientDataBase64,
                authenticatorData: authDataBase64,
                signature: sigBase64,
              },
            };

            // 3. Verify assertion on server
            const verifyRes = await verifyDriverBiometricAssertionAction({
              driverId,
              response: authPayload,
              expectedChallenge: options.challenge,
              purpose,
              targetReference,
            });

            if (verifyRes.success && verifyRes.biometricStamp) {
              toast({
                title: t('تمت المصادقة البيومترية بنجاح 🛡️', 'Validation biométrique réussie 🛡️', 'Autenticación biométrica exitosa 🛡️'),
                description: t(
                  'تم التحقق من هوية السائق وعتاد الهاتف ودمج الختم الرقمي المشفر.',
                  'Identité du conducteur et matériel certifiés avec empreinte HMAC-SHA256.',
                  'Identidad del conductor y hardware certificados con huella HMAC-SHA256.'
                ),
              });
              onSuccess(verifyRes.biometricStamp);
              onClose();
              return;
            } else {
              setErrorMsg(verifyRes.error || t('فشل التحقق الرقمي للبصمة', 'Échec de vérification biométrique', 'Error de verificación biométrica'));
            }
          }
        } catch (credentialErr: any) {
          // If user cancelled or biometric timed out
          if (credentialErr.name === 'NotAllowedError') {
            setErrorMsg(t('تم إلغاء طلب البصمة من المستخدم', 'Opération biométrique annulée par l’utilisateur', 'Operación biométrica cancelada por el usuario'));
          } else {
            setErrorMsg(credentialErr.message || t('حدث خطأ أثناء قراءة البصمة', 'Erreur du capteur biométrique', 'Error del sensor biométrico'));
          }
        }
      } else {
        setErrorMsg(t('المتصفح أو الجهاز الحالي لا يدعم تقنية WebAuthn البيومترية', 'WebAuthn non pris en charge sur cet appareil', 'WebAuthn no compatible con este dispositivo'));
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t('حدث خطأ أثناء المصادقة', 'Erreur de validation', 'Error de validación');
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md rounded-3xl p-6 text-center" dir={dir}>
        <DialogHeader className="space-y-2">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center relative mb-1">
            <Fingerprint className={`w-9 h-9 ${loading ? 'animate-pulse text-primary' : 'text-primary'}`} />
            <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px]">
              <ShieldCheck className="w-3 h-3" />
            </div>
          </div>

          <DialogTitle className="text-lg font-bold text-foreground">
            {title || getPurposeLabel(purpose)}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {description ||
              t(
                'يرجى تأكيد هويتك بواسطة بصمة الإصبع (TouchID) أو بصمة الوجه (FaceID) المرتبطة بهذا الهاتف.',
                'Veuillez confirmer votre identité via l’empreinte digitale ou faciale enregistrée sur cet appareil.',
                'Por favor, confirme su identidad mediante la huella dactilar o facial registrada en este dispositivo.'
              )}
          </DialogDescription>
        </DialogHeader>

        {errorMsg && (
          <div className="p-3 rounded-2xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2 text-start">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <div className="py-4 space-y-3">
          <div className="p-3 rounded-2xl bg-muted/30 border border-border/60 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Smartphone className="w-4 h-4 text-primary" />
              <span>{t('معيار الأمان العتادي:', 'Norme matérielle:', 'Estándar de hardware:')}</span>
            </div>
            <span className="font-semibold text-foreground font-mono">FIDO2 / WebAuthn</span>
          </div>

          <div className="p-3 rounded-2xl bg-muted/30 border border-border/60 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Lock className="w-4 h-4 text-emerald-600" />
              <span>{t('التشفير والختم:', 'Chiffrement:', 'Cifrado:')}</span>
            </div>
            <span className="font-semibold text-emerald-600 font-mono">HMAC-SHA256</span>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            disabled={loading}
            onClick={onClose}
            className="rounded-xl text-xs h-10 px-4"
          >
            {t('إلغاء', 'Annuler', 'Cancelar')}
          </Button>

          <Button
            type="button"
            disabled={loading}
            onClick={handleTriggerBiometric}
            className="rounded-xl text-xs font-semibold h-10 px-5 gap-2 bg-primary text-primary-foreground shadow-xs"
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                {t('بانتظار قراءة البصمة...', 'En attente du capteur...', 'Esperando huella...')}
              </>
            ) : (
              <>
                <Fingerprint className="w-4 h-4" />
                {t('تأكيد البصمة الآن', 'Activer le capteur', 'Confirmar huella')}
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

