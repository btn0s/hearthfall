// Every screen and modal, defined declaratively over the ui.js stack.
// Layout is computed from game state (never from draw side effects), so
// clicking, focus, and drawing always agree.
import {
  G, tileAt, inMap, timeStr, communeTier, hasSave, loadGame, newGame, save,
  adjustedOffer, doTrade, tryPlaceBuild, cancelAt, queueCraft, unqueueCraft, cycleRole,
  notice, tip, centerCam, season, isWinter, daysToWinter, moraleLabel, traitName, housingCap,
  selBounds, selectionInfo, assignArea, clearAreaPlans,
  tonightInfo, foodInfo, elderCounsel, toggleAlarm, moraleWhy, recruitEligible,
} from './game.js';
import {
  MAP_W, MAP_H, VIEW_W, VIEW_H, CELL_W, CELL_H, T, BUILDS, BUILD_TABS, CRAFTS, COST_ABBR, ROLE_COLORS, ROLE_LETTER,
  LOCTYPES, CIVS, CIV_UNLOCKS, PERKS, TRADE, INTRO,
} from './data.js';
import { WORLD_W, WORLD_H, partyPower, riskLabel, dangerStr, genWorld, startExpedition } from './world.js';
import { META, hasPerk, perkLevel, buyPerk, civUnlocked } from './meta.js';
import { drawMapTiles } from './tiles.js';
import { drawWorldAscii, MM_COL, inspectText, panCam } from './mapdraw.js';
import * as gfx from './gfx.js';
import { push, pop, replaceAll, drawWidgets, focusedWidget, top } from './ui.js';
import { elderPortrait } from './portrait.js';

const { GRID_W, GRID_H, PANEL_BG, put, str, fillBg, dim, GFX, MM, toggleGfx, toggleMinimap } = gfx;
const SB_X = 74;
const LOG_Y = VIEW_H + 1;

// ---------------------------------------------------------------- shared bits
const FONT = {
  H: ['█ █', '█ █', '███', '█ █', '█ █'],
  E: ['███', '█  ', '██ ', '█  ', '███'],
  A: ['███', '█ █', '███', '█ █', '█ █'],
  R: ['██ ', '█ █', '██ ', '█ █', '█ █'],
  T: ['███', ' █ ', ' █ ', ' █ ', ' █ '],
  F: ['███', '█  ', '██ ', '█  ', '█  '],
  L: ['█  ', '█  ', '█  ', '█  ', '███'],
};
function drawBig(x0, y0, word, colors) {
  let x = x0;
  for (const c of word) {
    const glyph = FONT[c];
    if (glyph) {
      for (let r = 0; r < 5; r++) {
        for (let i = 0; i < glyph[r].length; i++) {
          if (glyph[r][i] !== ' ') put(x + i, y0 + r, '█', colors[r]);
        }
      }
    }
    x += 4;
  }
}

function drawNotice() {
  if (G.notice && G.notice.until > performance.now()) {
    const t = ' ' + G.notice.text + ' ';
    str(Math.max(0, ((VIEW_W - t.length) / 2) | 0), VIEW_H - 1, t, '#ffd870', '#402018');
  }
}

function drawTip() {
  if (!G.tip || G.tip.until < performance.now()) return;
  const maxw = 54;
  const words = G.tip.text.split(' ');
  const lines = [];
  let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > maxw) { lines.push(cur.trim()); cur = w; }
    else cur += ' ' + w;
  }
  if (cur.trim()) lines.push(cur.trim());
  const bw = Math.max(...lines.map(l => l.length), 12) + 4;
  const x0 = Math.max(1, ((VIEW_W - bw) / 2) | 0);
  fillBg(x0, 1, bw, lines.length + 2, '#241c08');
  str(x0 + 1, 1, `☻ ${elderCounsel().name.toUpperCase()}`, '#ffd860', '#241c08');
  str(x0 + bw - 6, 1, 'Esc ✕', '#8a7a50', '#241c08');
  lines.forEach((l, i) => str(x0 + 2, 2 + i, l, '#e8d8b0', '#241c08'));
}

export function beginRun(civId) {
  newGame(civId);
  genWorld();
  save();
  replaceAll(makeGameScreen());
  push(makeIntroModal());
}

// ---------------------------------------------------------------- title screens
export function makeMenuScreen() {
  const ox = ((GRID_W - 34) / 2) | 0;
  const items = [
    { key: 'n', label: () => 'New Game', fg: '#e8d8a0', act: () => push(makeCivScreen()) },
    {
      key: 'c', label: () => hasSave() ? 'Continue' : 'Continue  (no save)',
      fg: '#e8d8a0', disabled: () => !hasSave(),
      act: () => { if (hasSave()) { if (loadGame()) replaceAll(makeGameScreen()); else notice('Save was corrupted'); } },
    },
    { key: 'l', label: () => `Legacy Perks   ◆${META.points}`, fg: '#c8a0e8', act: () => push(makeLegacyScreen()) },
    { key: 'v', label: () => `Graphics: ${GFX.mode === 'tiles' ? 'Tiles' : 'ASCII'}`, fg: '#9ac0d8', act: () => toggleGfx() },
    { key: '?', label: () => 'How to play', fg: '#8a94a2', act: () => push(makeHelpModal()) },
  ];
  const scr = {
    id: 'menu', modal: false, focus: 0,
    widgets: items.map((it, i) => ({
      rect: { x: ox - 2, y: 15 + i * 2, w: 38, h: 1 },
      focusable: true,
      disabled: it.disabled,
      onActivate: it.act,
      draw(w, focused) {
        const dis = it.disabled && it.disabled();
        if (focused) fillBg(w.rect.x, w.rect.y, w.rect.w, 1, '#1c2230');
        str(w.rect.x, w.rect.y, focused ? '►' : ' ', '#ffd860', focused ? '#1c2230' : undefined);
        str(ox, w.rect.y, `${it.key})  ${it.label()}`, dis ? '#5a5f6a' : (focused ? '#ffe8a0' : it.fg), focused ? '#1c2230' : undefined);
      },
    })),
    keymap: Object.fromEntries(items.map(it => [it.key, it.act])),
    draw(f) {
      const flame = ['#ffdf70', '#ffc050', '#ff9030', '#e06020', '#b04818'];
      put((GRID_W / 2) | 0, 3, '‼', flame[(f >> 3) % 3]);
      drawBig(((GRID_W - 39) / 2) | 0, 5, 'HEARTHFALL', flame);
      str(((GRID_W - 42) / 2) | 0, 11, 'an ashes-and-embers commune survival sim', '#8a94a2');
      drawWidgets(this, f);
      str(((GRID_W - 40) / 2) | 0, GRID_H - 4,
        `runs: ${META.runs}   best: ${META.bestDays} days   legacy: ◆${META.points}`, '#6a7484');
      if (META.runs === 0) str(((GRID_W - 46) / 2) | 0, GRID_H - 2, 'every fall of the commune earns legacy to spend', '#4a5560');
      drawNotice();
    },
  };
  return scr;
}

