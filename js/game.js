// Core simulation orchestration: tick loop, building, trade, objectives, counsel.
import { rint, choice, chance } from './rng.js';
import {
  MAP_W, MAP_H, VIEW_W, VIEW_H, CIVS, TRADE, OBJECTIVES, CRAFTS, SEASON_LEN, ELDERS, ELDER_IDLE,
} from './data.js';
import { genMap } from './map.js';
import { hasPerk, perkLevel, addPoints } from './meta.js';
import { G, makeState, inMap, tileAt, walkable } from './state.js';
export { G, makeState, inMap, tileAt, walkable } from './state.js';
export { hasSave, clearSave, save, loadGame } from './save.js';
export { findPath, mdist } from './path.js';
export { timeStr, isNight, season, seasonIdx, isWinter, daysToWinter, isHordeDay } from './seasons.js';
export { bumpMorale, addLog, notice, moraleLabel } from './journal.js';
export { structMax, structDamaged, buildDef } from './structures.js';
export { raidEstimate, tonightInfo, foodInfo } from './forecasts.js';
export { communeFallen, communeAscended } from './run-end.js';
export { tip } from './onboard.js';
export {
  makeSettler, traitName, toggleAlarm, releaseTask, insideHouse, housingCap, woundSettler,
  settlerActive, settlersPresent, settlersAvailable, homeAtDusk, cycleRole, tickSettlers,
} from './settlers.js';
export { spawnRaid, tickRaiders } from './raiders.js';
export { ignite } from './fire.js';

import { bumpMorale, addLog, notice } from './journal.js';
import { structDamaged, buildDef } from './structures.js';
import { isWinter, isHordeDay, isNight, season, daysToWinter } from './seasons.js';
import { tonightInfo, foodInfo } from './forecasts.js';
import { communeFallen, communeAscended } from './run-end.js';
import { tip } from './onboard.js';
import {
  makeSettler, traitName, releaseTask, insideHouse, housingCap, tickSettlers, settlersPresent, settlerActive,
} from './settlers.js';
import { spawnRaid, tickRaiders } from './raiders.js';
import { fireTick } from './fire.js';

export const communeTier = () => G.settlers.length >= 9 ? 3 : G.settlers.length >= 6 ? 2 : 1;

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

export function centerCam(x, y) {
  G.cam.x = Math.max(0, Math.min(MAP_W - VIEW_W, Math.round(x - VIEW_W / 2)));
  G.cam.y = Math.max(0, Math.min(MAP_H - VIEW_H, Math.round(y - VIEW_H / 2)));
}

export function updatePeak() {
  G.stats.peak = Math.max(G.stats.peak, G.settlers.length);
  if (G.settlers.length >= 6) tip('tier2');
}

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

export function recruitEligible() {
  const pop = G.settlers.length;
  return G.day > 2 && pop < 16 && !isWinter() && G.res.food + G.res.meals > pop * 3
    && housingCap() > pop && G.morale >= 35;
}

export function recruitBlocker() {
  const pop = G.settlers.length;
  if (pop >= 16) return 'the commune is full';
  if (isWinter()) return 'no one travels in winter';
  if (G.res.food + G.res.meals <= pop * 3) return 'not enough food on the fire';
  if (housingCap() <= pop) return 'no roof to offer';
  if (G.morale < 35) return 'word of misery spreads';
  return null;
}

