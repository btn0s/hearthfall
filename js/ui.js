// Screen-stack UI framework. A screen is a plain object:
//   { id, modal, pausesSim, listNav, focus,
//     widgets: [] | () => [],        // {rect, draw(w,focused,f), onClick(w,c), onActivate(w), focusable, disabled()}
//     keymap: {key: fn(mods)},       // checked after focus navigation
//     onKey(k, mods), onClick(c), onDrag(c), onHover(c|null), pan(dx, dy),
//     draw(f), onEnter(), onExit() }
// Input goes to the top of the stack only. Rendering walks from the topmost
// non-modal screen upward, so modals draw over their parent.
// Hit-testing is geometry over declared widget rects — never draw side effects.
import * as gfx from './gfx.js';

export const stack = [];

export const top = () => stack[stack.length - 1];
export function push(s) { stack.push(s); if (s.onEnter) s.onEnter(); }
export function pop() { const s = stack.pop(); if (s && s.onExit) s.onExit(); return s; }
export function replaceAll(...screens) {
  while (stack.length) pop();
  for (const s of screens) push(s);
}
export const inStack = (id) => stack.some(s => s.id === id);

export function widgetsOf(s) {
  return typeof s.widgets === 'function' ? s.widgets() : (s.widgets || []);
}
function focusables(s) {
  return widgetsOf(s).filter(w => w.focusable && !(w.disabled && w.disabled()));
}
export function focusedWidget(s) {
  const ws = focusables(s);
  if (!ws.length) return null;
  return ws[Math.min(s.focus || 0, ws.length - 1)];
}

export function dispatchKey(k, mods = {}) {
  const s = top();
  if (!s) return;
  if (s.listNav !== false && !mods.shift && ['ArrowUp', 'ArrowDown', 'Enter'].includes(k)) {
    const ws = focusables(s);
    if (ws.length) {
      const cur = Math.min(s.focus || 0, ws.length - 1);
      if (k === 'ArrowUp') { s.focus = (cur - 1 + ws.length) % ws.length; return; }
      if (k === 'ArrowDown') { s.focus = (cur + 1) % ws.length; return; }
      const w = ws[cur];
      if (w.onActivate) { w.onActivate(w); return; }
    }
  }
  if (s.keymap && s.keymap[k]) { s.keymap[k](mods); return; }
  if (s.onKey) s.onKey(k, mods);
}

export function dispatchClick(c) {
  const s = top();
  if (!s) return false;
  const ws = widgetsOf(s);
  for (let i = ws.length - 1; i >= 0; i--) {
    const w = ws[i], r = w.rect;
    if (r && c.cx >= r.x && c.cx < r.x + r.w && c.cy >= r.y && c.cy < r.y + r.h) {
      const fn = w.onClick || w.onActivate;
      if (fn) fn(w, c);
      return false; // widget consumed the click: not a map-drag start
    }
  }
  if (s.onClick) { s.onClick(c); return true; } // fell through to the screen: drags may follow
  return false;
}

// standard helper for screens: draw every widget with its focus state
export function drawWidgets(s, f) {
  const focused = focusedWidget(s);
  for (const w of widgetsOf(s)) if (w.draw) w.draw(w, w === focused, f);
}

export function renderFrame(f) {
  gfx.clear();
  let base = 0;
  for (let i = stack.length - 1; i >= 0; i--) {
    if (!stack[i].modal) { base = i; break; }
  }
  for (let i = base; i < stack.length; i++) {
    if (stack[i].draw) stack[i].draw(f);
  }
  gfx.paint(f);
}

// ---------------------------------------------------------------- DOM input
export function setupInput(canvas) {
  let dragging = false;   // left-drag painting (only after a click fell through to the map)
  let panDrag = null;     // middle-drag camera pan

  window.addEventListener('keydown', e => {
    dispatchKey(e.key, { shift: e.shiftKey });
    if ([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.key)) e.preventDefault();
  });

  canvas.addEventListener('contextmenu', e => {
    e.preventDefault();
    dispatchKey('Escape');
  });

  canvas.addEventListener('wheel', e => {
    const s = top();
    if (s && s.pan) {
      e.preventDefault();
      s.pan(Math.round(e.deltaX / 25), Math.round(e.deltaY / 25));
    }
  }, { passive: false });

  canvas.addEventListener('mousedown', e => {
    const c = gfx.canvasCell(e);
    const s = top();
    if (!s) return;
    if (e.button === 1 && s.pan) {
      e.preventDefault();
      panDrag = { cx: c.cx, cy: c.cy, panned: { x: 0, y: 0 } };
      return;
    }
    if (e.button !== 0) return;
    dragging = dispatchClick(c);
  });

  canvas.addEventListener('mousemove', e => {
    const c = gfx.canvasCell(e);
    const s = top();
    if (!s) return;
    if (panDrag && s.pan) {
      const dx = panDrag.cx - c.cx - panDrag.panned.x;
      const dy = panDrag.cy - c.cy - panDrag.panned.y;
      if (dx || dy) {
        s.pan(dx, dy);
        panDrag.panned.x += dx;
        panDrag.panned.y += dy;
      }
      return;
    }
    if (s.onHover) s.onHover(c);
    if (dragging && s.onDrag) s.onDrag(c);
  });

  window.addEventListener('mouseup', () => { dragging = false; panDrag = null; });
  canvas.addEventListener('mouseleave', () => {
    dragging = false; panDrag = null;
    const s = top();
    if (s && s.onHover) s.onHover(null);
  });
}
