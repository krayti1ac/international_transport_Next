'use client';

import { useState, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Users,
  ShieldCheck,
  UserPlus,
  Search,
  Edit2,
  Trash2,
  Mail,
  User as UserIcon,
  Truck,
  FileText,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
  deleteUserAction,
} from '../services/users.actions';
import type { User, UserRole } from '@/types/database';

export function UserManagementView() {
  const { dir, t } = useLanguage();
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: users = [], isLoading } = useUsersQuery();

  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | UserRole>('all');

  // Modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: 'secretary' as UserRole,
    password: '',
    preferred_language: 'ar' as 'ar' | 'fr',
  });
  const [submitting, setSubmitting] = useState(false);

  // Delete modal state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Role details config
  const roleConfig: Record<
    UserRole,
    { label: string; badgeClass: string; icon: React.ComponentType<{ className?: string }>; desc: string }
  > = {
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

  // Filtered users
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const matchesRole = roleFilter === 'all' || u.role === roleFilter;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        (u.name && u.name.toLowerCase().includes(q)) ||
        (u.email && u.email.toLowerCase().includes(q));
      return matchesRole && matchesSearch;
    });
  }, [users, roleFilter, searchQuery]);

  // Statistics
  const stats = useMemo(() => {
    const total = users.length;
    const admins = users.filter((u) => u.role === 'admin').length;
    const secretaries = users.filter((u) => u.role === 'secretary').length;
    const drivers = users.filter((u) => u.role === 'driver').length;
    return { total, admins, secretaries, drivers };
  }, [users]);

  const handleOpenAddModal = () => {
    setEditingUser(null);
    setFormData({
      name: '',
      email: '',
      role: 'secretary',
      password: '',
      preferred_language: 'ar',
    });
    setModalOpen(true);
  };

  const handleOpenEditModal = (userToEdit: User) => {
    setEditingUser(userToEdit);
    setFormData({
      name: userToEdit.name || '',
      email: userToEdit.email || '',
      role: userToEdit.role || 'secretary',
      password: '',
      preferred_language: (userToEdit.preferred_language === 'en' ? 'ar' : userToEdit.preferred_language) || 'ar',
    });
    setModalOpen(true);
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

    setSubmitting(true);
    try {
      if (editingUser) {
        const res = await updateUserAction({
          id: editingUser.id,
          name: formData.name.trim(),
          role: formData.role,
          password: formData.password ? formData.password : undefined,
          preferred_language: formData.preferred_language,
        });

        if (!res.success) {
          throw new Error(res.error || 'فشل تحديث بيانات المستخدم');
        }

        toast({
          title: t('تم التحديث بنجاح', 'Mis à jour avec succès'),
          description: t('تم تحديث بيانات المستخدم وصلاحياته', "Données de l'utilisateur mises à jour"),
        });
      } else {
        const res = await createUserAction({
          name: formData.name.trim(),
          email: formData.email.trim(),
          role: formData.role,
          password: formData.password,
          preferred_language: formData.preferred_language,
        });

        if (!res.success) {
          throw new Error(res.error || 'فشل إنشاء المستخدم');
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

  const handleConfirmDelete = async () => {
    if (!userToDelete) return;

    if (currentUser && currentUser.id === userToDelete.id) {
      toast({
        title: t('غير مسموح', 'Non autorisé'),
        description: t('لا يمكنك حذف حسابك المسجل به حالياً', 'Vous ne pouvez pas supprimer votre propre compte'),
        variant: 'destructive',
      });
      setDeleteModalOpen(false);
      return;
    }

    setDeleting(true);
    try {
      const res = await deleteUserAction(userToDelete.id);
      if (!res.success) {
        throw new Error(res.error || 'فشل حذف المستخدم');
      }

      toast({
        title: t('تم الحذف', 'Supprimé'),
        description: t('تم حذف المستخدم بنجاح', 'Utilisateur supprimé avec succès'),
      });

      queryClient.invalidateQueries({ queryKey: usersKeys.list() });
      setDeleteModalOpen(false);
      setUserToDelete(null);
    } catch (err: any) {
      toast({
        title: t('خطأ', 'Erreur'),
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setDeleting(false);
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

                    return (
                      <tr key={u.id} className="hover:bg-muted/30 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center shrink-0 text-sm border border-primary/20">
                              {(u.name || u.email || 'U').charAt(0).toUpperCase()}
                            </div>
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
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenEditModal(u)}
                              className="h-8 w-8 p-0 rounded-lg hover:bg-primary/10 hover:text-primary"
                              title={t('تعديل البيانات', 'Modifier')}
                            >
                              <Edit2 className="w-4 h-4" />
                            </Button>

                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setUserToDelete(u);
                                setDeleteModalOpen(true);
                              }}
                              disabled={isSelf}
                              className="h-8 w-8 p-0 rounded-lg text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 disabled:opacity-40"
                              title={isSelf ? t('لا يمكن حذف حسابك', 'Impossible de supprimer votre compte') : t('حذف المستخدم', 'Supprimer')}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
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

            {/* Email */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                {t('البريد الإلكتروني', 'Adresse e-mail')} *
              </label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="user@transbodanon.ma"
                required
                disabled={!!editingUser}
                dir="ltr"
                className="rounded-xl h-10"
              />
              {editingUser && (
                <p className="text-[11px] text-muted-foreground">
                  {t('لا يمكن تعديل البريد الإلكتروني بعد إنشاء الحساب', "L'adresse email ne peut pas être modifiée")}
                </p>
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
            <div className="space-y-2">
              <label className="text-xs font-semibold text-foreground">
                {t('الدور والصلاحيات في المنظومة', 'Rôle & Permissions')} *
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {(['admin', 'secretary', 'driver'] as UserRole[]).map((r) => {
                  const cfg = roleConfig[r];
                  const Icon = cfg.icon;
                  const isSelected = formData.role === r;

                  return (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setFormData({ ...formData, role: r })}
                      className={`p-3 rounded-xl border-2 flex flex-col items-center gap-2 transition-all cursor-pointer text-center relative ${
                        isSelected
                          ? 'border-primary bg-primary/10 shadow-xs ring-1 ring-primary/30'
                          : 'border-border bg-card hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${cfg.badgeClass}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="font-bold text-xs text-foreground">{cfg.label}</p>
                        <p className="text-[10px] text-muted-foreground line-clamp-2 mt-0.5 leading-tight">
                          {cfg.desc}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

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
                disabled={submitting}
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

      {/* Delete User Confirmation Dialog */}
      <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold font-amiri text-rose-600 dark:text-rose-400 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              <span>{t('تأكيد حذف المستخدم', "Confirmation de suppression")}</span>
            </DialogTitle>
            <DialogDescription>
              {t(
                `هل أنت متأكد من رغبتك في حذف حساب المستخدم "${userToDelete?.name || userToDelete?.email}" نهائياً من المنظومة؟`,
                `Êtes-vous sûr de vouloir supprimer définitivement l'utilisateur "${userToDelete?.name || userToDelete?.email}" ?`
              )}
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="flex flex-row justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteModalOpen(false)}
              disabled={deleting}
              className="rounded-xl"
            >
              {t('إلغاء', 'Annuler')}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={deleting}
              className="bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-xl"
            >
              {deleting ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{t('جاري الحذف...', 'Suppression...')}</span>
                </div>
              ) : (
                t('تأكيد الحذف', 'Confirmer la suppression')
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

