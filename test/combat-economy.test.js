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
const { woundSettler, tickSettler, makeSettler } = await import('../js/settlers.js');
const { META, saveMeta } = await import('../js/meta.js');

function grassTiles() {
  return new Array(140 * 96).fill(null).map(() => ({ t: 'grass' }));
}

function baseSettler(overrides = {}) {
  return {
    id: 1, name: 'Ash', role: 'worker', trait: 'brave', x: 10, y: 10,
    hp: 20, maxHp: 20, hunger: 30, energy: 80, away: false, downed: false,
    sleeping: false, starving: false, atkcd: 0, failCd: 0, task: null, path: null,
    pathGoal: null, crawlCd: 0, ...overrides,
  };
}

function resetMeta() {
  META.points = 0; META.owned.length = 0; META.runs = 0;
  META.bestDays = 0; META.wins = 0;
  META.life = { days: 0, raids: 0, sites: 0, kills: 0 };
  saveMeta();
}

describe('woundSettler', () => {
  beforeEach(() => {
    resetMeta();
    Object.assign(G, makeState());
    G.tiles = grassTiles();
    G.camp = { x: 10, y: 10 };
    G.settlers = [baseSettler(), baseSettler({ id: 2, name: 'Bex' })];
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('applies damage without downing above zero hp', () => {
    const s = G.settlers[0];
    woundSettler(s, 5, 'hurt');
    expect(s.hp).toBe(15);
    expect(s.downed).toBeFalsy();
  });

  it('downs instead of killing on the coin flip', () => {
    vi.spyOn(rng, 'chance').mockReturnValue(true);
    const s = G.settlers[0];
    woundSettler(s, 20, 'wounded');
    expect(s.downed).toBe(true);
    expect(s.hp).toBe(1);
    expect(G.settlers).toHaveLength(2);
  });

  it('kills when the down coin flip fails', () => {
    vi.spyOn(rng, 'chance').mockReturnValue(false);
    const s = G.settlers[0];
    woundSettler(s, 20, 'slain');
    expect(G.settlers).toHaveLength(1);
    expect(G.settlers[0].id).toBe(2);
  });
});

describe('hitRaider via tickSettler', () => {
  beforeEach(() => {
    resetMeta();
    Object.assign(G, makeState());
    G.tiles = grassTiles();
    G.camp = { x: 10, y: 10 };
    G.stats.kills = 0;
    G.stats.warlords = 0;
    vi.spyOn(rng, 'rint').mockImplementation((a) => a);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('removes a slain raider and increments kills', () => {
    const s = baseSettler({ role: 'guard', atkcd: 0 });
    G.settlers = [s];
    G.raiders = [{ id: 99, type: 'raider', x: 11, y: 10, hp: 1, atkcd: 0 }];
    tickSettler(s);
    expect(G.raiders).toHaveLength(0);
    expect(G.stats.kills).toBe(1);
  });

  it('breaks the horde when a warlord falls', () => {
    const s = baseSettler({ role: 'guard', atkcd: 0 });
    G.settlers = [s];
    G.raiders = [
      { id: 98, type: 'raider', x: 12, y: 10, hp: 20, atkcd: 0 },
      { id: 99, type: 'warlord', x: 11, y: 10, hp: 1, atkcd: 0, name: 'Grim' },
    ];
    tickSettler(s);
    expect(G.stats.warlords).toBe(1);
    expect(G.raiders.some(r => r.type === 'warlord')).toBe(false);
    expect(G.raiders.every(r => r.fleeing)).toBe(true);
  });
});

describe('hunger and eating', () => {
  beforeEach(() => {
    resetMeta();
    Object.assign(G, makeState());
    G.tiles = grassTiles();
    G.camp = { x: 10, y: 10 };
    G.day = 1;
    G.min = 600; // daytime, not winter (season 0)
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('increases hunger each tick', () => {
    const s = baseSettler({ hunger: 10 });
    G.settlers = [s];
    tickSettler(s);
    expect(s.hunger).toBeCloseTo(10.075);
  });

  it('prefers meals over raw food when hungry', () => {
    const s = baseSettler({ hunger: 80 });
    G.settlers = [s];
    G.res.meals = 1;
    G.res.food = 5;
    tickSettler(s);
    expect(G.res.meals).toBe(0);
    expect(G.res.food).toBe(5);
    expect(s.hunger).toBeCloseTo(15.075);
  });

  it('eats raw food when no meals remain', () => {
    const s = baseSettler({ hunger: 80 });
    G.settlers = [s];
    G.res.meals = 0;
    G.res.food = 3;
    tickSettler(s);
    expect(G.res.food).toBe(2);
    expect(s.hunger).toBeCloseTo(34.075);
  });

  it('damages hp and flags starving at max hunger', () => {
    const s = baseSettler({ hunger: 99.95, hp: 20 });
    G.settlers = [s, baseSettler({ id: 2 })];
    G.res.food = 0;
    G.res.meals = 0;
    tickSettler(s);
    expect(s.hunger).toBe(100);
    expect(s.starving).toBe(true);
    expect(s.hp).toBeLessThan(20);
  });
});
