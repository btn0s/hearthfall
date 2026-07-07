// Full-ASCII renderer: everything (map, sidebar, log, menus, world screen,
// title/civ/legacy screens) drawn into one character-cell buffer, then painted.
import { G, tileAt, inMap, timeStr, isNight, buildDef, communeTier, hasSave, adjustedOffer } from './game.js';
import { MAP_W, MAP_H, VIEW_W, VIEW_H, CELL_W, CELL_H, T, BUILDS, COST_ABBR, ROLE_COLORS, ROLE_LETTER, LOCTYPES, CIVS, PERKS, TRADE, OBJECTIVES, INTRO } from './data.js';
import { WORLD_W, WORLD_H, partyPower, riskLabel } from './world.js';
import { META, hasPerk } from './meta.js';
import { drawMapTiles } from './tiles.js';

export const GRID_W = 100, GRID_H = 45;

// graphics mode: 'tiles' (sprite art) or 'ascii', persisted across sessions
export const GFX = { mode: (() => { try { return localStorage.getItem('hearthfall.gfx') || 'tiles'; } catch (e) { return 'tiles'; } })() };
export function toggleGfx() {
  GFX.mode = GFX.mode === 'tiles' ? 'ascii' : 'tiles';
  try { localStorage.setItem('hearthfall.gfx', GFX.mode); } catch (e) { /* ignore */ }
}
const SB_X = 74;
const LOG_Y = VIEW_H + 1;

// corner minimap (AoE style), toggled with n
export const MM = {
  w: 26, h: 14,
  on: (() => { try { return localStorage.getItem('hearthfall.minimap') !== 'off'; } catch (e) { return true; } })(),
};
export function toggleMinimap() {
  MM.on = !MM.on;
  try { localStorage.setItem('hearthfall.minimap', MM.on ? 'on' : 'off'); } catch (e) { /* ignore */ }
}

const DEFAULT_BG = '#0c0d10';
const N = GRID_W * GRID_H;
const chs = new Array(N).fill(' ');
const fgs = new Array(N).fill('#888');
const bgs = new Array(N).fill(DEFAULT_BG);

// clickable regions recomputed each frame; ui.js reads these
export const hit = { settlers: [], buildMenu: [], worldList: [], party: [], partyLaunch: -1, menu: [], trade: [], minimap: null };

let canvas = null, ctx = null, f = 0;

export function setupRender(cv) {
  canvas = cv;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = GRID_W * CELL_W * dpr;
  canvas.height = GRID_H * CELL_H * dpr;
  canvas.style.width = GRID_W * CELL_W + 'px';
  canvas.style.height = GRID_H * CELL_H + 'px';
  ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
}

export function canvasCell(e) {
  const r = canvas.getBoundingClientRect();
  return {
    cx: Math.floor((e.clientX - r.left) / r.width * GRID_W),
    cy: Math.floor((e.clientY - r.top) / r.height * GRID_H),
  };
}

function put(x, y, ch, fg, bg) {
  if (x < 0 || y < 0 || x >= GRID_W || y >= GRID_H) return;
  const i = y * GRID_W + x;
  chs[i] = ch; fgs[i] = fg;
  if (bg !== undefined) bgs[i] = bg;
}
function str(x, y, text, fg, bg) {
  for (let i = 0; i < text.length; i++) put(x + i, y, text[i], fg, bg);
}
function fillBg(x0, y0, w, h, bg) {
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
    if (x < 0 || y < 0 || x >= GRID_W || y >= GRID_H) continue;
    const i = y * GRID_W + x;
    chs[i] = ' '; bgs[i] = bg;
  }
}

const dimCache = new Map();
function dim(hex, k) {
  const key = hex + '|' + k;
  let v = dimCache.get(key);
  if (!v) {
    const r = (parseInt(hex.slice(1, 3), 16) * k) | 0;
    const g = (parseInt(hex.slice(3, 5), 16) * k) | 0;
    const b = (parseInt(hex.slice(5, 7), 16) * k) | 0;
    v = `rgb(${r},${g},${b})`;
    dimCache.set(key, v);
  }
  return v;
}

function clearBuf() {
  for (let i = 0; i < N; i++) { chs[i] = ' '; fgs[i] = '#888'; bgs[i] = DEFAULT_BG; }
}

// ---------------------------------------------------------------- big font
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
  return x - x0;
}

