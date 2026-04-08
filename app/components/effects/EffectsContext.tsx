/**
 * EffectsContext — Provides the effects API to the entire app.
 *
 * Wraps EffectsOverlay (single Skia Canvas) and exposes fireVortex / fireBurst
 * to any descendant via useEffects().
 *
 * Mount <EffectsProvider> at the app root (HomeScreen) so all screen coordinates
 * are absolute — no safe-area offset translation needed.
 */
import React, { createContext, useCallback, useRef } from 'react';
import { EffectsOverlay } from './EffectsOverlay';
import type { EffectsOverlayHandle } from './EffectsOverlay';

// ── Types ────────────────────────────────────────────────────────────────────

export interface Point {
  x: number;
  y: number;
}

export interface VortexRequest {
  from: Point;
  to: Point;
  count?: number;   // default 100
  color?: string;    // default gold
}

export interface BurstRequest {
  from: Point;
  count?: number;
  color?: string;
}

/** Each slot in the pre-allocated particle pool */
export interface ParticleSlot {
  active: boolean;
  // Source
  sx: number;
  sy: number;
  // Target
  tx: number;
  ty: number;
  // Per-particle randomness (set on spawn)
  angle0: number;      // initial spiral angle offset
  radius: number;      // spiral radius multiplier
  speed: number;       // individual speed factor (0.7–1.3)
  size: number;        // coin size (4–8)
  delay: number;       // stagger delay in ms
  spawnTime: number;   // timestamp when spawned
  duration: number;    // total flight time ms
  color: string;
}

const POOL_SIZE = 200;

function createEmptySlot(): ParticleSlot {
  return {
    active: false,
    sx: 0, sy: 0, tx: 0, ty: 0,
    angle0: 0, radius: 1, speed: 1, size: 6, delay: 0,
    spawnTime: 0, duration: 600, color: '#f5b40f',
  };
}

// ── Context ──────────────────────────────────────────────────────────────────

export interface EffectsAPI {
  fireVortex: (req: VortexRequest) => void;
  fireBurst: (req: BurstRequest) => void;
}

export const EffectsCtx = createContext<EffectsAPI>({
  fireVortex: () => {},
  fireBurst: () => {},
});

// ── Provider ─────────────────────────────────────────────────────────────────

export function EffectsProvider({ children }: { children: React.ReactNode }) {
  const poolRef = useRef<ParticleSlot[]>(
    Array.from({ length: POOL_SIZE }, createEmptySlot),
  );
  const overlayRef = useRef<EffectsOverlayHandle>(null);

  const fireVortex = useCallback((req: VortexRequest) => {
    const pool = poolRef.current;
    const count = Math.min(req.count ?? 30, POOL_SIZE);
    const now = Date.now();

    let spawned = 0;
    for (let i = 0; i < POOL_SIZE && spawned < count; i++) {
      if (pool[i].active) continue;
      const slot = pool[i];
      slot.active = true;
      slot.sx = req.from.x;
      slot.sy = req.from.y;
      slot.tx = req.to.x;
      slot.ty = req.to.y;
      slot.angle0 = Math.random() * Math.PI * 2;
      slot.radius = 0.6 + Math.random() * 0.8;
      slot.speed = 0.7 + Math.random() * 0.6;
      slot.size = 8 + Math.random() * 8;
      slot.delay = 30 + spawned * 3; // 30ms base so all mount first, then 3ms cascade
      slot.spawnTime = now;
      slot.duration = 600 + Math.random() * 400;
      slot.color = req.color ?? '#f5b40f';
      spawned++;
    }

    // Directly kick the render loop — no polling, no delay
    overlayRef.current?.startLoop();
  }, []);

  const fireBurst = useCallback((req: BurstRequest) => {
    const pool = poolRef.current;
    const count = Math.min(req.count ?? 30, POOL_SIZE);
    const now = Date.now();

    let spawned = 0;
    for (let i = 0; i < POOL_SIZE && spawned < count; i++) {
      if (pool[i].active) continue;
      const slot = pool[i];
      slot.active = true;
      slot.sx = req.from.x;
      slot.sy = req.from.y;
      const angle = Math.random() * Math.PI * 2;
      const dist = 40 + Math.random() * 80;
      slot.tx = req.from.x + Math.cos(angle) * dist;
      slot.ty = req.from.y + Math.sin(angle) * dist;
      slot.angle0 = angle;
      slot.radius = 0.3;
      slot.speed = 0.8 + Math.random() * 0.4;
      slot.size = 3 + Math.random() * 3;
      slot.delay = spawned * 4;
      slot.spawnTime = now;
      slot.duration = 300 + Math.random() * 200;
      slot.color = req.color ?? '#f5b40f';
      spawned++;
    }

    overlayRef.current?.startLoop();
  }, []);

  const api: EffectsAPI = { fireVortex, fireBurst };

  return (
    <EffectsCtx.Provider value={api}>
      {children}
      <EffectsOverlay ref={overlayRef} pool={poolRef} />
    </EffectsCtx.Provider>
  );
}
