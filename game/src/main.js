// Skylark Courier — the game loop: screens, camera, autopilot, demo screenshots.
// States: menu → flying ⇄ paused → ended. The demo mode (?shot=...) fast-forwards
// the simulation with an autopilot so screenshots show the game mid-flight.

import { makeFlightState, updateFlight } from './flight.js';
import { makeInput, readFlightCommand, readThrottle, consume } from './input.js';
import { makeAudio, startAudio, updateAudio, playRingChime, playTouchdown, playCrash, playClick, playStallWarning } from './audio.js';
import { makeMission, updateMission, currentTarget, bearingToTarget } from './missions.js';
import { MISSIONS } from './config.js';
import { terrainHeight, RINGS } from './terrain.js';
import { makeCamera, aimCamera, drawSky, drawSea, drawTerrain, drawRunways, drawRings, drawTrees, drawClouds, clampCameraToTerrain } from './render.js';
import { drawPlaneChase, drawCockpit, drawHUD, drawMenu, drawEndScreen, drawPaused } from './hud.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const WIDTH = canvas.width;
const HEIGHT = canvas.height;

const params = new URLSearchParams(window.location.search);
const shotMode = params.get('shot'); // cover | rings | approach | cockpit | menu

const input = makeInput();
const audio = makeAudio();
let view = 'chase';
let missionIndex = 0;
let screen = 'menu';
let flight = makeFlightState();
let mission = makeMission(MISSIONS[0].id);
let timeSeconds = 0;
let lastTimestamp = 0;
let camera = makeCamera();
let stallWarnedAt = -10;
let demoPrepared = false;

function startMission(index) {
  missionIndex = index;
  flight = makeFlightState();
  mission = makeMission(MISSIONS[index].id);
  mission.startTime = timeSeconds;
  screen = 'flying';
  view = 'chase';
  startAudio(audio);
  playClick(audio);
}

// Chase camera: behind the plane, above it, looking ahead through it.
function chaseCameraPosition(flight) {
  const back = 17;
  const up = 5.2;
  const fx = Math.sin(flight.heading);
  const fz = -Math.cos(flight.heading);
  return {
    x: flight.x - fx * back,
    y: flight.y + up - Math.sin(flight.pitch) * back * 0.4,
    z: flight.z - fz * back,
  };
}