export function makeCivScreen() {
  const ox = 20;
  const scr = {
    id: 'civ', modal: false, focus: 0,
    widgets: CIVS.map((c, i) => ({
      rect: { x: ox - 2, y: 6 + i * 4, w: 62, h: 3 },
      focusable: true,
      disabled: () => !civUnlocked(c.id),
      onActivate: () => { if (civUnlocked(c.id)) beginRun(c.id); },
      draw(w, focused) {
        const locked = !civUnlocked(c.id);
        const bg = focused ? '#1c2230' : undefined;
        if (focused) fillBg(w.rect.x, w.rect.y, w.rect.w, 3, '#1c2230');
        str(w.rect.x, w.rect.y, focused ? '►' : ' ', '#ffd860', bg);
        str(ox, w.rect.y, `${i + 1})  ${c.ch} ${c.name}${locked ? '   ⊘ LOCKED' : ''}`, locked ? '#5a5f6a' : (focused ? '#ffe8a0' : c.fg), bg);
        if (locked) {
          str(ox + 4, w.rect.y + 1, `Unlock: ${CIV_UNLOCKS[c.id].desc}`, '#7a6a50', bg);
          str(ox + 4, w.rect.y + 2, `(lifetime: ${META.life.sites} sites cleared · ${META.life.raids} raids repelled)`, '#5a5f6a', bg);
        } else {
          str(ox + 4, w.rect.y + 1, c.desc, '#8a94a2', bg);
          str(ox + 4, w.rect.y + 2, c.desc2, '#8a94a2', bg);
        }
      },
    })),
    keymap: { Escape: () => pop() },
    onKey(k) {
      const i = +k - 1;
      if (i >= 0 && i < CIVS.length && civUnlocked(CIVS[i].id)) beginRun(CIVS[i].id);
    },
    draw(f) {
      str(((GRID_W - 18) / 2) | 0, 2, 'CHOOSE YOUR PEOPLE', '#ffd860');
      drawWidgets(this, f);
      const perks = PERKS.filter(p => hasPerk(p.id));
      if (perks.length) {
        str(ox, 6 + CIVS.length * 4 + 1, `Legacy carried in: ${perks.map(p => p.name).join(' · ')}`.slice(0, 70), '#c8a0e8');
      }
      str(ox, GRID_H - 3, 'press 1-4 (or click) · Esc back', '#8a94a2');
    },
  };
  return scr;
}

export function makeLegacyScreen() {
  const ox = 18;
  const scr = {
    id: 'legacy', modal: false, focus: 0,
    widgets: PERKS.map((p, i) => ({
      rect: { x: ox - 2, y: 7 + i * 2, w: 70, h: 1 },
      focusable: true,
      onActivate: () => buyPerk(p.id),
      draw(w, focused) {
        const lvl = perkLevel(p.id), max = p.max || 1;
        const maxed = lvl >= max;
        const afford = META.points >= p.cost;
        if (focused) fillBg(w.rect.x, w.rect.y, w.rect.w, 1, '#1c2230');
        const tag = maxed ? (max > 1 ? `Lv${lvl} MAX` : '  OWNED') : lvl > 0 ? `Lv${lvl} ◆${p.cost}` : `◆${p.cost}`;
        const fg = maxed ? '#8ad080' : afford ? '#e8d8a0' : '#5a5f6a';
        str(w.rect.x, w.rect.y, focused ? '►' : ' ', '#ffd860', focused ? '#1c2230' : undefined);
        str(ox, w.rect.y, `${(i + 1) % 10}) ${p.name.padEnd(19).slice(0, 19)} ${tag.padStart(9)}   ${p.desc}`.slice(0, 68),
          focused ? (maxed ? '#8ad080' : '#ffe8a0') : fg, focused ? '#1c2230' : undefined);
      },
    })),
    keymap: { Escape: () => pop() },
    onKey(k) {
      const i = k === '0' ? 9 : +k - 1;
      if (i >= 0 && i < PERKS.length) buyPerk(PERKS[i].id);
    },
    draw(f) {
      str(((GRID_W - 12) / 2) | 0, 2, 'LEGACY PERKS', '#c8a0e8');
      str(((GRID_W - 30) / 2) | 0, 4, `◆${META.points} legacy to spend — permanent, every run`, '#b8b2a0');
      drawWidgets(this, f);
      str(ox, GRID_H - 4, 'Legacy is earned when a run ends: days survived,', '#6a7484');
      str(ox, GRID_H - 3, 'raids repelled, sites cleared, kills, peak population.', '#6a7484');
      str(ox, GRID_H - 2, 'press a number to buy · Esc back', '#8a94a2');
    },
  };
  return scr;
}

// ---------------------------------------------------------------- game screen
const TOOL_MODES = ['NORMAL', 'BUILD', 'CANCEL'];

// single source of truth for sidebar row positions (draw + hit share this)
function sidebarLayout() {
  let y = 11; // 0-6 header block (season, morale, tonight), 7-10 resources
  if (G.raidActive) y++;
  if (G.alarm && !G.raidActive) y++;
  if (G.trader) y++;
  if (G.craftQueue.length) y++;
  if (G.beaconDay) y++;
  const objY = y;
  y += 6; // the elder's window: border + portrait rows + border
  const setHdrY = y;
  const settlerY = y + 1;
  let shown = Math.min(G.settlers.length, 12);
  const expedRows = G.expeditions.length ? 1 + G.expeditions.length : 0;
  // minimap fills the slack below, shrinking to fit; a crowded settler list
  // gives up rows (down to 6) before the map is squeezed out entirely
  let mmY = settlerY + shown + expedRows + 1; // header row; map starts mmY+1
  let mmH = Math.min(15, 40 - (mmY + 1));     // rows of map, floor above the slim hint block
  if (MM.on && mmH < 7) {
    const give = Math.min(7 - mmH, Math.max(0, shown - 6));
    shown -= give; mmY -= give; mmH += give;
  }
  const y2 = settlerY + shown;
  const expedY = G.expeditions.length ? y2 : -1;
  const mmOn = MM.on && mmH >= 7;
  return { objY, setHdrY, settlerY, shown, expedY, mmY, mmH, mmOn, mmW: 25 };
}

function wrapText(text, w) {
  const lines = [];
  let cur = '';
  for (const word of text.split(' ')) {
    if ((cur + ' ' + word).trim().length > w) { lines.push(cur.trim()); cur = word; }
    else cur += ' ' + word;
  }
  if (cur.trim()) lines.push(cur.trim());
  return lines;
}

function hpBar(hp, max, w) {
  const filled = Math.max(0, Math.min(w, Math.ceil(hp / max * w)));
  const col = hp / max > 0.6 ? '#6ac060' : hp / max > 0.3 ? '#e0c060' : '#e05040';
  return { filled, col };
}

function moveCursor(dx, dy) {
  if (!inMap(G.cursor.x, G.cursor.y)) {
    G.cursor.x = G.camp.x; G.cursor.y = G.camp.y;
    centerCam(G.camp.x, G.camp.y);
    return;
  }
  G.cursor.x = Math.max(0, Math.min(MAP_W - 1, G.cursor.x + dx));
  G.cursor.y = Math.max(0, Math.min(MAP_H - 1, G.cursor.y + dy));
  if (G.sel && G.sel.kb) { G.sel.bx = G.cursor.x; G.sel.by = G.cursor.y; } // grow the box
  const m = 3;
  if (G.cursor.x < G.cam.x + m) panCam(G.cursor.x - (G.cam.x + m), 0);
  if (G.cursor.x > G.cam.x + VIEW_W - 1 - m) panCam(G.cursor.x - (G.cam.x + VIEW_W - 1 - m), 0);
  if (G.cursor.y < G.cam.y + m) panCam(0, G.cursor.y - (G.cam.y + m));
  if (G.cursor.y > G.cam.y + VIEW_H - 1 - m) panCam(0, G.cursor.y - (G.cam.y + VIEW_H - 1 - m));
}

function paintCell(x, y, isDrag) {
  if (!inMap(x, y)) return;
  if (G.mode === 'BUILD' && G.buildSel) tryPlaceBuild(x, y);
  else if (G.mode === 'CANCEL') { if (!isDrag) cancelAt(x, y); }
}

// A plain click on something interactive acts immediately; everything else
// goes through the selection box → orders menu.
function clickInteract(x, y) {
  if (G.trader && G.trader.x === x && G.trader.y === y) { push(makeTradeModal()); return true; }
  if (tileAt(x, y).t === 'workshop') { push(makeWorkshopModal()); return true; }
  const s = G.settlers.find(s => !s.away && s.x === x && s.y === y);
  if (s) { cycleRole(s); return true; }
  return false;
}

// Selection finished (mouse-up or Enter): open the orders menu if there is
// anything in the box worth ordering.
function resolveSelection() {
  const b = selBounds();
  if (!b) return;
  const info = selectionInfo(b);
  if (info.tiles === 1) {
    G.sel = null;
    clickInteract(b.x0, b.y0);
    return;
  }
  if (info.trees + info.rocks + info.bushes + info.water + info.marks === 0) {
    G.sel = null;
    notice('Nothing to assign there');
    return;
  }
  push(makeOrdersMenu(b, info));
}

