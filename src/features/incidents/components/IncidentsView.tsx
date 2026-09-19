'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/components/language-provider';
import { formatCurrency } from '@/lib/forex';
import type { Incident, IncidentStats, IncidentCreateInput, IncidentAttachment, AttachmentType } from '../types';
import {
  getIncidents,
  getIncidentStats,
  createIncident,
  updateIncident,
  deleteIncident,
  getIncidentAttachments,
  uploadIncidentAttachment,
  deleteIncidentAttachment,
} from '../services/incidents.actions';
import {
  AlertTriangle,
  Plus,
  Trash2,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  XCircle,
  Activity,
} from 'lucide-react';

const SEVERITY_COLORS: Record<string, string> = {
  minor: 'bg-slate-500/15 text-slate-700 border-slate-500/30',
  moderate: 'bg-amber-500/15 text-amber-700 border-amber-500/30',
  major: 'bg-orange-500/15 text-orange-700 border-orange-500/30',
  critical: 'bg-rose-500/15 text-rose-700 border-rose-500/30',
};

const STATUS_COLORS: Record<string, string> = {
  open: 'bg-rose-500/15 text-rose-700 border-rose-500/30',
  investigating: 'bg-amber-500/15 text-amber-700 border-amber-500/30',
  resolved: 'bg-blue-500/15 text-blue-700 border-blue-500/30',
  closed: 'bg-emerald-500/15 text-emerald-700 border-emerald-500/30',
};

