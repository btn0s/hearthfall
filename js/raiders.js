// Raider AI, raid spawning, and siege behavior.
import { rint, choice, chance } from './rng.js';
import { MAP_W, MAP_H, T, FLAMMABLE, RAIDER_TYPES, WARLORD_NAMES } from './data.js';
import { BALANCE } from './balance.js';
import { G, inMap, tileAt, walkable } from './state.js';
import { findPath, mdist } from './path.js';
import { addLog, bumpMorale } from './journal.js';
import { raidEstimate } from './forecasts.js';
import { ignite } from './fire.js';
import { woundSettler, settlerActive } from './settlers.js';
import { tip } from './onboard.js';

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
function stepRandom(e) {
  const [dx, dy] = choice(DIRS);
  if (walkable(e.x + dx, e.y + dy)) { e.x += dx; e.y += dy; }
}
const nearestLiveSettler = (r) => {
  const up = G.settlers.filter(settlerActive);
  const pool = up.length ? up : G.settlers.filter(s => !s.away && s.hp > 0);
  return pool.reduce((b, s) => (!b || mdist(s.x, s.y, r.x, r.y) < mdist(b.x, b.y, r.x, r.y)) ? s : b, null);
};

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
    r.hp -= BALANCE.raid.trapDmg;
    addLog(`A ${RAIDER_TYPES[r.type].name} stumbled into a spike trap!`, '#e0b050');
    if (chance(BALANCE.raid.trapDestroyChance)) { tl.t = 'dirt'; delete tl.hp; }
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
  if (r.hp < BALANCE.raid.skirmisherFleeHp && !r.loot) { r.fleeing = true; return; }
  if (mdist(r.x, r.y, G.camp.x, G.camp.y) === 1) {
    const food = Math.min(G.res.food, rint(...BALANCE.yields.skirmisherFood));
    const coin = Math.min(G.res.coin, rint(...BALANCE.yields.skirmisherCoin));
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
  if (!r.path || !r.path.length || r.pathAge > BALANCE.raid.skirmisherPathStale) {
    r.path = findPath(r.x, r.y, G.camp.x, G.camp.y, { adjacent: true, noDoor: true });
    r.pathAge = 0;
    if (!r.path) {
      const tgt = nearestLiveSettler(r);
      r.path = tgt ? findPath(r.x, r.y, tgt.x, tgt.y, { adjacent: true, noDoor: true }) : null;
      if (!r.path) { if (chance(BALANCE.raid.skirmisherSkulkChance)) stepRandom(r); return; } // sealed out: skulk
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
      if (!r.litAny || chance(BALANCE.raid.torchLogChance)) addLog(`¡ A torch-bearer set your ${T[tl.t].name} alight!`, '#ff9030');
      r.litAny = true;
      tip('fire');
      r.igniteCd = BALANCE.raid.torchIgniteCd; r.path = null;
      return;
    }
  }
  r.pathAge = (r.pathAge || 0) + 1;
  if (!r.path || !r.path.length || r.pathAge > BALANCE.raid.torcherPathStale) {
    const tgt = nearestBurnable(r);
    r.path = tgt ? findPath(r.x, r.y, tgt.x, tgt.y, { adjacent: true, noDoor: true }) : null;
    r.pathAge = 0;
    if (!r.path) {
      if (chance(BALANCE.raid.torchFleeChance)) r.fleeing = true;
      else if (chance(BALANCE.raid.torchWanderChance)) stepRandom(r);
      return;
    }
  }
  stepRaider(r);
}

function tickRaider(r) {
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
        bumpMorale(BALANCE.morale.goodsStolen, 'goods stolen');
      }
      return;
    }
    if (!r.path || !r.path.length) {
      const ex = r.x < MAP_W / 2 ? 0 : MAP_W - 1;
      r.path = findPath(r.x, r.y, ex, r.y, { raider: true });
      r.fleeT = (r.fleeT || 0) + 1;
      if (!r.path && r.fleeT > BALANCE.raid.fleeTimeout) { G.raiders = G.raiders.filter(x => x !== r); return; }
      if (!r.path) return;
    }
    stepRaider(r);
    return;
  }

  if (r.type === 'skirmisher') return skirmisherBrain(r);
  if (r.type === 'torcher') return torcherBrain(r);

  r.pathAge = (r.pathAge || 0) + 1;
  if (!r.path || !r.path.length || r.pathAge > BALANCE.raid.pathStale) {
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
  const R = BALANCE.raid;
  const types = [];
  for (let i = 0; i < n; i++) {
    let t = 'raider';
    if (G.day >= R.bruteFromDay && chance(horde ? R.bruteHordeChance : R.bruteChance)) t = 'brute';
    else if (G.day >= R.skirmisherFromDay && chance(R.skirmisherChance)) t = 'skirmisher';
    else if (G.day >= R.torcherFromDay && chance(R.torcherChance)) t = 'torcher';
    types.push(t);
  }
  return types;
}

export function spawnRaid() {
  // sizing lives in raidEstimate so the sidebar forecast can't drift from truth
  const est = raidEstimate(G.day);
  const horde = est.horde;
  let n = est.n - (horde ? 1 : 0) + rint(0, BALANCE.raid.jitterMax); // warlord spawns separately; small jitter

  const twoFront = horde || (G.day >= BALANCE.raid.twoFrontFromDay && chance(BALANCE.raid.twoFrontChance));
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
  if (!spots.length) { G.raidNext = G.day + BALANCE.raid.respawnDelayDays; return; }

  const types = raidComposition(spots.length, horde);
  spots.forEach((p, i) => G.raiders.push(makeRaider(p.x, p.y, types[i] || 'raider')));
  if (horde) {
    const w = makeRaider(spots[0].x, spots[0].y, 'warlord');
    w.name = choice(WARLORD_NAMES);
    G.raiders.push(w);
    G.raidIsHorde = true;
  }
  G.raidActive = true;
  G.raidTimer = horde ? BALANCE.raid.timerHorde : BALANCE.raid.timerNormal;
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

export function tickRaiders() {
  for (const r of [...G.raiders]) tickRaider(r);
}