// ---------------------------------------------------------------- base map
function drawMap() {
  const night = isNight();
  const tf = night ? 0.5 : 1, ef = night ? 0.75 : 1;
  const cam = G.cam;
  for (let sy = 0; sy < VIEW_H; sy++) for (let sx = 0; sx < VIEW_W; sx++) {
    const x = cam.x + sx, y = cam.y + sy;
    const tl = tileAt(x, y);
    const d = T[tl.t];
    let ch = d.ch, fg = d.fg, bg = d.bg;
    if (tl.t === 'tree') ch = ((x * 7 + y * 11) % 3 === 0) ? '♣' : '♠';
    if (tl.t === 'water') ch = ((x + y + (f >> 4)) % 2) ? '≈' : '~';
    if (tl.t === 'campfire') fg = ['#ff9030', '#ffc040', '#e06020'][(f >> 2) % 3];
    if (tl.t === 'farm') {
      const g = tl.growth || 0;
      if (g >= 100) { ch = 'Ψ'; fg = '#e8d060'; }
      else if (g >= 60) { ch = ';'; fg = '#8fb050'; }
      else if (g >= 25) { ch = ','; fg = '#6a9040'; }
      else { ch = '.'; fg = '#5a7a3a'; }
    }
    if (tl.build) { ch = T[tl.build.id] ? T[tl.build.id].ch : '?'; fg = '#565664'; }
    if (tl.desig) fg = '#e8c860';
    put(sx, sy, ch, dim(fg, tf), dim(bg, tf));
  }
  const onScreen = (x, y) => x >= cam.x && y >= cam.y && x < cam.x + VIEW_W && y < cam.y + VIEW_H;
  if (G.trader && onScreen(G.trader.x, G.trader.y)) put(G.trader.x - cam.x, G.trader.y - cam.y, '☺', '#ffd860');
  for (const r of G.raiders) {
    if (onScreen(r.x, r.y)) put(r.x - cam.x, r.y - cam.y, '☻', dim('#e05040', ef));
  }
  for (const s of G.settlers) {
    if (s.away || !onScreen(s.x, s.y)) continue;
    let fg = ROLE_COLORS[s.role] || '#d8d2c0';
    if (s.sleeping) fg = '#5a6a90';
    if (s.starving && (f >> 3) % 2) fg = '#e05040';
    put(s.x - cam.x, s.y - cam.y, '☺', dim(fg, s.sleeping ? 1 : ef));
  }
  const c = G.cursor;
  if (inMap(c.x, c.y) && onScreen(c.x, c.y)) {
    bgs[(c.y - cam.y) * GRID_W + (c.x - cam.x)] = '#2a3244';
  }
}

// minimap colors per tile type
const MM_COL = {
  water: '#264a78', tree: '#1d4419', bush: '#2b5c33', rock: '#63635e',
  grass: '#243719', grass2: '#283d1c', dirt: '#3a2f1e', floor: '#5b4530',
  wall_w: '#96703f', wall_s: '#9c9c94', door: '#c89b4f', farm: '#7a5230',
  bed: '#b28457', campfire: '#ff9030', post: '#c5b573', trap: '#8a93a0',
  workshop: '#c08a50', kitchen: '#d0a060',
};

function drawMinimap() {
  if (!MM.on) { hit.minimap = null; return; }
  const x0 = 1, y0 = VIEW_H - MM.h - 1;
  const sx = MAP_W / MM.w, sy = MAP_H / MM.h;
  hit.minimap = { x0, y0, w: MM.w, h: MM.h, sx, sy };
  for (let my = 0; my < MM.h; my++) for (let mx = 0; mx < MM.w; mx++) {
    const t = tileAt(Math.min(MAP_W - 1, (mx * sx + sx / 2) | 0), Math.min(MAP_H - 1, (my * sy + sy / 2) | 0)).t;
    put(x0 + mx, y0 + my, ' ', '#000', MM_COL[t] || '#243719');
  }
  // viewport rectangle
  const vx0 = Math.round(G.cam.x / sx), vx1 = Math.min(MM.w - 1, Math.round((G.cam.x + VIEW_W) / sx) - 1);
  const vy0 = Math.round(G.cam.y / sy), vy1 = Math.min(MM.h - 1, Math.round((G.cam.y + VIEW_H) / sy) - 1);
  for (let mx = vx0; mx <= vx1; mx++) {
    put(x0 + mx, y0 + vy0, mx === vx0 ? '┌' : mx === vx1 ? '┐' : '─', '#e8e8d8');
    if (vy1 !== vy0) put(x0 + mx, y0 + vy1, mx === vx0 ? '└' : mx === vx1 ? '┘' : '─', '#e8e8d8');
  }
  for (let my = vy0 + 1; my < vy1; my++) {
    put(x0 + vx0, y0 + my, '│', '#e8e8d8');
    put(x0 + vx1, y0 + my, '│', '#e8e8d8');
  }
  // entities
  const dot = (x, y, ch, fg) => put(x0 + Math.min(MM.w - 1, (x / sx) | 0), y0 + Math.min(MM.h - 1, (y / sy) | 0), ch, fg);
  for (const s of G.settlers) if (!s.away) dot(s.x, s.y, '·', '#e8e8d8');
  for (const r of G.raiders) dot(r.x, r.y, '•', (f >> 3) % 2 ? '#ff5040' : '#c03028');
  dot(G.camp.x, G.camp.y, '☼', '#ffd860');
}

