// Input routing for keyboard, mouse, and (via gamepad.js) controllers.
// All keys funnel through handleKey so a gamepad can synthesize them.
import {
  G, inMap, tryPlaceBuild, designate, cancelAt, queueCraft, cycleRole, notice,
  newGame, loadGame, hasSave, doTrade, save, tip, dismissIntro, centerCam,
} from './game.js';
import { MAP_W, MAP_H, VIEW_W, VIEW_H, BUILDS, CIVS, PERKS, TRADE } from './data.js';
import { startExpedition, genWorld } from './world.js';
import { buyPerk } from './meta.js';
import { hit, canvasCell, toggleGfx, toggleMinimap } from './render.js';

const TOOL_MODES = ['NORMAL', 'BUILD', 'CHOP', 'MINE', 'FORAGE', 'CANCEL'];

function beginRun(civId) {
  newGame(civId);
  genWorld();
}

function moveSel(dir) {
  const locs = G.world.locs;
  if (!locs.length) return;
  let i = G.selLoc;
  for (let n = 0; n < locs.length; n++) {
    i = (i + dir + locs.length) % locs.length;
    if (!locs[i].cleared) break;
  }
  G.selLoc = i;
}

function openParty() {
  const loc = G.world.locs[G.selLoc];
  if (!loc || loc.cleared) { notice('That site is already cleared'); return; }
  G.party.clear();
  G.partySel = G.settlers.filter(s => !s.away).length; // focus starts on LAUNCH
  G.partyOpen = true;
}

function launchParty() {
  const ids = [...G.party];
  if (!ids.length) { notice('Pick at least one settler'); return; }
  if (startExpedition(G.selLoc, ids)) {
    G.partyOpen = false;
    G.party.clear();
  }
}

function menuAction(action, arg) {
  if (action === 'new') { G.screen = 'CIV'; G.civSel = 0; }
  else if (action === 'continue') { if (hasSave()) { if (!loadGame()) notice('Save was corrupted'); } }
  else if (action === 'legacy') { G.screen = 'LEGACY'; G.perkSel = 0; }
  else if (action === 'gfx') toggleGfx();
  else if (action === 'help') G.help = true;
  else if (action === 'civ') beginRun(arg);
  else if (action === 'perk') buyPerk(arg);
}

const MENU_ITEMS = ['new', 'continue', 'legacy', 'gfx', 'help'];

export function panCam(dx, dy) {
  G.cam.x = Math.max(0, Math.min(MAP_W - VIEW_W, G.cam.x + dx));
  G.cam.y = Math.max(0, Math.min(MAP_H - VIEW_H, G.cam.y + dy));
}

function moveCursor(dx, dy) {
  if (!inMap(G.cursor.x, G.cursor.y)) {
    G.cursor.x = G.camp.x; G.cursor.y = G.camp.y;
    centerCam(G.camp.x, G.camp.y);
    return;
  }
  G.cursor.x = Math.max(0, Math.min(MAP_W - 1, G.cursor.x + dx));
  G.cursor.y = Math.max(0, Math.min(MAP_H - 1, G.cursor.y + dy));
  // cursor pushes the camera when it nears the viewport edge
  const m = 3;
  if (G.cursor.x < G.cam.x + m) panCam(G.cursor.x - (G.cam.x + m), 0);
  if (G.cursor.x > G.cam.x + VIEW_W - 1 - m) panCam(G.cursor.x - (G.cam.x + VIEW_W - 1 - m), 0);
  if (G.cursor.y < G.cam.y + m) panCam(0, G.cursor.y - (G.cam.y + m));
  if (G.cursor.y > G.cam.y + VIEW_H - 1 - m) panCam(0, G.cursor.y - (G.cam.y + VIEW_H - 1 - m));
}

function actAtCursor() {
  const { x, y } = G.cursor;
  if (!inMap(x, y)) { moveCursor(0, 0); return; }
  paintCell(x, y, false);
}

// which in-game contexts let arrows drive the map cursor
function cursorModes() {
  return G.mode === 'NORMAL' || G.mode === 'CHOP' || G.mode === 'MINE' ||
    G.mode === 'FORAGE' || G.mode === 'CANCEL' || (G.mode === 'BUILD' && G.buildSel);
}

