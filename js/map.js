// Worldgen: value-noise elevation + moisture drive biomes (lakes, shores,
// meadows, woodland, deep forest, rocky highlands), plus a meandering river
// with regular fords. The camp is placed in a safe clearing.
import { rnd, rint, chance } from './rng.js';
import { MAP_W, MAP_H } from './data.js';

// 2-octave value noise sampled on a coarse random lattice
function makeNoise(cell) {
  const gw = Math.ceil(MAP_W / cell) + 2, gh = Math.ceil(MAP_H / cell) + 2;
  const g = Array.from({ length: gw * gh }, () => rnd());
  const sm = t => t * t * (3 - 2 * t);
  return (x, y) => {
    const fx = x / cell, fy = y / cell;
    const x0 = fx | 0, y0 = fy | 0;
    const tx = sm(fx - x0), ty = sm(fy - y0);
    const v = (xx, yy) => g[yy * gw + xx];
    const a = v(x0, y0) * (1 - tx) + v(x0 + 1, y0) * tx;
    const b = v(x0, y0 + 1) * (1 - tx) + v(x0 + 1, y0 + 1) * tx;
    return a * (1 - ty) + b * ty;
  };
}

export function genMap() {
  const tiles = new Array(MAP_W * MAP_H);
  const elevA = makeNoise(20), elevB = makeNoise(8);
  const moistA = makeNoise(15), moistB = makeNoise(6);
  const idx = (x, y) => y * MAP_W + x;
  const set = (x, y, t) => { if (x >= 0 && y >= 0 && x < MAP_W && y < MAP_H) tiles[idx(x, y)].t = t; };

  // sample both fields, then classify by per-map percentile so every seed
  // gets the same biome proportions (raw noise spread varies wildly per map)
  const E = new Float32Array(MAP_W * MAP_H);
  const M = new Float32Array(MAP_W * MAP_H);
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
    E[idx(x, y)] = elevA(x, y) * 0.68 + elevB(x, y) * 0.32;
    M[idx(x, y)] = moistA(x, y) * 0.68 + moistB(x, y) * 0.32;
  }
  const pct = (arr, p) => { const s = [...arr].sort((a, b) => a - b); return s[(s.length * p) | 0]; };
  const eWater = pct(E, 0.07), eShore = pct(E, 0.11), eRocky = pct(E, 0.94);
  const mForest = pct(M, 0.80), mWood = pct(M, 0.70);

  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      const e = E[idx(x, y)], m = M[idx(x, y)];
      let t;
      if (e < eWater) t = 'water';                                   // lakes
      else if (e < eShore) t = chance(0.7) ? 'dirt' : 'grass2';      // shores
      else if (e > eRocky) t = chance(0.5) ? 'rock' : (chance(0.4) ? 'dirt' : 'grass2'); // rocky highlands
      else if (m > mForest) t = chance(0.72) ? 'tree' : (chance(0.25) ? 'bush' : 'grass'); // deep forest
      else if (m > mWood) t = chance(0.16) ? 'tree' : (chance(0.1) ? 'bush' : (chance(0.5) ? 'grass' : 'grass2')); // woodland edge
      else t = chance(0.08) ? 'dirt' : (chance(0.5) ? 'grass' : 'grass2'); // meadows
      tiles[idx(x, y)] = { t };
    }
  }

  // meandering river, north to south, with a ford every ~14 rows
  const riverX = new Array(MAP_H);
  let rx = rint(Math.floor(MAP_W * 0.25), Math.floor(MAP_W * 0.75));
  let drift = 0;
  for (let y = 0; y < MAP_H; y++) {
    drift += (rnd() - 0.5) * 1.3;
    drift = Math.max(-1.7, Math.min(1.7, drift));
    rx = Math.max(4, Math.min(MAP_W - 5, rx + Math.round(drift)));
    riverX[y] = rx;
    const w = ((y * 13) % 9 < 3) ? 2 : 1;
    for (let dx = -1; dx <= w; dx++) set(rx + dx, y, 'water');
    if (y % 14 === 7) for (let dx = -2; dx <= w + 1; dx++) set(rx + dx, y, 'dirt'); // ford
  }

  // camp: a mid-map spot away from the river with little water/rock nearby
  let camp = null;
  for (let tries = 0; tries < 80 && !camp; tries++) {
    const cx = rint(Math.floor(MAP_W * 0.25), Math.floor(MAP_W * 0.75));
    const cy = rint(Math.floor(MAP_H * 0.25), Math.floor(MAP_H * 0.75));
    if (Math.abs(cx - riverX[cy]) < 12) continue;
    let bad = 0;
    for (let dy = -6; dy <= 6; dy++) for (let dx = -6; dx <= 6; dx++) {
      const x = cx + dx, y = cy + dy;
      if (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H) { bad += 5; continue; }
      if (tiles[idx(x, y)].t === 'water') bad++;
    }
    if (bad <= (tries < 40 ? 0 : 6)) camp = { x: cx, y: cy };
  }
  if (!camp) camp = { x: (MAP_W / 2) | 0, y: (MAP_H / 2) | 0 };

  // clear the meadow around camp (trees/rocks/bushes out; late-try water too)
  for (let dy = -7; dy <= 7; dy++) for (let dx = -7; dx <= 7; dx++) {
    const x = camp.x + dx, y = camp.y + dy;
    if (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H) continue;
    const t = tiles[idx(x, y)].t;
    if (t === 'tree' || t === 'rock' || t === 'bush' || (t === 'water' && Math.abs(dx) <= 5 && Math.abs(dy) <= 5)) {
      set(x, y, chance(0.6) ? 'grass' : 'grass2');
    }
  }
  // and guarantee a nearby working forest + rocks just outside the clearing
  for (let i = 0; i < 14; i++) {
    const a = rnd() * Math.PI * 2, d = 9 + rnd() * 5;
    const x = camp.x + Math.round(Math.cos(a) * d), y = camp.y + Math.round(Math.sin(a) * d);
    if (x > 0 && y > 0 && x < MAP_W - 1 && y < MAP_H - 1 && tiles[idx(x, y)].t.startsWith('grass')) {
      set(x, y, i < 10 ? 'tree' : 'rock');
    }
  }
  return { tiles, camp };
}
