// The screenshot scenes behind ?shot=start|drive|chase|mission. Each one plays
// the real rules forward from a fresh world for a fixed number of steps,
// steered by a simple autopilot that drives the player's car toward a
// waypoint on the roads, brakes for traffic ahead and reverses out when it
// gets stuck, so the frame is what a short game really looks like and the
// same seed always gives the same frame.

import { STEP } from './config.js';
import { SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const START_SECONDS = 6;
const DRIVE_SECONDS = 12;
const CHASE_SECONDS = 8;
const MISSION_SECONDS = 9;

/** Waypoints along the roads, for the drive scene's tour of the city. */
const TOUR = [
  { x: 2100, y: 300 },
  { x: 2100, y: 900 },
  { x: 900, y: 900 },
  { x: 900, y: 1500 },
  { x: 300, y: 1500 },
  { x: 300, y: 900 },
];

function angleDiff(a, b) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/**
 * Drive the player's car toward `target`: steer at it, brake for a car right
 * ahead, reverse out when stuck against something. `cruise` caps the speed
 * so the car can stop in time. Returns the held-keys input the world's step
 * takes.
 */
function driveToward(state, target, stuck, cruise = 540) {
  const p = state.player;
  const car = p.car;
  const input = { up: false, down: false, left: false, right: false, handbrake: false };
  if (!car || !target) return input;
  const speed = Math.hypot(car.vx, car.vy);
  if (speed < 30) stuck.time += STEP;
  else stuck.time = 0;
  if (stuck.time > 0.8) {
    // Stuck: reverse and turn for a moment, then try again.
    stuck.recover = 0.7;
    stuck.time = 0;
  }
  if (stuck.recover > 0) {
    stuck.recover -= STEP;
    input.down = true;
    input.left = true;
    return input;
  }
  const desired = Math.atan2(target.y - car.y, target.x - car.x);
  const diff = angleDiff(car.angle, desired);
  if (diff < -0.12) input.left = true;
  else if (diff > 0.12) input.right = true;
  // Brake when another car or a pedestrian is right ahead.
  let blocked = false;
  for (let i = 0; i < state.cars.length; i += 1) {
    const o = state.cars[i];
    if (o === car) continue;
    const dx = o.x - car.x;
    const dy = o.y - car.y;
    const ahead = dx * Math.cos(car.angle) + dy * Math.sin(car.angle);
    const side = Math.abs(-dx * Math.sin(car.angle) + dy * Math.cos(car.angle));
    if (ahead > 0 && ahead < 200 && side < 40) {
      blocked = true;
      break;
    }
  }
  if (!blocked) {
    for (let i = 0; i < state.peds.length; i += 1) {
      const ped = state.peds[i];
      if (ped.down > 0) continue;
      const dx = ped.x - car.x;
      const dy = ped.y - car.y;
      const ahead = dx * Math.cos(car.angle) + dy * Math.sin(car.angle);
      const side = Math.abs(-dx * Math.sin(car.angle) + dy * Math.cos(car.angle));
      if (ahead > 0 && ahead < 140 && side < 36) {
        blocked = true;
        break;
      }
    }
  }
  const dist = Math.hypot(target.x - car.x, target.y - car.y);
  if (blocked) input.down = speed > 60;
  else if (dist > 90) input.up = speed < cruise;
  else input.down = speed > 120;
  return input;
}

/** The road intersection farthest from the nearest police car. */
function fleePoint(state) {
  const p = state.player;
  let nearest = null;
  let nearestD = Infinity;
  for (let i = 0; i < state.cars.length; i += 1) {
    const c = state.cars[i];
    if (c.kind !== 'police') continue;
    const d = (c.x - p.x) * (c.x - p.x) + (c.y - p.y) * (c.y - p.y);
    if (d < nearestD) {
      nearestD = d;
      nearest = c;
    }
  }
  const points = [
    { x: 300, y: 300 },
    { x: 2100, y: 300 },
    { x: 300, y: 1500 },
    { x: 2100, y: 1500 },
    { x: 900, y: 900 },
    { x: 1500, y: 900 },
  ];
  let best = points[0];
  let bestScore = -Infinity;
  for (const pt of points) {
    const away = nearest ? Math.hypot(pt.x - nearest.x, pt.y - nearest.y) : 0;
    const near = Math.hypot(pt.x - p.x, pt.y - p.y);
    const score = away - near * 0.4;
    if (score > bestScore) {
      bestScore = score;
      best = pt;
    }
  }
  return best;
}

/**
 * Set `world` to the named scene (start, drive, chase or mission; any other
 * name is start) and return the screen to draw over it.
 */
export function stageShot(name, world) {
  const state = world.state;
  world.reset();
  if (name !== 'drive' && name !== 'chase' && name !== 'mission') {
    for (let i = 0; i < START_SECONDS / STEP; i += 1) {
      world.step(STEP, { up: false, down: false, left: false, right: false, handbrake: false }, 0);
    }
    return { screen: SCREEN_TITLE };
  }

  if (name === 'drive') {
    world.giveCar(876, 300, 0);
    let tourIndex = 0;
    const stuck = { time: 0, recover: 0 };
    for (let i = 0; i < DRIVE_SECONDS / STEP; i += 1) {
      const target = TOUR[tourIndex];
      const p = state.player;
      if (Math.hypot(target.x - p.x, target.y - p.y) < 130) tourIndex = (tourIndex + 1) % TOUR.length;
      world.step(STEP, driveToward(state, TOUR[tourIndex], stuck, 280), 0);
      if (state.busted) break;
    }
    return { screen: SCREEN_PLAY };
  }

  if (name === 'chase') {
    world.giveCar(900, 900, 0);
    world.setWanted(3);
    // Two cruisers start close by, so the frame shows the chase, not an empty road.
    world.placePolice(2);
    const stuck = { time: 0, recover: 0 };
    let target = fleePoint(state);
    let retarget = 0;
    for (let i = 0; i < CHASE_SECONDS / STEP; i += 1) {
      retarget -= STEP;
      if (retarget <= 0) {
        target = fleePoint(state);
        retarget = 2;
      }
      world.step(STEP, driveToward(state, target, stuck, 330), 0);
      if (state.busted) break;
    }
    return { screen: SCREEN_PLAY };
  }

  // mission: the package run, already picked up, racing the clock to the beach.
  world.startMissionAt(1);
  world.teleport(300, 300);
  world.giveCar(324, 300, 0);
  // Walk the player onto the pickup point first, then drive.
  const stuck = { time: 0, recover: 0 };
  for (let i = 0; i < MISSION_SECONDS / STEP; i += 1) {
    const m = state.mission;
    let target;
    if (!m) target = { x: 1200, y: 1700 };
    else if (m.def.type === 'deliver') target = m.pickedUp ? m.def.target : m.def.pickup;
    else if (m.def.type === 'escape') target = m.phase === 'go' ? m.def.target : fleePoint(state);
    else target = m.def.target;
    world.step(STEP, driveToward(state, target, stuck), 0);
    if (state.busted) break;
  }
  return { screen: SCREEN_PLAY };
}
