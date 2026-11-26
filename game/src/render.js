// Skylark Courier — the world renderer: camera, sky, sea, terrain, runway, rings.
// A hand-rolled perspective projector: no library, no WebGL, just canvas paths.
// The camera chases the plane; the menu camera orbits the island instead.

import { WORLD, LOOK } from './config.js';
import { terrainHeight, groundColor, RINGS, TREES, CLOUDS, cloudPosition, ringNormal } from './terrain.js';
import { runwayUnder } from './flight.js';

export function makeCamera() {
  return {
    pos: { x: 0, y: 0, z: 0 },
    forward: { x: 0, y: 0, z: -1 },
    right: { x: 1, y: 0, z: 0 },
    up: { x: 0, y: 1, z: 0 },
    pitch: 0,
    roll: 0,
    focal: 700,
  };
}

function normalize(v) {
  const len = Math.hypot(v.x, v.y, v.z) || 1;
  return { x: v.x / len, y: v.y / len, z: v.z / len };
}

function cross(a, b) {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

function dot(a, b) {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

// Aim the camera: position, look direction from heading/pitch, then roll it.
export function aimCamera(camera, pos, heading, pitch, roll) {
  const cp = Math.cos(pitch);
  const forward = normalize({ x: Math.sin(heading) * cp, y: Math.sin(pitch), z: -Math.cos(heading) * cp });
  const worldUp = { x: 0, y: 1, z: 0 };
  let right = normalize(cross(forward, worldUp));
  let up = cross(right, forward);
  // Roll around the forward axis.
  const cr = Math.cos(roll);
  const sr = Math.sin(roll);
  const rolledRight = {
    x: right.x * cr + up.x * sr,
    y: right.y * cr + up.y * sr,
    z: right.z * cr + up.z * sr,
  };
  const rolledUp = {
    x: up.x * cr - right.x * sr,
    y: up.y * cr - right.y * sr,
    z: up.z * cr - right.z * sr,
  };
  camera.pos = pos;
  camera.forward = forward;
  camera.right = rolledRight;
  camera.up = rolledUp;
  camera.pitch = pitch;
  camera.roll = roll;
}

export function project(camera, width, height, p) {
  const v = { x: p.x - camera.pos.x, y: p.y - camera.pos.y, z: p.z - camera.pos.z };
  const cz = dot(v, camera.forward);
  if (cz < 2) return null;
  const cx = dot(v, camera.right);
  const cy = dot(v, camera.up);
  return {
    x: width / 2 + (cx / cz) * camera.focal,
    y: height / 2 - (cy / cz) * camera.focal,
    depth: cz,
    scale: camera.focal / cz,
  };
}

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex(r, g, b) {
  const c = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

// Mix two hex colours; always hex in, hex out, so chaining mixes stays valid.
function lerpColor(a, b, t) {
  const pa = hexToRgb(a);
  const pb = hexToRgb(b);
  return rgbToHex(
    pa[0] + (pb[0] - pa[0]) * t,
    pa[1] + (pb[1] - pa[1]) * t,
    pa[2] + (pb[2] - pa[2]) * t,
  );
}

export function drawSky(ctx, width, height, camera, timeSeconds) {
  const grad = ctx.createLinearGradient(0, 0, 0, height);
  grad.addColorStop(0, LOOK.skyTop);
  grad.addColorStop(0.55, LOOK.skyMid);
  grad.addColorStop(0.78, LOOK.skyHorizon);
  grad.addColorStop(1, LOOK.seaDeep);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  // Sun: fixed in the western sky, drawn where the camera looks.
  const sunDir = normalize({ x: -0.55, y: 0.42, z: -0.72 });
  const sunScreen = project(camera, width, height, {
    x: camera.pos.x + sunDir.x * 3000,
    y: camera.pos.y + sunDir.y * 3000,
    z: camera.pos.z + sunDir.z * 3000,
  });
  if (sunScreen) {
    const glow = ctx.createRadialGradient(sunScreen.x, sunScreen.y, 4, sunScreen.x, sunScreen.y, 130);
    glow.addColorStop(0, 'rgba(255,244,200,0.95)');
    glow.addColorStop(0.25, 'rgba(255,226,130,0.55)');
    glow.addColorStop(1, 'rgba(255,226,130,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(sunScreen.x - 140, sunScreen.y - 140, 280, 280);
    ctx.fillStyle = '#fff6cf';
    ctx.beginPath();
    ctx.arc(sunScreen.x, sunScreen.y, 26, 0, Math.PI * 2);
    ctx.fill();
  }
}

// The sea fills everything below the horizon line, tilted by the camera roll.
export function drawSea(ctx, width, height, camera) {
  const horizonY = height / 2 + Math.tan(camera.pitch) * camera.focal;
  ctx.save();
  ctx.translate(width / 2, horizonY);
  ctx.rotate(-camera.roll);
  const grad = ctx.createLinearGradient(0, 0, 0, height);
  grad.addColorStop(0, LOOK.seaShallow);
  grad.addColorStop(1, LOOK.seaDeep);
  ctx.fillStyle = grad;
  ctx.fillRect(-width, 0, width * 2, height * 2);
  // Sun glitter: a bright band under the sun's azimuth.
  ctx.fillStyle = 'rgba(255,240,180,0.10)';
  ctx.fillRect(-width * 0.2, 0, width * 0.4, height * 0.25);
  ctx.restore();
}

// Terrain as a painter-sorted grid of quads, hazed with distance.
export function drawTerrain(ctx, width, height, camera) {
  const half = WORLD.halfSize;
  const cell = WORLD.cellSize;
  const cells = [];
  const camX = camera.pos.x;
  const camZ = camera.pos.z;
  const range = 26; // cells each way from the camera's cell
  const cx0 = Math.max(-half / cell, Math.floor(camX / cell) - range);
  const cx1 = Math.min(half / cell, Math.floor(camX / cell) + range);
  const cz0 = Math.max(-half / cell, Math.floor(camZ / cell) - range);
  const cz1 = Math.min(half / cell, Math.floor(camZ / cell) + range);

  for (let ix = cx0; ix < cx1; ix++) {
    for (let iz = cz0; iz < cz1; iz++) {
      const x0 = ix * cell;
      const z0 = iz * cell;
      const x1 = x0 + cell;
      const z1 = z0 + cell;
      const midX = (x0 + x1) / 2;
      const midZ = (z0 + z1) / 2;
      const dx = midX - camX;
      const dz = midZ - camZ;
      cells.push({ x0, z0, x1, z1, dist: dx * dx + dz * dz });
    }
  }
  cells.sort((a, b) => b.dist - a.dist);

  for (const c of cells) {
    const h00 = terrainHeight(c.x0, c.z0);
    const h10 = terrainHeight(c.x1, c.z0);
    const h11 = terrainHeight(c.x1, c.z1);
    const h01 = terrainHeight(c.x0, c.z1);
    if (Math.max(h00, h10, h11, h01) < -1) continue; // open sea: the sea fill owns it
    const p00 = project(camera, width, height, { x: c.x0, y: h00, z: c.z0 });
    const p10 = project(camera, width, height, { x: c.x1, y: h10, z: c.z0 });
    const p11 = project(camera, width, height, { x: c.x1, y: h11, z: c.z1 });
    const p01 = project(camera, width, height, { x: c.x0, y: h01, z: c.z1 });
    if (!p00 || !p10 || !p11 || !p01) continue;
    const midX = (c.x0 + c.x1) / 2;
    const midZ = (c.z0 + c.z1) / 2;
    const midH = (h00 + h10 + h11 + h01) / 4;
    let color = groundColor(midX, midZ, midH);
    // Slope shading: a quad tilted away from the sun reads a little darker.
    const slope = Math.abs(h10 - h00) + Math.abs(h01 - h00);
    if (slope > 14) color = lerpColor(color, '#000000', Math.min(0.18, slope / 300));
    // Distance haze toward the horizon colour.
    const haze = Math.min(0.55, p00.depth / 5200);
    color = lerpColor(color, LOOK.skyHorizon, haze);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(p00.x, p00.y);
    ctx.lineTo(p10.x, p10.y);
    ctx.lineTo(p11.x, p11.y);
    ctx.lineTo(p01.x, p01.y);
    ctx.closePath();
    ctx.fill();
  }
}

function runwayCorners(runway) {
  const rad = (runway.heading * Math.PI) / 180;
  const fx = Math.sin(rad);
  const fz = -Math.cos(rad);
  const rx = -fz;
  const rz = fx;
  const hx = (fx * runway.length) / 2;
  const hz = (fz * runway.length) / 2;
  const wx = (rx * runway.width) / 2;
  const wz = (rz * runway.width) / 2;
  return [
    { x: runway.x - hx - wx, z: runway.z - hz - wz },
    { x: runway.x + hx - wx, z: runway.z + hz - wz },
    { x: runway.x + hx + wx, z: runway.z + hz + wz },
    { x: runway.x - hx + wx, z: runway.z - hz + wz },
  ];
}

export function drawRunways(ctx, width, height, camera) {
  for (const runway of WORLD.runways) {
    const corners = runwayCorners(runway);
    const pts = corners.map((c) => project(camera, width, height, { x: c.x, y: 6.5, z: c.z }));
    if (pts.some((p) => !p)) continue;
    ctx.fillStyle = LOOK.runway;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.closePath();
    ctx.fill();
    // Centreline dashes, projected one by one so they follow the perspective.
    const rad = (runway.heading * Math.PI) / 180;
    const fx = Math.sin(rad);
    const fz = -Math.cos(rad);
    ctx.fillStyle = '#f4f6f8';
    for (let d = -runway.length / 2 + 30; d < runway.length / 2 - 20; d += 46) {
      const a = project(camera, width, height, { x: runway.x + fx * d, y: 7, z: runway.z + fz * d });
      const b = project(camera, width, height, { x: runway.x + fx * (d + 22), y: 7, z: runway.z + fz * (d + 22) });
      if (!a || !b) continue;
      ctx.lineWidth = Math.max(1, 3.2 * a.scale);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.strokeStyle = '#f4f6f8';
      ctx.stroke();
    }
    // Threshold chevrons at both ends.
    ctx.fillStyle = '#f4f6f8';
    for (const end of [-1, 1]) {
      const base = project(camera, width, height, {
        x: runway.x + fx * (end * (runway.length / 2 - 14)),
        y: 7,
        z: runway.z + fz * (end * (runway.length / 2 - 14)),
      });
      if (!base) continue;
      const s = Math.max(2, 5 * base.scale);
      ctx.beginPath();
      ctx.arc(base.x, base.y, s, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// A ring is a vertical circle whose plane faces the next ring on the circuit.
export function ringFrame(ring, index) {
  const normal = ringNormal(ring, index);
  const up = { x: 0, y: 1, z: 0 };
  const u = normalize(cross(normal, up));
  const v = cross(normal, u);
  return { normal, u, v };
}

export function drawRings(ctx, width, height, camera, mission) {
  const activeRing =
    mission.def.id === 'storm-chase' ? mission.stormRing : RINGS[mission.nextRing];
  RINGS.forEach((ring, index) => {
    const isActive = ring === activeRing;
    // In a Ring Run the rings before the next one are already flown.
    const passed =
      mission.def.id === 'ring-run' &&
      mission.ringsPassed > 0 &&
      mission.ringsPassed < RINGS.length &&
      index < mission.nextRing;
    const frame = ringFrame(ring, index);
    const centre = project(camera, width, height, ring);
    if (!centre) return;
    const edge = project(camera, width, height, {
      x: ring.x + frame.u.x * ring.r,
      y: ring.y + frame.u.y * ring.r,
      z: ring.z + frame.u.z * ring.r,
    });
    if (!edge) return;
    const radiusPx = Math.hypot(edge.x - centre.x, edge.y - centre.y);
    if (radiusPx < 2) return;
    ctx.save();
    ctx.beginPath();
    const segments = 28;
    for (let i = 0; i <= segments; i++) {
      const a = (i / segments) * Math.PI * 2;
      const px = ring.x + (frame.u.x * Math.cos(a) + frame.v.x * Math.sin(a)) * ring.r;
      const py = ring.y + (frame.u.y * Math.cos(a) + frame.v.y * Math.sin(a)) * ring.r;
      const pz = ring.z + (frame.u.z * Math.cos(a) + frame.v.z * Math.sin(a)) * ring.r;
      const s = project(camera, width, height, { x: px, y: py, z: pz });
      if (!s) continue;
      if (i === 0) ctx.moveTo(s.x, s.y);
      else ctx.lineTo(s.x, s.y);
    }
    ctx.closePath();
    if (isActive) {
      ctx.shadowColor = LOOK.ringGlow;
      ctx.shadowBlur = 22;
      ctx.strokeStyle = LOOK.ring;
      ctx.lineWidth = Math.max(3, radiusPx * 0.09);
    } else if (passed) {
      ctx.strokeStyle = 'rgba(120,220,120,0.55)';
      ctx.lineWidth = Math.max(2, radiusPx * 0.05);
    } else {
      ctx.strokeStyle = 'rgba(255,194,51,0.5)';
      ctx.lineWidth = Math.max(2, radiusPx * 0.06);
    }
    ctx.stroke();
    ctx.restore();
    // The active ring gets a floating chevron so the pilot can find it.
    if (isActive && radiusPx > 8) {
      ctx.fillStyle = LOOK.ringGlow;
      ctx.font = `bold ${Math.max(12, radiusPx * 0.28)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('▼', centre.x, centre.y - radiusPx - 10);
    }
  });
}

export function drawTrees(ctx, width, height, camera) {
  const items = [];
  for (const tree of TREES) {
    const dx = tree.x - camera.pos.x;
    const dz = tree.z - camera.pos.z;
    const dist = dx * dx + dz * dz;
    if (dist > 2600 * 2600) continue;
    items.push({ tree, dist });
  }
  items.sort((a, b) => b.dist - a.dist);
  for (const { tree } of items) {
    const base = project(camera, width, height, { x: tree.x, y: tree.y, z: tree.z });
    if (!base) continue;
    const hPx = 26 * tree.s * base.scale;
    if (hPx < 2) continue;
    const wPx = hPx * 0.55;
    ctx.fillStyle = `rgba(20,70,30,${0.85 * tree.shade})`;
    ctx.beginPath();
    ctx.moveTo(base.x, base.y - hPx);
    ctx.lineTo(base.x - wPx / 2, base.y);
    ctx.lineTo(base.x + wPx / 2, base.y);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = `rgba(46,110,52,${0.9 * tree.shade})`;
    ctx.beginPath();
    ctx.moveTo(base.x, base.y - hPx * 1.15);
    ctx.lineTo(base.x - wPx * 0.36, base.y - hPx * 0.45);
    ctx.lineTo(base.x + wPx * 0.36, base.y - hPx * 0.45);
    ctx.closePath();
    ctx.fill();
  }
}

export function drawClouds(ctx, width, height, camera, timeSeconds) {
  for (const cloud of CLOUDS) {
    const pos = cloudPosition(cloud, timeSeconds);
    const centre = project(camera, width, height, pos);
    if (!centre) continue;
    const rPx = pos.r * centre.scale;
    if (rPx < 4 || rPx > 1200) continue;
    ctx.fillStyle = 'rgba(255,255,255,0.82)';
    for (const [ox, oy, s] of [[-0.55, 0.1, 0.62], [0, -0.12, 0.85], [0.55, 0.12, 0.6], [0.1, 0.18, 0.7]]) {
      ctx.beginPath();
      ctx.ellipse(centre.x + ox * rPx, centre.y + oy * rPx, rPx * s, rPx * s * 0.42, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// Keep the camera honest: never let it sink under the terrain.
export function clampCameraToTerrain(camera) {
  const ground = terrainHeight(camera.pos.x, camera.pos.z);
  if (camera.pos.y < ground + 2.5) camera.pos.y = ground + 2.5;
}
