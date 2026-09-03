'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Search, Wrench, ArrowRight } from 'lucide-react';
import { CardViewToggle, useCardViewMode } from '@/components/ui/card-view-toggle';

interface Provider {
  id: number;
  name: string;
  type: string;
  phone?: string;
  email?: string;
  address?: string;
  is_active: boolean;
  created_at: string;
}

export default function ProvidersPage() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [cardLayout, setCardLayout] = useCardViewMode('providers', 'grid');

  const { toast } = useToast();
  const supabase = useMemo(() => createClient(), []);

  const fetchProviders = useCallback(async () => {
    try {
      const { data, error } = await supabase.from('providers').select('*').order('name', { ascending: true });
      if (error) throw error;
      setProviders(data || []);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'خطأ غير متوقع';
      toast({
        title: 'خطأ',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [supabase, toast]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchProviders();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchProviders]);

  const filteredProviders = providers.filter((p) =>
    p.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.type?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-muted-foreground">جاري تحميل المزودين...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-amiri text-foreground">المزودين والورش</h1>
          <p className="text-sm text-muted-foreground mt-0.5">إدارة مزودي الصيانة والوقود</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            placeholder="بحث بالمزود أو النوع..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pr-9 h-9 text-xs rounded-xl"
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
                  <CardTitle className="text-base font-amiri font-bold flex items-center gap-2 text-foreground">
                    <Wrench className="w-4 h-4 text-amber-500" />
                    {provider.name}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between items-center text-foreground">
                    <span className="text-muted-foreground">النوع:</span>
                    <span className="font-medium capitalize">{provider.type}</span>
                  </div>
                  {provider.phone && (
                    <div className="flex justify-between text-foreground">
                      <span className="text-muted-foreground">الهاتف:</span>
                      <span className="font-medium">{provider.phone}</span>
                    </div>
                  )}
                  {provider.email && (
                    <div className="flex justify-between text-foreground">
                      <span className="text-muted-foreground">البريد:</span>
                      <span className="font-medium">{provider.email}</span>
                    </div>
                  )}
                </CardContent>
              </div>
              <div className="p-4 pt-0 border-t border-border mt-3 flex justify-end">
                <Button asChild variant="outline" size="sm">
                  <a href={`/providers/${provider.id}`}>
                    دفتر الأستاذ
                    <ArrowRight className="w-3.5 h-3.5 mr-1" />
                  </a>
                </Button>
              </div>
            </Card>
          ))}
          {filteredProviders.length === 0 && (
            <div className="col-span-full text-center py-12">
              <p className="text-muted-foreground">لا يوجد مزودين مطابقين</p>
            </div>
          )}
        </div>
      ) : (
        /* List View Cards */
        <div className="flex flex-col gap-3">
          {filteredProviders.map((provider) => (
            <Card key={provider.id} className="hover:shadow-md transition-shadow overflow-hidden">
              <div className="p-3.5 flex flex-col lg:flex-row lg:items-center justify-between gap-3.5">
                {/* Right: Name & Type */}
                <div className="flex items-center gap-3 min-w-[200px]">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                    <Wrench className="w-4 h-4" />
                  </div>
                  <div>
                    <CardTitle className="text-base font-amiri font-bold text-foreground">
                      {provider.name}
                    </CardTitle>
                    <span className="text-[11px] text-muted-foreground capitalize">
                      النوع: {provider.type}
                    </span>
                  </div>
                </div>

                {/* Middle: Phone & Email */}
                <div className="flex flex-wrap items-center gap-3 text-xs">
                  {provider.phone && (
                    <div className="bg-muted/30 px-3 py-1.5 rounded-xl border border-border/40 flex items-center gap-1.5 text-foreground">
                      <span className="text-muted-foreground">الهاتف:</span>
                      <span className="font-mono font-medium" dir="ltr">{provider.phone}</span>
                    </div>
                  )}

                  {provider.email && (
                    <div className="bg-muted/30 px-3 py-1.5 rounded-xl border border-border/40 flex items-center gap-1.5 text-foreground">
                      <span className="text-muted-foreground">البريد:</span>
                      <span className="font-mono" dir="ltr">{provider.email}</span>
                    </div>
                  )}
                </div>

                {/* Left: Actions */}
                <div className="flex items-center justify-end border-t lg:border-t-0 pt-2.5 lg:pt-0 border-border/40">
                  <Button asChild variant="outline" size="sm" className="rounded-xl h-8 text-xs">
                    <a href={`/providers/${provider.id}`}>
                      دفتر الأستاذ
                      <ArrowRight className="w-3.5 h-3.5 mr-1" />
                    </a>
                  </Button>
                </div>
              </div>
            </Card>
          ))}
          {filteredProviders.length === 0 && (
            <div className="text-center py-12 bg-card border border-border/80 rounded-2xl">
              <p className="text-muted-foreground">لا يوجد مزودين مطابقين</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
