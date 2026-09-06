'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { createClient } from '@/lib/supabase/browser';
import type { EmergencyAdvanceRequest, Driver } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/components/language-provider';
import { Plus, Search, AlertTriangle } from 'lucide-react';
import { CardViewToggle, useCardViewMode } from '@/components/ui/card-view-toggle';
import { DEFAULT_DRIVERS, fallbackArray } from '@/lib/default-data';
import Decimal from 'decimal.js';

export default function EmergencyAdvanceRequestsPage() {
  const { t, dir, locale } = useLanguage();
  const [requests, setRequests] = useState<EmergencyAdvanceRequest[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [cardLayout, setCardLayout] = useCardViewMode('emergency_advances', 'grid');
  const [formData, setFormData] = useState({
    driver_name: '',
    driver_id: '',
    amount: '',
    currency: 'MAD',
    reason: '',
    notes: '',
  });

  const { toast } = useToast();
  const supabase = useMemo(() => createClient(), []);

  // Deduplicate drivers by name to prevent repeated entries in the dropdown,
  // prioritizing currently selected driver if active.
  const uniqueDrivers = useMemo(() => {
    const map = new Map<string, Driver>();
    for (const driver of drivers) {
      const nameKey = driver.name?.trim().toLowerCase();
      if (!nameKey) continue;
      if (!map.has(nameKey) || String(driver.id) === String(formData.driver_id)) {
        map.set(nameKey, driver);
      }
    }
    return Array.from(map.values()).sort((a, b) =>
      (a.name || '').localeCompare(b.name || '', locale === 'ar' ? 'ar' : 'fr', { sensitivity: 'base' })
    );
  }, [drivers, formData.driver_id, locale]);

  useEffect(() => {
    fetchRequests();

    const channel = supabase
      .channel('emergency-advance-requests-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'emergency_advance_requests',
        },
        (payload) => {
          const newReq = payload.new as EmergencyAdvanceRequest;
          setRequests((prev) => [newReq, ...prev.filter((r) => r.id !== newReq.id)]);
          toast({
            title: t('طلب سلفة طارئة جديد', 'Nouvelle demande d’avance urgente'),
            description: `${t('السائق:', 'Chauffeur :')} ${newReq.driver_name} - ${t('المبلغ:', 'Montant :')} ${newReq.amount} ${newReq.currency}`,
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'emergency_advance_requests',
        },
        (payload) => {
          const updatedReq = payload.new as EmergencyAdvanceRequest;
          setRequests((prev) =>
            prev.map((r) => (r.id === updatedReq.id ? updatedReq : r))
          );
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'emergency_advance_requests',
        },
        (payload) => {
          const deletedId = (payload.old as { id: number }).id;
          setRequests((prev) => prev.filter((r) => r.id !== deletedId));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, toast, t]);

  const fetchRequests = useCallback(async () => {
    try {
      const [reqRes, driversRes] = await Promise.all([
        supabase.from('emergency_advance_requests').select('*').order('created_at', { ascending: false }),
        supabase.from('drivers').select('*').order('name'),
      ]);

      setRequests(reqRes.data || []);
      setDrivers(fallbackArray(driversRes.data, DEFAULT_DRIVERS));
    } catch {
      setDrivers(DEFAULT_DRIVERS);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    let amountNum: number;
    try {
      const dec = new Decimal(formData.amount);
      if (dec.lte(0)) throw new Error();
      amountNum = dec.toNumber();
    } catch {
      toast({ title: t('خطأ', 'Erreur'), description: t('يرجى إدخال مبلغ صالح أكبر من الصفر', 'Veuillez saisir un montant valide supérieur à zéro'), variant: 'destructive' });
      return;
    }

    try {
      const { error } = await supabase.from('emergency_advance_requests').insert({
        driver_id: formData.driver_id ? parseInt(formData.driver_id) : null,
        driver_name: formData.driver_name,
        amount: amountNum,
        currency: formData.currency,
        reason: formData.reason,
        notes: formData.notes || null,
        status: 'pending',
      });

      if (error) throw error;

      toast({ title: t('تم إرسال الطلب بنجاح', 'Demande envoyée avec succès') });
      setFormData({ driver_name: '', driver_id: '', amount: '', currency: 'MAD', reason: '', notes: '' });
      setShowForm(false);
      fetchRequests();
    } catch (error: any) {
      toast({
        title: t('خطأ', 'Erreur'),
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const updateStatus = async (id: number, status: string) => {
    try {
      const { error } = await supabase
        .from('emergency_advance_requests')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
      toast({ title: t('تم تحديث الحالة بنجاح', 'Statut mis à jour avec succès') });
    } catch (error: any) {
      toast({
        title: t('خطأ', 'Erreur'),
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/25';
      case 'approved': return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25';
      case 'rejected': return 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/25';
      case 'completed': return 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/25';
      default: return 'bg-slate-500/15 text-slate-700 dark:text-slate-300 border border-slate-500/25';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return t('قيد الانتظار', 'En attente');
      case 'approved': return t('معتمد', 'Approuvé');
      case 'rejected': return t('مرفوض', 'Rejeté');
      case 'completed': return t('مكتمل', 'Terminé');
      default: return status;
    }
  };

  const filteredRequests = requests.filter(req =>
    req.driver_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    req.reason?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6" dir={dir}>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold font-amiri text-foreground">
          {t('طلبات السلف الطارئة', 'Demandes d’Avances Urgentes')}
        </h1>
        <Button onClick={() => setShowForm(!showForm)}>
          <Plus className={`w-4 h-4 ${dir === 'rtl' ? 'ml-2' : 'mr-2'}`} />
          {t('طلب جديد', 'Nouvelle demande')}
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle className="font-amiri text-foreground">
              {t('طلب سلفة طارئة', 'Formulaire d’avance d’urgence')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">{t('السائق المسؤول *', 'Conducteur concerné *')}</label>
                  <select
                    value={formData.driver_id || ''}
                    onChange={(e) => {
                      const selectedId = e.target.value;
                      const driver = drivers.find((d) => d.id === parseInt(selectedId));
                      setFormData({
                        ...formData,
                        driver_id: selectedId,
                        driver_name: driver ? driver.name : formData.driver_name,
                      });
                    }}
                    className="w-full h-10 px-3 py-2 border border-input bg-card rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring shadow-2xs transition-colors [color-scheme:light] dark:[color-scheme:dark]"
                  >
                    <option value="">{t('-- اختر السائق من القائمة --', '-- Choisir un chauffeur --')}</option>
                    {uniqueDrivers.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                  <Input
                    value={formData.driver_name}
                    onChange={(e) => setFormData({ ...formData, driver_name: e.target.value, driver_id: '' })}
                    placeholder={t('أو اكتب اسم السائق يدوياً...', 'Ou saisissez le nom du chauffeur...')}
                    required
                    className="mt-1.5"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">{t('المبلغ *', 'Montant *')}</label>
                  <Input
                    type="number"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    required
                    dir="ltr"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">{t('السبب *', 'Motif de l’avance *')}</label>
                <Input
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  placeholder={t('سبب طلب السلفة...', 'Justification ou urgence de la dépense...')}
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">{t('ملاحظات', 'Remarques complémentaires')}</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-input bg-card rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring shadow-2xs transition-colors"
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit">{t('إرسال الطلب', 'Soumettre la demande')}</Button>
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                  {t('إلغاء', 'Annuler')}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
        <div className="relative flex-1">
          <Search className={`absolute ${dir === 'rtl' ? 'right-3' : 'left-3'} top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4`} />
          <Input
            placeholder={t('البحث عن طلب...', 'Rechercher une demande...')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`${dir === 'rtl' ? 'pr-9' : 'pl-9'} h-9 text-xs rounded-xl`}
          />
        </div>
        <CardViewToggle viewMode={cardLayout} onChange={setCardLayout} />
      </div>

      {loading ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">{t('جاري تحميل البيانات...', 'Chargement des données...')}</p>
        </div>
      ) : cardLayout === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredRequests.map((request) => (
            <Card key={request.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-amiri flex items-center gap-2 text-foreground">
                    <AlertTriangle className="w-5 h-5 text-amber-500" />
                    {t(`طلب #${request.id}`, `Demande #${request.id}`)}
                  </CardTitle>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(request.status)}`}>
                    {getStatusText(request.status)}
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('السائق:', 'Chauffeur :')}</span>
                    <span className="font-medium text-foreground">{request.driver_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('المبلغ:', 'Montant :')}</span>
                    <span className="font-bold font-mono text-primary">
                      {new Decimal(request.amount || 0).toFixed(2)} {request.currency}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('السبب:', 'Motif :')}</span>
                    <span className="font-medium text-foreground">{request.reason}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('التاريخ:', 'Date :')}</span>
                    <span className="font-medium text-foreground font-mono">
                      {new Date(request.created_at).toLocaleDateString(locale === 'ar' ? 'ar-MA' : 'fr-FR')}
                    </span>
                  </div>
                  {request.status === 'pending' && (
                    <div className="flex gap-2 pt-2">
                      <Button
                        size="sm"
                        onClick={() => updateStatus(request.id, 'approved')}
                        className="flex-1"
                      >
                        {t('موافقة', 'Approuver')}
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => updateStatus(request.id, 'rejected')}
                        className="flex-1"
                      >
                        {t('رفض', 'Rejeter')}
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
          {filteredRequests.length === 0 && (
            <div className="col-span-full text-center py-12">
              <p className="text-muted-foreground">{t('لا توجد طلبات', 'Aucune demande')}</p>
            </div>
          )}
        </div>
      ) : (
        /* List View Cards */
        <div className="flex flex-col gap-3">
          {filteredRequests.map((request) => (
            <Card key={request.id} className="hover:shadow-md transition-shadow overflow-hidden">
              <div className="p-3.5 flex flex-col lg:flex-row lg:items-center justify-between gap-3.5">
                {/* Right: ID & Driver */}
                <div className="flex items-center gap-3 min-w-[200px]">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                  <div>
                    <CardTitle className="text-base font-amiri font-bold text-foreground">
                      {t(`طلب #${request.id}`, `Demande #${request.id}`)}
                    </CardTitle>
                    <span className="text-[11px] text-muted-foreground">
                      {t('السائق:', 'Chauffeur :')} {request.driver_name}
                    </span>
                  </div>
                </div>

                {/* Middle: Amount, Reason, Date */}
                <div className="flex flex-wrap items-center gap-3 text-xs">
                  <div className="bg-muted/30 px-3 py-1.5 rounded-xl border border-border/40 flex items-center gap-1.5">
                    <span className="text-muted-foreground">{t('المبلغ:', 'Montant :')}</span>
                    <span className="font-bold text-foreground font-mono text-sm">
                      {new Decimal(request.amount || 0).toFixed(2)} {request.currency}
                    </span>
                  </div>

                  {request.reason && (
                    <div className="bg-muted/30 px-3 py-1.5 rounded-xl border border-border/40 flex items-center gap-1.5">
                      <span className="text-muted-foreground">{t('السبب:', 'Motif :')}</span>
                      <span className="font-medium text-foreground">{request.reason}</span>
                    </div>
                  )}

                  <span className="text-muted-foreground font-mono text-[11px]">
                    {new Date(request.created_at).toLocaleDateString(locale === 'ar' ? 'ar-MA' : 'fr-FR')}
                  </span>
                </div>

                {/* Left: Status & Actions */}
                <div className="flex items-center justify-between lg:justify-end gap-2.5 border-t lg:border-t-0 pt-2.5 lg:pt-0 border-border/40">
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(request.status)}`}>
                    {getStatusText(request.status)}
                  </span>

                  {request.status === 'pending' && (
                    <div className="flex items-center gap-1.5">
                      <Button
                        size="sm"
                        onClick={() => updateStatus(request.id, 'approved')}
                        className="rounded-xl h-8 text-xs px-3"
                      >
                        {t('موافقة', 'Approuver')}
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => updateStatus(request.id, 'rejected')}
                        className="rounded-xl h-8 text-xs px-3"
                      >
                        {t('رفض', 'Rejeter')}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          ))}
          {filteredRequests.length === 0 && (
            <div className="text-center py-12 bg-card border border-border/80 rounded-2xl">
              <p className="text-muted-foreground">{t('لا توجد طلبات', 'Aucune demande')}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
