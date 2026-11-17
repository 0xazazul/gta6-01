// Solmar Bay — tuning constants and shared palette for the whole game.
// One place holds every number a designer would tweak: world size, speeds,
// wanted rules, mission rewards, colours. Nothing here loads anything.
export const WORLD = {
  // City is a square of BLOCKS x BLOCKS blocks, each BLOCK metres wide,
  // separated by ROAD-wide streets. The beach and ocean sit south of it.
  BLOCKS: 6,
  BLOCK: 46,
  ROAD: 14,
  BUILDING_MAX: 34,
};

export const CITY_SIZE = WORLD.BLOCKS * (WORLD.BLOCK + WORLD.ROAD) + WORLD.ROAD;

export const COLOURS = {
  skyTop: 0x2f7fc4,
  skyBottom: 0xffd9a0,
  sun: 0xfff2cc,
  ground: 0x3d3a33,
  sidewalk: 0x9a938a,
  road: 0x2b2b30,
  roadLine: 0xd8c95a,
  sand: 0xe8d29a,
  ocean: 0x1e6f9e,
  oceanDeep: 0x155a80,
  buildingPalette: [0xc98d5f, 0x8fa3b8, 0xd9b48a, 0x7fa08a, 0xb87a7a, 0x9a8fb8, 0x6f8fa8, 0xd8d0c0],
  windowLit: 0xffe9a8,
  windowDark: 0x2c3e50,
  palmTrunk: 0x7a5230,
  palmLeaf: 0x3f8f4f,
};

export const PLAYER = {
  walkSpeed: 6.5,
  sprintSpeed: 10.5,
  turnSpeed: 9,
  radius: 0.55,
  maxHealth: 100,
  maxArmor: 100,
  jumpSpeed: 7,
};

export const CAR = {
  accel: 22,
  brake: 34,
  reverseAccel: 12,
  maxSpeed: 42,
  maxReverse: 10,
  steer: 1.9,
  grip: 6.5,
};

export const WANTED = {
  // Stars earned by: stealing a car (+1), shooting a pedestrian (+1),
  // shooting a cop (+2), mission heat. They decay when the player hides.
  decaySeconds: 14,
  copCars: [0, 1, 2, 3, 4, 5],
  copFoot: [0, 0, 1, 2, 3, 4],
  bustRadius: 2.2,
};

export const MISSION_REWARDS = [500, 1200, 3500, 2500, 8000];

export const SAVE_KEY = 'solmar-bay-save-v1';
export const BEST_KEY = 'solmar-bay-best-cash-v1';

export const STEP = 1 / 60;