export function handleKey(k, mods = {}) {
  // ---------- title screens ----------
  if (G.screen === 'MENU') {
    if (G.help) { if (['?', 'Escape', 'Enter'].includes(k)) G.help = false; return; }
    if (k === 'ArrowUp') G.menuSel = (G.menuSel + MENU_ITEMS.length - 1) % MENU_ITEMS.length;
    else if (k === 'ArrowDown') G.menuSel = (G.menuSel + 1) % MENU_ITEMS.length;
    else if (k === 'Enter') menuAction(MENU_ITEMS[G.menuSel]);
    else if (k === 'n') menuAction('new');
    else if (k === 'c') menuAction('continue');
    else if (k === 'l') menuAction('legacy');
    else if (k === 'v') menuAction('gfx');
    else if (k === '?') G.help = true;
    return;
  }
  if (G.screen === 'CIV') {
    if (k === 'Escape') { G.screen = 'MENU'; return; }
    if (k === 'ArrowUp') { G.civSel = (G.civSel + CIVS.length - 1) % CIVS.length; return; }
    if (k === 'ArrowDown') { G.civSel = (G.civSel + 1) % CIVS.length; return; }
    if (k === 'Enter') { beginRun(CIVS[G.civSel].id); return; }
    const i = +k - 1;
    if (i >= 0 && i < CIVS.length) beginRun(CIVS[i].id);
    return;
  }
  if (G.screen === 'LEGACY') {
    if (k === 'Escape') { G.screen = 'MENU'; return; }
    if (k === 'ArrowUp') { G.perkSel = (G.perkSel + PERKS.length - 1) % PERKS.length; return; }
    if (k === 'ArrowDown') { G.perkSel = (G.perkSel + 1) % PERKS.length; return; }
    if (k === 'Enter') { buyPerk(PERKS[G.perkSel].id); return; }
    const i = +k - 1;
    if (i >= 0 && i < PERKS.length) buyPerk(PERKS[i].id);
    return;
  }

  // ---------- in-game ----------
  if (G.intro) {
    if (k === 'Enter' || k === 'Escape' || k === ' ') dismissIntro();
    return;
  }
  if (k === 'Escape' && G.tip) G.tip = null; // Esc also clears an open tip
  if (G.gameOver) {
    if (k === 'r' || k === 'R' || k === 'Enter') { G.screen = 'CIV'; G.civSel = 0; }
    if (k === 'm' || k === 'M' || k === 'Escape') G.screen = 'MENU';
    return;
  }
  if (G.help) {
    if (['?', 'Escape', 'Enter'].includes(k)) G.help = false;
    return;
  }
  if (k === '?') { G.help = true; return; }

  // camera panning: shift+arrows (keyboard) or PAN_* (gamepad right stick)
  if (G.mode !== 'WORLD' && G.mode !== 'TRADE') {
    const P = 4;
    if (k === 'PAN_LEFT' || (mods.shift && k === 'ArrowLeft')) { panCam(-P, 0); return; }
    if (k === 'PAN_RIGHT' || (mods.shift && k === 'ArrowRight')) { panCam(P, 0); return; }
    if (k === 'PAN_UP' || (mods.shift && k === 'ArrowUp')) { panCam(0, -P); return; }
    if (k === 'PAN_DOWN' || (mods.shift && k === 'ArrowDown')) { panCam(0, P); return; }
  }

  if (G.mode === 'WORLD') {
    if (G.partyOpen) {
      const avail = G.settlers.filter(s => !s.away);
      if (k === 'Escape') { G.partyOpen = false; return; }
      if (k === 'ArrowUp') { G.partySel = (G.partySel + avail.length) % (avail.length + 1); return; }
      if (k === 'ArrowDown') { G.partySel = (G.partySel + 1) % (avail.length + 1); return; }
      if (/^[1-9]$/.test(k)) {
        const s = avail[+k - 1];
        if (s) { G.party.has(s.id) ? G.party.delete(s.id) : G.party.add(s.id); }
        return;
      }
      if (k === 'Enter') {
        if (G.partySel < avail.length) {
          const s = avail[G.partySel];
          G.party.has(s.id) ? G.party.delete(s.id) : G.party.add(s.id);
        } else launchParty();
      }
      return;
    }
    if (k === 'Escape' || k === 'w') { G.mode = 'NORMAL'; return; }
    if (k === 'ArrowUp') { moveSel(-1); return; }
    if (k === 'ArrowDown') { moveSel(1); return; }
    if (k === 'Enter') openParty();
    if (k === ' ') G.paused = !G.paused;
    return;
  }

  if (G.mode === 'TRADE') {
    if (k === 'Escape' || k === 'e') { G.mode = 'NORMAL'; return; }
    if (k === 'ArrowUp') { G.tradeSel = (G.tradeSel + TRADE.length - 1) % TRADE.length; return; }
    if (k === 'ArrowDown') { G.tradeSel = (G.tradeSel + 1) % TRADE.length; return; }
    if (k === 'Enter') { doTrade(G.tradeSel); return; }
    const i = +k - 1;
    if (i >= 0 && i < TRADE.length) doTrade(i);
    return;
  }

  // build menu: letters always work; arrows navigate the list until an item is picked
  if (G.mode === 'BUILD') {
    if (/^[a-m]$/.test(k)) {
      const def = BUILDS.find(b => b.key === k);
      if (def) {
        if (def.craft) queueCraft(def);
        else G.buildSel = def;
      }
      return;
    }
    if (!G.buildSel) {
      if (k === 'ArrowUp') { G.buildFocus = (G.buildFocus + BUILDS.length - 1) % BUILDS.length; return; }
      if (k === 'ArrowDown') { G.buildFocus = (G.buildFocus + 1) % BUILDS.length; return; }
      if (k === 'Enter') {
        const def = BUILDS[G.buildFocus];
        if (def.craft) queueCraft(def);
        else G.buildSel = def;
        return;
      }
    }
    if (k === 'Escape') {
      if (G.buildSel) G.buildSel = null;
      else G.mode = 'NORMAL';
      return;
    }
  } else if (k === 'Escape') { G.mode = 'NORMAL'; G.buildSel = null; return; }

  if (k === 'Q') { save(); G.screen = 'MENU'; return; } // save & quit to menu
  if (k === ' ') { G.paused = !G.paused; return; }
  if (k === '1' || k === '2' || k === '3') { G.speed = +k; return; }
  if (k === '-') { G.speed = Math.max(1, G.speed - 1); return; }
  if (k === '=' || k === '+') { G.speed = Math.min(3, G.speed + 1); return; }
  if (k === '[' || k === ']') {
    const dir = k === ']' ? 1 : -1;
    const i = TOOL_MODES.indexOf(G.mode);
    G.mode = TOOL_MODES[((i < 0 ? 0 : i) + dir + TOOL_MODES.length) % TOOL_MODES.length];
    G.buildSel = null;
    return;
  }
  if (k === 'v') { toggleGfx(); return; }
  if (k === 'n') { toggleMinimap(); return; }
  if (G.mode !== 'BUILD') {
    if (k === 'b') { G.mode = 'BUILD'; G.buildSel = null; return; }
    if (k === 't') { G.mode = 'CHOP'; return; }
    if (k === 'm') { G.mode = 'MINE'; return; }
    if (k === 'g') { G.mode = 'FORAGE'; return; }
    if (k === 'x') { G.mode = 'CANCEL'; return; }
    if (k === 'e') {
      if (G.trader) { G.mode = 'TRADE'; G.tradeSel = 0; }
      else notice('No trader in camp right now');
      return;
    }
    if (k === 'w') {
      G.mode = 'WORLD'; G.partyOpen = false;
      const firstOpen = G.world.locs.findIndex(l => !l.cleared);
      if (firstOpen >= 0 && G.world.locs[G.selLoc]?.cleared) G.selLoc = firstOpen;
      tip('world');
      return;
    }
  }

  // map cursor (keyboard/gamepad play)
  if (cursorModes()) {
    if (k === 'ArrowUp') { moveCursor(0, -1); return; }
    if (k === 'ArrowDown') { moveCursor(0, 1); return; }
    if (k === 'ArrowLeft') { moveCursor(-1, 0); return; }
    if (k === 'ArrowRight') { moveCursor(1, 0); return; }
    if (k === 'Enter') { actAtCursor(); return; }
  }
}