function drawNotice() {
  if (G.notice && G.notice.until > performance.now()) {
    const t = ' ' + G.notice.text + ' ';
    str(Math.max(0, ((VIEW_W - t.length) / 2) | 0), VIEW_H - 1, t, '#ffd870', '#402018');
  }
}

function drawFrameLines() {
  for (let y = 0; y < GRID_H; y++) put(VIEW_W, y, '│', '#3a3f4a');
  for (let x = 0; x < VIEW_W; x++) put(x, VIEW_H, '─', '#3a3f4a');
  put(VIEW_W, VIEW_H, '┤', '#3a3f4a');
}

function inspectText() {
  const { x, y } = G.cursor;
  if (!inMap(x, y)) return '';
  const tl = tileAt(x, y);
  const parts = [T[tl.t].name];
  if (tl.t === 'farm') parts.push(`crop ${Math.min(100, (tl.growth || 0)) | 0}%`);
  if (tl.hp !== undefined && T[tl.t].hp) parts.push(`hp ${Math.max(0, tl.hp)}`);
  if (tl.build) parts.push(`plan: ${buildDef(tl.build.id).name}`);
  if (tl.desig) parts.push(`marked: ${tl.desig}`);
  if (G.trader && G.trader.x === x && G.trader.y === y) parts.push('☺ trader (e to trade)');
  for (const s of G.settlers) {
    if (!s.away && s.x === x && s.y === y) parts.push(`☺ ${s.name} (${s.role}) hp${Math.ceil(s.hp)}${s.sleeping ? ' zzz' : ''}`);
  }
  for (const r of G.raiders) if (r.x === x && r.y === y) parts.push(`☻ raider hp${r.hp}`);
  return parts.join(' · ');
}

function drawLog() {
  str(1, LOG_Y, inspectText().slice(0, VIEW_W - 2), '#7f8b99');
  const rows = 5;
  const tail = G.log.slice(-rows);
  for (let i = 0; i < tail.length; i++) {
    const age = tail.length - 1 - i;
    const k = age === 0 ? 1 : (age === 1 ? 0.8 : 0.55);
    str(1, LOG_Y + 1 + (rows - tail.length) + i, tail[i].text.slice(0, VIEW_W - 2), dim(tail[i].fg, k));
  }
}

// ---------------------------------------------------------------- sidebar
function hpBar(hp, max, w) {
  const filled = Math.max(0, Math.min(w, Math.ceil(hp / max * w)));
  const col = hp / max > 0.6 ? '#6ac060' : hp / max > 0.3 ? '#e0c060' : '#e05040';
  return { filled, col };
}

