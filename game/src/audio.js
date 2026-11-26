// Skylark Courier — synthesized sound: engine drone, wind, ring chimes, touchdown.
// No audio files: every sound is built from oscillators and filtered noise at run
// time, so the game loads nothing over the network. Starts on the first gesture.

export function makeAudio() {
  const audio = {
    context: null,
    muted: false,
    engineOsc: null,
    engineGain: null,
    windSource: null,
    windGain: null,
    windFilter: null,
    started: false,
  };
  return audio;
}

export function startAudio(audio) {
  if (audio.started) return;
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    audio.context = new Ctx();
    audio.started = true;

    // Engine: two detuned sawtooths through a low-pass, pitch follows the throttle.
    audio.engineOsc = audio.context.createOscillator();
    audio.engineOsc.type = 'sawtooth';
    audio.engineOsc.frequency.value = 62;
    const engineOsc2 = audio.context.createOscillator();
    engineOsc2.type = 'sawtooth';
    engineOsc2.frequency.value = 93;
    audio.engineGain = audio.context.createGain();
    audio.engineGain.gain.value = 0;
    const engineFilter = audio.context.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 420;
    audio.engineOsc.connect(engineFilter);
    engineOsc2.connect(engineFilter);
    engineFilter.connect(audio.engineGain);
    audio.engineGain.connect(audio.context.destination);
    audio.engineOsc.start();
    engineOsc2.start();
    audio.engineOsc2 = engineOsc2;

    // Wind: looped noise through a band-pass that opens with airspeed.
    const length = audio.context.sampleRate * 2;
    const buffer = audio.context.createBuffer(1, length, audio.context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    audio.windSource = audio.context.createBufferSource();
    audio.windSource.buffer = buffer;
    audio.windSource.loop = true;
    audio.windFilter = audio.context.createBiquadFilter();
    audio.windFilter.type = 'bandpass';
    audio.windFilter.frequency.value = 700;
    audio.windFilter.Q.value = 0.6;
    audio.windGain = audio.context.createGain();
    audio.windGain.gain.value = 0;
    audio.windSource.connect(audio.windFilter);
    audio.windFilter.connect(audio.windGain);
    audio.windGain.connect(audio.context.destination);
    audio.windSource.start();
  } catch {
    audio.started = false;
  }
}

// Call every frame: engine pitch follows throttle, wind follows airspeed.
export function updateAudio(audio, flight) {
  if (!audio.started || !audio.context) return;
  const now = audio.context.currentTime;
  const on = !audio.muted && flight.speed > 2;
  const engineLevel = on ? 0.05 + flight.throttle * 0.075 : 0;
  audio.engineGain.gain.setTargetAtTime(engineLevel, now, 0.12);
  audio.engineOsc.frequency.setTargetAtTime(58 + flight.throttle * 66 + flight.speed * 0.25, now, 0.1);
  audio.engineOsc2.frequency.setTargetAtTime(87 + flight.throttle * 99 + flight.speed * 0.37, now, 0.1);
  const windLevel = on ? Math.min(0.14, (flight.speed / 132) * 0.16) : 0;
  audio.windGain.gain.setTargetAtTime(windLevel, now, 0.2);
  audio.windFilter.frequency.setTargetAtTime(500 + flight.speed * 9, now, 0.2);
}

function blip(audio, frequency, duration, type, level, when = 0) {
  if (!audio.started || audio.muted || !audio.context) return;
  const t = audio.context.currentTime + when;
  const osc = audio.context.createOscillator();
  osc.type = type;
  osc.frequency.value = frequency;
  const gain = audio.context.createGain();
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(level, t + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  osc.connect(gain);
  gain.connect(audio.context.destination);
  osc.start(t);
  osc.stop(t + duration + 0.05);
}

export function playRingChime(audio) {
  blip(audio, 880, 0.5, 'sine', 0.22);
  blip(audio, 1318, 0.6, 'sine', 0.18, 0.07);
  blip(audio, 1760, 0.7, 'sine', 0.12, 0.14);
}

export function playTouchdown(audio) {
  blip(audio, 140, 0.25, 'triangle', 0.3);
  blip(audio, 70, 0.4, 'sine', 0.25, 0.05);
}

export function playCrash(audio) {
  blip(audio, 90, 0.7, 'sawtooth', 0.25);
  blip(audio, 55, 0.9, 'square', 0.15, 0.08);
}

export function playClick(audio) {
  blip(audio, 660, 0.08, 'sine', 0.12);
}

export function playStallWarning(audio) {
  blip(audio, 440, 0.16, 'square', 0.08);
  blip(audio, 440, 0.16, 'square', 0.08, 0.22);
}
