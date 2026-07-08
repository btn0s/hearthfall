import { G } from './state.js';
import { addLog } from './journal.js';
import { endRun } from './meta.js';
import { clearSave } from './save.js';

export function communeFallen() {
  if (G.gameOver) return;
  G.gameOver = true;
  addLog('The commune has fallen.', '#e05040');
  G.stats.bandits = G.banditsCleared;
  const r = endRun(G.stats, G.day, { win: false });
  G.legacyEarned = r.pts; G.bonusLines = r.bonuses;
  clearSave();
}

export function communeAscended() {
  if (G.gameOver) return;
  G.gameOver = true; G.victory = true;
  addLog('☼ The Beacon held. Your people pass into legend.', '#ffe060');
  G.stats.bandits = G.banditsCleared;
  const r = endRun(G.stats, G.day, { win: true });
  G.legacyEarned = r.pts; G.bonusLines = r.bonuses;
  clearSave();
}