function selectBuild(scr, def) {
  if (!def) return;
  G.buildSel = def;
}

export function makeGameScreen() {
  const tabBuilds = () => BUILDS.filter(b => b.cat === BUILD_TABS[scr.buildTab].id);
  const scr = {
    id: 'game', modal: false, listNav: false, focus: 0, buildFocus: 0, buildTab: 0,

    widgets() {
      const ws = [];
      const lay = sidebarLayout();
      ws.push({ // the morale meter explains itself on click
        rect: { x: SB_X, y: 4, w: 25, h: 1 },
        onClick: () => notice(moraleWhy() || 'Spirits are level — nothing weighs on them.'),
      });
      G.settlers.slice(0, lay.shown).forEach((s, i) => {
        ws.push({
          rect: { x: SB_X, y: lay.settlerY + i, w: 25, h: 1 },
          onClick: () => { const cur = G.settlers.find(x => x.id === s.id); if (cur) cycleRole(cur); },
        });
      });
      if (lay.mmOn) {
        ws.push({
          rect: { x: SB_X, y: lay.mmY + 1, w: lay.mmW, h: lay.mmH },
          onClick: (w, c) => {
            centerCam((c.cx - w.rect.x + 0.5) * (MAP_W / lay.mmW), (c.cy - w.rect.y + 0.5) * (MAP_H / lay.mmH));
          },
        });
      }
      if (G.mode === 'BUILD') {
        if (G.buildSel) {
          ws.push({ rect: { x: 1, y: 1, w: 40, h: 1 }, onClick: () => { G.buildSel = null; } });
        } else {
          BUILD_TABS.forEach((t, i) => {
            ws.push({ rect: { x: 2 + i * 9, y: 2, w: 9, h: 1 }, onClick: () => { scr.buildTab = i; scr.buildFocus = 0; } });
          });
          tabBuilds().forEach((b, i) => {
            ws.push({ rect: { x: 1, y: 3 + i, w: 40, h: 1 }, onClick: () => selectBuild(scr, b) });
          });
        }
      }
      return ws;
    },

    onKey(k, mods = {}) {
      if (k === 'Escape' && G.tip) { G.tip = null; return; }
      if (k === 'Escape' && G.sel) { G.sel = null; return; }
      const P = 4;
      if (k === 'PAN_LEFT' || (mods.shift && k === 'ArrowLeft')) return panCam(-P, 0);
      if (k === 'PAN_RIGHT' || (mods.shift && k === 'ArrowRight')) return panCam(P, 0);
      if (k === 'PAN_UP' || (mods.shift && k === 'ArrowUp')) return panCam(0, -P);
      if (k === 'PAN_DOWN' || (mods.shift && k === 'ArrowDown')) return panCam(0, P);

      if (G.mode === 'BUILD') {
        const tb = tabBuilds();
        if (/^[a-e]$/.test(k)) { selectBuild(scr, tb.find(b => b.key === k)); return; }
        if (!G.buildSel) {
          if (k === 'ArrowLeft' || (k === 'Tab' && mods.shift)) { scr.buildTab = (scr.buildTab + BUILD_TABS.length - 1) % BUILD_TABS.length; scr.buildFocus = 0; return; }
          if (k === 'ArrowRight' || k === 'Tab') { scr.buildTab = (scr.buildTab + 1) % BUILD_TABS.length; scr.buildFocus = 0; return; }
          if (k === 'ArrowUp') { scr.buildFocus = (scr.buildFocus + tb.length - 1) % tb.length; return; }
          if (k === 'ArrowDown') { scr.buildFocus = (scr.buildFocus + 1) % tb.length; return; }
          if (k === 'Enter') { selectBuild(scr, tb[scr.buildFocus]); return; }
        }
        if (k === 'Escape') {
          if (G.buildSel) G.buildSel = null;
          else G.mode = 'NORMAL';
          return;
        }
      } else if (k === 'Escape') {
        if (G.mode !== 'NORMAL') { G.mode = 'NORMAL'; G.buildSel = null; return; }
        push(makePauseMenu()); // a quiet Esc opens the pause menu
        return;
      }

      if (k === 'Q') { save(); replaceAll(makeMenuScreen()); return; }
      if (k === ' ') { G.paused = !G.paused; return; }
      if (k === '?') { push(makeHelpModal()); return; }
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
        if (k === 'x') { G.mode = 'CANCEL'; return; }
        if (k === 'r') { toggleAlarm(); return; }
        if (k === 'e') {
          if (G.trader) push(makeTradeModal());
          else notice('No trader in camp right now');
          return;
        }
        if (k === 'w') { push(makeWorldScreen()); tip('world'); return; }
      }
      if (k === 'ArrowUp') return moveCursor(0, -1);
      if (k === 'ArrowDown') return moveCursor(0, 1);
      if (k === 'ArrowLeft') return moveCursor(-1, 0);
      if (k === 'ArrowRight') return moveCursor(1, 0);
      if (k === 'Enter') {
        if (!inMap(G.cursor.x, G.cursor.y)) { moveCursor(0, 0); return; }
        const cx = G.cursor.x, cy = G.cursor.y;
        if (G.mode !== 'NORMAL') { paintCell(cx, cy, false); return; }
        if (G.sel) { resolveSelection(); return; }              // second press: confirm the box
        if (clickInteract(cx, cy)) return;                       // settler / trader / workshop
        G.sel = { ax: cx, ay: cy, bx: cx, by: cy, kb: true };    // first press: anchor a box
        notice('Selecting — arrows stretch, Enter assigns, Esc cancels');
      }
    },

    onClick(c) {
      if (c.cx >= VIEW_W || c.cy >= VIEW_H) return;
      const x = c.cx + G.cam.x, y = c.cy + G.cam.y;
      if (G.mode === 'NORMAL') { G.sel = { ax: x, ay: y, bx: x, by: y }; return; }
      paintCell(x, y, false);
    },
    onDrag(c) {
      if (c.cx >= VIEW_W || c.cy >= VIEW_H) return;
      const x = Math.min(MAP_W - 1, Math.max(0, c.cx + G.cam.x)), y = Math.min(MAP_H - 1, Math.max(0, c.cy + G.cam.y));
      if (G.mode === 'NORMAL') { if (G.sel && !G.sel.kb) { G.sel.bx = x; G.sel.by = y; } return; }
      paintCell(x, y, true);
    },
    onRelease() {
      if (G.mode === 'NORMAL' && G.sel && !G.sel.kb) resolveSelection();
    },
    onHover(c) {
      if (c && c.cx < VIEW_W && c.cy < VIEW_H) {
        G.cursor.x = c.cx + G.cam.x;
        G.cursor.y = c.cy + G.cam.y;
      } else {
        G.cursor.x = -1; G.cursor.y = -1;
      }
    },
    pan(dx, dy) { panCam(dx, dy); },

    draw(f) {
      // world layer
      if (GFX.mode === 'tiles') gfx.setWorldPainter((ctx, ff) => drawMapTiles(ctx, ff));
      else drawWorldAscii(f);
      // opaque panels
      fillBg(VIEW_W, 0, GRID_W - VIEW_W, GRID_H, PANEL_BG);
      fillBg(0, VIEW_H, VIEW_W, GRID_H - VIEW_H, PANEL_BG);
      for (let y = 0; y < GRID_H; y++) put(VIEW_W, y, '│', '#3a3f4a', PANEL_BG);
      for (let x = 0; x < VIEW_W; x++) put(x, VIEW_H, '─', '#3a3f4a', PANEL_BG);
      put(VIEW_W, VIEW_H, '┤', '#3a3f4a', PANEL_BG);
      this.drawSidebar(f);
      this.drawLog();
      this.drawMinimap(f);
      if (G.mode === 'BUILD') this.drawBuildMenu();
      drawNotice();
      drawTip();
    },

    drawSidebar(f) {
      const lay = sidebarLayout();
      const civ = CIVS.find(c => c.id === G.civ);
      let y = 0;
      str(SB_X, y++, '☼ HEARTHFALL', '#ffd860');
      const spd = G.paused ? ((f >> 4) % 2 ? '‖ PAUSED' : '        ') : '▶'.repeat(G.speed);
      str(SB_X, y++, `Day ${G.day}  ${timeStr()}  ${spd}`, G.paused ? '#e0a040' : '#b8b2a0');
      const tier = communeTier();
      const tierStr = tier === 3 ? 'Tier III' : tier === 2 ? 'Tier II (9☺→III)' : 'Tier I (6☺→II)';
      str(SB_X, y++, `${civ ? civ.name.replace('The ', '') : ''} · ${tierStr}`.slice(0, 26), civ ? civ.fg : '#b8b2a0');
      const sn = season();
      const dayInSeason = ((G.day - 1) % 5) + 1;
      const dtw = daysToWinter();
      const winterNote = isWinter() ? 'endure' : `❄ in ${dtw}d`;
      str(SB_X, y++, `${sn.ch} ${sn.name} ${dayInSeason}/5 · ${winterNote}`.slice(0, 26), sn.fg);
      const mb = Math.max(0, Math.min(8, Math.round(G.morale / 100 * 8)));
      const mCol = G.morale >= 75 ? '#8ad080' : G.morale >= 50 ? '#c8c2b0' : G.morale >= 35 ? '#e0c060' : '#e05040';
      str(SB_X, y, 'Morale ', '#8a94a2');
      str(SB_X + 7, y, '█'.repeat(mb) + '░'.repeat(8 - mb), mCol);
      str(SB_X + 16, y++, ` ${moraleLabel()}`.slice(0, 10), mCol);
      const tn = tonightInfo();
      str(SB_X, y++, tn.label.slice(0, 26), tn.urgent && (f >> 3) % 2 ? '#ffd870' : tn.fg);
      str(SB_X, y++, '─'.repeat(25), '#3a3f4a');
      const R = G.res;
      const fi = foodInfo();
      const burnStr = fi.perDay < 10 ? fi.perDay.toFixed(1) : String(Math.round(fi.perDay));
      const daysStr = fi.days > 30 ? '30+' : fi.days.toFixed(fi.days < 10 ? 1 : 0);
      str(SB_X, y++, `Food ${R.food}+${R.meals}m −${burnStr}/d ·${daysStr}d`.slice(0, 26), fi.days < 3 ? '#e05040' : fi.days < 6 ? '#e0c060' : '#c8c2b0');
      str(SB_X, y++, `Wood ${String(R.wood).padEnd(4)}Stone ${R.stone}`, '#a8a296');
      str(SB_X, y++, `Scrap ${String(R.scrap).padEnd(3)}Herbs ${R.herbs}`, '#a8a296');
      str(SB_X, y++, `Coin ${String(R.coin).padEnd(4)}Wpn ${R.weapons}  Med ${R.meds}`, '#d8c860');
      if (G.raidActive) str(SB_X, y++, `⚠ ${G.raidIsHorde ? 'HORDE' : 'RAIDERS'}: ${G.raiders.length}`, (f >> 3) % 2 ? '#ff5040' : '#a03028');
      if (G.alarm && !G.raidActive) str(SB_X, y++, '♪ ALARM — r stands down', (f >> 3) % 2 ? '#e0c060' : '#907830');
      if (G.trader) str(SB_X, y++, '¤ trader in camp — e trade', '#ffd860');
      if (G.craftQueue.length) str(SB_X, y++, `Ω workshop queue: ${G.craftQueue.length}`, '#c08a50');
      if (G.beaconDay) {
        const hold = Math.max(0, G.beaconDay + 3 - G.day);
        str(SB_X, y++, `☼ BEACON — hold ${hold}d more`, (f >> 3) % 2 ? '#ffe060' : '#b09030');
      }
      // the elder's window: a framed portrait whose face carries the mood
      const el = elderCounsel();
      const flash = G.objFlash > performance.now();
      const bx = SB_X, by = lay.objY, bw = 25, pbg = '#131622';
      fillBg(bx, by, bw, 6, pbg);
      const bcol = flash ? '#3a5a42' : el.mood === 'alarm' ? '#6a3030' : '#3a3f4a';
      put(bx, by, '╭', bcol, pbg); put(bx + bw - 1, by, '╮', bcol, pbg);
      put(bx, by + 5, '╰', bcol, pbg); put(bx + bw - 1, by + 5, '╯', bcol, pbg);
      for (let i = 1; i < bw - 1; i++) { put(bx + i, by, '─', bcol, pbg); put(bx + i, by + 5, '─', bcol, pbg); }
      for (let r = 1; r < 5; r++) { put(bx, by + r, '│', bcol, pbg); put(bx + bw - 1, by + r, '│', bcol, pbg); }
      str(bx + 2, by, ` ${el.name.toUpperCase()} `.slice(0, bw - 4), flash ? '#8ad080' : '#c8b890', pbg);
      // the portrait: pixel-art elder, expression follows the mood
      const fx = bx + 2;
      fillBg(fx - 1, by + 1, 7, 4, '#1a1610');
      if (top() === scr) { // skip while a modal is up — nothing paints over menus
        const img = elderPortrait(G.civ, el.mood);
        gfx.setOverlayPainter((octx) => {
          octx.save();
          octx.imageSmoothingEnabled = false;
          octx.drawImage(img, (fx - 1) * CELL_W + 5, (by + 1) * CELL_H + 2);
          octx.restore();
        });
      }
      // the counsel, spoken beside the face
      const prog = el.prog ? ` (${el.prog[0]}/${el.prog[1]})` : '';
      const lines = wrapText(el.text + prog, 15);
      for (let i = 0; i < 4; i++) {
        str(bx + 9, by + 1 + i, (lines[i] || '').slice(0, 15), i === 0 ? (flash ? '#8ad080' : '#e8d8b0') : '#b8b2a0', pbg);
      }
      const grow = recruitEligible() ? ` ☺${G.recruitDays}d` : '';
      const shdr = `─ SETTLERS ${G.settlers.length} · ⌂${housingCap()}${grow} `;
      str(SB_X, lay.setHdrY, (shdr + '─'.repeat(Math.max(0, 25 - shdr.length))).slice(0, 26), '#3a3f4a');
      G.settlers.slice(0, lay.shown).forEach((s, i) => {
        const yy = lay.settlerY + i;
        const bar = hpBar(s.hp, s.maxHp, 6);
        let status = '';
        if (s.away) status = '→away';
        else if (s.downed) status = 'DOWN';
        else if (s.sleeping) status = 'zzz';
        else if (s.starving) status = 'HUNGRY';
        else if (s.task) status = s.task.kind;
        str(SB_X, yy, `☺${s.name.padEnd(7).slice(0, 7)}${ROLE_LETTER[s.role]} `, s.away ? '#6a7484' : (ROLE_COLORS[s.role] || '#d8d2c0'));
        str(SB_X + 10, yy, '█'.repeat(bar.filled), bar.col);
        str(SB_X + 10 + bar.filled, yy, '░'.repeat(6 - bar.filled), '#3a3f4a');
        str(SB_X + 17, yy, status.slice(0, 8), '#8a94a2');
      });
      if (lay.expedY >= 0) {
        str(SB_X, lay.expedY, '─ EXPEDITIONS ' + '─'.repeat(11), '#3a3f4a');
        G.expeditions.forEach((e, i) => {
          const loc = G.world.locs[e.locIdx];
          str(SB_X, lay.expedY + 1 + i, `⚑ ${loc.name.slice(0, 13)} ${e.phase === 'out' ? '►out' : '◄home'} ${(e.t / 1440).toFixed(1)}d`, '#9ac0d8');
        });
      }
      // two context lines at the bottom; the full reference lives in Esc → help
      let hy = GRID_H - 2;
      str(SB_X, hy - 1, '─'.repeat(25), '#3a3f4a');
      if (G.mode === 'BUILD') {
        str(SB_X, hy++, `BUILD: ${G.buildSel ? G.buildSel.name : '←→ tabs · a-e'}`.slice(0, 26), '#e8c860');
        str(SB_X, hy, G.buildSel ? 'click/drag map · Esc back' : 'Enter/click pick · Esc', '#8a94a2');
      } else if (G.mode === 'CANCEL') {
        str(SB_X, hy++, 'DEMOLISH: click structures', '#e8c860');
        str(SB_X, hy, 'Esc done', '#8a94a2');
      } else if (G.sel) {
        str(SB_X, hy++, 'SELECTING: stretch the box', '#e8c860');
        str(SB_X, hy, 'release/Enter → orders', '#8a94a2');
      } else {
        str(SB_X, hy++, 'drag a box → orders', '#8a94a2');
        str(SB_X, hy, 'Esc menu · ? help · b build', '#8a94a2');
      }
    },

    drawLog() {
      str(1, LOG_Y, inspectText().slice(0, VIEW_W - 2), '#7f8b99');
      const rows = 5;
      const tail = G.log.slice(-rows);
      for (let i = 0; i < tail.length; i++) {
        const age = tail.length - 1 - i;
        const k = age === 0 ? 1 : (age === 1 ? 0.8 : 0.55);
        str(1, LOG_Y + 1 + (rows - tail.length) + i, tail[i].text.slice(0, VIEW_W - 2), dim(tail[i].fg, k));
      }
    },

    drawMinimap(f) {
      const lay = sidebarLayout();
      if (!lay.mmOn) return;
      const x0 = SB_X, y0 = lay.mmY + 1;
      const mmW = lay.mmW, mmH = lay.mmH;
      str(SB_X, lay.mmY, '─ MAP (n) ' + '─'.repeat(15), '#3a3f4a');
      const sx = MAP_W / mmW, sy = MAP_H / mmH;
      for (let my = 0; my < mmH; my++) for (let mx = 0; mx < mmW; mx++) {
        const t = tileAt(Math.min(MAP_W - 1, (mx * sx + sx / 2) | 0), Math.min(MAP_H - 1, (my * sy + sy / 2) | 0)).t;
        put(x0 + mx, y0 + my, ' ', '#000', MM_COL[t] || '#243719');
      }
      const vx0 = Math.round(G.cam.x / sx), vx1 = Math.min(mmW - 1, Math.round((G.cam.x + VIEW_W) / sx) - 1);
      const vy0 = Math.round(G.cam.y / sy), vy1 = Math.min(mmH - 1, Math.round((G.cam.y + VIEW_H) / sy) - 1);
      for (let mx = vx0; mx <= vx1; mx++) {
        put(x0 + mx, y0 + vy0, mx === vx0 ? '┌' : mx === vx1 ? '┐' : '─', '#e8e8d8');
        if (vy1 !== vy0) put(x0 + mx, y0 + vy1, mx === vx0 ? '└' : mx === vx1 ? '┘' : '─', '#e8e8d8');
      }
      for (let my = vy0 + 1; my < vy1; my++) {
        put(x0 + vx0, y0 + my, '│', '#e8e8d8');
        put(x0 + vx1, y0 + my, '│', '#e8e8d8');
      }
      const dot = (x, y, ch, fg) => put(x0 + Math.min(mmW - 1, (x / sx) | 0), y0 + Math.min(mmH - 1, (y / sy) | 0), ch, fg);
      for (const s of G.settlers) if (!s.away) dot(s.x, s.y, '·', '#e8e8d8');
      for (const r of G.raiders) dot(r.x, r.y, '•', (f >> 3) % 2 ? '#ff5040' : '#c03028');
      dot(G.camp.x, G.camp.y, '☼', '#ffd860');
    },

    drawBuildMenu() {
      const x0 = 1, y0 = 1, w = 40;
      const tier = communeTier();
      if (G.buildSel) {
        const cost = Object.entries(G.buildSel.cost).map(([k, v]) => v + (COST_ABBR[k] || k)).join(' ');
        fillBg(x0, y0, w, 1, '#12141c');
        str(x0 + 1, y0, `BUILD: ${G.buildSel.name} (${cost}) · Esc = menu`, '#e8c860', '#12141c');
        return;
      }
      const tb = tabBuilds();
      fillBg(x0, y0, w, tb.length + 3, '#12141c');
      str(x0 + 1, y0, 'BUILD — ←→ tab · click to place', '#e8c860');
      BUILD_TABS.forEach((t, i) => {
        const on = i === scr.buildTab;
        str(x0 + 1 + i * 9, y0 + 1, ` ${t.name} `, on ? '#ffe8a0' : '#6a7484', on ? '#2a3048' : '#12141c');
      });
      tb.forEach((b, i) => {
        const y = y0 + 2 + i;
        const afford = Object.entries(b.cost).every(([k, v]) => G.res[k] >= v);
        const locked = b.tier && b.tier > tier;
        const focus = i === scr.buildFocus;
        if (focus) fillBg(x0, y, w, 1, '#1c2230');
        const bg = focus ? '#1c2230' : '#12141c';
        const cost = Object.entries(b.cost).map(([k, v]) => v + (COST_ABBR[k] || k)).join(' ');
        const glyph = T[b.id] ? T[b.id].ch : '/';
        const tag = locked ? ` T${b.tier}!` : b.note ? ` ${b.note}` : '';
        const fg = afford && !locked ? (focus ? '#ffe8a0' : '#c8c2b0') : '#5a5f6a';
        str(x0 + 1, y, `${focus ? '►' : ' '}${b.key}) ${glyph} ${b.name.padEnd(11)} ${cost}${tag}`.slice(0, w - 1), fg, bg);
      });
    },
  };
  return scr;
}

