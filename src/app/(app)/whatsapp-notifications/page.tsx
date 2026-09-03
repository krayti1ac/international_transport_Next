'use client';

import { useState, useEffect, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Client, Invoice } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { MessageSquare, Send, Phone, Zap } from 'lucide-react';
import { formatPhoneNumber } from '@/lib/whatsapp';
import { CardViewToggle, useCardViewMode } from '@/components/ui/card-view-toggle';

export default function WhatsAppNotificationsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [isSendingApi, setIsSendingApi] = useState(false);
  const [cardLayout, setCardLayout] = useCardViewMode('whatsapp_notifications', 'grid');
  const { toast } = useToast();
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [clientsRes, invoicesRes] = await Promise.all([
        supabase.from('clients').select('*').order('name'),
        supabase.from('invoices').select('*').order('issue_date', { ascending: false }),
      ]);

      if (clientsRes.error) throw clientsRes.error;
      if (invoicesRes.error) throw invoicesRes.error;

      setClients(clientsRes.data || []);
      setInvoices(invoicesRes.data || []);
    } catch (error: any) {
      toast({
        title: 'خطأ في تحميل البيانات',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const openWhatsAppLink = (phone: string, text: string) => {
    const formatted = formatPhoneNumber(phone);
    const encoded = encodeURIComponent(text);
    window.open(`https://wa.me/${formatted}?text=${encoded}`, '_blank');
  };

  const sendViaOfficialApi = async (phone: string, text: string, clientId?: number) => {
    setIsSendingApi(true);
    try {
      const res = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: phone, message: text, clientId }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'تعذر الإرسال');

      toast({ title: 'تم إرسال الرسالة آلياً عبر WhatsApp API' });
    } catch (err: any) {
      toast({
        title: 'فشل الإرسال الآلي (تم التبديل للفتح المباشر)',
        description: err.message,
        variant: 'destructive',
      });
      openWhatsAppLink(phone, text);
    } finally {
      setIsSendingApi(false);
    }
  };

  const sendTripDispatched = (client: Client) => {
    const text = `مرحباً ${client.name}، نحيطكم علماً بأن شحنتكم قد انطلقت وهي الآن في مسارها الدولي المجدول.`;
    sendViaOfficialApi(client.phone, text, client.id);
  };

  const sendInvoiceReminder = (client: Client, invoice: Invoice) => {
    const text = `مرحباً ${client.name}، تذكير بشأن الفاتورة رقم: ${invoice.invoice_number}\nالمبلغ المطلوب: ${invoice.total_amount} ${invoice.currency}\nيرجى التنسيق لإتمام التحويل.`;
    sendViaOfficialApi(client.phone, text, client.id);
  };

  const sendDeliveryConfirmation = (client: Client) => {
    const text = `مرحباً ${client.name}، تم وصول الشاحنة وتسليم الشحنة بنجاح. شكراً لثقتكم.`;
    sendViaOfficialApi(client.phone, text, client.id);
  };

  const sendCustomMessage = () => {
    if (!selectedClient || !message.trim()) {
      toast({ title: 'يرجى اختيار عميل وكتابة رسالة', variant: 'destructive' });
      return;
    }
    sendViaOfficialApi(selectedClient.phone, message, selectedClient.id);
    setMessage('');
  };

  const getClientUnpaidInvoices = (clientId: number) => {
    return invoices.filter(i => Number(i.client_id) === clientId && (i.status === 'unpaid' || i.status === 'partially_paid'));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-slate-500">جاري تحميل البيانات...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6" dir="rtl">
      <h1 className="text-2xl font-bold font-amiri">إشعارات واتساب</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="font-amiri">إرسال إشعارات سريعة</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">اختر العميل</label>
              <select
                value={selectedClient?.id || ''}
                onChange={(e) => {
                  const client = clients.find(c => c.id === Number(e.target.value));
                  setSelectedClient(client || null);
                }}
                className="w-full h-10 px-3 py-2 border border-input bg-card text-foreground rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring shadow-2xs transition-colors [color-scheme:light] dark:[color-scheme:dark]"
              >
                <option value="">-- اختر عميل --</option>
                {clients.map(client => (
                  <option key={client.id} value={client.id}>{client.name} - {client.phone}</option>
                ))}
              </select>
            </div>

            {selectedClient && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Phone className="w-4 h-4" />
                  <span dir="ltr">{selectedClient.phone}</span>
                </div>

                <div className="grid grid-cols-1 gap-2">
                  <Button
                    variant="outline"
                    disabled={isSendingApi}
                    onClick={() => sendTripDispatched(selectedClient)}
                    className="w-full flex justify-between"
                  >
                    <span>إشعار انطلاق الشحنة</span>
                    <Zap className="w-4 h-4 text-emerald-600 ml-2" />
                  </Button>

                  <Button
                    variant="outline"
                    disabled={isSendingApi}
                    onClick={() => sendDeliveryConfirmation(selectedClient)}
                    className="w-full flex justify-between"
                  >
                    <span>إشعار إتمام التسليم</span>
                    <Zap className="w-4 h-4 text-emerald-600 ml-2" />
                  </Button>

                  {getClientUnpaidInvoices(selectedClient.id).length > 0 && (
                    <Button
                      variant="outline"
                      disabled={isSendingApi}
                      onClick={() => sendInvoiceReminder(selectedClient, getClientUnpaidInvoices(selectedClient.id)[0])}
                      className="w-full flex justify-between"
                    >
                      <span>تذكير بفاتورة مستحقة</span>
                      <Zap className="w-4 h-4 text-amber-600 ml-2" />
                    </Button>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-amiri">رسالة مخصصة</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">العميل</label>
              <select
                value={selectedClient?.id || ''}
                onChange={(e) => {
                  const client = clients.find(c => c.id === Number(e.target.value));
                  setSelectedClient(client || null);
                }}
                className="w-full h-10 px-3 py-2 border border-input bg-card text-foreground rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring shadow-2xs transition-colors [color-scheme:light] dark:[color-scheme:dark]"
              >
                <option value="">-- اختر عميل --</option>
                {clients.map(client => (
                  <option key={client.id} value={client.id}>{client.name}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">الرسالة</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="اكتب رسالتك هنا..."
                rows={4}
                className="w-full px-3 py-2 border border-input bg-card text-foreground placeholder:text-muted-foreground rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring shadow-2xs transition-colors"
              />
            </div>

            <div className="flex gap-2">
              <Button
                onClick={() => selectedClient && sendViaOfficialApi(selectedClient.phone, message, selectedClient.id)}
                disabled={!selectedClient || !message.trim() || isSendingApi}
                className="flex-1 flex items-center justify-center gap-2"
              >
                <Zap className="w-4 h-4" />
                {isSendingApi ? 'جاري الإرسال...' : 'إرسال آلي رسمي (API)'}
              </Button>
              <Button
                variant="outline"
                onClick={() => selectedClient && openWhatsAppLink(selectedClient.phone, message)}
                disabled={!selectedClient || !message.trim()}
              >
                <Send className="w-4 h-4 ml-2" />
                فتح التطبيق
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="font-amiri">قائمة العملاء</CardTitle>
          <CardViewToggle viewMode={cardLayout} onChange={setCardLayout} size="sm" />
        </CardHeader>
        <CardContent>
          {cardLayout === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {clients.map((client) => (
                <div key={client.id} className="p-4 border border-slate-200 dark:border-border rounded-xl bg-card">
                  <h3 className="font-medium font-amiri">{client.name}</h3>
                  <p className="text-sm text-slate-500 font-mono" dir="ltr">{client.phone}</p>
                  <div className="flex gap-2 mt-3">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => sendTripDispatched(client)}
                      disabled={isSendingApi}
                      className="rounded-xl text-xs"
                    >
                      <Send className="w-3 h-3 ml-1" />
                      إشعار
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const unpaid = getClientUnpaidInvoices(client.id);
                        if (unpaid.length > 0) {
                          sendInvoiceReminder(client, unpaid[0]);
                        } else {
                          toast({ title: 'لا توجد فواتير مستحقة لهذا العميل' });
                        }
                      }}
                      disabled={isSendingApi}
                      className="rounded-xl text-xs"
                    >
                      <MessageSquare className="w-3 h-3 ml-1" />
                      تذكير
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* List View Cards */
            <div className="flex flex-col gap-3">
              {clients.map((client) => (
                <div key={client.id} className="p-3.5 border border-slate-200 dark:border-border rounded-xl bg-card flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      <Phone className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-medium font-amiri">{client.name}</h3>
                      <p className="text-xs text-muted-foreground font-mono" dir="ltr">{client.phone}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => sendTripDispatched(client)}
                      disabled={isSendingApi}
                      className="rounded-xl text-xs h-8"
                    >
                      <Send className="w-3 h-3 ml-1" />
                      إرسال إشعار
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const unpaid = getClientUnpaidInvoices(client.id);
                        if (unpaid.length > 0) {
                          sendInvoiceReminder(client, unpaid[0]);
                        } else {
                          toast({ title: 'لا توجد فواتير مستحقة لهذا العميل' });
                        }
                      }}
                      disabled={isSendingApi}
                      className="rounded-xl text-xs h-8"
                    >
                      <MessageSquare className="w-3 h-3 ml-1" />
                      إرسال تذكير
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
