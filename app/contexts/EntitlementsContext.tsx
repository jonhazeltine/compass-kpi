import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { API_URL } from '../lib/supabase';
import { useAuth } from './AuthContext';

type EntitlementPrimitive = boolean | number | string | null;
type EntitlementMap = Record<string, EntitlementPrimitive>;

type EntitlementsContextType = {
  loading: boolean;
  tier: string;
  effectivePlan: string;
  entitlements: EntitlementMap;
  refresh: () => Promise<void>;
  can: (key: string, fallback?: boolean) => boolean;
  limit: (key: string, fallback?: number) => number;
};

const EntitlementsContext = createContext<EntitlementsContextType | undefined>(undefined);

const DEFAULTS: EntitlementMap = {
  can_start_challenges: true,
  can_create_custom_kpis: false,
  can_export: false,
  advanced_insights: false,
  challenge_invite_limit: 3,
  active_challenge_participation_limit: 1,
  history_days: 30,
};

export function EntitlementsProvider({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  const [loading, setLoading] = useState(true);
  const [tier, setTier] = useState('free');
  const [effectivePlan, setEffectivePlan] = useState('free');
  const [entitlements, setEntitlements] = useState<EntitlementMap>(DEFAULTS);

  const refresh = async () => {
    const token = session?.access_token;
    if (!token) {
      setTier('free');
      setEffectivePlan('free');
      setEntitlements(DEFAULTS);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = (await response.json()) as {
        tier?: unknown;
        effective_plan?: unknown;
        entitlements?: unknown;
      };
      if (!response.ok) {
        throw new Error('Failed to load entitlements');
      }
      setTier(typeof body.tier === 'string' ? body.tier : 'free');
      setEffectivePlan(typeof body.effective_plan === 'string' ? body.effective_plan : 'free');
      setEntitlements(body.entitlements && typeof body.entitlements === 'object' ? (body.entitlements as EntitlementMap) : DEFAULTS);
    } catch {
      setTier('free');
      setEffectivePlan('free');
      setEntitlements(DEFAULTS);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.access_token]);

  const value = useMemo<EntitlementsContextType>(() => ({
    loading,
    tier,
    effectivePlan,
    entitlements,
    refresh,
    can: (key: string, fallback = false) => {
      const value = entitlements[key];
      if (typeof value === 'boolean') return value;
      if (typeof value === 'number') return value !== 0;
      if (typeof value === 'string') {
        const normalized = value.toLowerCase();
        if (normalized === 'true' || normalized === '1' || normalized === 'yes') return true;
        if (normalized === 'false' || normalized === '0' || normalized === 'no') return false;
      }
      return fallback;
    },
    limit: (key: string, fallback = 0) => {
      const value = entitlements[key];
      if (typeof value === 'number' && Number.isFinite(value)) return value;
      if (typeof value === 'string' && value.trim()) {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) return parsed;
      }
      return fallback;
    },
  }), [effectivePlan, entitlements, loading, tier]);

  return <EntitlementsContext.Provider value={value}>{children}</EntitlementsContext.Provider>;
}

export function useEntitlements() {
  const ctx = useContext(EntitlementsContext);
  if (!ctx) throw new Error('useEntitlements must be used within EntitlementsProvider');
  return ctx;
}
