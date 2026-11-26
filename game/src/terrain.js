// Skylark Courier — the island of Kestrel Cay: terrain, runways, rings, trees, clouds.
// Every placement is deterministic (seeded hash noise), so the same island renders
// on every machine and every screenshot run. Heights are in metres, y is up.

import { WORLD, LOOK } from './config.js';

function hash2(ix, iz) {
  let h = (ix * 374761393 + iz * 668265263) | 0;
  h = (h ^ (h >> 13)) | 0;
  h = Math.imul(h, 1274126177);
  h = (h ^ (h >> 16)) >>> 0;
  return h / 4294967295;
}

function smooth(t) {
  return t * t * (3 - 2 * t);
}

// Value noise over the island grid, two octaves.
function noise(x, z) {
  const gx = x / 420;
  const gz = z / 420;
  const ix = Math.floor(gx);
  const iz = Math.floor(gz);
  const fx = smooth(gx - ix);
  const fz = smooth(gz - iz);
  const a = hash2(ix, iz);
  const b = hash2(ix + 1, iz);
  const c = hash2(ix, iz + 1);
  const d = hash2(ix + 1, iz + 1);
  const top = a + (b - a) * fx;
  const bottom = c + (d - c) * fx;
  return top + (bottom - top) * fz;
}

// Distance from the island centre, 0 at the middle, 1 at the shore.
function shoreFactor(x, z) {
  const r = Math.sqrt(x * x + z * z) / WORLD.halfSize;
  return Math.min(1, Math.max(0, r));
}

// Flatten the ground around each runway so the strip sits on level earth, and
// carve a gentle approach valley along each runway's extended centreline so a
// landing aircraft can descend to the threshold without meeting a hillside.
function runwayFlatten(x, z) {
  let flat = 0;
  for (const r of WORLD.runways) {
    const rad = (r.heading * Math.PI) / 180;
    const fx = Math.sin(rad);
    const fz = -Math.cos(rad);
    const dx = x - r.x;
    const dz = z - r.z;
    const along = dx * fx + dz * fz;
    const across = -dx * fz + dz * fx;
    const absAlong = Math.abs(along);
    const absAcross = Math.abs(across);
    // A flat corridor along the strip: fully flat within 60 m of the centreline
    // and across the whole strip, tapering out to 250 m across and 160 m past
    // each threshold, so takeoffs and landings never meet a hillside.
    if (absAlong < r.length / 2 + 160 && absAcross < 250) {
      const overAlong = Math.max(0, absAlong - r.length / 2) / 160;
      const overAcross = Math.max(0, absAcross - 60) / 190;
      const edge = Math.max(overAlong, overAcross);
      flat = Math.max(flat, 1 - smooth(Math.min(1, Math.max(0, edge))));
    }
    // Approach valley: beyond each threshold, a corridor 200 m wide, 900 m long,
    // flattening toward the runway's level and fading out with distance.
    if (absAlong > r.length / 2 && absAlong < r.length / 2 + 900 && absAcross < 200) {
      const out = (absAlong - r.length / 2) / 900;
      const side = absAcross / 200;
      const valley = (1 - smooth(out)) * (1 - smooth(side));
      flat = Math.max(flat, valley);
    }
  }
  return flat;
}

export function terrainHeight(x, z) {
  const shore = shoreFactor(x, z);
  if (shore >= 1) return -6; // open sea
  const hills = noise(x, z) * 0.65 + noise(x * 2.3 + 700, z * 2.3 - 400) * 0.35;
  let h = hills * WORLD.maxHill * (1 - shore * shore);
  // Beach ring: low sand just inside the shore.
  if (shore > 0.82) h = Math.min(h, 4 + (0.98 - shore) * 60);
  const flat = runwayFlatten(x, z);
  return h * (1 - flat) + 6 * flat;
}

export function groundColor(x, z, h) {
  const shore = shoreFactor(x, z);
  if (h < 2.5 && shore > 0.8) return LOOK.sand;
  if (h > 190) return LOOK.snow;
  if (h > 120) return LOOK.rock;
  // Patchy grass: two greens mixed by noise so fields read as fields.
  return noise(x * 3.1, z * 3.1) > 0.5 ? LOOK.grassLow : LOOK.grassHigh;
}

// The eight golden rings of the Ring Run, hung over valleys and the coast.
export const RINGS = [
  { x: 500, y: 150, z: -700, r: 32 },
  { x: 900, y: 190, z: 200, r: 32 },
  { x: 300, y: 230, z: 900, r: 32 },
  { x: -500, y: 180, z: 1050, r: 32 },
  { x: -1100, y: 210, z: 250, r: 32 },
  { x: -900, y: 160, z: -750, r: 32 },
  { x: -200, y: 240, z: -1250, r: 32 },
  { x: 650, y: 130, z: -1450, r: 32 },
];

// The direction a ring faces: along the circuit toward the next ring.
export function ringNormal(ring, index) {
  const next = RINGS[(index + 1) % RINGS.length];
  const dx = next.x - ring.x;
  const dy = next.y - ring.y;
  const dz = next.z - ring.z;
  const len = Math.hypot(dx, dy, dz) || 1;
  return { x: dx / len, y: dy / len, z: dz / len };
}

// Pine clusters scattered on the grass, kept clear of the runways.
export const TREES = (() => {
  const list = [];
  for (let i = 0; i < 260; i++) {
    const x = (hash2(i, 11) - 0.5) * 2 * (WORLD.halfSize - 120);
    const z = (hash2(i, 23) - 0.5) * 2 * (WORLD.halfSize - 120);
    const h = terrainHeight(x, z);
    if (h < 8 || h > 150) continue;
    if (runwayFlatten(x, z) > 0.05) continue;
    const s = 0.8 + hash2(i, 37) * 0.9;
    list.push({ x, z, y: h, s, shade: 0.75 + hash2(i, 51) * 0.45 });
  }
  return list;
})();

// Slow-drifting cumulus puffs above the island.
export const CLOUDS = (() => {
  const list = [];
  for (let i = 0; i < 26; i++) {
    list.push({
      x: (hash2(i, 71) - 0.5) * 2 * WORLD.halfSize,
      z: (hash2(i, 83) - 0.5) * 2 * WORLD.halfSize,
      y: 380 + hash2(i, 97) * 160,
      r: 90 + hash2(i, 101) * 130,
      drift: 3 + hash2(i, 113) * 4,
    });
  }
  return list;
})();

export function cloudPosition(cloud, timeSeconds) {
  const span = WORLD.halfSize * 2 + 400;
  let x = cloud.x + cloud.drift * timeSeconds;
  x = ((x + WORLD.halfSize + 200) % span) - WORLD.halfSize - 200;
  return { x, y: cloud.y, z: cloud.z, r: cloud.r };
}
