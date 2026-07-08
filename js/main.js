import { G, tickGame } from './game.js';
import { tickWorld } from './world.js';
import { onDawn } from './dawn.js';
import * as gfx from './gfx.js';
import { stack, push, replaceAll, inStack, setupInput, renderFrame } from './ui.js';
import { makeMenuScreen, makeGameOverModal } from './screens.js';
import { pollGamepad, setupGamepad } from './gamepad.js';

const canvas = document.getElementById('game');
gfx.setupCanvas(canvas);
setupInput(canvas);
setupGamepad();
replaceAll(makeMenuScreen());

function advanceMinute() {
  const ev = tickGame();
  tickWorld();
  if (ev && ev.dawn) onDawn();
  return ev;
}

// debug / test hooks
window.G = G;
window.ff = (mins) => { // fast-forward n game-minutes
  for (let i = 0; i < mins && !G.gameOver; i++) advanceMinute();
};
import('./game.js').then(m => { window.GAME = m; });
import('./world.js').then(m => { window.WORLD = m; });
import('./meta.js').then(m => { window.META_M = m; });
import('./gamepad.js').then(m => { window.GAMEPAD = m; });
import('./ui.js').then(m => { window.UI = m; });
import('./screens.js').then(m => { window.SCREENS = m; });

const simActive = () =>
  inStack('game') && !stack.some(s => s.pausesSim) && !G.gameOver && !G.paused;

let last = performance.now(), acc = 0, f = 0;
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  f++;
  pollGamepad();
  const topScreen = stack[stack.length - 1];
  if (topScreen && topScreen.update) topScreen.update();
  if (simActive()) {
    const tps = [0, 8, 22, 55][G.speed];
    acc += dt;
    const step = 1 / tps;
    let n = 0;
    while (acc >= step && n < 120) {
      acc -= step;
      advanceMinute();
      n++;
    }
    if (n >= 120) acc = 0;
  } else {
    acc = 0;
  }
  if (G.gameOver && inStack('game') && !inStack('gameover')) push(makeGameOverModal());
  renderFrame(f);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
