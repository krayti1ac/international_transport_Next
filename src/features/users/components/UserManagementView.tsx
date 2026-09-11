'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Truck } from '@/components/icons/vehicle-icons';
import {
  Users,
  ShieldCheck,
  UserPlus,
  Search,
  Edit2,
  Trash2,
  Mail,
  User as UserIcon,
  FileText,
  Loader2,
  AlertTriangle,
  Upload,
  Sparkles,
  Power,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { UserAvatar } from '@/components/users/UserAvatar';
import { PRESET_USER_AVATARS, saveUserPhotoLocal, resolveUserPhoto } from '@/lib/user-photos';
import { compressImageFile } from '@/lib/driver-photos';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/components/language-provider';
import { useAuth } from '@/components/auth-provider';
import { useUsersQuery, usersKeys } from '../services/users.queries';
import {
  createUserAction,
  updateUserAction,
  toggleUserActiveAction,
} from '../services/users.actions';
import type { User, UserRole } from '@/types/database';

export function UserManagementView() {
  const { dir, t } = useLanguage();
  const { user: currentUser, role: userRole, company: currentCompany } = useAuth();
  const [cookieRole, setCookieRole] = useState('');
  const [isClientMounted, setIsClientMounted] = useState(false);

  useEffect(() => {
    setIsClientMounted(true);
    try {
      const cookie = document.cookie.split('; ').find((r) => r.startsWith('app_user_session='));
      if (cookie) {
        const val = JSON.parse(decodeURIComponent(cookie.split('=')[1]));
        setCookieRole((val.role || '').toLowerCase().trim());
      }
    } catch {}
  }, []);

  const effectiveRole = useMemo(() => {
    const fromAuth = (userRole || currentUser?.role || '').toLowerCase().trim();
    if (fromAuth) return fromAuth;
    return cookieRole;
  }, [userRole, currentUser?.role, cookieRole]);

  const isSuperAdmin = effectiveRole === 'super_admin';
  const isSecretary = effectiveRole === 'secretary';
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const companyEmailDomain = currentCompany?.email_domain;
  const companyDomain = useMemo(() => {
    if (companyEmailDomain) {
      return companyEmailDomain.replace(/^@+/, '').trim().toLowerCase();
    }
    return 'transbodanon.com';
  }, [companyEmailDomain]);

  // Available roles when editing:
  // Secretary can only change roles to secretary or driver (never admin or super_admin)
  const availableRoles = useMemo<UserRole[]>(() => {
    if (isSuperAdmin) {
      return ['super_admin', 'admin', 'secretary', 'driver'];
    }
    if (isSecretary) {
      return ['secretary', 'driver'];
    }
    return ['admin', 'secretary', 'driver'];
  }, [isSuperAdmin, isSecretary]);

  const { data: users = [], isLoading } = useUsersQuery();

  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | UserRole>('all');

  // Modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [showPresets, setShowPresets] = useState(false);
  const [compressing, setCompressing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: 'driver' as UserRole,
    password: '',
    preferred_language: 'ar' as 'ar' | 'fr' | 'es',
    avatar_url: '',
  });
  const [submitting, setSubmitting] = useState(false);

  // Check in real-time if the entered username or email conflicts with an existing user in the company
  const usernameConflict = useMemo(() => {
    const rawVal = formData.email.trim().toLowerCase();
    if (!rawVal) return null;

    const targetEmail =
      formData.role === 'super_admin'
        ? rawVal
        : rawVal.includes('@')
          ? rawVal
          : `${rawVal}@${companyDomain}`;

    const targetUsername = targetEmail.split('@')[0].trim().toLowerCase();

    return (
      users.find((u) => {
        if (editingUser && u.id === editingUser.id) return false;
        const candEmail = (u.email || '').trim().toLowerCase();
        const candUsername = candEmail.split('@')[0].trim().toLowerCase();

        // Exact email match
        if (candEmail === targetEmail) return true;

        // In company domain: same username prefix regardless of role (admin, secretary, driver)
        if (formData.role !== 'super_admin' && candUsername === targetUsername) return true;

        return false;
      }) || null
    );
  }, [formData.email, formData.role, companyDomain, users, editingUser]);

  // Role details config
  const roleConfig: Record<
    UserRole,
    { label: string; badgeClass: string; icon: React.ComponentType<{ className?: string }>; desc: string }
  > = {
    super_admin: {
      label: t('المدير العام', 'Super Admin'),
      badgeClass:
        'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30',
      icon: ShieldCheck,
      desc: t('إدارة شاملة لكافة الشركات المستأجرة وإعدادات المنظومة', 'Supervision globale de tous les locataires'),
    },
    admin: {
      label: t('مدير النظام', 'Administrateur'),
      badgeClass:
        'bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30',
      icon: ShieldCheck,
      desc: t('كامل الصلاحيات والتقارير المالية والتحكم بالنظام', 'Accès complet au système et rapports'),
    },
    secretary: {
      label: t('سكرتارية وإدارة', 'Secrétaire / Gestionnaire'),
      badgeClass:
        'bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/30',
      icon: FileText,
      desc: t('إدارة العمليات، الرحلات، الفواتير، والخزينة', 'Gestion des voyages, factures et trésorerie'),
    },
    driver: {
      label: t('كابتن / سائق', 'Chauffeur'),
      badgeClass:
        'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
      icon: Truck,
      desc: t('مهام النقل، إثباتات التسليم، ورفع إيصالات الوقود', 'Missions de transport et justificatifs carburant'),
    },
  };

  // Only super_admin can see super_admin accounts in the user management list
  const visibleUsers = useMemo(() => {
    let list = [...users];
    if (isClientMounted) {
      try {
        const raw = localStorage.getItem('registered_users');
        if (raw) {
          const reg: User[] = JSON.parse(raw);
          reg.forEach((ru) => {
            const idx = list.findIndex(
              (u) => u.id === ru.id || u.email?.toLowerCase() === ru.email?.toLowerCase()
            );
            if (idx !== -1) {
              list[idx] = { ...list[idx], ...ru };
            } else {
              list.push(ru);
            }
          });
        }
      } catch {}

      // Apply any status overrides from 1-click toggles
      list = list.map((u) => {
        const key = `user_status_${u.id}`;
        const emailKey = `user_status_${u.email?.toLowerCase()}`;
        const saved = localStorage.getItem(key) || localStorage.getItem(emailKey);
        if (saved !== null) {
          return { ...u, is_active: saved === 'true' };
        }
        return u;
      });
    }

    if (isSuperAdmin) return list;
    return list.filter((u) => u.role !== 'super_admin');
  }, [users, isSuperAdmin, isClientMounted]);

  // Filtered users
  const filteredUsers = useMemo(() => {
    const effectiveRoleFilter = !isSuperAdmin && roleFilter === 'super_admin' ? 'all' : roleFilter;
    return visibleUsers.filter((u) => {
      const matchesRole = effectiveRoleFilter === 'all' || u.role === effectiveRoleFilter;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        (u.name && u.name.toLowerCase().includes(q)) ||
        (u.email && u.email.toLowerCase().includes(q));
      return matchesRole && matchesSearch;
    });
  }, [visibleUsers, roleFilter, searchQuery, isSuperAdmin]);

  // Statistics
  const stats = useMemo(() => {
    const total = visibleUsers.length;
    const superAdmins = visibleUsers.filter((u) => u.role === 'super_admin').length;
    const admins = visibleUsers.filter((u) => u.role === 'admin').length;
    const secretaries = visibleUsers.filter((u) => u.role === 'secretary').length;
    const drivers = visibleUsers.filter((u) => u.role === 'driver').length;
    return { total, superAdmins, admins, secretaries, drivers };
  }, [visibleUsers]);

  const handleOpenAddModal = () => {
    setEditingUser(null);
    setFormData({
      name: '',
      email: '',
      role: 'driver',
      password: '',
      preferred_language: 'ar',
      avatar_url: '',
    });
    setShowPresets(false);
    setModalOpen(true);
  };

  const handleOpenEditModal = (userToEdit: User) => {
    if (isSecretary && (userToEdit.role === 'admin' || userToEdit.role === 'super_admin')) {
      toast({
        title: t('غير مسموح', 'Non autorisé'),
        description: t(
          'لا يمكن للسكرتارية الوصول إلى بيانات حساب المدير أو تعديلها',
          'Accès aux données du compte administrateur non autorisé'
        ),
        variant: 'destructive',
      });
      return;
    }

    setEditingUser(userToEdit);
    let usernamePart = userToEdit.email || '';
    if (companyDomain && usernamePart.toLowerCase().endsWith(`@${companyDomain}`)) {
      usernamePart = usernamePart.slice(0, -(companyDomain.length + 1));
    }
    const resolvedPhoto = userToEdit.avatar_url || resolveUserPhoto(userToEdit) || '';
    setFormData({
      name: userToEdit.name || '',
      email: usernamePart,
      role: userToEdit.role || 'secretary',
      password: '',
      preferred_language: ((userToEdit.preferred_language as any) === 'en' ? 'ar' : userToEdit.preferred_language) || 'ar',
      avatar_url: resolvedPhoto,
    });
    setShowPresets(false);
    setModalOpen(true);
  };

  const [togglingActiveId, setTogglingActiveId] = useState<string | null>(null);

  const handleToggleActive = async (targetUser: User) => {
    const isSelf =
      currentUser?.id === targetUser.id ||
      currentUser?.email?.toLowerCase() === targetUser.email?.toLowerCase();

    if (isSelf) {
      toast({
        title: t('تنبيه', 'Attention'),
        description: t(
          'لا يمكنك تعطيل حسابك الشخصي المسجل به حالياً',
          'Vous ne pouvez pas désactiver votre propre compte'
        ),
        variant: 'destructive',
      });
      return;
    }

    const isTargetAdmin = targetUser.role === 'admin' || targetUser.role === 'super_admin';
    if (isSecretary && isTargetAdmin) {
      toast({
        title: t('غير مسموح', 'Non autorisé'),
        description: t(
          'لا يمكن للسكرتارية تعطيل أو تعديل حالة حساب المدير',
          'La secrétaire ne peut pas modifier le statut du compte administrateur'
        ),
        variant: 'destructive',
      });
      return;
    }

    const currentStatus = targetUser.is_active !== false;
    const newStatus = !currentStatus;

    setTogglingActiveId(targetUser.id);
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(`user_status_${targetUser.id}`, String(newStatus));
        if (targetUser.email) {
          localStorage.setItem(`user_status_${targetUser.email.toLowerCase()}`, String(newStatus));
        }
        try {
          const raw = localStorage.getItem('registered_users');
          if (raw) {
            const reg: User[] = JSON.parse(raw);
            const updated = reg.map((ru) =>
              ru.id === targetUser.id || ru.email?.toLowerCase() === targetUser.email?.toLowerCase()
                ? { ...ru, is_active: newStatus }
                : ru
            );
            localStorage.setItem('registered_users', JSON.stringify(updated));
          }
        } catch {}
      }
      const res = await toggleUserActiveAction(targetUser.id, newStatus);
      queryClient.invalidateQueries({ queryKey: usersKeys.list() });
      if (res.success) {
        toast({
          title: newStatus
            ? t('تم تفعيل الحساب', 'Compte activé')
            : t('تم إلغاء تفعيل الحساب', 'Compte désactivé'),
          description: newStatus
            ? t(
                `تم تفعيل حساب ${targetUser.name} بنجاح`,
                `Le compte de ${targetUser.name} est maintenant actif`
              )
            : t(
                `تم تحويل حساب ${targetUser.name} إلى "غير مفعل" بنجاح، وسيتم منعه من تسجيل الدخول`,
                `Le compte de ${targetUser.name} est maintenant inactif et bloqué`
              ),
        });
      } else {
        toast({
          title: t('خطأ', 'Erreur'),
          description: res.error || t('فشل تحديث حالة الحساب', 'Échec de mise à jour du statut'),
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: t('خطأ', 'Erreur'),
        description: t('حدث خطأ غير متوقع', 'Une erreur est survenue'),
        variant: 'destructive',
      });
    } finally {
      setTogglingActiveId(null);
    }
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.email.trim()) {
      toast({
        title: t('خطأ', 'Erreur'),
        description: t('يرجى ملء جميع الحقول المطلوبة', 'Veuillez remplir les champs obligatoires'),
        variant: 'destructive',
      });
      return;
    }

    if (!editingUser && (!formData.password || formData.password.length < 6)) {
      toast({
        title: t('خطأ', 'Erreur'),
        description: t('كلمة المرور يجب أن لا تقل عن 6 أحرف', 'Le mot de passe doit comporter au moins 6 caractères'),
        variant: 'destructive',
      });
      return;
    }

    if (usernameConflict) {
      toast({
        title: t('اسم المستخدم مكرر', 'Identifiant déjà utilisé'),
        description: t(
          `اسم المستخدم محجوز بالفعل للحساب "${usernameConflict.name}" (${roleConfig[usernameConflict.role]?.label || usernameConflict.role}). لا يمكن تكراره لنفس الشركة حتى وإن اختلفت الصلاحية.`,
          `Cet identifiant est déjà utilisé par "${usernameConflict.name}" (${roleConfig[usernameConflict.role]?.label || usernameConflict.role}). Impossible de le dupliquer.`
        ),
        variant: 'destructive',
      });
      return;
    }

    setSubmitting(true);
    try {
      const finalEmail =
        formData.role !== 'super_admin' && !formData.email.includes('@')
          ? `${formData.email.trim()}@${companyDomain}`
          : formData.email.trim();

      if (editingUser) {
        const res = await updateUserAction({
          id: editingUser.id,
          name: formData.name.trim(),
          email: finalEmail,
          role: formData.role,
          password: formData.password ? formData.password : undefined,
          preferred_language: formData.preferred_language,
          avatar_url: formData.avatar_url || null,
        });

        if (!res.success) {
          throw new Error(res.error || 'فشل تحديث بيانات المستخدم');
        }

        if (formData.avatar_url) {
          saveUserPhotoLocal(editingUser.id, formData.avatar_url, formData.name, finalEmail);
          if (res.data?.id) {
            saveUserPhotoLocal(res.data.id, formData.avatar_url, formData.name, finalEmail);
          }
        }

        try {
          const raw = localStorage.getItem('registered_users');
          let reg: User[] = raw ? JSON.parse(raw) : [];
          const idx = reg.findIndex(
            (u) => u.id === editingUser.id || u.email?.toLowerCase() === editingUser.email?.toLowerCase()
          );
          const updatedUserObj: User = {
            ...editingUser,
            id: res.data?.id || editingUser.id,
            name: formData.name.trim(),
            email: finalEmail,
            role: formData.role,
            preferred_language: formData.preferred_language,
            avatar_url: formData.avatar_url || null,
          };
          if (idx !== -1) {
            reg[idx] = updatedUserObj;
          } else {
            reg.push(updatedUserObj);
          }
          localStorage.setItem('registered_users', JSON.stringify(reg));

          if (formData.password) {
            localStorage.setItem(`cred_${finalEmail.toLowerCase()}`, formData.password);
          }
        } catch {}

        const resolvedId = res.data?.id || editingUser.id;
        queryClient.setQueryData(usersKeys.list(), (old: User[] | undefined) => {
          if (!old) return old;
          return old.map((u) => {
            if (
              u.id === editingUser.id ||
              u.id === resolvedId ||
              u.email?.toLowerCase() === finalEmail.toLowerCase()
            ) {
              return {
                ...u,
                id: resolvedId,
                name: formData.name.trim(),
                email: finalEmail,
                role: formData.role,
                preferred_language: formData.preferred_language,
                avatar_url: formData.avatar_url || null,
              };
            }
            return u;
          });
        });

        toast({
          title: t('تم التحديث بنجاح', 'Mis à jour avec succès'),
          description: t('تم تحديث بيانات المستخدم وصلاحياته', "Données de l'utilisateur mises à jour"),
        });
      } else {
        const res = await createUserAction({
          name: formData.name.trim(),
          email: finalEmail,
          role: formData.role,
          password: formData.password,
          preferred_language: formData.preferred_language,
          avatar_url: formData.avatar_url || null,
        });

        if (!res.success) {
          throw new Error(res.error || 'فشل إنشاء المستخدم');
        }

        if (formData.avatar_url) {
          saveUserPhotoLocal(res.data?.id || finalEmail, formData.avatar_url, formData.name, finalEmail);
        }

        toast({
          title: t('تمت الإضافة بنجاح', 'Ajouté avec succès'),
          description: t('تم إنشاء الحساب بنجاح ويمكن للمستخدم تسجيل الدخول', 'Compte créé avec succès'),
        });
      }

      queryClient.invalidateQueries({ queryKey: usersKeys.list() });
      setModalOpen(false);
    } catch (err: any) {
      toast({
        title: t('خطأ في العملية', "Erreur lors de l'opération"),
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6" dir={dir}>
      {/* Top Header Card */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card border border-border p-6 rounded-2xl shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold font-amiri text-foreground">
                {t('إدارة المستخدمين والصلاحيات', 'Gestion des utilisateurs et rôles')}
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t(
                  'التحكم بحسابات الفريق، تحديد الأدوار الإدارية، وإدارة بيانات الوصول',
                  "Gérez les comptes d'utilisateurs, attribuez les permissions et l'accès"
                )}
              </p>
            </div>
          </div>
        </div>

        <Button
          onClick={handleOpenAddModal}
          className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-xs rounded-xl self-start sm:self-auto"
        >
          <UserPlus className="w-4 h-4" />
          <span>{t('إضافة مستخدم جديد', 'Nouvel utilisateur')}</span>
        </Button>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        <Card className="rounded-2xl border-border bg-card">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-500/10 text-slate-600 dark:text-slate-300 flex items-center justify-center shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t('إجمالي المستخدمين', 'Total Utilisateurs')}</p>
              <p className="text-xl font-bold text-foreground mt-0.5">{stats.total}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border bg-card">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t('المدراء', 'Administrateurs')}</p>
              <p className="text-xl font-bold text-purple-600 dark:text-purple-400 mt-0.5">{stats.admins}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border bg-card">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-500/10 text-sky-500 flex items-center justify-center shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t('إدارة وسكرتارية', 'Secrétariat')}</p>
              <p className="text-xl font-bold text-sky-600 dark:text-sky-400 mt-0.5">{stats.secretaries}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border bg-card">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t('السائقون', 'Chauffeurs')}</p>
              <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">{stats.drivers}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <Card className="rounded-2xl border-border bg-card">
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
            {/* Search Input */}
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 text-muted-foreground absolute top-1/2 -translate-y-1/2 start-3" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('البحث بالاسم أو البريد...', 'Rechercher par nom ou email...')}
                className="ps-9 h-10 rounded-xl"
              />
            </div>

            {/* Role Filter Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
              <Button
                variant={roleFilter === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setRoleFilter('all')}
                className="rounded-xl text-xs"
              >
                {t('الكل', 'Tous')} ({stats.total})
              </Button>
              {stats.superAdmins > 0 && (
                <Button
                  variant={roleFilter === 'super_admin' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setRoleFilter('super_admin')}
                  className="rounded-xl text-xs"
                >
                  {t('المدراء العامين', 'Super Admins')} ({stats.superAdmins})
                </Button>
              )}
              <Button
                variant={roleFilter === 'admin' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setRoleFilter('admin')}
                className="rounded-xl text-xs"
              >
                {t('المدراء', 'Admins')} ({stats.admins})
              </Button>
              <Button
                variant={roleFilter === 'secretary' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setRoleFilter('secretary')}
                className="rounded-xl text-xs"
              >
                {t('سكرتارية', 'Secrétariat')} ({stats.secretaries})
              </Button>
              <Button
                variant={roleFilter === 'driver' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setRoleFilter('driver')}
                className="rounded-xl text-xs"
              >
                {t('سائقين', 'Chauffeurs')} ({stats.drivers})
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Users Table / List */}
      <Card className="rounded-2xl border-border bg-card overflow-hidden">
        <CardHeader className="border-b border-border/70 py-4 px-6 flex flex-row items-center justify-between">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            <span>
              {t('قائمة المستخدمين', 'Liste des utilisateurs')} ({filteredUsers.length})
            </span>
          </CardTitle>
        </CardHeader>

        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
              <Loader2 className="w-7 h-7 animate-spin text-primary" />
              <p className="text-sm">{t('جاري تحميل المستخدمين...', 'Chargement des utilisateurs...')}</p>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
              <Users className="w-12 h-12 stroke-1 text-muted-foreground/60 mb-2" />
              <p className="font-semibold text-foreground">
                {t('لا يوجد مستخدمين مطابقين', 'Aucun utilisateur trouvé')}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {searchQuery
                  ? t('جرب تغيير معايير البحث أو التصفية', 'Essayez de modifier votre recherche')
                  : t('قم بإضافة مستخدم جديد للبدء', 'Ajoutez un nouvel utilisateur pour commencer')}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-muted-foreground text-xs">
                    <th className="py-3 px-4 text-start font-semibold">{t('المستخدم', 'Utilisateur')}</th>
                    <th className="py-3 px-4 text-start font-semibold">{t('الدور والصلاحية', 'Rôle & Accès')}</th>
                    <th className="py-3 px-4 text-start font-semibold">{t('حالة الحساب', 'Statut du compte')}</th>
                    <th className="py-3 px-4 text-start font-semibold">{t('اللغة المفضلة', 'Langue')}</th>
                    <th className="py-3 px-4 text-start font-semibold">{t('تاريخ الإنشاء', 'Date de création')}</th>
                    <th className="py-3 px-4 text-end font-semibold">{t('الإجراءات', 'Actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filteredUsers.map((u) => {
                    const isSelf = currentUser?.id === u.id || currentUser?.email?.toLowerCase() === u.email?.toLowerCase();
                    const cfg = roleConfig[u.role] || roleConfig.secretary;
                    const RoleIcon = cfg.icon;
                    const isActive = u.is_active !== false;
                    const isTargetAdmin = u.role === 'admin' || u.role === 'super_admin';
                    const isSecretaryBlocked = isSecretary && isTargetAdmin;

                    return (
                      <tr key={u.id} className="hover:bg-muted/30 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center shrink-0 text-sm border border-primary/20">
                              {(u.name || u.email || 'U').charAt(0).toUpperCase()}
                            </div>
                            <UserAvatar
                              name={u.name}
                              email={u.email}
                              avatarUrl={u.avatar_url}
                              userId={u.id}
                              role={u.role}
                              size="md"
                            />
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="font-semibold text-foreground truncate">
                                  {u.name || t('بدون اسم', 'Sans nom')}
                                </p>
                                {isSelf && (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                                    {t('أنت (حسابك)', 'Vous')}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5 truncate" dir="ltr">
                                <Mail className="w-3 h-3 shrink-0" />
                                <span>{u.email}</span>
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-1.5">
                            <Badge variant="outline" className={`gap-1.5 py-1 px-2.5 font-medium ${cfg.badgeClass}`}>
                              <RoleIcon className="w-3.5 h-3.5" />
                              <span>{cfg.label}</span>
                            </Badge>
                          </div>
                        </td>

                        {/* Account Status with 1-Click Toggle */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {isSecretaryBlocked ? (
                            <span
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 cursor-default select-none"
                              title={t(
                                'حساب مدير النظام محمي ضد التعطيل',
                                'Compte administrateur protégé contre la désactivation',
                                'Cuenta de administrador protegida contra desactivación'
                              )}
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>{isActive ? t('مُفعّل (نشط)', 'Actif') : t('غير مُفعّل', 'Inactif')}</span>
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleToggleActive(u)}
                              disabled={isSelf || togglingActiveId === u.id}
                              title={
                                isSelf
                                  ? t('لا يمكن تعديل حالة حسابك الشخصي', 'Impossible de modifier votre propre statut')
                                  : isActive
                                  ? t('انقر لتعطيل الحساب ومنعه من تسجيل الدخول', 'Cliquer pour désactiver le compte')
                                  : t('انقر لتفعيل الحساب والسماح له بالدخول', 'Cliquer pour activer le compte')
                              }
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold transition-all ${
                                isActive
                                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 hover:bg-rose-500/10 hover:text-rose-600 hover:border-rose-500/30'
                                  : 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30 hover:bg-emerald-500/10 hover:text-emerald-600 hover:border-emerald-500/30'
                              } ${isSelf ? 'cursor-not-allowed opacity-75' : 'cursor-pointer shadow-2xs hover:scale-105 active:scale-95'}`}
                            >
                              {togglingActiveId === u.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : isActive ? (
                                <CheckCircle2 className="w-3.5 h-3.5" />
                              ) : (
                                <XCircle className="w-3.5 h-3.5" />
                              )}
                              <span>{isActive ? t('مُفعّل (نشط)', 'Actif') : t('غير مُفعّل', 'Inactif')}</span>
                            </button>
                          )}
                        </td>

                        <td className="py-3.5 px-4 text-xs text-muted-foreground">
                          {u.preferred_language === 'fr' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-muted text-foreground font-medium">
                              🇫🇷 Français
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-muted text-foreground font-medium">
                              🇲🇦 العربية
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 px-4 text-xs text-muted-foreground whitespace-nowrap">
                          {u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}
                        </td>

                        <td className="py-3.5 px-4 text-end">
                          {isSecretaryBlocked ? (
                            <div className="flex items-center justify-end">
                              <span
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 font-medium text-xs border border-purple-500/20 select-none"
                                title={t(
                                  'لا يمكن للسكرتارية الوصول إلى بيانات حساب المدير أو تعديلها',
                                  'Accès aux données du compte administrateur non autorisé'
                                )}
                              >
                                <ShieldCheck className="w-3.5 h-3.5" />
                                <span>{t('محمي (مدير النظام)', 'Protégé (Admin)')}</span>
                              </span>
                            </div>
                          ) : (
                            <div className="flex items-center justify-end gap-1">
                              {/* Quick 1-click activate/deactivate power button */}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleToggleActive(u)}
                                disabled={isSelf || togglingActiveId === u.id}
                                className={`h-8 w-8 p-0 rounded-lg ${
                                  isActive
                                    ? 'text-emerald-600 hover:text-rose-600 hover:bg-rose-500/10'
                                    : 'text-rose-600 hover:text-emerald-600 hover:bg-emerald-500/10'
                                }`}
                                title={
                                  isSelf
                                    ? t('لا يمكن تعديل حالة حسابك الشخصي', 'Impossible de modifier votre propre statut')
                                    : isActive
                                    ? t('تعطيل الحساب', 'Désactiver le compte')
                                    : t('تفعيل الحساب', 'Activer le compte')
                                }
                              >
                                {togglingActiveId === u.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <Power className="w-4 h-4" />
                                )}
                              </Button>

                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleOpenEditModal(u)}
                                className="h-8 w-8 p-0 rounded-lg hover:bg-primary/10 hover:text-primary"
                                title={t('تعديل البيانات', 'Modifier')}
                              >
                                <Edit2 className="w-4 h-4" />
                              </Button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add / Edit User Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold font-amiri flex items-center gap-2">
              <UserIcon className="w-5 h-5 text-primary" />
              <span>
                {editingUser
                  ? t('تعديل بيانات المستخدم', "Modifier l'utilisateur")
                  : t('إضافة مستخدم جديد', 'Ajouter un utilisateur')}
              </span>
            </DialogTitle>
            <DialogDescription>
              {editingUser
                ? t('تعديل الدور والصلاحيات أو تعيين كلمة مرور جديدة للمستخدم', 'Modifier les informations ou le rôle de cet utilisateur')
                : t('أدخل البيانات الأساسية لإنشاء حساب جديد في المنظومة', 'Remplissez les détails pour créer un compte')}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveUser} className="space-y-4 pt-2">
            {/* قسم صورة المستخدم */}
            <div className="p-3 rounded-2xl bg-muted/30 border border-border/60 flex flex-col sm:flex-row items-center gap-4">
              <UserAvatar
                name={formData.name || 'مستخدم'}
                email={formData.email}
                avatarUrl={formData.avatar_url}
                size="xl"
                className="ring-2 ring-primary/20 shadow-xs"
              />
              <div className="flex-1 space-y-2 text-center sm:text-start w-full">
                <div>
                  <h4 className="text-xs font-bold text-foreground">
                    {t('الصورة الشخصية للمستخدم', "Photo de profil de l'utilisateur")}
                  </h4>
                  <p className="text-[11px] text-muted-foreground">
                    {t('اختر صورة من جهازك أو اختر من النماذج الاحترافية الجاهزة', 'Téléversez une photo ou choisissez parmi les modèles')}
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setCompressing(true);
                      try {
                        const compressed = await compressImageFile(file);
                        setFormData((prev) => ({ ...prev, avatar_url: compressed }));
                      } catch (err) {
                        console.error('Error compressing image:', err);
                      } finally {
                        setCompressing(false);
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={compressing}
                    onClick={() => fileInputRef.current?.click()}
                    className="h-8 text-xs rounded-xl gap-1.5"
                  >
                    <Upload className="w-3.5 h-3.5 text-primary" />
                    {compressing ? t('جاري المعالجة...', 'Traitement...') : t('رفع صورة', 'Téléverser')}
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowPresets(!showPresets)}
                    className="h-8 text-xs rounded-xl gap-1.5"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-purple-500" />
                    {t('نماذج جاهزة', 'Modèles')}
                  </Button>

                  {formData.avatar_url && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setFormData((prev) => ({ ...prev, avatar_url: '' }))}
                      className="h-8 text-xs text-destructive hover:bg-destructive/10 rounded-xl gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      {t('إزالة', 'Supprimer')}
                    </Button>
                  )}
                </div>

                {/* معرض النماذج الجاهزة */}
                {showPresets && (
                  <div className="pt-2 border-t border-border/40">
                    <div className="flex flex-wrap gap-2 pt-1">
                      {PRESET_USER_AVATARS.map((preset) => (
                        <button
                          type="button"
                          key={preset.id}
                          onClick={() => {
                            setFormData((prev) => ({ ...prev, avatar_url: preset.url }));
                            setShowPresets(false);
                          }}
                          className={`relative rounded-full overflow-hidden border-2 transition-all p-0.5 hover:scale-105 ${
                            formData.avatar_url === preset.url
                              ? 'border-primary shadow-xs ring-2 ring-primary/30'
                              : 'border-border/60 hover:border-border'
                          }`}
                          title={preset.label}
                        >
                          <img
                            src={preset.url}
                            alt={preset.label}
                            className="w-9 h-9 object-cover rounded-full"
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Name */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                {t('الاسم الكامل', 'Nom complet')} *
              </label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder={t('مثال: أحمد بنعلي', 'Ex: Ahmed Benali')}
                required
                className="rounded-xl h-10"
              />
            </div>

            {/* Email / Username */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-foreground">
                  {t('اسم المستخدم / البريد الإلكتروني', 'Identifiant / Adresse e-mail')} *
                </label>
                {formData.role !== 'super_admin' && (
                  <span className="text-[10px] text-sky-600 dark:text-sky-400 font-mono font-medium" dir="ltr">
                    @{companyDomain}
                  </span>
                )}
              </div>

              {formData.role === 'super_admin' ? (
                <div className="space-y-1.5">
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="superadmin@system.internal"
                    required
                    dir="ltr"
                    className={`rounded-xl h-10 font-mono text-xs ${
                      usernameConflict ? 'border-amber-500 focus-visible:ring-amber-500' : ''
                    }`}
                  />
                  {usernameConflict && (
                    <div className="flex items-start gap-2 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400 text-xs">
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                      <div className="space-y-0.5">
                        <p className="font-bold text-[11px]">
                          {t('هذا البريد مستخدم بالفعل في المنظومة', 'Adresse email déjà utilisée dans le système')}
                        </p>
                        <p className="text-[11px] leading-relaxed text-amber-800/80 dark:text-amber-300/80">
                          {t(
                            `مسجل للحساب «${usernameConflict.name}» (${roleConfig[usernameConflict.role]?.label || usernameConflict.role}). لا يمكن تكراره.`,
                            `Attribué au compte «${usernameConflict.name}» (${roleConfig[usernameConflict.role]?.label || usernameConflict.role}). Impossible de le dupliquer.`
                          )}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-1.5">
                  <div className="flex items-center" dir="ltr">
                    <Input
                      type="text"
                      value={formData.email}
                      onChange={(e) => {
                        let val = e.target.value.trim().toLowerCase();
                        if (val.includes(`@${companyDomain}`)) {
                          val = val.replace(`@${companyDomain}`, '');
                        } else if (val.includes('@')) {
                          val = val.split('@')[0];
                        }
                        val = val.replace(/[^a-z0-9._-]/g, '');
                        setFormData({ ...formData, email: val });
                      }}
                      placeholder="hamza"
                      required
                      className={`rounded-e-none h-10 font-mono text-xs ${
                        usernameConflict ? 'border-amber-500 focus-visible:ring-amber-500' : ''
                      }`}
                    />
                    <div className="h-10 px-3 bg-muted/80 border border-s-0 border-input rounded-e-xl flex items-center font-mono text-xs font-bold text-sky-600 dark:text-sky-400 select-none whitespace-nowrap shadow-2xs">
                      @{companyDomain}
                    </div>
                  </div>

                  {/* Duplicate username conflict warning banner */}
                  {usernameConflict ? (
                    <div className="flex items-start gap-2 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400 text-xs">
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                      <div className="space-y-0.5">
                        <p className="font-bold text-[11px]">
                          {t('اسم المستخدم محجوز بالفعل في نطاق هذه الشركة', 'Identifiant déjà utilisé dans cette entreprise')}
                        </p>
                        <p className="text-[11px] leading-relaxed text-amber-800/80 dark:text-amber-300/80">
                          {t(
                            `مخصص حالياً للحساب «${usernameConflict.name}» بصلاحية (${roleConfig[usernameConflict.role]?.label || usernameConflict.role}). يمنع تكرار اسم المستخدم لنفس الشركة حتى وإن اختلفت الصلاحية.`,
                            `Attribué à «${usernameConflict.name}» avec le rôle (${roleConfig[usernameConflict.role]?.label || usernameConflict.role}). Impossible de le dupliquer.`
                          )}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-[11px] text-muted-foreground">
                      {t(
                        `البريد الرسمي المعتمد: ${formData.email ? formData.email : 'username'}@${companyDomain}`,
                        `Adresse email officielle : ${formData.email ? formData.email : 'username'}@${companyDomain}`
                      )}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                {editingUser
                  ? t('كلمة المرور الجديدة (اختياري)', 'Nouveau mot de passe (optionnel)')
                  : t('كلمة المرور', 'Mot de passe') + ' *'}
              </label>
              <Input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder={editingUser ? t('اتركها فارغة للإبقاء عليها', 'Laisser vide pour ne pas modifier') : '••••••••'}
                required={!editingUser}
                dir="ltr"
                className="rounded-xl h-10"
              />
            </div>

            {/* Role Selection */}
            {!editingUser ? (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  {t('الدور والصلاحيات في المنظومة', 'Rôle & Permissions')} *
                </label>
                <div className="flex items-center justify-between h-11 px-3 rounded-xl bg-muted/40 border border-input">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 ${roleConfig.driver.badgeClass}`}>
                      <Truck className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="font-semibold text-xs text-foreground">{roleConfig.driver.label}</p>
                      <p className="text-[10px] text-muted-foreground">{roleConfig.driver.desc}</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20 whitespace-nowrap">
                    {t('افتراضي لكل حساب جديد', 'Par défaut')}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {t(
                    'يتم تسجيل أي حساب جديد تلقائياً بصلاحية سائق، ويمكن للسكرتارية تعديله لاحقاً إلى سكرتارية أو إبقائه سائق.',
                    'Tout nouveau compte est enregistré comme chauffeur. Le rôle peut être modifié ultérieurement en secrétaire ou conservé chauffeur.'
                  )}
                </p>
              </div>
            ) : (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  {t('الدور والصلاحيات في المنظومة', 'Rôle & Permissions')} *
                </label>

                <Select
                  value={formData.role}
                  onValueChange={(val) => setFormData({ ...formData, role: val as UserRole })}
                >
                  <SelectTrigger className="h-11 rounded-xl bg-background border-input">
                    <SelectValue placeholder={t('اختر الدور والصلاحية', 'Sélectionnez un rôle')}>
                      {(() => {
                        const cfg = roleConfig[formData.role] || roleConfig.secretary;
                        const Icon = cfg.icon;
                        return (
                          <div className="flex items-center gap-2">
                            <div className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${cfg.badgeClass}`}>
                              <Icon className="w-3.5 h-3.5" />
                            </div>
                            <span className="font-semibold text-xs text-foreground">{cfg.label}</span>
                            <span className="text-[11px] text-muted-foreground hidden sm:inline-block ms-1">
                              — {cfg.desc}
                            </span>
                          </div>
                        );
                      })()}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {availableRoles.map((r) => {
                      const cfg = roleConfig[r];
                      const Icon = cfg.icon;
                      return (
                        <SelectItem key={r} value={r} className="rounded-lg py-2.5 cursor-pointer">
                          <div className="flex items-center gap-2.5">
                            <div className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 ${cfg.badgeClass}`}>
                              <Icon className="w-4 h-4" />
                            </div>
                            <div className="text-start">
                              <p className="font-semibold text-xs text-foreground">{cfg.label}</p>
                              <p className="text-[10px] text-muted-foreground line-clamp-1">{cfg.desc}</p>
                            </div>
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                {isSecretary && (
                  <p className="text-[11px] text-muted-foreground">
                    {t(
                      'يمكن للسكرتارية تعديل الصلاحية إلى سكرتارية أو إبقائها سائق (لا يمكن الترقية إلى مدير النظام).',
                      'Vous pouvez changer le rôle en secrétaire ou le laisser chauffeur (interdit de promouvoir en administrateur).'
                    )}
                  </p>
                )}
              </div>
            )}

            {/* Preferred Language */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                {t('لغة واجهة المستخدم المفضلة', "Langue de l'interface par défaut")}
              </label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={formData.preferred_language === 'ar' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFormData({ ...formData, preferred_language: 'ar' })}
                  className="flex-1 rounded-xl text-xs"
                >
                  🇲🇦 العربية
                </Button>
                <Button
                  type="button"
                  variant={formData.preferred_language === 'fr' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFormData({ ...formData, preferred_language: 'fr' })}
                  className="flex-1 rounded-xl text-xs"
                >
                  🇫🇷 Français
                </Button>
              </div>
            </div>

            <DialogFooter className="flex flex-row justify-end gap-2 pt-3 border-t border-border">
              <Button
                type="button"
                variant="outline"
                onClick={() => setModalOpen(false)}
                disabled={submitting}
                className="rounded-xl"
              >
                {t('إلغاء', 'Annuler')}
              </Button>
              <Button
                type="submit"
                disabled={submitting || !!usernameConflict}
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-xl"
              >
                {submitting ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{t('جاري الحفظ...', 'Enregistrement...')}</span>
                  </div>
                ) : (
                  editingUser ? t('حفظ التعديلات', 'Enregistrer') : t('إضافة المستخدم', 'Créer le compte')
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

