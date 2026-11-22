// The world: the city itself, the people and cars in it, the wanted level and
// the missions. Everything the player can do is a rule here: walk, drive,
// steal a car, commit a crime, get chased, finish a job for Mara Voss.
//
// The player is either on foot or driving one car. Traffic cars drive their
// roads and turn at intersections; pedestrians walk the sidewalks; police
// cars spawn when the player is wanted and chase them down. A step advances
// the whole world by one fixed 1/60 s and returns event flags for the loop.

import {
  WORLD,
  ROADS,
  PLAYER,
  CAR,
  TRAFFIC_COUNT,
  PED_COUNT,
  POLICE_MAX,
  WANTED,
  MISSIONS,
} from './config.js';
import { ACTION_ENTER } from './input.js';

export const EVENT_CRASH = 1;
export const EVENT_MISSION = 2;
export const EVENT_BUSTED = 4;
export const EVENT_PICKUP = 8;
export const EVENT_CRIME = 16;

const CAR_COLORS = ['#d94f3d', '#3d7dd9', '#e8b23a', '#7fb069', '#9b7ede', '#e8e8e8', '#5bc0be'];
const PED_SHIRTS = ['#e5534b', '#4fc3f7', '#f2c94c', '#9b7ede', '#7fb069', '#e8e8e8', '#ff8c42'];
const BUILDING_COLORS = ['#c98f5f', '#b57e52', '#d9a05b', '#a9713f', '#c47f6a'];
const TALL_COLORS = ['#7d8aa0', '#6b7a90', '#8d9cb2', '#5f6d80'];

function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

