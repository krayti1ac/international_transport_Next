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
import { useLanguage } from '@/components/language-provider';

interface RenewalHistoryModalProps {
  document: FleetDocument | null;
  isOpen: boolean;
  onClose: () => void;
}

export function RenewalHistoryModal({ document, isOpen, onClose }: RenewalHistoryModalProps) {
  const { locale, dir, t } = useLanguage();
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

  const docLabel =
    locale === 'fr'
      ? DOCUMENT_TYPE_LABELS[document.document_type]?.label_fr || document.document_type
      : DOCUMENT_TYPE_LABELS[document.document_type]?.label_ar || document.document_type;
  const vehicleName = document.truck?.plate_number || document.trailer?.plate_number || `${t('مركبة', 'Véhicule')} #${document.entity_id}`;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto" dir={dir}>
        <DialogHeader>
          <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wide mb-1">
            <Clock className="w-4 h-4 text-blue-500" />
            <span>{t('سجل التدقيق التاريخي للوثائق (Audit Trail)', 'Historique des renouvellements (Audit)')}</span>
          </div>
          <DialogTitle className="font-amiri text-xl">
            {t('سجل تجديدات: ', 'Historique des renouvellements : ')}{docLabel}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap mt-1">
            <span>{t('المركبة:', 'Véhicule :')}</span>
            <MatriculeBadge plate={vehicleName} variant="badge" size="xs" />
            <span>—</span>
            <span>
              {t('تاريخ الانتهاء الحالي: ', 'Expiration actuelle : ')}{' '}
              <span className="font-semibold text-foreground font-mono">
                {document.expiry_date ? new Date(document.expiry_date).toLocaleDateString('fr-MA') : (locale === 'fr' ? 'Non défini' : 'غير محدد')}
              </span>
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="py-3">
          {loading ? (
            <div className="text-center py-10">
              <p className="text-xs text-muted-foreground animate-pulse">
                {t('جاري تحميل السجل المالي للتجديدات...', "Chargement de l'historique...")}
              </p>
            </div>
          ) : renewals.length === 0 ? (
            <div className="text-center py-10 bg-muted/20 border border-dashed border-border rounded-2xl">
              <FileText className="w-10 h-10 text-muted-foreground/50 mx-auto mb-2" />
              <p className="text-sm font-medium text-foreground">
                {t('لا توجد عمليات تجديد مسجلة لهذه الوثيقة', 'Aucun renouvellement enregistré pour ce document')}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t('عمليات التجديد المستقبلية ستسجل هنا تلقائياً مع تكاليفها وتواريخها.', 'Les prochains renouvellements apparaîtront ici avec leurs montants et dates.')}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {renewals.map((renewal, index) => {
                const prevDate = renewal.previous_expiry_date
                  ? new Date(renewal.previous_expiry_date).toLocaleDateString('fr-MA')
                  : (locale === 'fr' ? 'Départ' : 'البداية');
                const newDate = renewal.new_expiry_date
                  ? new Date(renewal.new_expiry_date).toLocaleDateString('fr-MA')
                  : (locale === 'fr' ? 'Non défini' : 'غير محدد');
                const actionDate = renewal.created_at
                  ? new Date(renewal.created_at).toLocaleDateString(locale === 'fr' ? 'fr-MA' : 'ar-MA', {
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
                          {t('تجديد #', 'Renouvellement #')}{renewals.length - index}
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
                        <span className="text-[11px] text-muted-foreground block mb-0.5">
                          {t('الصلاحية السابقة', 'Validité précédente')}
                        </span>
                        <span className="font-semibold text-foreground font-mono">{prevDate}</span>
                      </div>
                      <div className="bg-emerald-500/10 p-2 rounded-lg border border-emerald-500/20">
                        <span className="text-[11px] text-emerald-700 dark:text-emerald-300 block mb-0.5">
                          {t('الصلاحية الجديدة', 'Nouvelle validité')}
                        </span>
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
            {t('إغلاق', 'Fermer')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
