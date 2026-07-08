// Settler AI, roles, housing, and combat vs raiders.
import { rint, choice, chance } from './rng.js';
import { MAP_W, MAP_H, T, NAMES, ROLE_ORDER, TRAITS, HOUSES, RAIDER_TYPES } from './data.js';
import { G, tileAt, walkable } from './state.js';
import { findPath, mdist, DIRS } from './path.js';
import { addLog, bumpMorale, moraleWorkMult, notice } from './journal.js';
import { isWinter, isNight } from './seasons.js';
import { structDamaged, structMax, buildDef } from './structures.js';
import { communeFallen } from './run-end.js';
import { hasPerk } from './meta.js';
import { tip } from './onboard.js';

export const settlerActive = (s) => !s.away && !s.downed;
export const settlersPresent = () => G.settlers.filter(settlerActive);
export const settlersAvailable = () => settlersPresent();

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

export function tickSettler(s) {
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

export function tickSettlers() {
  for (const s of [...G.settlers]) tickSettler(s);
}

export function cycleRole(s) {
  if (!settlerActive(s)) return;
  s.role = ROLE_ORDER[(ROLE_ORDER.indexOf(s.role) + 1) % ROLE_ORDER.length];
  releaseTask(s);
  notice(`${s.name} is now a ${s.role}`);
}
