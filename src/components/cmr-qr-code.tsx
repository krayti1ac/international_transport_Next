'use client';

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Loader2 } from 'lucide-react';

interface CmrQrCodeProps {
  tripId: number;
  size?: number;
  className?: string;
}

export function CmrQrCode({ tripId, size = 120, className = '' }: CmrQrCodeProps) {
  const [qrSrc, setQrSrc] = useState<string>('');
  const [error, setError] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const generateQr = async () => {
      try {
        const origin = typeof window !== 'undefined' ? window.location.origin : '';
        const trackingUrl = `${origin}/track/${tripId}`;
        
        const src = await QRCode.toDataURL(trackingUrl, {
          width: size,
          margin: 1,
          color: {
            dark: '#0f172a',
            light: '#ffffff',
          },
          errorCorrectionLevel: 'H',
        });
        
        if (isMounted) {
          setQrSrc(src);
        }
      } catch (err) {
        console.error('فشل توليد رمز QR:', err);
        if (isMounted) {
          setError(true);
        }
      }
    };

    if (tripId) {
      generateQr();
    }

    return () => {
      isMounted = false;
    };
  }, [tripId, size]);

  if (error) {
    return (
      <div 
        className={`flex items-center justify-center bg-slate-100 border border-slate-200 text-xs text-slate-400 text-center p-2 rounded-md ${className}`}
        style={{ width: size, height: size }}
      >
        تعذر<br/>التوليد
      </div>
    );
  }

  if (!qrSrc) {
    return (
      <div 
        className={`flex items-center justify-center bg-slate-50 border border-slate-100 rounded-md animate-pulse ${className}`}
        style={{ width: size, height: size }}
      >
        <Loader2 className="w-6 h-6 text-slate-300 animate-spin" />
      </div>
    );
  }

  return (
    <div className={`flex flex-col items-center gap-1 ${className}`}>
      <img 
        src={qrSrc} 
        alt={`تتبع الرحلة ${tripId}`} 
        className="border border-slate-300 rounded-md bg-white p-1 shadow-xs object-contain"
        width={size}
        height={size}
      />
      <span className="text-[9px] text-slate-500 font-mono tracking-wider font-semibold">SCAN TO TRACK</span>
    </div>
  );
}

