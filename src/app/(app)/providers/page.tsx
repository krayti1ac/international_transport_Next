'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Search, ArrowRight, Plus, Edit2, Trash2 } from 'lucide-react';
import { CardViewToggle, useCardViewMode } from '@/components/ui/card-view-toggle';
import { useLanguage } from '@/components/language-provider';
import type { Provider } from '@/types/database';
import { ProviderAvatar } from '@/components/providers/ProviderAvatar';
import { ProviderFormModal } from '@/components/providers/ProviderFormModal';
import { cacheProviderPhoto } from '@/lib/provider-photos';

export default function ProvidersPage() {
  const { t, dir } = useLanguage();
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [cardLayout, setCardLayout] = useCardViewMode('providers', 'grid');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProvider, setEditingProvider] = useState<Provider | null>(null);

  const { toast } = useToast();
  const supabase = useMemo(() => createClient(), []);

  const fetchProviders = useCallback(async () => {
    try {
      const { data, error } = await supabase.from('providers').select('*').order('name', { ascending: true });
      if (error) throw error;
      setProviders((data as Provider[]) || []);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : t('خطأ غير متوقع', 'Erreur inattendue');
      toast({
        title: t('خطأ', 'Erreur'),
        description: message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [supabase, toast, t]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchProviders();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchProviders]);

  const handleSaveProvider = async (providerData: Partial<Provider>) => {
    try {
      if (providerData.logo_url) {
        if (editingProvider?.id) {
          cacheProviderPhoto(editingProvider.id, providerData.logo_url);
        }
        if (providerData.name) {
          cacheProviderPhoto(providerData.name.trim().toLowerCase(), providerData.logo_url);
        }
      }

      if (editingProvider) {
        let error: any = null;
        try {
          const res = await (supabase as any)
            .from('providers')
            .update({
              name: providerData.name,
              type: providerData.type,
              phone: providerData.phone,
              email: providerData.email,
              address: providerData.address,
              is_active: providerData.is_active ?? true,
              logo_url: providerData.logo_url,
            })
            .eq('id', editingProvider.id);
          error = res.error;
        } catch (err) {
          error = err;
        }

        if (error && error.message?.includes('logo_url')) {
          const res = await (supabase as any)
            .from('providers')
            .update({
              name: providerData.name,
              type: providerData.type,
              phone: providerData.phone,
              email: providerData.email,
              address: providerData.address,
              is_active: providerData.is_active ?? true,
            })
            .eq('id', editingProvider.id);
          if (res.error) throw res.error;
        } else if (error) {
          throw error;
        }

        toast({
          title: t('تم التحديث بنجاح', 'Mis à jour avec succès'),
          description: t('تم حفظ بيانات المزود / الورشة', 'Données du prestataire mises à jour'),
        });
      } else {
        let error: any = null;
        let insertedData: any = null;
        try {
          const res = await (supabase as any)
            .from('providers')
            .insert([{
              name: providerData.name,
              type: providerData.type,
              phone: providerData.phone,
              email: providerData.email,
              address: providerData.address,
              is_active: providerData.is_active ?? true,
              logo_url: providerData.logo_url,
            }])
            .select();
          error = res.error;
          insertedData = res.data;
        } catch (err) {
          error = err;
        }

        if (error && error.message?.includes('logo_url')) {
          const res = await (supabase as any)
            .from('providers')
            .insert([{
              name: providerData.name,
              type: providerData.type,
              phone: providerData.phone,
              email: providerData.email,
              address: providerData.address,
              is_active: providerData.is_active ?? true,
            }])
            .select();
          if (res.error) throw res.error;
          insertedData = res.data;
        } else if (error) {
          throw error;
        }

        if (insertedData?.[0]?.id && providerData.logo_url) {
          cacheProviderPhoto(insertedData[0].id, providerData.logo_url);
        }

        toast({
          title: t('تمت الإضافة بنجاح', 'Ajouté avec succès'),
          description: t('تم تسجيل المزود / الورشة الجديدة', 'Nouveau prestataire enregistré'),
        });
      }

      fetchProviders();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t('فشل في حفظ المزود', 'Échec de l\'enregistrement');
      toast({
        title: t('خطأ في الحفظ', 'Erreur d\'enregistrement'),
        description: message,
        variant: 'destructive',
      });
      throw err;
    }
  };

  const handleDeleteProvider = async (id: number) => {
    if (!confirm(t('هل أنت متأكد من حذف هذا المزود؟', 'Êtes-vous sûr de vouloir supprimer ce prestataire ?'))) {
      return;
    }
    try {
      const { error } = await supabase.from('providers').delete().eq('id', id);
      if (error) throw error;
      toast({
        title: t('تم الحذف', 'Supprimé'),
        description: t('تم حذف المزود بنجاح', 'Prestataire supprimé avec succès'),
      });
      fetchProviders();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t('فشل في حذف المزود', 'Échec de la suppression');
      toast({
        title: t('خطأ', 'Erreur'),
        description: message,
        variant: 'destructive',
      });
    }
  };

  const filteredProviders = providers.filter((p) =>
    p.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.type?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96" dir={dir}>
        <p className="text-muted-foreground">{t('جاري تحميل المزودين...', 'Chargement des prestataires...')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6" dir={dir}>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold font-amiri text-foreground">
            {t('المزودين والورش', 'Fournisseurs & Ateliers')}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {t('إدارة مزودي الصيانة والوقود والخدمات', 'Gestion des prestataires de maintenance, carburant et services')}
          </p>
        </div>

        <Button
          onClick={() => {
            setEditingProvider(null);
            setIsModalOpen(true);
          }}
          className="bg-amber-600 hover:bg-amber-700 text-white gap-1.5 shadow-xs"
          size="sm"
        >
          <Plus className="w-4 h-4" />
          <span>{t('إضافة مزود / ورشة', 'Ajouter un prestataire')}</span>
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
        <div className="relative flex-1">
          <Search className={`absolute ${dir === 'rtl' ? 'right-3' : 'left-3'} top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4`} />
          <Input
            placeholder={t('بحث بالمزود أو النوع...', 'Rechercher par nom ou type de prestataire...')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`${dir === 'rtl' ? 'pr-9' : 'pl-9'} h-9 text-xs rounded-xl`}
          />
        </div>
        <CardViewToggle viewMode={cardLayout} onChange={setCardLayout} />
      </div>

      {cardLayout === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProviders.map((provider) => (
            <Card key={provider.id} className="hover:shadow-md transition-shadow flex flex-col justify-between">
              <div>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-base font-amiri font-bold flex items-center gap-2.5 text-foreground">
                      <ProviderAvatar
                        name={provider.name}
                        type={provider.type}
                        logoUrl={provider.logo_url || provider.photo_url}
                        providerId={provider.id}
                        size="sm"
                        shape="rounded"
                      />
                      <span className="truncate">{provider.name}</span>
                    </CardTitle>
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium shrink-0 ${
                      provider.is_active !== false
                        ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25'
                        : 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/25'
                    }`}>
                      {provider.is_active !== false ? t('نشط', 'Actif') : t('غير نشط', 'Inactif')}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between items-center text-foreground">
                    <span className="text-muted-foreground">{t('النوع:', 'Type :')}</span>
                    <span className="font-medium capitalize">{provider.type}</span>
                  </div>
                  {provider.phone && (
                    <div className="flex justify-between text-foreground">
                      <span className="text-muted-foreground">{t('الهاتف:', 'Tél :')}</span>
                      <span className="font-medium" dir="ltr">{provider.phone}</span>
                    </div>
                  )}
                  {provider.email && (
                    <div className="flex justify-between text-foreground">
                      <span className="text-muted-foreground">{t('البريد:', 'E-mail :')}</span>
                      <span className="font-medium text-xs" dir="ltr">{provider.email}</span>
                    </div>
                  )}
                  {provider.address && (
                    <div className="flex justify-between text-foreground pt-1 border-t border-border/60">
                      <span className="text-muted-foreground text-xs">{t('العنوان:', 'Adresse :')}</span>
                      <span className="text-xs text-muted-foreground truncate max-w-[180px]">{provider.address}</span>
                    </div>
                  )}
                </CardContent>
              </div>

              <div className="p-4 pt-0 border-t border-border mt-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs px-2.5"
                    onClick={() => {
                      setEditingProvider(provider);
                      setIsModalOpen(true);
                    }}
                    title={t('تعديل البيانات والشعار', 'Modifier')}
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => handleDeleteProvider(provider.id)}
                    title={t('حذف المزود', 'Supprimer')}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>

                <Button asChild variant="outline" size="sm" className="h-8 text-xs">
                  <a href={`/providers/${provider.id}`}>
                    {t('دفتر الأستاذ', 'Grand livre')}
                    <ArrowRight className={`w-3.5 h-3.5 ${dir === 'rtl' ? 'mr-1 rotate-180' : 'ml-1'}`} />
                  </a>
                </Button>
              </div>
            </Card>
          ))}
          {filteredProviders.length === 0 && (
            <div className="col-span-full text-center py-12">
              <p className="text-muted-foreground">{t('لا يوجد مزودين مطابقين', 'Aucun prestataire trouvé')}</p>
            </div>
          )}
        </div>
      ) : (
        /* List View Cards */
        <div className="flex flex-col gap-3">
          {filteredProviders.map((provider) => (
            <Card key={provider.id} className="hover:shadow-md transition-shadow overflow-hidden">
              <div className="p-3.5 flex flex-col lg:flex-row lg:items-center justify-between gap-3.5">
                {/* Right: Avatar, Name & Type */}
                <div className="flex items-center gap-3 min-w-[200px]">
                  <ProviderAvatar
                    name={provider.name}
                    type={provider.type}
                    logoUrl={provider.logo_url || provider.photo_url}
                    providerId={provider.id}
                    size="md"
                    shape="rounded"
                  />
                  <div>
                    <CardTitle className="text-base font-amiri font-bold text-foreground">
                      {provider.name}
                    </CardTitle>
                    <span className="text-[11px] text-muted-foreground capitalize">
                      {t('النوع:', 'Type :')} {provider.type || t('غير محدد', 'Non spécifié')}
                    </span>
                  </div>
                </div>

                {/* Middle: Phone & Email */}
                <div className="flex flex-wrap items-center gap-3 text-xs">
                  {provider.phone && (
                    <div className="bg-muted/30 px-3 py-1.5 rounded-xl border border-border/40 flex items-center gap-1.5 text-foreground">
                      <span className="text-muted-foreground">{t('الهاتف:', 'Tél :')}</span>
                      <span className="font-mono font-medium" dir="ltr">{provider.phone}</span>
                    </div>
                  )}

                  {provider.email && (
                    <div className="bg-muted/30 px-3 py-1.5 rounded-xl border border-border/40 flex items-center gap-1.5 text-foreground">
                      <span className="text-muted-foreground">{t('البريد:', 'E-mail :')}</span>
                      <span className="font-mono" dir="ltr">{provider.email}</span>
                    </div>
                  )}
                </div>

                {/* Left: Actions */}
                <div className="flex items-center justify-end gap-1.5 border-t lg:border-t-0 pt-2.5 lg:pt-0 border-border/40">
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-xl h-8 text-xs px-2.5"
                    onClick={() => {
                      setEditingProvider(provider);
                      setIsModalOpen(true);
                    }}
                  >
                    <Edit2 className="w-3.5 h-3.5 me-1" />
                    {t('تعديل', 'Modifier')}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="rounded-xl h-8 text-xs px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => handleDeleteProvider(provider.id)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                  <Button asChild variant="outline" size="sm" className="rounded-xl h-8 text-xs">
                    <a href={`/providers/${provider.id}`}>
                      {t('دفتر الأستاذ', 'Grand livre')}
                      <ArrowRight className={`w-3.5 h-3.5 ${dir === 'rtl' ? 'mr-1 rotate-180' : 'ml-1'}`} />
                    </a>
                  </Button>
                </div>
              </div>
            </Card>
          ))}
          {filteredProviders.length === 0 && (
            <div className="text-center py-12 bg-card border border-border/80 rounded-2xl">
              <p className="text-muted-foreground">{t('لا يوجد مزودين مطابقين', 'Aucun prestataire trouvé')}</p>
            </div>
          )}
        </div>
      )}

      {/* نموذج إضافة / تعديل المزود والشعار */}
      <ProviderFormModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingProvider(null);
        }}
        onSave={handleSaveProvider}
        initialData={editingProvider}
      />
    </div>
  );
}
