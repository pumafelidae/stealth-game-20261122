// The game's rules and state, with no drawing and no browser in it: the three zones of
// the night market, the guards and the thief inside them, the suspicion meter, the alarm,
// loot, lives, score and time. step() advances one fixed step and returns what happened
// as bit flags, so the caller can react without the world knowing about screens or sound.
//
// The story: the heirloom keris of the Sari family was stolen and sold through the night
// market. Slip through three zones — the stall lane, the spice warehouse, the dock —
// take back the market's takings and the keris itself, and reach the boat unseen.

import { DETECT, FIELD, GUARD, LIVES, LOOT, PLAYER, TIME_BONUS } from './config.js';
import { createGuard, guardSees, pointInRects, stepGuard } from './guards.js';
import { canGrab, createPlayer, insideExit, stepPlayer } from './player.js';

export const EVENT_GRAB = 1;
export const EVENT_ALARM = 2;
export const EVENT_CALM = 4;
export const EVENT_CAUGHT = 8;
export const EVENT_ZONE = 16;
export const EVENT_WIN = 32;
export const EVENT_OVER = 64;

// A zone is cover to hide behind (stalls and crates, which also block sight), lantern
// light pools (guards see you better inside one), dark awning shadows (safe to hide in),
// the guards' patrol loops, the loot, and the exit.
export const ZONES = [
  {
    name: 'ZONA 1 — Lorong Kios',
    sub: 'Stall lane · 2 guards · 3 takings',
    start: [80, 640],
    cover: [
      { x: 180, y: 120, w: 150, h: 70, kind: 'stall', roof: 0 },
      { x: 420, y: 120, w: 150, h: 70, kind: 'stall', roof: 1 },
      { x: 660, y: 120, w: 150, h: 70, kind: 'stall', roof: 0 },
      { x: 900, y: 120, w: 150, h: 70, kind: 'stall', roof: 1 },
      { x: 180, y: 420, w: 150, h: 70, kind: 'stall', roof: 1 },
      { x: 420, y: 420, w: 150, h: 70, kind: 'stall', roof: 0 },
      { x: 660, y: 420, w: 150, h: 70, kind: 'stall', roof: 1 },
      { x: 900, y: 420, w: 150, h: 70, kind: 'stall', roof: 0 },
      { x: 560, y: 340, w: 90, h: 60, kind: 'crate' },
      { x: 700, y: 340, w: 90, h: 60, kind: 'crate' },
    ],
    light: [
      { x: 320, y: 220, r: 130 },
      { x: 960, y: 220, r: 130 },
      { x: 640, y: 540, r: 130 },
    ],
    shadow: [
      { x: 200, y: 330, w: 120, h: 60 },
      { x: 880, y: 330, w: 120, h: 60 },
    ],
    guards: [
      { waypoints: [[300, 300], [980, 300]], dir: 0 },
      { waypoints: [[1080, 150], [1080, 560]], dir: Math.PI / 2 },
    ],
    loot: [
      { x: 640, y: 300, kind: 'coin' },
      { x: 980, y: 560, kind: 'spice' },
      { x: 250, y: 560, kind: 'coin' },
    ],
    exit: { x: 1150, y: 60, w: 90, h: 60, label: 'GANG KELUAR' },
  },
  {
    name: 'ZONA 2 — Gudang Rempah',
    sub: 'Spice warehouse · 3 guards · 3 takings',
    start: [90, 640],
    cover: [
      { x: 250, y: 150, w: 110, h: 90, kind: 'crate' },
      { x: 500, y: 150, w: 110, h: 90, kind: 'crate' },
      { x: 750, y: 150, w: 110, h: 90, kind: 'crate' },
      { x: 950, y: 150, w: 110, h: 90, kind: 'crate' },
      { x: 250, y: 430, w: 110, h: 90, kind: 'crate' },
      { x: 500, y: 430, w: 110, h: 90, kind: 'crate' },
      { x: 750, y: 430, w: 110, h: 90, kind: 'crate' },
      { x: 950, y: 430, w: 110, h: 90, kind: 'crate' },
      { x: 580, y: 280, w: 120, h: 100, kind: 'crate' },
    ],
    light: [
      { x: 400, y: 300, r: 130 },
      { x: 880, y: 300, r: 130 },
      { x: 640, y: 620, r: 130 },
    ],
    shadow: [
      { x: 350, y: 330, w: 120, h: 60 },
      { x: 800, y: 330, w: 120, h: 60 },
    ],
    guards: [
      // The lane runs at y 250: the centre crate spans y 280-380, so a lane at
      // y 290 would run straight into it and the guard would stick there.
      { waypoints: [[200, 250], [1080, 250]], dir: 0 },
      { waypoints: [[1150, 200], [1150, 550]], dir: Math.PI / 2 },
      { waypoints: [[300, 600], [900, 600]], dir: 0 },
    ],
    loot: [
      // The spice below the centre crate: the old spot (640, 340) sat INSIDE
      // the crate, so no thief could ever stand close enough to grab it.
      { x: 640, y: 410, kind: 'spice' },
      { x: 150, y: 640, kind: 'coin' },
      { x: 1150, y: 80, kind: 'spice' },
    ],
    exit: { x: 60, y: 60, w: 90, h: 60, label: 'PINTU GUDANG' },
  },
  {
    name: 'ZONA 3 — Dermaga',
    sub: 'The dock · 3 guards · the keris',
    start: [80, 640],
    cover: [
      { x: 200, y: 150, w: 120, h: 80, kind: 'crate' },
      { x: 450, y: 150, w: 120, h: 80, kind: 'crate' },
      { x: 800, y: 150, w: 120, h: 80, kind: 'crate' },
      { x: 200, y: 450, w: 120, h: 80, kind: 'crate' },
      { x: 450, y: 450, w: 120, h: 80, kind: 'crate' },
      { x: 800, y: 450, w: 120, h: 80, kind: 'crate' },
    ],
    light: [
      { x: 350, y: 300, r: 130 },
      { x: 950, y: 300, r: 130 },
      { x: 640, y: 620, r: 130 },
    ],
    shadow: [
      { x: 300, y: 330, w: 120, h: 60 },
      { x: 700, y: 330, w: 120, h: 60 },
    ],
    guards: [
      { waypoints: [[250, 300], [1000, 300]], dir: 0, fast: true },
      { waypoints: [[1150, 150], [1150, 550]], dir: Math.PI / 2 },
      { waypoints: [[400, 600], [900, 600]], dir: 0 },
    ],
    loot: [
      { x: 150, y: 80, kind: 'coin' },
      { x: 640, y: 80, kind: 'spice' },
      { x: 1100, y: 360, kind: 'keris' },
    ],
    exit: { x: 1180, y: 300, w: 90, h: 120, label: 'PERAHU' },
  },
];

