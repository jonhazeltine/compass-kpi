/**
 * useEffects — Consumer hook for the effects engine.
 *
 * Usage:
 *   const { fireVortex, fireBurst } = useEffects();
 *   fireVortex({ from: { x: 100, y: 400 }, to: { x: 200, y: 100 }, count: 100 });
 */
import { useContext } from 'react';
import { EffectsCtx } from './EffectsContext';
import type { EffectsAPI } from './EffectsContext';

export function useEffects(): EffectsAPI {
  return useContext(EffectsCtx);
}