function drawSidebar() {
  hit.settlers.length = 0;
  let y = 0;
  const civ = CIVS.find(c => c.id === G.civ);
  str(SB_X, y++, `☼ HEARTHFALL`, '#ffd860');
  const spd = G.paused ? ((f >> 4) % 2 ? '‖ PAUSED' : '        ') : '▶'.repeat(G.speed);
  str(SB_X, y++, `Day ${G.day}  ${timeStr()}  ${spd}`, G.paused ? '#e0a040' : '#b8b2a0');
  const tier = communeTier();
  const tierStr = tier === 3 ? 'Tier III' : tier === 2 ? 'Tier II (9☺→III)' : 'Tier I (6☺→II)';
  const civName = civ ? civ.name.replace('The ', '') : '';
  str(SB_X, y++, `${civName} · ${tierStr}`.slice(0, 26), civ ? civ.fg : '#b8b2a0');
  str(SB_X, y++, '─'.repeat(25), '#3a3f4a');
  const R = G.res;
  str(SB_X, y++, `Food ${String(R.food).padEnd(4)}Meals ${R.meals}`, '#c8c2b0');
  str(SB_X, y++, `Wood ${String(R.wood).padEnd(4)}Stone ${R.stone}`, '#a8a296');
  str(SB_X, y++, `Scrap ${String(R.scrap).padEnd(3)}Herbs ${R.herbs}`, '#a8a296');
  str(SB_X, y++, `Coin ${String(R.coin).padEnd(4)}Wpn ${R.weapons}  Med ${R.meds}`, '#d8c860');
  if (G.raidActive) str(SB_X, y++, `⚠ RAIDERS: ${G.raiders.length}`, (f >> 3) % 2 ? '#ff5040' : '#a03028');
  if (G.trader) str(SB_X, y++, '¤ trader in camp — e trade', '#ffd860');
  if (G.craftQueue.length) str(SB_X, y++, `Ω workshop queue: ${G.craftQueue.length}`, '#c08a50');
  // objective tracker
  if (G.objIdx < OBJECTIVES.length) {
    const o = OBJECTIVES[G.objIdx];
    const flash = G.objFlash > performance.now();
    str(SB_X, y++, '─ OBJECTIVE ' + '─'.repeat(13), flash ? '#3a5a42' : '#3a3f4a');
    const pr = o.prog ? o.prog(G) : null;
    const title = `► ${o.text}${pr ? ` (${pr[0]}/${pr[1]})` : ''}`;
    str(SB_X, y++, title.slice(0, 26), flash ? '#8ad080' : '#ffd870');
    str(SB_X, y++, `  ${o.hint}`.slice(0, 26), '#8a94a2');
  } else if (OBJECTIVES.length) {
    str(SB_X, y++, '◆ all objectives complete', '#c8a0e8');
  }
  str(SB_X, y++, `─ SETTLERS (${G.settlers.length}) ` + '─'.repeat(Math.max(0, 10 - String(G.settlers.length).length)), '#3a3f4a');
  for (const s of G.settlers.slice(0, 14)) {
    const bar = hpBar(s.hp, s.maxHp, 6);
    let status = '';
    if (s.away) status = '→away';
    else if (s.sleeping) status = 'zzz';
    else if (s.starving) status = 'HUNGRY';
    else if (s.task) status = s.task.kind;
    const nm = s.name.padEnd(7).slice(0, 7);
    str(SB_X, y, `☺${nm}${ROLE_LETTER[s.role]} `, s.away ? '#6a7484' : (ROLE_COLORS[s.role] || '#d8d2c0'));
    str(SB_X + 10, y, '█'.repeat(bar.filled), bar.col);
    str(SB_X + 10 + bar.filled, y, '░'.repeat(6 - bar.filled), '#3a3f4a');
    str(SB_X + 17, y, status.slice(0, 8), '#8a94a2');
    hit.settlers.push({ y, id: s.id });
    y++;
  }
  if (G.expeditions.length) {
    str(SB_X, y++, '─ EXPEDITIONS ' + '─'.repeat(11), '#3a3f4a');
    for (const e of G.expeditions) {
      const loc = G.world.locs[e.locIdx];
      const dir = e.phase === 'out' ? '►out' : '◄home';
      str(SB_X, y++, `⚑ ${loc.name.slice(0, 13)} ${dir} ${(e.t / 1440).toFixed(1)}d`, '#9ac0d8');
    }
  }
  let hy = GRID_H - 6;
  str(SB_X, hy - 1, '─'.repeat(25), '#3a3f4a');
  const hint = (a, b) => { str(SB_X, hy++, a, '#8a94a2'); if (b) str(SB_X, hy++, b, '#8a94a2'); };
  if (G.mode === 'BUILD') {
    str(SB_X, hy++, 'MODE: BUILD', '#e8c860');
    hint(G.buildSel ? `→ ${G.buildSel.name}` : 'pick a-m from menu');
    hint('click/drag map to place', 'Esc to finish');
  } else if (G.mode === 'CHOP') {
    str(SB_X, hy++, 'MODE: CHOP', '#e8c860');
    hint('drag across trees ♠', 'Esc done');
  } else if (G.mode === 'MINE') {
    str(SB_X, hy++, 'MODE: MINE', '#e8c860');
    hint('drag across rocks ▲', 'Esc done');
  } else if (G.mode === 'FORAGE') {
    str(SB_X, hy++, 'MODE: FORAGE', '#e8c860');
    hint('drag across bushes "', 'Esc done');
  } else if (G.mode === 'CANCEL') {
    str(SB_X, hy++, 'MODE: CANCEL/DEMOLISH', '#e8c860');
    hint('click plans/structures', 'Esc done');
  } else if (G.mode === 'TRADE') {
    str(SB_X, hy++, 'MODE: TRADE', '#ffd860');
    hint('1-7 to trade', 'Esc close');
  } else {
    hint('b build t chop m mine', 'g forage x cancel w world');
    hint('e trade v gfx n minimap', 'pan: wheel · shift+arrows');
    hint('? help · spc pause', 'click name → role');
  }
}

// ---------------------------------------------------------------- build menu
function drawBuildMenu() {
  hit.buildMenu.length = 0;
  const x0 = 1, y0 = 1, w = 36;
  const tier = communeTier();
  // an item is selected: collapse to a one-line bar so the map stays visible
  if (G.buildSel) {
    const cost = Object.entries(G.buildSel.cost).map(([k, v]) => v + (COST_ABBR[k] || k)).join(' ');
    fillBg(x0, y0, w, 1, '#12141c');
    str(x0 + 1, y0, `BUILD: ${G.buildSel.name} (${cost}) · Esc = menu`, '#e8c860', '#12141c');
    return;
  }
  fillBg(x0, y0, w, BUILDS.length + 2, '#12141c');
  str(x0 + 1, y0, 'BUILD — click map to place', '#e8c860');
  BUILDS.forEach((b, i) => {
    const y = y0 + 1 + i;
    const afford = Object.entries(b.cost).every(([k, v]) => G.res[k] >= v);
    const locked = b.tier && b.tier > tier;
    const sel = G.buildSel === b;
    const focus = !G.buildSel && i === G.buildFocus;
    if (sel || focus) fillBg(x0, y, w, 1, sel ? '#2a3550' : '#1c2230');
    const bg = sel ? '#2a3550' : focus ? '#1c2230' : '#12141c';
    const cost = Object.entries(b.cost).map(([k, v]) => v + (COST_ABBR[k] || k)).join(' ');
    const glyph = T[b.id] ? T[b.id].ch : '/';
    const tag = locked ? ` T${b.tier}!` : (b.craft ? ' ⚒' : '');
    let fg = afford && !locked ? (sel || focus ? '#ffe8a0' : '#c8c2b0') : '#5a5f6a';
    str(x0 + 1, y, `${focus ? '►' : ' '}${b.key}) ${glyph} ${b.name.padEnd(12)} ${cost}${tag}`, fg, bg);
    hit.buildMenu.push({ y, idx: i, x0, x1: x0 + w });
  });
}

