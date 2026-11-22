// Keyboard and pointer input. Held keys give a steering vector; one-shot presses (start
// or restart, pause, grab) are queued as bit flags and taken once by the loop, so a press
// between two frames is never lost and never counted twice. A click sets a walk target
// the thief follows until reached or a key is pressed.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_INTERACT = 4;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const SNEAK = new Set(['ShiftLeft', 'ShiftRight']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const INTERACT = new Set(['KeyE']);

export function createInput(target) {
  const held = { up: false, down: false, left: false, right: false, sneak: false };
  let actions = 0;
  let clickX = null;
  let clickY = null;

  window.addEventListener('keydown', (event) => {
    if (UP.has(event.code)) held.up = true;
    else if (DOWN.has(event.code)) held.down = true;
    else if (LEFT.has(event.code)) held.left = true;
    else if (RIGHT.has(event.code)) held.right = true;
    else if (SNEAK.has(event.code)) held.sneak = true;
    else if (CONFIRM.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else if (INTERACT.has(event.code)) {
      if (!event.repeat) actions |= ACTION_INTERACT;
    } else return;
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    if (UP.has(event.code)) held.up = false;
    else if (DOWN.has(event.code)) held.down = false;
    else if (LEFT.has(event.code)) held.left = false;
    else if (RIGHT.has(event.code)) held.right = false;
    else if (SNEAK.has(event.code)) held.sneak = false;
  });
  // A key released while the tab is hidden never sends keyup: let go of everything on blur.
  window.addEventListener('blur', () => {
    held.up = false;
    held.down = false;
    held.left = false;
    held.right = false;
    held.sneak = false;
  });
  target.addEventListener('pointerdown', (event) => {
    actions |= ACTION_CONFIRM;
    const rect = target.getBoundingClientRect();
    // The canvas fills the window and the field is centred in it: convert the click
    // back into playfield coordinates, using the same fit the renderer uses.
    const scale = Math.min(rect.width / 1280, rect.height / 720);
    const offsetX = (rect.width - 1280 * scale) / 2;
    const offsetY = (rect.height - 720 * scale) / 2;
    clickX = (event.clientX - rect.left - offsetX) / scale;
    clickY = (event.clientY - rect.top - offsetY) / scale;
  });

  return {
    /** The frame's steering: a -1..1 vector, sneak, one-shot grab, and click target. */
    frame() {
      const x = (held.right ? 1 : 0) - (held.left ? 1 : 0);
      const y = (held.down ? 1 : 0) - (held.up ? 1 : 0);
      const interact = Boolean(actions & ACTION_INTERACT);
      actions &= ~ACTION_INTERACT;
      return { x, y, sneak: held.sneak, interact, clickX, clickY };
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions &= ~ACTION_CONFIRM & ~ACTION_PAUSE;
      return taken;
    },
    /** Drop the click target (a key press, or the target reached). */
    clearClick() {
      clickX = null;
      clickY = null;
    },
  };
}
