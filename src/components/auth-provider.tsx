'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { User, UserRole } from '@/types/database';

interface AuthContextType {
  user: User | null;
  role: UserRole | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ user?: User; role?: UserRole; error?: string }>;
  signUp: (email: string, password: string, name: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

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
          setUser({
            id: data.id,
            email: data.email || session.user.email || '',
            role: data.role,
            name: data.name || '',
            created_at: data.created_at,
            theme_mode: data.theme_mode,
            mfa_enabled: data.mfa_enabled,
          });
          setRole(data.role);
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
          setUser({
            id: data.id,
            email: data.email || session.user.email || '',
            role: data.role,
            name: data.name || '',
            created_at: data.created_at,
            theme_mode: data.theme_mode,
            mfa_enabled: data.mfa_enabled,
          });
          setRole(data.role);
        }
      } else {
        setUser(null);
        setRole(null);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  const signIn = async (email: string, password: string) => {
    const { data: authData, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) return { error: error.message };

    if (authData?.user) {
      const { data: profile } = await supabase
        .from('users')
        .select('*')
        .eq('id', authData.user.id)
        .single();

      if (profile) {
        const loggedInUser: User = {
          id: profile.id,
          email: profile.email || authData.user.email || '',
          role: profile.role,
          name: profile.name || '',
          created_at: profile.created_at,
          theme_mode: profile.theme_mode,
          mfa_enabled: profile.mfa_enabled,
        };
        setUser(loggedInUser);
        setRole(profile.role);
        return { user: loggedInUser, role: profile.role };
      }
    }
    return {};
  };

  const signUp = async (email: string, password: string, name: string) => {
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
      });
    }
    return {};
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setRole(null);
  };

  return (
    <AuthContext.Provider value={{ user, role, loading, signIn, signUp, signOut }}>
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
