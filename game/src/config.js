// Every tuning number, colour and place name in one place. Solmar Bay is a
// 2400x1800 coastal city: a road grid, a park, a beach and a marina. The
// renderer scales the 1280x720 view to the window, so no rule below depends
// on the screen size.

export const WORLD = { width: 2400, height: 1800 };

/** Road centrelines, and how wide a road is (sidewalk bands sit just outside). */
export const ROADS = {
  vertical: [300, 900, 1500, 2100],
  horizontal: [300, 900, 1500],
  width: 96,
  sidewalk: 18,
};

/** The named districts, drawn on the map and named in mission text. */
export const DISTRICTS = [
  { name: 'Old Town', x: 60, y: 60, w: 480, h: 480 },
  { name: 'Downtown', x: 1560, y: 960, w: 480, h: 480 },
  { name: 'Voss Park', x: 960, y: 960, w: 480, h: 480 },
  { name: 'Marina', x: 2160, y: 960, w: 240, h: 720 },
  { name: 'South Beach', x: 60, y: 1560, w: 2280, h: 240 },
];

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

export const PLAYER = {
  radius: 13,
  walkSpeed: 210,
  enterRange: 64,
  maxHealth: 100,
};

export const CAR = {
  length: 54,
  width: 26,
  maxSpeed: 540,
  accel: 420,
  brake: 700,
  reverseMax: 180,
  steer: 2.6,
  grip: 6.5,
};

export const TRAFFIC_COUNT = 14;
export const PED_COUNT = 26;
export const POLICE_MAX = 5;

/** Wanted stars: what each crime adds, and how long quiet it takes to cool off. */
export const WANTED = {
  stealCar: 1,
  hitPedestrian: 2,
  hitCar: 1,
  max: 5,
  coolSeconds: 8,
};

/** The three missions, in order: a courier job for the fixer Mara Voss. */
export const MISSIONS = [
  {
    id: 1,
    name: 'Hot Wheels',
    text: 'Steal any car and bring it to the Marina marker.',
    type: 'reach',
    target: { x: 2280, y: 1260 },
    needCar: true,
    reward: 400,
  },
  {
    id: 2,
    name: 'The Package',
    text: 'Pick up the package in Old Town, deliver to South Beach. 75 seconds.',
    type: 'deliver',
    pickup: { x: 300, y: 300 },
    target: { x: 1200, y: 1700 },
    timeLimit: 75,
    reward: 700,
  },
  {
    id: 3,
    name: 'Heat',
    text: 'Survive 30 seconds at 3 stars, then reach the safehouse.',
    type: 'escape',
    target: { x: 600, y: 1200 },
    survive: 30,
    reward: 1200,
  },
];

export const PALETTE = {
  grass: '#79b657',
  grassDark: '#6aa84c',
  park: '#5da244',
  road: '#333a45',
  roadLine: '#e8d44d',
  sidewalk: '#b9bec7',
  sand: '#e6d194',
  sea: '#2f7fb8',
  seaDeep: '#256b9e',
  building: '#c98f5f',
  buildingRoof: '#8a5a33',
  downtown: '#7d8aa0',
  downtownRoof: '#4d5a6e',
  tree: '#3f7d33',
  treeDark: '#2f5e26',
  player: '#f2c94c',
  playerShirt: '#e5534b',
  police: '#1c2430',
  policeLight: '#e5534b',
  text: '#f4f6f8',
  muted: '#c7ccd6',
  panel: 'rgba(16, 20, 28, 0.78)',
  gold: '#f2c94c',
  marker: '#ffe14d',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where progress is kept between visits (this browser only). */
export const SAVE_KEY = 'solmar-bay.save';
