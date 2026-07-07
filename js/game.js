// Core simulation: game state, time, pathfinding, settler AI, raider AI,
// combat, economy (cooking/crafting/foraging/trading), and run lifecycle.
import { rint, choice, chance } from './rng.js';
import {
  MAP_W, MAP_H, VIEW_W, VIEW_H, T, BUILDS, NAMES, ROLE_ORDER, CIVS, TRADE, OBJECTIVES, TIPS,
  TRAITS, RAIDER_TYPES, WARLORD_NAMES, SEASONS, SEASON_LEN, FLAMMABLE, HOUSES, CRAFTS,
  STRUCT_HP, ELDERS, ELDER_IDLE,
} from './data.js';
import { genMap } from './map.js';
import { hasPerk, perkLevel, endRun, addPoints } from './meta.js';

function makeState() {
  return {
    civ: null,
    mods: { crop: 1, build: 1, guardDmg: 0, wallHp: 1, expPower: 1, travel: 1, deal: 0 },
    stats: {
      raids: 0, sites: 0, kills: 0, peak: 0, chopped: 0, farmsBuilt: 0, bedsBuilt: 0,
      wallsBuilt: 0, mealsCooked: 0, expeditions: 0, winters: 0, hordes: 0, warlords: 0, bandits: 0,
    },
    objIdx: 0, objFlash: 0, tip: null,
    day: 1, min: 380, speed: 1, paused: false, gameOver: false, victory: false, legacyEarned: 0, bonusLines: [],
    tiles: null, camp: { x: 0, y: 0 },
    res: { food: 25, meals: 0, wood: 40, stone: 12, scrap: 2, herbs: 0, coin: 4, weapons: 1, meds: 1 },
    settlers: [], raiders: [], log: [], notice: null,
    morale: 65, moraleEvents: [], beaconDay: 0,
    alarm: false, recruitDays: 2,
    mode: 'NORMAL', buildSel: null, sel: null, cursor: { x: -1, y: -1 }, cam: { x: 0, y: 0 },
    raidNext: 3, raidActive: false, raidTimer: 0, raidIsHorde: false, banditsCleared: 0,
    world: null, expeditions: [],
    craftQueue: [], trader: null,
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

// ---------------------------------------------------------------- seasons
export const seasonIdx = () => Math.floor(((G.day - 1) % (SEASON_LEN * 4)) / SEASON_LEN);
export const season = () => SEASONS[seasonIdx()];
export const isWinter = () => seasonIdx() === 3;
// days until winter starts (0 = winter is here)
export const daysToWinter = () => Math.max(0, SEASON_LEN * 3 - ((G.day - 1) % (SEASON_LEN * 4)));
export const isHordeDay = (day) => day >= 12 && day % 12 === 0;

// ---------------------------------------------------------------- morale
// Big swings keep a receipt so the meter can explain itself.
export function bumpMorale(n, why) {
  G.morale = Math.max(0, Math.min(100, G.morale + n));
  if (why && Math.abs(n) >= 3) {
    G.moraleEvents.push({ day: G.day, why, n });
    if (G.moraleEvents.length > 6) G.moraleEvents.shift();
  }
}
export function moraleWhy() {
  const bits = [];
  const recent = {};
  for (const e of G.moraleEvents) {
    if (e.day >= G.day - 3) recent[e.why] = (recent[e.why] || 0) + 1;
  }
  for (const [why, c] of Object.entries(recent)) bits.push(c > 1 ? `${c}× ${why}` : why);
  const starving = G.settlers.filter(s => s.starving).length;
  if (starving) bits.push(`${starving} starving`);
  const rough = G.settlers.filter(s => s.sleeping && !insideHouse(s)).length;
  if (rough) bits.push(`${rough} sleeping rough`);
  return bits.join(' · ');
}
export const moraleLabel = () =>
  G.morale >= 75 ? 'high' : G.morale >= 50 ? 'steady' : G.morale >= 35 ? 'low' : 'BREAKING';
const moraleWorkMult = () => G.morale >= 75 ? 1.15 : G.morale < 35 ? 0.8 : 1;

// ---------------------------------------------------------------- forecasts
// The loop only feels fair if dusk and hunger are visible before they land.

// Expected raid size for a given day (same math spawnRaid uses).
export function raidEstimate(day = G.day) {
  const horde = isHordeDay(day);
  const uncleared = G.world ? G.world.locs.filter(l => l.type === 'bandits' && !l.cleared).length : 0;
  let n = 2 + Math.floor((day - 2) / 3) - Math.floor(G.banditsCleared / 2);
  if (day >= 8) n += Math.min(3, uncleared);
  if (isWinter()) n = Math.max(2, n - 2);
  if (G.beaconDay) n += 2;
  const cap = day > 20 ? 10 + Math.floor((day - 20) / 4) : 10;
  n = Math.max(2, Math.min(cap, n));
  if (horde) n = Math.max(n + 3, 4 + Math.floor(day / 3)) + 1; // +1: the warlord
  return { n, horde };
}

// What dusk holds: the sidebar's heartbeat line.
export function tonightInfo() {
  if (G.raidActive) {
    return { label: G.raidIsHorde ? '☠ THE HORDE IS HERE' : '⚠ RAID UNDERWAY', fg: '#ff5040', urgent: true };
  }
  const today = G.day >= G.raidNext || isHordeDay(G.day);
  if (today) {
    const e = raidEstimate(G.day);
    return e.horde
      ? { label: `☠ tonight: HORDE ~${e.n}`, fg: '#ff4060', urgent: true }
      : { label: `⚠ tonight: raid ~${e.n}`, fg: '#e0a040', urgent: true };
  }
  if (G.day + 1 >= G.raidNext || isHordeDay(G.day + 1)) {
    return { label: '☾ quiet · war-drums tmrw', fg: '#e0c060' };
  }
  return { label: `☾ tonight: quiet (~${Math.max(1, G.raidNext - G.day)}d)`, fg: '#8a94a2' };
}

// Hunger math, surfaced: burn per day, days of stores, what winter will want.
export function foodInfo() {
  let burn = 0;
  for (const s of G.settlers) {
    if (s.away) continue;
    burn += 0.075 * (s.trait === 'glutton' ? 1.5 : 1) * (isWinter() ? 1.25 : 1);
  }
  const perDay = burn * 1440 / 46; // in raw-food units
  const stock = G.res.food + G.res.meals * (65 / 46);
  const winterNeed = Math.ceil(G.settlers.length * 0.075 * 1.25 * 1440 / 46 * SEASON_LEN);
  return { perDay, days: perDay > 0 ? stock / perDay : 99, stock, winterNeed };
}

// ---------------------------------------------------------------- structures
export function structMax(t) {
  const base = STRUCT_HP[t];
  if (!base) return 0;
  return (t === 'wall_w' || t === 'wall_s') ? Math.round(base * G.mods.wallHp) : base;
}
export const structDamaged = (tl) => STRUCT_HP[tl.t] && tl.hp !== undefined && tl.hp <= structMax(tl.t) - 15;

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
  if (!G.tiles || G.gameOver) return;
  const data = {
    ...G,
    usedNames: [...G.usedNames],
    buildSel: null, notice: null, tip: null, sel: null,
    mode: 'NORMAL', cursor: { x: -1, y: -1 },
  };
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch (e) { /* ignore */ }
}
export function loadGame() {
  try {
    const d = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (!d || !d.tiles) return false;
    if (d.tiles.length !== MAP_W * MAP_H) return false; // save from an older world size
    delete d.party; delete d.partyOpen; delete d.screen; delete d.help; delete d.intro;
    delete d.menuSel; delete d.civSel; delete d.perkSel; delete d.tradeSel; delete d.buildFocus; delete d.partySel; delete d.selLoc;
    d.usedNames = new Set(d.usedNames || []);
    d.buildSel = null; d.notice = null; d.tip = null;
    d.stats = { ...makeState().stats, ...(d.stats || {}) }; // older saves lack new counters
    d.mods = { ...makeState().mods, ...(d.mods || {}) };
    for (const s of d.settlers || []) { // pre-trait saves
      if (!s.trait) s.trait = choice(Object.keys(TRAITS));
      if (s.downed === undefined) s.downed = false;
    }
    for (const tl of d.tiles) { // pre-house saves: beds become tents, floors are gone
      if (tl.t === 'bed') { tl.t = 'tent'; tl.hp = 30; }
      if (tl.t === 'floor') tl.t = 'dirt';
      if (tl.build) {
        if (tl.build.id === 'bed') tl.build.id = 'tent';
        if (tl.build.id === 'floor') delete tl.build;
      }
      if (tl.sleeper !== undefined) { tl.sleepers = [tl.sleeper]; delete tl.sleeper; }
    }
    Object.assign(G, makeState(), d);
    return true;
  } catch (e) { return false; }
}

export function communeFallen() {
  if (G.gameOver) return;
  G.gameOver = true;
  addLog('The commune has fallen.', '#e05040');
  G.stats.bandits = G.banditsCleared;
  const r = endRun(G.stats, G.day, { win: false });
  G.legacyEarned = r.pts; G.bonusLines = r.bonuses;
  clearSave(); // permadeath: the run is over
}

function communeAscended() {
  if (G.gameOver) return;
  G.gameOver = true; G.victory = true;
  addLog('☼ The Beacon held. Your people pass into legend.', '#ffe060');
  G.stats.bandits = G.banditsCleared;
  const r = endRun(G.stats, G.day, { win: true });
  G.legacyEarned = r.pts; G.bonusLines = r.bonuses;
  clearSave(); // the story is told either way
}

// ---------------------------------------------------------------- pathfinding
export function findPath(sx, sy, tx, ty, opts = {}) {
  const pass = (x, y) => {
    if (!inMap(x, y)) return false;
    const t = tileAt(x, y).t;
    if (opts.noDoor && t === 'door') return false; // sneaks use only open gaps
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
  const trait = choice(Object.keys(TRAITS));
  const maxHp = trait === 'hardy' ? 26 : trait === 'frail' ? 14 : 20;
  return {
    id: G.nextId++, name, x, y, role, trait,
    hp: maxHp, maxHp, hunger: rint(15, 35), energy: rint(60, 95),
    sleeping: false, away: false, starving: false, downed: false,
    task: null, path: null, pathGoal: null, pathAge: 0, atkcd: 0, bedIdx: -1, failCd: 0,
  };
}

export const traitName = (s) => TRAITS[s.trait] ? TRAITS[s.trait].name : '';

// The alarm bell: civilians run for the fire, guards stand to their posts,
// until the player (or the dawn) sounds the all-clear.
export function toggleAlarm() {
  G.alarm = !G.alarm;
  if (G.alarm) addLog('♪ The alarm bell rings — everyone to the fire!', '#e0c060');
  else addLog('The all-clear sounds. Back to work.', '#8ad080');
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
    if (tl.sleepers) {
      const i = tl.sleepers.indexOf(s.id);
      if (i >= 0) tl.sleepers.splice(i, 1);
      if (!tl.sleepers.length) delete tl.sleepers;
    }
    s.bedIdx = -1;
  }
}

// A settler tucked into a house is drawn as the house, not the sprite.
export function insideHouse(s) {
  if (!s.sleeping || s.away) return false;
  const tl = tileAt(s.x, s.y);
  return !!HOUSES[tl.t] && !!tl.sleepers && tl.sleepers.includes(s.id);
}


// Total sleeping spots across every standing house.
export function housingCap() {
  let n = 0;
  for (const tl of G.tiles) {
    const hd = HOUSES[tl.t];
    if (hd) n += hd.cap;
  }
  return n;
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
// raiders go for whoever still stands; the downed are only prey if no one else is left
const nearestLiveSettler = (r) => {
  const up = G.settlers.filter(s => !s.away && s.hp > 0 && !s.downed);
  const pool = up.length ? up : G.settlers.filter(s => !s.away && s.hp > 0);
  return pool.reduce((b, s) => (!b || mdist(s.x, s.y, r.x, r.y) < mdist(b.x, b.y, r.x, r.y)) ? s : b, null);
};

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
    if (HOUSES[tl.t] && tl.sleepers && tl.sleepers.includes(s.id)) return { x: s.bedIdx % MAP_W, y: (s.bedIdx / MAP_W) | 0 };
    s.bedIdx = -1;
  }
  let best = -1, bd = Infinity;
  for (let i = 0; i < G.tiles.length; i++) {
    const tl = G.tiles[i];
    const hd = HOUSES[tl.t];
    if (!hd || (tl.sleepers || []).length >= hd.cap) continue;
    const d = mdist(s.x, s.y, i % MAP_W, (i / MAP_W) | 0);
    if (d < bd) { bd = d; best = i; }
  }
  if (best < 0) return null;
  const tl = G.tiles[best];
  (tl.sleepers = tl.sleepers || []).push(s.id);
  s.bedIdx = best;
  return { x: best % MAP_W, y: (best / MAP_W) | 0 };
}

