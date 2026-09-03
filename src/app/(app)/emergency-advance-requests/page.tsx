'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { EmergencyAdvanceRequest, Driver } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Plus, Search, AlertTriangle } from 'lucide-react';
import { CardViewToggle, useCardViewMode } from '@/components/ui/card-view-toggle';
import { DEFAULT_DRIVERS, fallbackArray } from '@/lib/default-data';

export default function EmergencyAdvanceRequestsPage() {
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
            title: 'طلب سلفة طارئة جديد',
            description: `السائق: ${newReq.driver_name} - المبلغ: ${newReq.amount} ${newReq.currency}`,
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
  }, [supabase, toast]);

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
    try {
      const { error } = await supabase.from('emergency_advance_requests').insert({
        driver_id: formData.driver_id ? parseInt(formData.driver_id) : null,
        driver_name: formData.driver_name,
        amount: parseFloat(formData.amount),
        currency: formData.currency,
        reason: formData.reason,
        notes: formData.notes || null,
        status: 'pending',
      });

      if (error) throw error;

      toast({ title: 'تم إرسال الطلب بنجاح' });
      setFormData({ driver_name: '', driver_id: '', amount: '', currency: 'MAD', reason: '', notes: '' });
      setShowForm(false);
      fetchRequests();
    } catch (error: any) {
      toast({
        title: 'خطأ',
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
      toast({ title: 'تم تحديث الحالة بنجاح' });
    } catch (error: any) {
      toast({
        title: 'خطأ',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'approved': return 'bg-green-100 text-green-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      case 'completed': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return 'قيد الانتظار';
      case 'approved': return 'معتمد';
      case 'rejected': return 'مرفوض';
      case 'completed': return 'مكتمل';
      default: return status;
    }
  };

  const filteredRequests = requests.filter(req =>
    req.driver_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    req.reason?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold font-amiri">طلبات السلف الطارئة</h1>
        <Button onClick={() => setShowForm(!showForm)}>
          <Plus className="w-4 h-4 ml-2" />
          طلب جديد
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle className="font-amiri">طلب سلفة طارئة</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">السائق المسؤول *</label>
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
                    <option value="">-- اختر السائق من القائمة --</option>
                    {drivers.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} {d.phone ? `(${d.phone})` : ''}
                      </option>
                    ))}
                  </select>
                  <Input
                    value={formData.driver_name}
                    onChange={(e) => setFormData({ ...formData, driver_name: e.target.value, driver_id: '' })}
                    placeholder="أو اكتب اسم السائق يدوياً..."
                    required
                    className="mt-1.5"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">المبلغ *</label>
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
                <label className="text-sm font-medium">السبب *</label>
                <Input
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  placeholder="سبب طلب السلفة..."
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">ملاحظات</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-input bg-card rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring shadow-2xs transition-colors"
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit">إرسال الطلب</Button>
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                  إلغاء
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
          <Input
            placeholder="البحث عن طلب..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pr-9 h-9 text-xs rounded-xl"
          />
        </div>
        <CardViewToggle viewMode={cardLayout} onChange={setCardLayout} />
      </div>

      {loading ? (
        <div className="text-center py-12">
          <p className="text-slate-500">جاري تحميل البيانات...</p>
        </div>
      ) : cardLayout === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredRequests.map((request) => (
            <Card key={request.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-amiri flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-orange-500" />
                    طلب #{request.id}
                  </CardTitle>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(request.status)}`}>
                    {getStatusText(request.status)}
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-500">السائق:</span>
                    <span className="font-medium">{request.driver_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">المبلغ:</span>
                    <span className="font-medium">{request.amount} {request.currency}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">السبب:</span>
                    <span className="font-medium">{request.reason}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">التاريخ:</span>
                    <span className="font-medium">
                      {new Date(request.created_at).toLocaleDateString('ar-MA')}
                    </span>
                  </div>
                  {request.status === 'pending' && (
                    <div className="flex gap-2 pt-2">
                      <Button
                        size="sm"
                        onClick={() => updateStatus(request.id, 'approved')}
                        className="flex-1"
                      >
                        موافقة
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => updateStatus(request.id, 'rejected')}
                        className="flex-1"
                      >
                        رفض
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
          {filteredRequests.length === 0 && (
            <div className="col-span-full text-center py-12">
              <p className="text-slate-500">لا توجد طلبات</p>
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
                  <div className="w-9 h-9 rounded-xl bg-orange-500/10 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0">
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                  <div>
                    <CardTitle className="text-base font-amiri font-bold text-foreground">
                      طلب #{request.id}
                    </CardTitle>
                    <span className="text-[11px] text-muted-foreground">
                      السائق: {request.driver_name}
                    </span>
                  </div>
                </div>

                {/* Middle: Amount, Reason, Date */}
                <div className="flex flex-wrap items-center gap-3 text-xs">
                  <div className="bg-muted/30 px-3 py-1.5 rounded-xl border border-border/40 flex items-center gap-1.5">
                    <span className="text-muted-foreground">المبلغ:</span>
                    <span className="font-bold text-foreground font-mono text-sm">{request.amount} {request.currency}</span>
                  </div>

                  {request.reason && (
                    <div className="bg-muted/30 px-3 py-1.5 rounded-xl border border-border/40 flex items-center gap-1.5">
                      <span className="text-muted-foreground">السبب:</span>
                      <span className="font-medium text-foreground">{request.reason}</span>
                    </div>
                  )}

                  <span className="text-muted-foreground font-mono text-[11px]">
                    {new Date(request.created_at).toLocaleDateString('ar-MA')}
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
                        موافقة
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => updateStatus(request.id, 'rejected')}
                        className="rounded-xl h-8 text-xs px-3"
                      >
                        رفض
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          ))}
          {filteredRequests.length === 0 && (
            <div className="text-center py-12 bg-card border border-border/80 rounded-2xl">
              <p className="text-slate-500">لا توجد طلبات</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
