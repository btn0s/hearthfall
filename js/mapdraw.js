// World-layer drawing strategies for the game screen: the classic ASCII
// cell renderer (sprite mode lives in tiles.js) plus shared map UI helpers.
import { G, tileAt, inMap, isNight, buildDef } from './game.js';
import { MAP_W, MAP_H, VIEW_W, VIEW_H, T, ROLE_COLORS } from './data.js';
import { put, dim, setCellBg } from './gfx.js';

export function drawWorldAscii(f) {
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
    setCellBg(c.x - cam.x, c.y - cam.y, '#2a3244');
  }
}

// minimap terrain colors
export const MM_COL = {
  water: '#264a78', tree: '#1d4419', bush: '#2b5c33', rock: '#63635e',
  grass: '#243719', grass2: '#283d1c', dirt: '#3a2f1e', floor: '#5b4530',
  wall_w: '#96703f', wall_s: '#9c9c94', door: '#c89b4f', farm: '#7a5230',
  bed: '#b28457', campfire: '#ff9030', post: '#c5b573', trap: '#8a93a0',
  workshop: '#c08a50', kitchen: '#d0a060',
};

export function inspectText() {
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

// world position helpers shared by input paths
export function panCam(dx, dy) {
  G.cam.x = Math.max(0, Math.min(MAP_W - VIEW_W, G.cam.x + dx));
  G.cam.y = Math.max(0, Math.min(MAP_H - VIEW_H, G.cam.y + dy));
}
