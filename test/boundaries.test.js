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
const { settlerActive, cycleRole, settlersAvailable } = await import('../js/settlers.js');
const { save, loadGame, hasSave, clearSave } = await import('../js/save.js');
const { partyPower } = await import('../js/world.js');

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
