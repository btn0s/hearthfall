import { describe, it, expect, beforeEach, vi } from 'vitest';

const store = {};
vi.stubGlobal('localStorage', {
  getItem: (k) => store[k] ?? null,
  setItem: (k, v) => { store[k] = v; },
  removeItem: (k) => { delete store[k]; },
});
vi.stubGlobal('performance', { now: () => 1000 });

const { G, makeState } = await import('../js/state.js');
const { save, loadGame, clearSave } = await import('../js/save.js');
const { MAP_W, MAP_H } = await import('../js/data.js');

const blankTiles = () => new Array(MAP_W * MAP_H).fill(null).map(() => ({ t: 'grass' }));

describe('save/load', () => {
  beforeEach(() => {
    clearSave();
    Object.assign(G, makeState());
    G.tiles = blankTiles();
    G.civ = 'hearth';
  });

  it('round-trips deep state including usedNames Set', () => {
    G.settlers = [{
      id: 1, name: 'Ash', role: 'guard', trait: 'brave', hp: 20, x: 3, y: 4, downed: false, away: false,
    }];
    G.usedNames = new Set(['Ash']);
    G.res.food = 7;
    G.res.coin = 9;
    G.craftQueue = ['c_spear'];
    G.day = 9;
    save();
    G.res.food = 0;
    G.usedNames = new Set();
    G.settlers = [];
    expect(loadGame()).toBe(true);
    expect(G.res.food).toBe(7);
    expect(G.res.coin).toBe(9);
    expect(G.settlers[0].name).toBe('Ash');
    expect(G.settlers[0].trait).toBe('brave');
    expect(G.craftQueue).toEqual(['c_spear']);
    expect(G.usedNames instanceof Set).toBe(true);
    expect(G.usedNames.has('Ash')).toBe(true);
  });

  it('migrates versionless saves', () => {
    const tiles = blankTiles();
    tiles[0] = { t: 'bed', hp: 30, sleeper: 1 };
    tiles[1] = { t: 'floor' };
    store['hearthfall.save'] = JSON.stringify({
      day: 3,
      camp: { x: 5, y: 5 },
      tiles,
      settlers: [{ id: 1, name: 'Old', role: 'worker', hp: 20, x: 1, y: 1 }],
      stats: { raids: 2 },
      mods: { crop: 1.25 },
      usedNames: ['Old'],
      sel: { ax: 1, ay: 1, bx: 2, by: 2 },
    });
    expect(loadGame()).toBe(true);
    expect(G.tiles[0].t).toBe('tent');
    expect(G.tiles[0].sleepers).toEqual([1]);
    expect(G.tiles[0].sleeper).toBeUndefined();
    expect(G.tiles[1].t).toBe('dirt');
    expect(G.settlers[0].trait).toBeTruthy();
    expect(G.settlers[0].downed).toBe(false);
    expect(G.stats.raids).toBe(2);
    expect(G.stats.kills).toBe(0);
    expect(G.mods.crop).toBe(1.25);
    expect(G.mods.expPower).toBe(1);
    expect(G.sel).toBeNull();
  });

  it('rejects corrupt or wrong-sized saves', () => {
    store['hearthfall.save'] = '{not json';
    expect(loadGame()).toBe(false);
    store['hearthfall.save'] = JSON.stringify({ tiles: new Array(10).fill({ t: 'grass' }) });
    expect(loadGame()).toBe(false);
  });

  it('backfills missing stats and mods keys on version-1 saves', () => {
    G.day = 4;
    save();
    const raw = JSON.parse(store['hearthfall.save']);
    delete raw.stats.kills;
    delete raw.mods.expPower;
    store['hearthfall.save'] = JSON.stringify(raw);
    expect(loadGame()).toBe(true);
    expect(G.stats.kills).toBe(0);
    expect(G.mods.expPower).toBe(1);
  });
});