// job priorities per role: lower runs first
const PRI = {
  farmer: { harvest: 0, cook: 1, buildFarm: 1, forage: 2, chop: 3, build: 3, mine: 4, craft: 5, repair: 4 },
  worker: { build: 0, buildFarm: 0, craft: 1, chop: 1, forage: 2, mine: 2, cook: 3, harvest: 3, repair: 1 },
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
    if (tl.burning) { kind = 'douse'; work = 6; p = -1; } // fire beats everything
    else if (tl.build) {
      kind = 'build'; work = Math.ceil(buildDef(tl.build.id).work / G.mods.build);
      p = tl.build.id === 'farm' ? pri.buildFarm : pri.build;
    } else if (tl.desig === 'chop') { kind = 'chop'; work = 18; p = pri.chop; }
    else if (tl.desig === 'mine') { kind = 'mine'; work = 26; p = pri.mine; }
    else if (tl.desig === 'forage' && !isWinter()) { kind = 'forage'; work = 10; p = pri.forage; }
    else if (tl.desig === 'fish' && !(tl.fishCd > 0)) { kind = 'fish'; work = 14; p = pri.forage; }
    else if (tl.t === 'farm' && (tl.growth || 0) >= 100) { kind = 'harvest'; work = 8; onTile = true; p = pri.harvest; }
    else if (tl.t === 'kitchen' && G.res.food >= 4 && G.res.meals < pop * 2) { kind = 'cook'; work = 10; p = pri.cook; }
    else if (tl.t === 'workshop' && G.craftQueue.length) { kind = 'craft'; work = 12; p = pri.craft; }
    else if (structDamaged(tl) && !tl.burning && G.res[tl.t === 'wall_s' ? 'stone' : 'wood'] >= 1) { kind = 'repair'; work = 8; p = pri.repair; }
    if (kind === null) continue;
    const key = p * 10000 + mdist(s.x, s.y, x, y);
    if (key < bestKey) { bestKey = key; best = { kind, x, y, work, onTile, item: null }; }
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
    case 'forage': return tl.desig === 'forage' && tl.t === 'bush' && !isWinter();
    case 'fish': return tl.desig === 'fish' && tl.t === 'water' && !(tl.fishCd > 0);
    case 'harvest': return tl.t === 'farm' && (tl.growth || 0) >= 100;
    case 'cook': return tl.t === 'kitchen' && G.res.food >= 2;
    case 'craft': return tl.t === 'workshop' && !!t.item;
    case 'douse': return !!tl.burning;
    case 'repair': return structDamaged(tl) && !tl.burning && G.res[tl.t === 'wall_s' ? 'stone' : 'wood'] >= 1;
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
  if (t.kind === 'chop') { tl.t = 'dirt'; delete tl.desig; delete tl.burning; G.res.wood += rint(2, 4); G.stats.chopped++; }
  else if (t.kind === 'mine') { tl.t = 'dirt'; delete tl.desig; G.res.stone += rint(2, 3); }
  else if (t.kind === 'forage') { tl.t = 'grass'; delete tl.desig; delete tl.burning; G.res.herbs += 2; }
  else if (t.kind === 'fish') { G.res.food += isWinter() ? rint(1, 2) : rint(2, 4); tl.fishCd = 500; }
  else if (t.kind === 'douse') { delete tl.burning; }
  else if (t.kind === 'repair') {
    const mat = tl.t === 'wall_s' ? 'stone' : 'wood';
    if (G.res[mat] >= 1) {
      G.res[mat]--;
      tl.hp = Math.min(structMax(tl.t), tl.hp + (mat === 'stone' ? 25 : 15));
    }
  }
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
    if (HOUSES[def.id]) G.stats.bedsBuilt++; // any roof raised counts
    if (def.id === 'wall_w' || def.id === 'wall_s' || def.id === 'door') G.stats.wallsBuilt++;
    if (def.id === 'beacon') {
      G.beaconDay = G.day;
      bumpMorale(20, 'the Beacon lit');
      G.raidNext = Math.min(G.raidNext, G.day + 1);
      addLog('☼ THE BEACON IS LIT! Every eye for miles turns this way.', '#ffe060');
      addLog('Hold the commune for 3 days and your story ends in triumph.', '#ffe060');
      tip('beacon');
    }
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
  let mult = moraleWorkMult();
  if (s.trait === 'craven') mult *= 1.25;
  if (s.trait === 'frail') mult *= 1.1;
  if (s.trait === 'farmhand' && ['harvest', 'forage', 'fish'].includes(t.kind)) mult *= 1.33;
  t.work -= mult;
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
    if (r.loot) { // cut down before escaping with the goods
      for (const k in r.loot) G.res[k] += r.loot[k];
      addLog(`${s.name} cut down the thief — the goods are recovered!`, '#8ad080');
    } else if (r.type === 'warlord') {
      G.stats.warlords++;
      const coin = rint(6, 12);
      G.res.coin += coin; G.res.weapons++;
      addLog(`☠ ${r.name} has fallen to ${s.name}! Spoils: ${coin} coin, a weapon.`, '#ffd860');
      addLog('The horde breaks and runs!', '#8ad080');
      bumpMorale(15, 'warlord slain');
      for (const x of G.raiders) x.fleeing = true;
    } else {
      addLog(`${s.name} slew a ${RAIDER_TYPES[r.type] ? RAIDER_TYPES[r.type].name : 'raider'}!`, '#8ad080');
    }
  }
}

