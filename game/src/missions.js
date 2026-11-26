// Skylark Courier — the three sorties: objectives, scoring, win and loss.
// A mission is pure state over the flight model: rings passed, runways touched,
// the storm clock. It never draws anything; render.js reads it.

import { MISSIONS, SCORING, WORLD } from './config.js';
import { RINGS, ringNormal } from './terrain.js';
import { angleDelta } from './flight.js';

export function makeMission(missionId) {
  const def = MISSIONS.find((m) => m.id === missionId) ?? MISSIONS[0];
  return {
    def,
    score: 0,
    ringsPassed: 0,
    ringsTotal: def.id === 'storm-chase' ? RINGS.length : RINGS.length,
    nextRing: 0,
    stormRing: null,
    stormClock: 90,
    landings: [],
    landingsNeeded: def.id === 'island-hop' ? ['09', '27'] : [],
    complete: false,
    failed: false,
    failReason: '',
    message: '',
    messageTime: 0,
    startTime: 0,
    elapsed: 0,
    bestStreak: 0,
  };
}

export function missionObjectiveText(mission) {
  if (mission.def.id === 'ring-run') {
    return `Rings ${mission.ringsPassed}/${mission.ringsTotal}`;
  }
  if (mission.def.id === 'island-hop') {
    return `Runways ${mission.landings.length}/2`;
  }
  return `Storm rings ${mission.ringsPassed} — ${Math.ceil(mission.stormClock)}s left`;
}

function setMessage(mission, text) {
  mission.message = text;
  mission.messageTime = 4;
}

// A ring counts when the plane crosses its disc: the signed distance along the
// ring's normal changes sign between frames and the crossing point lies inside
// the ring's radius — flying through the hoop, not merely near it.
export function crossedRing(prev, flight, ring, index) {
  const n = ringNormal(ring, index);
  const dPrev = (prev.x - ring.x) * n.x + (prev.y - ring.y) * n.y + (prev.z - ring.z) * n.z;
  const dCurr = (flight.x - ring.x) * n.x + (flight.y - ring.y) * n.y + (flight.z - ring.z) * n.z;
  if (dPrev === 0 || dCurr === 0 || Math.sign(dPrev) === Math.sign(dCurr)) return false;
  const t = dPrev / (dPrev - dCurr);
  const cx = prev.x + (flight.x - prev.x) * t;
  const cy = prev.y + (flight.y - prev.y) * t;
  const cz = prev.z + (flight.z - prev.z) * t;
  const radial = Math.hypot(cx - ring.x, cy - ring.y, cz - ring.z);
  return radial < ring.r;
}

export function checkRingPass(mission, prev, flight) {
  if (mission.def.id === 'storm-chase') return false;
  const ring = RINGS[mission.nextRing];
  if (!ring) return false;
  const dist = Math.hypot(flight.x - ring.x, flight.y - ring.y, flight.z - ring.z);
  if (crossedRing(prev, flight, ring, mission.nextRing) || dist <= ring.r * 0.8) {
    mission.ringsPassed += 1;
    mission.score += SCORING.ringPoints;
    mission.nextRing = (mission.nextRing + 1) % RINGS.length;
    setMessage(mission, `RING ${mission.ringsPassed}/${mission.ringsTotal}  +${SCORING.ringPoints}`);
    return true;
  }
  return false;
}

function pickStormRing(mission) {
  const choices = RINGS.filter((r) => r !== mission.stormRing);
  return choices[Math.floor(Math.random() * choices.length)];
}

