// Commune log, notices, and morale.
import { G } from './state.js';
import { BALANCE } from './balance.js';
import { timeStr } from './seasons.js';

export function bumpMorale(n, why) {
  G.morale = Math.max(0, Math.min(100, G.morale + n));
  if (why && Math.abs(n) >= BALANCE.morale.eventMin) {
    G.moraleEvents.push({ day: G.day, why, n });
    if (G.moraleEvents.length > BALANCE.morale.eventCap) G.moraleEvents.shift();
  }
}

export function addLog(text, fg = '#b8b2a0') {
  G.log.push({ text: `[D${G.day} ${timeStr()}] ${text}`, fg });
  if (G.log.length > 80) G.log.shift();
}

export function notice(text) {
  G.notice = { text, until: performance.now() + 1800 };
}

export const moraleLabel = () =>
  G.morale >= BALANCE.morale.high ? 'high'
    : G.morale >= BALANCE.morale.steady ? 'steady'
      : G.morale >= BALANCE.morale.low ? 'low' : 'BREAKING';

export const moraleWorkMult = () =>
  G.morale >= BALANCE.morale.high ? BALANCE.morale.workHigh
    : G.morale < BALANCE.morale.low ? BALANCE.morale.workLow : 1;