function paintCell(x, y, isDrag) {
  if (!inMap(x, y)) return;
  if (G.mode === 'BUILD' && G.buildSel) tryPlaceBuild(x, y);
  else if (G.mode === 'CHOP') designate(x, y, 'chop');
  else if (G.mode === 'MINE') designate(x, y, 'mine');
  else if (G.mode === 'FORAGE') designate(x, y, 'forage');
  else if (G.mode === 'CANCEL') { if (!isDrag) cancelAt(x, y); }
  else if (G.mode === 'NORMAL' && !isDrag) {
    if (G.trader && G.trader.x === x && G.trader.y === y) { G.mode = 'TRADE'; G.tradeSel = 0; return; }
    const s = G.settlers.find(s => !s.away && s.x === x && s.y === y);
    if (s) cycleRole(s);
  }
}

function worldClick(c) {
  if (G.partyOpen) {
    const row = hit.party.find(r => r.y === c.cy && c.cx >= r.x0 && c.cx < r.x1);
    if (row) {
      G.party.has(row.id) ? G.party.delete(row.id) : G.party.add(row.id);
      return;
    }
    if (c.cy === hit.partyLaunch) launchParty();
    return;
  }
  const row = hit.worldList.find(r => r.y === c.cy && c.cx >= 55);
  if (row) {
    if (G.selLoc === row.idx) openParty();
    else G.selLoc = row.idx;
  }
}

