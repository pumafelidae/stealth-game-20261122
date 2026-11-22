// The screenshot scenes behind ?shot=start|play|alert|escape. Each one plays the real
// rules forward from a fresh world for a fixed number of steps, steered by a cautious
// autopilot (sneak toward the nearest taking, then the exit; wait when a guard's path
// comes close), so the frame is what a real game looks like and the same seed always
// gives the same frame. No teleporting, no state faking: every scene is played.

import { STEP } from './config.js';
import { ZONES } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';

const START_SECONDS = 5;
const PLAY_SECONDS = 40;
const ESCAPE_SECONDS = 150;
const ALERT_SECONDS = 40;
/** A guard closer than this to the walking line makes the pilot wait, out of sight. */
const WAIT_RANGE = 70;
/** How far the pilot must be from a guard's path before it moves again. */
const SAFE_RANGE = 95;

/** Distance from a point to the segment (x1,y1)-(x2,y2). */
function distToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((px - x1) * dx + (py - y1) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

/** The next objective: the nearest taking still on the floor, else the exit's centre. */
function nextObjective(world) {
  const state = world.state;
  let best = null;
  let bestDist = Infinity;
  for (const item of state.loot) {
    if (item.taken) continue;
    const d = Math.hypot(item.x - state.player.x, item.y - state.player.y);
    if (d < bestDist) {
      bestDist = d;
      best = item;
    }
  }
  if (best) return { x: best.x, y: best.y, grab: true };
  const exit = ZONES[state.zone].exit;
  return { x: exit.x + exit.w / 2, y: exit.y + exit.h / 2, grab: false };
}

/**
 * One autopilot step: sneak toward the objective, wait when a guard is near the line,
 * and press E when standing on a taking.
 */
function autopilot(world) {
  const state = world.state;
  const player = state.player;
  const target = nextObjective(world);
  const dx = target.x - player.x;
  const dy = target.y - player.y;
  const dist = Math.hypot(dx, dy);
  // Wait out a guard that is about to cross the walking line.
  for (const guard of state.guards) {
    if (distToSegment(guard.x, guard.y, player.x, player.y, target.x, target.y) < WAIT_RANGE) {
      const guardDist = Math.hypot(guard.x - player.x, guard.y - player.y);
      if (guardDist < SAFE_RANGE + 40) return { x: 0, y: 0, sneak: true, interact: false, clickX: null, clickY: null };
    }
  }
  if (dist < 4) {
    return { x: 0, y: 0, sneak: true, interact: target.grab, clickX: null, clickY: null };
  }
  return { x: dx / dist, y: dy / dist, sneak: true, interact: dist < 30 && target.grab, clickX: null, clickY: null };
}

/**
 * Set `world` to the named scene (start, play, alert or escape; any other name is start)
 * and return the screen to draw over it and the best score to show.
 */
export function stageShot(name, world) {
  world.reset();
  if (name !== 'play' && name !== 'alert' && name !== 'escape') {
    // Title over the stall lane: guards patrol, the thief waits at the gate.
    for (let index = 0; index < START_SECONDS / STEP; index += 1) {
      world.step(STEP, { x: 0, y: 0, sneak: false, interact: false, clickX: null, clickY: null }, true);
    }
    return { screen: SCREEN_TITLE, best: 0 };
  }

  if (name === 'alert') {
    // Slip to the edge of the first guard's lane and stand there, loud, until the
    // meter is high — close enough to be seen, far enough off the patrol line
    // that the guard never walks into the thief. The route threads the gap
    // between the bottom stalls (x 330-420) into the middle lane.
    const waypoints = [
      [120, 560],
      [360, 560],
      [360, 340],
      [450, 340],
    ];
    let wp = 0;
    let suspicion = 0;
    for (let index = 0; index < ALERT_SECONDS / STEP; index += 1) {
      const player = world.state.player;
      let input = { x: 0, y: 0, sneak: false, interact: false, clickX: null, clickY: null };
      if (wp < waypoints.length) {
        const dx = waypoints[wp][0] - player.x;
        const dy = waypoints[wp][1] - player.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 6) {
          input = { x: dx / dist, y: dy / dist, sneak: false, interact: false, clickX: null, clickY: null };
        } else {
          wp += 1;
        }
      }
      world.step(STEP, input, false);
      suspicion = world.state.suspicion;
      if (suspicion >= 45) break;
    }
    return { screen: SCREEN_PLAY, best: world.state.score };
  }

  if (name === 'escape') {
    // The whole third zone, played properly: takings, the keris, then the boat.
    world.loadZone(2);
    for (let index = 0; index < ESCAPE_SECONDS / STEP; index += 1) {
      world.step(STEP, autopilot(world), false);
      if (world.state.won) break;
    }
    return { screen: world.state.won ? SCREEN_WIN : SCREEN_PLAY, best: world.state.score };
  }

  // Play: a careful mid-heist in the stall lane — two takings, then hold near cover.
  for (let index = 0; index < PLAY_SECONDS / STEP; index += 1) {
    world.step(STEP, autopilot(world), false);
    if (world.state.lootTaken >= 2) break;
  }
  return { screen: world.state.over ? SCREEN_OVER : SCREEN_PLAY, best: world.state.score };
}
