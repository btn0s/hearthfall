// World-layer drawing strategies for the game screen: the classic ASCII
// cell renderer (sprite mode lives in tiles.js) plus shared map UI helpers.
import { G, tileAt, inMap, isNight, isWinter, buildDef, traitName, insideHouse, selBounds, structMax } from './game.js';
import { MAP_W, MAP_H, VIEW_W, VIEW_H, T, ROLE_COLORS, RAIDER_TYPES, HOUSES, STRUCT_HP } from './data.js';
import { put, dim, setCellBg } from './gfx.js';

// snowy recolors for living terrain
const WINTER_FG = {
  grass: { fg: '#9aacb6', bg: '#10151a' }, grass2: { fg: '#a8bac2', bg: '#10151a' },
  dirt: { fg: '#8a8e96', bg: '#12151a' }, tree: { fg: '#6a8a7a' }, bush: { fg: '#5f7d70' },
  water: { fg: '#7aa0c8' },
};

export function drawWorldAscii(f) {
  const night = isNight();
  const winter = isWinter();
  const tf = night ? 0.5 : 1, ef = night ? 0.75 : 1;
  const cam = G.cam;
  for (let sy = 0; sy < VIEW_H; sy++) for (let sx = 0; sx < VIEW_W; sx++) {
    const x = cam.x + sx, y = cam.y + sy;
    const tl = tileAt(x, y);
    const d = T[tl.t];
    let ch = d.ch, fg = d.fg, bg = d.bg;
    if (winter && WINTER_FG[tl.t]) { fg = WINTER_FG[tl.t].fg; bg = WINTER_FG[tl.t].bg || bg; }
    if (tl.t === 'tree') ch = ((x * 7 + y * 11) % 3 === 0) ? '♣' : '♠';
    if (tl.t === 'water') ch = ((x + y + (f >> 4)) % 2) ? '≈' : '~';
    if (tl.t === 'campfire' || tl.t === 'beacon') fg = ['#ff9030', '#ffc040', '#e06020'][(f >> 2) % 3];
    if (tl.t === 'farm') {
      const g = tl.growth || 0;
      if (g >= 100) { ch = 'Ψ'; fg = '#e8d060'; }
      else if (g >= 60) { ch = ';'; fg = '#8fb050'; }
      else if (g >= 25) { ch = ','; fg = '#6a9040'; }
      else { ch = '.'; fg = '#5a7a3a'; }
      if (winter) fg = '#7a8690';
    }
    let tint = tf;
    if (STRUCT_HP[tl.t] && tl.hp !== undefined && tl.hp < structMax(tl.t) * 0.5) tint *= 0.55; // battle scars show
    if (tl.build) { ch = T[tl.build.id] ? T[tl.build.id].ch : '?'; fg = '#565664'; }
    if (tl.desig) fg = '#e8c860';
    if (tl.burning) { // flames read at full brightness, day or night
      const fch = (x + y + (f >> 2)) % 2 ? '‼' : '^';
      put(sx, sy, fch, ['#ff9030', '#ffc040', '#e06020'][(x + (f >> 2)) % 3], '#2a1206');
      continue;
    }
    put(sx, sy, ch, dim(fg, tint), dim(bg, tf));
  }
  const onScreen = (x, y) => x >= cam.x && y >= cam.y && x < cam.x + VIEW_W && y < cam.y + VIEW_H;
  if (G.trader && onScreen(G.trader.x, G.trader.y)) put(G.trader.x - cam.x, G.trader.y - cam.y, '☺', '#ffd860');
  for (const r of G.raiders) {
    if (!onScreen(r.x, r.y)) continue;
    const rt = RAIDER_TYPES[r.type] || RAIDER_TYPES.raider;
    let fg = rt.fg;
    if (r.type === 'warlord' && (f >> 3) % 2) fg = '#ffd860';
    put(r.x - cam.x, r.y - cam.y, rt.ch, dim(fg, ef));
  }
  for (const s of G.settlers) {
    if (s.away || insideHouse(s) || !onScreen(s.x, s.y)) continue; // house sleepers are indoors
    let fg = ROLE_COLORS[s.role] || '#d8d2c0';
    if (s.sleeping) fg = '#5a6a90';
    if (s.downed) fg = (f >> 3) % 2 ? '#c05050' : '#7a3a3a';
    if (s.starving && (f >> 3) % 2) fg = '#e05040';
    put(s.x - cam.x, s.y - cam.y, '☺', dim(fg, s.sleeping ? 1 : ef));
  }
  const b = selBounds();
  if (b) {
    for (let y = Math.max(b.y0, cam.y); y <= Math.min(b.y1, cam.y + VIEW_H - 1); y++) {
      for (let x = Math.max(b.x0, cam.x); x <= Math.min(b.x1, cam.x + VIEW_W - 1); x++) {
        setCellBg(x - cam.x, y - cam.y, '#243352');
      }
    }
  }
  const c = G.cursor;
  if (inMap(c.x, c.y) && onScreen(c.x, c.y)) {
    setCellBg(c.x - cam.x, c.y - cam.y, '#2a3244');
  }
}

