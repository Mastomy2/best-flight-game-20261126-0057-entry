// Skylark Courier — tuning constants for the whole game.
// One place for every number a designer would tune: world size, flight model,
// missions, scoring and the look of the sky. Nothing here touches the DOM.

export const WORLD = {
  // Island is a 4200 x 4200 m square of terrain centred on the origin.
  halfSize: 2100,
  cellSize: 105,
  seaLevel: 0,
  maxHill: 260,
  // Runway 09 sits on the flat eastern apron, Runway 27 on the western one.
  runways: [
    { id: '09', x: 1180, z: -260, heading: 90, length: 620, width: 46 },
    { id: '27', x: -1180, z: 300, heading: 270, length: 620, width: 46 },
  ],
};

export const FLIGHT = {
  minSpeed: 28, // m/s — below this the Skylark stalls and sinks
  cruiseSpeed: 78,
  maxSpeed: 132,
  throttleAccel: 26, // m/s^2 of speed gained per second at full throttle
  drag: 0.22, // per-second speed bleed toward the throttle's target speed
  climbRate: 40, // m/s of vertical speed at full pitch up and cruise speed
  turnRate: 0.62, // rad/s of heading change at full bank
  maxBank: 1.05, // rad of roll
  maxPitch: 0.5, // rad of pitch
  fuelBurn: 0.22, // percent of tank per second at full throttle
  fuelBurnIdle: 0.06,
  stallSink: 26, // m/s of sink when stalled
  gearSpeedLimit: 62, // m/s — gear rips off above this on touchdown
  hardLandingSink: 9, // m/s of sink that starts damaging the airframe
};

export const SCORING = {
  ringPoints: 100,
  ringFuelBonus: 14, // percent of tank refunded per ring
  landingPoints: 250,
  smoothLandingBonus: 120,
  stormRingPoints: 150,
  stormTimeBonus: 10, // seconds added per storm ring
  missionCompleteBonus: 500,
};

export const MISSIONS = [
  {
    id: 'ring-run',
    name: 'RING RUN',
    tagline: 'Thread all 8 golden rings over the island.',
    brief:
      'Take off from Runway 09 and fly through every golden ring. Each ring: +100 pts, +14% fuel.',
  },
  {
    id: 'island-hop',
    name: 'ISLAND HOP',
    tagline: 'Land on both runways, east then west.',
    brief:
      'Depart Runway 09, cross the island, and land on Runway 27. Gear down (G), slow, sink gently.',
  },
  {
    id: 'storm-chase',
    name: 'STORM CHASE',
    tagline: 'Chase the moving rings before the clock runs dry.',
    brief:
      'Rings appear one at a time against a 90-second clock. Each: +150 pts and +10 seconds.',
  },
];

export const LOOK = {
  skyTop: '#2f6fd0',
  skyMid: '#7db4e8',
  skyHorizon: '#cfe8f7',
  seaDeep: '#0e4d7a',
  seaShallow: '#2f8fb5',
  sand: '#d9c08a',
  grassLow: '#5d9b4a',
  grassHigh: '#3f7d3a',
  rock: '#8a7f74',
  snow: '#eef3f6',
  runway: '#3a3f46',
  ring: '#ffc233',
  ringGlow: '#ffdf6b',
};
