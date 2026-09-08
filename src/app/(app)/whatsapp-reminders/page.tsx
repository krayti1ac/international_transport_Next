'use client';

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { RefreshCw, Send, Phone, FileText, Clock, ExternalLink } from 'lucide-react';
import { CardViewToggle, useCardViewMode } from '@/components/ui/card-view-toggle';
import { useLanguage } from '@/components/language-provider';

interface ReminderLink {
  invoiceId: number;
  invoiceNumber: string;
  clientId: number;
  clientName: string;
  clientPhone: string;
  amount: string;
  currency: string;
  dueDate?: string;
  message: string;
  waMeLink: string;
  daysOverdue: number;
}

export default function WhatsAppRemindersScreen() {
  const { t, dir } = useLanguage();
  const [reminders, setReminders] = useState<ReminderLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [cardLayout, setCardLayout] = useCardViewMode('whatsapp_reminders', 'grid');
  const { toast } = useToast();

  useEffect(() => {
    fetchReminders();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional empty deps for mount-only fetch
  }, []);

  async function fetchReminders() {
    setLoading(true);
    try {
      const res = await fetch('/api/whatsapp-reminders', { cache: 'no-store' });
      if (!res.ok) throw new Error(t('فشل في تحميل التذكيرات', 'Échec du chargement des rappels'));
      const data = (await res.json()) as ReminderLink[];
      setReminders(data);
    } catch (error) {
      const message = error instanceof Error ? error.message : t('خطأ غير معروف', 'Erreur inconnue');
      toast({ title: t('خطأ', 'Erreur'), description: message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }

  const filteredReminders = useMemo(() => {
    if (!filter) return reminders;
    const q = filter.toLowerCase();
    return reminders.filter(
      (r) =>
        r.clientName.toLowerCase().includes(q) ||
        r.invoiceNumber.toLowerCase().includes(q) ||
        r.amount.includes(q)
    );
  }, [reminders, filter]);

  const statusBadge = () =>
    'bg-orange-500/15 text-orange-700 dark:text-orange-300 border border-orange-500/25';

  return (
    <div className="space-y-6" dir={dir}>
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold font-amiri text-foreground flex items-center gap-2">
            <Send className="w-6 h-6 text-primary" />
            {t('تذكيرات واتساب - فواتير متأخرة', 'Rappels WhatsApp - Factures en retard')}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {t(
              'توليد روابط واتساب لتذكير العملاء بالفواتير المتأخرة',
              'Génération de liens WhatsApp pour rappeler les factures échues aux clients'
            )}
          </p>
        </div>
        <Button onClick={fetchReminders} variant="outline" disabled={loading}>
          <RefreshCw className={`w-4 h-4 ms-2 ${loading ? 'animate-spin' : ''}`} />
          {t('تحديث', 'Actualiser')}
        </Button>
      </div>

      <Card>
        <CardContent className="p-3">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            <div className="relative flex-1">
              <Input
                placeholder={t('بحث باسم العميل أو رقم الفاتورة...', 'Rechercher par client ou n° de facture...')}
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="pe-9 h-9 text-xs rounded-xl"
              />
              <FileText className="absolute end-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            </div>
            <CardViewToggle
              viewMode={cardLayout}
              onChange={setCardLayout}
              gridLabel={t('عرض كبطاقات', 'Vue cartes')}
              listLabel={t('عرض كقائمة', 'Vue liste')}
            />
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="text-center py-16">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">{t('جاري تحميل التذكيرات...', 'Chargement des rappels...')}</p>
        </div>
      ) : reminders.length === 0 ? (
        <Card>
          <CardContent className="text-center py-16">
            <Send className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">{t('لا توجد فواتير متأخرة حالياً', 'Aucune facture en retard actuellement')}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {t('ستظهر التذكيرات هنا عند وجود فواتير متأخرة', 'Les rappels apparaîtront ici dès qu’une facture sera échue')}
            </p>
          </CardContent>
        </Card>
      ) : cardLayout === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredReminders.map((reminder) => (
            <Card key={reminder.invoiceId} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-amiri flex items-center gap-2 text-foreground">
                    <FileText className="w-4 h-4 text-primary" />
                    {reminder.invoiceNumber}
                  </CardTitle>
                  <Badge className={statusBadge()}>
                    <Clock className="w-3 h-3 ms-1" />
                    {t(`متأخرة (${reminder.daysOverdue} يوم)`, `En retard (${reminder.daysOverdue} j)`)}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="w-4 h-4 text-muted-foreground" />
                  <span className="font-medium text-foreground">{reminder.clientName}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{t('المبلغ المستحق:', 'Montant dû :')}</span>
                  <span className="font-bold font-mono text-primary">{reminder.amount} {reminder.currency}</span>
                </div>
                {reminder.dueDate && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{t('تاريخ الاستحقاق:', 'Date d’échéance :')}</span>
                    <span className="font-medium text-foreground">
                      {new Date(reminder.dueDate).toLocaleDateString('fr-FR')}
                    </span>
                  </div>
                )}
                <div className="pt-2 border-t border-border">
                  <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
                    {decodeURIComponent(reminder.message).substring(0, 120)}...
                  </p>
                  <a
                    href={reminder.waMeLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full h-10 px-4 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    <Send className="w-4 h-4" />
                    {t('إرسال تذكير عبر واتساب', 'Envoyer rappel via WhatsApp')}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        /* List View Cards */
        <div className="flex flex-col gap-3">
          {filteredReminders.map((reminder) => (
            <Card key={reminder.invoiceId} className="hover:shadow-md transition-shadow overflow-hidden">
              <div className="p-3.5 flex flex-col lg:flex-row lg:items-center justify-between gap-3.5">
                {/* Right: Invoice # & Client */}
                <div className="flex items-center gap-3 min-w-[200px]">
                  <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div>
                    <CardTitle className="text-sm font-amiri font-bold text-foreground">
                      {reminder.invoiceNumber}
                    </CardTitle>
                    <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <Phone className="w-3 h-3 text-muted-foreground" />
                      {reminder.clientName}
                    </span>
                  </div>
                </div>

                {/* Middle: Amount & Overdue info */}
                <div className="flex flex-wrap items-center gap-3 text-xs">
                  <div className="bg-muted/30 px-3 py-1.5 rounded-xl border border-border/40 flex items-center gap-1.5">
                    <span className="text-muted-foreground">{t('المبلغ:', 'Montant :')}</span>
                    <span className="font-bold font-mono text-primary text-sm">{reminder.amount} {reminder.currency}</span>
                  </div>

                  <Badge className={statusBadge()}>
                    <Clock className="w-3 h-3 ms-1" />
                    {t(`متأخرة (${reminder.daysOverdue} يوم)`, `En retard (${reminder.daysOverdue} j)`)}
                  </Badge>

                  {reminder.dueDate && (
                    <span className="text-muted-foreground text-[11px]">
                      {t('تاريخ الاستحقاق:', 'Date d’échéance :')} {new Date(reminder.dueDate).toLocaleDateString('fr-FR')}
                    </span>
                  )}
                </div>

                {/* Action Button */}
                <div className="flex items-center justify-end border-t lg:border-t-0 pt-2.5 lg:pt-0 border-border/40">
                  <a
                    href={reminder.waMeLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 h-9 px-3.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs font-semibold transition-colors"
                  >
                    <Send className="w-3.5 h-3.5" />
                    {t('إرسال تذكير واتساب', 'Envoyer rappel WhatsApp')}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
