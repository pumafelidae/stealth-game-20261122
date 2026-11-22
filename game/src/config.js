// Every tuning number and colour in one place. The playfield is a fixed 1280x720 logical
// area; the renderer scales it to the window, so no rule below depends on the screen size.
// Theme: a lantern-lit Indonesian night market after closing — warm pools of lamplight are
// dangerous (guards see you well), dark awning shadows are safe to hide in.

export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

export const PLAYER = {
  radius: 11,
  walkSpeed: 175,
  sneakSpeed: 95,
  interactRange: 34,
};

export const GUARD = {
  radius: 12,
  patrolSpeed: 62,
  fastPatrolSpeed: 78,
  chaseSpeed: 152,
  coneRange: 195,
  coneHalfAngle: 0.62,
  catchRange: 23,
  hearRange: 72,
};

/** Suspicion 0..100. Rising it fills the eye meter; 100 trips the alarm. */
export const DETECT = {
  baseNear: 58,
  baseFar: 18,
  sneakFactor: 0.5,
  lightFactor: 1.45,
  shadowFactor: 0.5,
  hearRate: 26,
  decay: 22,
  shadowDecay: 46,
  alarmDecay: 30,
  alarmClearBelow: 25,
};

export const LIVES = 3;

export const LOOT = {
  coinPoints: 100,
  spicePoints: 100,
  kerisPoints: 300,
  lifeBonus: 250,
};

/** Seconds of play the time bonus counts down from; faster escapes score more. */
export const TIME_BONUS = { start: 1800, perSecond: 10 };

export const PALETTE = {
  backdrop: '#0d0a14',
  floor: '#241c2e',
  floorAlt: '#2b2138',
  plank: '#1d1626',
  stall: '#7a4a2b',
  stallRoof: '#b8452f',
  stallRoofAlt: '#c98a2e',
  crate: '#6e5233',
  crateEdge: '#8a6a42',
  lantern: '#ffb347',
  lanternGlow: 'rgba(255, 179, 71, 0.20)',
  shadow: '#120e1c',
  shadowEdge: '#3a2f52',
  exitClosed: '#5a5148',
  exitOpen: '#57d977',
  player: '#3ec6e0',
  playerCloak: '#1d5f73',
  guard: '#e5534b',
  guardHat: '#8f2f2a',
  coneCalm: 'rgba(255, 196, 66, 0.20)',
  coneSuspect: 'rgba(255, 214, 64, 0.34)',
  coneAlarm: 'rgba(229, 83, 75, 0.38)',
  lootCoin: '#f2c94c',
  lootSpice: '#e07b39',
  lootKeris: '#ffe27a',
  panel: '#1a1426',
  panelEdge: '#4a3566',
  text: '#f4ead8',
  muted: '#b3a3c7',
  danger: '#ff6b5e',
  safe: '#57d977',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'pasar-senja.best';
