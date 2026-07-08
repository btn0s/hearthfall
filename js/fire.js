// Fire spread and structure burn-down.
import { MAP_W, T, FLAMMABLE } from './data.js';
import { G, inMap, tileAt } from './state.js';
import { choice, chance } from './rng.js';
import { addLog } from './journal.js';

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

export function ignite(x, y) {
  if (!inMap(x, y)) return false;
  const tl = tileAt(x, y);
  if (tl.burning || !FLAMMABLE.has(tl.t)) return false;
  tl.burning = 90;
  return true;
}

export function fireTick() {
  if (G.min % 2) return;
  for (let i = 0; i < G.tiles.length; i++) {
    const tl = G.tiles[i];
    if (tl.fishCd > 0) tl.fishCd -= 2;
    if (!tl.burning) continue;
    tl.burning -= 2;
    if (tl.hp !== undefined) tl.hp -= 1;
    if (chance(0.02)) {
      const [dx, dy] = choice(DIRS);
      ignite((i % MAP_W) + dx, ((i / MAP_W) | 0) + dy);
    }
    if (tl.hp !== undefined) {
      if (tl.hp <= 0) {
        addLog(`Fire consumed a ${T[tl.t].name}.`, '#e08040');
        tl.t = 'dirt';
        delete tl.hp; delete tl.burning; delete tl.claim; delete tl.sleepers;
      } else if (tl.burning <= 0) delete tl.burning;
    } else if (tl.burning <= 0) {
      if (tl.t !== 'water') tl.t = 'dirt';
      delete tl.burning; delete tl.growth; delete tl.sleepers; delete tl.claim; delete tl.desig;
    }
  }
}
