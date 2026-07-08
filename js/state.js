// Global run state — the single source of truth for simulation data.
import { MAP_W, MAP_H, T } from './data.js';

export function makeState() {
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
