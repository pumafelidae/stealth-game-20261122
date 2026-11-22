// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s
// steps (several in a slow frame, none in a fast one), and the renderer paints what is
// there. The game moves between five screens: title, play, paused, game over and win.
//
// ?seed=N fixes the game. ?shot=start|play|alert|escape (with &seed=N) stages that scene
// instead of running the loop, paints it twice and sets window.__shotReady for a screenshot.
// window.__pasar exposes the live world state for playtesting.

import { BEST_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import {
  EVENT_ALARM,
  EVENT_CALM,
  EVENT_CAUGHT,
  EVENT_GRAB,
  EVENT_OVER,
  EVENT_WIN,
  EVENT_ZONE,
  createWorld,
} from './world.js';
import { ACTION_CONFIRM, ACTION_PAUSE, createInput } from './input.js';
import { createAudio } from './audio.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

// Live state for playtests (and anyone poking at the game from the console).
window.__pasar = { state: world.state, world };

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();
  let lastGuardStep = 0;

  // Screen readers (and anyone watching the page's text) hear the screen changes.
  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    audio.unlock();
    world.reset();
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce('Bermain. 3 nyawa. Ambil semua takings, lalu ke pintu keluar.');
  }

  function endGame(won) {
    screen = won ? SCREEN_WIN : SCREEN_OVER;
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    if (won) {
      audio.win();
      announce(`Kabur! Skor ${world.state.score}. Terbaik ${best}.`);
    } else {
      audio.lose();
      announce(`Ketangkap. Skor ${world.state.score}. Terbaik ${best}.`);
    }
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_CONFIRM && (screen === SCREEN_TITLE || screen === SCREEN_OVER || screen === SCREEN_WIN)) {
      startGame();
    } else if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Jeda.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Bermain.');
    }
  }

  function step() {
    if (screen === SCREEN_TITLE) {
      world.step(STEP, { x: 0, y: 0, sneak: false, interact: false, clickX: null, clickY: null }, true);
      return;
    }
    const frame = input.frame();
    if (frame.x !== 0 || frame.y !== 0) input.clearClick();
    const events = world.step(STEP, frame, false);
    if (events & EVENT_GRAB) {
      audio.grab();
      announce(`Loot diambil. ${world.state.lootTaken} dari ${world.state.lootTotal}.`);
    }
    if (events & EVENT_ALARM) {
      audio.alarm();
      announce('Alarm! Para penjaga mengejarmu — hilang dari pandangan!');
    }
    if (events & EVENT_CALM) {
      audio.calm();
      announce('Alarm reda. Mereka kembali berpatroli.');
    }
    if (events & EVENT_CAUGHT) {
      audio.caught();
      announce(world.state.lives === 1 ? 'Ketangkap! 1 nyawa tersisa.' : `Ketangkap! ${world.state.lives} nyawa tersisa.`);
    }
    if (events & EVENT_ZONE) {
      audio.zone();
      announce(`Zona ${world.state.zone + 1}: ${world.state.zone === 1 ? 'Gudang Rempah.' : 'Dermaga.'}`);
    }
    if (events & EVENT_WIN) endGame(true);
    else if (events & EVENT_OVER) endGame(false);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step();
        accumulator -= STEP;
      }
      // Footsteps: the thief's own, and the nearest guard's when it is close.
      const player = world.state.player;
      if (screen === SCREEN_PLAY && player && player.moving) {
        audio.step(player.sneaking, 0);
      }
      const guardDist = world.state.nearestGuardDist;
      if (screen === SCREEN_PLAY && guardDist < 260 && now - lastGuardStep > 420) {
        lastGuardStep = now;
        audio.guardStep(1 - guardDist / 260);
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, best);
  }

  // Leaving the tab pauses a running game rather than letting guards close in unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Jeda.');
    }
  });

  announce('Pasar Senja. Tekan Spasi atau klik untuk mulai.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