// Commune-side dawn events (world growth + save happen in onDawn).
export function communeDawn() {
  addLog(`— Day ${G.day} —`, '#7a8a9a');
  if (G.alarm) { G.alarm = false; addLog('Dawn sounds the all-clear — back to the fields.', '#8ad080'); }
  G.moraleEvents = G.moraleEvents.filter(e => e.day >= G.day - 4);
  if (G.beaconDay && G.day >= G.beaconDay + 3) { communeAscended(); return; }
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
  if (G.morale < 35) tip('morale');
  if (G.morale < 25 && pop >= 3 && chance(0.6)) {
    const cands = settlersPresent();
    if (cands.length) {
      const s = choice(cands);
      const food = Math.min(G.res.food, 5), coin = Math.min(G.res.coin, 3);
      G.res.food -= food; G.res.coin -= coin;
      releaseTask(s);
      G.settlers = G.settlers.filter(x => x !== s);
      addLog(`☹ ${s.name} deserted in the night, taking ${food} food${coin ? ` and ${coin} coin` : ''}.`, '#e08040');
      if (!G.settlers.length) { communeFallen(); return; }
    }
  }
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
      G.recruitDays = G.morale >= 75 ? 1 : 2;
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

// Elder speaks tutorial objectives only through the first raid; sidebar keeps the chain.
const ELDER_OBJECTIVE_LIMIT = OBJECTIVES.findIndex(o => o.id === 'raid');

export function igniteBeacon() {
  if (G.beaconDay) return false;
  if (!G.tiles.some(tl => tl.t === 'beacon')) { notice('Build the Beacon first'); return false; }
  G.beaconDay = G.day;
  bumpMorale(20, 'the Beacon lit');
  G.raidNext = Math.min(G.raidNext, G.day + 1);
  addLog('☼ THE BEACON IS LIT! Every eye for miles turns this way.', '#ffe060');
  addLog('Raids intensify (+2) — hold the commune 3 days for victory.', '#ffe060');
  tip('beacon');
  return true;
}

const elderCache = { stamp: -1, val: null };
export function elderCounsel() {
  const stamp = G.day * 1440 + G.min;
  if (elderCache.stamp === stamp && elderCache.val) return elderCache.val;
  elderCache.stamp = stamp;
  const name = ELDERS[G.civ] || 'The Elder';
  const mk = (text, mood = 'calm', prog = null) => (elderCache.val = { name, text, mood, prog });

  const rules = [
    () => G.raidActive && mk(G.raidIsHorde ? 'Fell the warlord and the horde breaks!' : 'Hold the line! Guards, to the walls!', 'alarm'),
    () => { const s = G.settlers.find(x => x.starving && settlerActive(x)); return s && mk(`${s.name} is starving. Harvest, cook, or trade — now.`, 'alarm'); },
    () => {
      if (G.objIdx >= OBJECTIVES.length || G.objIdx > ELDER_OBJECTIVE_LIMIT) return null;
      const o = OBJECTIVES[G.objIdx];
      return mk(`${o.text} — ${o.hint}`, tonightInfo().urgent ? 'wary' : 'calm', o.prog ? o.prog(G) : null);
    },
    () => {
      const tn = tonightInfo();
      if (!tn.urgent) return null;
      const guards = G.settlers.filter(s => s.role === 'guard' && settlerActive(s)).length;
      const dmg = countDamaged();
      if (!guards) return mk('War at dusk and no spears raised! Make guards of someone.', 'alarm');
      if (dmg.walls) return mk(`War at dusk, ${dmg.walls} wall${dmg.walls > 1 ? 's' : ''} still scarred. The bell (r) waits.`, 'alarm');
      return mk('They come at dusk. Ring the bell (r), gather early.', 'wary');
    },
    () => { const d = G.settlers.find(s => s.downed); return d && mk(`${d.name} lies wounded. Keep them safe as they crawl home.`, 'wary'); },
    () => { const fi = foodInfo(); return fi.days < 3 && mk(`The larder empties in ${Math.max(1, Math.ceil(fi.days))} days. Harvest, fish, or trade.`, 'alarm'); },
    () => {
      const fi = foodInfo();
      return season().id === 'autumn' && fi.stock < fi.winterNeed
        && mk(`Winter will want ~${fi.winterNeed} food. We hold ${Math.round(fi.stock)}. Stockpile.`, 'wary');
    },
    () => G.morale < 35 && mk(`Hearts are breaking — ${moraleWhy() || 'a long, hard road'}.`, 'wary'),
    () => recruitBlocker() === 'no roof to offer' && mk('Wanderers pass us by — no roof to offer. Raise a tent.', 'calm'),
    () => {
      const camp = G.world && G.world.locs.find(l => l.type === 'bandits' && !l.cleared && l.diff >= 12);
      return camp && G.day >= 6 && mk(`${camp.name} grows bolder each day it stands. Burn it out.`, 'wary');
    },
    () => { const dmg = countDamaged(); return dmg.total >= 3 && mk(`${dmg.total} structures bear scars. The crews will mend them.`, 'calm'); },
    () => communeTier() >= 3 && !G.beaconDay && G.tiles.some(tl => tl.t === 'beacon')
      && mk('The Beacon awaits your word — click it when we are ready for what follows.', 'wary'),
    () => communeTier() >= 3 && !G.beaconDay && !G.tiles.some(tl => tl.t === 'beacon' || (tl.build && tl.build.id === 'beacon'))
      && mk('We could raise the Beacon — and end this in light.', 'calm'),
  ];
  for (const rule of rules) {
    const hit = rule();
    if (hit) return hit;
  }
  const idle = ELDER_IDLE[season().id];
  return mk(idle[G.day % idle.length], 'calm');
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

export function tickGame() {
  if (G.gameOver || !G.tiles) return null;
  G.min++;
  let dawn = false;
  if (G.min >= 1440) { G.min = 0; G.day++; }
  if (G.min === 360) dawn = true;
  if (G.gameOver) return { dawn };
  if (G.min === 1150 && (G.day >= G.raidNext || isHordeDay(G.day)) && !G.raidActive) spawnRaid();
  if (G.day === 1 && G.min === 1200) tip('night');
  if (G.min % 15 === 0) checkObjectives();
  traderTick();
  fireTick();
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
  tickSettlers();
  tickRaiders();
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
        addLog('The horde scatters. The warlord is dead or fled.', '#8ad080');
      } else {
        bumpMorale(6, 'raid repelled');
        addLog('The raiders flee into the night.', '#8ad080');
      }
    }
  }
  return { dawn };
}

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
  if (kind === 'forage' && tl.t === 'water') {
    if (tl.desig !== 'fish') { tl.desig = 'fish'; tip('fish'); }
  }
}

