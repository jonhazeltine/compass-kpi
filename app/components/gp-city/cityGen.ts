/**
 * Procedural city generation — seeded PRNG, layered skyline.
 * Pure functions, no React or Skia dependencies.
 */

// ── Seeded PRNG (mulberry32) ───────────────────────────────────────────────────

export function createRng(seed: number) {
  let s = seed | 0;
  return (): number => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Types ──────────────────────────────────────────────────────────────────────

export interface Window {
  x: number;
  y: number;
  w: number;
  h: number;
  lit: boolean;
}

export interface Building {
  x: number;
  y: number;
  width: number;
  height: number;
  floors: number;
  windows: Window[];
  layer: 'bg' | 'mid' | 'fg';
  /** Index for targeting micro-step animations */
  index: number;
}

export interface StreetLight {
  x: number;
  groundY: number;
  height: number;
}

export interface Crane {
  x: number;
  baseY: number;
  height: number;
  armLength: number;
  /** Angle of arm in radians */
  armAngle: number;
}

export interface Car {
  x: number;
  y: number;
  width: number;
  direction: 1 | -1;
}

export interface CityData {
  buildings: Building[];
  streetLights: StreetLight[];
  cranes: Crane[];
  cars: Car[];
  groundY: number;
  roadY: number;
}

// ── Generator ──────────────────────────────────────────────────────────────────

export function generateCity(
  seed: number,
  buildingCount: number,
  maxFloors: number,
  windowDensity: number,
  canvasWidth: number,
  canvasHeight: number,
): CityData {
  const rng = createRng(seed);
  const buildings: Building[] = [];
  const streetLights: StreetLight[] = [];
  const cranes: Crane[] = [];
  const cars: Car[] = [];

  const groundY = canvasHeight * 0.82;
  const roadY = groundY + 2;
  const roadHeight = canvasHeight * 0.08;

  if (buildingCount === 0) {
    // Tier 0 — empty lot with a lone lamppost
    streetLights.push({
      x: canvasWidth * 0.5,
      groundY,
      height: 25,
    });
    return { buildings, streetLights, cranes, cars, groundY, roadY };
  }

  // ── Generate buildings across 3 layers ──

  // Distribute buildings across canvas width with slight overlap
  const totalSlots = buildingCount;
  const slotWidth = canvasWidth / totalSlots;

  for (let i = 0; i < buildingCount; i++) {
    const floors = Math.max(1, Math.floor(1 + rng() * maxFloors));
    const floorHeight = 8 + rng() * 4;
    const bHeight = floors * floorHeight;
    const bWidth = slotWidth * (0.6 + rng() * 0.35);
    const bx = i * slotWidth + (slotWidth - bWidth) * rng();

    // Layer assignment: taller buildings in back, shorter in front
    const heightRatio = bHeight / (maxFloors * 12);
    const layer: 'bg' | 'mid' | 'fg' =
      heightRatio > 0.65 ? 'bg' :
      heightRatio > 0.35 ? 'mid' : 'fg';

    // Y offset per layer for depth effect
    const layerOffset = layer === 'bg' ? -8 : layer === 'mid' ? -3 : 0;

    const by = groundY - bHeight + layerOffset;

    // Generate windows
    const windows: Window[] = [];
    const winW = 3;
    const winH = 4;
    const winPadX = 2;
    const winPadY = 3;
    const winsPerRow = Math.floor((bWidth - winPadX * 2) / (winW + winPadX));
    const startX = bx + (bWidth - winsPerRow * (winW + winPadX)) / 2;

    for (let row = 0; row < floors; row++) {
      for (let col = 0; col < winsPerRow; col++) {
        const wx = startX + col * (winW + winPadX) + winPadX;
        const wy = by + row * floorHeight + winPadY + 2;
        const lit = rng() < windowDensity;
        windows.push({ x: wx, y: wy, w: winW, h: winH, lit });
      }
    }

    buildings.push({
      x: bx,
      y: by,
      width: bWidth,
      height: bHeight,
      floors,
      windows,
      layer,
      index: i,
    });
  }

  // Sort by layer for render order (bg first, fg last)
  buildings.sort((a, b) => {
    const order = { bg: 0, mid: 1, fg: 2 };
    return order[a.layer] - order[b.layer];
  });

  // ── Street lights — between buildings ──
  const numLights = Math.max(2, Math.floor(buildingCount * 0.5));
  for (let i = 0; i < numLights; i++) {
    streetLights.push({
      x: (i + 0.5) * (canvasWidth / numLights) + (rng() - 0.5) * 10,
      groundY,
      height: 18 + rng() * 8,
    });
  }

  // ── Cranes — on tallest buildings ──
  const tallest = [...buildings].sort((a, b) => b.height - a.height);
  const numCranes = Math.min(2, Math.floor(buildingCount / 5));
  for (let i = 0; i < numCranes; i++) {
    const b = tallest[i];
    if (!b) continue;
    cranes.push({
      x: b.x + b.width * 0.5,
      baseY: b.y,
      height: 20 + rng() * 15,
      armLength: 15 + rng() * 20,
      armAngle: -0.3 + rng() * 0.6,
    });
  }

  // ── Cars on the road ──
  const numCars = Math.min(5, Math.floor(buildingCount * 0.4));
  for (let i = 0; i < numCars; i++) {
    cars.push({
      x: rng() * canvasWidth,
      y: roadY + roadHeight * 0.3 + rng() * roadHeight * 0.3,
      width: 10 + rng() * 6,
      direction: rng() > 0.5 ? 1 : -1,
    });
  }

  return { buildings, streetLights, cranes, cars, groundY, roadY };
}