function killSettler(s, how) {
  addLog(`☠ ${s.name} ${how}.`, '#e05040');
  bumpMorale(hasPerk('stouthearts') ? -8 : -15, 'a death');
  releaseTask(s); clearBed(s);
  G.settlers = G.settlers.filter(x => x !== s);
  if (!G.settlers.length) communeFallen();
}

// Combat damage to a settler: at 0 hp there is an even chance they go down
// wounded instead of dying — helpless where they fall until they recover.
export function woundSettler(s, dmg, how) {
  s.hp -= dmg;
  if (s.sleeping) { s.sleeping = false; clearBed(s); }
  if (s.hp > 0) return;
  if (!s.downed && chance(0.5)) {
    s.downed = true; s.hp = 1;
    releaseTask(s); clearBed(s);
    addLog(`☠ ${s.name} is DOWN — helpless where they fell!`, '#e08040');
    tip('downed');
    return;
  }
  killSettler(s, how);
}

function updateSettler(s) {
  if (s.away) return;
  if (s.failCd > 0) s.failCd--;
  const hungerRate = 0.075 * (s.trait === 'glutton' ? 1.5 : 1) * (isWinter() ? 1.25 : 1);
  s.hunger = Math.min(100, s.hunger + hungerRate);
  if (!s.sleeping) {
    const drain = (s.trait === 'nightowl' && isNight()) ? 0.015 : 0.06;
    s.energy = Math.max(0, s.energy - drain);
  }
  if (s.hunger >= 100) {
    s.hp -= 0.06;
    bumpMorale(-0.01);
    if (!s.starving) { s.starving = true; addLog(`${s.name} is starving!`, '#e06040'); tip('starving'); }
  } else s.starving = false;
  if (s.hp <= 0) return killSettler(s, 'starved');
  const here = tileAt(s.x, s.y);
  if (here.burning) {
    s.hp -= 0.15;
    if (s.sleeping) { s.sleeping = false; clearBed(s); }
    if (s.hp <= 0) return killSettler(s, 'died in the flames');
  }
  if (s.hp < 9 && G.res.meds > 0) {
    G.res.meds--; s.hp = Math.min(s.maxHp, s.hp + 12);
    addLog(`${s.name} used a medkit.`, '#68c088');
  }
  if (s.hunger > 72) {
    if (G.res.meals >= 1) { G.res.meals--; s.hunger = Math.max(0, s.hunger - 65); bumpMorale(0.3); }
    else if (G.res.food >= 1) { G.res.food--; s.hunger = Math.max(0, s.hunger - 46); }
  }

  const houseHere = HOUSES[here.t] && here.sleepers && here.sleepers.includes(s.id) ? HOUSES[here.t] : null;

  if (s.downed) {
    // wounded: helpless, slowly crawling for shelter; back up at 8 hp
    s.hp = Math.min(s.maxHp, s.hp + (houseHere ? houseHere.heal : 0.012));
    if (s.hp >= 8) {
      s.downed = false; clearBed(s);
      addLog(`${s.name} is back on their feet.`, '#8ad080');
      return;
    }
    s.crawlCd = (s.crawlCd || 0) - 1;
    if (s.crawlCd <= 0) {
      s.crawlCd = 4;
      const bed = claimBed(s);
      if (bed && !(s.x === bed.x && s.y === bed.y)) moveToward(s, bed.x, bed.y, {});
    }
    return;
  }

  if (s.sleeping) {
    s.energy = Math.min(100, s.energy + (houseHere ? houseHere.rest : 0.15));
    s.hp = Math.min(s.maxHp, s.hp + (houseHere ? houseHere.heal : 0.015));
    if (!houseHere && isNight()) bumpMorale(-0.003); // sleeping rough wears on everyone
    const wake = s.energy >= 99 || (!isNight() && s.energy > 70) || G.raidActive || adjacentRaider(s);
    if (wake) { s.sleeping = false; clearBed(s); }
    else return;
  }

  const foe = adjacentRaider(s);
  if (foe && s.trait !== 'craven') {
    if (s.atkcd > 0) s.atkcd--;
    else {
      s.atkcd = 1;
      const brave = s.trait === 'brave' ? 2 : 0;
      hitRaider(foe, rint(1, 3) + brave + (s.role === 'guard' ? rint(1, 2) + G.mods.guardDmg : 0) + weaponBonus(s), s);
    }
    return;
  }

  if (G.raidActive || G.alarm) {
    if (s.role === 'guard') {
      // guards garrisoned near a watch post loose arrows instead of chasing
      const post = nearestPost(s);
      if (post && Math.max(Math.abs(s.x - post.x), Math.abs(s.y - post.y)) <= 2) {
        const r = nearestRaider(s);
        const range = s.trait === 'keeneye' ? 8 : 6;
        if (r && mdist(r.x, r.y, s.x, s.y) <= range) {
          if (s.atkcd > 0) s.atkcd--;
          else { s.atkcd = 2; hitRaider(r, rint(1, 3) + 1 + (s.trait === 'keeneye' ? 2 : 0), s); }
          return;
        }
      }
      if (s.trait === 'craven') { // a craven guard mans the post but won't charge
        if (post && mdist(s.x, s.y, post.x, post.y) > 2) moveToward(s, post.x, post.y, { adjacent: true, refresh: 8 });
        return;
      }
      const r = nearestRaider(s);
      if (r) { moveToward(s, r.x, r.y, { adjacent: true, refresh: 5 }); return; }
      if (G.alarm) { // bell rung, no foe yet: stand ready at the post
        const anchor = post || G.camp;
        if (mdist(s.x, s.y, anchor.x, anchor.y) > 2) moveToward(s, anchor.x, anchor.y, { adjacent: true, refresh: 10 });
        return;
      }
    } else {
      releaseTask(s);
      if (mdist(s.x, s.y, G.camp.x, G.camp.y) > 3) moveToward(s, G.camp.x, G.camp.y, { adjacent: true, refresh: 10 });
      return;
    }
  }

  if (s.energy < 25 || (isNight() && s.energy < 70 && s.trait !== 'nightowl')) {
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

// ---------------------------------------------------------------- fire
export function ignite(x, y) {
  if (!inMap(x, y)) return false;
  const tl = tileAt(x, y);
  if (tl.burning || !FLAMMABLE.has(tl.t)) return false;
  tl.burning = 90;
  return true;
}

// Fire burns structures down over time and creeps to flammable neighbours.
// Runs every other tick; also pays down fishing-spot cooldowns in the same
// pass so there is exactly one full-map sweep here.
function fireTick() {
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
      } else if (tl.burning <= 0) delete tl.burning; // burned out, scorched but standing
    } else if (tl.burning <= 0) {
      if (tl.t !== 'water') tl.t = 'dirt';
      delete tl.burning; delete tl.growth; delete tl.sleepers; delete tl.claim; delete tl.desig;
    }
  }
}

