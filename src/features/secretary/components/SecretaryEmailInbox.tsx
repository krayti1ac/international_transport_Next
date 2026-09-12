'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useLanguage } from '@/components/language-provider';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/browser';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Inbox,
  Send,
  Mail,
  MailOpen,
  Search,
  RefreshCw,
  Plus,
  Paperclip,
  Truck,
  CheckCircle2,
  Clock,
  Reply,
  X,
  Loader2,
  ExternalLink,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react';
import { useEmailMessages, emailKeys } from '../services/email.queries';
import {
  sendSecretaryEmailAction,
  markEmailAsReadAction,
  linkEmailToTripAction,
} from '../services/email.actions';
import type { EmailMessage } from '../types/email.types';

export function SecretaryEmailInbox() {
  const { t, dir, locale } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<'all' | 'inbound' | 'outbound' | 'unread' | 'trip'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMessage, setSelectedMessage] = useState<EmailMessage | null>(null);

  // Compose / Reply modal state
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [composeTo, setComposeTo] = useState('');
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [composeTripId, setComposeTripId] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Data Query
  const { data: messages = [], isLoading, isRefetching, refetch } = useEmailMessages();

  // Supabase Realtime Listener
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel('realtime:secretary-inbox')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'email_messages' },
        (payload) => {
          queryClient.invalidateQueries({ queryKey: emailKeys.all });

          if (payload.eventType === 'INSERT') {
            const newMsg = payload.new as EmailMessage;
            if (newMsg.direction === 'inbound') {
              toast({
                title: t('📧 وصول بريد إلكتروني جديد!', '📧 Nouvel email reçu !'),
                description: `${newMsg.sender_name || newMsg.sender_email}: ${newMsg.subject || ''}`,
              });
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, t, toast]);

  // Derived Filtered Messages
  const filteredMessages = useMemo(() => {
    return messages.filter((msg) => {
      // Tab filter
      if (activeTab === 'inbound' && msg.direction !== 'inbound') return false;
      if (activeTab === 'outbound' && msg.direction !== 'outbound') return false;
      if (activeTab === 'unread' && msg.is_read) return false;
      if (activeTab === 'trip' && !msg.trip_id) return false;

      // Search term
      if (searchTerm.trim()) {
        const s = searchTerm.toLowerCase();
        const matchesSubject = msg.subject?.toLowerCase().includes(s);
        const matchesSender = msg.sender_email.toLowerCase().includes(s) || (msg.sender_name && msg.sender_name.toLowerCase().includes(s));
        const matchesRecipient = msg.recipient_email.toLowerCase().includes(s);
        const matchesBody = msg.body_text?.toLowerCase().includes(s);
        const matchesTrip = msg.trip?.cmr_number?.toLowerCase().includes(s) || String(msg.trip_id || '').includes(s);
        return matchesSubject || matchesSender || matchesRecipient || matchesBody || matchesTrip;
      }

      return true;
    });
  }, [messages, activeTab, searchTerm]);

  // Statistics
  const stats = useMemo(() => {
    const unread = messages.filter((m) => m.direction === 'inbound' && !m.is_read).length;
    const inbound = messages.filter((m) => m.direction === 'inbound').length;
    const outbound = messages.filter((m) => m.direction === 'outbound').length;
    const linkedTrips = messages.filter((m) => !!m.trip_id).length;
    return { unread, inbound, outbound, linkedTrips };
  }, [messages]);

  // Handle Mark as Read/Unread
  const handleToggleRead = async (msg: EmailMessage, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      const nextState = !msg.is_read;
      const res = await markEmailAsReadAction(msg.id, nextState);
      if (res.success) {
        queryClient.invalidateQueries({ queryKey: emailKeys.all });
        if (selectedMessage?.id === msg.id) {
          setSelectedMessage({ ...selectedMessage, is_read: nextState });
        }
      }
    } catch {
      toast({
        title: t('خطأ', 'Erreur'),
        description: t('تعذر تحديث حالة الرسالة', 'Impossible de mettre à jour le statut'),
        variant: 'destructive',
      });
    }
  };

  // Open Message Details
  const handleOpenMessage = (msg: EmailMessage) => {
    setSelectedMessage(msg);
    if (!msg.is_read && msg.direction === 'inbound') {
      handleToggleRead(msg);
    }
  };

  // Handle Quick Reply
  const handleStartReply = (msg: EmailMessage) => {
    setComposeTo(msg.direction === 'inbound' ? msg.sender_email : msg.recipient_email);
    setComposeSubject(msg.subject?.startsWith('Re:') ? msg.subject : `Re: ${msg.subject || ''}`);
    setComposeTripId(msg.trip_id ? String(msg.trip_id) : '');
    setComposeBody(`\n\n--- رد على الرسالة السابقة (${msg.sender_email}) ---\n${msg.body_text || ''}`);
    setIsComposeOpen(true);
  };

  // Handle Open New Compose
  const handleOpenNewCompose = () => {
    setComposeTo('');
    setComposeSubject('');
    setComposeBody('');
    setComposeTripId('');
    setIsComposeOpen(true);
  };

  // Handle Send Email Submit
  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!composeTo.trim() || !composeSubject.trim() || !composeBody.trim()) {
      toast({
        title: t('بيانات ناقصة', 'Champs requis'),
        description: t('يرجى ملء كافة الحقول الإلزامية', 'Veuillez remplir tous les champs obligatoires'),
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const parsedTripId = composeTripId.trim() ? parseInt(composeTripId.trim(), 10) : null;
      const res = await sendSecretaryEmailAction({
        to: composeTo.trim(),
        subject: composeSubject.trim(),
        body: composeBody.trim(),
        tripId: isNaN(Number(parsedTripId)) ? null : parsedTripId,
      });

      if (res.success) {
        toast({
          title: t('تم الإرسال بنجاح', 'Email envoyé'),
          description: res.safeRedirected
            ? t('تم إرسال البريد بنجاح (وضع التجربة - موجه للإدارة)', 'Email envoyé (mode test - redirigé)')
            : t('تم إرسال الرسالة عبر خادم دومين الشركة بنجاح', 'Email envoyé via le serveur SMTP du domaine'),
        });
        setIsComposeOpen(false);
        queryClient.invalidateQueries({ queryKey: emailKeys.all });
      } else {
        toast({
          title: t('فشل الإرسال', "Échec de l'envoi"),
          description: res.error || t('تعذر الاتصال بسيرفر البريد', 'Erreur de connexion SMTP'),
          variant: 'destructive',
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'خطأ غير متوقع';
      toast({
        title: t('خطأ', 'Erreur'),
        description: msg,
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDate = (isoString: string) => {
    try {
      return new Date(isoString).toLocaleString(locale === 'ar' ? 'ar-MA' : 'fr-FR', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  return (
    <Card className="border-border/60 shadow-sm overflow-hidden bg-card">
      <CardHeader className="p-4 sm:p-5 border-b border-border/40 bg-muted/20">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <Inbox className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-base sm:text-lg font-bold">
                  {t('صندوق المراسلات الذكي', 'Boîte de Messagerie Opérationnelle')}
                </CardTitle>
                <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10">
                  <ShieldCheck className="w-3 h-3 me-1" />
                  {t('خادم الدومين المستقل 100%', 'Serveur Dédié 100%')}
                </Badge>
                {stats.unread > 0 && (
                  <Badge className="bg-destructive text-destructive-foreground text-[10px] px-1.5 py-0.5">
                    {stats.unread} {t('جديد', 'Nouveau')}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t(
                  'إرسال واستقبال الوثائق وتتبع استفسارات العملاء والرحلات عبر دومين الشركة',
                  'Échange d’emails avec les clients et chauffeurs directement lié aux dossiers de transport'
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isRefetching || isLoading}
              className="h-9 text-xs rounded-xl border-border"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefetching ? 'animate-spin' : ''} ${dir === 'rtl' ? 'ms-1.5' : 'me-1.5'}`} />
              {t('تحديث', 'Actualiser')}
            </Button>
            <Button
              size="sm"
              onClick={handleOpenNewCompose}
              className="h-9 text-xs rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-sm"
            >
              <Plus className={`w-3.5 h-3.5 ${dir === 'rtl' ? 'ms-1.5' : 'me-1.5'}`} />
              {t('رسالة جديدة', 'Nouveau Message')}
            </Button>
          </div>
        </div>

        {/* Stats & Search Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-3">
          {/* Tabs Filter */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            <Button
              variant={activeTab === 'all' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab('all')}
              className="h-8 text-xs rounded-lg font-medium"
            >
              {t('الكل', 'Tous')} ({messages.length})
            </Button>
            <Button
              variant={activeTab === 'inbound' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab('inbound')}
              className="h-8 text-xs rounded-lg font-medium"
            >
              <Inbox className="w-3.5 h-3.5 me-1 text-emerald-500" />
              {t('الوارد', 'Reçus')} ({stats.inbound})
            </Button>
            <Button
              variant={activeTab === 'outbound' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab('outbound')}
              className="h-8 text-xs rounded-lg font-medium"
            >
              <Send className="w-3.5 h-3.5 me-1 text-sky-500" />
              {t('الصادر', 'Envoyés')} ({stats.outbound})
            </Button>
            <Button
              variant={activeTab === 'unread' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab('unread')}
              className="h-8 text-xs rounded-lg font-medium"
            >
              <Mail className="w-3.5 h-3.5 me-1 text-amber-500" />
              {t('غير المقروء', 'Non lus')} ({stats.unread})
            </Button>
            <Button
              variant={activeTab === 'trip' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab('trip')}
              className="h-8 text-xs rounded-lg font-medium"
            >
              <Truck className="w-3.5 h-3.5 me-1 text-purple-500" />
              {t('مرتبطة برحلات', 'Liés aux Trajets')} ({stats.linkedTrips})
            </Button>
          </div>

          {/* Search Box */}
          <div className="relative w-full md:w-64">
            <Search className="w-3.5 h-3.5 absolute top-1/2 -translate-y-1/2 start-3 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={t('بحث بالموضوع، المرسل، أو رقم الرحلة...', 'Recherche...')}
              className="ps-9 h-8 text-xs rounded-xl bg-background border-border/80"
            />
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center p-12 text-muted-foreground gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
            <p className="text-xs">{t('جاري مزامنة الرسائل من خادم الشركة...', 'Synchronisation en cours...')}</p>
          </div>
        ) : filteredMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-muted-foreground text-center">
            <Inbox className="w-12 h-12 text-muted-foreground/30 mb-2" />
            <p className="text-sm font-semibold text-foreground">
              {t('لا توجد رسائل مطابقة حالياً', 'Aucun message trouvé')}
            </p>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm">
              {t(
                'يقوم خادم النظام بسحب الرسائل الواردة تلقائياً كل 5 دقائق عبر IMAP، كما يمكنك إرسال بريد جديد فوراً.',
                'Le système récupère les emails toutes les 5 minutes via IMAP. Vous pouvez envoyer un nouvel email.'
              )}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border/40 max-h-[520px] overflow-y-auto">
            {filteredMessages.map((msg) => {
              const isInbound = msg.direction === 'inbound';
              const isUnread = isInbound && !msg.is_read;

              return (
                <div
                  key={msg.id}
                  onClick={() => handleOpenMessage(msg)}
                  className={`flex flex-col sm:flex-row sm:items-center justify-between p-3.5 sm:px-5 gap-3 cursor-pointer transition-colors hover:bg-muted/40 ${
                    isUnread ? 'bg-primary/5 font-medium' : ''
                  }`}
                >
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    {/* Direction Icon & Unread Dot */}
                    <div className="relative pt-0.5 shrink-0">
                      {isInbound ? (
                        <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                          <Inbox className="w-3.5 h-3.5" />
                        </div>
                      ) : (
                        <div className="w-7 h-7 rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center">
                          <Send className="w-3.5 h-3.5" />
                        </div>
                      )}
                      {isUnread && (
                        <span className="absolute -top-1 -start-1 w-2.5 h-2.5 rounded-full bg-primary ring-2 ring-background" />
                      )}
                    </div>

                    {/* Sender, Subject, Snippet */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <span className="text-xs font-semibold text-foreground truncate max-w-[200px]">
                          {isInbound
                            ? msg.sender_name || msg.sender_email
                            : `${t('إلى:', 'À:')} ${msg.recipient_email}`}
                        </span>

                        {msg.trip && (
                          <Badge
                            variant="outline"
                            className="text-[10px] px-1.5 py-0 border-purple-500/30 text-purple-600 dark:text-purple-400 bg-purple-500/10 flex items-center gap-1"
                          >
                            <Truck className="w-2.5 h-2.5" />
                            {msg.trip.cmr_number ? `#${msg.trip.cmr_number}` : `#رحلة-${msg.trip.id}`}
                          </Badge>
                        )}

                        {msg.attachments && msg.attachments.length > 0 && (
                          <span className="flex items-center text-[10px] text-muted-foreground gap-0.5">
                            <Paperclip className="w-3 h-3" />
                            {msg.attachments.length}
                          </span>
                        )}
                      </div>

                      <h4
                        className={`text-xs truncate ${
                          isUnread ? 'font-bold text-foreground' : 'text-foreground/90'
                        }`}
                      >
                        {msg.subject || t('(بدون موضوع)', '(Sans objet)')}
                      </h4>

                      <p className="text-[11px] text-muted-foreground truncate mt-0.5 line-clamp-1">
                        {msg.body_text || msg.body_html?.replace(/<[^>]+>/g, '') || ''}
                      </p>
                    </div>
                  </div>

                  {/* Actions & Timestamp */}
                  <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-border/30">
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatDate(msg.created_at)}
                    </span>

                    <div className="flex items-center gap-1">
                      {isInbound && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="w-7 h-7 rounded-lg text-muted-foreground hover:text-foreground"
                          title={msg.is_read ? t('تحديد كغير مقروء', 'Marquer non lu') : t('تحديد كمقروء', 'Marquer lu')}
                          onClick={(e) => handleToggleRead(msg, e)}
                        >
                          {msg.is_read ? <Mail className="w-3.5 h-3.5" /> : <MailOpen className="w-3.5 h-3.5" />}
                        </Button>
                      )}

                      <Button
                        variant="ghost"
                        size="icon"
                        className="w-7 h-7 rounded-lg text-muted-foreground hover:text-primary"
                        title={t('رد سريع', 'Répondre')}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStartReply(msg);
                        }}
                      >
                        <Reply className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      {/* Message View Modal */}
      {selectedMessage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <div
            className="w-full max-w-2xl bg-card border border-border rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95"
            dir={dir}
          >
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-border flex items-start justify-between gap-3 bg-muted/20">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <Badge
                    variant="outline"
                    className={`text-[10px] ${
                      selectedMessage.direction === 'inbound'
                        ? 'border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10'
                        : 'border-sky-500/30 text-sky-600 dark:text-sky-400 bg-sky-500/10'
                    }`}
                  >
                    {selectedMessage.direction === 'inbound'
                      ? t('بريد وارد 📥', 'Email Reçu 📥')
                      : t('بريد صادر 📤', 'Email Envoyé 📤')}
                  </Badge>

                  {selectedMessage.trip && (
                    <Badge variant="outline" className="text-[10px] border-purple-500/30 text-purple-600 dark:text-purple-400 bg-purple-500/10">
                      <Truck className="w-2.5 h-2.5 me-1" />
                      {t('مرتبط بالرحلة:', 'Lié au trajet :')} #{selectedMessage.trip.cmr_number || selectedMessage.trip.id}
                      {selectedMessage.trip.route && ` (${selectedMessage.trip.route})`}
                    </Badge>
                  )}
                </div>

                <h3 className="text-base font-bold text-foreground">
                  {selectedMessage.subject || t('(بدون موضوع)', '(Sans objet)')}
                </h3>
              </div>

              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSelectedMessage(null)}
                className="w-8 h-8 rounded-xl text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            {/* Meta Information Bar */}
            <div className="px-5 py-3 bg-muted/40 border-b border-border/60 text-xs space-y-1">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-muted-foreground">
                  {t('من:', 'De :')} <strong className="text-foreground">{selectedMessage.sender_name ? `${selectedMessage.sender_name} <${selectedMessage.sender_email}>` : selectedMessage.sender_email}</strong>
                </span>
                <span className="text-muted-foreground text-[11px]">
                  {formatDate(selectedMessage.created_at)}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">
                  {t('إلى:', 'À :')} <span className="text-foreground">{selectedMessage.recipient_email}</span>
                </span>
              </div>
            </div>

            {/* Email Body Content */}
            <div className="p-5 overflow-y-auto flex-1 space-y-4 text-sm leading-relaxed">
              {selectedMessage.body_html ? (
                <div
                  className="prose dark:prose-invert max-w-none text-xs sm:text-sm"
                  dangerouslySetInnerHTML={{ __html: selectedMessage.body_html }}
                />
              ) : (
                <pre className="whitespace-pre-wrap font-sans text-xs sm:text-sm text-foreground">
                  {selectedMessage.body_text || t('(لا يوجد نص في هذه الرسالة)', '(Aucun texte)')}
                </pre>
              )}

              {/* Attachments list */}
              {selectedMessage.attachments && selectedMessage.attachments.length > 0 && (
                <div className="pt-4 border-t border-border/40">
                  <h5 className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5">
                    <Paperclip className="w-3.5 h-3.5 text-primary" />
                    {t('المرفقات', 'Pièces jointes')} ({selectedMessage.attachments.length})
                  </h5>
                  <div className="flex flex-wrap gap-2">
                    {selectedMessage.attachments.map((att, idx) => (
                      <div
                        key={idx}
                        className="px-3 py-1.5 rounded-lg border border-border bg-muted/40 text-xs flex items-center gap-2"
                      >
                        <span className="font-medium text-foreground">{att.filename}</span>
                        {att.size && (
                          <span className="text-[10px] text-muted-foreground">
                            ({Math.round(att.size / 1024)} KB)
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer Actions */}
            <div className="p-4 border-t border-border flex items-center justify-between gap-3 bg-muted/10">
              <Button
                variant="outline"
                size="sm"
                className="text-xs rounded-xl"
                onClick={() => handleToggleRead(selectedMessage)}
              >
                {selectedMessage.is_read ? (
                  <>
                    <Mail className="w-3.5 h-3.5 me-1.5" />
                    {t('تحديد كغير مقروء', 'Marquer non lu')}
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 me-1.5 text-emerald-500" />
                    {t('تحديد كمقروء', 'Marquer lu')}
                  </>
                )}
              </Button>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => {
                    const msg = selectedMessage;
                    setSelectedMessage(null);
                    handleStartReply(msg);
                  }}
                  className="text-xs rounded-xl bg-primary text-primary-foreground font-semibold"
                >
                  <Reply className={`w-3.5 h-3.5 ${dir === 'rtl' ? 'ms-1.5' : 'me-1.5'}`} />
                  {t('رد سريع على الرسالة', 'Répondre')}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Compose / Reply Modal */}
      {isComposeOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <div
            className="w-full max-w-lg bg-card border border-border rounded-2xl shadow-xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95"
            dir={dir}
          >
            <div className="p-4 border-b border-border flex items-center justify-between bg-muted/20">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                  <Send className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-foreground">
                  {composeSubject.startsWith('Re:')
                    ? t('الرد على الرسالة', 'Répondre à l’email')
                    : t('إنشاء رسالة جديدة', 'Nouveau Message')}
                </h3>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsComposeOpen(false)}
                className="w-8 h-8 rounded-xl text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            <form onSubmit={handleSendEmail} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  {t('البريد المستلم (To):', 'Destinataire (À) :')} *
                </label>
                <Input
                  type="email"
                  required
                  value={composeTo}
                  onChange={(e) => setComposeTo(e.target.value)}
                  placeholder="client@example.com"
                  className="h-9 text-xs rounded-xl"
                  dir="ltr"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    {t('الموضوع (Subject):', 'Objet :')} *
                  </label>
                  <Input
                    required
                    value={composeSubject}
                    onChange={(e) => setComposeSubject(e.target.value)}
                    placeholder={t('موضوع الرسالة...', 'Objet du message...')}
                    className="h-9 text-xs rounded-xl"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    {t('رقم الرحلة (اختياري):', 'ID Trajet :')}
                  </label>
                  <Input
                    type="number"
                    value={composeTripId}
                    onChange={(e) => setComposeTripId(e.target.value)}
                    placeholder="مثال: 45"
                    className="h-9 text-xs rounded-xl"
                    dir="ltr"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  {t('نص الرسالة:', 'Corps du message :')} *
                </label>
                <textarea
                  required
                  rows={6}
                  value={composeBody}
                  onChange={(e) => setComposeBody(e.target.value)}
                  placeholder={t('اكتب تفاصيل الرسالة هنا...', 'Rédigez votre message...')}
                  className="w-full text-xs rounded-xl border border-border bg-background p-3 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none leading-relaxed"
                />
              </div>

              <div className="pt-2 flex items-center justify-between border-t border-border/40">
                <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                  {t('إرسال مباشر عبر SMTP الخاص بالشركة', 'Envoi direct via SMTP')}
                </span>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsComposeOpen(false)}
                    disabled={isSubmitting}
                    className="text-xs rounded-xl"
                  >
                    {t('إلغاء', 'Annuler')}
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={isSubmitting}
                    className="text-xs rounded-xl bg-primary text-primary-foreground font-semibold"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin me-1.5" />
                        {t('جاري الإرسال...', 'Envoi en cours...')}
                      </>
                    ) : (
                      <>
                        <Send className={`w-3.5 h-3.5 ${dir === 'rtl' ? 'ms-1.5' : 'me-1.5'}`} />
                        {t('إرسال الآن', 'Envoyer')}
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </Card>
  );
}

