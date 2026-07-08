import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const store = {};
vi.stubGlobal('localStorage', {
  getItem: (k) => store[k] ?? null,
  setItem: (k, v) => { store[k] = v; },
  removeItem: (k) => { delete store[k]; },
});
vi.stubGlobal('performance', { now: () => 1000 });

const rng = await import('../js/rng.js');
const { G, makeState } = await import('../js/state.js');
const { findPath, mdist } = await import('../js/path.js');
const { raidEstimate } = await import('../js/forecasts.js');
const { spawnRaid } = await import('../js/raiders.js');
const { tickWorld, startExpedition } = await import('../js/world.js');
const { makeSettler } = await import('../js/settlers.js');

function grassTiles() {
  return new Array(140 * 96).fill(null).map(() => ({ t: 'grass' }));
}

function tile(x, y, t, extra = {}) {
  G.tiles[y * 140 + x] = { t, ...extra };
}

describe('findPath', () => {
  beforeEach(() => {
    Object.assign(G, makeState());
    G.tiles = grassTiles();
  });

  it('routes around walls', () => {
    for (let y = 0; y < 10; y++) tile(5, y, 'wall_w', { hp: 60 });
    const path = findPath(1, 5, 9, 5);
    expect(path).not.toBeNull();
    expect(path[path.length - 1]).toEqual({ x: 9, y: 5 });
    expect(path.some(p => p.x === 5 && p.y < 10)).toBe(false);
  });

  it('returns null when boxed in', () => {
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      tile(5 + dx, 5 + dy, 'wall_w', { hp: 60 });
    }
    expect(findPath(5, 5, 20, 20)).toBeNull();
  });

  it('honors noDoor', () => {
    tile(3, 5, 'door', { hp: 40 });
    expect(findPath(1, 5, 3, 5, { noDoor: true })).toBeNull();
    expect(findPath(1, 5, 2, 5, { noDoor: true })).not.toBeNull();
  });

  it('lets raiders stand on wall tiles', () => {
    tile(2, 5, 'wall_w', { hp: 60 });
    expect(findPath(1, 5, 2, 5)).toBeNull();
    expect(findPath(1, 5, 2, 5, { raider: true })).toEqual([{ x: 2, y: 5 }]);
  });

  it('finds adjacent goals and empty paths at the start', () => {
    expect(findPath(5, 5, 5, 5)).toEqual([]);
    const path = findPath(5, 5, 7, 5, { adjacent: true });
    expect(path).toEqual([{ x: 6, y: 5 }]);
  });
});

describe('mdist', () => {
  it('is Manhattan distance', () => {
    expect(mdist(0, 0, 3, 4)).toBe(7);
  });
});

describe('raidEstimate', () => {
  beforeEach(() => {
    Object.assign(G, makeState());
    G.banditsCleared = 0;
    G.beaconDay = 0;
    G.world = { locs: [] };
  });

  it('floors at 2 and caps growth', () => {
    expect(raidEstimate(1).n).toBeGreaterThanOrEqual(2);
    const late = raidEstimate(40);
    expect(late.n).toBeLessThanOrEqual(10 + Math.floor((40 - 20) / 4));
  });

  it('adds horde headroom on horde days', () => {
    const normal = raidEstimate(11);
    const horde = raidEstimate(12);
    expect(horde.horde).toBe(true);
    expect(horde.n).toBeGreaterThan(normal.n);
  });

  it('counts uncleared bandit camps after day 8', () => {
    G.world.locs = [
      { type: 'bandits', cleared: false },
      { type: 'bandits', cleared: false },
    ];
    G.day = 10;
    const withCamps = raidEstimate(10).n;
    G.world.locs = [];
    const without = raidEstimate(10).n;
    expect(withCamps).toBeGreaterThan(without);
  });
});

describe('spawnRaid', () => {
  beforeEach(() => {
    Object.assign(G, makeState());
    G.tiles = grassTiles();
    G.day = 5;
    G.raidNext = 5;
    G.world = { locs: [] };
    vi.spyOn(rng, 'rint').mockImplementation((a, b) => a);
    vi.spyOn(rng, 'choice').mockImplementation((arr) => arr[0]);
    vi.spyOn(rng, 'chance').mockReturnValue(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('activates a raid with raiders on walkable edges', () => {
    spawnRaid();
    expect(G.raidActive).toBe(true);
    expect(G.raiders.length).toBeGreaterThanOrEqual(2);
    expect(G.raidTimer).toBeGreaterThan(0);
  });
});

describe('expedition resolution', () => {
  beforeEach(() => {
    Object.assign(G, makeState());
    G.tiles = grassTiles();
    G.camp = { x: 10, y: 10 };
    G.world = {
      locs: [{
        name: 'Old Cache', type: 'cache', diff: 1, travel: 30,
        cleared: false, scouted: false, x: 2, y: 2,
      }],
    };
    const a = makeSettler(10, 10, 'guard');
    const b = makeSettler(10, 10, 'worker');
    a.hp = 30; b.hp = 30;
    G.settlers = [a, b];
    vi.spyOn(rng, 'rnd').mockReturnValue(0.5);
    vi.spyOn(rng, 'rint').mockImplementation((a) => a);
    vi.spyOn(rng, 'chance').mockReturnValue(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('clears a site and increments stats on success', () => {
    startExpedition(0, [G.settlers[0].id, G.settlers[1].id]);
    const e = G.expeditions[0];
    e.t = 1;
    e.power = 50;
    tickWorld();
    expect(G.world.locs[0].cleared).toBe(true);
    expect(G.stats.sites).toBe(1);
    expect(e.phase).toBe('back');
    expect(e.loot).toBeTruthy();
  });
});
