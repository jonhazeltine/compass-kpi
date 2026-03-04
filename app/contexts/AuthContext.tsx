import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Session } from '@supabase/supabase-js';
import { DEFAULT_PERSONA_KEY, DEV_TOOLS_ENABLED, supabase } from '../lib/supabase';
import {
  cacheCurrentSession as cachePersonaSession,
  clearPersonaVault,
  getKnownPersonaKeys,
  signInAndCache as signInAndCachePersonaSession,
  switchToPersona,
} from '../lib/personaVault';
import { resetUserScopedRuntime } from '../lib/devRuntime';

type AuthContextType = {
  session: Session | null;
  loading: boolean;
  runtimeResetVersion: number;
  devToolsEnabled: boolean;
  knownPersonaKeys: string[];
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, metadata?: Record<string, unknown>) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  resetUserScopedCaches: () => Promise<void>;
  cacheCurrentPersonaSession: (personaKey: string) => Promise<void>;
  signInAndCachePersonaSession: (personaKey: string) => Promise<void>;
  switchPersonaSession: (personaKey: string) => Promise<void>;
  clearPersonaSessions: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [runtimeResetVersion, setRuntimeResetVersion] = useState(0);
  const devAutoSignInAttemptedRef = useRef(false);
  const devDefaultPersonaAttemptedRef = useRef(false);
  const knownPersonaKeys = getKnownPersonaKeys();

  const bumpRuntimeResetVersion = () => {
    setRuntimeResetVersion((prev) => prev + 1);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (loading || session || devAutoSignInAttemptedRef.current) return;
    if (process.env.EXPO_PUBLIC_DEV_AUTO_SIGNIN !== 'true') return;

    const email = process.env.EXPO_PUBLIC_DEV_LOGIN_EMAIL?.trim();
    const password = process.env.EXPO_PUBLIC_DEV_LOGIN_PASSWORD ?? '';
    if (!email || !password) return;

    devAutoSignInAttemptedRef.current = true;
    void supabase.auth.signInWithPassword({ email, password });
  }, [loading, session]);

  useEffect(() => {
    if (!DEV_TOOLS_ENABLED || loading || devDefaultPersonaAttemptedRef.current) return;
    const personaKey = DEFAULT_PERSONA_KEY.trim().toLowerCase();
    if (!personaKey) return;
    devDefaultPersonaAttemptedRef.current = true;
    void (async () => {
      try {
        await switchToPersona(personaKey);
      } catch {
        try {
          await signInAndCachePersonaSession(personaKey);
          await switchToPersona(personaKey);
        } catch {
          // keep startup resilient even when persona bootstrap credentials are unavailable
        }
      }
    })();
  }, [loading]);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signUp = async (email: string, password: string, metadata?: Record<string, unknown>) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: metadata ? { data: metadata } : undefined,
    });
    if (error) throw error;
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    bumpRuntimeResetVersion();
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) throw error;
  };

  const resetUserScopedCaches = async () => {
    await resetUserScopedRuntime();
    bumpRuntimeResetVersion();
  };

  const cacheCurrentPersonaSession = async (personaKey: string) => {
    await cachePersonaSession(personaKey);
  };

  const signInAndCachePersona = async (personaKey: string) => {
    await signInAndCachePersonaSession(personaKey);
  };

  const switchPersonaSession = async (personaKey: string) => {
    await switchToPersona(personaKey, {
      onSwitched: async () => {
        await resetUserScopedRuntime();
        bumpRuntimeResetVersion();
      },
    });
  };

  const clearPersonaSessions = async () => {
    await clearPersonaVault(knownPersonaKeys);
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        loading,
        runtimeResetVersion,
        devToolsEnabled: DEV_TOOLS_ENABLED,
        knownPersonaKeys,
        signIn,
        signUp,
        signOut,
        resetPassword,
        resetUserScopedCaches,
        cacheCurrentPersonaSession,
        signInAndCachePersonaSession: signInAndCachePersona,
        switchPersonaSession,
        clearPersonaSessions,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (ctx === undefined) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
