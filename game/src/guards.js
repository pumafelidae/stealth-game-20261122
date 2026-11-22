// Guards: patrols, vision cones, and the "can this guard see the player" test. No drawing
// and no game state here — just geometry and one guard's behaviour, so the world can step
// every guard the same way and the renderer can ask for the same cone it draws.
//
// A guard walks a loop of waypoints. Its eyes are a cone: a range and a half-angle around
// the direction it faces. A player counts as seen only when inside the cone AND no cover
// rectangle blocks the straight line between guard and player.

import { GUARD } from './config.js';

/** True when the segment (x1,y1)-(x2,y2) touches the rectangle. Slab test, per axis. */
export function segmentHitsRect(x1, y1, x2, y2, rect) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  let tMin = 0;
  let tMax = 1;
  if (dx === 0) {
    if (x1 < rect.x || x1 > rect.x + rect.w) return false;
  } else {
    let t1 = (rect.x - x1) / dx;
    let t2 = (rect.x + rect.w - x1) / dx;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tMin = Math.max(tMin, t1);
    tMax = Math.min(tMax, t2);
    if (tMin > tMax) return false;
  }
  if (dy === 0) {
    if (y1 < rect.y || y1 > rect.y + rect.h) return false;
  } else {
    let t1 = (rect.y - y1) / dy;
    let t2 = (rect.y + rect.h - y1) / dy;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tMin = Math.max(tMin, t1);
    tMax = Math.min(tMax, t2);
    if (tMin > tMax) return false;
  }
  return true;
}

/** True when any cover rectangle blocks the line from (x1,y1) to (x2,y2). */
export function lineBlocked(x1, y1, x2, y2, cover) {
  for (let i = 0; i < cover.length; i += 1) {
    if (segmentHitsRect(x1, y1, x2, y2, cover[i])) return true;
  }
  return false;
}

/** True when the point is inside one of the rectangles. */
export function pointInRects(x, y, rects) {
  for (let i = 0; i < rects.length; i += 1) {
    const r = rects[i];
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return true;
  }
  return false;
}

/**
 * Can this guard see the player right now? Inside the cone, in range, and no cover in
 * the way. Returns the distance too, so the world can raise suspicion faster up close.
 */
export function guardSees(guard, px, py, cover) {
  const dx = px - guard.x;
  const dy = py - guard.y;
  const dist = Math.hypot(dx, dy);
  if (dist > GUARD.coneRange + 14) return { sees: false, dist };
  let angle = Math.atan2(dy, dx) - guard.dir;
  while (angle > Math.PI) angle -= Math.PI * 2;
  while (angle < -Math.PI) angle += Math.PI * 2;
  if (Math.abs(angle) > GUARD.coneHalfAngle && dist > 26) return { sees: false, dist };
  if (lineBlocked(guard.x, guard.y, px, py, cover)) return { sees: false, dist };
  return { sees: true, dist };
}

export function createGuard(def) {
  const start = def.waypoints[0];
  return {
    x: start[0],
    y: start[1],
    dir: def.dir ?? 0,
    waypoints: def.waypoints,
    wp: 1 % def.waypoints.length,
    speed: def.fast ? GUARD.fastPatrolSpeed : GUARD.patrolSpeed,
    mode: 'patrol',
    seesPlayer: false,
    seeDist: 0,
    chaseX: 0,
    chaseY: 0,
    returnWp: 0,
    stuckT: 0,
  };
}

/** Face the direction of travel; a patrolling guard looks where it walks. */
function faceToward(guard, tx, ty) {
  guard.dir = Math.atan2(ty - guard.y, tx - guard.x);
}

/** Walk toward (tx,ty) at `speed`, sliding along cover rects; returns the distance left. */
export function walkToward(guard, tx, ty, dt, speed, cover) {
  const dx = tx - guard.x;
  const dy = ty - guard.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 1) return 0;
  const step = Math.min(dist, speed * dt);
  const nx = guard.x + (dx / dist) * step;
  const ny = guard.y + (dy / dist) * step;
  // Slide: try the full step, then each axis alone, so guards hug walls instead of sticking.
  if (!pointInRects(nx, ny, cover)) {
    guard.x = nx;
    guard.y = ny;
  } else if (!pointInRects(nx, guard.y, cover)) {
    guard.x = nx;
  } else if (!pointInRects(guard.x, ny, cover)) {
    guard.y = ny;
  }
  faceToward(guard, tx, ty);
  return dist - step;
}

/**
 * One patrol step toward a target: true when the guard arrived, or when it made no
 * progress for over a second (a waypoint behind cover must never freeze a guard —
 * it turns around and walks the other way instead).
 */
function patrolStep(guard, target, dt, speed, cover) {
  const px = guard.x;
  const py = guard.y;
  const left = walkToward(guard, target[0], target[1], dt, speed, cover);
  const moved = Math.hypot(guard.x - px, guard.y - py);
  if (moved < 0.5) {
    guard.stuckT += dt;
  } else {
    guard.stuckT = 0;
  }
  return left < 2 || guard.stuckT > 1;
}
/**
 * One step of one guard. `alarm` and the player's position steer it: on patrol it walks
 * its loop; on alarm it converges on the player's position; when the alarm clears it walks
 * back to its loop.
 */
export function stepGuard(guard, dt, px, py, alarm, cover) {
  if (alarm) {
    guard.mode = 'chase';
    guard.chaseX = px;
    guard.chaseY = py;
    walkToward(guard, px, py, dt, GUARD.chaseSpeed, cover);
    return;
  }
  if (guard.mode === 'chase') {
    // The alarm cleared mid-chase: walk to the nearest waypoint, then resume the loop.
    guard.mode = 'return';
    let best = 0;
    let bestDist = Infinity;
    for (let i = 0; i < guard.waypoints.length; i += 1) {
      const d = Math.hypot(guard.waypoints[i][0] - guard.x, guard.waypoints[i][1] - guard.y);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    }
    guard.returnWp = best;
  }
  if (guard.mode === 'return') {
    const target = guard.waypoints[guard.returnWp];
    if (patrolStep(guard, target, dt, guard.speed, cover)) {
      guard.wp = (guard.returnWp + 1) % guard.waypoints.length;
      guard.mode = 'patrol';
      guard.stuckT = 0;
    }
    return;
  }
  const target = guard.waypoints[guard.wp];
  if (patrolStep(guard, target, dt, guard.speed, cover)) {
    guard.wp = (guard.wp + 1) % guard.waypoints.length;
    guard.stuckT = 0;
  }
}
