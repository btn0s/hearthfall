// Pathfinding and grid distance.
import { MAP_W, MAP_H, T } from './data.js';
import { inMap, tileAt } from './state.js';

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
export { DIRS };
export const mdist = (ax, ay, bx, by) => Math.abs(ax - bx) + Math.abs(ay - by);

export function findPath(sx, sy, tx, ty, opts = {}) {
  const pass = (x, y) => {
    if (!inMap(x, y)) return false;
    const t = tileAt(x, y).t;
    if (opts.noDoor && t === 'door') return false;
    if (T[t].walk) return true;
    return !!opts.raider && (t === 'wall_w' || t === 'wall_s');
  };
  const goal = new Set();
  if (opts.adjacent) {
    for (const [dx, dy] of DIRS) { const x = tx + dx, y = ty + dy; if (pass(x, y)) goal.add(y * MAP_W + x); }
    if (!goal.size) return null;
  } else {
    if (!pass(tx, ty)) return null;
    goal.add(ty * MAP_W + tx);
  }
  const start = sy * MAP_W + sx;
  if (goal.has(start)) return [];
  const prev = new Int32Array(MAP_W * MAP_H).fill(-1);
  prev[start] = start;
  let q = [start];
  while (q.length) {
    const nq = [];
    for (const c of q) {
      const cx = c % MAP_W, cy = (c / MAP_W) | 0;
      for (const [dx, dy] of DIRS) {
        const x = cx + dx, y = cy + dy;
        if (!pass(x, y)) continue;
        const i = y * MAP_W + x;
        if (prev[i] !== -1) continue;
        prev[i] = c;
        if (goal.has(i)) {
          const path = [];
          let cur = i;
          while (cur !== start) { path.push({ x: cur % MAP_W, y: (cur / MAP_W) | 0 }); cur = prev[cur]; }
          path.reverse();
          return path;
        }
        nq.push(i);
      }
    }
    q = nq;
  }
  return null;
}