export function updateMission(mission, flight, prev, dt, events) {
  if (mission.complete || mission.failed) return;
  mission.elapsed += dt;
  if (mission.messageTime > 0) mission.messageTime -= dt;

  // Ring Run: rings in a fixed circuit, looping until all eight are flown.
  if (mission.def.id === 'ring-run') {
    if (checkRingPass(mission, prev, flight)) events.ring = true;
    if (mission.ringsPassed >= mission.ringsTotal) {
      mission.complete = true;
      mission.score += SCORING.missionCompleteBonus;
      setMessage(mission, `SORTIE COMPLETE  +${SCORING.missionCompleteBonus}`);
      events.complete = true;
    }
  }

  // Storm Chase: one ring at a time, clock always ticking.
  if (mission.def.id === 'storm-chase') {
    if (!mission.stormRing) mission.stormRing = pickStormRing(mission);
    mission.stormClock -= dt;
    const ring = mission.stormRing;
    const ringIndex = RINGS.indexOf(ring);
    const dist = Math.hypot(flight.x - ring.x, flight.y - ring.y, flight.z - ring.z);
    if (crossedRing(prev, flight, ring, ringIndex) || dist <= ring.r * 0.8) {
      mission.ringsPassed += 1;
      mission.score += SCORING.stormRingPoints;
      mission.stormClock += SCORING.stormTimeBonus;
      mission.stormRing = pickStormRing(mission);
      setMessage(mission, `STORM RING  +${SCORING.stormRingPoints}  +${SCORING.stormTimeBonus}s`);
      events.ring = true;
    }
    if (mission.stormClock <= 0) {
      mission.complete = mission.ringsPassed >= 5;
      mission.failed = mission.ringsPassed < 5;
      mission.failReason = mission.failed ? 'The storm clock ran out' : '';
      if (mission.complete) mission.score += SCORING.missionCompleteBonus;
      events.complete = mission.complete;
    }
  }

  // Island Hop: a landing counts when the wheels touch a needed runway.
  if (mission.def.id === 'island-hop' && flight.landed && flight.landedRunway) {
    const need = mission.landingsNeeded[mission.landings.length];
    if (flight.landedRunway === need && !mission.landings.includes(need)) {
      mission.landings.push(need);
      mission.score += SCORING.landingPoints;
      const smooth = flight.damage < 10;
      if (smooth) mission.score += SCORING.smoothLandingBonus;
      setMessage(
        mission,
        `TOUCHDOWN RWY ${need}  +${SCORING.landingPoints}${smooth ? ` +${SCORING.smoothLandingBonus} smooth` : ''}`,
      );
      events.landed = true;
      flight.landed = false; // consume the event so it scores once
      if (mission.landings.length >= mission.landingsNeeded.length) {
        mission.complete = true;
        mission.score += SCORING.missionCompleteBonus;
        setMessage(mission, `ISLAND HOP COMPLETE  +${SCORING.missionCompleteBonus}`);
        events.complete = true;
      }
    } else {
      flight.landed = false; // wrong runway: no points, keep flying
    }
  }

  // Any mission: a crash ends the sortie; running dry over water ends it too.
  if (flight.crashed) {
    mission.failed = true;
    mission.failReason = flight.crashReason || 'Crashed';
  }
  if (flight.fuel <= 0 && flight.airborne && flight.y < 30 && !flight.landed) {
    mission.failed = true;
    mission.failReason = 'Out of fuel over open ground';
  }
}

// Where the autopilot (and the next-ring arrow) should aim right now.
export function currentTarget(mission, flight) {
  if (mission.def.id === 'storm-chase' && mission.stormRing) return mission.stormRing;
  if (mission.def.id === 'island-hop') {
    const need = mission.landingsNeeded[mission.landings.length];
    const runway = WORLD.runways.find((r) => r.id === need);
    if (runway) {
      const rad = (runway.heading * Math.PI) / 180;
      const approach = {
        x: runway.x - Math.sin(rad) * (runway.length / 2 + 420),
        y: 70,
        z: runway.z + Math.cos(rad) * (runway.length / 2 + 420),
        r: 30,
      };
      const distToApproach = Math.hypot(approach.x - flight.x, approach.y - flight.y, approach.z - flight.z);
      const distToRunway = Math.hypot(runway.x - flight.x, runway.z - flight.z);
      // Hysteresis: once committed to the threshold, stay on it until the
      // landing scores or the pilot is far away again (a go-around).
      if (distToApproach < 260) mission.finalPhase = true;
      if (distToRunway > 900) mission.finalPhase = false;
      if (mission.finalPhase) {
        // Aim 180 m past the threshold, down the strip, so the plane flies
        // the whole runway instead of turning around over its centre.
        const rad = (runway.heading * Math.PI) / 180;
        const aim = {
          x: runway.x - Math.sin(rad) * (runway.length / 2 - 180),
          // Aim below the strip's surface: the glide must keep sinking through
          // the flare, or the plane levels off a few metres up and never lands.
          y: 2,
          z: runway.z + Math.cos(rad) * (runway.length / 2 - 180),
          r: 30,
        };
        // Overshot the aim point while still high: go around, don't circle.
        const fx = Math.sin(rad);
        const fz = -Math.cos(rad);
        const beyond = (flight.x - aim.x) * fx + (flight.z - aim.z) * fz;
        if (beyond > 120 && flight.y > 25) {
          mission.finalPhase = false;
          return approach;
        }
        return aim;
      }
      return approach;
    }
  }
  const ring = RINGS[mission.nextRing];
  return ring ?? { x: 0, y: 120, z: 0, r: 30 };
}

// Bearing from the plane to the target, as a heading the pilot can follow.
export function bearingToTarget(flight, target) {
  return Math.atan2(target.x - flight.x, -(target.z - flight.z));
}

export function targetDistance(flight, target) {
  return Math.hypot(target.x - flight.x, target.y - flight.y, target.z - flight.z);
}