// ---------------------------------------------------------------- raiders
function makeRaider(x, y, type) {
  const d = RAIDER_TYPES[type];
  return { id: G.nextId++, type, x, y, hp: rint(d.hp[0], d.hp[1]) + Math.floor((G.day / 3) * d.hpDay), atkcd: 0 };
}

function stepRaider(r) {
  const d = RAIDER_TYPES[r.type];
  const n = r.path && r.path[0];
  if (!n) { r.path = null; return; }
  const tl = tileAt(n.x, n.y);
  const bashable = tl.hp !== undefined && (tl.t === 'wall_w' || tl.t === 'wall_s' || tl.t === 'door');
  if (!T[tl.t].walk || tl.t === 'door') {
    if (bashable && d.bash[1] > 0) {
      tl.hp -= rint(d.bash[0], d.bash[1]);
      if (tl.hp <= 0) {
        const name = T[tl.t].name;
        tl.t = 'dirt'; delete tl.hp; delete tl.burning;
        addLog(`${r.type === 'brute' ? 'A brute' : 'Raiders'} smashed a ${name}!`, '#e08040');
      }
    } else r.path = null;
    return;
  }
  r.x = n.x; r.y = n.y; r.path.shift();
  if (tl.t === 'trap') {
    r.hp -= 7;
    addLog(`A ${RAIDER_TYPES[r.type].name} stumbled into a spike trap!`, '#e0b050');
    if (chance(0.65)) { tl.t = 'dirt'; delete tl.hp; }
    if (r.hp <= 0) {
      G.raiders = G.raiders.filter(x => x !== r);
      G.stats.kills++;
      addLog('...and died on the spikes.', '#8ad080');
    }
  }
}

