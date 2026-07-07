// Overworld: quest locations and expeditions (travel out, resolve, travel home).
import { G, addLog, makeSettler, walkable, releaseTask, communeFallen, updatePeak } from './game.js';
import { rint, chance, choice, rnd } from './rng.js';
import { LOCTYPES, LOC_A, LOC_B } from './data.js';
import { hasPerk } from './meta.js';

export const WORLD_W = 50, WORLD_H = 26;

export function genWorld() {
  const grid = [];
  for (let y = 0; y < WORLD_H; y++) {
    const row = [];
    for (let x = 0; x < WORLD_W; x++) row.push('.');
    grid.push(row);
  }
  const blob = (cx, cy, r, ch) => {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const x = cx + dx, y = cy + dy;
      if (x < 0 || y < 0 || x >= WORLD_W || y >= WORLD_H) continue;
      if (dx * dx + dy * dy <= r * r && chance(0.75)) grid[y][x] = ch;
    }
  };
  for (let i = 0; i < 10; i++) blob(rint(0, WORLD_W - 1), rint(0, WORLD_H - 1), rint(2, 4), '♠');
  for (let i = 0; i < 5; i++) blob(rint(0, WORLD_W - 1), rint(0, WORLD_H - 1), rint(1, 3), '^');
  for (let i = 0; i < 4; i++) blob(rint(0, WORLD_W - 1), rint(0, WORLD_H - 1), rint(1, 3), '≈');
  const base = { x: rint(20, 30), y: rint(10, 16) };
  G.world = { grid, base, locs: [] };
  for (let i = 0; i < 8; i++) addLocation(true);
  if (hasPerk('maps')) {
    for (let i = 0; i < 2; i++) addLocation(true);
    const cache = addLocation(true, 'cache');
    if (cache) cache.diff = Math.min(cache.diff, 3);
  }
}

export function addLocation(quiet = false, forceType = null) {
  const w = G.world;
  for (let tries = 0; tries < 100; tries++) {
    const x = rint(1, WORLD_W - 2), y = rint(1, WORLD_H - 2);
    const d = Math.hypot(x - w.base.x, y - w.base.y);
    if (d < 5 || d > 24) continue;
    if (w.locs.some(l => Math.abs(l.x - x) <= 1 && Math.abs(l.y - y) <= 1)) continue;
    const type = forceType || choice(Object.keys(LOCTYPES));
    const lt = LOCTYPES[type];
    const diff = Math.round(lt.diff[0] + rnd() * (lt.diff[1] - lt.diff[0]) + d * 0.25 + G.day * 0.15);
    const travel = Math.round(d * 55 * G.mods.travel); // game-minutes each way
    let name = `${choice(LOC_A)} ${choice(LOC_B)}`;
    for (let i = 0; i < 20 && w.locs.some(l => l.name === name); i++) name = `${choice(LOC_A)} ${choice(LOC_B)}`;
    const loc = { type, x, y, diff, travel, name, cleared: false };
    w.locs.push(loc);
    if (!quiet) addLog(`Scouts marked a new site: ${lt.name} "${name}".`, '#9ab0c8');
    return loc;
  }
  return null;
}

export function partyPower(members) {
  const base = members.reduce((a, s) => a + 4 + s.hp * 0.25 + (s.role === 'guard' ? 3 : 0), 0);
  return (base + Math.min(G.res.weapons, members.length) * 3) * G.mods.expPower;
}

export function riskLabel(power, diff) {
  const danger = diff * 2.6;
  const ratio = power / danger;
  if (ratio > 1.3) return { label: 'Low', fg: '#8ad080' };
  if (ratio > 0.95) return { label: 'Moderate', fg: '#e0c060' };
  return { label: 'HIGH', fg: '#e05040' };
}

export function startExpedition(locIdx, ids) {
  const loc = G.world.locs[locIdx];
  const members = G.settlers.filter(s => ids.includes(s.id));
  if (!loc || loc.cleared || !members.length) return false;
  for (const s of members) { s.away = true; s.sleeping = false; releaseTask(s); }
  G.stats.expeditions++;
  G.expeditions.push({ locIdx, ids: [...ids], phase: 'out', t: loc.travel, total: loc.travel, loot: null });
  addLog(`⚑ ${members.map(s => s.name).join(', ')} set out for ${loc.name} (${((loc.travel * 2) / 1440).toFixed(1)}d round trip).`, '#9ac0d8');
  return true;
}