// ---------------------------------------------------------------- world screen
export function makeWorldScreen() {
  const px = 56, ox = 2, oy = 2;
  const scr = {
    id: 'world', modal: false, focus: 0,
    widgets() {
      return G.world.locs.map((l, i) => ({
        rect: { x: px - 1, y: 3 + i, w: 42, h: 1 },
        focusable: !l.cleared,
        locIdx: i,
        onActivate(w) { push(makePartyModal(w.locIdx)); },
        onClick(w) {
          const fw = focusedWidget(scr);
          if (fw && fw.locIdx === w.locIdx) { push(makePartyModal(w.locIdx)); return; }
          // focus this row (focus is an index among focusables)
          const foc = G.world.locs.map((ll, j) => ({ ll, j })).filter(o => !o.ll.cleared);
          const fi = foc.findIndex(o => o.j === w.locIdx);
          if (fi >= 0) scr.focus = fi;
        },
        draw(w, focused, f) {
          const lt = LOCTYPES[l.type];
          const stars = '★'.repeat(Math.max(1, Math.min(5, Math.round(l.diff / 3)))) + (l.scouted ? '' : '?');
          const fg = l.cleared ? '#555a60' : (focused ? '#ffe8a0' : '#b8b2a0');
          if (focused) fillBg(w.rect.x, w.rect.y, w.rect.w, 1, '#22283a');
          str(px, w.rect.y, `${focused ? '►' : ' '}${lt.ch} ${l.name.padEnd(15)} ${l.cleared ? '✓done' : stars}`, fg, focused ? '#22283a' : undefined);
        },
      }));
    },
    keymap: {
      Escape: () => pop(),
      w: () => pop(),
      ' ': () => { G.paused = !G.paused; },
    },
    draw(f) {
      const w = G.world;
      str(2, 0, '☼ WORLD MAP — ↑↓ select · Enter send party · Esc back', '#ffd860');
      const TERR = { '.': '#3a4434', '♠': '#2e6b2a', '^': '#8d8d85', '≈': '#3a6fb0' };
      for (let y = 0; y < WORLD_H; y++) for (let x = 0; x < WORLD_W; x++) {
        const ch = w.grid[y][x];
        put(ox + x, oy + y, ch, TERR[ch] || '#3a4434', '#0b0d0f');
      }
      const sel = focusedWidget(this);
      w.locs.forEach((l, i) => {
        const lt = LOCTYPES[l.type];
        const isSel = sel && sel.locIdx === i;
        const bg = isSel && (f >> 4) % 2 ? '#3a4560' : '#0b0d0f';
        if (l.cleared) put(ox + l.x, oy + l.y, '×', '#555a60', bg);
        else put(ox + l.x, oy + l.y, lt.ch, lt.fg, bg);
      });
      put(ox + w.base.x, oy + w.base.y, '☼', '#ffd860', '#0b0d0f');
      for (const e of G.expeditions) {
        const loc = w.locs[e.locIdx];
        const frac = e.phase === 'out' ? 1 - e.t / e.total : e.t / e.total;
        put(ox + Math.round(w.base.x + (loc.x - w.base.x) * frac), oy + Math.round(w.base.y + (loc.y - w.base.y) * frac), '☺', '#7ad0e8');
      }
      str(px, 2, 'KNOWN LOCATIONS', '#c8c2b0');
      drawWidgets(this, f);
      let dy = 4 + w.locs.length;
      const selLoc = sel ? w.locs[sel.locIdx] : null;
      if (selLoc) {
        const lt = LOCTYPES[selLoc.type];
        str(px, dy++, `${lt.name}: "${selLoc.name}"`, lt.fg);
        str(px, dy++, lt.desc.slice(0, 42), '#8a94a2');
        str(px, dy++, `Danger ${dangerStr(selLoc)}${selLoc.scouted ? '' : ' (unscouted)'}   Travel ${(selLoc.travel / 1440).toFixed(1)}d`, '#a8a296');
        if (selLoc.type === 'bandits' && !selLoc.cleared) str(px, dy++, 'It grows bolder every day it stands.', '#e0a040');
        str(px, dy++, `${G.settlers.filter(s => !s.away && !s.downed).length} settlers fit to travel`, '#8a94a2');
        str(px, dy++, 'send ONE settler to scout it safely', '#6a7484');
      }
      dy++;
      for (const e of G.expeditions) {
        const loc = w.locs[e.locIdx];
        str(px, dy++, `⚑ ${loc.name}: ${e.phase === 'out' ? 'traveling out' : 'heading home'} ${(e.t / 1440).toFixed(1)}d`, '#9ac0d8');
      }
      const tail = G.log.slice(-4);
      for (let i = 0; i < tail.length; i++) str(2, GRID_H - 5 + i, tail[i].text.slice(0, GRID_W - 4), dim(tail[i].fg, i === tail.length - 1 ? 1 : 0.6));
      drawTip();
    },
  };
  return scr;
}

