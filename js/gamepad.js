// Controller support via the Gamepad API. Buttons are edge-detected (with
// key-repeat for held directions/confirm) and translated into the same
// virtual keys the keyboard uses, so every screen works identically.
//
// Mapping (standard layout):
//   d-pad / left stick  move cursor · navigate menus
//   A (0)               confirm / act at cursor (hold to drag-paint)
//   B (1)               back / cancel
//   X (2)               build menu
//   Y (3)               world map
//   LB/RB (4/5)         cycle tool: normal→build→chop→mine→forage→cancel
//   LT/RT (6/7)         game speed down / up
//   Back (8)            help · Start (9) pause
//   R3 (11)             toggle graphics mode
import { handleKey } from './ui.js';
import { notice } from './game.js';

const held = {}, nextT = {};

function fire(id, cond, key, now, repeat) {
  if (cond) {
    if (!held[id]) {
      held[id] = true;
      nextT[id] = now + 330;
      handleKey(key);
    } else if (repeat && now >= nextT[id]) {
      nextT[id] = now + 105;
      handleKey(key);
    }
  } else {
    held[id] = false;
  }
}

export function pollGamepad() {
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  let gp = null;
  for (const p of pads) if (p && p.connected) { gp = p; break; }
  if (!gp) return;
  const now = performance.now();
  const b = i => !!(gp.buttons && gp.buttons[i] && gp.buttons[i].pressed);
  const ax = gp.axes || [];
  const lx = ax[0] || 0, ly = ax[1] || 0;
  const rx = ax[2] || 0, ry = ax[3] || 0;

  // right stick pans the camera
  fire('panL', rx < -0.5, 'PAN_LEFT', now, true);
  fire('panR', rx > 0.5, 'PAN_RIGHT', now, true);
  fire('panU', ry < -0.5, 'PAN_UP', now, true);
  fire('panD', ry > 0.5, 'PAN_DOWN', now, true);

  fire('up', b(12) || ly < -0.5, 'ArrowUp', now, true);
  fire('down', b(13) || ly > 0.5, 'ArrowDown', now, true);
  fire('left', b(14) || lx < -0.5, 'ArrowLeft', now, true);
  fire('right', b(15) || lx > 0.5, 'ArrowRight', now, true);
  fire('a', b(0), 'Enter', now, true); // held A + stick = drag painting
  fire('b', b(1), 'Escape', now, false);
  fire('x', b(2), 'b', now, false);
  fire('y', b(3), 'w', now, false);
  fire('lb', b(4), '[', now, false);
  fire('rb', b(5), ']', now, false);
  fire('lt', b(6), '-', now, false);
  fire('rt', b(7), '=', now, false);
  fire('back', b(8), '?', now, false);
  fire('start', b(9), ' ', now, false);
  fire('r3', b(11), 'v', now, false);
}

export function setupGamepad() {
  window.addEventListener('gamepadconnected', (e) => {
    notice(`🎮 ${e.gamepad.id.slice(0, 24)} connected — A act · B back · X build · Y world`);
  });
}