function resolveExpedition(e, loc) {
  const members = G.settlers.filter(s => e.ids.includes(s.id));
  const power = partyPower(members);
  const danger = loc.diff * 2.6 * (0.8 + rnd() * 0.4);
  const success = power >= danger;
  loc.cleared = true;
  const f = success ? 1 : 0.3;
  const roll = (a, b) => Math.round(rint(a, b) * f);
  const loot = {};
  if (loc.type === 'ruins') { loot.scrap = roll(3, 8); loot.wood = roll(0, 5); loot.coin = roll(2, 5); loot.weapons = success && chance(0.6) ? 1 : 0; }
  if (loc.type === 'farm') { loot.food = roll(8, 18); loot.wood = roll(2, 6); loot.herbs = roll(0, 3); }
  if (loc.type === 'cache') { loot.meds = roll(1, 3); loot.scrap = roll(2, 5); loot.food = roll(4, 8); loot.coin = roll(2, 4); }
  if (loc.type === 'bandits') { loot.scrap = roll(4, 10); loot.weapons = roll(1, 2); loot.food = roll(3, 8); loot.coin = roll(3, 8); }
  if (loc.type === 'survivors') { loot.food = roll(0, 3); }
  e.loot = loot;

  if (success) {
    G.stats.sites++;
    addLog(`⚑ The party cleared ${loc.name}!`, '#8ad080');
    for (const s of members) s.hp = Math.max(1, s.hp - rint(0, 4));
    if (loc.type === 'bandits') {
      G.raidNext = Math.max(G.raidNext, G.day + 5);
      G.banditsCleared++;
      addLog('With the bandit camp burned, raids will quiet for a while.', '#8ad080');
    }
    if (loc.type === 'survivors') {
      const s = makeSettler(G.camp.x, G.camp.y, 'worker');
      s.away = true;
      G.settlers.push(s);
      updatePeak();
      e.ids.push(s.id);
      addLog(`Rescued ${s.name} — they will join the commune!`, '#e8d8a0');
    }
  } else {
    addLog(`⚑ The party was overwhelmed at ${loc.name} and fell back.`, '#e08040');
    for (const s of members) {
      s.hp -= rint(5, 13);
      if (s.hp <= 0) {
        addLog(`☠ ${s.name} died at ${loc.name}.`, '#e05040');
        e.ids = e.ids.filter(i => i !== s.id);
        G.settlers = G.settlers.filter(x => x !== s);
      }
    }
    if (!G.settlers.length) { communeFallen(); return; }
  }
  if (e.ids.length) addLog('The survivors are heading home.', '#9ab0c8');
  else addLog('None survived to bring word home.', '#e05040');
}

function arriveHome(e, loc) {
  const members = G.settlers.filter(s => e.ids.includes(s.id));
  const spots = [];
  for (let r = 1; r < 8 && spots.length < members.length; r++) {
    for (let dy = -r; dy <= r && spots.length < members.length; dy++) {
      for (let dx = -r; dx <= r && spots.length < members.length; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        if (walkable(G.camp.x + dx, G.camp.y + dy)) spots.push({ x: G.camp.x + dx, y: G.camp.y + dy });
      }
    }
  }
  members.forEach((s, i) => {
    s.away = false;
    const p = spots[i % Math.max(1, spots.length)] || G.camp;
    s.x = p.x; s.y = p.y;
  });
  const gains = Object.entries(e.loot || {}).filter(([, v]) => v > 0);
  for (const [k, v] of gains) G.res[k] += v;
  addLog(`⚑ The party returned from ${loc.name}${gains.length ? ' with ' + gains.map(([k, v]) => `${v} ${k}`).join(', ') : ''}.`, '#8ad080');
  G.expeditions = G.expeditions.filter(x => x !== e);
}

export function tickWorld() {
  if (G.screen !== 'GAME' || G.gameOver) return;
  for (const e of [...G.expeditions]) {
    e.t--;
    if (e.t > 0) continue;
    const loc = G.world.locs[e.locIdx];
    if (e.phase === 'out') {
      resolveExpedition(e, loc);
      if (e.ids.length) { e.phase = 'back'; e.t = loc.travel; e.total = loc.travel; }
      else G.expeditions = G.expeditions.filter(x => x !== e);
    } else {
      arriveHome(e, loc);
    }
  }
}

export function worldDawn() {
  if (G.day % 3 === 0 && G.world.locs.filter(l => !l.cleared).length < 9) addLocation();
}
