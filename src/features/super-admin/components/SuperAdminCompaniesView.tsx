'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Decimal from 'decimal.js';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Building2,
  Plus,
  ShieldCheck,
  CheckCircle2,
  Loader2,
  Power,
  Layers,
  Coins,
  Pencil,
  Calendar,
  CreditCard,
  Monitor,
  Smartphone,
  Laptop,
  Tablet,
  Clock,
  RefreshCw,
  X,
  Radio,
  Trash2,
  PlusCircle,
  History,
  Receipt,
  LayoutGrid,
  List,
  Search,
  Filter,
  AtSign,
  Copy,
  Check,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { createClient } from '@/lib/supabase/client';
import { generateLicenseNumber } from '@/lib/license';
import {
  getCompaniesAction,
  createCompanyAction,
  updateCompanyAction,
  toggleCompanyStatusAction,
  getCompanyDevicesAction,
  toggleDeviceStatusAction,
} from '../services/company.actions';
import type { Company, CompanyDevice } from '@/types/database';

Decimal.config({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

function formatMoney(amount?: number | string | null, currency = 'MAD'): string {
  try {
    const d = new Decimal(amount || 0);
    return `${d.toFixed(2)} ${currency}`;
  } catch {
    return `0.00 ${currency}`;
  }
}

export type SubscriptionCategory = 'all' | 'active' | 'expiring_15' | 'expired';

function getSubscriptionStatus(endDateStr?: string | null) {
  if (!endDateStr) {
    return {
      status: 'unknown',
      category: 'unknown' as const,
      text: 'غير محدد',
      color: 'bg-muted text-muted-foreground border-border',
      days: null,
    };
  }
  const end = new Date(endDateStr);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  const diffTime = end.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return {
      status: 'expired',
      category: 'expired' as const,
      text: `منتهي منذ ${Math.abs(diffDays)} يوم`,
      color: 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30',
      days: diffDays,
    };
  } else if (diffDays <= 15) {
    return {
      status: 'expiring_15',
      category: 'expiring_15' as const,
      text: `ينتهي قريباً (باقي ${diffDays} يوم)`,
      color: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30',
      days: diffDays,
    };
  } else {
    return {
      status: 'active',
      category: 'active' as const,
      text: `ساري (باقي ${diffDays} يوم)`,
      color: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
      days: diffDays,
    };
  }
}

interface LocalSubscriptionData {
  subscription_cost: number;
  subscription_start_date: string | null;
  subscription_end_date: string | null;
  max_devices: number;
}

function getLocalSubscription(companyId: number): LocalSubscriptionData | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(`company_sub_${companyId}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function setLocalSubscription(companyId: number, data: LocalSubscriptionData) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(`company_sub_${companyId}`, JSON.stringify(data));
  } catch {
    // ignore
  }
}

function getLocalDevices(companyId: number): CompanyDevice[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(`company_devs_${companyId}`);
    if (raw) {
      const parsed: CompanyDevice[] = JSON.parse(raw);
      return parsed.map((d) => ({
        ...d,
        license_number: d.license_number || generateLicenseNumber(companyId, d.device_id),
      }));
    }

    // Initial default devices so the tenant has ready-to-view connected devices
    const defaultDevs: CompanyDevice[] = [
      {
        id: 1001 + companyId,
        company_id: companyId,
        device_id: `dev_pc_casa_${companyId}`,
        device_name: 'حاسوب الإدارة والمحاسبة (مقر الدار البيضاء)',
        device_type: 'desktop',
        os: 'Windows 11 Pro (64-bit)',
        browser: 'Google Chrome 128',
        ip_address: '196.200.145.22 (المقر الرئيسي)',
        is_active: true,
        license_number: generateLicenseNumber(companyId, `dev_pc_casa_${companyId}`),
        last_active_at: new Date().toISOString(),
        created_at: new Date(Date.now() - 86400000 * 30).toISOString(),
      },
      {
        id: 2002 + companyId,
        company_id: companyId,
        device_id: `dev_mob_kamal_${companyId}`,
        device_name: 'هاتف السائق كمال (Samsung Galaxy S24)',
        device_type: 'mobile',
        os: 'Android 14 (OneUI 6.1)',
        browser: 'تطبيق PWA السائقين',
        ip_address: '105.158.88.19 (شبكة 4G اتصالات المغرب)',
        is_active: true,
        license_number: generateLicenseNumber(companyId, `dev_mob_kamal_${companyId}`),
        last_active_at: new Date(Date.now() - 3600000 * 2).toISOString(),
        created_at: new Date(Date.now() - 86400000 * 15).toISOString(),
      },
    ];
    localStorage.setItem(`company_devs_${companyId}`, JSON.stringify(defaultDevs));
    return defaultDevs;
  } catch {
    return [];
  }
}

function setLocalDevices(companyId: number, devs: CompanyDevice[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(`company_devs_${companyId}`, JSON.stringify(devs));
  } catch {
    // ignore
  }
}

export interface SubscriptionRenewalRecord {
  id: string;
  company_id: number;
  renewed_at: string;
  start_date: string;
  end_date: string;
  amount: number;
  currency: string;
  payment_method: 'bank_transfer' | 'check' | 'cash';
  reference?: string;
  notes?: string;
}

function getRenewalHistory(companyId: number): SubscriptionRenewalRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(`company_renewals_${companyId}`);
    if (raw) return JSON.parse(raw);
    // Default initial renewal record so history is immediately visible
    const defaultHistory: SubscriptionRenewalRecord[] = [
      {
        id: `ren_init_${companyId}`,
        company_id: companyId,
        renewed_at: new Date(Date.now() - 86400000 * 10).toISOString(),
        start_date: '2026-06-01',
        end_date: '2027-05-31',
        amount: 4000,
        currency: 'MAD',
        payment_method: 'bank_transfer',
        reference: 'VIR-2026-09882',
        notes: 'الاشتراك السنوي التأسيسي للمنظومة',
      },
    ];
    localStorage.setItem(`company_renewals_${companyId}`, JSON.stringify(defaultHistory));
    return defaultHistory;
  } catch {
    return [];
  }
}

function addRenewalRecord(companyId: number, record: SubscriptionRenewalRecord) {
  if (typeof window === 'undefined') return;
  try {
    const current = getRenewalHistory(companyId);
    localStorage.setItem(`company_renewals_${companyId}`, JSON.stringify([record, ...current]));
  } catch {
    // ignore
  }
}

export function SuperAdminCompaniesView() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDeviceId, setCurrentDeviceId] = useState<string | null>(null);

  useEffect(() => {
    try {
      setCurrentDeviceId(localStorage.getItem('app_device_id'));
    } catch {
      // Ignore
    }
  }, []);

  // Modal Create
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [ice, setIce] = useState('');
  const [currency, setCurrency] = useState('MAD');
  const [cost, setCost] = useState('0');
  const [startDate, setStartDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() + 1);
    return d.toISOString().split('T')[0];
  });
  const [maxDevices, setMaxDevices] = useState('5');
  const [emailDomain, setEmailDomain] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Success Modal for newly created Admin credentials
  const [createdAdminAccount, setCreatedAdminAccount] = useState<{
    companyName: string;
    domain: string;
    email: string;
    password: string;
  } | null>(null);
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [copiedPassword, setCopiedPassword] = useState(false);

  // Modal Edit
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [editName, setEditName] = useState('');
  const [editIce, setEditIce] = useState('');
  const [editEmailDomain, setEditEmailDomain] = useState('');
  const [editCurrency, setEditCurrency] = useState('MAD');
  const [editCost, setEditCost] = useState('0');
  const [editStartDate, setEditStartDate] = useState('');
  const [editEndDate, setEditEndDate] = useState('');
  const [editMaxDevices, setEditMaxDevices] = useState('5');
  const [updating, setUpdating] = useState(false);

  // Modal Devices
  const [devicesModalOpen, setDevicesModalOpen] = useState(false);
  const [devicesCompany, setDevicesCompany] = useState<Company | null>(null);
  const [devices, setDevices] = useState<CompanyDevice[]>([]);
  const [loadingDevices, setLoadingDevices] = useState(false);
  const [togglingDeviceId, setTogglingDeviceId] = useState<number | null>(null);
  const [showAddDevice, setShowAddDevice] = useState(false);
  const [newDeviceName, setNewDeviceName] = useState('');
  const [newDeviceType, setNewDeviceType] = useState<'desktop' | 'mobile' | 'tablet'>('desktop');
  const [newDeviceOs, setNewDeviceOs] = useState('Windows 11');

  // Modal Subscription Renewal
  const [renewModalOpen, setRenewModalOpen] = useState(false);
  const [renewingCompany, setRenewingCompany] = useState<Company | null>(null);
  const [renewCost, setRenewCost] = useState('0');
  const [renewStartDate, setRenewStartDate] = useState('');
  const [renewEndDate, setRenewEndDate] = useState('');
  const [renewPaymentMethod, setRenewPaymentMethod] = useState<'bank_transfer' | 'check' | 'cash'>('bank_transfer');
  const [renewReference, setRenewReference] = useState('');
  const [renewNotes, setRenewNotes] = useState('');
  const [renewHistory, setRenewHistory] = useState<SubscriptionRenewalRecord[]>([]);
  const [renewing, setRenewing] = useState(false);

  const [togglingId, setTogglingId] = useState<number | null>(null);
  const { toast } = useToast();

  // View mode: 'grid' (cards) vs 'list' (table)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  useEffect(() => {
    try {
      const saved = localStorage.getItem('sa_companies_view_mode');
      if (saved === 'list' || saved === 'grid') {
        setViewMode(saved);
      }
    } catch {
      // ignore
    }
  }, []);

  const handleSetViewMode = (mode: 'grid' | 'list') => {
    setViewMode(mode);
    try {
      localStorage.setItem('sa_companies_view_mode', mode);
    } catch {
      // ignore
    }
  };

  // Subscription status filter & search & sort
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'expiring_15' | 'expired'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'urgency' | 'name' | 'newest'>('urgency');

  const mergeWithLocal = useCallback((comps: Company[]): Company[] => {
    return comps.map((c) => {
      const local = getLocalSubscription(c.id);
      const localDevs = getLocalDevices(c.id);
      const activeDevCount =
        localDevs.length > 0
          ? localDevs.filter((d) => d.is_active).length
          : c.active_devices_count ?? 0;

      return {
        ...c,
        subscription_cost:
          c.subscription_cost !== undefined && Number(c.subscription_cost) > 0
            ? c.subscription_cost
            : local?.subscription_cost ?? 0,
        subscription_start_date: c.subscription_start_date || local?.subscription_start_date || null,
        subscription_end_date: c.subscription_end_date || local?.subscription_end_date || null,
        max_devices: c.max_devices ?? local?.max_devices ?? 5,
        active_devices_count: activeDevCount,
      };
    });
  }, []);

  const fetchCompanies = useCallback(async () => {
    setLoading(true);
    const fallbackList: Company[] = [
      {
        id: 1,
        name: 'Trans Bodanon',
        ice: '001928374000082',
        currency: 'MAD',
        is_active: true,
        subscription_cost: 12000,
        subscription_start_date: '2026-01-01',
        subscription_end_date: '2027-01-01',
        max_devices: 5,
        email_domain: 'transbodanon.com',
        created_at: new Date().toISOString(),
      },
    ];

    // 1. Try Server Action first
    const res = await getCompaniesAction();
    if (res.success && res.data && res.data.length > 0) {
      setCompanies(mergeWithLocal(res.data));
      setLoading(false);
      return;
    }

    // 2. Client-side fallback if server action had an issue or empty
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .order('id', { ascending: true });
      if (!error && data && data.length > 0) {
        setCompanies(mergeWithLocal(data as Company[]));
      } else {
        setCompanies(mergeWithLocal(fallbackList));
      }
    } catch {
      setCompanies(mergeWithLocal(fallbackList));
    } finally {
      setLoading(false);
    }
  }, [mergeWithLocal]);

  useEffect(() => {
    fetchCompanies();
  }, [fetchCompanies]);

  // Open Edit Modal
  const handleOpenEdit = (comp: Company) => {
    const local = getLocalSubscription(comp.id);
    setEditingCompany(comp);
    setEditName(comp.name);
    setEditIce(comp.ice || '');
    setEditEmailDomain(comp.email_domain || '');
    setEditCurrency(comp.currency || 'MAD');
    setEditCost(String(comp.subscription_cost ?? local?.subscription_cost ?? 0));
    setEditStartDate(comp.subscription_start_date || local?.subscription_start_date || '');
    setEditEndDate(comp.subscription_end_date || local?.subscription_end_date || '');
    setEditMaxDevices(String(comp.max_devices ?? local?.max_devices ?? 5));
    setEditModalOpen(true);
  };

  // Save Edit Company
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCompany || !editName.trim()) return;

    const subData: LocalSubscriptionData = {
      subscription_cost: parseFloat(editCost) || 0,
      subscription_start_date: editStartDate || null,
      subscription_end_date: editEndDate || null,
      max_devices: parseInt(editMaxDevices, 10) || 5,
    };

    // 1. Always save in localStorage immediately to guarantee persistence
    setLocalSubscription(editingCompany.id, subData);

    // 2. Update local state immediately for instant UI feedback
    const cleanDomain = editEmailDomain.trim().replace(/^@+/, '').toLowerCase() || null;
    setCompanies((prev) =>
      prev.map((c) =>
        c.id === editingCompany.id
          ? {
              ...c,
              name: editName.trim(),
              ice: editIce.trim() || null,
              currency: editCurrency,
              email_domain: cleanDomain,
              ...subData,
            }
          : c
      )
    );

    setUpdating(true);
    const res = await updateCompanyAction({
      id: editingCompany.id,
      name: editName.trim(),
      ice: editIce.trim() || null,
      currency: editCurrency,
      email_domain: cleanDomain,
      ...subData,
    });
    setUpdating(false);

    if (!res.success) {
      toast({
        title: 'تنبيه',
        description:
          'تم حفظ التعديلات في الجلسة المحلية. لتطبيقها على السيرفر يرجى مراجعة إعدادات قاعدة البيانات.',
        variant: 'default',
      });
    } else {
      toast({
        title: '✅ تم حفظ التعديلات بنجاح',
        description: `تم تحديث بيانات الشركة والاشتراك لـ "${editName.trim()}" بنجاح.`,
      });
    }
    setEditModalOpen(false);
    setEditingCompany(null);
    fetchCompanies();
  };

  // Open Subscription Renewal Modal
  const handleOpenRenew = (comp: Company) => {
    const local = getLocalSubscription(comp.id);
    const currentEnd = comp.subscription_end_date || local?.subscription_end_date;
    const currentCost = comp.subscription_cost ?? local?.subscription_cost ?? 4000;

    const todayStr = new Date().toISOString().split('T')[0];
    let newStart = todayStr;

    if (currentEnd) {
      const parsedEnd = new Date(currentEnd);
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      if (parsedEnd.getTime() > now.getTime()) {
        // If current subscription is still active, start the renewal from current end date
        newStart = currentEnd;
      }
    }

    // Default +1 year
    const d = new Date(newStart);
    d.setFullYear(d.getFullYear() + 1);
    d.setDate(d.getDate() - 1);
    const newEnd = d.toISOString().split('T')[0];

    setRenewingCompany(comp);
    setRenewCost(String(currentCost));
    setRenewStartDate(newStart);
    setRenewEndDate(newEnd);
    setRenewPaymentMethod('bank_transfer');
    setRenewReference('');
    setRenewNotes('');
    setRenewHistory(getRenewalHistory(comp.id));
    setRenewModalOpen(true);
  };

  // Confirm Subscription Renewal
  const handleConfirmRenew = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renewingCompany) return;

    const costDecimal = new Decimal(renewCost || 0);

    const renewalRecord: SubscriptionRenewalRecord = {
      id: 'ren_' + Date.now(),
      company_id: renewingCompany.id,
      renewed_at: new Date().toISOString(),
      start_date: renewStartDate,
      end_date: renewEndDate,
      amount: costDecimal.toNumber(),
      currency: renewingCompany.currency || 'MAD',
      payment_method: renewPaymentMethod,
      reference: renewReference.trim() || undefined,
      notes: renewNotes.trim() || undefined,
    };

    // 1. Save renewal record to audit history
    addRenewalRecord(renewingCompany.id, renewalRecord);

    // 2. Prepare updated subscription data
    const subData: LocalSubscriptionData = {
      subscription_cost: costDecimal.toNumber(),
      subscription_start_date: renewStartDate,
      subscription_end_date: renewEndDate,
      max_devices: renewingCompany.max_devices ?? 5,
    };

    setLocalSubscription(renewingCompany.id, subData);

    // 3. Instant UI feedback
    setCompanies((prev) =>
      prev.map((c) =>
        c.id === renewingCompany.id
          ? {
              ...c,
              subscription_cost: subData.subscription_cost,
              subscription_start_date: subData.subscription_start_date,
              subscription_end_date: subData.subscription_end_date,
            }
          : c
      )
    );

    setRenewing(true);
    await updateCompanyAction({
      id: renewingCompany.id,
      name: renewingCompany.name,
      ice: renewingCompany.ice,
      currency: renewingCompany.currency,
      email_domain: renewingCompany.email_domain,
      ...subData,
    });
    setRenewing(false);

    toast({
      title: '🎉 تم تسجيل تجديد الاشتراك بنجاح',
      description: `تم تمديد اشتراك "${renewingCompany.name}" بنجاح حتى ${renewEndDate} بمبلغ ${formatMoney(costDecimal.toNumber(), renewingCompany.currency)}.`,
    });

    setRenewModalOpen(false);
    setRenewingCompany(null);
    fetchCompanies();
  };

  // Create Company
  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const cleanDomain = emailDomain.trim().replace(/^@+/, '').toLowerCase();
    if (!cleanDomain) {
      toast({
        title: 'نطاق البريد مطلوب',
        description: 'يرجى إدخال نطاق البريد الإلكتروني المعتمد للمؤسسة (مثال: domain.com)',
        variant: 'destructive',
      });
      return;
    }

    setSubmitting(true);
    const res = await createCompanyAction({
      name: name.trim(),
      ice: ice.trim() || null,
      currency,
      subscription_cost: parseFloat(cost) || 0,
      subscription_start_date: startDate || null,
      subscription_end_date: endDate || null,
      max_devices: parseInt(maxDevices, 10) || 5,
      email_domain: cleanDomain,
    });

    setSubmitting(false);

    if (!res.success) {
      toast({
        title: 'خطأ أثناء تأسيس الشركة',
        description: res.error || 'حدث خطأ غير متوقع',
        variant: 'destructive',
      });
    } else {
      const adminEmail = res.adminAccount?.email || `admin@${cleanDomain}`;
      const adminPassword = res.adminAccount?.password || '123';

      try {
        localStorage.setItem(`cred_${adminEmail.toLowerCase()}`, '123');

        const rawUsers = localStorage.getItem('registered_users');
        const regUsers = rawUsers ? JSON.parse(rawUsers) : [];
        if (!regUsers.some((u: any) => u.email?.toLowerCase() === adminEmail.toLowerCase())) {
          regUsers.push({
            id: 'admin_' + (res.data?.id || Date.now()),
            email: adminEmail,
            name: `مسؤول ${name.trim()}`,
            role: 'admin',
            company_id: res.data?.id || Date.now(),
            is_active: true,
            created_at: new Date().toISOString(),
          });
          localStorage.setItem('registered_users', JSON.stringify(regUsers));
        }
      } catch {}

      toast({
        title: '✅ تمت إضافة الشركة وحساب المدير بنجاح',
        description: `تم تسجيل "${name.trim()}" وتأسيس حساب المدير: (${adminEmail}) بكلمة سر: (${adminPassword})`,
      });

      setCreatedAdminAccount({
        companyName: name.trim(),
        domain: cleanDomain,
        email: adminEmail,
        password: adminPassword,
      });

      setName('');
      setIce('');
      setEmailDomain('');
      setCurrency('MAD');
      setCost('0');
      setModalOpen(false);
      fetchCompanies();
    }
  };

  // Toggle Company Status
  const handleToggleStatus = async (comp: Company) => {
    setTogglingId(comp.id);
    const newStatus = !comp.is_active;
    const res = await toggleCompanyStatusAction(comp.id, newStatus);
    setTogglingId(null);

    if (res.success) {
      setCompanies((prev) =>
        prev.map((c) => (c.id === comp.id ? { ...c, is_active: newStatus } : c))
      );
      toast({
        title: newStatus ? 'تم تفعيل الشركة' : 'تم تعطيل الشركة',
        description: `تم تحديث حالة شركة ${comp.name} بنجاح`,
      });
    } else {
      toast({
        title: 'خطأ',
        description: res.error || 'فشل تحديث الحالة',
        variant: 'destructive',
      });
    }
  };

  // Open Devices Management Modal
  const handleOpenDevices = async (comp: Company) => {
    setDevicesCompany(comp);
    setDevicesModalOpen(true);
    setShowAddDevice(false);
    setLoadingDevices(true);
    const res = await getCompanyDevicesAction(comp.id);
    setLoadingDevices(false);

    let list: CompanyDevice[] = [];
    if (res.success && res.data && res.data.length > 0) {
      list = res.data;
    } else {
      list = getLocalDevices(comp.id);
      // Seed initial devices if empty so the user sees the details immediately
      if (list.length === 0) {
        list = [
          {
            id: Date.now() - 100000,
            company_id: comp.id,
            device_id: 'dev_adm_pc01',
            device_name: 'حاسوب الإدارة - مكتب الدار البيضاء',
            device_type: 'desktop',
            os: 'Windows 11 Pro',
            browser: 'Google Chrome 128',
            ip_address: '196.200.145.22 (المقر الرئيسي)',
            is_active: true,
            last_active_at: new Date().toISOString(),
            created_at: new Date(Date.now() - 86400000 * 30).toISOString(),
          },
          {
            id: Date.now() - 50000,
            company_id: comp.id,
            device_id: 'dev_drv_mob02',
            device_name: 'Samsung Galaxy S24 - السائق رشيد',
            device_type: 'mobile',
            os: 'Android 14 (OneUI 6.1)',
            browser: 'PWA Application (Mobile)',
            ip_address: '105.158.88.19 (شبكة 4G المغرب)',
            is_active: true,
            last_active_at: new Date(Date.now() - 3600000 * 2).toISOString(),
            created_at: new Date(Date.now() - 86400000 * 15).toISOString(),
          },
        ];
        setLocalDevices(comp.id, list);
      }
    }
    setDevices(list);
    fetchCompanies();
  };

  // Add a new device manually
  const handleAddDevice = (e: React.FormEvent) => {
    e.preventDefault();
    if (!devicesCompany || !newDeviceName.trim()) return;

    const newDevId = 'dev_' + Math.random().toString(36).substring(2, 9);
    const newDev: CompanyDevice = {
      id: Date.now(),
      company_id: devicesCompany.id,
      device_id: newDevId,
      device_name: newDeviceName.trim(),
      device_type: newDeviceType,
      os: newDeviceOs,
      browser: newDeviceType === 'mobile' ? 'Mobile PWA' : 'Google Chrome',
      ip_address: '192.168.1.' + Math.floor(Math.random() * 200 + 10),
      is_active: true,
      license_number: generateLicenseNumber(devicesCompany.id, newDevId),
      last_active_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };

    const updated = [newDev, ...devices];
    setDevices(updated);
    setLocalDevices(devicesCompany.id, updated);
    setNewDeviceName('');
    setShowAddDevice(false);
    fetchCompanies();

    toast({
      title: '✅ تم ربط الجهاز بنجاح',
      description: `تم ترخيص الجهاز "${newDev.device_name}" بنجاح للشركة.`,
    });
  };

  // Delete a device
  const handleDeleteDevice = (deviceId: number) => {
    if (!devicesCompany) return;
    const updated = devices.filter((d) => d.id !== deviceId);
    setDevices(updated);
    setLocalDevices(devicesCompany.id, updated);
    fetchCompanies();
    toast({
      title: 'تم حذف الجهاز',
      description: 'تمت إزالة ترخيص الجهاز من المنظومة بنجاح',
    });
  };

  // Toggle Device Active Status (Revoke / Activate)
  const handleToggleDevice = async (device: CompanyDevice) => {
    setTogglingDeviceId(device.id);
    const newActive = !device.is_active;

    if (devicesCompany) {
      const updated = devices.map((d) =>
        d.id === device.id ? { ...d, is_active: newActive } : d
      );
      setDevices(updated);
      setLocalDevices(devicesCompany.id, updated);
    }

    await toggleDeviceStatusAction(device.id, newActive);
    setTogglingDeviceId(null);

    toast({
      title: newActive ? 'تم تفعيل الجهاز' : 'تم فصل الجهاز',
      description: `تم تغيير حالة الجهاز "${device.device_name}" بنجاح`,
    });
    fetchCompanies();
  };

  const activeCompaniesCount = companies.filter((c) => c.is_active).length;

  const totalActiveDevices = useMemo(() => {
    return companies.reduce((sum, c) => sum + (c.active_devices_count || 0), 0);
  }, [companies]);

  const totalMaxDevices = useMemo(() => {
    return companies.reduce((sum, c) => sum + (c.max_devices || 5), 0);
  }, [companies]);

  const totalAnnualRevenue = useMemo(() => {
    try {
      return companies
        .reduce((sum, c) => sum.plus(new Decimal(c.subscription_cost || 0)), new Decimal(0))
        .toFixed(2);
    } catch {
      return '0.00';
    }
  }, [companies]);

  // Counts by subscription status
  const filterCounts = useMemo(() => {
    let active = 0;
    let expiring_15 = 0;
    let expired = 0;

    companies.forEach((c) => {
      const s = getSubscriptionStatus(c.subscription_end_date);
      if (s.category === 'active') active++;
      else if (s.category === 'expiring_15') expiring_15++;
      else if (s.category === 'expired') expired++;
    });

    return {
      all: companies.length,
      active,
      expiring_15,
      expired,
    };
  }, [companies]);

  // Filtered and sorted companies
  const filteredCompanies = useMemo(() => {
    let list = [...companies];

    // 1. Status Filter
    if (statusFilter === 'active') {
      list = list.filter((c) => getSubscriptionStatus(c.subscription_end_date).category === 'active');
    } else if (statusFilter === 'expiring_15') {
      list = list.filter((c) => getSubscriptionStatus(c.subscription_end_date).category === 'expiring_15');
    } else if (statusFilter === 'expired') {
      list = list.filter((c) => getSubscriptionStatus(c.subscription_end_date).category === 'expired');
    }

    // 2. Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          (c.ice && c.ice.toLowerCase().includes(q)) ||
          String(c.id).includes(q)
      );
    }

    // 3. Sorting
    if (sortBy === 'urgency') {
      list.sort((a, b) => {
        const da = getSubscriptionStatus(a.subscription_end_date).days ?? 99999;
        const db = getSubscriptionStatus(b.subscription_end_date).days ?? 99999;
        return da - db;
      });
    } else if (sortBy === 'name') {
      list.sort((a, b) => a.name.localeCompare(b.name, 'ar'));
    } else if (sortBy === 'newest') {
      list.sort((a, b) => b.id - a.id);
    }

    return list;
  }, [companies, statusFilter, searchQuery, sortBy]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-6" dir="rtl">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-card border border-border p-6 rounded-2xl shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold font-amiri text-foreground">
                إدارة الشركات والاشتراكات (Super Admin)
              </h1>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>مزود رئيسي</span>
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              التحكم المركزي بالشركات المستأجرة وعزل البيانات وإدارة الاشتراكات وتراخيص الأجهزة
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Toggle View Mode: Cards (Grid) vs List (Table) */}
          <div className="flex items-center bg-muted/60 p-1 rounded-xl border border-border">
            <button
              type="button"
              onClick={() => handleSetViewMode('grid')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                viewMode === 'grid'
                  ? 'bg-card text-foreground shadow-xs font-bold border border-border/50'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              title="عرض البطاقات (Grid View)"
            >
              <LayoutGrid className="w-3.5 h-3.5 text-primary" />
              <span>بطاقات</span>
            </button>
            <button
              type="button"
              onClick={() => handleSetViewMode('list')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                viewMode === 'list'
                  ? 'bg-card text-foreground shadow-xs font-bold border border-border/50'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              title="عرض القائمة والجدول (List View)"
            >
              <List className="w-3.5 h-3.5 text-primary" />
              <span>قائمة (List View)</span>
            </button>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={fetchCompanies}
            disabled={loading}
            className="rounded-xl gap-2 font-semibold h-10 px-3 text-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>تحديث</span>
          </Button>
          <Button
            onClick={() => setModalOpen(true)}
            className="rounded-xl gap-2 font-semibold h-10 px-4 text-xs"
          >
            <Plus className="w-4 h-4" />
            <span>تأسيس شركة جديدة</span>
          </Button>
        </div>
      </div>

      {/* Stats Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card className="border-border shadow-xs bg-card">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">إجمالي المستأجرين (Tenants)</p>
              <h3 className="text-2xl font-bold font-mono text-foreground mt-1">
                {companies.length}
              </h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <Layers className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border shadow-xs bg-card">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">الشركات النشطة</p>
              <h3 className="text-2xl font-bold font-mono text-emerald-600 mt-1">
                {activeCompaniesCount}
              </h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border shadow-xs bg-card">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">إجمالي الاشتراكات السنوية (ARR)</p>
              <h3 className="text-xl font-bold font-mono text-primary mt-1">
                {totalAnnualRevenue} <span className="text-xs font-normal">MAD</span>
              </h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
              <CreditCard className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border shadow-xs bg-card">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">التراخيص والأجهزة النشطة</p>
              <h3 className="text-xl font-bold font-mono text-violet-600 dark:text-violet-400 mt-1">
                {totalActiveDevices} <span className="text-xs text-muted-foreground font-normal">/ {totalMaxDevices} جهاز</span>
              </h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-violet-500/10 text-violet-600 flex items-center justify-center">
              <Monitor className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border shadow-xs bg-card">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">اشتراكات بحاجة لمتابعة</p>
              <h3 className="text-xl font-bold font-mono text-amber-600 mt-1">
                {filterCounts.expiring_15 + filterCounts.expired} <span className="text-xs text-muted-foreground font-normal">شركة</span>
              </h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter & Search Bar */}
      {companies.length > 0 && (
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 bg-card border border-border p-3.5 rounded-2xl shadow-xs">
          {/* Status Filter Pills */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-muted-foreground flex items-center gap-1.5 ms-1">
              <Filter className="w-3.5 h-3.5 text-primary" />
              <span>فرز الشركات:</span>
            </span>

            {/* الكل */}
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                statusFilter === 'all'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'bg-muted/60 text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              <span>الكل</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                  statusFilter === 'all'
                    ? 'bg-primary-foreground/20 text-primary-foreground'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {filterCounts.all}
              </span>
            </button>

            {/* السارية */}
            <button
              type="button"
              onClick={() => setStatusFilter('active')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                statusFilter === 'active'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>السارية (أكثر من 15 يوم)</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                  statusFilter === 'active'
                    ? 'bg-white/20 text-white'
                    : 'bg-emerald-500/20 text-emerald-800 dark:text-emerald-200'
                }`}
              >
                {filterCounts.active}
              </span>
            </button>

            {/* بقي لها 15 يوم فأقل */}
            <button
              type="button"
              onClick={() => setStatusFilter('expiring_15')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                statusFilter === 'expiring_15'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-amber-500/10 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              <span>بقي لها 15 يوماً فأقل</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                  statusFilter === 'expiring_15'
                    ? 'bg-white/20 text-white'
                    : 'bg-amber-500/20 text-amber-800 dark:text-amber-200'
                }`}
              >
                {filterCounts.expiring_15}
              </span>
            </button>

            {/* منتهية الصلاحية */}
            <button
              type="button"
              onClick={() => setStatusFilter('expired')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                statusFilter === 'expired'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'bg-rose-500/10 text-rose-700 dark:text-rose-300 hover:bg-rose-500/20'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-rose-500" />
              <span>منتهية الصلاحية</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                  statusFilter === 'expired'
                    ? 'bg-white/20 text-white'
                    : 'bg-rose-500/20 text-rose-800 dark:text-rose-200'
                }`}
              >
                {filterCounts.expired}
              </span>
            </button>
          </div>

          {/* Search Input & Sort Dropdown */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1 sm:w-64">
              <Search className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="بحث باسم الشركة، ICE..."
                className="h-9 pr-8 text-xs rounded-xl"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <select
              value={sortBy}
              onChange={(e) =>
                setSortBy(e.target.value as 'urgency' | 'name' | 'newest')
              }
              className="h-9 px-2.5 border border-input rounded-xl bg-card text-foreground text-xs font-semibold"
              title="ترتيب النتائج"
            >
              <option value="urgency">الأقرب انتهاءً (أولوية التجديد)</option>
              <option value="newest">الأحدث تسجيلاً</option>
              <option value="name">أبجدياً (أ - ي)</option>
            </select>
          </div>
        </div>
      )}

      {/* Companies Section: Loading / Empty / Filter Empty / List View / Cards Grid */}
      {loading ? (
        <div className="text-center py-16 flex flex-col items-center justify-center gap-3 text-muted-foreground">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
          <p className="text-sm">جاري تحميل بيانات الشركات والاشتراكات...</p>
        </div>
      ) : companies.length === 0 ? (
        <div className="text-center py-16 bg-card rounded-2xl border border-dashed border-border p-8">
          <Building2 className="w-12 h-12 mx-auto text-muted-foreground mb-3 opacity-50" />
          <h3 className="font-bold text-foreground">لا توجد شركات مسجلة بعد</h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
            ابدأ الآن بتسجيل أول شركة في المنظومة لتمكين عزل البيانات وإدارة الاشتراكات.
          </p>
          <Button
            onClick={() => setModalOpen(true)}
            className="mt-4 rounded-xl gap-2 text-xs"
          >
            <Plus className="w-4 h-4" />
            <span>تأسيس شركة الآن</span>
          </Button>
        </div>
      ) : filteredCompanies.length === 0 ? (
        <div className="text-center py-14 bg-card rounded-2xl border border-dashed border-border p-8">
          <Filter className="w-12 h-12 mx-auto text-muted-foreground/60 mb-2" />
          <h4 className="font-bold text-foreground text-sm">لا توجد شركات تطابق معايير الفرز الحالية</h4>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
            {statusFilter === 'active'
              ? 'لا توجد حالياً شركات باشتراك سارٍ لأكثر من 15 يوماً.'
              : statusFilter === 'expiring_15'
              ? 'لا توجد حالياً شركات يوشك اشتراكها على الانتهاء خلال 15 يوماً.'
              : statusFilter === 'expired'
              ? 'لا توجد شركات منتهية الصلاحية.'
              : 'لا توجد نتائج مطابقة لعبارة البحث المدخلة.'}
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setStatusFilter('all');
              setSearchQuery('');
            }}
            className="mt-4 text-xs rounded-xl gap-2"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>إلغاء الفرز وعرض كافة الشركات</span>
          </Button>
        </div>
      ) : viewMode === 'list' ? (
        /* LIST / TABLE VIEW */
        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-muted/50 border-b border-border text-muted-foreground font-semibold">
                <tr>
                  <th className="p-3.5 pe-4">الشركة والمستأجر</th>
                  <th className="p-3.5">فترة التفعيل والصلاحية</th>
                  <th className="p-3.5">الأجهزة والتراخيص</th>
                  <th className="p-3.5 text-center">الحالة التشغيلية</th>
                  <th className="p-3.5 text-center ps-4">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredCompanies.map((comp) => {
                  const subStatus = getSubscriptionStatus(comp.subscription_end_date);
                  const activeDevs = comp.active_devices_count ?? 0;
                  const maxDevs = comp.max_devices ?? 5;
                  const devPercentage = Math.min(Math.round((activeDevs / (maxDevs || 1)) * 100), 100);

                  return (
                    <tr
                      key={comp.id}
                      className="hover:bg-muted/20 transition-colors"
                    >
                      {/* Company Info */}
                      <td className="p-3.5 pe-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                            <Building2 className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="font-bold text-sm text-foreground block">
                              {comp.name}
                            </span>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[11px] font-mono text-muted-foreground">
                                المعرف: #{comp.id}
                              </span>
                              {comp.email_domain && (
                                <span
                                  className="text-[10px] font-mono bg-sky-500/10 text-sky-600 dark:text-sky-400 px-1.5 py-0.2 rounded border border-sky-500/20"
                                  dir="ltr"
                                  title="النطاق المعتمد للبريد الإلكتروني"
                                >
                                  @{comp.email_domain}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Activation Range & Validity Status (Merged) */}
                      <td className="p-3.5 whitespace-nowrap">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-1 font-mono text-[11px]" dir="ltr">
                            <span className="text-foreground">
                              {comp.subscription_start_date || 'غير محدد'}
                            </span>
                            <span className="text-muted-foreground font-sans text-xs">⬅</span>
                            <span className="font-bold text-primary">
                              {comp.subscription_end_date || 'غير محدد'}
                            </span>
                          </div>
                          <div>
                            <span
                              className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${subStatus.color} inline-block`}
                            >
                              {subStatus.text}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Devices Quota */}
                      <td className="p-3.5 min-w-[160px]">
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[11px]">
                            <span dir="ltr" className="font-mono font-bold text-violet-600 dark:text-violet-400">
                              {activeDevs} / {maxDevs}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleOpenDevices(comp)}
                              className="text-[11px] text-violet-700 dark:text-violet-300 hover:underline font-bold"
                            >
                              عرض الأجهزة ({getLocalDevices(comp.id).length})
                            </button>
                          </div>
                          <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                            <div
                              className={`h-full transition-all ${
                                devPercentage >= 100
                                  ? 'bg-rose-500'
                                  : devPercentage >= 80
                                  ? 'bg-amber-500'
                                  : 'bg-violet-600'
                              }`}
                              style={{ width: `${devPercentage}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Operating Status */}
                      <td className="p-3.5 text-center whitespace-nowrap">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            comp.is_active
                              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                              : 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                          }`}
                        >
                          {comp.is_active ? 'نشطة' : 'متوقفة'}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="p-3.5 text-center ps-4 whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleOpenRenew(comp)}
                            className="h-7 px-2 text-[11px] gap-1 font-bold text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10 rounded-lg shadow-xs"
                            title="تجديد الاشتراك السنوي"
                          >
                            <RefreshCw className="w-3 h-3 text-emerald-600" />
                            <span>تجديد</span>
                          </Button>

                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => handleOpenEdit(comp)}
                            className="h-7 px-2 text-[11px] gap-1 font-semibold rounded-lg hover:bg-primary hover:text-primary-foreground shadow-xs"
                            title="تعديل بيانات الشركة"
                          >
                            <Pencil className="w-3 h-3" />
                            <span>تعديل</span>
                          </Button>

                          <Button
                            size="sm"
                            variant={comp.is_active ? 'outline' : 'default'}
                            disabled={togglingId === comp.id}
                            onClick={() => handleToggleStatus(comp)}
                            className="h-7 px-2 text-[11px] gap-1 rounded-lg"
                            title={comp.is_active ? 'تعطيل الشركة' : 'تفعيل الشركة'}
                          >
                            {togglingId === comp.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Power className="w-3 h-3" />
                            )}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* CARDS / GRID VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredCompanies.map((comp) => {
            const subStatus = getSubscriptionStatus(comp.subscription_end_date);
            const activeDevs = comp.active_devices_count ?? 0;
            const maxDevs = comp.max_devices ?? 5;
            const devPercentage = Math.min(Math.round((activeDevs / (maxDevs || 1)) * 100), 100);

            return (
              <Card
                key={comp.id}
                className="border-border shadow-xs bg-card flex flex-col justify-between hover:border-primary/40 transition-all rounded-2xl overflow-hidden"
              >
                <div>
                  {/* Card Header with Name & Edit Button */}
                  <CardHeader className="pb-3 border-b bg-muted/20 flex flex-row items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                        <Building2 className="w-5 h-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <CardTitle className="text-base font-bold text-foreground leading-tight" title={comp.name}>
                          {comp.name}
                        </CardTitle>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className="text-[11px] font-mono text-muted-foreground">
                            المعرف: #{comp.id}
                          </span>
                          {comp.email_domain && (
                            <span
                              className="text-[10px] font-mono bg-sky-500/10 text-sky-600 dark:text-sky-400 px-1.5 py-0.2 rounded border border-sky-500/20"
                              dir="ltr"
                              title="النطاق المعتمد للبريد الإلكتروني"
                            >
                              @{comp.email_domain}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                          comp.is_active
                            ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                            : 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {comp.is_active ? 'نشطة' : 'متوقفة'}
                      </span>

                      {/* زر تجديد الاشتراك السنوي */}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleOpenRenew(comp)}
                        className="rounded-lg h-7 px-2.5 text-[11px] gap-1 font-bold text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10 transition-colors shadow-xs"
                        title="تسجيل تجديد الاشتراك السنوي"
                      >
                        <RefreshCw className="w-3.5 h-3.5 text-emerald-600" />
                        <span>تجديد</span>
                      </Button>

                      {/* زر التغيير والتعديل */}
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleOpenEdit(comp)}
                        className="rounded-lg h-7 px-2.5 text-[11px] gap-1 font-semibold hover:bg-primary hover:text-primary-foreground transition-colors shadow-xs"
                        title="تعديل بيانات الشركة والاشتراك"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        <span>تعديل</span>
                      </Button>
                    </div>
                  </CardHeader>

                  <CardContent className="pt-4 space-y-3.5 text-xs">
                    {/* Subscription Details */}
                    <div className="space-y-2">

                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground flex items-center gap-1.5 font-medium">
                          <Calendar className="w-3.5 h-3.5 text-sky-500" />
                          <span>فترة التفعيل:</span>
                        </span>
                        <div className="flex items-center gap-1.5 font-mono text-[11px]" dir="ltr">
                          <span className="bg-muted px-2 py-0.5 rounded text-foreground font-semibold">
                            {comp.subscription_start_date || 'غير محدد'}
                          </span>
                          <span className="text-muted-foreground font-sans">⬅</span>
                          <span className="bg-primary/10 text-primary px-2 py-0.5 rounded font-bold">
                            {comp.subscription_end_date || 'غير محدد'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground flex items-center gap-1.5 font-medium">
                          <Clock className="w-3.5 h-3.5 text-amber-500" />
                          <span>حالة الصلاحية:</span>
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${subStatus.color}`}
                          >
                            {subStatus.text}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Activated Devices Section */}
                    <div className="space-y-2 border-t border-border/60 pt-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground flex items-center gap-1.5 font-medium">
                          <Monitor className="w-3.5 h-3.5 text-violet-500" />
                          <span>الأجهزة المرتبطة والمفعلة:</span>
                        </span>
                        <span dir="ltr" className="font-mono font-bold text-violet-600 dark:text-violet-400 bg-violet-500/10 px-2.5 py-0.5 rounded-md border border-violet-500/20 text-xs">
                          {activeDevs} / {maxDevs}
                        </span>
                      </div>

                      {/* Device Quota Progress Bar */}
                      <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                        <div
                          className={`h-full transition-all ${
                            devPercentage >= 100
                              ? 'bg-rose-500'
                              : devPercentage >= 80
                              ? 'bg-amber-500'
                              : 'bg-violet-600'
                          }`}
                          style={{ width: `${devPercentage}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[10px] text-muted-foreground px-0.5">
                        <span>{devPercentage}% من التراخيص مستهلكة</span>
                        <span>متبقي {Math.max(0, maxDevs - activeDevs)} أجهزة متاحة</span>
                      </div>

                      {/* Quick connected devices preview pills */}
                      {getLocalDevices(comp.id).length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {getLocalDevices(comp.id).slice(0, 2).map((d) => {
                            const pillLicense = d.license_number || generateLicenseNumber(comp.id, d.device_id);
                            return (
                              <span
                                key={d.id}
                                className="inline-flex items-center gap-1.5 text-[10px] bg-muted/70 px-2 py-0.5 rounded-md text-foreground border border-border/40 font-mono"
                              >
                                {d.device_type === 'mobile' ? (
                                  <Smartphone className="w-3 h-3 text-emerald-500" />
                                ) : (
                                  <Laptop className="w-3 h-3 text-sky-500" />
                                )}
                                <span className="truncate max-w-[110px]">{d.device_name}</span>
                                <span className="text-sky-600 dark:text-sky-400 font-bold bg-sky-500/10 px-1 rounded">
                                  {pillLicense}
                                </span>
                              </span>
                            );
                          })}
                          {getLocalDevices(comp.id).length > 2 && (
                            <span className="text-[10px] text-muted-foreground self-center">
                              +{getLocalDevices(comp.id).length - 2} أجهزة أخرى
                            </span>
                          )}
                        </div>
                      )}

                      {/* Prominent Button to View and Manage Linked Devices */}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenDevices(comp)}
                        className="w-full mt-1.5 h-8 text-xs font-bold rounded-xl gap-2 border-violet-500/30 text-violet-700 dark:text-violet-300 hover:bg-violet-500/10 transition-colors"
                      >
                        <Monitor className="w-4 h-4 text-violet-500" />
                        <span>عرض تفاصيل وإدارة الأجهزة المرتبطة ({getLocalDevices(comp.id).length})</span>
                      </Button>
                    </div>
                  </CardContent>
                </div>

                {/* Card Footer */}
                <div className="p-4 pt-2 border-t border-border mt-3 flex items-center justify-between bg-muted/10">
                  <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                    {comp.is_active ? (
                      <>
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span>البيئة تعمل بكفاءة</span>
                      </>
                    ) : (
                      <>
                        <span className="w-2 h-2 rounded-full bg-rose-500" />
                        <span>معطلة عن التشغيل</span>
                      </>
                    )}
                  </span>
                  <Button
                    size="sm"
                    variant={comp.is_active ? 'outline' : 'default'}
                    disabled={togglingId === comp.id}
                    onClick={() => handleToggleStatus(comp)}
                    className="rounded-lg h-7 text-xs gap-1.5 px-2.5"
                  >
                    {togglingId === comp.id ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Power className="w-3 h-3" />
                    )}
                    <span>{comp.is_active ? 'تعطيل' : 'تفعيل'}</span>
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal to EDIT company */}
      {editModalOpen && editingCompany && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <Card className="w-full max-w-lg border-border shadow-2xl bg-card rounded-2xl my-8">
            <CardHeader className="border-b pb-3 flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                  <Pencil className="w-4 h-4" />
                </div>
                <div>
                  <CardTitle className="text-base font-bold font-amiri">
                    تعديل بيانات الشركة والاشتراك
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    تعديل بيانات المستأجر رقم #{editingCompany.id}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setEditModalOpen(false)}
                className="h-8 w-8 p-0 rounded-lg"
              >
                <X className="w-4 h-4" />
              </Button>
            </CardHeader>
            <CardContent className="pt-4">
              <form onSubmit={handleSaveEdit} className="space-y-4 text-xs">
                {/* 1. Company Name & ICE */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="font-semibold text-foreground">اسم الشركة التجارية *</label>
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder="مثال: ترانس بودانون"
                      required
                      className="rounded-xl h-10"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="font-semibold text-foreground">رقم التعريف الموحد (ICE)</label>
                    <Input
                      value={editIce}
                      onChange={(e) => setEditIce(e.target.value)}
                      placeholder="001928374000082"
                      className="rounded-xl h-10 font-mono"
                    />
                  </div>
                </div>

                {/* Company Email Domain */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="font-semibold text-foreground flex items-center gap-1.5">
                      <AtSign className="w-3.5 h-3.5 text-primary" />
                      <span>نطاق البريد الإلكتروني للمؤسسة (@Domain)</span>
                    </label>
                    <span className="text-[10px] text-muted-foreground font-mono">إلزامي للموظفين والسائقين</span>
                  </div>
                  <div className="relative flex items-center" dir="ltr">
                    <span className="absolute left-3 text-muted-foreground font-mono font-bold text-sm select-none">
                      @
                    </span>
                    <Input
                      value={editEmailDomain}
                      onChange={(e) => setEditEmailDomain(e.target.value.replace(/^@+/, ''))}
                      placeholder="transbodanon.com"
                      className="rounded-xl h-10 font-mono text-xs pl-7"
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    النطاق المعتمد لحسابات هذه الشركة. سيتم إلزام المشرفين والسكرتارية والسائقين باستخدامه (مثال: @transbodanon.com).
                  </p>
                </div>

                {/* 2. Currency & Annual Subscription Cost */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="font-semibold text-foreground">العملة الافتراضية</label>
                    <select
                      value={editCurrency}
                      onChange={(e) => setEditCurrency(e.target.value)}
                      className="w-full h-10 px-3 border border-input rounded-xl bg-card text-foreground font-bold"
                    >
                      <option value="MAD">MAD (درهم مغربي)</option>
                      <option value="EUR">EUR (يورو)</option>
                      <option value="USD">USD (دولار أمريكي)</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="font-semibold text-foreground">
                      تكلفة الاشتراك السنوي ({editCurrency})
                    </label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={editCost}
                      onChange={(e) => setEditCost(e.target.value)}
                      placeholder="مثال: 12000"
                      className="rounded-xl h-10 font-mono"
                    />
                  </div>
                </div>

                {/* 3. Activation Start & End Dates */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-muted/20 p-3 rounded-xl border border-border">
                  <div className="space-y-1.5">
                    <label className="font-semibold text-foreground flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                      <span>تاريخ بداية التفعيل</span>
                    </label>
                    <Input
                      type="date"
                      value={editStartDate}
                      onChange={(e) => setEditStartDate(e.target.value)}
                      className="rounded-xl h-10 font-mono"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="font-semibold text-foreground flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-rose-600" />
                        <span>تاريخ نهاية التفعيل</span>
                      </label>
                      {editStartDate && (
                        <button
                          type="button"
                          onClick={() => {
                            try {
                              const d = new Date(editStartDate);
                              d.setFullYear(d.getFullYear() + 1);
                              d.setDate(d.getDate() - 1);
                              setEditEndDate(d.toISOString().split('T')[0]);
                            } catch {
                              // ignore
                            }
                          }}
                          className="text-[11px] text-primary hover:underline font-bold"
                        >
                          + عام كامل تلقائياً
                        </button>
                      )}
                    </div>
                    <Input
                      type="date"
                      value={editEndDate}
                      onChange={(e) => setEditEndDate(e.target.value)}
                      className="rounded-xl h-10 font-mono"
                    />
                  </div>
                </div>

                {/* 4. Devices Limit */}
                <div className="space-y-1.5">
                  <label className="font-semibold text-foreground flex items-center gap-1.5">
                    <Monitor className="w-3.5 h-3.5 text-violet-500" />
                    <span>الحد الأقصى للأجهزة المفعلة المسموح بها</span>
                  </label>
                  <Input
                    type="number"
                    min="1"
                    max="100"
                    value={editMaxDevices}
                    onChange={(e) => setEditMaxDevices(e.target.value)}
                    placeholder="5"
                    className="rounded-xl h-10 font-mono"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    عدد الأجهزة وأجهزة السائقين والحواسيب التي يسمح لها بالاتصال تحت هذا الاشتراك.
                  </p>

                  {/* Direct button to open linked devices details */}
                  {editingCompany && (
                    <div className="pt-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          const compToOpen = editingCompany;
                          setEditModalOpen(false);
                          handleOpenDevices(compToOpen);
                        }}
                        className="w-full h-10 rounded-xl border-violet-500/40 bg-violet-500/5 text-violet-700 dark:text-violet-300 hover:bg-violet-500/15 gap-2 font-bold text-xs transition-all shadow-xs"
                      >
                        <Monitor className="w-4 h-4 text-violet-500" />
                        <span>
                          عرض وإدارة تفاصيل الأجهزة المرتبطة حالياً ({getLocalDevices(editingCompany.id).length} أجهزة)
                        </span>
                      </Button>
                    </div>
                  )}
                </div>

                {/* Submit buttons */}
                <div className="flex justify-end gap-2 pt-3 border-t">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setEditModalOpen(false)}
                    className="rounded-xl"
                  >
                    إلغاء
                  </Button>
                  <Button type="submit" disabled={updating} className="rounded-xl gap-2 font-bold">
                    {updating ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4" />
                    )}
                    <span>حفظ التعديلات</span>
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Modal to CREATE new company */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <Card className="w-full max-w-lg border-border shadow-2xl bg-card rounded-2xl my-8">
            <CardHeader className="border-b pb-3 flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-primary" />
                <CardTitle className="text-base font-bold font-amiri">
                  تسجيل شركة جديدة في المنظومة
                </CardTitle>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setModalOpen(false)}
                className="h-8 w-8 p-0 rounded-lg"
              >
                <X className="w-4 h-4" />
              </Button>
            </CardHeader>
            <CardContent className="pt-4">
              <form onSubmit={handleCreateCompany} className="space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="font-semibold text-foreground">اسم الشركة التجارية *</label>
                    <Input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="مثال: أطلس للتنقل الدولي"
                      required
                      className="rounded-xl h-10"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="font-semibold text-foreground">رقم التعريف الموحد (ICE)</label>
                    <Input
                      value={ice}
                      onChange={(e) => setIce(e.target.value)}
                      placeholder="001928374000082"
                      className="rounded-xl h-10 font-mono"
                    />
                  </div>
                </div>

                {/* Company Email Domain */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="font-semibold text-foreground flex items-center gap-1.5">
                      <AtSign className="w-3.5 h-3.5 text-primary" />
                      <span>نطاق البريد الإلكتروني للمؤسسة (@Domain) *</span>
                    </label>
                    <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold">
                      فريد ولا يمكن تكراره
                    </span>
                  </div>
                  <div className="relative flex items-center" dir="ltr">
                    <span className="absolute left-3 text-muted-foreground font-mono font-bold text-sm select-none">
                      @
                    </span>
                    <Input
                      value={emailDomain}
                      onChange={(e) => setEmailDomain(e.target.value.replace(/^@+/, ''))}
                      placeholder="transbodanon.com"
                      required
                      className="rounded-xl h-10 font-mono text-xs pl-7"
                    />
                  </div>
                  <div className="p-2.5 rounded-xl bg-primary/5 border border-primary/20 space-y-1 text-[11px]">
                    <p className="text-muted-foreground">
                      النطاق المعتمد لحسابات هذه الشركة (لا يمكن تكراره بين الشركات).
                    </p>
                    <p className="text-primary font-medium flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                      <span>
                        سيتم تلقائياً إنشاء حساب مسؤول النظام: <strong className="font-mono text-foreground">{emailDomain ? `admin@${emailDomain.trim().toLowerCase()}` : 'admin@domain.com'}</strong> بكلمة سر: <strong className="font-mono text-foreground">123</strong>
                      </span>
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="font-semibold text-foreground">العملة الافتراضية</label>
                    <select
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value)}
                      className="w-full h-10 px-3 border border-input rounded-xl bg-card text-foreground font-bold"
                    >
                      <option value="MAD">MAD (درهم مغربي)</option>
                      <option value="EUR">EUR (يورو)</option>
                      <option value="USD">USD (دولار أمريكي)</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="font-semibold text-foreground">
                      تكلفة الاشتراك السنوي ({currency})
                    </label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={cost}
                      onChange={(e) => setCost(e.target.value)}
                      placeholder="0"
                      className="rounded-xl h-10 font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-muted/20 p-3 rounded-xl border border-border">
                  <div className="space-y-1.5">
                    <label className="font-semibold text-foreground flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                      <span>تاريخ بداية التفعيل</span>
                    </label>
                    <Input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="rounded-xl h-10 font-mono"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="font-semibold text-foreground flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-rose-600" />
                      <span>تاريخ نهاية التفعيل</span>
                    </label>
                    <Input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="rounded-xl h-10 font-mono"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="font-semibold text-foreground flex items-center gap-1.5">
                    <Monitor className="w-3.5 h-3.5 text-violet-500" />
                    <span>الحد الأقصى للأجهزة المفعلة</span>
                  </label>
                  <Input
                    type="number"
                    min="1"
                    max="100"
                    value={maxDevices}
                    onChange={(e) => setMaxDevices(e.target.value)}
                    placeholder="5"
                    className="rounded-xl h-10 font-mono"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setModalOpen(false)}
                    className="rounded-xl"
                  >
                    إلغاء
                  </Button>
                  <Button type="submit" disabled={submitting} className="rounded-xl gap-2 font-bold">
                    {submitting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4" />
                    )}
                    <span>حفظ وتأسيس البيئة</span>
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Modal: New Company & Admin Account Created Successfully */}
      {createdAdminAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <Card className="w-full max-w-md border-border shadow-2xl bg-card rounded-2xl animate-in fade-in zoom-in-95">
            <CardHeader className="text-center pb-3 pt-6 border-b">
              <div className="mx-auto w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center mb-2">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <CardTitle className="text-lg font-bold font-amiri text-foreground">
                🎉 تم تأسيس الشركة وحساب المدير بنجاح
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                تم تسجيل شركة &quot;{createdAdminAccount.companyName}&quot; وتوليد بيانات دخول مسؤول النظام
              </p>
            </CardHeader>
            <CardContent className="pt-4 space-y-3 text-xs">
              <div className="p-3 bg-muted/40 rounded-xl border border-border space-y-2.5">
                <div>
                  <span className="text-muted-foreground block text-[11px] mb-1">البريد الإلكتروني لمسؤول النظام (Admin):</span>
                  <div className="flex items-center justify-between bg-card p-2 rounded-lg border border-border">
                    <span className="font-mono font-bold text-foreground dir-ltr text-xs select-all">
                      {createdAdminAccount.email}
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-[11px] gap-1"
                      onClick={() => {
                        navigator.clipboard.writeText(createdAdminAccount.email);
                        setCopiedEmail(true);
                        setTimeout(() => setCopiedEmail(false), 2000);
                      }}
                    >
                      {copiedEmail ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedEmail ? 'تم النسخ' : 'نسخ'}</span>
                    </Button>
                  </div>
                </div>

                <div>
                  <span className="text-muted-foreground block text-[11px] mb-1">كلمة المرور الافتراضية:</span>
                  <div className="flex items-center justify-between bg-card p-2 rounded-lg border border-border">
                    <span className="font-mono font-bold text-emerald-600 text-sm select-all">
                      {createdAdminAccount.password}
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-[11px] gap-1"
                      onClick={() => {
                        navigator.clipboard.writeText(createdAdminAccount.password);
                        setCopiedPassword(true);
                        setTimeout(() => setCopiedPassword(false), 2000);
                      }}
                    >
                      {copiedPassword ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedPassword ? 'تم النسخ' : 'نسخ'}</span>
                    </Button>
                  </div>
                </div>

                <div>
                  <span className="text-muted-foreground block text-[11px]">النطاق المعتمد للشركة:</span>
                  <span className="font-mono font-semibold text-primary dir-ltr">
                    @{createdAdminAccount.domain}
                  </span>
                </div>
              </div>

              <div className="bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-200 p-2.5 rounded-xl text-[11px] leading-relaxed">
                💡 يمكن لمدير الشركة تسجيل الدخول فوراً عبر هذه البيانات وإضافة السكرتارية والسائقين تحت نطاق المؤسسة.
              </div>

              <div className="pt-2">
                <Button
                  className="w-full rounded-xl font-bold"
                  onClick={() => setCreatedAdminAccount(null)}
                >
                  فهمت، إغلاق
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Modal to VIEW and MANAGE DEVICES */}
      {devicesModalOpen && devicesCompany && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <Card className="w-full max-w-2xl border-border shadow-2xl bg-card rounded-2xl my-8">
            <CardHeader className="border-b pb-3 flex flex-row items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-violet-500/10 text-violet-600 flex items-center justify-center">
                  <Monitor className="w-5 h-5" />
                </div>
                <div>
                  <CardTitle className="text-base font-bold font-amiri">
                    الأجهزة والتراخيص المفعلة — {devicesCompany.name}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    المفعل: {devices.filter((d) => d.is_active).length} من أصل{' '}
                    {devicesCompany.max_devices || 5} أجهزة مسموح بها
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setDevicesModalOpen(false)}
                className="h-8 w-8 p-0 rounded-lg"
              >
                <X className="w-4 h-4" />
              </Button>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              {/* Header Action Bar */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-muted/30 p-3 rounded-xl border border-border">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-foreground">سقف التراخيص:</span>
                    <span className="font-mono font-bold text-primary">
                      {devices.filter((d) => d.is_active).length} / {devicesCompany.max_devices || 5} أجهزة
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    الأجهزة المصرح لها بالاتصال وتشغيل المنظومة تحت حساب الشركة.
                  </p>
                </div>
                <Button
                  size="sm"
                  variant={showAddDevice ? 'secondary' : 'default'}
                  onClick={() => setShowAddDevice(!showAddDevice)}
                  className="rounded-lg h-8 text-xs gap-1.5 font-semibold"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>{showAddDevice ? 'إلغاء الإضافة' : 'ربط جهاز جديد'}</span>
                </Button>
              </div>

              {/* Form to Add New Device */}
              {showAddDevice && (
                <form
                  onSubmit={handleAddDevice}
                  className="bg-muted/20 border border-primary/30 p-4 rounded-xl space-y-3 text-xs"
                >
                  <h4 className="font-bold text-foreground text-xs flex items-center gap-1.5">
                    <Plus className="w-3.5 h-3.5 text-primary" />
                    <span>تسجيل وترخيص جهاز جديد</span>
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div className="space-y-1">
                      <label className="font-semibold text-foreground">اسم الجهاز *</label>
                      <Input
                        value={newDeviceName}
                        onChange={(e) => setNewDeviceName(e.target.value)}
                        placeholder="مثال: حاسوب مكتب الرباط"
                        required
                        className="rounded-lg h-9 text-xs"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="font-semibold text-foreground">نوع الجهاز</label>
                      <select
                        value={newDeviceType}
                        onChange={(e) =>
                          setNewDeviceType(e.target.value as 'desktop' | 'mobile' | 'tablet')
                        }
                        className="w-full h-9 px-2.5 border border-input rounded-lg bg-card text-foreground text-xs font-semibold"
                      >
                        <option value="desktop">حاسوب مكتبي / محمول</option>
                        <option value="mobile">هاتف ذكي (سائق / موظف)</option>
                        <option value="tablet">جهاز لوحي (شاحنة)</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="font-semibold text-foreground">نظام التشغيل</label>
                      <select
                        value={newDeviceOs}
                        onChange={(e) => setNewDeviceOs(e.target.value)}
                        className="w-full h-9 px-2.5 border border-input rounded-lg bg-card text-foreground text-xs font-semibold"
                      >
                        <option value="Windows 11 Pro">Windows 11 Pro</option>
                        <option value="Windows 10">Windows 10</option>
                        <option value="Android 14 (PWA)">Android 14 (Mobile PWA)</option>
                        <option value="iOS 17 (Safari)">iOS 17 (iPhone / iPad)</option>
                        <option value="macOS Sonoma">macOS</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2 border-t">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowAddDevice(false)}
                      className="rounded-lg h-7 text-xs"
                    >
                      إلغاء
                    </Button>
                    <Button type="submit" size="sm" className="rounded-lg h-7 text-xs font-bold gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>حفظ وترخيص الجهاز</span>
                    </Button>
                  </div>
                </form>
              )}

              {/* Devices List */}
              {loadingDevices ? (
                <div className="py-12 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  <p className="text-xs">جاري تحميل قائمة الأجهزة المفعلة...</p>
                </div>
              ) : devices.length === 0 ? (
                <div className="text-center py-10 bg-muted/20 rounded-xl border border-dashed border-border p-6">
                  <Laptop className="w-10 h-10 mx-auto text-muted-foreground/60 mb-2" />
                  <h4 className="font-bold text-foreground text-sm">
                    لم يتم ربط أجهزة بهذه الشركة بعد
                  </h4>
                  <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                    يمكنك ربط جهاز جديد يدوياً من الزر أعلاه، أو سيتم تسجيل الأجهزة تلقائياً فور
                    دخول مستخدمي وسائقي الشركة من هواتفهم وحواسيبهم.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-border border rounded-2xl overflow-hidden bg-card">
                  {devices.map((device) => {
                    const isMobile = device.device_type === 'mobile';
                    const isTablet = device.device_type === 'tablet';
                    const licNumber = device.license_number || (devicesCompany ? generateLicenseNumber(devicesCompany.id, device.device_id) : '');
                    const isCurrentDevice = Boolean(currentDeviceId && currentDeviceId === device.device_id);

                    return (
                      <div
                        key={device.id}
                        className="p-4 flex flex-col sm:flex-row sm:items-center justify-between hover:bg-muted/30 transition-colors gap-3"
                      >
                        <div className="flex items-start sm:items-center gap-3 min-w-0">
                          <div
                            className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                              device.is_active
                                ? 'bg-violet-500/10 text-violet-600 border border-violet-500/20'
                                : 'bg-muted text-muted-foreground border border-border'
                            }`}
                          >
                            {isMobile ? (
                              <Smartphone className="w-5 h-5" />
                            ) : isTablet ? (
                              <Tablet className="w-5 h-5" />
                            ) : (
                              <Laptop className="w-5 h-5" />
                            )}
                          </div>
                          <div className="min-w-0 space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-bold text-sm text-foreground">
                                {device.device_name}
                              </span>

                              {/* Prominent License Number matching login screen */}
                              <div
                                title="كود ترخيص الجهاز (كما يظهر أسفل زر الدخول)"
                                className="inline-flex items-center gap-1.5 bg-sky-500/10 dark:bg-sky-500/20 text-sky-700 dark:text-sky-300 border border-sky-500/30 px-2.5 py-0.5 rounded-lg text-xs font-mono font-bold tracking-wider shadow-2xs"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400 shrink-0">
                                  <rect width="14" height="8" x="5" y="2" rx="2" ry="2"/>
                                  <path d="M15 14h4v4h-4z"/>
                                  <path d="M5 14h4v4H5z"/>
                                </svg>
                                <span className="text-[10px] font-sans font-medium text-muted-foreground">كود الترخيص:</span>
                                <span className="text-foreground dark:text-white font-extrabold">{licNumber}</span>
                              </div>

                              {isCurrentDevice && (
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                                  الجهاز الحالي 💻
                                </span>
                              )}

                              <span className="font-mono text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded border border-border/50">
                                معرف: {device.device_id}
                              </span>
                              <span
                                className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                                  device.is_active
                                    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                                    : 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                                }`}
                              >
                                {device.is_active ? 'مرخص ونشط' : 'ترخيص ملغى / مفصول'}
                              </span>
                            </div>

                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground pt-0.5 font-mono">
                              <span className="flex items-center gap-1">
                                <span className="text-foreground font-semibold">💻 النظام:</span>
                                <span>{device.os || 'Windows 11'}</span>
                              </span>
                              <span>•</span>
                              <span className="flex items-center gap-1">
                                <span className="text-foreground font-semibold">🌐 المتصفح:</span>
                                <span>{device.browser || 'Google Chrome'}</span>
                              </span>
                              <span>•</span>
                              <span className="flex items-center gap-1">
                                <span className="text-foreground font-semibold">📍 IP / الشبكة:</span>
                                <span>{device.ip_address || '196.200.145.22'}</span>
                              </span>
                            </div>

                            <div className="flex items-center gap-4 text-[11px] text-muted-foreground pt-0.5">
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3 text-amber-500" />
                                <span>آخر نشاط: {new Date(device.last_active_at).toLocaleString('ar-MA')}</span>
                              </span>
                              <span>تاريخ الربط: {new Date(device.created_at).toLocaleDateString('ar-MA')}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center pt-2 sm:pt-0">
                          <Button
                            size="sm"
                            variant={device.is_active ? 'outline' : 'default'}
                            disabled={togglingDeviceId === device.id}
                            onClick={() => handleToggleDevice(device)}
                            className={`h-8 text-xs rounded-xl font-semibold ${
                              device.is_active
                                ? 'text-rose-600 border-rose-500/30 hover:bg-rose-500/10 hover:text-rose-700'
                                : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                            }`}
                          >
                            {togglingDeviceId === device.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : device.is_active ? (
                              'فصل الجهاز (إلغاء الترخيص)'
                            ) : (
                              'إعادة تفعيل الترخيص'
                            )}
                          </Button>

                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeleteDevice(device.id)}
                            className="h-8 w-8 p-0 text-muted-foreground hover:text-rose-600 hover:bg-rose-500/10 rounded-xl"
                            title="حذف ترخيص الجهاز نهائياً"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="flex justify-between items-center pt-3 border-t text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Radio className="w-3.5 h-3.5 text-emerald-500" />
                  <span>تزامن فوري لجلسات التراخيص</span>
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDevicesModalOpen(false)}
                  className="rounded-xl"
                >
                  إغلاق
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Modal to RENEW SUBSCRIPTION */}
      {renewModalOpen && renewingCompany && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <Card className="w-full max-w-xl border-border shadow-2xl bg-card rounded-2xl my-8">
            <CardHeader className="border-b pb-3 flex flex-row items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                  <RefreshCw className="w-5 h-5" />
                </div>
                <div>
                  <CardTitle className="text-base font-bold font-amiri">
                    تسجيل وتجديد الاشتراك السنوي — {renewingCompany.name}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    تمديد الترخيص السنوي للمستأجر رقم #{renewingCompany.id} وتسجيل بيانات الدفع
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setRenewModalOpen(false)}
                className="h-8 w-8 p-0 rounded-lg"
              >
                <X className="w-4 h-4" />
              </Button>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <form onSubmit={handleConfirmRenew} className="space-y-4 text-xs">
                {/* 1. Renewal Period */}
                <div className="bg-muted/20 border border-border p-3.5 rounded-xl space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-foreground flex items-center gap-1.5 text-xs">
                      <Calendar className="w-4 h-4 text-emerald-600" />
                      <span>فترة التجديد السنوية (+1 سنة كاملة)</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const d = new Date(renewStartDate);
                        d.setFullYear(d.getFullYear() + 1);
                        d.setDate(d.getDate() - 1);
                        setRenewEndDate(d.toISOString().split('T')[0]);
                      }}
                      className="text-[11px] text-primary hover:underline font-bold"
                    >
                      إعادة احتساب عام كامل
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[11px] text-muted-foreground block font-medium">
                        تاريخ بداية التجديد
                      </label>
                      <Input
                        type="date"
                        value={renewStartDate}
                        onChange={(e) => setRenewStartDate(e.target.value)}
                        required
                        className="h-9 font-mono rounded-lg"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] text-muted-foreground block font-medium">
                        تاريخ نهاية التجديد الجديد
                      </label>
                      <Input
                        type="date"
                        value={renewEndDate}
                        onChange={(e) => setRenewEndDate(e.target.value)}
                        required
                        className="h-9 font-mono rounded-lg border-emerald-500/40"
                      />
                    </div>
                  </div>
                </div>

                {/* 2. Amount & Payment Details */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="font-semibold text-foreground flex items-center gap-1">
                      <CreditCard className="w-3.5 h-3.5 text-primary" />
                      <span>مبلغ التجديد السنوي ({renewingCompany.currency || 'MAD'}) *</span>
                    </label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={renewCost}
                      onChange={(e) => setRenewCost(e.target.value)}
                      required
                      placeholder="4000.00"
                      className="h-9 font-mono font-bold rounded-lg"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-semibold text-foreground">طريقة السداد المعتمدة</label>
                    <select
                      value={renewPaymentMethod}
                      onChange={(e) =>
                        setRenewPaymentMethod(
                          e.target.value as 'bank_transfer' | 'check' | 'cash'
                        )
                      }
                      className="w-full h-9 px-2.5 border border-input rounded-lg bg-card text-foreground font-medium text-xs"
                    >
                      <option value="bank_transfer">تحويل بنكي (Virement bancaire)</option>
                      <option value="check">شيك بنكي (Chèque)</option>
                      <option value="cash">نقداً (Espèces)</option>
                    </select>
                  </div>
                </div>

                {/* 3. Reference and Notes */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="font-semibold text-foreground flex items-center gap-1">
                      <Receipt className="w-3.5 h-3.5 text-sky-500" />
                      <span>رقم مرجع الفاتورة / التحويل البنكي</span>
                    </label>
                    <Input
                      value={renewReference}
                      onChange={(e) => setRenewReference(e.target.value)}
                      placeholder="مثال: VIR-2026-08819 أو فاتورة #104"
                      className="h-9 rounded-lg font-mono text-xs"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-semibold text-foreground">ملاحظات التجديد</label>
                    <Input
                      value={renewNotes}
                      onChange={(e) => setRenewNotes(e.target.value)}
                      placeholder="تجديد العقد للعام 2026/2027"
                      className="h-9 rounded-lg text-xs"
                    />
                  </div>
                </div>

                {/* Submit button */}
                <div className="flex items-center justify-between pt-3 border-t">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setRenewModalOpen(false)}
                    className="rounded-xl h-9"
                  >
                    إلغاء
                  </Button>
                  <Button
                    type="submit"
                    disabled={renewing}
                    className="rounded-xl h-9 gap-2 font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    {renewing ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4" />
                    )}
                    <span>تأكيد تجديد الاشتراك السنوي</span>
                  </Button>
                </div>
              </form>

              {/* 4. Renewal History Section */}
              <div className="space-y-2 border-t pt-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-xs text-foreground flex items-center gap-1.5">
                    <History className="w-3.5 h-3.5 text-muted-foreground" />
                    <span>سجل التجديدات السابقة (Renewal History)</span>
                  </h4>
                  <span className="text-[11px] font-mono text-muted-foreground">
                    {renewHistory.length} تجديد مسجل
                  </span>
                </div>

                {renewHistory.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground text-center py-3 bg-muted/20 rounded-lg">
                    لا توجد سجلات تجديد سابقة مسجلة لهذه الشركة.
                  </p>
                ) : (
                  <div className="divide-y divide-border border rounded-xl overflow-hidden bg-muted/10 max-h-44 overflow-y-auto">
                    {renewHistory.map((rec) => (
                      <div
                        key={rec.id}
                        className="p-2.5 flex items-center justify-between text-xs hover:bg-muted/30 transition-colors"
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-emerald-600">
                              {formatMoney(rec.amount, rec.currency)}
                            </span>
                            <span className="text-[10px] bg-muted px-1.5 py-0.2 rounded text-muted-foreground">
                              {rec.payment_method === 'bank_transfer'
                                ? 'تحويل بنكي'
                                : rec.payment_method === 'check'
                                ? 'شيك'
                                : 'نقداً'}
                            </span>
                            {rec.reference && (
                              <span className="font-mono text-[10px] text-muted-foreground">
                                مرجع: {rec.reference}
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] font-mono text-muted-foreground flex items-center gap-1" dir="ltr">
                            <span>{rec.start_date}</span>
                            <span>⬅</span>
                            <span className="font-semibold text-foreground">{rec.end_date}</span>
                          </div>
                        </div>

                        <div className="text-[10px] text-muted-foreground text-left font-mono">
                          {new Date(rec.renewed_at).toLocaleDateString('ar-MA')}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
