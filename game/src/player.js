// The thief: movement, sneaking, and grabbing loot. No rules about guards or winning
// here — just where the player is and how they get around. Cover rectangles block the
// player (a circle sliding along them), and a click target walks them in a straight line.

import { FIELD, PLAYER } from './config.js';
import { pointInRects } from './guards.js';

export function createPlayer(start) {
  return {
    x: start[0],
    y: start[1],
    dir: -Math.PI / 2,
    sneaking: false,
    moving: false,
    targetX: null,
    targetY: null,
    stepPhase: 0,
  };
}

function collide(x, y, cover) {
  return pointInRects(x, y, cover);
}

/** Try to move the circle by (dx,dy), sliding along cover; returns true if it moved. */
function tryMove(player, dx, dy, cover) {
  const r = PLAYER.radius;
  const nx = player.x + dx;
  const ny = player.y + dy;
  if (!collide(nx, ny, cover)) {
    player.x = nx;
    player.y = ny;
    return true;
  }
  // Slide along one axis at a time, with the radius kept clear of the rectangle's edges.
  if (dx !== 0 && !collide(nx, player.y, cover)) {
    player.x = nx;
    return true;
  }
  if (dy !== 0 && !collide(player.x, ny, cover)) {
    player.y = ny;
    return true;
  }
  return false;
}

/**
 * One step. `input` is {x, y, sneak, clickX, clickY}: a -1..1 steering vector from the
 * keys, or a click target. Keys win over a click; a click is dropped once reached.
 * Returns the distance walked, for the footstep sounds.
 */
export function stepPlayer(player, input, dt, cover) {
  const beforeX = player.x;
  const beforeY = player.y;
  player.sneaking = input.sneak;
  let mx = input.x;
  let my = input.y;
  if (mx === 0 && my === 0 && input.clickX !== null && input.clickX !== undefined) {
    const dx = input.clickX - player.x;
    const dy = input.clickY - player.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 6) {
      player.targetX = null;
      player.targetY = null;
    } else {
      mx = dx / dist;
      my = dy / dist;
    }
  }
  const len = Math.hypot(mx, my);
  if (len > 0) {
    const speed = player.sneaking ? PLAYER.sneakSpeed : PLAYER.walkSpeed;
    const nx = (mx / len) * speed * dt;
    const ny = (my / len) * speed * dt;
    player.moving = tryMove(player, nx, ny, cover);
    if (player.moving) player.dir = Math.atan2(ny, nx);
  } else {
    player.moving = false;
  }
  player.x = Math.min(FIELD.width - PLAYER.radius, Math.max(PLAYER.radius, player.x));
  player.y = Math.min(FIELD.height - PLAYER.radius, Math.max(PLAYER.radius, player.y));
  const walked = Math.hypot(player.x - beforeX, player.y - beforeY);
  player.stepPhase += walked;
  return walked;
}

/** True when the player stands close enough to the loot to grab it with E. */
export function canGrab(player, loot) {
  return !loot.taken && Math.hypot(loot.x - player.x, loot.y - player.y) <= PLAYER.interactRange;
}

/** True when the player stands inside the exit rectangle. */
export function insideExit(player, exit) {
  return player.x >= exit.x && player.x <= exit.x + exit.w && player.y >= exit.y && player.y <= exit.y + exit.h;
}