export function selBounds(sel = G.sel) {
  if (!sel) return null;
  return {
    x0: Math.max(0, Math.min(sel.ax, sel.bx)), y0: Math.max(0, Math.min(sel.ay, sel.by)),
    x1: Math.min(MAP_W - 1, Math.max(sel.ax, sel.bx)), y1: Math.min(MAP_H - 1, Math.max(sel.ay, sel.by)),
  };
}

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

export function assignArea(b, kind) {
  for (let y = b.y0; y <= b.y1; y++) for (let x = b.x0; x <= b.x1; x++) {
    if (kind === 'all' || kind === 'chop') designate(x, y, 'chop');
    if (kind === 'all' || kind === 'mine') designate(x, y, 'mine');
    if (kind === 'all' || kind === 'forage') designate(x, y, 'forage');
  }
}

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
    if (G.beaconDay && !G.tiles.some(t2 => t2.t === 'beacon')) { G.beaconDay = 0; addLog('The Beacon is dark once more.', '#8a94a2'); }
  }
}

export function queueCraft(def) {
  if (!G.tiles.some(tl => tl.t === 'workshop')) { notice('Build a workshop first (tier II)'); return; }
  if (!pay(def.cost)) { notice('Not enough resources'); return; }
  G.craftQueue.push(def.id);
  notice(`${def.name} queued at the workshop`);
}

export function unqueueCraft() {
  const id = G.craftQueue.pop();
  if (!id) { notice('No orders waiting'); return; }
  const def = CRAFTS.find(c => c.id === id);
  if (def) refund(def.cost);
  notice(`${def ? def.name : 'Order'} cancelled — materials returned`);
}

export function adjustedOffer(i) {
  const o = TRADE[i];
  const d = G.mods.deal;
  const give = { ...o.give }, get = { ...o.get };
  if (get.food && isWinter()) give.coin = Math.ceil(give.coin * 1.6);
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
