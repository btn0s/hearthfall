// One-time contextual tips; the seen-set persists so veterans are not nagged.
import { G } from './state.js';
import { TIPS } from './data.js';

const TIP_KEY = 'hearthfall.tips';
let tipSeen = null;
function tipSeenSet() {
  if (!tipSeen) {
    try { tipSeen = new Set(JSON.parse(localStorage.getItem(TIP_KEY)) || []); }
    catch (e) { tipSeen = new Set(); }
  }
  return tipSeen;
}

export function tip(id) {
  const seen = tipSeenSet();
  if (seen.has(id) || !TIPS[id]) return;
  seen.add(id);
  try { localStorage.setItem(TIP_KEY, JSON.stringify([...seen])); } catch (e) { /* ignore */ }
  G.tip = { text: TIPS[id], until: performance.now() + 12000 };
}
