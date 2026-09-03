'use client';

import { useState, useEffect } from 'react';
import { getDocumentRenewalHistory } from '@/features/fleet/services/fleet-documents.actions';
import { DOCUMENT_TYPE_LABELS } from '@/features/fleet/services/fleet-documents.constants';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Clock, FileText, Calendar, DollarSign, ArrowRight, Receipt } from 'lucide-react';
import { MatriculeBadge } from '@/components/ui/matricule-badge';
import type { FleetDocument, FleetDocumentRenewal } from '@/types/database';

interface RenewalHistoryModalProps {
  document: FleetDocument | null;
  isOpen: boolean;
  onClose: () => void;
}

export function RenewalHistoryModal({ document, isOpen, onClose }: RenewalHistoryModalProps) {
  const [renewals, setRenewals] = useState<FleetDocumentRenewal[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && document?.id) {
      setLoading(true);
      getDocumentRenewalHistory(document.id)
        .then((res) => {
          if (res.success && res.data) {
            setRenewals(res.data);
          } else {
            setRenewals([]);
          }
        })
        .finally(() => setLoading(false));
    }
  }, [isOpen, document]);

  if (!document) return null;

  const docLabelAr = DOCUMENT_TYPE_LABELS[document.document_type]?.label_ar || document.document_type;
  const vehicleName = document.truck?.plate_number || document.trailer?.plate_number || `مركبة #${document.entity_id}`;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wide mb-1">
            <Clock className="w-4 h-4 text-blue-500" />
            <span>سجل التدقيق التاريخي للوثائق (Audit Trail)</span>
          </div>
          <DialogTitle className="font-amiri text-xl">
            سجل تجديدات: {docLabelAr}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap mt-1">
            <span>المركبة:</span>
            <MatriculeBadge plate={vehicleName} variant="badge" size="xs" />
            <span>—</span>
            <span>
              تاريخ الانتهاء الحالي:{' '}
              <span className="font-semibold text-foreground font-mono">
                {document.expiry_date ? new Date(document.expiry_date).toLocaleDateString('fr-MA') : 'غير محدد'}
              </span>
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="py-3">
          {loading ? (
            <div className="text-center py-10">
              <p className="text-xs text-muted-foreground animate-pulse">جاري تحميل السجل المالي للتجديدات...</p>
            </div>
          ) : renewals.length === 0 ? (
            <div className="text-center py-10 bg-muted/20 border border-dashed border-border rounded-2xl">
              <FileText className="w-10 h-10 text-muted-foreground/50 mx-auto mb-2" />
              <p className="text-sm font-medium text-foreground">لا توجد عمليات تجديد مسجلة لهذه الوثيقة</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                عمليات التجديد المستقبلية ستسجل هنا تلقائياً مع تكاليفها وتواريخها.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {renewals.map((renewal, index) => {
                const prevDate = renewal.previous_expiry_date
                  ? new Date(renewal.previous_expiry_date).toLocaleDateString('fr-MA')
                  : 'البداية';
                const newDate = renewal.new_expiry_date
                  ? new Date(renewal.new_expiry_date).toLocaleDateString('fr-MA')
                  : 'غير محدد';
                const actionDate = renewal.created_at
                  ? new Date(renewal.created_at).toLocaleDateString('ar-MA', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : '';

                const renewalCost = renewal.renewal_cost ?? renewal.cost ?? 0;

                return (
                  <div
                    key={renewal.id || index}
                    className="border border-border/80 rounded-xl p-4 bg-card hover:bg-muted/30 transition-all shadow-xs space-y-2.5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/40 pb-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[11px] font-mono">
                          تجديد #{renewals.length - index}
                        </Badge>
                        <span className="text-xs text-muted-foreground font-mono">{actionDate}</span>
                      </div>
                      {renewalCost > 0 && (
                        <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 font-mono bg-emerald-500/10 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                          <Receipt className="w-3 h-3" />
                          {renewalCost.toLocaleString()} {renewal.currency || 'MAD'}
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-2 gap-3 text-xs">
                      <div className="bg-muted/30 p-2 rounded-lg">
                        <span className="text-[11px] text-muted-foreground block mb-0.5">الصلاحية السابقة</span>
                        <span className="font-semibold text-foreground font-mono">{prevDate}</span>
                      </div>
                      <div className="bg-emerald-500/10 p-2 rounded-lg border border-emerald-500/20">
                        <span className="text-[11px] text-emerald-700 dark:text-emerald-300 block mb-0.5">الصلاحية الجديدة</span>
                        <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono">{newDate}</span>
                      </div>
                    </div>

                    {renewal.notes && (
                      <p className="text-xs text-muted-foreground bg-muted/20 p-2 rounded-lg italic">
                        {renewal.notes}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex justify-end pt-2 border-t border-border/50">
          <Button variant="outline" onClick={onClose} className="rounded-xl text-xs">
            إغلاق
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