// ---------------------------------------------------------------- trade
function drawTrade() {
  hit.trade.length = 0;
  const x0 = 4, y0 = 4, w = 40;
  fillBg(x0, y0, w, TRADE.length + 4, '#141a24');
  str(x0 + 1, y0, '¤ TRADER — press 1-7 to deal', '#ffd860', '#141a24');
  str(x0 + 1, y0 + 1, `your coin: ${G.res.coin}`, '#d8c860', '#141a24');
  const fmt = (o) => Object.entries(o).map(([k, v]) => `${v} ${k}`).join(', ');
  TRADE.forEach((_, i) => {
    const { give, get } = adjustedOffer(i);
    const y = y0 + 2 + i;
    const afford = Object.entries(give).every(([k, v]) => G.res[k] >= v);
    const focus = i === G.tradeSel;
    if (focus) fillBg(x0, y, w, 1, '#22304a');
    const bg = focus ? '#22304a' : '#141a24';
    str(x0 + 1, y, `${focus ? '►' : ' '}${i + 1}) ${fmt(give).padEnd(12)} → ${fmt(get)}`, afford ? (focus ? '#ffe8a0' : '#c8c2b0') : '#5a5f6a', bg);
    hit.trade.push({ y, idx: i, x0, x1: x0 + w });
  });
  str(x0 + 1, y0 + TRADE.length + 2, hasPerk('friends') ? 'Trader Friends: prices improved' : 'Esc to close', '#8a94a2', '#141a24');
}

// ---------------------------------------------------------------- world screen
function drawWorld() {
  hit.worldList.length = 0;
  hit.party.length = 0;
  hit.partyLaunch = -1;
  const w = G.world;
  str(2, 0, '☼ WORLD MAP — ↑↓ select · Enter send party · Esc back', '#ffd860');
  const ox = 2, oy = 2;
  const TERR = { '.': '#3a4434', '♠': '#2e6b2a', '^': '#8d8d85', '≈': '#3a6fb0' };
  for (let y = 0; y < WORLD_H; y++) for (let x = 0; x < WORLD_W; x++) {
    const ch = w.grid[y][x];
    put(ox + x, oy + y, ch, TERR[ch] || '#3a4434', '#0b0d0f');
  }
  w.locs.forEach((l, i) => {
    const lt = LOCTYPES[l.type];
    const sel = i === G.selLoc;
    const bg = sel && (f >> 4) % 2 ? '#3a4560' : '#0b0d0f';
    if (l.cleared) put(ox + l.x, oy + l.y, '×', '#555a60', bg);
    else put(ox + l.x, oy + l.y, lt.ch, lt.fg, bg);
  });
  put(ox + w.base.x, oy + w.base.y, '☼', '#ffd860', '#0b0d0f');
  for (const e of G.expeditions) {
    const loc = w.locs[e.locIdx];
    const frac = e.phase === 'out' ? 1 - e.t / e.total : e.t / e.total;
    const x = Math.round(w.base.x + (loc.x - w.base.x) * frac);
    const y = Math.round(w.base.y + (loc.y - w.base.y) * frac);
    put(ox + x, oy + y, '☺', '#7ad0e8');
  }

  const px = 56;
  str(px, 2, 'KNOWN LOCATIONS', '#c8c2b0');
  w.locs.forEach((l, i) => {
    const y = 3 + i;
    const lt = LOCTYPES[l.type];
    const sel = i === G.selLoc;
    const stars = '★'.repeat(Math.max(1, Math.min(5, Math.round(l.diff / 3))));
    const fg = l.cleared ? '#555a60' : (sel ? '#ffe8a0' : '#b8b2a0');
    if (sel) fillBg(px - 1, y, 42, 1, '#22283a');
    str(px, y, `${sel ? '►' : ' '}${lt.ch} ${l.name.padEnd(15)} ${l.cleared ? '✓done' : stars}`, fg, sel ? '#22283a' : undefined);
    hit.worldList.push({ y, idx: i });
  });
  const sel = w.locs[G.selLoc];
  let dy = 4 + w.locs.length;
  if (sel) {
    const lt = LOCTYPES[sel.type];
    str(px, dy++, `${lt.name}: "${sel.name}"`, lt.fg);
    str(px, dy++, lt.desc.slice(0, 42), '#8a94a2');
    str(px, dy++, `Danger ~${sel.diff}   Travel ${(sel.travel / 1440).toFixed(1)}d each way`, '#a8a296');
    const home = G.settlers.filter(s => !s.away);
    str(px, dy++, `${home.length} settlers available at home`, '#8a94a2');
  }
  dy++;
  for (const e of G.expeditions) {
    const loc = w.locs[e.locIdx];
    str(px, dy++, `⚑ ${loc.name}: ${e.phase === 'out' ? 'traveling out' : 'heading home'} ${(e.t / 1440).toFixed(1)}d`, '#9ac0d8');
  }

  const tail = G.log.slice(-4);
  for (let i = 0; i < tail.length; i++) str(2, GRID_H - 5 + i, tail[i].text.slice(0, GRID_W - 4), dim(tail[i].fg, i === tail.length - 1 ? 1 : 0.6));

  if (G.partyOpen && sel) drawPartyOverlay(sel);
}

