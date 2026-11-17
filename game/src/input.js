// Keyboard and pointer input. Held keys give movement and driving axes;
// one-shot presses (confirm, pause, enter car, shoot) are queued as flags
// and taken once by the loop, so a press between frames is never lost.
// Mouse drag orbits the camera; a click fires the player's weapon.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER_CAR = 4;
export const ACTION_SHOOT = 8;
export const ACTION_HORN = 16;

const FORWARD = new Set(['KeyW', 'ArrowUp']);
const BACK = new Set(['KeyS', 'ArrowDown']);
const LEFT = new Set(['KeyA', 'ArrowLeft']);
const RIGHT = new Set(['KeyD', 'ArrowRight']);
const SPRINT = new Set(['ShiftLeft', 'ShiftRight']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const ENTER_CAR = new Set(['KeyE', 'KeyF']);
const HORN = new Set(['KeyH']);

export function createInput(canvas) {
  const held = new Set();
  let actions = 0;
  let dragX = 0;
  let dragY = 0;
  let dragging = false;

  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    held.add(event.code);
    if (CONFIRM.has(event.code)) actions |= ACTION_CONFIRM;
    else if (PAUSE.has(event.code)) actions |= ACTION_PAUSE;
    else if (ENTER_CAR.has(event.code)) actions |= ACTION_ENTER_CAR;
    else if (HORN.has(event.code)) actions |= ACTION_HORN;
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    held.delete(event.code);
  });
  window.addEventListener('blur', () => {
    held.clear();
  });
  canvas.addEventListener('pointerdown', (event) => {
    dragging = true;
    dragX = event.clientX;
    dragY = event.clientY;
    actions |= ACTION_SHOOT;
  });
  window.addEventListener('pointermove', (event) => {
    if (!dragging) return;
    dragX = event.clientX;
    dragY = event.clientY;
  });
  window.addEventListener('pointerup', () => {
    dragging = false;
  });

  function hasAny(set) {
    for (const code of set) if (held.has(code)) return true;
    return false;
  }

  return {
    /** -1 back, +1 forward. */
    throttle() {
      return (hasAny(FORWARD) ? 1 : 0) - (hasAny(BACK) ? 1 : 0);
    },
    /** -1 left, +1 right. */
    steer() {
      return (hasAny(RIGHT) ? 1 : 0) - (hasAny(LEFT) ? 1 : 0);
    },
    sprint() {
      return hasAny(SPRINT);
    },
    /** Camera orbit deltas since the last call, in pixels. */
    takeDrag() {
      const dx = dragX;
      const dy = dragY;
      dragX = 0;
      dragY = 0;
      return { dx, dy, dragging };
    },
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
