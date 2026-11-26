// Skylark Courier — keyboard and mouse input.
// Arrow keys / WASD fly the plane; the mouse steers gently when moved; G, C, P,
// R and M are single-press actions the game loop consumes as edges.

export function makeInput() {
  const keys = new Set();
  const state = {
    keys,
    mouseX: 0,
    mouseY: 0,
    mouseActive: false,
    mouseIdleTime: 0,
    pressed: new Set(), // edges: keys pressed since the last consume
  };

  const GAME_KEYS = [
    'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ',
    'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyG', 'KeyC', 'KeyP', 'KeyR', 'KeyM',
    'KeyB', 'Enter', 'Digit1', 'Digit2', 'Digit3', 'Escape',
  ];

  function onKeyDown(event) {
    if (!GAME_KEYS.includes(event.code)) return;
    event.preventDefault();
    if (!keys.has(event.code)) state.pressed.add(event.code);
    keys.add(event.code);
  }

  function onKeyUp(event) {
    keys.delete(event.code);
  }

  function onMouseMove(event) {
    const rect = event.target.getBoundingClientRect();
    state.mouseX = (event.clientX - rect.left) / rect.width - 0.5;
    state.mouseY = (event.clientY - rect.top) / rect.height - 0.5;
    state.mouseActive = true;
    state.mouseIdleTime = 0;
  }

  function onMouseDown(event) {
    event.preventDefault();
    state.mouseActive = true;
    state.mouseIdleTime = 0;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mousedown', onMouseDown);
  return state;
}

// Read the held keys into a flight command for this frame.
// Arrows fly the plane (Up climbs, Down descends, Left/Right bank); W/S work the
// throttle; A/D bank as well. The mouse steers gently when moved.
export function readFlightCommand(input, dt) {
  const keys = input.keys;
  let pitchTarget = 0;
  let rollTarget = 0;
  if (keys.has('ArrowUp')) pitchTarget += 1;
  if (keys.has('ArrowDown')) pitchTarget -= 1;
  if (keys.has('ArrowLeft') || keys.has('KeyA')) rollTarget -= 1;
  if (keys.has('ArrowRight') || keys.has('KeyD')) rollTarget += 1;

  // Mouse: push the nose toward where the pointer sits, off-centre.
  if (input.mouseActive) {
    input.mouseIdleTime += dt;
    if (input.mouseIdleTime > 4) input.mouseActive = false;
    else {
      rollTarget += Math.max(-1, Math.min(1, input.mouseX * 2.2));
      pitchTarget += Math.max(-1, Math.min(1, input.mouseY * 2.2));
    }
  }

  return {
    pitchTarget: Math.max(-1, Math.min(1, pitchTarget)),
    rollTarget: Math.max(-1, Math.min(1, rollTarget)),
    brake: keys.has('KeyB') || keys.has(' '),
    gearToggle: consume(input, 'KeyG'),
    cameraToggle: consume(input, 'KeyC'),
    pauseToggle: consume(input, 'KeyP') || consume(input, 'Escape'),
    restart: consume(input, 'KeyR'),
    muteToggle: consume(input, 'KeyM'),
    confirm: consume(input, 'Enter'),
  };
}

// Read the throttle keys separately: throttle is a setting, not a momentary push.
// W raises it, S lowers it; Shift+arrows trim it in fine steps.
export function readThrottle(input, current, dt) {
  let target = current;
  if (input.keys.has('KeyW')) target = Math.min(1, current + 0.55 * dt);
  if (input.keys.has('KeyS')) target = Math.max(0, current - 0.7 * dt);
  if (input.keys.has('ArrowUp') && input.keys.has('ShiftLeft')) target = Math.min(1, current + 0.55 * dt);
  if (input.keys.has('ArrowDown') && input.keys.has('ShiftLeft')) target = Math.max(0, current - 0.7 * dt);
  return target;
}

export function consume(input, code) {
  if (input.pressed.has(code)) {
    input.pressed.delete(code);
    return true;
  }
  return false;
}

export function clearEdges(input) {
  input.pressed.clear();
}