// Player-built flammable structures, cached per game-minute for torchers.
const structCache = { stamp: -1, list: [] };
function nearestBurnable(r) {
  const stamp = G.day * 1440 + G.min;
  if (structCache.stamp !== stamp) {
    structCache.stamp = stamp;
    structCache.list = [];
    for (let i = 0; i < G.tiles.length; i++) {
      const tl = G.tiles[i];
      if (FLAMMABLE.has(tl.t) && tl.t !== 'tree' && tl.t !== 'bush' && !tl.burning) {
        structCache.list.push({ x: i % MAP_W, y: (i / MAP_W) | 0 });
      }
    }
  }
  let best = null, bd = Infinity;
  for (const p of structCache.list) {
    const dd = mdist(r.x, r.y, p.x, p.y);
    if (dd < bd) { bd = dd; best = p; }
  }
  return best;
}

// Skirmishers slip through open gaps to the stockpile at the fire, grab what
// they can carry, and run. Sealed out, they hunt whoever is in the open.
function skirmisherBrain(r) {
  if (r.hp < 5 && !r.loot) { r.fleeing = true; return; }
  if (mdist(r.x, r.y, G.camp.x, G.camp.y) === 1) {
    const food = Math.min(G.res.food, rint(4, 8));
    const coin = Math.min(G.res.coin, rint(2, 5));
    if (food + coin > 0) {
      G.res.food -= food; G.res.coin -= coin;
      r.loot = {};
      if (food) r.loot.food = food;
      if (coin) r.loot.coin = coin;
      addLog(`§ A skirmisher snatched ${food ? `${food} food` : ''}${food && coin ? ', ' : ''}${coin ? `${coin} coin` : ''} from the stores!`, '#e0b050');
      tip('thief');
    }
    r.fleeing = true;
    return;
  }
  r.pathAge = (r.pathAge || 0) + 1;
  if (!r.path || !r.path.length || r.pathAge > 10) {
    r.path = findPath(r.x, r.y, G.camp.x, G.camp.y, { adjacent: true, noDoor: true });
    r.pathAge = 0;
    if (!r.path) {
      const tgt = nearestLiveSettler(r);
      r.path = tgt ? findPath(r.x, r.y, tgt.x, tgt.y, { adjacent: true, noDoor: true }) : null;
      if (!r.path) { if (chance(0.5)) stepRandom(r); return; } // sealed out: skulk
    }
  }
  stepRaider(r);
}

// Torch-bearers walk to the nearest wooden structure and set it alight.
function torcherBrain(r) {
  if (r.igniteCd > 0) { r.igniteCd--; return; }
  for (const [dx, dy] of DIRS) {
    const x = r.x + dx, y = r.y + dy;
    if (!inMap(x, y)) continue;
    const tl = tileAt(x, y);
    if (!tl.burning && FLAMMABLE.has(tl.t) && tl.t !== 'tree' && tl.t !== 'bush') {
      ignite(x, y);
      // announce the first torch loudly, then only the occasional one
      if (!r.litAny || chance(0.25)) addLog(`¡ A torch-bearer set your ${T[tl.t].name} alight!`, '#ff9030');
      r.litAny = true;
      tip('fire');
      r.igniteCd = 6; r.path = null;
      return;
    }
  }
  r.pathAge = (r.pathAge || 0) + 1;
  if (!r.path || !r.path.length || r.pathAge > 12) {
    const tgt = nearestBurnable(r);
    r.path = tgt ? findPath(r.x, r.y, tgt.x, tgt.y, { adjacent: true, noDoor: true }) : null;
    r.pathAge = 0;
    if (!r.path) {
      if (chance(0.2)) r.fleeing = true;
      else if (chance(0.5)) stepRandom(r);
      return;
    }
  }
  stepRaider(r);
}