function makePartyModal(locIdx) {
  tip('scout');
  const sel = new Set();
  const avail = () => G.settlers.filter(s => !s.away && !s.downed);
  const bw = 52;
  const x0 = ((GRID_W - bw) / 2) | 0;
  const scr = {
    id: 'party', modal: true, focus: avail().length, // focus starts on LAUNCH
    widgets() {
      const a = avail();
      const bh = a.length + 7;
      const y0 = ((GRID_H - bh) / 2) | 0;
      const ws = a.map((s, i) => ({
        rect: { x: x0, y: y0 + 2 + i, w: bw, h: 1 },
        focusable: true,
        onActivate: () => { sel.has(s.id) ? sel.delete(s.id) : sel.add(s.id); },
        draw(w, focused) {
          const on = sel.has(s.id);
          const bg = focused ? '#22304a' : '#141824';
          if (focused) fillBg(x0, w.rect.y, bw, 1, bg);
          str(x0 + 1, w.rect.y, `${focused ? '►' : ' '}${i + 1} [${on ? 'x' : ' '}] ${s.name.padEnd(8)} ${s.role.padEnd(6)} hp${String(Math.ceil(s.hp)).padEnd(3)} ${traitName(s).toLowerCase()}`, on ? '#ffe8a0' : '#b8b2a0', bg);
        },
      }));
      ws.push({
        rect: { x: x0, y: y0 + bh - 2, w: bw, h: 1 },
        focusable: true,
        onActivate: () => {
          const ids = [...sel];
          if (!ids.length) { notice('Pick at least one settler'); return; }
          if (startExpedition(locIdx, ids)) pop();
        },
        draw(w, focused) {
          const bg = focused ? '#22304a' : '#141824';
          if (focused) fillBg(x0, w.rect.y, bw, 1, bg);
          str(x0 + 1, w.rect.y, `${focused ? '►' : ' '}[Enter] LAUNCH    [Esc] cancel`, '#8ad080', bg);
        },
      });
      return ws;
    },
    keymap: { Escape: () => pop() },
    onKey(k) {
      if (/^[1-9]$/.test(k)) {
        const s = avail()[+k - 1];
        if (s) { sel.has(s.id) ? sel.delete(s.id) : sel.add(s.id); }
      }
    },
    draw(f) {
      const loc = G.world.locs[locIdx];
      const a = avail();
      const bh = a.length + 7;
      const y0 = ((GRID_H - bh) / 2) | 0;
      fillBg(x0, y0, bw, bh, '#141824');
      str(x0 + 1, y0, `SEND PARTY → ${loc.name}`, '#ffd860', '#141824');
      str(x0 + 1, y0 + 1, 'press 1-9 (or click) to toggle members', '#8a94a2', '#141824');
      drawWidgets(this, f);
      const members = a.filter(s => sel.has(s.id));
      const pw = Math.round(partyPower(members));
      const risk = members.length ? riskLabel(pw, loc) : { label: '—', fg: '#8a94a2' };
      if (members.length === 1) {
        str(x0 + 1, y0 + bh - 4, '⚑ one rider = SCOUT: fast, safe, reveals danger', '#9ac0d8', '#141824');
        str(x0 + 1, y0 + bh - 3, 'no assault will be made', '#6a7484', '#141824');
      } else {
        str(x0 + 1, y0 + bh - 4, `Party power ~${pw} vs danger ${dangerStr(loc)} ×2.6`, risk.fg, '#141824');
        str(x0 + 1, y0 + bh - 3, `Risk: ${risk.label}${loc.scouted ? '' : '  (scout for true numbers)'}`, risk.fg, '#141824');
      }
    },
  };
  return scr;
}