// minimap terrain colors
export const MM_COL = {
  water: '#264a78', tree: '#1d4419', bush: '#2b5c33', rock: '#63635e',
  grass: '#243719', grass2: '#283d1c', dirt: '#3a2f1e',
  wall_w: '#96703f', wall_s: '#9c9c94', door: '#c89b4f', farm: '#7a5230',
  bed: '#b28457', tent: '#c8b088', cabin: '#d8a868', longhouse: '#e8c8a0',
  campfire: '#ff9030', post: '#c5b573', trap: '#8a93a0',
  workshop: '#c08a50', kitchen: '#d0a060', beacon: '#ffe060',
};

export function inspectText() {
  const { x, y } = G.cursor;
  if (!inMap(x, y)) return '';
  const tl = tileAt(x, y);
  const parts = [T[tl.t].name];
  if (tl.burning) parts.push('‼ ON FIRE');
  if (HOUSES[tl.t] && tl.t !== 'bed') parts.push(`sleeps ${(tl.sleepers || []).length}/${HOUSES[tl.t].cap}`);
  if (tl.t === 'farm') parts.push(`crop ${Math.min(100, (tl.growth || 0)) | 0}%`);
  if (tl.hp !== undefined && T[tl.t].hp) parts.push(`hp ${Math.max(0, tl.hp)}`);
  if (tl.build) parts.push(`plan: ${buildDef(tl.build.id).name}`);
  if (tl.desig === 'fish') parts.push(tl.fishCd > 0 ? 'fishing spot (resting)' : 'fishing spot');
  else if (tl.desig) parts.push(`marked: ${tl.desig}`);
  if (tl.t === 'workshop') parts.push(G.craftQueue.length ? `orders: ${G.craftQueue.length} (click)` : 'click for orders');
  if (G.trader && G.trader.x === x && G.trader.y === y) parts.push('☺ trader (e to trade)');
  for (const s of G.settlers) {
    if (!s.away && s.x === x && s.y === y) {
      parts.push(`☺ ${s.name} (${s.role} · ${traitName(s).toLowerCase()}) hp${Math.ceil(s.hp)}${s.downed ? ' DOWN' : s.sleeping ? ' zzz' : ''}`);
    }
  }
  for (const r of G.raiders) {
    if (r.x === x && r.y === y) {
      const rt = RAIDER_TYPES[r.type] || RAIDER_TYPES.raider;
      parts.push(`${rt.ch} ${r.name || rt.name} hp${r.hp}`);
    }
  }
  return parts.join(' · ');
}

// world position helpers shared by input paths
export function panCam(dx, dy) {
  G.cam.x = Math.max(0, Math.min(MAP_W - VIEW_W, G.cam.x + dx));
  G.cam.y = Math.max(0, Math.min(MAP_H - VIEW_H, G.cam.y + dy));
}
