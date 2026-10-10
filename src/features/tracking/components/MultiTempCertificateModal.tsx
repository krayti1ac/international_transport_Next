'use client';

/**
 * Trans Bodanon TMS — Multi-Compartment Independent GDP Certificate Modal
 * Standards: EN 12830 / ATP Treaty (FRC / FRA) / EU GDP 2013/C 343/01
 * Includes Targeted Receiver WhatsApp Dispatch Engine Integration.
 */

import React, { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileCheck2,
  MessageSquare,
  Phone,
  Printer,
  Send,
  ShieldCheck,
  User,
  X,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { dispatchCompartmentReceiverWhatsAppAction } from '../services/multi-temp-whatsapp.actions';

interface MultiTempCertificateModalProps {
  isOpen: boolean;
  onClose: () => void;
  compartmentId?: string;
  trailerId?: number;
  tripId?: number | null;
  certificateNumber?: string;
  compartmentCode?: string;
  htmlContent?: string;
  verificationHash?: string;
  verificationUrl?: string;
}

export function MultiTempCertificateModal({
  isOpen,
  onClose,
  compartmentId,
  trailerId,
  tripId,
  certificateNumber,
  compartmentCode = 'C1',
  htmlContent,
  verificationHash,
  verificationUrl,
}: MultiTempCertificateModalProps) {
  const t = useTranslations('reefer.multiTempCertificate');
  const tDispatch = useTranslations('reefer.multiTempReceiverDispatch');
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  // WhatsApp Dispatch Drawer / State
  const [showWhatsAppPanel, setShowWhatsAppPanel] = useState(false);
  const [receiverName, setReceiverName] = useState('');
  const [receiverPhone, setReceiverPhone] = useState('');
  const [dispatchLocale, setDispatchLocale] = useState<'ar' | 'fr' | 'es'>('ar');
  const [forceBypassCooldown, setForceBypassCooldown] = useState(false);

  const handlePrint = () => {
    if (!htmlContent) return;
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
      }, 350);
    }
  };

  const handleDownloadHtml = () => {
    if (!htmlContent) return;
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${certificateNumber || 'GDP-Certificate'}-${compartmentCode}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleSendWhatsApp = () => {
    if (!compartmentId || !trailerId) {
      toast({
        title: tDispatch('title'),
        description: 'بيانات الحجرة أو المقطورة غير مكتملة للإرسال',
        variant: 'destructive',
      });
      return;
    }

    if (!receiverPhone || receiverPhone.trim().length < 8) {
      toast({
        title: tDispatch('title'),
        description: tDispatch('receiverPhone') + ' غير صحيح',
        variant: 'destructive',
      });
      return;
    }

    startTransition(async () => {
      const res = await dispatchCompartmentReceiverWhatsAppAction({
        compartmentId,
        trailerId,
        tripId,
        receiverName: receiverName.trim() || `مستلم شحنة الحجرة ${compartmentCode}`,
        receiverPhone: receiverPhone.trim(),
        locale: dispatchLocale,
        forceBypassCooldown,
        isGeofenceTriggered: false,
      });

      if (res.success) {
        if (res.skippedCooldown) {
          toast({
            title: tDispatch('title'),
            description: tDispatch('cooldownNotice'),
            variant: 'default',
          });
        } else {
          toast({
            title: tDispatch('title'),
            description: tDispatch('success'),
          });
          setShowWhatsAppPanel(false);
        }
      } else {
        toast({
          title: tDispatch('title'),
          description: res.error || 'فشل إرسال رسالة WhatsApp للمستلم',
          variant: 'destructive',
        });
      }
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[850px] max-h-[92vh] bg-slate-900 text-white border-slate-800 flex flex-col p-6 overflow-hidden">
        <DialogHeader className="pb-3 border-b border-slate-800 flex flex-row items-center justify-between">
          <div className="space-y-1">
            <DialogTitle className="flex items-center gap-2 text-cyan-400 text-xl font-bold">
              <FileCheck2 className="w-5 h-5 text-cyan-400" />
              {t('title')} — {compartmentCode}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-400">
              {t('subtitle')}
            </DialogDescription>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => setShowWhatsAppPanel(!showWhatsAppPanel)}
              className={`${
                showWhatsAppPanel
                  ? 'bg-emerald-700 text-white'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white'
              } gap-1.5 text-xs h-8 shadow-md`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              {tDispatch('buttonSend')}
            </Button>
            <Button
              size="sm"
              onClick={handlePrint}
              className="bg-cyan-600 hover:bg-cyan-500 text-white gap-1.5 text-xs h-8"
            >
              <Printer className="w-3.5 h-3.5" />
              {t('print')}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleDownloadHtml}
              className="border-slate-700 text-slate-200 hover:bg-slate-800 gap-1.5 text-xs h-8"
            >
              <Download className="w-3.5 h-3.5" />
              {t('download')}
            </Button>
          </div>
        </DialogHeader>

        {/* Certificate Metadata Bar */}
        <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 my-2 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div>
            <span className="text-slate-400">{t('certNumber')}: </span>
            <span className="font-mono font-bold text-cyan-300">{certificateNumber}</span>
          </div>

          {verificationHash && (
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-mono">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>HMAC: {verificationHash.substring(0, 16)}...</span>
            </div>
          )}
        </div>

        {/* Targeted Receiver WhatsApp Dispatch Form Panel */}
        {showWhatsAppPanel && (
          <div className="p-4 bg-emerald-950/30 border border-emerald-500/40 rounded-xl space-y-3 mb-2 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold">
                <Send className="w-4 h-4" />
                <span>{tDispatch('title')}</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowWhatsAppPanel(false)}
                className="h-6 w-6 p-0 text-slate-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div className="space-y-1">
                <label className="text-slate-300 flex items-center gap-1.5 font-medium">
                  <User className="w-3.5 h-3.5 text-cyan-400" />
                  {tDispatch('receiverName')}
                </label>
                <Input
                  value={receiverName}
                  onChange={(e) => setReceiverName(e.target.value)}
                  placeholder={`مستلم شحنة الحجرة ${compartmentCode}`}
                  className="bg-slate-900 border-slate-700 text-white text-xs h-8"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-300 flex items-center gap-1.5 font-medium">
                  <Phone className="w-3.5 h-3.5 text-emerald-400" />
                  {tDispatch('receiverPhone')} *
                </label>
                <Input
                  value={receiverPhone}
                  onChange={(e) => setReceiverPhone(e.target.value)}
                  placeholder="+2126XXXXXXXX / +346XXXXXXXX"
                  className="bg-slate-900 border-slate-700 text-white text-xs h-8 font-mono"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1 text-xs">
              {/* Language selection */}
              <div className="flex items-center gap-2">
                <span className="text-slate-400 text-[11px]">اللغة / Langue:</span>
                <div className="flex gap-1">
                  {(['ar', 'fr', 'es'] as const).map((lang) => (
                    <Button
                      key={lang}
                      type="button"
                      size="sm"
                      variant={dispatchLocale === lang ? 'default' : 'outline'}
                      onClick={() => setDispatchLocale(lang)}
                      className={`h-6 text-[10px] px-2 py-0 ${
                        dispatchLocale === lang
                          ? 'bg-emerald-600 text-white'
                          : 'border-slate-700 text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      {lang.toUpperCase()}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Force bypass cooldown toggle */}
              <label className="flex items-center gap-2 cursor-pointer text-[11px] text-slate-400 select-none">
                <input
                  type="checkbox"
                  checked={forceBypassCooldown}
                  onChange={(e) => setForceBypassCooldown(e.target.checked)}
                  className="rounded border-slate-700 text-emerald-600 focus:ring-0"
                />
                <span>{tDispatch('bypassCooldown')}</span>
              </label>

              {/* Action Button */}
              <Button
                size="sm"
                onClick={handleSendWhatsApp}
                disabled={isPending}
                className="bg-emerald-600 hover:bg-emerald-500 text-white gap-1.5 text-xs h-8 ms-auto shadow-md"
              >
                <Send className="w-3.5 h-3.5" />
                {isPending ? tDispatch('sending') : tDispatch('buttonSend')}
              </Button>
            </div>
          </div>
        )}

        {/* Preview Frame */}
        <div className="flex-1 overflow-auto rounded-lg border border-slate-800 bg-white">
          {htmlContent ? (
            <iframe
              srcDoc={htmlContent}
              title="GDP Certificate Preview"
              className="w-full h-[52vh] border-0"
            />
          ) : (
            <div className="p-12 text-center text-slate-500">
              {t('generating')}
            </div>
          )}
        </div>

        <div className="pt-3 border-t border-slate-800 flex justify-between items-center text-xs text-slate-400">
          <span>{t('customsNotice')}</span>
          <Button variant="ghost" size="sm" onClick={onClose} className="text-slate-400 hover:text-white">
            {t('close')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
