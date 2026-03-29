/**
 * Procedural tree generation — seeded PRNG, recursive branching.
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

export interface Branch {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /** Control point for quadratic bézier curve */
  cx: number;
  cy: number;
  thickness: number;
  depth: number;
}

export interface Leaf {
  x: number;
  y: number;
  size: number;
  rotation: number;
  branchIndex: number;
}

export interface RootSegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  cx: number;
  cy: number;
  thickness: number;
}

export interface GroundFlora {
  x: number;
  y: number;
  kind: 'mushroom' | 'flower';
  size: number;
}

export interface CreaturePositions {
  squirrel: { x: number; y: number } | null;
  nest: { x: number; y: number } | null;
  owl: { x: number; y: number } | null;
  deer: { x: number; y: number };
  wispCenters: { x: number; y: number }[];
}

export interface ZoomTarget {
  x: number;
  y: number;
  label: string;
}

export interface TreeData {
  branches: Branch[];
  leaves: Leaf[];
  roots: RootSegment[];
  groundFlora: GroundFlora[];
  trunkBase: { x: number; y: number };
  canopyCenter: { x: number; y: number };
  /** Scale factor to fit the tree within canvas bounds (apply to tree group) */
  fitScale: number;
  creatures: CreaturePositions;
  zoomTargets: ZoomTarget[];
}

// ── Generator ──────────────────────────────────────────────────────────────────

