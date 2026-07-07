import { G, tickGame, save } from './game.js';
import { tickWorld, worldDawn } from './world.js';
import { setupRender, render } from './render.js';
import { setupInput } from './ui.js';
import { pollGamepad, setupGamepad } from './gamepad.js';

const canvas = document.getElementById('game');
setupRender(canvas);
setupInput(canvas);
setupGamepad();

window.G = G; // debug/cheat console access
import('./game.js').then(m => { window.GAME = m; });
import('./world.js').then(m => { window.WORLD = m; });
import('./meta.js').then(m => { window.META_M = m; });
import('./gamepad.js').then(m => { window.GAMEPAD = m; });
window.ff = (mins) => { // debug: fast-forward n game-minutes
  for (let i = 0; i < mins && !G.gameOver; i++) {
    const ev = tickGame();
    tickWorld();
    if (ev && ev.dawn) { worldDawn(); save(); }
  }
};

let last = performance.now(), acc = 0;
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  pollGamepad();
  if (G.screen === 'GAME' && !G.paused && !G.help && !G.gameOver) {
    const tps = [0, 8, 22, 55][G.speed];
    acc += dt;
    const step = 1 / tps;
    let n = 0;
    while (acc >= step && n < 120) {
      acc -= step;
      const ev = tickGame();
      tickWorld();
      if (ev && ev.dawn) { worldDawn(); save(); } // autosave at each dawn
      n++;
    }
    if (n >= 120) acc = 0;
  } else {
    acc = 0;
  }
  render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// save when the tab is closed or hidden mid-run
window.addEventListener('visibilitychange', () => { if (document.hidden) save(); });
window.addEventListener('beforeunload', () => save());
