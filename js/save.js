// Versioned run persistence — only sim state crosses the boundary.
import { choice } from './rng.js';
import { MAP_W, MAP_H, VIEW_W, VIEW_H, TRAITS } from './data.js';
import { G, makeState } from './state.js';

const SAVE_KEY = 'hearthfall.save';
const SAVE_VERSION = 1;

const EPHEMERAL = ['buildSel', 'notice', 'tip', 'sel', 'party', 'partyOpen', 'screen', 'help', 'intro',
  'menuSel', 'civSel', 'perkSel', 'tradeSel', 'buildFocus', 'partySel', 'selLoc'];

function toSaveData() {
  const { settlers, raiders, expeditions, tiles, log, moraleEvents, craftQueue, res, stats, mods,
    civ, camp, world, usedNames, day, min, speed, paused, gameOver, victory, legacyEarned, bonusLines,
    objIdx, objFlash, morale, beaconDay, alarm, recruitDays,
    mode: _mode, cam, raidNext, raidActive, raidTimer,
    raidIsHorde, banditsCleared, trader, nextId } = G;
  void _mode;
  return {
    version: SAVE_VERSION,
    civ, mods, stats, objIdx, objFlash,
    day, min, speed, paused, gameOver, victory, legacyEarned, bonusLines,
    tiles, camp, cam, res, settlers, raiders, log, morale, moraleEvents, beaconDay,
    alarm, recruitDays, raidNext, raidActive, raidTimer, raidIsHorde, banditsCleared,
    world, expeditions, craftQueue, trader, nextId,
    usedNames: [...usedNames],
    mode: 'NORMAL', cursor: { x: -1, y: -1 },
  };
}

function migrate(d) {
  if (!d.version) {
    for (const k of EPHEMERAL) delete d[k];
    d.usedNames = new Set(d.usedNames || []);
    for (const s of d.settlers || []) {
      if (!s.trait) s.trait = choice(Object.keys(TRAITS));
      if (s.downed === undefined) s.downed = false;
    }
    for (const tl of d.tiles || []) {
      if (tl.t === 'bed') { tl.t = 'tent'; tl.hp = 30; }
      if (tl.t === 'floor') tl.t = 'dirt';
      if (tl.build) {
        if (tl.build.id === 'bed') tl.build.id = 'tent';
        if (tl.build.id === 'floor') delete tl.build;
      }
      if (tl.sleeper !== undefined) { tl.sleepers = [tl.sleeper]; delete tl.sleeper; }
    }
    for (const e of d.expeditions || []) {
      if (e.power == null && e.party) e.power = e.party.reduce((a, m) => a + 4 + m.hp * 0.25 + (m.role === 'guard' ? 3 : 0), 0);
    }
    d.version = SAVE_VERSION;
  }
  if (!d.cam || typeof d.cam.x !== 'number') {
    const cx = d.camp ? d.camp.x : 0, cy = d.camp ? d.camp.y : 0;
    d.cam = {
      x: Math.max(0, Math.min(MAP_W - VIEW_W, Math.round(cx - VIEW_W / 2))),
      y: Math.max(0, Math.min(MAP_H - VIEW_H, Math.round(cy - VIEW_H / 2))),
    };
  }
  d.stats = { ...makeState().stats, ...(d.stats || {}) };
  d.mods = { ...makeState().mods, ...(d.mods || {}) };
  d.buildSel = null; d.notice = null; d.tip = null; d.sel = null;
  if (!(d.usedNames instanceof Set)) d.usedNames = new Set(d.usedNames || []);
  return d;
}

export function hasSave() {
  try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; }
}

export function clearSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ }
}

export function save() {
  if (!G.tiles || G.gameOver) return;
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(toSaveData())); } catch (e) { /* ignore */ }
}

export function loadGame() {
  try {
    const raw = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (!raw || !raw.tiles) return false;
    if (raw.tiles.length !== MAP_W * MAP_H) return false;
    const d = migrate(raw);
    Object.assign(G, makeState(), d);
    return true;
  } catch (e) { return false; }
}
