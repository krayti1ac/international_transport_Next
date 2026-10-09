'use client';

/**
 * Trans Bodanon TMS — Multi-Compartment Independent GDP Certificate Modal
 * Standards: EN 12830 / ATP Treaty (FRC / FRA) / EU GDP 2013/C 343/01
 */

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  CheckCircle2,
  Download,
  FileCheck2,
  Printer,
  QrCode,
  ShieldCheck,
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
import { Badge } from '@/components/ui/badge';

interface MultiTempCertificateModalProps {
  isOpen: boolean;
  onClose: () => void;
  certificateNumber?: string;
  compartmentCode?: string;
  htmlContent?: string;
  verificationHash?: string;
  verificationUrl?: string;
}

export function MultiTempCertificateModal({
  isOpen,
  onClose,
  certificateNumber,
  compartmentCode,
  htmlContent,
  verificationHash,
  verificationUrl,
}: MultiTempCertificateModalProps) {
  const t = useTranslations('reefer.multiTempCertificate');

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
    link.download = `${certificateNumber || 'GDP-Certificate'}-${compartmentCode || 'C1'}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[850px] max-h-[90vh] bg-slate-900 text-white border-slate-800 flex flex-col p-6 overflow-hidden">
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

        {/* Preview Frame */}
        <div className="flex-1 overflow-auto rounded-lg border border-slate-800 bg-white">
          {htmlContent ? (
            <iframe
              srcDoc={htmlContent}
              title="GDP Certificate Preview"
              className="w-full h-[55vh] border-0"
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

