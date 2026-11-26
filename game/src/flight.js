// Skylark Courier — the flight model: throttle, pitch, bank, stall, fuel, damage.
// Arcade-true rather than sim-true: speed chases the throttle, bank turns the
// heading, pitch trades speed for climb, and the ground always wins an argument.

import { FLIGHT, WORLD } from './config.js';
import { terrainHeight } from './terrain.js';

export function makeFlightState() {
  return {
    // Parked at the eastern threshold of Runway 09, nose east.
    x: WORLD.runways[0].x - WORLD.runways[0].length / 2 + 40,
    y: 8,
    z: WORLD.runways[0].z,
    heading: Math.PI / 2, // 0 = north (-z), PI/2 = east (+x)
    pitch: 0,
    roll: 0,
    speed: 0,
    throttle: 0,
    verticalSpeed: 0,
    fuel: 100,
    damage: 0,
    gearDown: true,
    airborne: false,
    stalled: false,
    crashed: false,
    crashReason: '',
    landed: false,
    landedRunway: null,
    distanceFlown: 0,
  };
}

// Smallest signed turn from heading `from` to heading `to`, in radians.
export function angleDelta(from, to) {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export function headingDegrees(heading) {
  return ((heading * 180) / Math.PI % 360 + 360) % 360;
}

// `input` carries: pitchTarget (-1..1, + = pull up), rollTarget (-1..1, + = bank right),
// throttleTarget (0..1), brake (bool), gearToggle (edge), mouseActive (bool).
export function updateFlight(state, input, dt) {
  if (state.crashed) return state;

  // Throttle eases toward its target; the engine answers smoothly, never instantly.
  const throttleRate = input.throttleTarget > state.throttle ? 0.9 : 1.6;
  state.throttle += Math.max(-throttleRate * dt, Math.min(throttleRate * dt, input.throttleTarget - state.throttle));

  const targetSpeed = FLIGHT.minSpeed + state.throttle * (FLIGHT.maxSpeed - FLIGHT.minSpeed);
  const accel = (targetSpeed - state.speed) * (state.throttle > 0.02 ? FLIGHT.throttleAccel / 60 : FLIGHT.drag * 4);
  state.speed += accel * dt * 3;
  if (input.brake) state.speed = Math.max(0, state.speed - 34 * dt);
  state.speed = Math.max(0, Math.min(FLIGHT.maxSpeed * 1.05, state.speed));

  // Pitch and roll ease toward the pilot's command; the airframe has inertia,
  // but the nose must come up smartly at rotation.
  const pitchGoal = input.pitchTarget * FLIGHT.maxPitch;
  const rollGoal = input.rollTarget * FLIGHT.maxBank;
  state.pitch += (pitchGoal - state.pitch) * Math.min(1, 4.5 * dt);
  state.roll += (rollGoal - state.roll) * Math.min(1, 3.6 * dt);

  // Bank turns the heading; pitch trades speed for climb. Lift stays useful
  // even just above rotation speed, so a climbing turn never sinks the plane.
  const speedFactor = Math.min(1, state.speed / FLIGHT.cruiseSpeed);
  state.heading += Math.sin(state.roll) * FLIGHT.turnRate * speedFactor * dt;
  const climb = Math.sin(state.pitch) * FLIGHT.climbRate * (0.45 + 0.55 * speedFactor);
  state.stalled = state.airborne && state.speed < FLIGHT.minSpeed + 6;
  state.verticalSpeed = state.stalled ? -FLIGHT.stallSink : climb;
  if (!state.airborne && state.speed < FLIGHT.minSpeed) state.verticalSpeed = 0;

  const forwardX = Math.sin(state.heading);
  const forwardZ = -Math.cos(state.heading);
  const step = state.speed * dt;
  state.x += forwardX * step;
  state.z += forwardZ * step;
  state.y += state.verticalSpeed * dt;
  state.distanceFlown += step;

  // Fuel burns with the throttle; an empty tank means a glide, not a fall.
  const burn = (FLIGHT.fuelBurnIdle + state.throttle * (FLIGHT.fuelBurn - FLIGHT.fuelBurnIdle)) * dt;
  state.fuel = Math.max(0, state.fuel - burn);
  if (state.fuel <= 0) state.throttle = 0;

  const ground = terrainHeight(state.x, state.z);
  const overSea = ground < 0;
  const runway = runwayUnder(state.x, state.z);

  if (!state.airborne) {
    // Rolling on the ground: stay glued until rotation speed.
    state.y = ground + 3.2;
    if (state.speed >= FLIGHT.minSpeed && state.pitch > 0.06) {
      state.airborne = true;
    }
  }

  if (state.airborne) {
    const clearance = state.y - Math.max(ground, 0);
    if (clearance <= 0) {
      if (runway && state.gearDown) {
        touchDown(state, runway);
      } else if (runway && !state.gearDown) {
        crash(state, 'Belly landing — gear was up');
      } else if (overSea && state.speed < 45 && Math.abs(state.verticalSpeed) < 8) {
        // A gentle ditching on the water is survivable, barely.
        state.y = 2;
        state.speed *= 0.86;
        state.verticalSpeed = 0;
        state.airborne = false;
        state.damage = Math.min(100, state.damage + 30);
        state.crashed = state.damage >= 100;
        if (state.crashed) state.crashReason = 'Ditched hard in the sea';
      } else {
        crash(state, overSea ? 'Ditched in the sea' : 'Flew into the terrain');
      }
    }
  }

  // World edge: turn the pilot back with a gentle warning instead of a wall.
  const edge = Math.abs(state.x) > WORLD.halfSize + 500 || Math.abs(state.z) > WORLD.halfSize + 500;
  if (edge) {
    state.heading += angleDelta(state.heading, Math.atan2(-state.x, state.z)) * 0.4 * dt;
  }
  return state;
}

function crash(state, reason) {
  state.crashed = true;
  state.crashReason = reason;
  state.speed = 0;
  state.verticalSpeed = 0;
}

function touchDown(state, runway) {
  const sink = -state.verticalSpeed;
  const aligned = Math.abs(angleDelta(state.heading, (runway.heading * Math.PI) / 180)) < 0.35 ||
    Math.abs(angleDelta(state.heading, ((runway.heading + 180) * Math.PI) / 180)) < 0.35;
  state.airborne = false;
  state.y = terrainHeight(state.x, state.z) + 3.2;
  if (state.speed > FLIGHT.gearSpeedLimit) {
    crash(state, 'Landed too fast — gear collapsed');
    return;
  }
  if (!aligned) {
    state.damage = Math.min(100, state.damage + 45);
    if (state.damage >= 100) {
      crash(state, 'Landed across the runway');
      return;
    }
  }
  if (sink > FLIGHT.hardLandingSink) {
    state.damage = Math.min(100, state.damage + (sink - FLIGHT.hardLandingSink) * 6);
  }
  state.landed = true;
  state.landedRunway = runway.id;
  state.verticalSpeed = 0;
}

// The runway whose strip the point (x, z) sits on, or null.
// Forward is (sin h, -cos h); across is (cos h, sin h).
export function runwayUnder(x, z) {
  for (const r of WORLD.runways) {
    const rad = (r.heading * Math.PI) / 180;
    const dx = x - r.x;
    const dz = z - r.z;
    const along = Math.abs(dx * Math.sin(rad) - dz * Math.cos(rad));
    const across = Math.abs(dx * Math.cos(rad) + dz * Math.sin(rad));
    if (along < r.length / 2 && across < r.width / 2) return r;
  }
  return null;
}