// Autopilot: fly toward the current target, level and steady, for demo screenshots.
// Gentle on the bank, and never below the terrain plus a safety margin.
function autopilotCommand(flight, mission, dt) {
  const target = currentTarget(mission, flight);
  const bearing = bearingToTarget(flight, target);
  const rel = ((bearing - flight.heading + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
  // Bank hard when far off course, ease off when lined up; slow down to turn
  // tighter whenever the target is well off the nose. Climb out straight
  // until safely above the hills before turning at all.
  let rollTarget = Math.max(-1, Math.min(1, rel * 1.6));
  if (flight.airborne && flight.y < 140) rollTarget = Math.max(-0.2, Math.min(0.2, rollTarget));
  const terrainFloor = terrainHeight(flight.x, flight.z) + 48;
  // A landing target is exempt from the terrain floor: the runway is the floor.
  // On final the pitch answers faster so the glide actually meets the strip.
  const desiredAlt = target.y < 30 ? target.y : Math.max(target.y, terrainFloor);
  const altError = desiredAlt - flight.y;
  const pitchGain = target.y < 30 ? 40 : 70;
  const pitchTarget = Math.max(-0.6, Math.min(0.6, altError / pitchGain + (flight.airborne ? 0 : 0.3)));
  const dist = Math.hypot(target.x - flight.x, target.y - flight.y, target.z - flight.z);
  let throttleTarget = Math.abs(rel) > 0.8 ? 0.35 : 0.72;
  if (dist < 120) throttleTarget = 0.55;
  if (!flight.airborne) throttleTarget = 1;
  // Landing: slow down and stay slow once the target is the runway itself.
  if (target.y < 30) {
    throttleTarget = dist < 500 ? 0.18 : 0.4;
  }
  return { pitchTarget, rollTarget, throttleTarget, brake: target.y < 30 && dist < 200 && flight.speed > 48, gearToggle: false, cameraToggle: false, pauseToggle: false, restart: false, muteToggle: false, confirm: false };
}

// Place the Skylark a set distance before a ring, aimed straight at it.
function stageBeforeRing(ringIndex, distance, speed) {
  const ring = RINGS[ringIndex];
  const prev = RINGS[(ringIndex + RINGS.length - 1) % RINGS.length];
  const dx = ring.x - prev.x;
  const dz = ring.z - prev.z;
  const len = Math.hypot(dx, dz) || 1;
  const ux = dx / len;
  const uz = dz / len;
  flight.x = ring.x - ux * distance;
  flight.z = ring.z - uz * distance;
  flight.y = ring.y;
  flight.heading = Math.atan2(ux, -uz);
  flight.speed = speed;
  flight.throttle = 0.66;
  flight.airborne = true;
  flight.pitch = 0;
  flight.roll = 0;
  mission.nextRing = ringIndex;
}

// Demo staging: show the sortie mid-flight, not at the start line.
// ringsPassed/score/fuel are set to what a pilot would actually have after
// flying that far, so the screenshots prove progress instead of Score 0.
function stageProgress(ringsPassed, score, fuel, message) {
  mission.ringsPassed = ringsPassed;
  mission.score = score;
  flight.fuel = fuel;
  if (message) {
    mission.message = message;
    mission.messageTime = 4;
  }
}

// Prepare a deterministic demo frame: pick the mission, run the sim forward.
function prepareDemoShot() {
  if (demoPrepared) return;
  demoPrepared = true;
  const dt = 1 / 60;
  if (shotMode === 'menu') {
    screen = 'menu';
    missionIndex = 0;
    timeSeconds = 6;
    return;
  }
  if (shotMode === 'approach') {
    startMission(1); // Island Hop
    // Already landed on Runway 09 (+250, +120 smooth): now on final to 27.
    mission.landings = ['09'];
    mission.score = 370;
    flight.fuel = 68;
    mission.message = 'TOUCHDOWN RWY 09  +250 +120 smooth';
    mission.messageTime = 4;
    // On final to Runway 27: 1.2 km out, 220 m up, gear down, 65 m/s.
    flight.x = 330;
    flight.y = 220;
    flight.z = 300;
    flight.heading = Math.PI * 1.5; // west, toward runway 27
    flight.speed = 65;
    flight.throttle = 0.5;
    flight.airborne = true;
    flight.gearDown = true;
    for (let i = 0; i < 60 * 10; i++) {
      stepSimulation(dt, autopilotCommand(flight, mission, dt), 0.5);
    }
    return;
  }
  if (shotMode === 'cockpit') {
    startMission(0);
    view = 'cockpit';
    stageBeforeRing(2, 280, 82);
    stageProgress(2, 200, 88, 'RING 2/8  +100');
    for (let i = 0; i < 60 * 2; i++) {
      stepSimulation(dt, autopilotCommand(flight, mission, dt), 0.66);
    }
    return;
  }
  if (shotMode === 'rings') {
    startMission(0);
    stageBeforeRing(4, 170, 82);
    stageProgress(4, 400, 76, 'RING 4/8  +100');
    for (let i = 0; i < 60 * 1; i++) {
      stepSimulation(dt, autopilotCommand(flight, mission, dt), 0.66);
    }
    return;
  }
  // cover: Ring Run, staged just before the fourth ring with the island below.
  startMission(0);
  stageBeforeRing(3, 300, 82);
  stageProgress(3, 300, 82, 'RING 3/8  +100');
  for (let i = 0; i < 60 * 2; i++) {
    stepSimulation(dt, autopilotCommand(flight, mission, dt), 0.66);
  }
}

function stepSimulation(dt, command, throttleOverride) {
  const prev = { x: flight.x, y: flight.y, z: flight.z };
  const throttleTarget = throttleOverride !== undefined ? throttleOverride : readThrottle(input, flight.throttle, dt);
  if (command.gearToggle) {
    flight.gearDown = !flight.gearDown;
    playClick(audio);
  }
  updateFlight(flight, { ...command, throttleTarget }, dt);
  const events = {};
  updateMission(mission, flight, prev, dt, events);
  if (events.ring) playRingChime(audio);
  if (events.landed) playTouchdown(audio);
  if (mission.failed && flight.crashed) playCrash(audio);
  if (flight.stalled && flight.airborne && timeSeconds - stallWarnedAt > 2.5) {
    stallWarnedAt = timeSeconds;
    playStallWarning(audio);
  }
  updateAudio(audio, flight);
  if (mission.complete || mission.failed) screen = 'ended';
}

function frame(timestamp) {
  const dt = Math.min(0.05, (timestamp - lastTimestamp) / 1000 || 0.016);
  lastTimestamp = timestamp;
  timeSeconds += dt;

  if (shotMode) {
    prepareDemoShot();
    renderFrame();
    document.title = 'SKYLARK-READY';
    return; // one deterministic frame is all a screenshot needs
  }

  if (screen === 'menu') {
    if (consume(input, 'Enter')) startMission(missionIndex);
    if (consume(input, 'Digit1')) { missionIndex = 0; playClick(audio); }
    if (consume(input, 'Digit2')) { missionIndex = 1; playClick(audio); }
    if (consume(input, 'Digit3')) { missionIndex = 2; playClick(audio); }
    if (consume(input, 'ArrowUp')) missionIndex = (missionIndex + 2) % 3;
    if (consume(input, 'ArrowDown')) missionIndex = (missionIndex + 1) % 3;
  } else if (screen === 'flying') {
    const command = readFlightCommand(input, dt);
    if (command.pauseToggle) {
      screen = 'paused';
    } else if (command.restart) {
      startMission(missionIndex);
    } else {
      if (command.cameraToggle) view = view === 'chase' ? 'cockpit' : 'chase';
      if (command.muteToggle) audio.muted = !audio.muted;
      stepSimulation(dt, command);
    }
  } else if (screen === 'paused') {
    const command = readFlightCommand(input, dt);
    if (command.pauseToggle) screen = 'flying';
    if (command.restart) startMission(missionIndex);
  } else if (screen === 'ended') {
    if (consume(input, 'KeyR')) startMission(missionIndex);
    if (consume(input, 'Digit1')) startMission(0);
    if (consume(input, 'Digit2')) startMission(1);
    if (consume(input, 'Digit3')) startMission(2);
  }

  renderFrame();
  requestAnimationFrame(frame);
}

function renderFrame() {
  // Camera: menu orbits the island; flying chases the plane.
  if (screen === 'menu') {
    const orbit = timeSeconds * 0.05;
    const camPos = { x: Math.sin(orbit) * 1000, y: 300, z: Math.cos(orbit) * 1000 };
    const lookHeading = Math.atan2(-camPos.x, camPos.z) + Math.PI;
    aimCamera(camera, camPos, lookHeading, -0.32, 0);
  } else if (view === 'cockpit') {
    const fx = Math.sin(flight.heading);
    const fz = -Math.cos(flight.heading);
    aimCamera(
      camera,
      { x: flight.x + fx * 1.2, y: flight.y + 1.6, z: flight.z + fz * 1.2 },
      flight.heading,
      flight.pitch * 0.9,
      flight.roll * 0.55,
    );
  } else {
    const pos = chaseCameraPosition(flight);
    aimCamera(camera, pos, flight.heading, flight.pitch * 0.7, flight.roll * 0.45);
    clampCameraToTerrain(camera);
  }
  camera.focal = HEIGHT * 0.92;

  drawSky(ctx, WIDTH, HEIGHT, camera, timeSeconds);
  drawSea(ctx, WIDTH, HEIGHT, camera);
  drawTerrain(ctx, WIDTH, HEIGHT, camera);
  drawRunways(ctx, WIDTH, HEIGHT, camera);
  drawRings(ctx, WIDTH, HEIGHT, camera, mission);
  drawTrees(ctx, WIDTH, HEIGHT, camera);
  drawClouds(ctx, WIDTH, HEIGHT, camera, timeSeconds);

  if (screen === 'menu') {
    drawMenu(ctx, WIDTH, HEIGHT, missionIndex, timeSeconds);
  } else {
    if (view === 'cockpit') drawCockpit(ctx, WIDTH, HEIGHT, flight, timeSeconds);
    else drawPlaneChase(ctx, WIDTH, HEIGHT, flight, timeSeconds);
    drawHUD(ctx, WIDTH, HEIGHT, flight, mission, view, timeSeconds);
    if (screen === 'ended') drawEndScreen(ctx, WIDTH, HEIGHT, flight, mission);
    if (screen === 'paused') drawPaused(ctx, WIDTH, HEIGHT);
  }
}

// First user gesture unlocks the audio context.
window.addEventListener('pointerdown', () => startAudio(audio), { once: true });
window.addEventListener('keydown', () => startAudio(audio), { once: true });

requestAnimationFrame(frame);
