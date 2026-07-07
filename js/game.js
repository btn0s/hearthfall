// Core simulation: game state, time, pathfinding, settler AI, raider AI,
// combat, economy (cooking/crafting/foraging/trading), and run lifecycle.
import { rint, choice, chance } from './rng.js';
import { MAP_W, MAP_H, VIEW_W, VIEW_H, T, BUILDS, NAMES, ROLE_ORDER, CIVS, TRADE, OBJECTIVES, TIPS } from './data.js';
import { genMap } from './map.js';
import { hasPerk, endRun, addPoints } from './meta.js';

function makeState() {
  return {
    screen: 'MENU', civ: null,
    mods: { crop: 1, build: 1, guardDmg: 0, wallHp: 1, expPower: 1, travel: 1, deal: 0 },
    stats: { raids: 0, sites: 0, kills: 0, peak: 0, chopped: 0, farmsBuilt: 0, bedsBuilt: 0, wallsBuilt: 0, mealsCooked: 0, expeditions: 0 },
    objIdx: 0, objFlash: 0, intro: false, tip: null,
    day: 1, min: 380, speed: 1, paused: false, gameOver: false, help: false, legacyEarned: 0,
    tiles: null, camp: { x: 0, y: 0 },
    res: { food: 25, meals: 0, wood: 40, stone: 12, scrap: 2, herbs: 0, coin: 4, weapons: 1, meds: 1 },
    settlers: [], raiders: [], log: [], notice: null,
    mode: 'NORMAL', buildSel: null, cursor: { x: -1, y: -1 }, cam: { x: 0, y: 0 },
    raidNext: 3, raidActive: false, raidTimer: 0, banditsCleared: 0,
    world: null, expeditions: [], selLoc: 0, party: new Set(), partyOpen: false,
    craftQueue: [], trader: null,
    menuSel: 0, civSel: 0, perkSel: 0, tradeSel: 0, buildFocus: 0, partySel: 0,
    nextId: 1, usedNames: new Set(),
  };
}

export const G = makeState();

export const inMap = (x, y) => x >= 0 && y >= 0 && x < MAP_W && y < MAP_H;
export const tileAt = (x, y) => G.tiles[y * MAP_W + x];
export const walkable = (x, y) => inMap(x, y) && T[tileAt(x, y).t].walk;
export const timeStr = () => `${String(Math.floor(G.min / 60)).padStart(2, '0')}:${String(G.min % 60).padStart(2, '0')}`;
export const isNight = () => G.min < 320 || G.min >= 1200;
export const buildDef = (id) => BUILDS.find(b => b.id === id);
export const communeTier = () => G.settlers.length >= 9 ? 3 : G.settlers.length >= 6 ? 2 : 1;
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const mdist = (ax, ay, bx, by) => Math.abs(ax - bx) + Math.abs(ay - by);

export function addLog(text, fg = '#b8b2a0') {
  G.log.push({ text: `[D${G.day} ${timeStr()}] ${text}`, fg });
  if (G.log.length > 80) G.log.shift();
}
export function notice(text) {
  G.notice = { text, until: performance.now() + 1800 };
}
export function centerCam(x, y) {
  G.cam.x = Math.max(0, Math.min(MAP_W - VIEW_W, Math.round(x - VIEW_W / 2)));
  G.cam.y = Math.max(0, Math.min(MAP_H - VIEW_H, Math.round(y - VIEW_H / 2)));
}

export function updatePeak() {
  G.stats.peak = Math.max(G.stats.peak, G.settlers.length);
  if (G.settlers.length >= 6) tip('tier2');
}

// ---------------------------------------------------------------- onboarding
// One-time contextual tips; the seen-set persists so veterans are not nagged.
const TIP_KEY = 'hearthfall.tips';
let tipSeen = null;
function tipSeenSet() {
  if (!tipSeen) {
    try { tipSeen = new Set(JSON.parse(localStorage.getItem(TIP_KEY)) || []); }
    catch (e) { tipSeen = new Set(); }
  }
  return tipSeen;
}
export function tip(id) {
  const seen = tipSeenSet();
  if (seen.has(id) || !TIPS[id]) return;
  seen.add(id);
  try { localStorage.setItem(TIP_KEY, JSON.stringify([...seen])); } catch (e) { /* ignore */ }
  G.tip = { text: TIPS[id], until: performance.now() + 12000 };
}

export function dismissIntro() {
  if (!G.intro) return;
  G.intro = false;
  G.paused = false;
  tip('welcome');
}

