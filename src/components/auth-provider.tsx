'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { User, UserRole, Company } from '@/types/database';
import { useAuthStore } from '@/lib/stores/auth-store';

interface AuthContextType {
  user: User | null;
  role: UserRole | null;
  company: Company | null;
  companyId: number | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ user?: User; role?: UserRole; company?: Company | null; error?: string }>;
  signUp: (email: string, password: string, name: string, companyId?: number) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  refreshCompany: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();
  const setAuthStoreUser = useAuthStore((s) => s.setUser);
  const setAuthStoreCompany = useAuthStore((s) => s.setCompany);

  const fetchCompany = useCallback(async (companyId: number | null | undefined): Promise<Company | null> => {
    if (!companyId) return null;
    try {
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .eq('id', companyId)
        .maybeSingle();
      if (!error && data) {
        return data as Company;
      }
    } catch (e) {
      console.warn('Could not fetch company info:', e);
    }
    return null;
  }, [supabase]);

  const refreshCompany = useCallback(async () => {
    const currentCompanyId = user?.company_id || company?.id;
    if (currentCompanyId) {
      const refreshed = await fetchCompany(currentCompanyId);
      if (refreshed) {
        setCompany(refreshed);
        setAuthStoreCompany(refreshed);
        setUser((prev) => (prev ? { ...prev, company: refreshed } : null));
      }
    }
  }, [user?.company_id, company?.id, fetchCompany, setAuthStoreCompany]);

  useEffect(() => {
    const getUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { data } = await supabase
          .from('users')
          .select('*')
          .eq('id', session.user.id)
          .single();
        
        if (data) {
          const userLang = (data.preferred_language || (
            typeof window !== 'undefined'
              ? (localStorage.getItem(`user_lang_${data.id}`) || localStorage.getItem(`user_lang_${(data.email || '').toLowerCase()}`))
              : null
           ) || 'ar') as 'ar' | 'fr' | 'es';

          if (typeof window !== 'undefined') {
            try {
              localStorage.setItem('app_locale', userLang);
              localStorage.setItem(`user_lang_${data.id}`, userLang);
              if (data.email) {
                localStorage.setItem(`user_lang_${data.email.toLowerCase()}`, userLang);
              }
              document.documentElement.lang = userLang;
              document.documentElement.dir = userLang === 'ar' ? 'rtl' : 'ltr';
              document.cookie = `NEXT_LOCALE=${userLang}; path=/; max-age=31536000; SameSite=Lax`;
              window.dispatchEvent(new CustomEvent('app-language-changed', { detail: { locale: userLang } }));
            } catch (e) {}
          }

          const comp = await fetchCompany(data.company_id);
          setCompany(comp);
          setAuthStoreCompany(comp);

          const loggedInUser: User = {
            id: data.id,
            email: data.email || session.user.email || '',
            role: data.role,
            name: data.name || '',
            created_at: data.created_at,
            theme_mode: data.theme_mode,
            mfa_enabled: data.mfa_enabled,
            preferred_language: userLang,
            company_id: data.company_id || (comp?.id ?? null),
            company: comp || undefined,
          };

          setUser(loggedInUser);
          setRole(data.role);
          setAuthStoreUser(loggedInUser);
        }
      }
      setLoading(false);
    };

    getUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        const { data } = await supabase
          .from('users')
          .select('*')
          .eq('id', session.user.id)
          .single();
        
        if (data) {
          const userLang = (data.preferred_language || (
            typeof window !== 'undefined'
              ? (localStorage.getItem(`user_lang_${data.id}`) || localStorage.getItem(`user_lang_${(data.email || '').toLowerCase()}`))
              : null
           ) || 'ar') as 'ar' | 'fr' | 'es';

          if (typeof window !== 'undefined') {
            try {
              localStorage.setItem('app_locale', userLang);
              localStorage.setItem(`user_lang_${data.id}`, userLang);
              if (data.email) {
                localStorage.setItem(`user_lang_${data.email.toLowerCase()}`, userLang);
              }
              document.documentElement.lang = userLang;
              document.documentElement.dir = userLang === 'ar' ? 'rtl' : 'ltr';
              document.cookie = `NEXT_LOCALE=${userLang}; path=/; max-age=31536000; SameSite=Lax`;
              window.dispatchEvent(new CustomEvent('app-language-changed', { detail: { locale: userLang } }));
            } catch (e) {}
          }

          const comp = await fetchCompany(data.company_id);
          setCompany(comp);
          setAuthStoreCompany(comp);

          const loggedInUser: User = {
            id: data.id,
            email: data.email || session.user.email || '',
            role: data.role,
            name: data.name || '',
            created_at: data.created_at,
            theme_mode: data.theme_mode,
            mfa_enabled: data.mfa_enabled,
            preferred_language: userLang,
            company_id: data.company_id || (comp?.id ?? null),
            company: comp || undefined,
          };

          setUser(loggedInUser);
          setRole(data.role);
          setAuthStoreUser(loggedInUser);
        }
      } else {
        setUser(null);
        setCompany(null);
        setRole(null);
        setAuthStoreUser(null);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [supabase, fetchCompany, setAuthStoreCompany, setAuthStoreUser]);

  const signIn = async (email: string, password: string) => {
    const cleanEmail = email.trim().toLowerCase();
    const res = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password,
    });
    let authData = res.data;
    let error = res.error;

    // Smart fallback if user entered '123' for an initial auto-created admin account
    if (error && password === '123') {
      const fallbackRes = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: '123456',
      });
      if (!fallbackRes.error && fallbackRes.data) {
        authData = fallbackRes.data;
        error = null;
      }
    }

    if (error) return { error: error.message };

    if (authData?.user) {
      const { data: profile } = await supabase
        .from('users')
        .select('*')
        .eq('id', authData.user.id)
        .single();

      if (profile) {
        const userLang = (profile.preferred_language || (
          typeof window !== 'undefined'
            ? (localStorage.getItem(`user_lang_${profile.id}`) || localStorage.getItem(`user_lang_${(profile.email || email).toLowerCase()}`))
            : null
         ) || 'ar') as 'ar' | 'fr' | 'es';

        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem('app_locale', userLang);
            localStorage.setItem(`user_lang_${profile.id}`, userLang);
            localStorage.setItem(`user_lang_${(profile.email || email).toLowerCase()}`, userLang);
            document.documentElement.lang = userLang;
            document.documentElement.dir = userLang === 'ar' ? 'rtl' : 'ltr';
            document.cookie = `NEXT_LOCALE=${userLang}; path=/; max-age=31536000; SameSite=Lax`;
            window.dispatchEvent(new CustomEvent('app-language-changed', { detail: { locale: userLang } }));
          } catch (e) {}
        }

        const comp = await fetchCompany(profile.company_id);
        setCompany(comp);
        setAuthStoreCompany(comp);

        const loggedInUser: User = {
          id: profile.id,
          email: profile.email || authData.user.email || '',
          role: profile.role,
          name: profile.name || '',
          created_at: profile.created_at,
          theme_mode: profile.theme_mode,
          mfa_enabled: profile.mfa_enabled,
          preferred_language: userLang,
          company_id: profile.company_id || (comp?.id ?? null),
          company: comp || undefined,
        };

        setUser(loggedInUser);
        setRole(profile.role);
        setAuthStoreUser(loggedInUser);
        return { user: loggedInUser, role: profile.role, company: comp };
      }
    }
    return {};
  };

  const signUp = async (email: string, password: string, name: string, companyId?: number) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
    });
    if (error) return { error: error.message };

    const { data: { user: newUser } } = await supabase.auth.getUser();
    if (newUser) {
      await supabase.from('users').insert({
        id: newUser.id,
        email,
        name,
        role: 'secretary',
        company_id: companyId || 1,
      });
    }
    return {};
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setCompany(null);
    setRole(null);
    useAuthStore.getState().logout();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        company,
        companyId: company?.id ?? user?.company_id ?? null,
        loading,
        signIn,
        signUp,
        signOut,
        refreshCompany,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
