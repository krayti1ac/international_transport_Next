'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/browser';
import type { TraccarConfig } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Server, RefreshCw } from 'lucide-react';
import { useLanguage } from '@/components/language-provider';

interface TraccarConfigFormProps {
  config: TraccarConfig | null;
  onSaved: () => void;
}

export default function TraccarConfigForm({ config, onSaved }: TraccarConfigFormProps) {
  const { t, dir } = useLanguage();
  const [serverUrl, setServerUrl] = useState(config?.traccar_server_url || '');
  const [apiKey, setApiKey] = useState(config?.traccar_api_key || '');
  const [username, setUsername] = useState(config?.traccar_username || '');
  const [password, setPassword] = useState('');
  const [syncInterval, setSyncInterval] = useState(config?.sync_interval_minutes?.toString() || '5');
  const [isActive, setIsActive] = useState(config?.is_active ?? true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const { toast } = useToast();
  const supabase = useCallback(() => createClient(), []);

  useEffect(() => {
    if (config) {
      setServerUrl(config.traccar_server_url || '');
      setApiKey(config.traccar_api_key || '');
      setUsername(config.traccar_username || '');
      setPassword('');
      setSyncInterval(config.sync_interval_minutes?.toString() || '5');
      setIsActive(config.is_active ?? true);
    }
  }, [config]);

  const handleTestConnection = async () => {
    setTesting(true);
    try {
      const response = await fetch('/api/tracking/test-traccar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serverUrl, apiKey, username, password }),
      });

      const result = await response.json();
      if (response.ok && result.success) {
        toast({
          title: t('نجح الاتصال', 'Connexion réussie'),
          description: t(`تم العثور على ${result.deviceCount} جهاز`, `${result.deviceCount} appareils trouvés`),
        });
      } else {
        toast({
          title: t('فشل الاتصال', 'Échec de la connexion'),
          description: result.error || t('تحقق من الإعدادات', 'Vérifiez les paramètres'),
          variant: 'destructive',
        });
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : t('خطأ غير معروف', 'Erreur inconnue');
      toast({
        title: t('خطأ', 'Erreur'),
        description: message,
        variant: 'destructive',
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const supabaseClient = supabase();
      const { data: { user } } = await supabaseClient.auth.getUser();
      if (!user) throw new Error('Unauthorized');

      const { data: profile } = await supabaseClient
        .from('users')
        .select('company_id')
        .eq('id', user.id)
        .single();

      if (!profile?.company_id) throw new Error('No company found');

      const payload = {
        company_id: profile.company_id,
        traccar_server_url: serverUrl,
        traccar_api_key: apiKey || null,
        traccar_username: username || null,
        traccar_password: password || undefined,
        sync_interval_minutes: parseInt(syncInterval, 10) || 5,
        is_active: isActive,
        updated_at: new Date().toISOString(),
      };

      let error;
      if (config) {
        const result = await supabaseClient
          .from('traccar_configs')
          .update(payload)
          .eq('id', config.id);
        error = result.error;
      } else {
        const result = await supabaseClient
          .from('traccar_configs')
          .insert(payload);
        error = result.error;
      }

      if (error) throw error;
      toast({ title: t('تم حفظ الإعدادات بنجاح', 'Configuration enregistrée avec succès') });
      onSaved();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : t('خطأ غير معروف', 'Erreur inconnue');
      toast({
        title: t('خطأ في الحفظ', 'Erreur d\'enregistrement'),
        description: message,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card dir={dir}>
      <CardHeader>
        <CardTitle className="font-amiri flex items-center gap-2">
          <Server className="w-5 h-5 text-primary" />
          {t('إعدادات خادم Traccar', 'Configuration du serveur Traccar')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              {t('عنوان URL للخادم', 'URL du serveur')}
            </label>
            <input
              type="url"
              value={serverUrl}
              onChange={(e) => setServerUrl(e.target.value)}
              placeholder="http://traccar.example.com:8082"
              className="w-full h-10 px-3 py-2 border border-input bg-card text-foreground rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              required
              dir="ltr"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              {t('مفتاح API (Bearer Token)', 'Clé API (Bearer Token)')}
            </label>
            <input
              type="text"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={t('اتركه فارغاً لاستخدام اسم المستخدم وكلمة المرور', 'Laisser vide pour utiliser login/mot de passe')}
              className="w-full h-10 px-3 py-2 border border-input bg-card text-foreground rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              dir="ltr"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                {t('اسم المستخدم', 'Nom d\'utilisateur')}
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full h-10 px-3 py-2 border border-input bg-card text-foreground rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                dir="ltr"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                {t('كلمة المرور', 'Mot de passe')}
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={config ? t('اتركه فارغاً لعدم التغيير', 'Laisser vide pour ne pas changer') : ''}
                className="w-full h-10 px-3 py-2 border border-input bg-card text-foreground rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                dir="ltr"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              {t('فترة المزامنة (دقائق)', 'Intervalle de synchronisation (min)')}
            </label>
            <input
              type="number"
              min="1"
              max="60"
              value={syncInterval}
              onChange={(e) => setSyncInterval(e.target.value)}
              className="w-full h-10 px-3 py-2 border border-input bg-card text-foreground rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              dir="ltr"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isActive"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="w-4 h-4 rounded"
            />
            <label htmlFor="isActive" className="text-sm cursor-pointer">
              {t('تفعيل التتبع', 'Activer le tracking')}
            </label>
          </div>

          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" onClick={handleTestConnection} disabled={testing}>
              {testing ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                t('اختبار الاتصال', 'Tester la connexion')
              )}
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? t('جاري الحفظ...', 'Enregistrement...') : t('حفظ الإعدادات', 'Enregistrer')}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
