'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Client } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Plus, Search, Phone, MapPin, Edit2, Trash2, Mail, Building, PlaneTakeoff, PlaneLanding } from 'lucide-react';
import { ClientFormModal } from '@/components/client-form-modal';
import { CardViewToggle, useCardViewMode } from '@/components/ui/card-view-toggle';

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'export' | 'import'>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [cardLayout, setCardLayout] = useCardViewMode('clients', 'grid');

  const { toast } = useToast();
  const supabase = useMemo(() => createClient(), []);

  const fetchClients = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;
      setClients(data || []);
    } catch (error: any) {
      toast({
        title: 'خطأ',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [supabase, toast]);

  useEffect(() => {
    fetchClients();

    const channel = supabase
      .channel('clients-realtime-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clients' }, () => fetchClients())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchClients, supabase]);

  const handleSaveClient = async (clientData: Partial<Client>) => {
    try {
      if (editingClient) {
        const { error } = await supabase
          .from('clients')
          .update(clientData)
          .eq('id', editingClient.id);
        if (error) throw error;
        toast({ title: 'تم تحديث بيانات العميل بنجاح' });
      } else {
        const { error } = await supabase.from('clients').insert(clientData);
        if (error) throw error;
        toast({ title: 'تم إضافة العميل بنجاح' });
      }
      fetchClients();
    } catch (error: any) {
      toast({
        title: 'خطأ أثناء الحفظ',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleDeleteClient = async (id: number) => {
    if (!confirm('هل أنت متأكد من رغبتك في حذف هذا العميل؟')) return;

    try {
      const { error } = await supabase.from('clients').delete().eq('id', id);
      if (error) throw error;
      toast({ title: 'تم حذف العميل بنجاح' });
      fetchClients();
    } catch (error: any) {
      toast({
        title: 'خطأ أثناء الحذف',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const exportCount = useMemo(() => clients.filter(c => (c.client_type || 'export') === 'export').length, [clients]);
  const importCount = useMemo(() => clients.filter(c => c.client_type === 'import').length, [clients]);

  const filteredClients = clients.filter(client => {
    const name = client.name?.toLowerCase() ?? '';
    const phone = client.phone?.toLowerCase() ?? '';
    const city = client.city?.toLowerCase() ?? '';
    const search = searchQuery.toLowerCase();

    const matchesSearch = (
      name.includes(search) ||
      phone.includes(search) ||
      city.includes(search) ||
      client.ice?.includes(searchQuery)
    );

    const clientType = client.client_type || 'export';
    const matchesType = typeFilter === 'all' || clientType === typeFilter;

    return matchesSearch && matchesType;
  });

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-amiri text-foreground">إدارة العملاء</h1>
          <p className="text-sm text-muted-foreground mt-0.5">قاعدة بيانات العملاء، تصنيف الرحلات، أرقام ICE ومعلومات الفوترة</p>
        </div>
        <Button
          onClick={() => {
            setEditingClient(null);
            setIsModalOpen(true);
          }}
        >
          <Plus className="w-4 h-4 ml-2" />
          عميل جديد
        </Button>
      </div>

      {/* Filter Tabs: الكل / رحلات الذهاب / رحلات العودة */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border/70 pb-3">
        <button
          onClick={() => setTypeFilter('all')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
            typeFilter === 'all'
              ? 'bg-primary text-primary-foreground shadow-xs'
              : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
          }`}
        >
          <span>جميع العملاء</span>
          <span className={`px-1.5 py-0.2 rounded-md text-[10px] font-mono ${
            typeFilter === 'all' ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted-foreground/20 text-muted-foreground'
          }`}>
            {clients.length}
          </span>
        </button>

        <button
          onClick={() => setTypeFilter('export')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
            typeFilter === 'export'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20'
          }`}
        >
          <PlaneTakeoff className="w-3.5 h-3.5" />
          <span>عملاء رحلات الذهاب (تصدير)</span>
          <span className="px-1.5 py-0.2 rounded-md text-[10px] font-mono bg-emerald-500/25">
            {exportCount}
          </span>
        </button>

        <button
          onClick={() => setTypeFilter('import')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
            typeFilter === 'import'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'bg-blue-500/10 text-blue-700 dark:text-blue-300 hover:bg-blue-500/20'
          }`}
        >
          <PlaneLanding className="w-3.5 h-3.5" />
          <span>عملاء رحلات العودة (استيراد)</span>
          <span className="px-1.5 py-0.2 rounded-md text-[10px] font-mono bg-blue-500/25">
            {importCount}
          </span>
        </button>
      </div>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            placeholder="بحث بالاسم، الهاتف، المدينة أو ICE..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pr-9 h-9 text-xs rounded-xl"
          />
        </div>
        <CardViewToggle viewMode={cardLayout} onChange={setCardLayout} />
      </div>

      {loading ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">جاري تحميل العملاء...</p>
        </div>
      ) : cardLayout === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredClients.map((client) => (
            <Card key={client.id} className="hover:shadow-md transition-shadow flex flex-col justify-between">
              <div>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg font-amiri font-bold flex items-center gap-2 text-foreground">
                      <Building className="w-4 h-4 text-primary" />
                      {client.name}
                    </CardTitle>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      client.is_active
                        ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25'
                        : 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/25'
                    }`}>
                      {client.is_active ? 'نشط' : 'غير نشط'}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-foreground">
                    <Phone className="w-4 h-4 text-muted-foreground" />
                    <span dir="ltr" className="font-mono">{client.phone}</span>
                  </div>
                  {client.email && (
                    <div className="flex items-center gap-2 text-foreground">
                      <Mail className="w-4 h-4 text-muted-foreground" />
                      <span dir="ltr" className="text-xs">{client.email}</span>
                    </div>
                  )}
                  {client.city && (
                    <div className="flex items-center gap-2 text-foreground">
                      <MapPin className="w-4 h-4 text-muted-foreground" />
                      <span>{client.city}</span>
                    </div>
                  )}
                  {client.ice && (
                    <div className="flex justify-between border-t border-border pt-2">
                      <span className="text-muted-foreground">ICE:</span>
                      <span className="font-mono font-medium text-xs text-foreground" dir="ltr">{client.ice}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">العملة:</span>
                    <span className="font-bold text-primary font-mono">{client.currency}</span>
                  </div>
                  {client.invoice_with_tva !== false && (
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">الضريبة TVA:</span>
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                        خاضع للضريبة
                      </span>
                    </div>
                  )}

                  <div className="flex justify-between items-center border-t border-border pt-2">
                    <span className="text-muted-foreground text-xs font-medium">نوع الرحلة:</span>
                    {client.client_type === 'import' ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/25">
                        <PlaneLanding className="w-3 h-3 text-blue-600" />
                        رحلات العودة (استيراد)
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25">
                        <PlaneTakeoff className="w-3 h-3 text-emerald-600" />
                        رحلات الذهاب (تصدير)
                      </span>
                    )}
                  </div>
                </CardContent>
              </div>

              <div className="flex gap-2 p-4 pt-0 border-t border-border mt-3">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 text-xs"
                  onClick={() => {
                    setEditingClient(client);
                    setIsModalOpen(true);
                  }}
                >
                  <Edit2 className="w-3.5 h-3.5 ml-1" />
                  تعديل
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  className="text-xs"
                  onClick={() => handleDeleteClient(client.id)}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </Card>
          ))}
          {filteredClients.length === 0 && (
            <div className="col-span-full text-center py-12">
              <p className="text-muted-foreground">لا يوجد عملاء مطابقين للبحث</p>
            </div>
          )}
        </div>
      ) : (
        /* List View Cards */
        <div className="flex flex-col gap-3">
          {filteredClients.map((client) => (
            <Card key={client.id} className="hover:shadow-md transition-shadow overflow-hidden">
              <div className="p-3.5 flex flex-col lg:flex-row lg:items-center justify-between gap-3.5">
                {/* Right: Company Name & City/Currency */}
                <div className="flex items-center gap-3 min-w-[220px]">
                  <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <Building className="w-4 h-4" />
                  </div>
                  <div>
                    <CardTitle className="text-base font-amiri font-bold text-foreground">
                      {client.name}
                    </CardTitle>
                    <span className="text-[11px] font-mono text-muted-foreground">
                      {client.currency || 'MAD'} {client.city ? `• ${client.city}` : ''}
                    </span>
                  </div>
                </div>

                {/* Middle: Phone, Email, ICE, TVA */}
                <div className="flex flex-wrap items-center gap-3 text-xs">
                  {client.phone && (
                    <div className="bg-muted/30 px-3 py-1.5 rounded-xl border border-border/40 flex items-center gap-1.5 text-foreground">
                      <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                      <span dir="ltr" className="font-mono">{client.phone}</span>
                    </div>
                  )}

                  {client.email && (
                    <div className="bg-muted/30 px-3 py-1.5 rounded-xl border border-border/40 flex items-center gap-1.5 text-foreground">
                      <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                      <span dir="ltr" className="font-mono text-xs">{client.email}</span>
                    </div>
                  )}

                  {client.ice && (
                    <div className="bg-muted/30 px-3 py-1.5 rounded-xl border border-border/40 flex items-center gap-1.5">
                      <span className="text-muted-foreground">ICE:</span>
                      <span className="font-mono font-medium text-xs text-foreground" dir="ltr">{client.ice}</span>
                    </div>
                  )}

                  {client.invoice_with_tva !== false && (
                    <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                      خاضع للضريبة TVA
                    </span>
                  )}

                  {client.client_type === 'import' ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/25">
                      <PlaneLanding className="w-3 h-3 text-blue-600" />
                      رحلات العودة (استيراد)
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25">
                      <PlaneTakeoff className="w-3 h-3 text-emerald-600" />
                      رحلات الذهاب (تصدير)
                    </span>
                  )}
                </div>

                {/* Left: Status & Actions */}
                <div className="flex items-center justify-between lg:justify-end gap-2.5 border-t lg:border-t-0 pt-2.5 lg:pt-0 border-border/40">
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    client.is_active
                      ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25'
                      : 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/25'
                  }`}>
                    {client.is_active ? 'نشط' : 'غير نشط'}
                  </span>

                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs rounded-xl h-8 px-3"
                      onClick={() => {
                        setEditingClient(client);
                        setIsModalOpen(true);
                      }}
                    >
                      <Edit2 className="w-3.5 h-3.5 ml-1" />
                      تعديل
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs text-destructive hover:bg-destructive/10 rounded-xl h-8 px-2.5"
                      onClick={() => handleDeleteClient(client.id)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
          {filteredClients.length === 0 && (
            <div className="text-center py-12 bg-card border border-border/80 rounded-2xl">
              <p className="text-muted-foreground">لا يوجد عملاء مطابقين للبحث</p>
            </div>
          )}
        </div>
      )}

      <ClientFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveClient}
        initialData={editingClient}
      />
    </div>
  );
}
