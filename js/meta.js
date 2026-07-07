// Persistent meta-progression: legacy points earned per run, spent on perks.
// Survives across runs via localStorage. `owned` lists perk ids, repeated
// once per level for repeatable perks. `life` accumulates lifetime totals
// that gate civ unlocks.
import { PERKS, CIV_UNLOCKS } from './data.js';

const KEY = 'hearthfall.meta';

function load() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY));
    if (d && typeof d.points === 'number') {
      return {
        points: d.points, owned: d.owned || [], runs: d.runs || 0, bestDays: d.bestDays || 0,
        wins: d.wins || 0,
        life: { days: 0, raids: 0, sites: 0, kills: 0, ...(d.life || {}) },
      };
    }
  } catch (e) { /* corrupted meta: start fresh */ }
  return { points: 0, owned: [], runs: 0, bestDays: 0, wins: 0, life: { days: 0, raids: 0, sites: 0, kills: 0 } };
}

export const META = load();

export function saveMeta() {
  try { localStorage.setItem(KEY, JSON.stringify(META)); } catch (e) { /* private mode etc. */ }
}

export const perkLevel = (id) => META.owned.filter(x => x === id).length;
export const hasPerk = (id) => perkLevel(id) > 0;

export function buyPerk(id) {
  const p = PERKS.find(p => p.id === id);
  if (!p || perkLevel(id) >= (p.max || 1) || META.points < p.cost) return false;
  META.points -= p.cost;
  META.owned.push(id);
  saveMeta();
  return true;
}

export function addPoints(n) {
  META.points += n;
  saveMeta();
}

export const civUnlocked = (id) => !CIV_UNLOCKS[id] || CIV_UNLOCKS[id].check(META);

// End-of-run scoring: base points from the run's shape, plus named feat
// bonuses. Returns { pts, bonuses: [[label, pts], ...] } for the epitaph.
export function endRun(stats, days, opts = {}) {
  let pts = Math.max(1, days + 2 * stats.raids + 2 * stats.sites + Math.floor(stats.peak / 2) + Math.floor(stats.kills / 3));
  const bonuses = [];
  const feat = (cond, label, n) => { if (cond) { bonuses.push([label, n]); pts += n; } };
  feat((stats.winters || 0) >= 1, 'endured winter', 3 * (stats.winters || 0));
  feat((stats.hordes || 0) >= 1, 'broke a horde', 4 * (stats.hordes || 0));
  feat((stats.warlords || 0) >= 1, 'slew a warlord', 3 * (stats.warlords || 0));
  feat((stats.bandits || 0) >= 3, 'scourge of bandits', 3);
  feat(stats.peak >= 12, 'a true commune', 3);
  feat(opts.win, 'THE BEACON HELD', 25);
  if (hasPerk('ledger')) pts = Math.round(pts * 1.25);
  META.points += pts;
  META.runs++;
  META.bestDays = Math.max(META.bestDays, days);
  if (opts.win) META.wins++;
  META.life.days += days;
  META.life.raids += stats.raids;
  META.life.sites += stats.sites;
  META.life.kills += stats.kills;
  saveMeta();
  return { pts, bonuses };
}
