// Low-level compositor: one character-cell buffer painted over an optional
// canvas "world painter" layer (sprites). Panels use PANEL_BG so they are
// always painted opaque — nothing can bleed through UI by construction.
import { CELL_W, CELL_H } from './data.js';

export const GRID_W = 100, GRID_H = 45;
export const DEFAULT_BG = '#0c0d10';  // letterbox / transparent-over-sprites
export const PANEL_BG = '#0e1014';    // opaque UI panel background

const N = GRID_W * GRID_H;
const chs = new Array(N).fill(' ');
const fgs = new Array(N).fill('#888');
const bgs = new Array(N).fill(DEFAULT_BG);

let canvas = null, ctx = null;
let worldPainter = null;   // (ctx, f) => void, drawn under the buffer each frame
let overlayPainter = null; // (ctx, f) => void, drawn over the buffer (UI portraits etc.)

// persisted display settings
export const GFX = { mode: (() => { try { return localStorage.getItem('hearthfall.gfx') || 'tiles'; } catch (e) { return 'tiles'; } })() };
export function toggleGfx() {
  GFX.mode = GFX.mode === 'tiles' ? 'ascii' : 'tiles';
  try { localStorage.setItem('hearthfall.gfx', GFX.mode); } catch (e) { /* ignore */ }
}
// Minimap visibility (its size/position live in the sidebar layout).
export const MM = { on: (() => { try { return localStorage.getItem('hearthfall.minimap') !== 'off'; } catch (e) { return true; } })() };
export function toggleMinimap() {
  MM.on = !MM.on;
  try { localStorage.setItem('hearthfall.minimap', MM.on ? 'on' : 'off'); } catch (e) { /* ignore */ }
}

export function setupCanvas(cv) {
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

export function put(x, y, ch, fg, bg) {
  if (x < 0 || y < 0 || x >= GRID_W || y >= GRID_H) return;
  const i = y * GRID_W + x;
  chs[i] = ch; fgs[i] = fg;
  if (bg !== undefined) bgs[i] = bg;
}
export function str(x, y, text, fg, bg) {
  for (let i = 0; i < text.length; i++) put(x + i, y, text[i], fg, bg);
}
export function fillBg(x0, y0, w, h, bg) {
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
    if (x < 0 || y < 0 || x >= GRID_W || y >= GRID_H) continue;
    const i = y * GRID_W + x;
    chs[i] = ' '; bgs[i] = bg;
  }
}
export function setCellBg(x, y, bg) {
  if (x < 0 || y < 0 || x >= GRID_W || y >= GRID_H) return;
  bgs[y * GRID_W + x] = bg;
}

const dimCache = new Map();
export function dim(hex, k) {
  const key = hex + '|' + k;
  let v = dimCache.get(key);
  if (!v) {
    const r = Math.min(255, (parseInt(hex.slice(1, 3), 16) * k) | 0);
    const g = Math.min(255, (parseInt(hex.slice(3, 5), 16) * k) | 0);
    const b = Math.min(255, (parseInt(hex.slice(5, 7), 16) * k) | 0);
    v = `rgb(${r},${g},${b})`;
    dimCache.set(key, v);
  }
  return v;
}

export function clear() {
  for (let i = 0; i < N; i++) { chs[i] = ' '; fgs[i] = '#888'; bgs[i] = DEFAULT_BG; }
  worldPainter = null;
  overlayPainter = null;
}

export function setWorldPainter(fn) { worldPainter = fn; }
export function setOverlayPainter(fn) { overlayPainter = fn; }

export function paint(f) {
  if (!ctx) return;
  ctx.fillStyle = DEFAULT_BG;
  ctx.fillRect(0, 0, GRID_W * CELL_W, GRID_H * CELL_H);
  if (worldPainter) worldPainter(ctx, f);
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
  if (overlayPainter) overlayPainter(ctx, f);
}