function drawPartyOverlay(loc) {
  const avail = G.settlers.filter(s => !s.away);
  const bw = 46, bh = avail.length + 6;
  const x0 = ((GRID_W - bw) / 2) | 0, y0 = ((GRID_H - bh) / 2) | 0;
  fillBg(x0, y0, bw, bh, '#141824');
  str(x0 + 1, y0, `SEND PARTY → ${loc.name}`, '#ffd860', '#141824');
  str(x0 + 1, y0 + 1, 'press 1-9 (or click) to toggle members', '#8a94a2', '#141824');
  avail.forEach((s, i) => {
    const y = y0 + 2 + i;
    const on = G.party.has(s.id);
    const focus = i === G.partySel;
    const bg = focus ? '#22304a' : '#141824';
    if (focus) fillBg(x0, y, bw, 1, bg);
    str(x0 + 1, y, `${focus ? '►' : ' '}${i + 1} [${on ? 'x' : ' '}] ${s.name.padEnd(8)} ${s.role.padEnd(6)} hp${String(Math.ceil(s.hp)).padEnd(3)}`, on ? '#ffe8a0' : '#b8b2a0', bg);
    hit.party.push({ y, id: s.id, x0, x1: x0 + bw });
  });
  const members = avail.filter(s => G.party.has(s.id));
  const pw = Math.round(partyPower(members));
  const risk = members.length ? riskLabel(pw, loc.diff) : { label: '—', fg: '#8a94a2' };
  str(x0 + 1, y0 + bh - 3, `Party power ~${pw} vs danger ~${Math.round(loc.diff * 2.6)}  Risk: ${risk.label}`, risk.fg, '#141824');
  const launchFocus = G.partySel >= avail.length;
  if (launchFocus) fillBg(x0, y0 + bh - 2, bw, 1, '#22304a');
  str(x0 + 1, y0 + bh - 2, `${launchFocus ? '►' : ' '}[Enter] LAUNCH    [Esc] cancel`, '#8ad080', launchFocus ? '#22304a' : '#141824');
  hit.partyLaunch = y0 + bh - 2;
}

// ---------------------------------------------------------------- title screens
function drawMenu() {
  hit.menu.length = 0;
  const flame = ['#ffdf70', '#ffc050', '#ff9030', '#e06020', '#b04818'];
  const ww = 10 * 4 - 1;
  const tx = ((GRID_W - ww) / 2) | 0;
  put(((GRID_W) / 2) | 0, 3, '‼', flame[(f >> 3) % 3]);
  drawBig(tx, 5, 'HEARTHFALL', flame);
  str(((GRID_W - 42) / 2) | 0, 11, 'an ashes-and-embers commune survival sim', '#8a94a2');

  const ox = ((GRID_W - 34) / 2) | 0;
  let y = 15, idx = 0;
  const opt = (key, label, fg, action) => {
    const focus = idx === G.menuSel;
    if (focus) fillBg(ox - 2, y, 38, 1, '#1c2230');
    str(ox - 2, y, focus ? '►' : ' ', '#ffd860', focus ? '#1c2230' : undefined);
    str(ox, y, `${key})  ${label}`, focus ? '#ffe8a0' : fg, focus ? '#1c2230' : undefined);
    hit.menu.push({ y, action });
    y += 2; idx++;
  };
  opt('n', 'New Game', '#e8d8a0', 'new');
  opt('c', hasSave() ? 'Continue' : 'Continue  (no save)', hasSave() ? '#e8d8a0' : '#5a5f6a', 'continue');
  opt('l', `Legacy Perks   ◆${META.points}`, '#c8a0e8', 'legacy');
  opt('v', `Graphics: ${GFX.mode === 'tiles' ? 'Tiles' : 'ASCII'}`, '#9ac0d8', 'gfx');
  opt('?', 'How to play', '#8a94a2', 'help');

  str(((GRID_W - 40) / 2) | 0, GRID_H - 4,
    `runs: ${META.runs}   best: ${META.bestDays} days   legacy: ◆${META.points}`, '#6a7484');
  if (META.runs === 0) str(((GRID_W - 46) / 2) | 0, GRID_H - 2, 'every fall of the commune earns legacy to spend', '#4a5560');
}