function updateRaider(r) {
  const d = RAIDER_TYPES[r.type];
  const anyUp = G.settlers.some(s => !s.away && !s.downed);
  const foe = G.settlers.find(s => !s.away && (!s.downed || !anyUp) && mdist(s.x, s.y, r.x, r.y) === 1);
  if (foe && !r.fleeing) {
    if (r.atkcd > 0) r.atkcd--;
    else {
      r.atkcd = 1;
      woundSettler(foe, rint(d.dmg[0], d.dmg[1]), 'was slain by raiders');
    }
    return;
  }
  r.moveCd = (r.moveCd || 0) - 1;
  if (r.moveCd > 0) return;
  r.moveCd = d.moveCd;

  if (r.fleeing) {
    if (r.x <= 0 || r.x >= MAP_W - 1 || r.y <= 0 || r.y >= MAP_H - 1) {
      G.raiders = G.raiders.filter(x => x !== r);
      if (r.loot) {
        addLog('§ The thief escaped with the stolen goods.', '#e08040');
        bumpMorale(-3, 'goods stolen');
      }
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

  if (r.type === 'skirmisher') return skirmisherBrain(r);
  if (r.type === 'torcher') return torcherBrain(r);

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

// Later raids mix in specialists; hordes stack brutes behind a warlord.
function raidComposition(n, horde) {
  const types = [];
  for (let i = 0; i < n; i++) {
    let t = 'raider';
    if (G.day >= 6 && chance(horde ? 0.3 : 0.18)) t = 'brute';
    else if (G.day >= 9 && chance(0.25)) t = 'skirmisher';
    else if (G.day >= 11 && chance(0.2)) t = 'torcher';
    types.push(t);
  }
  return types;
}

function spawnRaid() {
  // sizing lives in raidEstimate so the sidebar forecast can't drift from truth
  const est = raidEstimate(G.day);
  const horde = est.horde;
  let n = est.n - (horde ? 1 : 0) + rint(0, 1); // warlord spawns separately; small jitter

  const twoFront = horde || (G.day >= 14 && chance(0.4));
  const sideA = rint(0, 3);
  const sideB = twoFront ? (sideA + rint(1, 3)) % 4 : sideA;
  const spots = [];
  for (let i = 0; i < 400 && spots.length < n; i++) {
    const side = (!twoFront || spots.length % 2 === 0) ? sideA : sideB;
    let x, y;
    if (side === 0) { x = rint(1, MAP_W - 2); y = 0; }
    else if (side === 1) { x = rint(1, MAP_W - 2); y = MAP_H - 1; }
    else if (side === 2) { x = 0; y = rint(1, MAP_H - 2); }
    else { x = MAP_W - 1; y = rint(1, MAP_H - 2); }
    if (walkable(x, y)) spots.push({ x, y });
  }
  if (!spots.length) { G.raidNext = G.day + 1; return; }

  const types = raidComposition(spots.length, horde);
  spots.forEach((p, i) => G.raiders.push(makeRaider(p.x, p.y, types[i] || 'raider')));
  if (horde) {
    const w = makeRaider(spots[0].x, spots[0].y, 'warlord');
    w.name = choice(WARLORD_NAMES);
    G.raiders.push(w);
    G.raidIsHorde = true;
  }
  G.raidActive = true;
  G.raidTimer = horde ? 560 : 420;
  if (G.trader) { G.trader = null; if (G.mode === 'TRADE') G.mode = 'NORMAL'; addLog('The trader fled at the first war-horn.', '#e0c060'); }
  const sides = ['north', 'south', 'west', 'east'];
  const from = twoFront ? `${sides[sideA]} AND ${sides[sideB]}` : sides[sideA];
  if (horde) {
    const w = G.raiders[G.raiders.length - 1];
    addLog(`☠ HORDE! ${w.name} leads ${G.raiders.length} against you from the ${from}!`, '#ff4060');
    tip('horde');
  } else {
    addLog(`⚠ RAID! ${G.raiders.length} raiders attack from the ${from}!`, '#ff5040');
  }
  const counts = {};
  for (const r of G.raiders) if (r.type !== 'raider' && r.type !== 'warlord') counts[r.type] = (counts[r.type] || 0) + 1;
  const bits = Object.entries(counts).map(([t, c]) => `${c} ${RAIDER_TYPES[t].name}${c > 1 ? 's' : ''}`);
  if (bits.length) addLog(`Among them: ${bits.join(', ')}.`, '#e08040');
  tip('raid');
}

// ---------------------------------------------------------------- trader
export function adjustedOffer(i) {
  const o = TRADE[i];
  const d = G.mods.deal;
  const give = { ...o.give }, get = { ...o.get };
  if (get.food && isWinter()) give.coin = Math.ceil(give.coin * 1.6); // scarcity pricing
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

// Growth is earned, not rolled: all conditions green → the countdown ticks.
export function recruitEligible() {
  const pop = G.settlers.length;
  return G.day > 2 && pop < 16 && !isWinter() && G.res.food + G.res.meals > pop * 3
    && housingCap() > pop && G.morale >= 35;
}
// Which condition is failing (for the elder and the sidebar).
export function recruitBlocker() {
  const pop = G.settlers.length;
  if (pop >= 16) return 'the commune is full';
  if (isWinter()) return 'no one travels in winter';
  if (G.res.food + G.res.meals <= pop * 3) return 'not enough food on the fire';
  if (housingCap() <= pop) return 'no roof to offer';
  if (G.morale < 35) return 'word of misery spreads';
  return null;
}

function dawnEvents() {
  addLog(`— Day ${G.day} —`, '#7a8a9a');
  if (G.alarm) { G.alarm = false; addLog('Dawn sounds the all-clear — back to the fields.', '#8ad080'); }
  G.moraleEvents = G.moraleEvents.filter(e => e.day >= G.day - 4);

  // the beacon: hold 3 days after lighting and the run ends in victory
  if (G.beaconDay && G.day >= G.beaconDay + 3) { communeAscended(); return; }

  // season turns
  if (G.day > 1 && (G.day - 1) % SEASON_LEN === 0) {
    const s = season();
    addLog(`❧ ${s.name} has come.`, s.fg);
    if (s.id === 'autumn') { addLog('The larders must be full before the snow.', '#e0a040'); tip('autumn'); }
    if (s.id === 'winter') { addLog('Crops sleep and bushes stand bare. Live off your stores.', '#a8c8e8'); tip('winter'); }
    if (s.id === 'spring' && G.day > SEASON_LEN * 3) {
      G.stats.winters++;
      bumpMorale(10, 'endured winter');
      addLog('◆ The thaw! The commune endured the winter.', '#8ad080');
    }
  }

  const pop = G.settlers.length;

  // desertion: a broken commune bleeds people
  if (G.morale < 35) tip('morale');
  if (G.morale < 25 && pop >= 3 && chance(0.6)) {
    const cands = G.settlers.filter(s => !s.away && !s.downed);
    if (cands.length) {
      const s = choice(cands);
      const food = Math.min(G.res.food, 5), coin = Math.min(G.res.coin, 3);
      G.res.food -= food; G.res.coin -= coin;
      releaseTask(s); clearBed(s);
      G.settlers = G.settlers.filter(x => x !== s);
      addLog(`☹ ${s.name} deserted in the night, taking ${food} food${coin ? ` and ${coin} coin` : ''}.`, '#e08040');
      if (!G.settlers.length) { communeFallen(); return; }
    }
  }

  // recruitment is a visible pipeline, not a dice roll: keep food on the
  // fire, a roof free, and spirits up, and someone arrives on schedule
  if (recruitEligible()) {
    G.recruitDays--;
    if (G.recruitDays <= 0) {
      const spot = edgeWalkable();
      if (spot) {
        const s = makeSettler(spot.x, spot.y, 'worker');
        G.settlers.push(s);
        updatePeak();
        addLog(`☺ ${s.name} (${traitName(s).toLowerCase()}), a wanderer, has joined the commune!`, '#e8d8a0');
        if (G.settlers.length === 6) addLog('◆ Commune tier II reached — watch posts, workshop, kitchen unlocked!', '#c8a0e8');
        if (G.settlers.length === 9) addLog('◆ Commune tier III reached — stone walls unlocked!', '#c8a0e8');
      }
      G.recruitDays = G.morale >= 75 ? 1 : 2; // word spreads fast about a happy commune
    }
  }

  if (isHordeDay(G.day)) {
    addLog('☠ War-drums beyond the hills — a HORDE marches on you. They come at dusk!', '#ff4060');
    tip('horde');
  } else if (G.day >= G.raidNext) { addLog('⚠ Scouts report raiders nearby — they strike at dusk!', '#e0a040'); tip('raidwarn'); }
  else if (G.day === G.raidNext - 1) addLog('Rumors of raiders gathering. Prepare defenses.', '#e0c060');
  if (G.beaconDay) addLog(`☼ The Beacon burns — ${G.beaconDay + 3 - G.day} day${G.beaconDay + 3 - G.day === 1 ? '' : 's'} to hold.`, '#ffe060');
  if (G.res.food + G.res.meals < pop * 2) tip('foodlow');
  if (daysToWinter() === 1) addLog('❄ Winter arrives tomorrow.', '#a8c8e8');
}

// ---------------------------------------------------------------- the elder
// One voice, one counsel at a time: the most pressing leak in the commune,
// or a word of seasonal calm when nothing leaks. Cached per tick.
const dmgCache = { stamp: -1, val: { total: 0, walls: 0 } };
function countDamaged() {
  const stamp = G.day * 1440 + G.min;
  if (dmgCache.stamp !== stamp) {
    dmgCache.stamp = stamp;
    let total = 0, walls = 0;
    for (const tl of G.tiles) {
      if (structDamaged(tl)) {
        total++;
        if (tl.t === 'wall_w' || tl.t === 'wall_s' || tl.t === 'door') walls++;
      }
    }
    dmgCache.val = { total, walls };
  }
  return dmgCache.val;
}

const elderCache = { stamp: -1, val: null };
export function elderCounsel() {
  const stamp = G.day * 1440 + G.min;
  if (elderCache.stamp === stamp && elderCache.val) return elderCache.val;
  elderCache.stamp = stamp;
  const name = ELDERS[G.civ] || 'The Elder';
  const mk = (text, mood = 'calm', prog = null) => (elderCache.val = { name, text, mood, prog });

  if (G.raidActive) {
    return mk(G.raidIsHorde ? 'Fell the warlord and the horde breaks!' : 'Hold the line! Guards, to the walls!', 'alarm');
  }
  const starving = G.settlers.find(s => s.starving && !s.away);
  if (starving) return mk(`${starving.name} is starving. Harvest, cook, or trade — now.`, 'alarm');

  // the tutorial chain speaks with the elder's voice
  if (G.objIdx < OBJECTIVES.length) {
    const o = OBJECTIVES[G.objIdx];
    return mk(`${o.text} — ${o.hint}`, tonightInfo().urgent ? 'wary' : 'calm', o.prog ? o.prog(G) : null);
  }

  const tn = tonightInfo();
  const dmg = countDamaged();
  if (tn.urgent) {
    const guards = G.settlers.filter(s => s.role === 'guard' && !s.away && !s.downed).length;
    if (!guards) return mk('War at dusk and no spears raised! Make guards of someone.', 'alarm');
    if (dmg.walls) return mk(`War at dusk, ${dmg.walls} wall${dmg.walls > 1 ? 's' : ''} still scarred. The bell (r) waits.`, 'alarm');
    return mk('They come at dusk. Ring the bell (r), gather early.', 'wary');
  }
  const down = G.settlers.find(s => s.downed);
  if (down) return mk(`${down.name} lies wounded. Keep them safe as they crawl home.`, 'wary');
  const fi = foodInfo();
  if (fi.days < 3) return mk(`The larder empties in ${Math.max(1, Math.ceil(fi.days))} days. Harvest, fish, or trade.`, 'alarm');
  if (season().id === 'autumn' && fi.stock < fi.winterNeed) {
    return mk(`Winter will want ~${fi.winterNeed} food. We hold ${Math.round(fi.stock)}. Stockpile.`, 'wary');
  }
  if (G.morale < 35) return mk(`Hearts are breaking — ${moraleWhy() || 'a long, hard road'}.`, 'wary');
  const blocked = recruitBlocker();
  if (blocked === 'no roof to offer') return mk('Wanderers pass us by — no roof to offer. Raise a tent.', 'calm');
  const camp = G.world && G.world.locs.find(l => l.type === 'bandits' && !l.cleared && l.diff >= 12);
  if (camp && G.day >= 6) return mk(`${camp.name} grows bolder each day it stands. Burn it out.`, 'wary');
  if (dmg.total >= 3) return mk(`${dmg.total} structures bear scars. The crews will mend them.`, 'calm');
  if (communeTier() >= 3 && !G.beaconDay && !G.tiles.some(tl => tl.t === 'beacon' || (tl.build && tl.build.id === 'beacon'))) {
    return mk('We could raise the Beacon — and end this in light.', 'calm');
  }
  const idle = ELDER_IDLE[season().id];
  return mk(idle[G.day % idle.length], 'calm');
}

// ---------------------------------------------------------------- tick
export function tickGame() {
  if (G.gameOver || !G.tiles) return null;
  G.min++;
  let dawn = false;
  if (G.min >= 1440) { G.min = 0; G.day++; }
  if (G.min === 360) { dawn = true; dawnEvents(); }
  if (G.gameOver) return { dawn }; // dawn can end the run (victory / desertion collapse)
  if (G.min === 1150 && (G.day >= G.raidNext || isHordeDay(G.day)) && !G.raidActive) spawnRaid();
  if (G.day === 1 && G.min === 1200) tip('night');
  if (G.min % 15 === 0) checkObjectives();
  traderTick();
  fireTick();

  // morale drifts toward a baseline the commune's people set
  let cheer = 0;
  for (const s of G.settlers) cheer += s.trait === 'cheerful' ? 1 : s.trait === 'grim' ? -1 : 0;
  const base = 60 + cheer * 2 + (hasPerk('stouthearts') ? 5 : 0) + (G.beaconDay ? 5 : 0);
  G.morale += (base - G.morale) * 0.0004;

  if (!isNight() && !isWinter() && G.min % 3 === 0) {
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
      G.raidNext = G.day + rint(2, 4) + (isWinter() ? 2 : 0);
      G.stats.raids++;
      if (G.raidIsHorde) {
        G.raidIsHorde = false;
        G.stats.hordes++;
        bumpMorale(12, 'horde broken');
        addLog('◆ The horde is broken. Songs will be sung of this.', '#ffd860');
      } else {
        bumpMorale(6, 'raid repelled');
        addLog('The raid is over. The commune holds.', '#8ad080');
      }
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
  if (def.id === 'beacon' && G.tiles.some(tl => tl.t === 'beacon' || (tl.build && tl.build.id === 'beacon'))) {
    notice('There can be only one Beacon'); return;
  }
  const tl = tileAt(x, y);
  if (tl.build) return;
  if (!['grass', 'grass2', 'dirt'].includes(tl.t)) return;
  if (!pay(def.cost)) { notice('Not enough resources'); return; }
  tl.build = { id: def.id };
}

export function designate(x, y, kind) {
  if (!inMap(x, y)) return;
  const tl = tileAt(x, y);
  if (kind === 'chop' && tl.t === 'tree') tl.desig = 'chop';
  if (kind === 'mine' && tl.t === 'rock') tl.desig = 'mine';
  if (kind === 'forage' && tl.t === 'bush') tl.desig = 'forage';
  if (kind === 'forage' && tl.t === 'water') { // the same tool casts a line
    if (tl.desig !== 'fish') { tl.desig = 'fish'; tip('fish'); }
  }
}

// ------------------------------------------------- area selection (marquee)
// Normalized bounds of the current selection rect.
export function selBounds(sel = G.sel) {
  if (!sel) return null;
  return {
    x0: Math.max(0, Math.min(sel.ax, sel.bx)), y0: Math.max(0, Math.min(sel.ay, sel.by)),
    x1: Math.min(MAP_W - 1, Math.max(sel.ax, sel.bx)), y1: Math.min(MAP_H - 1, Math.max(sel.ay, sel.by)),
  };
}

// What work the selection could take: counts drive the orders menu.
export function selectionInfo(b) {
  const info = { trees: 0, rocks: 0, bushes: 0, water: 0, marks: 0, tiles: 0 };
  for (let y = b.y0; y <= b.y1; y++) for (let x = b.x0; x <= b.x1; x++) {
    const tl = tileAt(x, y);
    info.tiles++;
    if (tl.desig || tl.build) { info.marks++; continue; }
    if (tl.t === 'tree') info.trees++;
    else if (tl.t === 'rock') info.rocks++;
    else if (tl.t === 'bush') info.bushes++;
    else if (tl.t === 'water') info.water++;
  }
  return info;
}

// Apply an order to every eligible tile in the rect.
export function assignArea(b, kind) {
  for (let y = b.y0; y <= b.y1; y++) for (let x = b.x0; x <= b.x1; x++) {
    if (kind === 'all' || kind === 'chop') designate(x, y, 'chop');
    if (kind === 'all' || kind === 'mine') designate(x, y, 'mine');
    if (kind === 'all' || kind === 'forage') designate(x, y, 'forage');
  }
}

// Clear marks and unbuilt plans in the rect (never touches finished structures).
export function clearAreaPlans(b) {
  for (let y = b.y0; y <= b.y1; y++) for (let x = b.x0; x <= b.x1; x++) {
    const tl = tileAt(x, y);
    if (tl.build) { refund(buildDef(tl.build.id).cost); delete tl.build; delete tl.claim; }
    if (tl.desig) { delete tl.desig; delete tl.claim; delete tl.fishCd; }
  }
}

export function cancelAt(x, y) {
  if (!inMap(x, y)) return;
  const tl = tileAt(x, y);
  if (tl.build) { refund(buildDef(tl.build.id).cost); delete tl.build; delete tl.claim; return; }
  if (tl.desig) { delete tl.desig; delete tl.claim; delete tl.fishCd; return; }
  if (['wall_w', 'wall_s', 'door', 'farm', 'bed', 'tent', 'cabin', 'longhouse', 'campfire', 'post', 'trap', 'workshop', 'kitchen', 'beacon'].includes(tl.t)) {
    tl.t = 'dirt';
    delete tl.hp; delete tl.growth; delete tl.sleepers; delete tl.claim; delete tl.burning;
    // tearing down a lit beacon calls off the countdown
    if (G.beaconDay && !G.tiles.some(t2 => t2.t === 'beacon')) { G.beaconDay = 0; addLog('The Beacon is dark once more.', '#8a94a2'); }
  }
}

export function queueCraft(def) {
  const hasWorkshop = G.tiles.some(tl => tl.t === 'workshop');
  if (!hasWorkshop) { notice('Build a workshop first (tier II)'); return; }
  if (!pay(def.cost)) { notice('Not enough resources'); return; }
  G.craftQueue.push(def.id);
  notice(`${def.name} queued at the workshop`);
}

// Cancel the newest unstarted order; materials come back.
export function unqueueCraft() {
  const id = G.craftQueue.pop();
  if (!id) { notice('No orders waiting'); return; }
  const def = CRAFTS.find(c => c.id === id);
  if (def) refund(def.cost);
  notice(`${def ? def.name : 'Order'} cancelled — materials returned`);
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
  if (hasPerk('greenthumb')) G.mods.crop *= 1 + 0.1 * perkLevel('greenthumb');
  if (hasPerk('timber')) G.mods.wallHp *= 1.2;
  if (hasPerk('friends')) G.mods.deal = 0.2;
  if (hasPerk('stouthearts')) G.morale = 75;

  const { tiles, camp } = genMap();
  G.tiles = tiles; G.camp = camp;
  centerCam(camp.x, camp.y);
  const set = (dx, dy, t, extra = {}) => Object.assign(tileAt(camp.x + dx, camp.y + dy), { t, ...extra });
  set(0, 0, 'campfire');
  set(-2, 0, 'tent', { hp: 30 }); set(-2, 2, 'tent', { hp: 30 });
  for (let dy = 0; dy <= 1; dy++) for (let dx = 2; dx <= 4; dx++) set(dx, dy, 'farm', { growth: rint(20, 80) });

  for (const k of ['food', 'wood', 'stone', 'scrap', 'coin', 'weapons', 'meds']) {
    if (civ.start[k]) G.res[k] += civ.start[k];
  }
  G.res.food += 20 * perkLevel('larder');
  G.res.weapons += 2 * perkLevel('armory');
  G.res.meds += 2 * perkLevel('medicine');

  const roles = ['farmer', 'worker', 'worker', 'guard'];
  if (civ.start.settler) roles.push(civ.start.settler);
  if (hasPerk('fifth')) roles.push('worker');
  const spots = openAround(camp.x, camp.y, roles.length);
  roles.forEach((r, i) => {
    const p = spots[i] || camp;
    G.settlers.push(makeSettler(p.x, p.y, r));
  });
  updatePeak();

  addLog(`${civ.name} gather around the fire.`, '#e8d8a0');
  addLog('Grow food and build walls — raiders roam these lands.', '#b8b2a0');
  addLog('Keys: b build · t chop · m mine · g forage · w world · ? help', '#7a8a9a');
}
