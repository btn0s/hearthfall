// Persistent meta-progression: legacy points earned per run, spent on perks.
// Survives across runs via localStorage.
import { PERKS } from './data.js';

const KEY = 'hearthfall.meta';

function load() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY));
    if (d && typeof d.points === 'number') return { points: d.points, owned: d.owned || [], runs: d.runs || 0, bestDays: d.bestDays || 0 };
  } catch (e) { /* corrupted meta: start fresh */ }
  return { points: 0, owned: [], runs: 0, bestDays: 0 };
}

export const META = load();

export function saveMeta() {
  try { localStorage.setItem(KEY, JSON.stringify(META)); } catch (e) { /* private mode etc. */ }
}

export const hasPerk = (id) => META.owned.includes(id);

export function buyPerk(id) {
  const p = PERKS.find(p => p.id === id);
  if (!p || hasPerk(id) || META.points < p.cost) return false;
  META.points -= p.cost;
  META.owned.push(id);
  saveMeta();
  return true;
}

export function addPoints(n) {
  META.points += n;
  saveMeta();
}

export function endRun(stats, days) {
  const pts = Math.max(1, days + 2 * stats.raids + 2 * stats.sites + Math.floor(stats.peak / 2) + Math.floor(stats.kills / 3));
  META.points += pts;
  META.runs++;
  META.bestDays = Math.max(META.bestDays, days);
  saveMeta();
  return pts;
}