// ---------------------------------------------------------------- modals
// The pause menu: settings, save, help, and the way out. Esc from a quiet
// map opens it; the sim holds its breath while it's up.
function makePauseMenu() {
  const bw = 40;
  const x0 = ((GRID_W - bw) / 2) | 0;
  const items = [
    { key: '1', label: () => 'Resume', fg: '#e8d8a0', act: () => pop() },
    { key: '2', label: () => 'Save now', fg: '#8ad080', act: () => { save(); notice('The run is saved'); pop(); } },
    { key: '3', label: () => 'How to play', fg: '#9ac0d8', act: () => push(makeHelpModal()) },
    { key: '4', label: () => `Graphics: ${GFX.mode === 'tiles' ? 'Tiles' : 'ASCII'}`, fg: '#9ac0d8', act: () => toggleGfx() },
    { key: '5', label: () => `Minimap: ${MM.on ? 'shown' : 'hidden'}`, fg: '#9ac0d8', act: () => toggleMinimap() },
    { key: '6', label: () => 'Save & quit to title', fg: '#e0a080', act: () => { save(); replaceAll(makeMenuScreen()); } },
  ];
  const bh = items.length * 2 + 5;
  const y0 = ((GRID_H - bh) / 2) | 0;
  const scr = {
    id: 'pause', modal: true, pausesSim: true, focus: 0,
    widgets: items.map((it, i) => ({
      rect: { x: x0, y: y0 + 3 + i * 2, w: bw, h: 1 },
      focusable: true,
      onActivate: it.act,
      draw(w, focused) {
        const bg = focused ? '#22304a' : '#12151e';
        if (focused) fillBg(x0, w.rect.y, bw, 1, bg);
        str(x0 + 2, w.rect.y, `${focused ? '►' : ' '}${it.key}) ${it.label()}`, focused ? '#ffe8a0' : it.fg, bg);
      },
    })),
    keymap: { Escape: () => pop() },
    onKey(k) {
      const it = items.find(i => i.key === k);
      if (it) it.act();
    },
    draw(f) {
      fillBg(x0, y0, bw, bh, '#12151e');
      const title = '‖ PAUSED';
      str(x0 + (((bw - title.length) / 2) | 0), y0 + 1, title, (f >> 4) % 2 ? '#e0a040' : '#a07830', '#12151e');
      drawWidgets(this, f);
      str(x0 + 2, y0 + bh - 2, 'runs autosave at dawn · Esc resume', '#6a7484', '#12151e');
      drawNotice();
    },
  };
  return scr;
}