// Advance the objective chain; award and log each completion.
export function checkObjectives() {
  let guard = 0;
  while (G.objIdx < OBJECTIVES.length && guard++ < 6) {
    const o = OBJECTIVES[G.objIdx];
    if (!o.check(G)) break;
    G.objIdx++;
    const bits = [];
    if (o.reward) for (const k in o.reward) { G.res[k] += o.reward[k]; bits.push(`+${o.reward[k]} ${k}`); }
    if (o.legacy) { addPoints(o.legacy); bits.push(`◆${o.legacy} legacy`); }
    addLog(`✔ ${o.text}${bits.length ? ' — ' + bits.join(', ') : ''}`, '#8ad080');
    G.objFlash = performance.now() + 4000;
  }
}

// ---------------------------------------------------------------- run lifecycle
const SAVE_KEY = 'hearthfall.save';

export function hasSave() {
  try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; }
}
export function clearSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ }
}
export function save() {
  if (G.screen !== 'GAME' || G.gameOver) return;
  const data = {
    ...G,
    party: [...G.party], usedNames: [...G.usedNames],
    buildSel: null, notice: null, help: false, partyOpen: false,
    mode: 'NORMAL', cursor: { x: -1, y: -1 }, tip: null,
  };
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch (e) { /* ignore */ }
}
export function loadGame() {
  try {
    const d = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (!d || !d.tiles) return false;
    if (d.tiles.length !== MAP_W * MAP_H) return false; // save from an older world size
    d.party = new Set(d.party || []);
    d.usedNames = new Set(d.usedNames || []);
    d.buildSel = null; d.notice = null; d.tip = null;
    d.stats = { ...makeState().stats, ...(d.stats || {}) }; // older saves lack new counters
    Object.assign(G, makeState(), d);
    G.screen = 'GAME';
    return true;
  } catch (e) { return false; }
}

export function communeFallen() {
  if (G.gameOver) return;
  G.gameOver = true;
  addLog('The commune has fallen.', '#e05040');
  G.legacyEarned = endRun(G.stats, G.day);
  clearSave(); // permadeath: the run is over
}