function dist2(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

function angleTo(ax, ay, bx, by) {
  return Math.atan2(by - ay, bx - ax);
}

function angleDiff(a, b) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/** The road centrelines, in order, for spawning and turning. */
function roadLines() {
  return [
    ...ROADS.vertical.map((x) => ({ axis: 'v', at: x })),
    ...ROADS.horizontal.map((y) => ({ axis: 'h', at: y })),
  ];
}

export function createWorld(random) {
  const lines = roadLines();
  const state = {
    time: 0,
    buildings: [],
    trees: [],
    boats: [],
    cars: [],
    peds: [],
    particles: [],
    skids: [],
    player: null,
    wanted: 0,
    quietTime: 0,
    missionIndex: 0,
    mission: null,
    message: '',
    messageTimer: 0,
    shake: 0,
    cam: { x: WORLD.width / 2, y: WORLD.height / 2 },
    busted: false,
    allDone: false,
  };

  // --- The city: buildings fill the blocks between roads; the middle block is
  // a park, the south strip is the beach, the east strip is the marina.
  function buildCity() {
    const vGaps = [0, ...ROADS.vertical, WORLD.width];
    const hGaps = [0, ...ROADS.horizontal, 1650];
    for (let vi = 0; vi < vGaps.length - 1; vi += 1) {
      for (let hi = 0; hi < hGaps.length - 1; hi += 1) {
        const x0 = vGaps[vi] + ROADS.width / 2 + 24;
        const x1 = vGaps[vi + 1] - ROADS.width / 2 - 24;
        const y0 = hGaps[hi] + ROADS.width / 2 + 24;
        const y1 = hGaps[hi + 1] - ROADS.width / 2 - 24;
        if (x1 - x0 < 140 || y1 - y0 < 120) continue;
        const isPark = x0 >= 948 && x0 < 1452 && y0 >= 948 && y0 < 1452;
        const isMarina = x0 >= 2148;
        if (isPark) {
          for (let i = 0; i < 42; i += 1) {
            state.trees.push({ x: x0 + random.next() * (x1 - x0), y: y0 + random.next() * (y1 - y0), r: 14 + random.next() * 10 });
          }
          continue;
        }
        if (isMarina) continue;
        const downtown = x0 >= 1548 && x0 < 2052 && y0 >= 948 && y0 < 1452;
        const count = downtown ? 4 : 2 + random.int(0, 3);
        for (let i = 0; i < count; i += 1) {
          const w = 110 + random.next() * 150;
          const h = 90 + random.next() * 110;
          const x = x0 + random.next() * Math.max(1, x1 - x0 - w);
          const y = y0 + random.next() * Math.max(1, y1 - y0 - h);
          state.buildings.push({
            x,
            y,
            w,
            h,
            tall: downtown,
            color: downtown ? random.pick(TALL_COLORS) : random.pick(BUILDING_COLORS),
          });
        }
      }
    }
    // Boats moored in the marina water.
    for (let i = 0; i < 6; i += 1) {
      state.boats.push({ x: 2280 + random.next() * 100, y: 1000 + i * 110 + random.next() * 40, angle: (random.next() - 0.5) * 0.4 });
    }
    // A few street trees along the sidewalks.
    for (let i = 0; i < 24; i += 1) {
      const line = random.pick(lines);
      const along = 120 + random.next() * (WORLD.width - 240);
      if (line.axis === 'v') state.trees.push({ x: line.at + (random.next() < 0.5 ? -1 : 1) * (ROADS.width / 2 + 12), y: along, r: 11 + random.next() * 6 });
      else state.trees.push({ x: along, y: line.at + (random.next() < 0.5 ? -1 : 1) * (ROADS.width / 2 + 12), r: 11 + random.next() * 6 });
    }
  }

  function roadPoint() {
    const line = random.pick(lines);
    if (line.axis === 'v') return { x: line.at, y: 100 + random.next() * (WORLD.height - 200), line };
    return { x: 100 + random.next() * (WORLD.width - 200), y: line.at, line };
  }

  function spawnTrafficCar() {
    const point = roadPoint();
    const dir = random.next() < 0.5 ? 1 : -1;
    const lane = dir === 1 ? 24 : -24;
    let x = point.x;
    let y = point.y;
    if (point.line.axis === 'v') x = point.line.at + lane;
    else y = point.line.at + lane;
    return {
      kind: 'traffic',
      x,
      y,
      angle: point.line.axis === 'v' ? (dir === 1 ? Math.PI / 2 : -Math.PI / 2) : dir === 1 ? 0 : Math.PI,
      speed: 120 + random.next() * 90,
      color: random.pick(CAR_COLORS),
      line: point.line,
      dir,
      vx: 0,
      vy: 0,
    };
  }

  function spawnPedestrian() {
    const point = roadPoint();
    const dir = random.next() < 0.5 ? 1 : -1;
    const off = ROADS.width / 2 + ROADS.sidewalk / 2;
    let x = point.x;
    let y = point.y;
    if (point.line.axis === 'v') x = point.line.at + (random.next() < 0.5 ? -off : off);
    else y = point.line.at + (random.next() < 0.5 ? -off : off);
    return {
      x,
      y,
      angle: point.line.axis === 'v' ? (dir === 1 ? Math.PI / 2 : -Math.PI / 2) : dir === 1 ? 0 : Math.PI,
      speed: 28 + random.next() * 30,
      shirt: random.pick(PED_SHIRTS),
      line: point.line,
      dir,
      down: 0,
    };
  }

  function spawnPolice() {
    // Police arrive from a road point well away from the player.
    for (let tries = 0; tries < 12; tries += 1) {
      const car = spawnTrafficCar();
      if (dist2(car.x, car.y, state.player.x, state.player.y) > 500 * 500) {
        car.kind = 'police';
        car.color = '#1c2430';
        car.speed = 300;
        return car;
      }
    }
    const car = spawnTrafficCar();
    car.kind = 'police';
    car.color = '#1c2430';
    car.speed = 300;
    car.ramTimer = 0;
    return car;
  }

  /** Spawn police cars close to the player (used to stage a tight chase scene). */
  function placePolice(count) {
    const p = state.player;
    for (let i = 0; i < count; i += 1) {
      const angle = (i / count) * Math.PI * 2 + 0.6;
      const car = {
        kind: 'police',
        x: clamp(p.x + Math.cos(angle) * 320, 60, WORLD.width - 60),
        y: clamp(p.y + Math.sin(angle) * 320, 60, WORLD.height - 60),
        angle: angleTo(p.x + Math.cos(angle) * 320, p.y + Math.sin(angle) * 320, p.x, p.y),
        speed: 300,
        color: '#1c2430',
        vx: 0,
        vy: 0,
        ramTimer: 0,
      };
      state.cars.push(car);
    }
  }

  function showMessage(text, seconds = 5) {
    state.message = text;
    state.messageTimer = seconds;
  }

  function commitCrime(stars, text) {
    state.wanted = Math.min(WANTED.max, state.wanted + stars);
    state.quietTime = 0;
    if (text) showMessage(text);
  }

  function startMission(index) {
    const def = MISSIONS[index];
    if (!def) {
      state.mission = null;
      state.allDone = true;
      return;
    }
    state.mission = {
      def,
      pickedUp: false,
      timer: def.timeLimit || 0,
      surviveLeft: def.survive || 0,
      phase: def.type === 'escape' ? 'survive' : 'go',
    };
    if (def.type === 'escape') commitCrime(3, 'The heat is on! Survive 45 seconds.');
    else showMessage(`${def.name}: ${def.text}`);
  }

  function burst(x, y, color, count) {
    for (let i = 0; i < count; i += 1) {
      const a = random.next() * Math.PI * 2;
      const s = 60 + random.next() * 220;
      state.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.5 + random.next() * 0.4, color, size: 3 + random.next() * 4 });
    }
  }

  /** Circle (a car or the player) against a building rect: push out, return the impact speed along the push. */
  function collideBuilding(x, y, r, vx, vy) {
    for (let i = 0; i < state.buildings.length; i += 1) {
      const b = state.buildings[i];
      const cx = clamp(x, b.x, b.x + b.w);
      const cy = clamp(y, b.y, b.y + b.h);
      const dx = x - cx;
      const dy = y - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 >= r * r) continue;
      const d = Math.sqrt(d2) || 0.001;
      const push = r - d;
      const nx = dx / d;
      const ny = dy / d;
      const impact = Math.abs(vx * nx + vy * ny);
      return { x: x + nx * push, y: y + ny * push, impact, nx, ny };
    }
    return null;
  }

  function hurt(amount) {
    const p = state.player;
    p.health -= amount;
    if (p.health <= 0) {
      p.health = 0;
      state.busted = true;
    }
  }

  function reset() {
    state.time = 0;
    state.buildings = [];
    state.trees = [];
    state.boats = [];
    state.cars = [];
    state.peds = [];
    state.particles = [];
    state.skids = [];
    state.wanted = 0;
    state.quietTime = 0;
    state.missionIndex = 0;
    state.allDone = false;
    state.busted = false;
    state.shake = 0;
    buildCity();
    for (let i = 0; i < TRAFFIC_COUNT; i += 1) state.cars.push(spawnTrafficCar());
    for (let i = 0; i < PED_COUNT; i += 1) state.peds.push(spawnPedestrian());
    // The player's own car, parked by the kerb near the start.
    const ownCar = {
      kind: 'parked',
      x: 876,
      y: 636,
      angle: Math.PI / 2,
      speed: 0,
      color: '#ff8c42',
      vx: 0,
      vy: 0,
    };
    state.cars.push(ownCar);
    state.player = {
      x: 920,
      y: 700,
      angle: -Math.PI / 2,
      health: PLAYER.maxHealth,
      money: 120,
      onFoot: true,
      car: null,
      vx: 0,
      vy: 0,
    };
    startMission(0);
  }

  function nearestCar(maxDist) {
    const p = state.player;
    let best = null;
    let bestD = maxDist * maxDist;
    for (let i = 0; i < state.cars.length; i += 1) {
      const c = state.cars[i];
      if (c.kind === 'police') continue;
      const d = dist2(p.x, p.y, c.x, c.y);
      if (d < bestD) {
        bestD = d;
        best = c;
      }
    }
    return best;
  }

  function enterCar() {
    const p = state.player;
    if (!p.onFoot) {
      // Get out, if slow enough: the car stays parked where it stops.
      const car = p.car;
      if (Math.abs(car.speed) > 70) {
        showMessage('Slow down to get out.', 2);
        return;
      }
      p.onFoot = true;
      p.car = null;
      car.kind = 'parked';
      car.speed = 0;
      car.vx = 0;
      car.vy = 0;
      p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 40;
      p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 40;
      p.angle = car.angle;
      return;
    }
    const car = nearestCar(PLAYER.enterRange);
    if (!car) return;
    if (car.kind === 'traffic') {
      commitCrime(WANTED.stealCar, 'Car stolen! +1 wanted star.');
    }
    car.kind = 'player';
    p.car = car;
    p.onFoot = false;
    p.x = car.x;
    p.y = car.y;
    p.angle = car.angle;
  }

  function driveCar(car, input, dt) {
    const forward = { x: Math.cos(car.angle), y: Math.sin(car.angle) };
    const speedForward = car.vx * forward.x + car.vy * forward.y;
    if (input.up) {
      car.vx += forward.x * CAR.accel * dt;
      car.vy += forward.y * CAR.accel * dt;
    }
    if (input.down) {
      if (speedForward > 20) {
        car.vx -= forward.x * CAR.brake * dt;
        car.vy -= forward.y * CAR.brake * dt;
      } else {
        car.vx -= forward.x * CAR.accel * 0.55 * dt;
        car.vy -= forward.y * CAR.accel * 0.55 * dt;
      }
    }
    // Steering bites harder the faster the car goes, and reverses when reversing.
    const steerAmount = clamp(speedForward / 140, -1, 1) * CAR.steer * dt;
    if (input.left) car.angle -= steerAmount * (input.handbrake ? 1.5 : 1);
    if (input.right) car.angle += steerAmount * (input.handbrake ? 1.5 : 1);
    // Grip: the sideways slide dies fast, slowly with the handbrake out (drift).
    const grip = input.handbrake ? 1.4 : CAR.grip;
    const f2 = { x: Math.cos(car.angle), y: Math.sin(car.angle) };
    const lat = { x: -f2.y, y: f2.x };
    const latSpeed = car.vx * lat.x + car.vy * lat.y;
    const decay = Math.exp(-grip * dt);
    car.vx -= lat.x * latSpeed * (1 - decay);
    car.vy -= lat.y * latSpeed * (1 - decay);
    // Drag and the speed cap.
    const drag = input.up || input.down ? 0.25 : 1.1;
    car.vx *= 1 - drag * dt * 0.4;
    car.vy *= 1 - drag * dt * 0.4;
    const sp = Math.hypot(car.vx, car.vy);
    if (sp > CAR.maxSpeed) {
      car.vx = (car.vx / sp) * CAR.maxSpeed;
      car.vy = (car.vy / sp) * CAR.maxSpeed;
    }
    if (input.handbrake && sp > 220) {
      state.skids.push({ x: car.x, y: car.y, angle: car.angle, life: 4 });
      if (state.skids.length > 220) state.skids.splice(0, state.skids.length - 220);
    }
    car.x += car.vx * dt;
    car.y += car.vy * dt;
    car.speed = Math.hypot(car.vx, car.vy);
    car.x = clamp(car.x, 30, WORLD.width - 30);
    car.y = clamp(car.y, 30, WORLD.height - 30);
  }

  function stepTraffic(dt) {
    for (let i = 0; i < state.cars.length; i += 1) {
      const c = state.cars[i];
      if (c.kind !== 'traffic') continue;
      const ahead = { x: c.x + Math.cos(c.angle) * 90, y: c.y + Math.sin(c.angle) * 90 };
      let blocked = false;
      for (let j = 0; j < state.cars.length; j += 1) {
        const o = state.cars[j];
        if (o === c || o.kind === 'parked') continue;
        if (dist2(ahead.x, ahead.y, o.x, o.y) < 55 * 55) {
          blocked = true;
          break;
        }
      }
      const speed = blocked ? 0 : c.speed;
      c.x += Math.cos(c.angle) * speed * dt;
      c.y += Math.sin(c.angle) * speed * dt;
      // Turn at an intersection sometimes, so traffic spreads over the grid.
      const cross = c.line.axis === 'v' ? ROADS.horizontal : ROADS.vertical;
      for (let k = 0; k < cross.length; k += 1) {
        const at = cross[k];
        const along = c.line.axis === 'v' ? c.y : c.x;
        if (Math.abs(along - at) < 6 && random.next() < 0.004) {
          const newLine = c.line.axis === 'v' ? { axis: 'h', at } : { axis: 'v', at };
          const newDir = random.next() < 0.5 ? 1 : -1;
          const lane = newDir === 1 ? 24 : -24;
          if (newLine.axis === 'v') {
            c.x = newLine.at + lane;
            c.angle = newDir === 1 ? Math.PI / 2 : -Math.PI / 2;
          } else {
            c.y = newLine.at + lane;
            c.angle = newDir === 1 ? 0 : Math.PI;
          }
          c.line = newLine;
          c.dir = newDir;
          break;
        }
      }
      // Wrap around the far end of the road instead of leaving the city.
      if (c.line.axis === 'v') {
        if (c.y < 40) c.y = WORLD.height - 40;
        if (c.y > WORLD.height - 40) c.y = 40;
      } else {
        if (c.x < 40) c.x = WORLD.width - 40;
        if (c.x > WORLD.width - 40) c.x = 40;
      }
    }
  }

  function stepPeds(dt) {
    for (let i = 0; i < state.peds.length; i += 1) {
      const p = state.peds[i];
      if (p.down > 0) {
        p.down -= dt;
        continue;
      }
      p.x += Math.cos(p.angle) * p.speed * dt;
      p.y += Math.sin(p.angle) * p.speed * dt;
      const cross = p.line.axis === 'v' ? ROADS.horizontal : ROADS.vertical;
      for (let k = 0; k < cross.length; k += 1) {
        const at = cross[k];
        const along = p.line.axis === 'v' ? p.y : p.x;
        if (Math.abs(along - at) < 5 && random.next() < 0.003) {
          const newLine = p.line.axis === 'v' ? { axis: 'h', at } : { axis: 'v', at };
          const newDir = random.next() < 0.5 ? 1 : -1;
          const off = ROADS.width / 2 + ROADS.sidewalk / 2;
          if (newLine.axis === 'v') {
            p.x = newLine.at + (random.next() < 0.5 ? -off : off);
            p.angle = newDir === 1 ? Math.PI / 2 : -Math.PI / 2;
          } else {
            p.y = newLine.at + (random.next() < 0.5 ? -off : off);
            p.angle = newDir === 1 ? 0 : Math.PI;
          }
          p.line = newLine;
          p.dir = newDir;
          break;
        }
      }
      if (p.line.axis === 'v') {
        if (p.y < 60) {
          p.y = 60;
          p.dir = 1;
          p.angle = Math.PI / 2;
        }
        if (p.y > WORLD.height - 60) {
          p.y = WORLD.height - 60;
          p.dir = -1;
          p.angle = -Math.PI / 2;
        }
      } else {
        if (p.x < 60) {
          p.x = 60;
          p.dir = 1;
          p.angle = 0;
        }
        if (p.x > WORLD.width - 60) {
          p.x = WORLD.width - 60;
          p.dir = -1;
          p.angle = Math.PI;
        }
      }
    }
  }

  function stepPolice(dt) {
    const p = state.player;
    const want = Math.min(state.wanted, POLICE_MAX);
    let have = 0;
    for (let i = 0; i < state.cars.length; i += 1) if (state.cars[i].kind === 'police') have += 1;
    while (have < want) {
      state.cars.push(spawnPolice());
      have += 1;
    }
    // Wanted gone: the police drive off (removed).
    if (state.wanted === 0) {
      state.cars = state.cars.filter((c) => c.kind !== 'police');
      return;
    }
    for (let i = 0; i < state.cars.length; i += 1) {
      const c = state.cars[i];
      if (c.kind !== 'police') continue;
      if (c.ramTimer > 0) c.ramTimer -= dt;
      // A cruiser that has lost sight of the player gives up the chase and
      // cruises, so a fast driver can break away and cool the wanted level.
      const far = dist2(c.x, c.y, p.x, p.y) > 700 * 700;
      const targetAngle = far
        ? c.angle
        : angleTo(c.x, c.y, p.x + (p.vx || 0) * 0.4, p.y + (p.vy || 0) * 0.4);
      const diff = angleDiff(c.angle, targetAngle);
      c.angle += clamp(diff, -2.4 * dt, 2.4 * dt);
      // Cruisers are a touch slower than the player's car, so a clean getaway
      // is possible — the chase is a threat, not a death sentence.
      const targetSpeed = far ? 220 : 500;
      const cur = Math.hypot(c.vx || 0, c.vy || 0);
      const accel = cur < targetSpeed ? 380 : 0;
      c.vx = (c.vx || 0) + Math.cos(c.angle) * accel * dt;
      c.vy = (c.vy || 0) + Math.sin(c.angle) * accel * dt;
      const sp = Math.hypot(c.vx, c.vy);
      if (sp > targetSpeed) {
        c.vx = (c.vx / sp) * targetSpeed;
        c.vy = (c.vy / sp) * targetSpeed;
      }
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      c.speed = sp;
      const hit = collideBuilding(c.x, c.y, 24, c.vx, c.vy);
      if (hit) {
        c.x = hit.x;
        c.y = hit.y;
        c.vx *= 0.4;
        c.vy *= 0.4;
      }
      c.x = clamp(c.x, 30, WORLD.width - 30);
      c.y = clamp(c.y, 30, WORLD.height - 30);
    }
  }

  function stepCollisions(events) {
    const p = state.player;
    // The player's car against buildings, traffic and pedestrians.
    if (!p.onFoot && p.car) {
      const car = p.car;
      const hit = collideBuilding(car.x, car.y, 26, car.vx, car.vy);
      if (hit) {
        car.x = hit.x;
        car.y = hit.y;
        const into = hit.nx * car.vx + hit.ny * car.vy;
        car.vx -= hit.nx * into * 1.4;
        car.vy -= hit.ny * into * 1.4;
        if (hit.impact > 170) {
          hurt(6);
          burst(car.x, car.y, '#e8d44d', 12);
          state.shake = Math.min(14, state.shake + 6);
          events |= EVENT_CRASH;
        }
      }
      for (let i = 0; i < state.cars.length; i += 1) {
        const o = state.cars[i];
        if (o === car || o.kind === 'parked' || o.kind === 'police') continue;
        const d2 = dist2(car.x, car.y, o.x, o.y);
        if (d2 < 52 * 52) {
          const d = Math.sqrt(d2) || 1;
          const nx = (car.x - o.x) / d;
          const ny = (car.y - o.y) / d;
          const rel = Math.abs((car.vx - (o.vx || 0)) * nx + (car.vy - (o.vy || 0)) * ny);
          car.x += nx * 2;
          car.y += ny * 2;
          car.vx *= 0.7;
          car.vy *= 0.7;
          // Only a hard hit counts as a crime — a gentle bump in traffic is
          // just a bump, not a wanted star.
          if (rel > 220) {
            commitCrime(WANTED.hitCar, 'You hit a car! +1 wanted star.');
            hurt(4);
            burst(car.x, car.y, '#e8d44d', 10);
            state.shake = Math.min(14, state.shake + 5);
            events |= EVENT_CRASH | EVENT_CRIME;
          }
        }
      }
      for (let i = 0; i < state.peds.length; i += 1) {
        const ped = state.peds[i];
        if (ped.down > 0) continue;
        if (dist2(car.x, car.y, ped.x, ped.y) < 34 * 34 && car.speed > 60) {
          ped.down = 6;
          commitCrime(WANTED.hitPedestrian, 'You hit a pedestrian! +2 wanted stars.');
          burst(ped.x, ped.y, '#e5534b', 10);
          state.shake = Math.min(14, state.shake + 7);
          events |= EVENT_CRASH | EVENT_CRIME;
        }
      }
    }
    // Police ramming the player: a ram hurts, but one car cannot ram twice
    // in a row, so the player is never stun-locked by a single cruiser.
    for (let i = 0; i < state.cars.length; i += 1) {
      const c = state.cars[i];
      if (c.kind !== 'police') continue;
      if (dist2(c.x, c.y, p.x, p.y) < 46 * 46) {
        const d = Math.sqrt(dist2(c.x, c.y, p.x, p.y)) || 1;
        const nx = (p.x - c.x) / d;
        const ny = (p.y - c.y) / d;
        if (!p.onFoot && p.car) {
          // A ram shoves the player's car, but not so hard that the player
          // loses all control — the chase is a threat, not a pinball table.
          p.car.vx += nx * 140;
          p.car.vy += ny * 140;
          c.vx *= 0.3;
          c.vy *= 0.3;
        } else {
          p.x += nx * 26;
          p.y += ny * 26;
          state.busted = true;
          events |= EVENT_BUSTED;
          return events;
        }
        if (!c.ramTimer || c.ramTimer <= 0) {
          c.ramTimer = 2.0;
          hurt(3);
          burst(p.x, p.y, '#e5534b', 12);
          state.shake = Math.min(16, state.shake + 8);
          events |= EVENT_CRASH;
        }
      }
    }
    // A traffic car hitting the player on foot.
    if (p.onFoot) {
      for (let i = 0; i < state.cars.length; i += 1) {
        const c = state.cars[i];
        if (c.kind !== 'traffic') continue;
        if (dist2(c.x, c.y, p.x, p.y) < 34 * 34 && c.speed > 80) {
          hurt(18);
          const d = Math.sqrt(dist2(c.x, c.y, p.x, p.y)) || 1;
          p.x += ((p.x - c.x) / d) * 40;
          p.y += ((p.y - c.y) / d) * 40;
          burst(p.x, p.y, '#e5534b', 10);
          state.shake = Math.min(14, state.shake + 7);
          events |= EVENT_CRASH;
          break;
        }
      }
    }
    return events;
  }

  function stepMission(dt) {
    const m = state.mission;
    if (!m) return 0;
    const p = state.player;
    const def = m.def;
    if (def.type === 'reach') {
      if (!p.onFoot && dist2(p.x, p.y, def.target.x, def.target.y) < 80 * 80) return completeMission();
      if (p.onFoot) showMessage('Get in a car first — press E near one.', 1);
    } else if (def.type === 'deliver') {
      if (!m.pickedUp) {
        if (dist2(p.x, p.y, def.pickup.x, def.pickup.y) < 70 * 70) {
          m.pickedUp = true;
          m.timer = def.timeLimit;
          showMessage(`Package picked up! Deliver to South Beach in ${def.timeLimit}s.`, 4);
          return EVENT_PICKUP;
        }
      } else {
        m.timer -= dt;
        if (m.timer <= 0) {
          m.pickedUp = false;
          m.timer = def.timeLimit;
          showMessage('Too slow! The package is back in Old Town — try again.', 4);
          return 0;
        }
        if (dist2(p.x, p.y, def.target.x, def.target.y) < 80 * 80) return completeMission();
      }
    } else if (def.type === 'escape') {
      if (m.phase === 'survive') {
        m.surviveLeft -= dt;
        if (m.surviveLeft <= 0) {
          m.phase = 'go';
          showMessage('You shook them off — now reach the safehouse!', 4);
        }
      } else if (dist2(p.x, p.y, def.target.x, def.target.y) < 80 * 80) {
        return completeMission();
      }
    }
    return 0;
  }

  function completeMission() {
    const m = state.mission;
    const p = state.player;
    p.money += m.def.reward;
    showMessage(`${m.def.name} complete! +$${m.def.reward}`, 4);
    state.missionIndex += 1;
    if (state.missionIndex >= MISSIONS.length) {
      state.mission = null;
      state.allDone = true;
      showMessage('All missions complete — Solmar Bay is yours.', 6);
    } else {
      startMission(state.missionIndex);
    }
    return EVENT_MISSION;
  }

  function step(dt, input, actions) {
    let events = 0;
    if (state.busted) return events;
    state.time += dt;
    const p = state.player;

    if (actions & ACTION_ENTER) enterCar();

    if (p.onFoot) {
      const mx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
      const my = (input.down ? 1 : 0) - (input.up ? 1 : 0);
      if (mx !== 0 || my !== 0) {
        const len = Math.hypot(mx, my);
        p.x += (mx / len) * PLAYER.walkSpeed * dt;
        p.y += (my / len) * PLAYER.walkSpeed * dt;
        p.angle = Math.atan2(my, mx);
      }
      const hit = collideBuilding(p.x, p.y, PLAYER.radius, 0, 0);
      if (hit) {
        p.x = hit.x;
        p.y = hit.y;
      }
      p.x = clamp(p.x, 20, WORLD.width - 20);
      p.y = clamp(p.y, 20, WORLD.height - 20);
    } else if (p.car) {
      driveCar(p.car, input, dt);
      p.x = p.car.x;
      p.y = p.car.y;
      p.angle = p.car.angle;
      p.vx = p.car.vx;
      p.vy = p.car.vy;
    }

    stepTraffic(dt);
    stepPeds(dt);
    stepPolice(dt);
    events = stepCollisions(events);
    if (state.busted) return events | EVENT_BUSTED;
    events |= stepMission(dt);

    // Wanted cools off after a quiet stretch with no police close by.
    state.quietTime += dt;
    if (state.wanted > 0 && state.quietTime > WANTED.coolSeconds) {
      let nearPolice = false;
      for (let i = 0; i < state.cars.length; i += 1) {
        const c = state.cars[i];
        if (c.kind === 'police' && dist2(c.x, c.y, p.x, p.y) < 500 * 500) {
          nearPolice = true;
          break;
        }
      }
      if (!nearPolice) {
        state.wanted -= 1;
        state.quietTime = 0;
        if (state.wanted === 0) showMessage('You lost the heat.', 3);
      }
    }

    // Health comes back slowly when the heat is low — a scrape is not a
    // death sentence, but a full chase keeps the pressure on.
    if (state.wanted <= 1 && p.health < PLAYER.maxHealth) {
      p.health = Math.min(PLAYER.maxHealth, p.health + 6 * dt);
    }

    // Particles and skids fade; the camera follows the player.
    for (let i = state.particles.length - 1; i >= 0; i -= 1) {
      const pt = state.particles[i];
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.life -= dt;
      if (pt.life <= 0) state.particles.splice(i, 1);
    }
    for (let i = state.skids.length - 1; i >= 0; i -= 1) {
      state.skids[i].life -= dt;
      if (state.skids[i].life <= 0) state.skids.splice(i, 1);
    }
    if (state.messageTimer > 0) state.messageTimer -= dt;
    if (state.shake > 0) state.shake = Math.max(0, state.shake - 30 * dt);
    const targetCamX = clamp(p.x, 640, WORLD.width - 640);
    const targetCamY = clamp(p.y, 360, WORLD.height - 360);
    state.cam.x += (targetCamX - state.cam.x) * Math.min(1, 6 * dt);
    state.cam.y += (targetCamY - state.cam.y) * Math.min(1, 6 * dt);
    return events;
  }

  reset();

  return {
    state,
    reset,
    step,
    /** Put the player in a fresh car at a spot (used to stage screenshots). */
    giveCar(x, y, angle) {
      const p = state.player;
      const car = {
        kind: 'player',
        x,
        y,
        angle: angle || 0,
        speed: 0,
        color: '#ff8c42',
        vx: 0,
        vy: 0,
      };
      state.cars.push(car);
      p.car = car;
      p.onFoot = false;
      p.x = x;
      p.y = y;
      p.angle = car.angle;
      return car;
    },
    /** Set the wanted level directly (used to stage the chase scene). */
    setWanted(n) {
      state.wanted = n;
      state.quietTime = 0;
    },
    /** Jump the player somewhere (used to stage screenshots). */
    teleport(x, y) {
      const p = state.player;
      p.x = x;
      p.y = y;
      state.cam.x = clamp(x, 640, WORLD.width - 640);
      state.cam.y = clamp(y, 360, WORLD.height - 360);
    },
    /** Spawn police cars close to the player (used to stage a tight chase scene). */
    placePolice(count) {
      placePolice(count);
    },
    /** Start a mission at a given index (used to stage the mission scene). */
    startMissionAt(index) {
      state.missionIndex = index;
      state.allDone = false;
      startMission(index);
    },
  };
}