// AoE-style area orders: drag a box over the map, then say what the crew
// should do with what's inside it.
function makeOrdersMenu(b, info) {
  const done = (fn, msg) => () => { fn(); if (msg) notice(msg); pop(); };
  const rows = [];
  const plural = (n) => n === 1 ? '' : 's';
  if (info.trees) rows.push({ key: 't', fg: '#8ad080', label: `chop ${info.trees} tree${plural(info.trees)}`, act: done(() => assignArea(b, 'chop'), `Marked ${info.trees} trees to chop`) });
  if (info.rocks) rows.push({ key: 'm', fg: '#a8a8a0', label: `mine ${info.rocks} rock${plural(info.rocks)}`, act: done(() => assignArea(b, 'mine'), `Marked ${info.rocks} rocks to mine`) });
  if (info.bushes || info.water) {
    const bits = [];
    if (info.bushes) bits.push(`forage ${info.bushes} bush${info.bushes === 1 ? '' : 'es'}`);
    if (info.water) bits.push(`fish ${info.water} water`);
    rows.push({ key: 'g', fg: '#79c258', label: bits.join(' · '), act: done(() => assignArea(b, 'forage'), 'Gathering marks placed') });
  }
  if (rows.length >= 2) rows.push({ key: 'a', fg: '#ffd870', label: 'all of it', act: done(() => assignArea(b, 'all'), 'All work marked') });
  if (info.marks) rows.push({ key: 'x', fg: '#e0a080', label: `clear ${info.marks} mark${plural(info.marks)}/plan${plural(info.marks)}`, act: done(() => clearAreaPlans(b), 'Marks and plans cleared') });

  const w = Math.max(26, ...rows.map(r => r.label.length + 8));
  const bh = rows.length + 3;
  const x0 = Math.max(1, Math.min(VIEW_W - w - 1, b.x1 - G.cam.x + 2));
  const y0 = Math.max(1, Math.min(VIEW_H - bh - 1, b.y0 - G.cam.y));
  const scr = {
    id: 'orders', modal: true, pausesSim: true, focus: 0,
    onExit() { G.sel = null; },
    widgets: rows.map((r, i) => ({
      rect: { x: x0, y: y0 + 1 + i, w, h: 1 },
      focusable: true,
      onActivate: r.act,
      draw(wd, focused) {
        const bg = focused ? '#22304a' : '#101620';
        if (focused) fillBg(x0, wd.rect.y, w, 1, bg);
        str(x0 + 1, wd.rect.y, `${focused ? '►' : ' '}${r.key}) ${r.label}`, focused ? '#ffe8a0' : r.fg, bg);
      },
    })),
    keymap: Object.fromEntries([...rows.map(r => [r.key, r.act]), ['Escape', () => pop()]]),
    draw(f) {
      fillBg(x0, y0, w, bh, '#101620');
      str(x0 + 1, y0, `ORDERS — ${info.tiles} tiles`, '#e8c860', '#101620');
      drawWidgets(this, f);
      str(x0 + 1, y0 + bh - 1, 'Esc never mind', '#6a7484', '#101620');
    },
  };
  return scr;
}

// Production orders live on the building: click a workshop to queue work.
function makeWorkshopModal() {
  const x0 = 4, y0 = 4, w = 44;
  const bh = CRAFTS.length + 6;
  const queueStr = () => {
    if (!G.craftQueue.length) return 'orders: none';
    const counts = {};
    for (const id of G.craftQueue) counts[id] = (counts[id] || 0) + 1;
    return 'orders: ' + Object.entries(counts)
      .map(([id, n]) => `${(CRAFTS.find(c => c.id === id) || { name: id }).name.replace(/^(Craft|Brew) /, '')}${n > 1 ? ` ×${n}` : ''}`)
      .join(', ');
  };
  const scr = {
    id: 'workshop', modal: true, focus: 0,
    update() { if (!G.tiles.some(tl => tl.t === 'workshop')) pop(); }, // burned down mid-order
    widgets: CRAFTS.map((c, i) => ({
      rect: { x: x0, y: y0 + 3 + i, w, h: 1 },
      focusable: true,
      onActivate: () => queueCraft(c),
      draw(wd, focused) {
        const cost = Object.entries(c.cost).map(([k, v]) => `${v} ${k}`).join(', ');
        const afford = Object.entries(c.cost).every(([k, v]) => G.res[k] >= v);
        const bg = focused ? '#22304a' : '#161a10';
        if (focused) fillBg(x0, wd.rect.y, w, 1, bg);
        str(x0 + 1, wd.rect.y, `${focused ? '►' : ' '}${i + 1}) ${c.name.padEnd(12)} ${cost}`, afford ? (focused ? '#ffe8a0' : '#c8c2b0') : '#5a5f6a', bg);
      },
    })).concat([{
      rect: { x: x0, y: y0 + 4 + CRAFTS.length, w, h: 1 },
      focusable: true,
      onActivate: () => unqueueCraft(),
      draw(wd, focused) {
        const bg = focused ? '#22304a' : '#161a10';
        if (focused) fillBg(x0, wd.rect.y, w, 1, bg);
        str(x0 + 1, wd.rect.y, `${focused ? '►' : ' '}x) cancel last order (refund)`, G.craftQueue.length ? '#e0a080' : '#5a5f6a', bg);
      },
    }]),
    keymap: { Escape: () => pop(), x: () => unqueueCraft() },
    onKey(k) {
      const i = +k - 1;
      if (i >= 0 && i < CRAFTS.length) queueCraft(CRAFTS[i]);
    },
    draw(f) {
      fillBg(x0, y0, w, bh, '#161a10');
      str(x0 + 1, y0, 'Ω WORKSHOP — press 1-2 to order', '#e8c860', '#161a10');
      str(x0 + 1, y0 + 1, queueStr().slice(0, w - 2), '#c08a50', '#161a10');
      drawWidgets(this, f);
      str(x0 + 1, y0 + bh - 1, 'workers craft in queue order · Esc close', '#8a94a2', '#161a10');
      drawNotice();
    },
  };
  return scr;
}

function makeTradeModal() {
  const x0 = 4, y0 = 4, w = 40;
  const scr = {
    id: 'trade', modal: true, focus: 0,
    update() { if (!G.trader) pop(); }, // trader left / raid scared them off
    widgets: TRADE.map((_, i) => ({
      rect: { x: x0, y: y0 + 2 + i, w, h: 1 },
      focusable: true,
      onActivate: () => doTrade(i),
      draw(wd, focused) {
        const { give, get } = adjustedOffer(i);
        const fmt = (o) => Object.entries(o).map(([k, v]) => `${v} ${k}`).join(', ');
        const afford = Object.entries(give).every(([k, v]) => G.res[k] >= v);
        const bg = focused ? '#22304a' : '#141a24';
        if (focused) fillBg(x0, wd.rect.y, w, 1, bg);
        str(x0 + 1, wd.rect.y, `${focused ? '►' : ' '}${i + 1}) ${fmt(give).padEnd(12)} → ${fmt(get)}`, afford ? (focused ? '#ffe8a0' : '#c8c2b0') : '#5a5f6a', bg);
      },
    })),
    keymap: { Escape: () => pop(), e: () => pop() },
    onKey(k) {
      const i = +k - 1;
      if (i >= 0 && i < TRADE.length) doTrade(i);
    },
    draw(f) {
      fillBg(x0, y0, w, TRADE.length + 4, '#141a24');
      str(x0 + 1, y0, `¤ TRADER — press 1-${TRADE.length} to deal`, '#ffd860', '#141a24');
      str(x0 + 1, y0 + 1, `your coin: ${G.res.coin}${isWinter() ? '   ❄ food is dear in winter' : ''}`, '#d8c860', '#141a24');
      drawWidgets(this, f);
      str(x0 + 1, y0 + TRADE.length + 2, hasPerk('friends') ? 'Trader Friends: prices improved' : 'Esc to close', '#8a94a2', '#141a24');
      drawNotice();
    },
  };
  return scr;
}