function drawCiv() {
  hit.menu.length = 0;
  str(((GRID_W - 18) / 2) | 0, 2, 'CHOOSE YOUR PEOPLE', '#ffd860');
  const ox = 20;
  let y = 6;
  CIVS.forEach((c, i) => {
    const focus = i === G.civSel;
    if (focus) fillBg(ox - 2, y, 62, 3, '#1c2230');
    const bg = focus ? '#1c2230' : undefined;
    str(ox - 2, y, focus ? '►' : ' ', '#ffd860', bg);
    str(ox, y, `${i + 1})  ${c.ch} ${c.name}`, focus ? '#ffe8a0' : c.fg, bg);
    hit.menu.push({ y, action: 'civ', arg: c.id });
    str(ox + 4, y + 1, c.desc, '#8a94a2', bg);
    str(ox + 4, y + 2, c.desc2, '#8a94a2', bg);
    hit.menu.push({ y: y + 1, action: 'civ', arg: c.id });
    hit.menu.push({ y: y + 2, action: 'civ', arg: c.id });
    y += 4;
  });
  const perks = PERKS.filter(p => hasPerk(p.id));
  if (perks.length) {
    str(ox, y + 1, `Legacy carried in: ${perks.map(p => p.name).join(' · ')}`.slice(0, 70), '#c8a0e8');
  }
  str(ox, GRID_H - 3, 'press 1-4 (or click) · Esc back', '#8a94a2');
}

function drawLegacy() {
  hit.menu.length = 0;
  str(((GRID_W - 12) / 2) | 0, 2, 'LEGACY PERKS', '#c8a0e8');
  str(((GRID_W - 30) / 2) | 0, 4, `◆${META.points} legacy to spend — permanent, every run`, '#b8b2a0');
  const ox = 18;
  let y = 7;
  PERKS.forEach((p, i) => {
    const owned = hasPerk(p.id);
    const afford = META.points >= p.cost;
    const focus = i === G.perkSel;
    if (focus) fillBg(ox - 2, y, 70, 1, '#1c2230');
    const fg = owned ? '#8ad080' : afford ? '#e8d8a0' : '#5a5f6a';
    str(ox - 2, y, focus ? '►' : ' ', '#ffd860', focus ? '#1c2230' : undefined);
    str(ox, y, `${i + 1}) ${p.name.padEnd(16)} ${owned ? '  OWNED' : `◆${p.cost}`.padStart(7)}   ${p.desc}`.slice(0, 66), focus ? (owned ? '#8ad080' : '#ffe8a0') : fg, focus ? '#1c2230' : undefined);
    hit.menu.push({ y, action: 'perk', arg: p.id });
    y += 2;
  });
  str(ox, GRID_H - 4, 'Legacy is earned when a run ends: days survived,', '#6a7484');
  str(ox, GRID_H - 3, 'raids repelled, sites cleared, kills, peak population.', '#6a7484');
  str(ox, GRID_H - 2, 'press a number to buy · Esc back', '#8a94a2');
}

// ---------------------------------------------------------------- overlays
function drawHelp() {
  const lines = [
    ['HEARTHFALL — how to run a commune', '#ffd860'],
    ['', ''],
    ['Keep everyone fed, build defenses, survive the raids, and send', '#b8b2a0'],
    ['parties into the world. When the commune falls, its story becomes', '#b8b2a0'],
    ['legacy — spend it on permanent perks for the next run.', '#b8b2a0'],
    ['', ''],
    ['b       build menu · walls, farms, beds, traps, workshop, kitchen', '#c8c2b0'],
    ['t/m/g   chop trees ♠ / mine rocks ▲ / forage herb bushes "', '#c8c2b0'],
    ['x       cancel plans or demolish structures', '#c8c2b0'],
    ['w       world map — send quest parties out', '#c8c2b0'],
    ['e       trade with the visiting caravan (every few days)', '#c8c2b0'],
    ['space   pause · 1/2/3 game speed · Esc close menus', '#c8c2b0'],
    ['v       toggle graphics: pixel tiles / classic ASCII', '#c8c2b0'],
    ['pan     trackpad/wheel · shift+arrows · middle-drag ·', '#c8c2b0'],
    ['        click the minimap (n toggles it)', '#c8c2b0'],
    ['Q       save & quit to the main menu (progress kept)', '#c8c2b0'],
    ['click a settler name in the sidebar to change role', '#c8c2b0'],
    ['', ''],
    ['Controller: stick/d-pad cursor · A act · B back · X build', '#8a94a2'],
    ['Y world · LB/RB cycle tool · LT/RT speed · Start pause', '#8a94a2'],
    ['', ''],
    ['Economy: crops → kitchen meals (more filling) · herbs → medkits', '#8a94a2'],
    ['at the workshop · scrap + wood → spears · coin buys anything.', '#8a94a2'],
    ['Growth: 6 settlers unlock tier II (workshop, kitchen, watch post),', '#8a94a2'],
    ['9 unlock tier III (stone walls). Guards near a watch post shoot', '#8a94a2'],
    ['arrows at raiders. Clearing bandit camps delays the next raid.', '#8a94a2'],
    ['', ''],
    ['press ? or Esc to close', '#e8c860'],
  ];
  const bw = 70, bh = lines.length + 2;
  const x0 = ((GRID_W - bw) / 2) | 0, y0 = ((GRID_H - bh) / 2) | 0;
  fillBg(x0, y0, bw, bh, '#12151e');
  lines.forEach((l, i) => str(x0 + 2, y0 + 1 + i, l[0], l[1] || '#b8b2a0', '#12151e'));
}

