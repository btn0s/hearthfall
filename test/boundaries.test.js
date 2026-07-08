import { describe, it, expect, beforeEach, vi } from 'vitest';

// Minimal localStorage for save tests
const store = {};
vi.stubGlobal('localStorage', {
  getItem: (k) => store[k] ?? null,
  setItem: (k, v) => { store[k] = v; },
  removeItem: (k) => { delete store[k]; },
});
vi.stubGlobal('performance', { now: () => 1000 });

const { G, makeState } = await import('../js/state.js');
const { settlerActive, cycleRole, settlersAvailable, homeAtDusk } = await import('../js/settlers.js');
const { save, loadGame, hasSave, clearSave } = await import('../js/save.js');
const { partyPower } = await import('../js/world.js');
const { igniteBeacon, elderCounsel } = await import('../js/game.js');
const { OBJECTIVES } = await import('../js/data.js');

describe('settlerActive', () => {
  it('rejects away and downed settlers', () => {
    expect(settlerActive({ away: false, downed: false })).toBe(true);
    expect(settlerActive({ away: true, downed: false })).toBe(false);
    expect(settlerActive({ away: false, downed: true })).toBe(false);
  });
});

describe('cycleRole', () => {
  beforeEach(() => {
    Object.assign(G, makeState());
    G.tiles = new Array(140 * 96).fill(null).map(() => ({ t: 'grass', walk: true }));
  });

  it('does not change role for away settlers', () => {
    const s = { id: 1, name: 'A', role: 'worker', away: true, downed: false, task: null, path: null, pathGoal: null };
    G.settlers = [s];
    cycleRole(s);
    expect(s.role).toBe('worker');
  });

  it('cycles role for present settlers', () => {
    const s = { id: 1, name: 'A', role: 'worker', away: false, downed: false, task: null, path: null, pathGoal: null };
    G.settlers = [s];
    cycleRole(s);
    expect(s.role).toBe('farmer');
  });
});

describe('save/load', () => {
  beforeEach(() => {
    clearSave();
    Object.assign(G, makeState());
    G.tiles = new Array(140 * 96).fill(null).map(() => ({ t: 'grass' }));
    G.civ = 'hearth';
    G.day = 5;
  });

  it('writes versioned save and reloads', () => {
    save();
    expect(hasSave()).toBe(true);
    const raw = JSON.parse(store['hearthfall.save']);
    expect(raw.version).toBe(1);
    expect(raw.sel).toBeUndefined();
    G.day = 99;
    expect(loadGame()).toBe(true);
    expect(G.day).toBe(5);
  });

  it('round-trips the camera position', () => {
    G.camp = { x: 70, y: 48 };
    G.cam = { x: 33, y: 21 };
    save();
    G.cam = { x: 0, y: 0 };
    expect(loadGame()).toBe(true);
    expect(G.cam).toEqual({ x: 33, y: 21 });
  });

  it('centers the camera on camp for saves without one', () => {
    G.camp = { x: 70, y: 48 };
    save();
    const raw = JSON.parse(store['hearthfall.save']);
    delete raw.cam;
    store['hearthfall.save'] = JSON.stringify(raw);
    expect(loadGame()).toBe(true);
    expect(G.cam.x).toBeGreaterThan(0);   // 70 - 70/2 = 35
    expect(G.cam.y).toBeGreaterThan(0);   // 48 - 38/2 = 29
    expect(G.cam).toEqual({ x: 35, y: 29 });
  });
});

describe('homeAtDusk', () => {
  beforeEach(() => {
    Object.assign(G, makeState());
    G.tiles = new Array(140 * 96).fill(null).map(() => ({ t: 'grass', walk: true }));
  });

  it('counts guards staying home when party launches', () => {
    G.settlers = [
      { id: 1, role: 'guard', away: false, downed: false },
      { id: 2, role: 'guard', away: false, downed: false },
      { id: 3, role: 'worker', away: false, downed: false },
    ];
    expect(homeAtDusk([2]).guards).toBe(1);
    expect(homeAtDusk([2]).others).toBe(1);
  });

  it('excludes settlers already on expedition', () => {
    G.settlers = [
      { id: 1, role: 'guard', away: false, downed: false },
      { id: 2, role: 'worker', away: false, downed: false },
    ];
    G.expeditions = [{ ids: [1], party: [], phase: 'out', t: 100, total: 100 }];
    expect(homeAtDusk().guards).toBe(0);
    expect(homeAtDusk().total).toBe(1);
  });
});

describe('igniteBeacon', () => {
  beforeEach(() => {
    Object.assign(G, makeState());
    G.tiles = new Array(140 * 96).fill(null).map(() => ({ t: 'grass', walk: true }));
    G.tiles[0] = { t: 'beacon', walk: false, hp: 200 };
    G.day = 10;
    G.raidNext = 12;
  });

  it('does not ignite without a built beacon', () => {
    G.tiles[0] = { t: 'grass' };
    expect(igniteBeacon()).toBe(false);
    expect(G.beaconDay).toBe(0);
  });

  it('lights beacon and pulls raid forward', () => {
    expect(igniteBeacon()).toBe(true);
    expect(G.beaconDay).toBe(10);
    expect(G.raidNext).toBe(11);
  });
});

describe('elderCounsel objectives', () => {
  beforeEach(() => {
    Object.assign(G, makeState());
    G.tiles = new Array(140 * 96).fill(null).map(() => ({ t: 'grass', walk: true }));
    G.civ = 'hearth';
  });

  it('speaks tutorial objectives before first raid completes', () => {
    G.objIdx = OBJECTIVES.findIndex(o => o.id === 'raid');
    G.stats.raids = 0;
    expect(elderCounsel().text).toContain('Survive a raid');
  });

  it('stops speaking objectives after first raid', () => {
    G.objIdx = OBJECTIVES.findIndex(o => o.id === 'raid') + 1;
    G.stats.raids = 1;
    G.morale = 65;
    expect(elderCounsel().text).not.toContain('Send a party');
  });
});

describe('partyPower snapshot', () => {
  beforeEach(() => {
    Object.assign(G, makeState());
    G.mods.expPower = 1;
    G.res.weapons = 3;
  });

  it('expedition party snapshot is independent of live role changes', () => {
    const s = { id: 1, role: 'worker', hp: 20, trait: 'brave' };
    const party = [{ id: s.id, role: s.role, hp: s.hp, trait: s.trait }];
    const power = partyPower(party);
    s.role = 'guard';
    expect(partyPower(party)).toBe(power);
    expect(partyPower([{ role: 'guard', hp: 20, trait: 'brave' }])).not.toBe(power);
  });
});