function makeIntroModal() {
  const close = () => { pop(); tip('welcome'); };
  return {
    id: 'intro', modal: true, pausesSim: true, listNav: false,
    keymap: { Enter: close, Escape: close, ' ': close },
    onClick: close,
    draw(f) {
      const civ = CIVS.find(c => c.id === G.civ);
      const bw = 60, bh = INTRO.length + 9;
      const x0 = ((GRID_W - bw) / 2) | 0, y0 = ((GRID_H - bh) / 2) | 0;
      fillBg(x0, y0, bw, bh, '#12151e');
      const title = `— ${civ ? civ.name : 'The Commune'} —`;
      str(x0 + (((bw - title.length) / 2) | 0), y0 + 1, title, civ ? civ.fg : '#ffd860', '#12151e');
      INTRO.forEach((l, i) => str(x0 + 4, y0 + 3 + i, l, '#c8c2b0', '#12151e'));
      str(x0 + 4, y0 + bh - 4, 'Your first steps wait in the OBJECTIVE box, top right.', '#ffd870', '#12151e');
      const go = '[Enter] light the fire';
      str(x0 + (((bw - go.length) / 2) | 0), y0 + bh - 2, go, (f >> 4) % 2 ? '#8ad080' : '#5a8a60', '#12151e');
    },
  };
}

function makeHelpModal() {
  const close = () => pop();
  const lines = [
    ['HEARTHFALL — how to run a commune', '#ffd860'],
    ['', ''],
    ['Keep everyone fed, build defenses, survive the raids, and send', '#b8b2a0'],
    ['parties into the world. When the commune falls, its story becomes', '#b8b2a0'],
    ['legacy — spend it on permanent perks for the next run. Your elder', '#b8b2a0'],
    ['speaks in the sidebar: one counsel at a time. The sidebar also', '#b8b2a0'],
    ['shows what dusk brings, how long the food lasts, and when the', '#b8b2a0'],
    ['next wanderer arrives. Click the morale bar to hear why.', '#b8b2a0'],
    ['', ''],
    ['drag    a box on the map → orders menu: chop ♠ · mine ▲ ·', '#c8c2b0'],
    ['        forage " · fish ≈ · clear marks (Esc to cancel)', '#c8c2b0'],
    ['b       build menu · tabs (←→): HOMES FOOD DEFENSE WORKS', '#c8c2b0'],
    ['x       demolish structures / cancel single plans', '#c8c2b0'],
    ['r       ring the alarm bell — folk to the fire, guards to posts', '#c8c2b0'],
    ['w       world map — scout (1 settler) or raid (a party)', '#c8c2b0'],
    ['e       trade with the visiting caravan (every few days)', '#c8c2b0'],
    ['Esc     pause menu — save, settings, help, quit', '#c8c2b0'],
    ['space   pause · 1/2/3 game speed', '#c8c2b0'],
    ['v       toggle graphics: pixel tiles / classic ASCII', '#c8c2b0'],
    ['pan     trackpad/wheel · shift+arrows · middle-drag · minimap (n)', '#c8c2b0'],
    ['Q       save & quit to the main menu (progress kept)', '#c8c2b0'],
    ['click a settler name in the sidebar to change role', '#c8c2b0'],
    ['click a workshop on the map to order spears and medkits', '#c8c2b0'],
    ['', ''],
    ['Controller: stick/d-pad cursor · A act · B back · X build', '#8a94a2'],
    ['Y world · LB/RB cycle tool · LT/RT speed · Start pause', '#8a94a2'],
    ['', ''],
    ['Seasons: 5 days each. In WINTER crops stop and bushes sleep —', '#a8c8e8'],
    ['stockpile in autumn, fish the river, or starve. Morale sinks with', '#a8c8e8'],
    ['deaths and hunger: broken communes bleed deserters.', '#a8c8e8'],
    ['', ''],
    ['Raiders: brutes Ø smash walls · skirmishers § slip open gaps and', '#e0a080'],
    ['steal · torch-bearers ¡ burn wood (stone won’t). Every 12th day a', '#e0a080'],
    ['HORDE marches behind a warlord ☠ — fell him and they break.', '#e0a080'],
    ['Fallen settlers may be DOWN, not dead: guard them, they crawl home.', '#e0a080'],
    ['', ''],
    ['Homes: settlers sleep INSIDE houses — tents ∩ hold 2, cabins Λ 3,', '#8a94a2'],
    ['longhouses Π 5 (better rest each). No roof = sleeping rough. New', '#8a94a2'],
    ['folk only join when the houses have room. Economy: crops → kitchen', '#8a94a2'],
    ['meals · herbs → medkits · 6 settlers = tier II, 9 = tier III.', '#8a94a2'],
    ['Clearing bandit camps quiets raids; camps left standing grow', '#8a94a2'],
    ['bolder. At tier III, raise the Beacon and hold 3 days to win.', '#8a94a2'],
    ['', ''],
    ['press ? or Esc to close', '#e8c860'],
  ];
  return {
    id: 'help', modal: true, pausesSim: true,
    keymap: { Escape: close, '?': close, Enter: close },
    onClick: close,
    draw() {
      const bw = 70, bh = lines.length + 2;
      const x0 = ((GRID_W - bw) / 2) | 0, y0 = ((GRID_H - bh) / 2) | 0;
      fillBg(x0, y0, bw, bh, '#12151e');
      lines.forEach((l, i) => str(x0 + 2, y0 + 1 + i, l[0], l[1] || '#b8b2a0', '#12151e'));
    },
  };
}

export function makeGameOverModal() {
  const toCiv = () => replaceAll(makeMenuScreen(), makeCivScreen());
  const toMenu = () => replaceAll(makeMenuScreen());
  return {
    id: 'gameover', modal: true, pausesSim: true,
    keymap: { r: toCiv, R: toCiv, Enter: toCiv, m: toMenu, M: toMenu, Escape: toMenu },
    draw() {
      const win = G.victory;
      const feats = G.bonusLines || [];
      const bw = 48, bh = 11 + Math.min(6, feats.length ? feats.length + 1 : 0);
      const bg = win ? '#14120a' : '#1a0e0e';
      const x0 = ((GRID_W - bw) / 2) | 0, y0 = ((GRID_H - bh) / 2) | 0;
      fillBg(x0, y0, bw, bh, bg);
      let y = y0 + 1;
      if (win) {
        str(x0 + 2, y, '☼ THE BEACON HELD — VICTORY', '#ffe060', bg);
        y += 2;
        str(x0 + 2, y++, `Your people pass into legend after ${G.day} days.`, '#c8c2b0', bg);
      } else {
        str(x0 + 2, y, 'THE COMMUNE HAS FALLEN', '#ff5040', bg);
        y += 2;
        str(x0 + 2, y++, `You survived ${G.day} day${G.day === 1 ? '' : 's'}.`, '#c8c2b0', bg);
      }
      const st = G.stats;
      str(x0 + 2, y++, `${st.raids} raids repelled · ${st.sites} sites cleared · ${st.kills} kills`, '#8a94a2', bg);
      if (feats.length) {
        y++;
        for (const [label, pts] of feats.slice(0, 5)) {
          str(x0 + 2, y++, `◆${pts}  ${label}`, '#e8d8a0', bg);
        }
      }
      y++;
      str(x0 + 2, y, `◆${G.legacyEarned} legacy earned (total ◆${META.points})`, '#c8a0e8', bg);
      y += 2;
      str(x0 + 2, y, '[R] rise again    [M] main menu', '#e8c860', bg);
    },
  };
}