export function IncidentsView() {
  const { t, dir } = useLanguage();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [stats, setStats] = useState<IncidentStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [attachments, setAttachments] = useState<IncidentAttachment[]>([]);
  const [isAttachmentsOpen, setIsAttachmentsOpen] = useState(false);
  const [loadingAttachments, setLoadingAttachments] = useState(false);
  const [uploading, setUploading] = useState(false);

  const loadAttachments = useCallback(async (incidentId: number) => {
    setLoadingAttachments(true);
    const res = await getIncidentAttachments(incidentId);
    if (res.success && res.data) setAttachments(res.data);
    setLoadingAttachments(false);
  }, []);

  const handleViewAttachments = async (incident: Incident) => {
    setSelectedIncident(incident);
    setIsAttachmentsOpen(true);
    await loadAttachments(incident.id);
  };

  const handleUploadAttachment = async (file: File, type: AttachmentType) => {
    if (!selectedIncident) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('incident_id', String(selectedIncident.id));
      formData.append('attachment_type', type);

      const uploadRes = await fetch('/api/upload/incident-attachment', {
        method: 'POST',
        body: formData,
      });

      if (!uploadRes.ok) throw new Error('Upload failed');
      const data = await uploadRes.json();
      if (data.success) {
        await loadAttachments(selectedIncident.id);
      } else {
        alert(data.error || 'Failed to upload');
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteAttachment = async (attachmentId: number) => {
    if (!confirm(t('هل أنت متأكد من حذف هذا المرفق؟', 'Êtes-vous sûr de vouloir supprimer cette pièce jointe ?'))) return;
    const res = await deleteIncidentAttachment(attachmentId);
    if (res.success && selectedIncident) {
      await loadAttachments(selectedIncident.id);
    }
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [incidentsRes, statsRes] = await Promise.all([
        getIncidents({
          status: filterStatus !== 'all' ? (filterStatus as Incident['status']) : undefined,
        }),
        getIncidentStats(),
      ]);
      if (incidentsRes.success && incidentsRes.data) setIncidents(incidentsRes.data);
      else setError(incidentsRes.error || 'Failed to load incidents');
      if (statsRes.success && statsRes.data) setStats(statsRes.data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [filterStatus]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filtered = useMemo(() => {
    if (!search.trim()) return incidents;
    const q = search.toLowerCase();
    return incidents.filter(i =>
      i.title.toLowerCase().includes(q) ||
      (i.description || '').toLowerCase().includes(q) ||
      (i.location || '').toLowerCase().includes(q) ||
      (i.insurance_reference || '').toLowerCase().includes(q)
    );
  }, [incidents, search]);

  const handleCreate = async (input: IncidentCreateInput) => {
    const res = await createIncident(input);
    if (res.success) {
      setIsCreateOpen(false);
      loadData();
    } else {
      alert(res.error || 'Failed to create incident');
    }
  };

  const handleStatusUpdate = async (id: number, status: string, resolutionNotes?: string) => {
    const res = await updateIncident(id, { status: status as Incident['status'], resolution_notes: resolutionNotes });
    if (res.success) loadData();
  };

  const handleDelete = async (id: number) => {
    if (!confirm(t('هل أنت متأكد من حذف هذا السجل؟', 'Êtes-vous sûr de vouloir supprimer cet enregistrement ?'))) return;
    const res = await deleteIncident(id);
    if (res.success) loadData();
  };

  const getSeverityLabel = (severity: string) => {
    const labels: Record<string, { ar: string; fr: string }> = {
      minor: { ar: 'بسيط', fr: 'Mineur' },
      moderate: { ar: 'متوسط', fr: 'Modéré' },
      major: { ar: 'خطير', fr: 'Grave' },
      critical: { ar: 'حرج', fr: 'Critique' },
    };
    return labels[severity]?.ar || severity;
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, { ar: string; fr: string }> = {
      open: { ar: 'مفتوح', fr: 'Ouvert' },
      investigating: { ar: 'قيد التحقيق', fr: 'En investigation' },
      resolved: { ar: 'محلول', fr: 'Résolu' },
      closed: { ar: 'مغلق', fr: 'Fermé' },
    };
    return labels[status]?.ar || status;
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, { ar: string; fr: string }> = {
      accident: { ar: 'حادث', fr: 'Accident' },
      delay: { ar: 'تأخير', fr: 'Retard' },
      damage: { ar: 'تلف', fr: 'Dommage' },
      theft: { ar: 'سرقة', fr: 'Vol' },
      customs_hold: { ar: 'توقيف جمركي', fr: 'Retenue douanière' },
      breakdown: { ar: 'عطل ميكانيكي', fr: 'Panne' },
      other: { ar: 'أخرى', fr: 'Autre' },
    };
    return labels[type]?.ar || type;
  };

  if (loading) {
    return <div className="flex items-center justify-center h-96 text-muted-foreground text-sm">{t('جاري تحميل الحوادث...', 'Chargement des incidents...')}</div>;
  }

  if (error) {
    return <Card className="p-8 text-center text-rose-600 text-sm"><AlertTriangle className="w-8 h-8 mx-auto mb-2" />{error}</Card>;
  }

  return (
    <div className="space-y-6" dir={dir}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-amiri flex items-center gap-2">
            <AlertTriangle className="w-6 h-6 text-primary" />
            {t('إدارة الحوادث والمطالبات', 'Gestion des Incidents et Réclamations')}
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            {t('تتبع الحوادث الميدانية، التوقيفات الجمركية، التأمين، والمطالبات', 'Suivi des incidents terrain, retenues douanières, assurance et réclamations')}
          </p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)} className="rounded-xl gap-2 font-bold shadow-xs">
          <Plus className="w-4 h-4" />
          {t('تسجيل حادث جديد', 'Nouvel incident')}
        </Button>
      </div>

      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
          <SummaryCard icon={<Activity className="w-5 h-5" />} label={t('إجمالي الحوادث', 'Total incidents')} value={String(stats.total)} sub={t('جميع الفترات', 'Toutes périodes')} color="slate" />
          <SummaryCard icon={<Clock className="w-5 h-5" />} label={t('مفتوح', 'Ouvert')} value={String(stats.open)} sub={t('يتطلب إجراء', 'Action requise')} color="rose" alert={stats.open > 0} />
          <SummaryCard icon={<AlertTriangle className="w-5 h-5" />} label={t('قيد التحقيق', 'En investigation')} value={String(stats.investigating)} sub={t('قيد المتابعة', 'En cours')} color="amber" alert={stats.investigating > 0} />
          <SummaryCard icon={<CheckCircle2 className="w-5 h-5" />} label={t('محلول', 'Résolu')} value={String(stats.resolved)} sub={t('تم الإصلاح', 'Corrigé')} color="blue" />
          <SummaryCard icon={<XCircle className="w-5 h-5" />} label={t('التكلفة الفعلية', 'Coût réel')} value={formatCurrency(stats.totalActualCost, 'MAD')} sub={t('تقديرية:', 'Estimé:') + ' ' + formatCurrency(stats.totalEstimatedCost, 'MAD')} color="emerald" />
        </div>
      )}

      <Card className="border-border">
        <CardHeader className="pb-3 border-b border-border/60">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Filter className="w-4 h-4 text-primary" />
              {t('سجل الحوادث', 'Journal des incidents')}
            </CardTitle>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t('بحث...', 'Rechercher...')}
                  className="h-9 rounded-xl border border-border bg-background pr-9 pl-3 text-xs w-full sm:w-64"
                />
              </div>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="h-9 rounded-xl border border-border bg-background px-3 text-xs"
              >
                <option value="all">{t('كل الحالات', 'Tous statuts')}</option>
                <option value="open">{t('مفتوح', 'Ouvert')}</option>
                <option value="investigating">{t('قيد التحقيق', 'En investigation')}</option>
                <option value="resolved">{t('محلول', 'Résolu')}</option>
                <option value="closed">{t('مغلق', 'Fermé')}</option>
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-muted-foreground text-xs">
                  <th className="py-3 px-4 text-start font-semibold">{t('الحدث', 'Incident')}</th>
                  <th className="py-3 px-4 text-start font-semibold">{t('النوع', 'Type')}</th>
                  <th className="py-3 px-4 text-start font-semibold">{t('الخطورة', 'Sévérité')}</th>
                  <th className="py-3 px-4 text-start font-semibold">{t('الحالة', 'Statut')}</th>
                  <th className="py-3 px-4 text-start font-semibold">{t('التكلفة', 'Coût')}</th>
                  <th className="py-3 px-4 text-start font-semibold">{t('المرفقات', 'Pièces jointes')}</th>
                  <th className="py-3 px-4 text-start font-semibold">{t('التاريخ', 'Date')}</th>
                  <th className="py-3 px-4 text-end font-semibold">{t('الإجراءات', 'Actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60 text-xs">
                {filtered.length === 0 ? (
                  <tr><td colSpan={8} className="py-8 text-center text-muted-foreground">{t('لا توجد حوادث مسجلة', 'Aucun incident enregistré')}</td></tr>
                ) : filtered.map((inc) => (
                  <tr key={inc.id} className="hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-4">
                      <p className="font-semibold text-foreground">{inc.title}</p>
                      {(inc.location || inc.description) && (
                        <p className="text-[11px] text-muted-foreground truncate max-w-xs">{inc.location}{inc.location && inc.description ? ' • ' : ''}{inc.description}</p>
                      )}
                    </td>
                    <td className="py-3 px-4">{getTypeLabel(inc.incident_type)}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${SEVERITY_COLORS[inc.severity] || ''}`}>{getSeverityLabel(inc.severity)}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${STATUS_COLORS[inc.status] || ''}`}>{getStatusLabel(inc.status)}</span>
                    </td>
                    <td className="py-3 px-4 font-mono font-bold" dir="ltr">
                      {inc.actual_cost ? formatCurrency(inc.actual_cost, inc.currency || 'MAD') : inc.estimated_cost ? formatCurrency(inc.estimated_cost, inc.currency || 'MAD') + ' *' : '—'}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button onClick={() => handleViewAttachments(inc)} className="text-xs text-primary hover:underline">
                        {t('عرض', 'Voir')}
                      </button>
                    </td>
                    <td className="py-3 px-4 font-mono">{inc.incident_date}</td>
                    <td className="py-3 px-4 text-end">
                      <div className="flex items-center justify-end gap-1.5">
                        {inc.status === 'open' && (
                          <button onClick={() => handleStatusUpdate(inc.id, 'investigating')} className="h-8 px-2 text-xs rounded-lg border border-border hover:bg-muted">{t('تحقيق', 'Enquêter')}</button>
                        )}
                        {inc.status === 'investigating' && (
                          <button onClick={() => handleStatusUpdate(inc.id, 'resolved')} className="h-8 px-2 text-xs rounded-lg border border-emerald-500/30 text-emerald-700 hover:bg-emerald-500/10">{t('حل', 'Résoudre')}</button>
                        )}
                        {inc.status === 'resolved' && (
                          <button onClick={() => handleStatusUpdate(inc.id, 'closed')} className="h-8 px-2 text-xs rounded-lg border border-border hover:bg-muted">{t('إغلاق', 'Fermer')}</button>
                        )}
                        <button onClick={() => handleDelete(inc.id)} className="h-8 w-8 p-0 text-rose-500 hover:bg-rose-500/10 rounded-lg"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {isCreateOpen && (
        <IncidentFormModal
          onClose={() => setIsCreateOpen(false)}
          onSubmit={handleCreate}
        />
      )}

      {isAttachmentsOpen && selectedIncident && (
        <AttachmentsModal
          incident={selectedIncident}
          attachments={attachments}
          loading={loadingAttachments}
          uploading={uploading}
          onClose={() => setIsAttachmentsOpen(false)}
          onUpload={handleUploadAttachment}
          onDelete={handleDeleteAttachment}
          onRefresh={() => loadAttachments(selectedIncident.id)}
        />
      )}
    </div>
  );
}

function SummaryCard({ icon, label, value, sub, color, alert }: { icon: React.ReactNode; label: string; value: string; sub: string; color: string; alert?: boolean }) {
  const colors: Record<string, string> = {
    slate: 'bg-slate-500/10 text-slate-600',
    rose: 'bg-rose-500/10 text-rose-600',
    amber: 'bg-amber-500/10 text-amber-600',
    blue: 'bg-blue-500/10 text-blue-600',
    emerald: 'bg-emerald-500/10 text-emerald-600',
  };
  return (
    <Card className={`border-border ${alert ? 'border-rose-500/30' : ''}`}>
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${colors[color]}`}>{icon}</div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground truncate">{label}</p>
          <p className="text-xl font-bold font-mono text-foreground mt-0.5">{value}</p>
          <p className="text-[11px] text-muted-foreground truncate">{sub}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function IncidentFormModal({ onClose, onSubmit }: { onClose: () => void; onSubmit: (input: IncidentCreateInput) => Promise<void> }) {
  const { t } = useLanguage();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<IncidentCreateInput>({
    incident_type: 'accident',
    severity: 'moderate',
    title: '',
    incident_date: new Date().toISOString().split('T')[0],
    currency: 'MAD',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    await onSubmit(form);
    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <CardHeader>
          <CardTitle className="text-base font-bold">{t('تسجيل حادث جديد', 'Nouvel incident')}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-foreground block mb-1.5">{t('نوع الحادث', 'Type d\'incident')} *</label>
              <select value={form.incident_type} onChange={(e) => setForm({ ...form, incident_type: e.target.value as Incident['incident_type'] })} className="w-full h-10 rounded-xl border border-border bg-background px-3 text-xs">
                <option value="accident">{t('حادث', 'Accident')}</option>
                <option value="delay">{t('تأخير', 'Retard')}</option>
                <option value="damage">{t('تلف', 'Dommage')}</option>
                <option value="theft">{t('سرقة', 'Vol')}</option>
                <option value="customs_hold">{t('توقيف جمركي', 'Retenue douanière')}</option>
                <option value="breakdown">{t('عطل ميكانيكي', 'Panne')}</option>
                <option value="other">{t('أخرى', 'Autre')}</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-foreground block mb-1.5">{t('الخطورة', 'Sévérité')} *</label>
              <select value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value as Incident['severity'] })} className="w-full h-10 rounded-xl border border-border bg-background px-3 text-xs">
                <option value="minor">{t('بسيط', 'Mineur')}</option>
                <option value="moderate">{t('متوسط', 'Modéré')}</option>
                <option value="major">{t('خطير', 'Grave')}</option>
                <option value="critical">{t('حرج', 'Critique')}</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-foreground block mb-1.5">{t('العنوان', 'Titre')} *</label>
              <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required className="w-full h-10 rounded-xl border border-border bg-background px-3 text-xs" />
            </div>
            <div>
              <label className="text-xs font-semibold text-foreground block mb-1.5">{t('الوصف', 'Description')}</label>
              <textarea value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1.5">{t('التاريخ', 'Date')} *</label>
                <input type="date" value={form.incident_date} onChange={(e) => setForm({ ...form, incident_date: e.target.value })} required className="w-full h-10 rounded-xl border border-border bg-background px-3 text-xs" />
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1.5">{t('التكلفة التقديرية', 'Coût estimé')}</label>
                <input type="number" value={form.estimated_cost || ''} onChange={(e) => setForm({ ...form, estimated_cost: e.target.value ? Number(e.target.value) : undefined })} className="w-full h-10 rounded-xl border border-border bg-background px-3 text-xs" dir="ltr" />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-foreground block mb-1.5">{t('الموقع', 'Lieu')}</label>
              <input value={form.location || ''} onChange={(e) => setForm({ ...form, location: e.target.value })} className="w-full h-10 rounded-xl border border-border bg-background px-3 text-xs" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1.5">{t('مرجع التأمين', 'Réf. assurance')}</label>
                <input value={form.insurance_reference || ''} onChange={(e) => setForm({ ...form, insurance_reference: e.target.value })} className="w-full h-10 rounded-xl border border-border bg-background px-3 text-xs" dir="ltr" />
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1.5">{t('رقم البلاغ الشرطي', 'N° police')}</label>
                <input value={form.police_report_number || ''} onChange={(e) => setForm({ ...form, police_report_number: e.target.value })} className="w-full h-10 rounded-xl border border-border bg-background px-3 text-xs" dir="ltr" />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button type="button" onClick={onClose} className="h-10 px-4 rounded-xl border border-border text-xs font-semibold hover:bg-muted">{t('إلغاء', 'Annuler')}</button>
              <button type="submit" disabled={submitting} className="h-10 px-4 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 disabled:opacity-50">
                {submitting ? t('جاري الحفظ...', 'Enregistrement...') : t('حفظ', 'Enregistrer')}
              </button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function AttachmentsModal({
  incident,
  attachments,
  loading,
  uploading,
  onClose,
  onUpload,
  onDelete,
  onRefresh,
}: {
  incident: Incident;
  attachments: IncidentAttachment[];
  loading: boolean;
  uploading: boolean;
  onClose: () => void;
  onUpload: (file: File, type: AttachmentType) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
  onRefresh: () => void;
}) {
  const { t } = useLanguage();
  const [selectedType, setSelectedType] = useState<AttachmentType>('photo');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    await onUpload(selectedFile, selectedType);
    setSelectedFile(null);
    setSelectedType('photo');
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, { ar: string; fr: string }> = {
      photo: { ar: 'صورة', fr: 'Photo' },
      police_report: { ar: 'بلاغ شرطة', fr: 'Police' },
      insurance_document: { ar: 'وثيقة تأمين', fr: 'Assurance' },
      customs_document: { ar: 'وثيقة جمركية', fr: 'Douane' },
      other: { ar: 'أخرى', fr: 'Autre' },
    };
    return labels[type]?.ar || type;
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <CardHeader>
          <CardTitle className="text-base font-bold">{t('مرفقات الحادث', 'Pièces jointes')} - {incident.title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <select value={selectedType} onChange={(e) => setSelectedType(e.target.value as AttachmentType)} className="h-9 rounded-xl border border-border bg-background px-3 text-xs">
                <option value="photo">{t('صورة', 'Photo')}</option>
                <option value="police_report">{t('بلاغ شرطة', 'Police')}</option>
                <option value="insurance_document">{t('وثيقة تأمين', 'Assurance')}</option>
                <option value="customs_document">{t('وثيقة جمركية', 'Douane')}</option>
                <option value="other">{t('أخرى', 'Autre')}</option>
              </select>
              <input type="file" onChange={handleFileChange} className="text-xs" accept="image/*,.pdf,.doc,.docx" />
              <button onClick={handleUpload} disabled={!selectedFile || uploading} className="h-9 px-4 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 disabled:opacity-50">
                {uploading ? t('جاري الرفع...', 'Téléversement...') : t('رفع', 'Téléverser')}
              </button>
            </div>

            {loading ? (
              <div className="py-8 text-center text-xs text-muted-foreground">{t('جاري تحميل المرفقات...', 'Chargement des pièces jointes...')}</div>
            ) : attachments.length === 0 ? (
              <div className="py-8 text-center text-xs text-muted-foreground">{t('لا توجد مرفقات', 'Aucune pièce jointe')}</div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {attachments.map((att) => (
                  <div key={att.id} className="border border-border rounded-xl p-3 space-y-2">
                    {att.file_type.startsWith('image/') ? (
                      <img src={att.file_url} alt={att.file_name} className="w-full h-32 object-cover rounded-lg" />
                    ) : (
                      <div className="w-full h-32 bg-muted rounded-lg flex items-center justify-center">
                        <span className="text-xs text-muted-foreground">PDF/DOC</span>
                      </div>
                    )}
                    <div>
                      <p className="text-xs font-semibold truncate">{att.file_name}</p>
                      <p className="text-[10px] text-muted-foreground">{getTypeLabel(att.attachment_type)}</p>
                    </div>
                    <button onClick={() => onDelete(att.id)} className="text-xs text-rose-500 hover:underline">{t('حذف', 'Supprimer')}</button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center justify-end">
            <button onClick={onClose} className="h-10 px-4 rounded-xl border border-border text-xs font-semibold hover:bg-muted">{t('إغلاق', 'Fermer')}</button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