function lootPoints(kind) {
  return kind === 'keris' ? LOOT.kerisPoints : LOOT.coinPoints;
}

export function createWorld(random) {
  const state = {
    zone: 0,
    player: null,
    guards: [],
    loot: [],
    suspicion: 0,
    alarm: false,
    lives: LIVES,
    score: 0,
    lootTaken: 0,
    lootTotal: 0,
    elapsed: 0,
    won: false,
    over: false,
    exitOpen: false,
    nearestGuardDist: 9999,
    anySeen: false,
  };

  function loadZone(index) {
    const zone = ZONES[index];
    state.zone = index;
    state.player = createPlayer(zone.start);
    state.guards = zone.guards.map(createGuard);
    state.loot = zone.loot.map((item) => ({ ...item, taken: false }));
    state.lootTotal = state.loot.length;
    state.lootTaken = 0;
    state.suspicion = 0;
    state.alarm = false;
    state.exitOpen = false;
    state.anySeen = false;
  }

  function reset() {
    state.lives = LIVES;
    state.score = 0;
    state.elapsed = 0;
    state.won = false;
    state.over = false;
    loadZone(0);
  }

  function restartZone() {
    loadZone(state.zone);
  }

  function inLight(x, y, zone) {
    for (let i = 0; i < zone.light.length; i += 1) {
      if (Math.hypot(x - zone.light[i].x, y - zone.light[i].y) <= zone.light[i].r) return true;
    }
    return false;
  }

  /**
   * One fixed step. `input` is {x, y, sneak, interact, clickX, clickY} from the input
   * module. With `harmless` set (the title screen's backdrop) the thief wanders and the
   * guards patrol, but nothing is seen, scored or lost.
   */
  function step(dt, input, harmless) {
    let events = 0;
    if (state.won || state.over) return events;
    state.elapsed += dt;
    const zone = ZONES[state.zone];
    const player = state.player;

    stepPlayer(player, input, dt, zone.cover);

    // The guards look: each one reports whether it sees the thief, and how far away.
    let seen = false;
    let nearest = 9999;
    for (let i = 0; i < state.guards.length; i += 1) {
      const guard = state.guards[i];
      const seenNow = guardSees(guard, player.x, player.y, zone.cover);
      guard.seesPlayer = seenNow.sees;
      guard.seeDist = seenNow.dist;
      if (seenNow.sees) seen = true;
      if (seenNow.dist < nearest) nearest = seenNow.dist;
    }
    state.anySeen = seen;
    state.nearestGuardDist = nearest;

    if (!harmless) {
      const inShadow = pointInRects(player.x, player.y, zone.shadow);
      const lit = inLight(player.x, player.y, zone);
      if (seen) {
        // Closer is worse; sneaking halves it, lamplight raises it, shadow halves it.
        const closeness = 1 - Math.min(1, nearest / GUARD.coneRange);
        let rate = DETECT.baseFar + (DETECT.baseNear - DETECT.baseFar) * closeness;
        if (player.sneaking) rate *= DETECT.sneakFactor;
        if (lit) rate *= DETECT.lightFactor;
        if (inShadow) rate *= DETECT.shadowFactor;
        state.suspicion = Math.min(100, state.suspicion + rate * dt);
      } else {
        // Heard, not seen: walking loud close behind a guard still raises the meter.
        if (!player.sneaking && nearest < GUARD.hearRange) {
          state.suspicion = Math.min(100, state.suspicion + DETECT.hearRate * dt);
        } else {
          const decay = state.alarm ? DETECT.alarmDecay : inShadow ? DETECT.shadowDecay : DETECT.decay;
          state.suspicion = Math.max(0, state.suspicion - decay * dt);
        }
      }

      if (!state.alarm && state.suspicion >= 100) {
        state.alarm = true;
        events |= EVENT_ALARM;
      } else if (state.alarm && state.suspicion <= DETECT.alarmClearBelow) {
        state.alarm = false;
        events |= EVENT_CALM;
      }

      // Grab loot with E.
      if (input.interact) {
        for (let i = 0; i < state.loot.length; i += 1) {
          const item = state.loot[i];
          if (canGrab(player, item)) {
            item.taken = true;
            state.lootTaken += 1;
            state.score += lootPoints(item.kind);
            events |= EVENT_GRAB;
            if (state.lootTaken === state.lootTotal) state.exitOpen = true;
            break;
          }
        }
      }

      // Caught: a guard close enough to lay a hand on the thief.
      for (let i = 0; i < state.guards.length; i += 1) {
        const guard = state.guards[i];
        if (Math.hypot(guard.x - player.x, guard.y - player.y) <= GUARD.catchRange) {
          state.lives -= 1;
          events |= EVENT_CAUGHT;
          if (state.lives <= 0) {
            state.over = true;
            events |= EVENT_OVER;
          } else {
            restartZone();
          }
          return events;
        }
      }

      // The exit only opens once every taking in the zone is collected.
      if (state.exitOpen && insideExit(player, zone.exit)) {
        if (state.zone === ZONES.length - 1) {
          state.won = true;
          state.score += state.lives * LOOT.lifeBonus;
          state.score += Math.max(0, TIME_BONUS.start - Math.floor(state.elapsed) * TIME_BONUS.perSecond);
          events |= EVENT_WIN;
        } else {
          events |= EVENT_ZONE;
          loadZone(state.zone + 1);
        }
        return events;
      }
    }

    for (let i = 0; i < state.guards.length; i += 1) {
      stepGuard(state.guards[i], dt, player.x, player.y, state.alarm, zone.cover);
    }
    return events;
  }

  reset();
  return { state, reset, step, restartZone, loadZone, zoneDef: () => ZONES[state.zone] };
}