export function generateTree(
  seed: number,
  maxDepth: number,
  leafDensity: number,
  canvasWidth: number,
  canvasHeight: number,
  trunkScale = 1.0,
  spreadScale = 1.0,
  horizontalBias = 0,
): TreeData {
  const rng = createRng(seed);
  const branches: Branch[] = [];
  const leaves: Leaf[] = [];
  const roots: RootSegment[] = [];
  const groundFlora: GroundFlora[] = [];

  const baseX = canvasWidth / 2;
  const baseY = canvasHeight * 0.85;
  // Wider trees have shorter trunks — grows out, not up (old oak silhouette)
  const verticalDampen = 1 - horizontalBias * 0.45;
  const trunkLength = (canvasHeight * 0.12 + maxDepth * 2.5) * trunkScale * verticalDampen;
  const initialThickness = (6 + maxDepth * 2.5) * trunkScale;

  function addBranch(
    x1: number,
    y1: number,
    angle: number,
    length: number,
    thickness: number,
    depth: number,
  ) {
    if (depth > maxDepth) return;

    const x2 = x1 + Math.cos(angle) * length;
    const y2 = y1 + Math.sin(angle) * length;

    // Slight bézier curve for organic feel
    const perpAngle = angle + Math.PI / 2;
    const curvature = (rng() - 0.5) * length * 0.25;
    const cx = (x1 + x2) / 2 + Math.cos(perpAngle) * curvature;
    const cy = (y1 + y2) / 2 + Math.sin(perpAngle) * curvature;

    branches.push({ x1, y1, x2, y2, cx, cy, thickness, depth });
    const branchIdx = branches.length - 1;

    // Leaves at or near terminal branches
    if (leafDensity > 0 && depth >= maxDepth - 1) {
      // Much more leaves at higher stages — dense, full canopy
      const densityBoost = 1 + horizontalBias * 2.5;
      const numLeaves = Math.floor((3 + rng() * 6 * leafDensity) * densityBoost);
      for (let i = 0; i < numLeaves; i++) {
        const leafAngle = rng() * Math.PI * 2;
        const leafDist = (3 + rng() * 14) * spreadScale;
        leaves.push({
          x: x2 + Math.cos(leafAngle) * leafDist,
          y: y2 + Math.sin(leafAngle) * leafDist,
          size: (3 + rng() * 4.5) * Math.min(trunkScale, 1.4),
          rotation: rng() * Math.PI,
          branchIndex: branchIdx,
        });
      }
    }

    // Recurse children — more branches at higher horizontalBias for fuller canopy
    if (depth < maxDepth) {
      // Oak-like: more children per branch at higher stages
      const extraChildren = horizontalBias > 0.3 ? 1 : 0;
      const numChildren = (depth === 0 ? 3 : 2 + (rng() > 0.5 ? 1 : 0)) + extraChildren;
      // Wider spread angle at higher stages
      const spreadBase = (depth === 0 ? 1.1 : 0.75) * spreadScale;

      for (let i = 0; i < numChildren; i++) {
        const childSpread = (i / (numChildren - 1 || 1) - 0.5) * spreadBase;
        let childAngle = angle + childSpread + (rng() - 0.5) * 0.2;

        // Pull branches strongly toward horizontal — old oak effect
        if (horizontalBias > 0 && depth >= 1) {
          const depthFactor = Math.min(1, (depth + 0.5) / maxDepth);
          // Target nearly horizontal with slight droop (like real oak limbs)
          const targetAngle = childAngle < -Math.PI / 2
            ? -Math.PI + 0.15 + rng() * 0.15   // left side: nearly horizontal
            : -0.15 - rng() * 0.15;              // right side: nearly horizontal
          childAngle = childAngle + (targetAngle - childAngle) * horizontalBias * depthFactor;
        }

        // First fork branches (depth 1) are major limbs — nearly as long as trunk
        // Deeper branches get progressively shorter
        const isMainLimb = depth === 0;
        const lengthBoost = isMainLimb
          ? 1 + horizontalBias * 0.6   // main limbs grow much longer at high bias
          : 1 + horizontalBias * 0.2;
        const baseRatio = isMainLimb ? (0.65 + rng() * 0.2) : (0.55 + rng() * 0.25);
        const childLength = length * baseRatio * lengthBoost;
        // Thicker child branches for that gnarled oak feel
        const thicknessRetain = 0.58 + horizontalBias * 0.12;
        const childThickness = Math.max(1.8, thickness * thicknessRetain);
        addBranch(x2, y2, childAngle, childLength, childThickness, depth + 1);
      }
    }
  }

  // Trunk grows nearly straight up with a slight organic lean
  const trunkAngle = -Math.PI / 2 + (rng() - 0.5) * 0.08;
  addBranch(baseX, baseY, trunkAngle, trunkLength, initialThickness, 0);

  // ── Generate roots (recursive branching root system) ──
  function addRoot(
    rx1: number, ry1: number, angle: number,
    length: number, thickness: number, depth: number, maxRootDepth: number,
  ) {
    const rx2 = rx1 + Math.cos(angle) * length;
    const ry2 = ry1 + Math.sin(angle) * length;
    // Gnarly curvature
    const perpA = angle + Math.PI / 2;
    const curve = (rng() - 0.5) * length * 0.35;
    const rcx = (rx1 + rx2) / 2 + Math.cos(perpA) * curve;
    const rcy = (ry1 + ry2) / 2 + Math.sin(perpA) * curve;
    roots.push({ x1: rx1, y1: ry1, x2: rx2, y2: ry2, cx: rcx, cy: rcy, thickness });

    if (depth < maxRootDepth) {
      const numChildren = 1 + (rng() > 0.4 ? 1 : 0);
      for (let c = 0; c < numChildren; c++) {
        const childAngle = angle + (rng() - 0.5) * 0.8;
        const childLen = length * (0.55 + rng() * 0.25);
        const childThick = Math.max(1, thickness * 0.6);
        addRoot(rx2, ry2, childAngle, childLen, childThick, depth + 1, maxRootDepth);
      }
    }
  }

  const numMainRoots = 4 + Math.floor(rng() * 3);
  const rootDepthMax = Math.min(3, Math.floor(1 + trunkScale));
  for (let i = 0; i < numMainRoots; i++) {
    const spread = ((i / (numMainRoots - 1)) - 0.5) * 2;
    const rootAngle = Math.PI / 2 + spread * 0.75 + (rng() - 0.5) * 0.2;
    const rootLen = (18 + rng() * 22) * trunkScale;
    const rootThick = (2.5 + rng() * 2.5) * trunkScale;
    addRoot(baseX, baseY, rootAngle, rootLen, rootThick, 0, rootDepthMax);
  }

  // ── Generate ground flora (mushrooms + flowers at base) ──
  const numFlora = 3 + Math.floor(rng() * 4);
  for (let i = 0; i < numFlora; i++) {
    const fx = baseX + (rng() - 0.5) * canvasWidth * 0.55;
    const fy = baseY + 2 + rng() * 8;
    groundFlora.push({
      x: fx,
      y: fy,
      kind: rng() > 0.5 ? 'mushroom' : 'flower',
      size: 3 + rng() * 4,
    });
  }

  // Canopy center (average of all leaf positions)
  let cx = 0;
  let cy = 0;
  const n = leaves.length || 1;
  for (const l of leaves) {
    cx += l.x;
    cy += l.y;
  }

  // ── Auto-fit: compute bounding box and scale to fit canvas ──
  let minX = baseX;
  let maxX = baseX;
  let minY = baseY;
  for (const b of branches) {
    minX = Math.min(minX, b.x2, b.cx);
    maxX = Math.max(maxX, b.x2, b.cx);
    minY = Math.min(minY, b.y2, b.cy);
  }
  for (const l of leaves) {
    minX = Math.min(minX, l.x - l.size);
    maxX = Math.max(maxX, l.x + l.size);
    minY = Math.min(minY, l.y - l.size);
  }

  const padding = 12;
  const treeWidth = maxX - minX + padding * 2;
  const treeHeight = baseY - minY + padding;
  const scaleX = (canvasWidth - padding * 2) / treeWidth;
  const scaleY = (canvasHeight * 0.8) / treeHeight;
  const fitScale = Math.min(1, scaleX, scaleY);

  const canopyCx = cx / n;
  const canopyCy = cy / n;

  // ── Creature positions (computed from branch geometry) ──
  const depth2Branches = branches.filter(b => b.depth === 2);
  const depth3Branches = branches.filter(b => b.depth === 3);
  const forkBranches = branches.filter(b => b.depth === 1);

  const creatures: CreaturePositions = {
    squirrel: depth2Branches.length > 0
      ? { x: depth2Branches[0].x2, y: depth2Branches[0].y2 - 4 }
      : leaves.length > 0 ? { x: leaves[0].x, y: leaves[0].y - 4 } : null,
    nest: forkBranches.length > 1
      ? { x: forkBranches[1].x2, y: forkBranches[1].y2 }
      : depth2Branches.length > 1 ? { x: depth2Branches[1].x2, y: depth2Branches[1].y2 } : null,
    owl: depth3Branches.length > 0
      ? { x: depth3Branches[Math.floor(depth3Branches.length / 2)].x2, y: depth3Branches[Math.floor(depth3Branches.length / 2)].y2 - 6 }
      : depth2Branches.length > 2 ? { x: depth2Branches[2].x2, y: depth2Branches[2].y2 - 6 } : null,
    deer: { x: baseX - 20, y: baseY },
    wispCenters: Array.from({ length: 5 }, (_, i) => ({
      x: canopyCx + (rng() - 0.5) * 50,
      y: canopyCy + (rng() - 0.5) * 30,
    })),
  };

  // ── Zoom targets (points of interest for zoom animations) ──
  const zoomTargets: ZoomTarget[] = [];
  // Branch endpoints at depth 2-3 (interesting detail areas)
  for (const b of depth2Branches.slice(0, 3)) {
    zoomTargets.push({ x: b.x2, y: b.y2, label: 'branch' });
  }
  for (const b of depth3Branches.slice(0, 2)) {
    zoomTargets.push({ x: b.x2, y: b.y2, label: 'twig' });
  }
  // Canopy center
  zoomTargets.push({ x: canopyCx, y: canopyCy, label: 'canopy' });
  // Trunk base (root area)
  zoomTargets.push({ x: baseX, y: baseY - 10, label: 'trunk' });
  // Creature positions
  if (creatures.squirrel) zoomTargets.push({ ...creatures.squirrel, label: 'squirrel' });
  if (creatures.nest) zoomTargets.push({ ...creatures.nest, label: 'nest' });
  if (creatures.owl) zoomTargets.push({ ...creatures.owl, label: 'owl' });

  return {
    branches,
    leaves,
    roots,
    groundFlora,
    trunkBase: { x: baseX, y: baseY },
    canopyCenter: { x: canopyCx, y: canopyCy },
    fitScale,
    creatures,
    zoomTargets,
  };
}
