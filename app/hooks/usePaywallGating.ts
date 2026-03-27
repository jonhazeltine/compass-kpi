/**
 * usePaywallGating — State-management hook for paywall / upgrade gate UI.
 *
 * Encapsulates the four paywall-modal state variables and exposes
 * show / hide helpers so the host screen never touches raw setters.
 */

import { useCallback, useState } from 'react';

export interface PaywallGatingState {
  visible: boolean;
  title: string;
  message: string;
  requiredPlan: string;
}

export interface PaywallGatingActions {
  showPaywall: (title: string, message: string, plan: string) => void;
  hidePaywall: () => void;
}

export function usePaywallGating(): PaywallGatingState & PaywallGatingActions {
  const [visible, setVisible] = useState(false);
  const [title, setTitle] = useState('Upgrade required');
  const [message, setMessage] = useState('This feature requires a higher plan.');
  const [requiredPlan, setRequiredPlan] = useState('pro');

  const showPaywall = useCallback((t: string, msg: string, plan: string) => {
    setTitle(t);
    setMessage(msg);
    setRequiredPlan(plan);
    setVisible(true);
  }, []);

  const hidePaywall = useCallback(() => {
    setVisible(false);
  }, []);

  return {
    visible,
    title,
    message,
    requiredPlan,
    showPaywall,
    hidePaywall,
  };
}
