import { describe, it, expect, beforeEach, vi } from 'vitest';

const store = {};
vi.stubGlobal('localStorage', {
  getItem: (k) => store[k] ?? null,
  setItem: (k, v) => { store[k] = v; },
  removeItem: (k) => { delete store[k]; },
});
vi.stubGlobal('performance', { now: () => 1000 });

const { META, endRun, buyPerk, perkLevel, hasPerk, addPoints, civUnlocked } = await import('../js/meta.js');
const { G, makeState } = await import('../js/state.js');
const { communeFallen, communeAscended } = await import('../js/run-end.js');

function resetMeta() {
  META.points = 0; META.owned.length = 0; META.runs = 0;
  META.bestDays = 0; META.wins = 0;
  META.life = { days: 0, raids: 0, sites: 0, kills: 0 };
}

describe('endRun scoring', () => {
  beforeEach(resetMeta);

  it('computes the base formula', () => {
    const r = endRun({ raids: 4, sites: 2, peak: 7, kills: 15, winters: 0, hordes: 0, warlords: 0, bandits: 0 }, 10);
    expect(r.pts).toBe(30);
    expect(r.bonuses).toEqual([]);
    expect(META.points).toBe(30);
    expect(META.runs).toBe(1);
    expect(META.bestDays).toBe(10);
    expect(META.wins).toBe(0);
    expect(META.life).toEqual({ days: 10, raids: 4, sites: 2, kills: 15 });
  });

  it('stacks feat bonuses', () => {
    const r = endRun({
      raids: 4, sites: 2, peak: 12, kills: 15, winters: 2, hordes: 1, warlords: 1, bandits: 3,
    }, 10);
    expect(r.pts).toBe(52);
    expect(r.bonuses).toHaveLength(5);
    expect(r.bonuses.map(([label]) => label)).toEqual([
      'endured winter', 'broke a horde', 'slew a warlord', 'scourge of bandits', 'a true commune',
    ]);
  });

  it('pays 25 for a win and counts it', () => {
    const r = endRun({ raids: 0, sites: 0, peak: 0, kills: 0 }, 1, { win: true });
    expect(r.pts).toBe(26);
    expect(META.wins).toBe(1);
  });

  it('applies ledger multiplier last', () => {
    META.owned.push('ledger');
    const r = endRun({ raids: 0, sites: 0, peak: 0, kills: 0 }, 1, { win: true });
    expect(r.pts).toBe(33);
  });

  it('floors base points at 1', () => {
    const r = endRun({ raids: 0, sites: 0, peak: 0, kills: 0 }, 0);
    expect(r.pts).toBe(1);
  });
});

describe('buyPerk', () => {
  beforeEach(resetMeta);

  it('enforces cost, level cap, and unknown ids', () => {
    META.points = 5;
    expect(buyPerk('larder')).toBe(true);
    expect(perkLevel('larder')).toBe(1);
    expect(META.points).toBe(2);
    expect(buyPerk('larder')).toBe(false);
    addPoints(7);
    expect(buyPerk('larder')).toBe(true);
    expect(buyPerk('larder')).toBe(true);
    expect(perkLevel('larder')).toBe(3);
    expect(buyPerk('larder')).toBe(false);
    expect(buyPerk('nope')).toBe(false);
  });
});

describe('civUnlocked', () => {
  beforeEach(resetMeta);

  it('gates ratcatchers on lifetime sites or runs', () => {
    expect(civUnlocked('tillers')).toBe(true);
    expect(civUnlocked('ratcatchers')).toBe(false);
    META.life.sites = 5;
    expect(civUnlocked('ratcatchers')).toBe(true);
    resetMeta();
    META.runs = 3;
    expect(civUnlocked('ratcatchers')).toBe(true);
  });
});

describe('run-end idempotence', () => {
  beforeEach(() => {
    resetMeta();
    Object.assign(G, makeState());
  });

  it('pays communeFallen only once', () => {
    G.stats.raids = 2;
    G.day = 5;
    G.banditsCleared = 1;
    communeFallen();
    const pts = META.points;
    communeFallen();
    expect(META.runs).toBe(1);
    expect(G.legacyEarned).toBeGreaterThan(0);
    expect(G.stats.bandits).toBe(1);
    expect(META.points).toBe(pts);
  });

  it('pays communeAscended only once', () => {
    G.stats.raids = 2;
    G.day = 5;
    G.banditsCleared = 1;
    communeAscended();
    const pts = META.points;
    const wins = META.wins;
    communeAscended();
    expect(META.runs).toBe(1);
    expect(G.victory).toBe(true);
    expect(META.wins).toBe(1);
    expect(META.wins).toBe(wins);
    expect(META.points).toBe(pts);
  });
});
