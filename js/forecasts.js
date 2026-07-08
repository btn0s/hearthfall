// Raid and food forecasts surfaced to the UI.
import { G } from './state.js';
import { SEASON_LEN } from './data.js';
import { BALANCE } from './balance.js';
import { isWinter, isHordeDay } from './seasons.js';

export function raidEstimate(day = G.day) {
  const horde = isHordeDay(day);
  const uncleared = G.world ? G.world.locs.filter(l => l.type === 'bandits' && !l.cleared).length : 0;
  const R = BALANCE.raid;
  let n = R.sizeBase + Math.floor((day - R.sizeDayStart) / R.sizeDayStep) - Math.floor(G.banditsCleared / R.banditReductionDiv);
  if (day >= R.unclearedFromDay) n += Math.min(R.unclearedMax, uncleared);
  if (isWinter()) n = Math.max(R.sizeBase, n - R.winterReduction);
  if (G.beaconDay) n += R.beaconBonus;
  const cap = day > R.capLateFromDay ? R.capEarly + Math.floor((day - R.capLateFromDay) / R.capLateStep) : R.capEarly;
  n = Math.max(R.sizeBase, Math.min(cap, n));
  if (horde) n = Math.max(n + R.hordeBonus, R.hordeFloorBase + Math.floor(day / R.hordeFloorDiv)) + R.warlordExtra;
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
  const H = BALANCE.hunger;
  let burn = 0;
  for (const s of G.settlers) {
    if (s.away) continue;
    burn += H.rate * (s.trait === 'glutton' ? H.gluttonMult : 1) * (isWinter() ? H.winterMult : 1);
  }
  const perDay = burn * BALANCE.time.minutesPerDay / H.foodRelief;
  const stock = G.res.food + G.res.meals * (H.mealRelief / H.foodRelief);
  const winterNeed = Math.ceil(G.settlers.length * H.rate * H.winterMult * BALANCE.time.minutesPerDay / H.foodRelief * SEASON_LEN);
  return { perDay, days: perDay > 0 ? stock / perDay : 99, stock, winterNeed };
}