// contextual tip toast, top of the map region
function drawTip() {
  if (!G.tip || G.tip.until < performance.now()) return;
  const maxw = 54; // wraps within the viewport width
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
  str(x0 + 1, 1, '☼ TIP', '#ffd860', '#241c08');
  str(x0 + bw - 6, 1, 'Esc ✕', '#8a7a50', '#241c08');
  lines.forEach((l, i) => str(x0 + 2, 2 + i, l, '#e8d8b0', '#241c08'));
}

// new-run story splash (game stays paused until dismissed)
function drawIntro() {
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
}

function drawGameOver() {
  const bw = 48, bh = 11;
  const x0 = ((GRID_W - bw) / 2) | 0, y0 = ((GRID_H - bh) / 2) | 0;
  fillBg(x0, y0, bw, bh, '#1a0e0e');
  str(x0 + 2, y0 + 1, 'THE COMMUNE HAS FALLEN', '#ff5040', '#1a0e0e');
  str(x0 + 2, y0 + 3, `You survived ${G.day} day${G.day === 1 ? '' : 's'}.`, '#c8c2b0', '#1a0e0e');
  const st = G.stats;
  str(x0 + 2, y0 + 4, `${st.raids} raids repelled · ${st.sites} sites cleared · ${st.kills} kills`, '#8a94a2', '#1a0e0e');
  str(x0 + 2, y0 + 6, `◆${G.legacyEarned} legacy earned (total ◆${META.points})`, '#c8a0e8', '#1a0e0e');
  str(x0 + 2, y0 + 8, '[R] rise again    [M] main menu', '#e8c860', '#1a0e0e');
}

// ---------------------------------------------------------------- paint
export function render() {
  f++;
  clearBuf();
  const tilesMode = GFX.mode === 'tiles' && G.screen === 'GAME' && G.mode !== 'WORLD';
  if (G.screen === 'MENU') drawMenu();
  else if (G.screen === 'CIV') drawCiv();
  else if (G.screen === 'LEGACY') drawLegacy();
  else if (G.mode === 'WORLD') { drawWorld(); drawTip(); }
  else {
    if (!tilesMode) drawMap(); // tiles mode paints the map region with sprites below
    drawMinimap();
    drawNotice();
    drawFrameLines();
    drawLog();
    drawSidebar();
    if (G.mode === 'BUILD') drawBuildMenu();
    if (G.mode === 'TRADE') drawTrade();
    drawTip();
  }
  if (G.screen === 'GAME' && G.intro && !G.gameOver) drawIntro();
  if (G.help) drawHelp();
  if (G.screen === 'GAME' && G.gameOver) drawGameOver();

  ctx.fillStyle = DEFAULT_BG;
  ctx.fillRect(0, 0, GRID_W * CELL_W, GRID_H * CELL_H);
  if (tilesMode) drawMapTiles(ctx, f); // text buffer cells paint over the sprites
  ctx.font = `${CELL_H - 4}px Menlo, Consolas, "DejaVu Sans Mono", monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let y = 0; y < GRID_H; y++) {
    for (let x = 0; x < GRID_W; x++) {
      const i = y * GRID_W + x;
      if (bgs[i] !== DEFAULT_BG) {
        ctx.fillStyle = bgs[i];
        ctx.fillRect(x * CELL_W, y * CELL_H, CELL_W, CELL_H);
      }
      if (chs[i] !== ' ') {
        ctx.fillStyle = fgs[i];
        ctx.fillText(chs[i], x * CELL_W + CELL_W / 2, y * CELL_H + CELL_H / 2 + 1);
      }
    }
  }
}
