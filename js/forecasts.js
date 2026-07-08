// Raid and food forecasts surfaced to the UI.
import { G } from './state.js';
import { SEASON_LEN } from './data.js';
import { isWinter, isHordeDay } from './seasons.js';

export function raidEstimate(day = G.day) {
  const horde = isHordeDay(day);
  const uncleared = G.world ? G.world.locs.filter(l => l.type === 'bandits' && !l.cleared).length : 0;
  let n = 2 + Math.floor((day - 2) / 3) - Math.floor(G.banditsCleared / 2);
  if (day >= 8) n += Math.min(3, uncleared);
  if (isWinter()) n = Math.max(2, n - 2);
  if (G.beaconDay) n += 2;
  const cap = day > 20 ? 10 + Math.floor((day - 20) / 4) : 10;
  n = Math.max(2, Math.min(cap, n));
  if (horde) n = Math.max(n + 3, 4 + Math.floor(day / 3)) + 1;
  return { n, horde };
}

export function tonightInfo() {
  if (G.raidActive) {
    return { label: G.raidIsHorde ? '☠ THE HORDE IS HERE' : '⚠ RAID UNDERWAY', fg: '#ff5040', urgent: true };
  }
  const today = G.day >= G.raidNext || isHordeDay(G.day);
  if (today) {
    const e = raidEstimate(G.day);
    return e.horde
      ? { label: `☠ tonight: HORDE ~${e.n}`, fg: '#ff4060', urgent: true }
      : { label: `⚠ tonight: raid ~${e.n}`, fg: '#e0a040', urgent: true };
  }
  if (G.day + 1 >= G.raidNext || isHordeDay(G.day + 1)) {
    return { label: '☾ quiet · war-drums tmrw', fg: '#e0c060' };
  }
  return { label: `☾ tonight: quiet (~${Math.max(1, G.raidNext - G.day)}d)`, fg: '#8a94a2' };
}

export function foodInfo() {
  let burn = 0;
  for (const s of G.settlers) {
    if (s.away) continue;
    burn += 0.075 * (s.trait === 'glutton' ? 1.5 : 1) * (isWinter() ? 1.25 : 1);
  }
  const perDay = burn * 1440 / 46;
  const stock = G.res.food + G.res.meals * (65 / 46);
  const winterNeed = Math.ceil(G.settlers.length * 0.075 * 1.25 * 1440 / 46 * SEASON_LEN);
  return { perDay, days: perDay > 0 ? stock / perDay : 99, stock, winterNeed };
}
