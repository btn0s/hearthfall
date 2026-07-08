// Commune log, notices, and morale.
import { G } from './state.js';
import { timeStr } from './seasons.js';

export function bumpMorale(n, why) {
  G.morale = Math.max(0, Math.min(100, G.morale + n));
  if (why && Math.abs(n) >= 3) {
    G.moraleEvents.push({ day: G.day, why, n });
    if (G.moraleEvents.length > 6) G.moraleEvents.shift();
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
  G.morale >= 75 ? 'high' : G.morale >= 50 ? 'steady' : G.morale >= 35 ? 'low' : 'BREAKING';

export const moraleWorkMult = () => G.morale >= 75 ? 1.15 : G.morale < 35 ? 0.8 : 1;
