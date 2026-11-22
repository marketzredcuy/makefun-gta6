// Boot and the one loop: input is read every frame, the world advances in fixed
// 1/60 s steps (several in a slow frame, none in a fast one), and the renderer
// paints what is there. The game moves between four screens: title, play,
// paused and busted. Progress (money and missions done) is saved to
// localStorage whenever a mission is finished or the player is busted.
//
// ?seed=N fixes the city and the traffic. ?shot=start|drive|chase|mission
// (with &seed=N) stages that scene instead of running the loop, paints it
// twice and sets window.__shotReady for a screenshot.
import { STEP, SAVE_KEY } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_BUSTED, EVENT_CRASH, EVENT_MISSION, EVENT_PICKUP } from './world.js';
import { ACTION_CONFIRM, ACTION_ENTER, ACTION_MUTE, ACTION_PAUSE, createInput } from './input.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { createSound } from './sound.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;
const IDLE_INPUT = { up: false, down: false, left: false, right: false, handbrake: false };

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const sound = createSound();

function readSave() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(SAVE_KEY) ?? 'null');
    if (parsed && typeof parsed.money === 'number') return parsed;
  } catch {
    // Storage can be off (private windows): the save then lasts this visit only.
  }
  return { money: 0, missionsDone: 0 };
}

function writeSave(save) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  } catch {
    // Storage can be off (private windows): the save then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, readSave(), sound.isMuted());
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let save = readSave();
  let accumulator = 0;
  let last = performance.now();

  // Screen readers (and anyone watching the page's text) hear the screen changes and each event.
  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    sound.unlock();
    world.reset();
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce('Playing. Mara Voss has a job for you: steal a car and bring it to the Marina.');
  }

  function endGame() {
    screen = SCREEN_OVER;
    save = { money: world.state.player.money, missionsDone: world.state.missionIndex };
    writeSave(save);
    sound.stopSiren();
    sound.setEngine(0);
    announce(`Busted. You earned $${save.money} and finished ${save.missionsDone} of 3 missions.`);
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      sound.setMuted(!sound.isMuted());
      announce(sound.isMuted() ? 'Sound off.' : 'Sound on.');
    }
    if (actions & ACTION_CONFIRM && (screen === SCREEN_TITLE || screen === SCREEN_OVER)) startGame();
    else if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    }
    return actions;
  }

  function step(actions) {
    const worldActions = actions & ACTION_ENTER;
    if (screen === SCREEN_TITLE) {
      world.step(STEP, IDLE_INPUT, 0);
      return;
    }
    const events = world.step(STEP, input.held(), worldActions);
    if (events & EVENT_BUSTED) endGame();
    else if (events & EVENT_MISSION) {
      sound.missionDone();
      save = { money: world.state.player.money, missionsDone: world.state.missionIndex };
      writeSave(save);
      announce(world.state.message);
    } else if (events & EVENT_PICKUP) {
      sound.pickup();
      announce(world.state.message);
    } else if (events & EVENT_CRASH) {
      sound.crash();
    }
    // The siren and the engine follow the wanted level and the car's speed.
    if (world.state.wanted > 0) sound.startSiren();
    else sound.stopSiren();
    const car = world.state.player.car;
    sound.setEngine(car ? Math.min(1, Math.abs(car.speed) / 540) : 0);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    const actions = handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step(actions);
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, save, sound.isMuted());
  }

  // Leaving the tab pauses a running game rather than letting the police close in unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Solmar Bay. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