export function setupInput(canvas) {
  let painting = false;
  let panDrag = null; // middle-button camera drag

  const inMapRegion = (c) => G.screen === 'GAME' && G.mode !== 'WORLD' && c.cx < VIEW_W && c.cy < VIEW_H;
  const toWorld = (c) => ({ x: c.cx + G.cam.x, y: c.cy + G.cam.y });

  window.addEventListener('keydown', e => {
    handleKey(e.key, { shift: e.shiftKey });
    if ([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) e.preventDefault();
  });
  canvas.addEventListener('contextmenu', e => {
    e.preventDefault();
    if (G.screen === 'GAME') { G.mode = 'NORMAL'; G.buildSel = null; }
  });

  // trackpad / wheel pans the camera in both axes
  canvas.addEventListener('wheel', e => {
    if (G.screen !== 'GAME' || G.mode === 'WORLD' || G.intro) return;
    e.preventDefault();
    panCam(Math.round(e.deltaX / 25), Math.round(e.deltaY / 25));
  }, { passive: false });

  canvas.addEventListener('mousedown', e => {
    const c = canvasCell(e);
    if (e.button === 1 && G.screen === 'GAME' && G.mode !== 'WORLD') { // middle: drag-pan
      e.preventDefault();
      panDrag = { cx: c.cx, cy: c.cy, camX: G.cam.x, camY: G.cam.y };
      return;
    }
    if (e.button !== 0) return;

    if (G.screen !== 'GAME') {
      if (G.help) { G.help = false; return; }
      const row = hit.menu.find(r => r.y === c.cy);
      if (row) menuAction(row.action, row.arg);
      return;
    }
    if (G.intro) { dismissIntro(); return; }
    if (G.gameOver || G.help) return;
    if (G.mode === 'WORLD') { worldClick(c); return; }
    if (G.mode === 'TRADE') {
      const row = hit.trade.find(r => r.y === c.cy && c.cx >= r.x0 && c.cx < r.x1);
      if (row) doTrade(row.idx);
      return;
    }
    if (c.cx > VIEW_W) { // sidebar
      const row = hit.settlers.find(r => r.y === c.cy);
      if (row) {
        const s = G.settlers.find(s => s.id === row.id);
        if (s) cycleRole(s);
      }
      return;
    }
    if (G.mode === 'BUILD') {
      const m = hit.buildMenu.find(r => r.y === c.cy && c.cx >= r.x0 && c.cx < r.x1);
      if (m) {
        const def = BUILDS[m.idx];
        if (def.craft) queueCraft(def);
        else G.buildSel = def;
        return;
      }
    }
    // minimap click: jump the camera
    const mm = hit.minimap;
    if (mm && c.cx >= mm.x0 && c.cx < mm.x0 + mm.w && c.cy >= mm.y0 && c.cy < mm.y0 + mm.h) {
      centerCam((c.cx - mm.x0 + 0.5) * mm.sx, (c.cy - mm.y0 + 0.5) * mm.sy);
      return;
    }
    if (inMapRegion(c)) {
      const w = toWorld(c);
      painting = true;
      paintCell(w.x, w.y, false);
    }
  });

  canvas.addEventListener('mousemove', e => {
    const c = canvasCell(e);
    if (panDrag) {
      G.cam.x = Math.max(0, Math.min(MAP_W - VIEW_W, panDrag.camX - (c.cx - panDrag.cx)));
      G.cam.y = Math.max(0, Math.min(MAP_H - VIEW_H, panDrag.camY - (c.cy - panDrag.cy)));
      return;
    }
    if (inMapRegion(c)) {
      const w = toWorld(c);
      G.cursor.x = w.x; G.cursor.y = w.y;
      if (painting) paintCell(w.x, w.y, true);
    } else {
      G.cursor.x = -1; G.cursor.y = -1;
    }
  });

  window.addEventListener('mouseup', () => { painting = false; panDrag = null; });
  canvas.addEventListener('mouseleave', () => { painting = false; panDrag = null; G.cursor.x = -1; G.cursor.y = -1; });
}