// ---------------------------------------------------------------- pathfinding
export function findPath(sx, sy, tx, ty, opts = {}) {
  const pass = (x, y) => {
    if (!inMap(x, y)) return false;
    const t = tileAt(x, y).t;
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

// ---------------------------------------------------------------- settlers
export function makeSettler(x, y, role) {
  const avail = NAMES.filter(n => !G.usedNames.has(n));
  const name = avail.length ? choice(avail) : choice(NAMES) + ' II';
  G.usedNames.add(name);
  return {
    id: G.nextId++, name, x, y, role,
    hp: 20, maxHp: 20, hunger: rint(15, 35), energy: rint(60, 95),
    sleeping: false, away: false, starving: false,
    task: null, path: null, pathGoal: null, pathAge: 0, atkcd: 0, bedIdx: -1, failCd: 0,
  };
}

export function weaponBonus(s) {
  const guards = G.settlers.filter(x => x.role === 'guard');
  const i = guards.indexOf(s);
  return i >= 0 && i < G.res.weapons ? 2 : 0;
}

export function releaseTask(s) {
  if (s.task) {
    const tl = tileAt(s.task.x, s.task.y);
    if (tl.claim === s.id) delete tl.claim;
    if (s.task.kind === 'craft' && s.task.item) G.craftQueue.unshift(s.task.item);
  }
  s.task = null; s.path = null; s.pathGoal = null;
}

function clearBed(s) {
  if (s.bedIdx >= 0) {
    const tl = G.tiles[s.bedIdx];
    if (tl.sleeper === s.id) delete tl.sleeper;
    s.bedIdx = -1;
  }
}

function moveToward(s, tx, ty, opts = {}) {
  const key = tx + ',' + ty + ',' + (opts.adjacent ? 1 : 0);
  s.pathAge++;
  if (!s.path || s.pathGoal !== key || (opts.refresh && s.pathAge > opts.refresh)) {
    s.path = findPath(s.x, s.y, tx, ty, opts);
    s.pathGoal = key; s.pathAge = 0;
    if (!s.path) { s.failCd = 20; s.pathGoal = null; return false; }
  }
  const n = s.path[0];
  if (!n) return true;
  if (!walkable(n.x, n.y)) { s.path = null; s.pathGoal = null; return false; }
  s.x = n.x; s.y = n.y; s.path.shift();
  return true;
}

const adjacentRaider = (s) => G.raiders.find(r => mdist(r.x, r.y, s.x, s.y) === 1);
const nearestRaider = (s) => G.raiders.reduce((b, r) => (!b || mdist(r.x, r.y, s.x, s.y) < mdist(b.x, b.y, s.x, s.y)) ? r : b, null);
const nearestLiveSettler = (r) => G.settlers.filter(s => !s.away && s.hp > 0)
  .reduce((b, s) => (!b || mdist(s.x, s.y, r.x, r.y) < mdist(b.x, b.y, r.x, r.y)) ? s : b, null);

// Watch-post positions, rebuilt at most once per game-minute (the raid loop
// asks for these every tick per guard — a full tile scan there is too hot).
const postCache = { stamp: -1, list: [] };
function nearestPost(s) {
  const stamp = G.day * 1440 + G.min;
  if (postCache.stamp !== stamp) {
    postCache.stamp = stamp;
    postCache.list = [];
    for (let i = 0; i < G.tiles.length; i++) {
      if (G.tiles[i].t === 'post') postCache.list.push({ x: i % MAP_W, y: (i / MAP_W) | 0 });
    }
  }
  let best = null, bd = Infinity;
  for (const p of postCache.list) {
    const d = mdist(s.x, s.y, p.x, p.y);
    if (d < bd) { bd = d; best = p; }
  }
  return best;
}

function claimBed(s) {
  if (s.bedIdx >= 0) {
    const tl = G.tiles[s.bedIdx];
    if (tl.t === 'bed' && tl.sleeper === s.id) return { x: s.bedIdx % MAP_W, y: (s.bedIdx / MAP_W) | 0 };
    s.bedIdx = -1;
  }
  let best = -1, bd = Infinity;
  for (let i = 0; i < G.tiles.length; i++) {
    const tl = G.tiles[i];
    if (tl.t !== 'bed' || tl.sleeper) continue;
    const d = mdist(s.x, s.y, i % MAP_W, (i / MAP_W) | 0);
    if (d < bd) { bd = d; best = i; }
  }
  if (best < 0) return null;
  G.tiles[best].sleeper = s.id;
  s.bedIdx = best;
  return { x: best % MAP_W, y: (best / MAP_W) | 0 };
}

// job priorities per role: lower runs first
const PRI = {
  farmer: { harvest: 0, cook: 1, buildFarm: 1, forage: 2, chop: 3, build: 3, mine: 4, craft: 5 },
  worker: { build: 0, buildFarm: 0, craft: 1, chop: 1, forage: 2, mine: 2, cook: 3, harvest: 3 },
};

function findJob(s) {
  if (s.role === 'guard') return null;
  const pri = PRI[s.role] || PRI.worker;
  const pop = G.settlers.length;
  let best = null, bestKey = Infinity;
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
    const tl = tileAt(x, y);
    if (tl.claim) continue;
    let kind = null, work = 0, onTile = false, p = 9;
    if (tl.build) {
      kind = 'build'; work = Math.ceil(buildDef(tl.build.id).work / G.mods.build);
      p = tl.build.id === 'farm' ? pri.buildFarm : pri.build;
    } else if (tl.desig === 'chop') { kind = 'chop'; work = 18; p = pri.chop; }
    else if (tl.desig === 'mine') { kind = 'mine'; work = 26; p = pri.mine; }
    else if (tl.desig === 'forage') { kind = 'forage'; work = 10; p = pri.forage; }
    else if (tl.t === 'farm' && (tl.growth || 0) >= 100) { kind = 'harvest'; work = 8; onTile = true; p = pri.harvest; }
    else if (tl.t === 'kitchen' && G.res.food >= 4 && G.res.meals < pop * 2) { kind = 'cook'; work = 10; p = pri.cook; }
    else if (tl.t === 'workshop' && G.craftQueue.length) { kind = 'craft'; work = 12; p = pri.craft; }
    if (kind === null) continue;
    const key = p * 10000 + mdist(s.x, s.y, x, y);
    if (key < bestKey) { bestKey = key; best = { kind, x, y, work, onTile }; }
  }
  if (best) {
    tileAt(best.x, best.y).claim = s.id;
    if (best.kind === 'craft') best.item = G.craftQueue.shift();
  }
  return best;
}

function taskValid(t) {
  const tl = tileAt(t.x, t.y);
  switch (t.kind) {
    case 'build': return !!tl.build;
    case 'chop': return tl.desig === 'chop' && tl.t === 'tree';
    case 'mine': return tl.desig === 'mine' && tl.t === 'rock';
    case 'forage': return tl.desig === 'forage' && tl.t === 'bush';
    case 'harvest': return tl.t === 'farm' && (tl.growth || 0) >= 100;
    case 'cook': return tl.t === 'kitchen' && G.res.food >= 2;
    case 'craft': return tl.t === 'workshop' && !!t.item;
  }
  return false;
}

function nudgeOff(x, y) {
  for (const e of [...G.settlers, ...G.raiders]) {
    if (e.away || e.x !== x || e.y !== y) continue;
    for (const [dx, dy] of DIRS) {
      if (walkable(x + dx, y + dy)) { e.x = x + dx; e.y = y + dy; break; }
    }
  }
}

function completeTask(s, t) {
  const tl = tileAt(t.x, t.y);
  delete tl.claim;
  if (t.kind === 'chop') { tl.t = 'dirt'; delete tl.desig; G.res.wood += rint(2, 4); G.stats.chopped++; }
  else if (t.kind === 'mine') { tl.t = 'dirt'; delete tl.desig; G.res.stone += rint(2, 3); }
  else if (t.kind === 'forage') { tl.t = 'grass'; delete tl.desig; G.res.herbs += 2; }
  else if (t.kind === 'harvest') { tl.growth = 0; G.res.food += rint(3, 5); }
  else if (t.kind === 'cook') {
    if (G.res.food >= 2) { G.res.food -= 2; G.res.meals += 3; G.stats.mealsCooked += 3; }
  }
  else if (t.kind === 'craft') {
    if (t.item === 'c_spear') { G.res.weapons++; addLog(`${s.name} forged a spear at the workshop.`, '#9ac0d8'); }
    if (t.item === 'c_meds') { G.res.meds++; addLog(`${s.name} brewed a medkit.`, '#68c088'); }
  }
  else if (t.kind === 'build') {
    const def = buildDef(tl.build.id);
    delete tl.build;
    tl.t = def.id;
    if (def.hp) {
      tl.hp = (def.id === 'wall_w' || def.id === 'wall_s') ? Math.round(def.hp * G.mods.wallHp) : def.hp;
    }
    if (def.id === 'farm') { tl.growth = 0; G.stats.farmsBuilt++; }
    if (def.id === 'bed') G.stats.bedsBuilt++;
    if (def.id === 'wall_w' || def.id === 'wall_s' || def.id === 'door') G.stats.wallsBuilt++;
    if (!T[def.id].walk) nudgeOff(t.x, t.y);
  }
  s.task = null; s.path = null; s.pathGoal = null;
}

function execTask(s) {
  const t = s.task;
  if (!taskValid(t)) { releaseTask(s); return; }
  const on = t.onTile ? (s.x === t.x && s.y === t.y) : mdist(s.x, s.y, t.x, t.y) === 1;
  if (!on) {
    moveToward(s, t.x, t.y, { adjacent: !t.onTile });
    if (s.failCd > 0) releaseTask(s);
    return;
  }
  t.work--;
  if (t.work <= 0) completeTask(s, t);
}

function stepRandom(s) {
  const [dx, dy] = choice(DIRS);
  if (walkable(s.x + dx, s.y + dy)) { s.x += dx; s.y += dy; }
}

function idle(s) {
  if (mdist(s.x, s.y, G.camp.x, G.camp.y) <= 3) s.hp = Math.min(s.maxHp, s.hp + 0.03);
  if (s.role === 'guard') {
    const post = nearestPost(s);
    const anchor = post || G.camp;
    if (mdist(s.x, s.y, anchor.x, anchor.y) > 3) moveToward(s, anchor.x, anchor.y, { adjacent: true });
    else if (chance(0.12)) stepRandom(s);
    return;
  }
  if (mdist(s.x, s.y, G.camp.x, G.camp.y) > 5) moveToward(s, G.camp.x, G.camp.y, { adjacent: true });
  else if (chance(0.2)) stepRandom(s);
}

function hitRaider(r, dmg, s) {
  r.hp -= dmg;
  if (r.hp <= 0) {
    G.raiders = G.raiders.filter(x => x !== r);
    G.stats.kills++;
    addLog(`${s.name} slew a raider!`, '#8ad080');
  }
}

function killSettler(s, how) {
  addLog(`☠ ${s.name} ${how}.`, '#e05040');
  releaseTask(s); clearBed(s);
  G.settlers = G.settlers.filter(x => x !== s);
  if (!G.settlers.length) communeFallen();
}

function updateSettler(s) {
  if (s.away) return;
  if (s.failCd > 0) s.failCd--;
  s.hunger = Math.min(100, s.hunger + 0.075);
  if (!s.sleeping) s.energy = Math.max(0, s.energy - 0.06);
  if (s.hunger >= 100) {
    s.hp -= 0.06;
    if (!s.starving) { s.starving = true; addLog(`${s.name} is starving!`, '#e06040'); tip('starving'); }
  } else s.starving = false;
  if (s.hp <= 0) return killSettler(s, 'starved');
  if (s.hp < 9 && G.res.meds > 0) {
    G.res.meds--; s.hp = Math.min(s.maxHp, s.hp + 12);
    addLog(`${s.name} used a medkit.`, '#68c088');
  }
  if (s.hunger > 72) {
    if (G.res.meals >= 1) { G.res.meals--; s.hunger = Math.max(0, s.hunger - 65); }
    else if (G.res.food >= 1) { G.res.food--; s.hunger = Math.max(0, s.hunger - 46); }
  }

  if (s.sleeping) {
    const inBed = tileAt(s.x, s.y).t === 'bed';
    s.energy = Math.min(100, s.energy + (inBed ? 0.3 : 0.15));
    s.hp = Math.min(s.maxHp, s.hp + (inBed ? 0.05 : 0.015));
    const wake = s.energy >= 99 || (!isNight() && s.energy > 70) || G.raidActive || adjacentRaider(s);
    if (wake) { s.sleeping = false; clearBed(s); }
    else return;
  }

  const foe = adjacentRaider(s);
  if (foe) {
    if (s.atkcd > 0) s.atkcd--;
    else {
      s.atkcd = 1;
      hitRaider(foe, rint(1, 3) + (s.role === 'guard' ? rint(1, 2) + G.mods.guardDmg : 0) + weaponBonus(s), s);
    }
    return;
  }

  if (G.raidActive) {
    if (s.role === 'guard') {
      // guards garrisoned near a watch post loose arrows instead of chasing
      const post = nearestPost(s);
      if (post && Math.max(Math.abs(s.x - post.x), Math.abs(s.y - post.y)) <= 2) {
        const r = nearestRaider(s);
        if (r && mdist(r.x, r.y, s.x, s.y) <= 6) {
          if (s.atkcd > 0) s.atkcd--;
          else { s.atkcd = 2; hitRaider(r, rint(1, 3) + 1, s); }
          return;
        }
      }
      const r = nearestRaider(s);
      if (r) { moveToward(s, r.x, r.y, { adjacent: true, refresh: 5 }); return; }
    } else {
      releaseTask(s);
      if (mdist(s.x, s.y, G.camp.x, G.camp.y) > 3) moveToward(s, G.camp.x, G.camp.y, { adjacent: true, refresh: 10 });
      return;
    }
  }

  if (s.energy < 25 || (isNight() && s.energy < 70)) {
    const bed = claimBed(s);
    if (bed) {
      if (s.x === bed.x && s.y === bed.y) { s.sleeping = true; releaseTask(s); return; }
      moveToward(s, bed.x, bed.y, {});
      return;
    }
    if (s.energy < 12) { s.sleeping = true; releaseTask(s); return; }
  }

  if (s.task) return execTask(s);
  if (s.failCd === 0) {
    const job = findJob(s);
    if (job) { s.task = job; return execTask(s); }
    s.failCd = 3 + (s.id % 4); // nothing to do: don't rescan the whole map every tick
  }
  idle(s);
}

// ---------------------------------------------------------------- raiders
function stepRaider(r) {
  const n = r.path && r.path[0];
  if (!n) { r.path = null; return; }
  const tl = tileAt(n.x, n.y);
  const bashable = tl.hp !== undefined && (tl.t === 'wall_w' || tl.t === 'wall_s' || tl.t === 'door');
  if (!T[tl.t].walk || tl.t === 'door') {
    if (bashable) {
      tl.hp -= rint(3, 6);
      if (tl.hp <= 0) {
        const name = T[tl.t].name;
        tl.t = 'dirt'; delete tl.hp;
        addLog(`Raiders smashed a ${name}!`, '#e08040');
      }
    } else r.path = null;
    return;
  }
  r.x = n.x; r.y = n.y; r.path.shift();
  if (tl.t === 'trap') {
    r.hp -= 9;
    addLog('A raider stumbled into a spike trap!', '#e0b050');
    if (chance(0.5)) { tl.t = 'dirt'; delete tl.hp; }
    if (r.hp <= 0) {
      G.raiders = G.raiders.filter(x => x !== r);
      G.stats.kills++;
      addLog('...and died on the spikes.', '#8ad080');
    }
  }
}

function updateRaider(r) {
  const foe = G.settlers.find(s => !s.away && mdist(s.x, s.y, r.x, r.y) === 1);
  if (foe && !r.fleeing) {
    if (r.atkcd > 0) r.atkcd--;
    else {
      r.atkcd = 1;
      foe.hp -= rint(2, 4);
      if (foe.sleeping) { foe.sleeping = false; clearBed(foe); }
      if (foe.hp <= 0) killSettler(foe, 'was slain by raiders');
    }
    return;
  }
  r.moveCd = (r.moveCd || 0) - 1;
  if (r.moveCd > 0) return;
  r.moveCd = 2;

  if (r.fleeing) {
    if (r.x <= 0 || r.x >= MAP_W - 1 || r.y <= 0 || r.y >= MAP_H - 1) {
      G.raiders = G.raiders.filter(x => x !== r);
      return;
    }
    if (!r.path || !r.path.length) {
      const ex = r.x < MAP_W / 2 ? 0 : MAP_W - 1;
      r.path = findPath(r.x, r.y, ex, r.y, { raider: true });
      r.fleeT = (r.fleeT || 0) + 1;
      if (!r.path && r.fleeT > 30) { G.raiders = G.raiders.filter(x => x !== r); return; }
      if (!r.path) return;
    }
    stepRaider(r);
    return;
  }

  r.pathAge = (r.pathAge || 0) + 1;
  if (!r.path || !r.path.length || r.pathAge > 14) {
    const tgt = nearestLiveSettler(r);
    if (!tgt) { r.fleeing = true; return; }
    r.path = findPath(r.x, r.y, tgt.x, tgt.y, { raider: true, adjacent: true });
    r.pathAge = 0;
    if (!r.path) { r.fleeing = true; return; }
  }
  stepRaider(r);
}

function spawnRaid() {
  let n = 2 + Math.floor((G.day - 2) / 3) + rint(0, 1) - Math.floor(G.banditsCleared / 2);
  n = Math.max(2, Math.min(10, n));
  const side = rint(0, 3);
  const spots = [];
  for (let i = 0; i < 300 && spots.length < n; i++) {
    let x, y;
    if (side === 0) { x = rint(1, MAP_W - 2); y = 0; }
    else if (side === 1) { x = rint(1, MAP_W - 2); y = MAP_H - 1; }
    else if (side === 2) { x = 0; y = rint(1, MAP_H - 2); }
    else { x = MAP_W - 1; y = rint(1, MAP_H - 2); }
    if (walkable(x, y)) spots.push({ x, y });
  }
  if (!spots.length) { G.raidNext = G.day + 1; return; }
  for (const p of spots) {
    G.raiders.push({ id: G.nextId++, x: p.x, y: p.y, hp: rint(9, 13) + Math.floor(G.day / 3), atkcd: 0 });
  }
  G.raidActive = true; G.raidTimer = 420;
  if (G.trader) { G.trader = null; if (G.mode === 'TRADE') G.mode = 'NORMAL'; addLog('The trader fled at the first war-horn.', '#e0c060'); }
  const sides = ['north', 'south', 'west', 'east'];
  addLog(`⚠ RAID! ${G.raiders.length} raiders attack from the ${sides[side]}!`, '#ff5040');
  tip('raid');
}

// ---------------------------------------------------------------- trader
export function adjustedOffer(i) {
  const o = TRADE[i];
  const d = G.mods.deal;
  const give = { ...o.give }, get = { ...o.get };
  if (d) {
    if (get.coin) get.coin = Math.ceil(get.coin * (1 + d));
    if (give.coin) give.coin = Math.max(1, Math.floor(give.coin * (1 - d)));
  }
  return { give, get };
}

export function doTrade(i) {
  if (!G.trader) return;
  const { give, get } = adjustedOffer(i);
  if (!pay(give)) { notice('You cannot afford that'); return; }
  for (const k in get) G.res[k] += get[k];
  const fmt = (o) => Object.entries(o).map(([k, v]) => `${v} ${k}`).join(', ');
  notice(`Traded ${fmt(give)} for ${fmt(get)}`);
}

function traderTick() {
  if (!G.trader && G.min === 540 && G.day >= 3 && G.day % 4 === 2 && !G.raidActive) {
    const spots = openAround(G.camp.x, G.camp.y, 3);
    if (spots.length) {
      G.trader = { x: spots[spots.length - 1].x, y: spots[spots.length - 1].y };
      addLog('¤ A trader caravan set up by the fire. Press e to trade.', '#ffd860');
      tip('trader');
    }
  }
  if (G.trader && G.min === 1140) {
    G.trader = null;
    if (G.mode === 'TRADE') G.mode = 'NORMAL';
    addLog('The trader packed up and moved on.', '#b8b2a0');
  }
}

// ---------------------------------------------------------------- daily events
function edgeWalkable() {
  for (let i = 0; i < 200; i++) {
    const side = rint(0, 3);
    let x, y;
    if (side === 0) { x = rint(1, MAP_W - 2); y = 0; }
    else if (side === 1) { x = rint(1, MAP_W - 2); y = MAP_H - 1; }
    else if (side === 2) { x = 0; y = rint(1, MAP_H - 2); }
    else { x = MAP_W - 1; y = rint(1, MAP_H - 2); }
    if (walkable(x, y)) return { x, y };
  }
  return null;
}

function dawnEvents() {
  addLog(`— Day ${G.day} —`, '#7a8a9a');
  const pop = G.settlers.length;
  if (G.day > 2 && pop < 14 && G.res.food + G.res.meals > pop * 3 && chance(0.35)) {
    const spot = edgeWalkable();
    if (spot) {
      const s = makeSettler(spot.x, spot.y, 'worker');
      G.settlers.push(s);
      updatePeak();
      addLog(`☺ ${s.name}, a wanderer, has joined the commune!`, '#e8d8a0');
      if (G.settlers.length === 6) addLog('◆ Commune tier II reached — watch posts, workshop, kitchen unlocked!', '#c8a0e8');
      if (G.settlers.length === 9) addLog('◆ Commune tier III reached — stone walls unlocked!', '#c8a0e8');
    }
  }
  if (G.day >= G.raidNext) { addLog('⚠ Scouts report raiders nearby — they strike at dusk!', '#e0a040'); tip('raidwarn'); }
  else if (G.day === G.raidNext - 1) addLog('Rumors of raiders gathering. Prepare defenses.', '#e0c060');
  if (G.res.food + G.res.meals < pop * 2) tip('foodlow');
}

// ---------------------------------------------------------------- tick
export function tickGame() {
  if (G.gameOver || G.screen !== 'GAME') return null;
  G.min++;
  let dawn = false;
  if (G.min >= 1440) { G.min = 0; G.day++; }
  if (G.min === 360) { dawn = true; dawnEvents(); }
  if (G.min === 1150 && G.day >= G.raidNext && !G.raidActive) spawnRaid();
  if (G.day === 1 && G.min === 1200) tip('night');
  if (G.min % 15 === 0) checkObjectives();
  traderTick();

  if (!isNight() && G.min % 3 === 0) {
    const rate = 0.23 * G.mods.crop;
    for (const tl of G.tiles) {
      if (tl.t === 'farm' && (tl.growth || 0) < 100) tl.growth = (tl.growth || 0) + rate;
    }
  }

  for (const s of [...G.settlers]) updateSettler(s);
  for (const r of [...G.raiders]) updateRaider(r);

  if (G.raidActive) {
    G.raidTimer--;
    if (G.raidTimer <= 0) for (const r of G.raiders) r.fleeing = true;
    if (!G.raiders.length) {
      G.raidActive = false;
      G.raidNext = G.day + rint(2, 4);
      G.stats.raids++;
      addLog('The raid is over. The commune holds.', '#8ad080');
    }
  }
  return { dawn };
}

// ---------------------------------------------------------------- player actions
export function canPay(cost) { return Object.entries(cost).every(([k, v]) => G.res[k] >= v); }
export function pay(cost) {
  if (!canPay(cost)) return false;
  for (const k in cost) G.res[k] -= cost[k];
  return true;
}
export function refund(cost) { for (const k in cost) G.res[k] += cost[k]; }

export function tryPlaceBuild(x, y) {
  const def = G.buildSel;
  if (!def || def.craft || !inMap(x, y)) return;
  if (def.tier && def.tier > communeTier()) { notice(`Locked — commune tier ${def.tier} needed (${def.tier === 2 ? 6 : 9} settlers)`); return; }
  const tl = tileAt(x, y);
  if (tl.build) return;
  if (!['grass', 'grass2', 'dirt', 'floor'].includes(tl.t)) return;
  if (def.id === 'farm' && tl.t === 'floor') return;
  if (!pay(def.cost)) { notice('Not enough resources'); return; }
  tl.build = { id: def.id };
}

export function designate(x, y, kind) {
  if (!inMap(x, y)) return;
  const tl = tileAt(x, y);
  if (kind === 'chop' && tl.t === 'tree') tl.desig = 'chop';
  if (kind === 'mine' && tl.t === 'rock') tl.desig = 'mine';
  if (kind === 'forage' && tl.t === 'bush') tl.desig = 'forage';
}

export function cancelAt(x, y) {
  if (!inMap(x, y)) return;
  const tl = tileAt(x, y);
  if (tl.build) { refund(buildDef(tl.build.id).cost); delete tl.build; delete tl.claim; return; }
  if (tl.desig) { delete tl.desig; delete tl.claim; return; }
  if (['wall_w', 'wall_s', 'door', 'floor', 'farm', 'bed', 'campfire', 'post', 'trap', 'workshop', 'kitchen'].includes(tl.t)) {
    tl.t = 'dirt';
    delete tl.hp; delete tl.growth; delete tl.sleeper; delete tl.claim;
  }
}

export function queueCraft(def) {
  const hasWorkshop = G.tiles.some(tl => tl.t === 'workshop');
  if (!hasWorkshop) { notice('Build a workshop first (tier II)'); return; }
  if (!pay(def.cost)) { notice('Not enough resources'); return; }
  G.craftQueue.push(def.id);
  notice(`${def.name} queued at the workshop`);
}

export function cycleRole(s) {
  s.role = ROLE_ORDER[(ROLE_ORDER.indexOf(s.role) + 1) % ROLE_ORDER.length];
  releaseTask(s);
  notice(`${s.name} is now a ${s.role}`);
}

// ---------------------------------------------------------------- new game
function openAround(cx, cy, n) {
  const out = [];
  for (let r = 1; r <= 6 && out.length < n; r++) {
    for (let dy = -r; dy <= r && out.length < n; dy++) for (let dx = -r; dx <= r && out.length < n; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      if (walkable(cx + dx, cy + dy)) out.push({ x: cx + dx, y: cy + dy });
    }
  }
  return out;
}

export function newGame(civId) {
  Object.assign(G, makeState());
  const civ = CIVS.find(c => c.id === civId) || CIVS[0];
  G.civ = civ.id;
  Object.assign(G.mods, civ.mods);
  if (hasPerk('greenthumb')) G.mods.crop *= 1.1;
  if (hasPerk('timber')) G.mods.wallHp *= 1.2;
  if (hasPerk('friends')) G.mods.deal = 0.2;

  const { tiles, camp } = genMap();
  G.tiles = tiles; G.camp = camp;
  centerCam(camp.x, camp.y);
  const set = (dx, dy, t, extra = {}) => Object.assign(tileAt(camp.x + dx, camp.y + dy), { t, ...extra });
  set(0, 0, 'campfire');
  set(-2, -1, 'bed'); set(-2, 0, 'bed'); set(-2, 1, 'bed'); set(-2, 2, 'bed');
  for (let dy = 0; dy <= 1; dy++) for (let dx = 2; dx <= 4; dx++) set(dx, dy, 'farm', { growth: rint(20, 80) });

  for (const k of ['food', 'wood', 'stone', 'scrap', 'coin', 'weapons', 'meds']) {
    if (civ.start[k]) G.res[k] += civ.start[k];
  }
  if (hasPerk('larder')) G.res.food += 20;
  if (hasPerk('armory')) G.res.weapons += 2;
  if (hasPerk('medicine')) G.res.meds += 2;

  const roles = ['farmer', 'worker', 'worker', 'guard'];
  if (civ.start.settler) roles.push(civ.start.settler);
  if (hasPerk('fifth')) roles.push('worker');
  const spots = openAround(camp.x, camp.y, roles.length);
  roles.forEach((r, i) => {
    const p = spots[i] || camp;
    G.settlers.push(makeSettler(p.x, p.y, r));
  });
  updatePeak();

  G.screen = 'GAME';
  G.intro = true;   // story splash; dismissing it unpauses and shows the welcome tip
  G.paused = true;
  addLog(`${civ.name} gather around the fire.`, '#e8d8a0');
  addLog('Grow food and build walls — raiders roam these lands.', '#b8b2a0');
  addLog('Keys: b build · t chop · m mine · g forage · w world · ? help', '#7a8a9a');
}
