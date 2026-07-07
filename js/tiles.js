// Tile-graphics mode: procedurally drawn pixel-art sprites, no external assets.
// Sprites are pre-rendered onto small offscreen canvases and blitted per cell.
import { G, tileAt, inMap, isNight } from './game.js';
import { VIEW_W, VIEW_H, CELL_W as CW, CELL_H as CH } from './data.js';

// ---------------------------------------------------------------- atlas
let A = null; // built lazily on first draw

function mk(draw) {
  const c = document.createElement('canvas');
  c.width = CW; c.height = CH;
  const g = c.getContext('2d');
  draw(g);
  return c;
}

function seeded(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1103515245 + 12345) >>> 0; return (s >>> 16) / 65536; };
}

function ground(base, specks, seed) {
  return mk(g => {
    g.fillStyle = base; g.fillRect(0, 0, CW, CH);
    const r = seeded(seed);
    for (let i = 0; i < 14; i++) {
      g.fillStyle = specks[i % specks.length];
      g.fillRect((r() * CW) | 0, (r() * CH) | 0, r() < 0.3 ? 2 : 1, 1);
    }
  });
}

function water(frame) {
  return mk(g => {
    g.fillStyle = '#16304f'; g.fillRect(0, 0, CW, CH);
    for (let row = 0; row < CH; row += 3) {
      if ((((row / 3) | 0) + frame) % 2 === 0) {
        g.fillStyle = '#274e79';
        g.fillRect(frame % 2 ? 1 : 3, row, 6, 1);
      }
    }
    g.fillStyle = '#3a6a9d';
    g.fillRect(frame % 2 ? 6 : 2, 4, 3, 1);
    g.fillRect(frame % 2 ? 2 : 6, 13, 3, 1);
  });
}

function treeRound() {
  return mk(g => {
    g.fillStyle = 'rgba(0,0,0,0.25)';
    g.beginPath(); g.ellipse(5.5, 16.5, 4, 1.2, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#4a3520'; g.fillRect(4, 12, 3, 5);
    g.fillStyle = '#16350f';
    g.beginPath(); g.ellipse(5.5, 7, 5.4, 6.6, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#245417';
    g.beginPath(); g.ellipse(5, 6, 4, 5, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#317020';
    g.beginPath(); g.ellipse(3.8, 4, 2.2, 2.8, 0, 0, Math.PI * 2); g.fill();
  });
}
function treePine() {
  return mk(g => {
    g.fillStyle = 'rgba(0,0,0,0.25)';
    g.beginPath(); g.ellipse(5.5, 16.5, 4, 1.2, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#4a3520'; g.fillRect(4.5, 13, 2, 4);
    g.fillStyle = '#14300e'; tri(g, 5.5, 0, 11, 13.5, 0, 13.5);
    g.fillStyle = '#1f4a15'; tri(g, 5.5, 2, 9.5, 11, 1.5, 11);
    g.fillStyle = '#2c6420'; tri(g, 5.5, 3, 8, 8.5, 3, 8.5);
  });
}
function bush() {
  return mk(g => {
    g.fillStyle = '#255230'; circle(g, 5.5, 12.5, 4.2);
    g.fillStyle = '#347a44'; circle(g, 4.3, 11, 2.8);
    g.fillStyle = '#b84848';
    g.fillRect(3, 13, 1, 1); g.fillRect(7, 12, 1, 1);
  });
}
function rock() {
  return mk(g => {
    g.fillStyle = '#3c3c38'; g.fillRect(1, 15, 9, 1);
    g.fillStyle = '#61615c';
    g.beginPath(); g.moveTo(1, 15); g.lineTo(4, 7); g.lineTo(7, 9); g.lineTo(10, 15); g.closePath(); g.fill();
    g.fillStyle = '#7e7e78';
    g.beginPath(); g.moveTo(3, 15); g.lineTo(4.5, 9); g.lineTo(6, 11); g.lineTo(6.5, 15); g.closePath(); g.fill();
  });
}
function floorTile() {
  return mk(g => {
    g.fillStyle = '#5b4530'; g.fillRect(0, 0, CW, CH);
    g.fillStyle = '#48361f';
    for (let y = 0; y < CH; y += 4) g.fillRect(0, y, CW, 1);
    g.fillStyle = '#6e553c';
    g.fillRect(2, 2, 1, 1); g.fillRect(7, 10, 1, 1); g.fillRect(4, 14, 1, 1);
  });
}
function palisade() {
  return mk(g => {
    g.fillStyle = '#6b4d2c'; g.fillRect(0, 0, CW, CH);
    g.fillStyle = '#513a20';
    for (const x of [0, 3, 6, 9]) g.fillRect(x, 0, 1, CH);
    g.fillStyle = '#7f5e38'; g.fillRect(0, 0, CW, 2);
    g.fillStyle = '#8f6c42';
    g.fillRect(1, 0, 2, 1); g.fillRect(7, 0, 2, 1);
  });
}
function stoneWall() {
  return mk(g => {
    g.fillStyle = '#6f6f6a'; g.fillRect(0, 0, CW, CH);
    g.fillStyle = '#54544f';
    for (let y = 4; y < CH; y += 5) g.fillRect(0, y, CW, 1);
    for (let y = 0, i = 0; y < CH; y += 5, i++) {
      for (let x = (i % 2) * 3; x < CW; x += 6) g.fillRect(x, y, 1, 5);
    }
    g.fillStyle = '#8a8a84'; g.fillRect(0, 0, CW, 1);
  });
}
function door() {
  return mk(g => {
    g.fillStyle = '#513a20'; g.fillRect(0, 0, CW, CH);
    g.fillStyle = '#7a5a30'; g.fillRect(1, 1, 9, 17);
    g.fillStyle = '#684a26';
    g.fillRect(4, 1, 1, 17); g.fillRect(7, 1, 1, 17);
    g.fillStyle = '#d8b050'; g.fillRect(8, 9, 1, 2);
  });
}
function soil() {
  return mk(g => {
    g.fillStyle = '#312416'; g.fillRect(0, 0, CW, CH);
    g.fillStyle = '#241a0e';
    for (let y = 1; y < CH; y += 3) g.fillRect(0, y, CW, 1);
  });
}
function cropStage(stage) {
  return mk(g => {
    const cols = [2, 5, 8];
    if (stage === 0) {
      g.fillStyle = '#5a8a3a';
      for (const x of cols) g.fillRect(x, 14, 1, 1);
    } else if (stage === 1) {
      g.fillStyle = '#4f8a35';
      for (const x of cols) g.fillRect(x, 11, 1, 4);
    } else if (stage === 2) {
      g.fillStyle = '#4f8a35';
      for (const x of cols) { g.fillRect(x, 7, 1, 8); g.fillRect(x - 1, 9, 1, 1); g.fillRect(x + 1, 12, 1, 1); }
    } else {
      g.fillStyle = '#b89838';
      for (const x of cols) g.fillRect(x, 6, 1, 9);
      g.fillStyle = '#e8d060';
      for (const x of cols) g.fillRect(x - 0.5 | 0, 3, 2, 4);
    }
  });
}
function bed() {
  return mk(g => {
    g.fillStyle = '#5b4028'; g.fillRect(1, 2, 9, 15);
    g.fillStyle = '#cbbfa8'; g.fillRect(2, 3, 7, 13);
    g.fillStyle = '#e8e0d0'; g.fillRect(2, 3, 7, 3);
    g.fillStyle = '#7e3434'; g.fillRect(2, 8, 7, 8);
    g.fillStyle = '#6a2c2c'; g.fillRect(2, 8, 7, 1);
  });
}
function campfire(frame) {
  return mk(g => {
    g.fillStyle = '#6a6a64';
    g.fillRect(2, 15, 2, 2); g.fillRect(7, 15, 2, 2); g.fillRect(4, 16, 3, 2);
    g.fillStyle = '#4a3520';
    g.fillRect(3, 14, 5, 2);
    const h = [7, 9, 8][frame];
    g.fillStyle = '#e06020'; tri(g, 5.5, 14 - h, 8.5, 14, 2.5, 14);
    g.fillStyle = '#ff9030'; tri(g, 5.5, 15.5 - h * 0.75, 7.5, 14, 3.5, 14);
    g.fillStyle = '#ffd860'; tri(g, 5.5 + (frame - 1) * 0.5, 16 - h * 0.45, 6.5, 14, 4.5, 14);
  });
}
function post() {
  return mk(g => {
    g.fillStyle = '#5b4028';
    g.fillRect(2, 8, 2, 9); g.fillRect(7, 8, 2, 9);
    g.fillStyle = '#6f5330'; g.fillRect(1, 6, 9, 2);
    g.fillStyle = '#7f5e38'; tri(g, 5.5, 1, 10, 6, 1, 6);
    g.fillStyle = '#c04040'; g.fillRect(9, 2, 1, 2);
  });
}
function trap() {
  return mk(g => {
    g.fillStyle = '#9aa2ac';
    for (const x of [1, 4, 7]) tri(g, x + 1, 10, x + 2.5, 16, x - 0.5, 16);
    g.fillStyle = '#c8ced4';
    for (const x of [1, 4, 7]) g.fillRect(x + 0.7, 11, 1, 2);
  });
}
function workshop() {
  return mk(g => {
    g.fillStyle = '#5b4028'; g.fillRect(1, 11, 9, 3);
    g.fillRect(2, 14, 1, 3); g.fillRect(8, 14, 1, 3);
    g.fillStyle = '#43434a'; g.fillRect(3, 7, 5, 3);
    g.fillRect(2, 7, 1, 2);
    g.fillStyle = '#5c5c64'; g.fillRect(3, 7, 5, 1);
    g.fillStyle = '#8a6a40'; g.fillRect(6, 4, 1, 3);
    g.fillStyle = '#9aa2ac'; g.fillRect(5, 3, 3, 1);
  });
}
function kitchen() {
  return mk(g => {
    g.fillStyle = '#5b4028'; g.fillRect(2, 13, 7, 2);
    g.fillRect(2, 15, 1, 2); g.fillRect(8, 15, 1, 2);
    g.fillStyle = '#3f3f46'; circle(g, 5.5, 10, 3);
    g.fillStyle = '#5c5c64'; g.fillRect(2.5, 7, 6, 1);
    g.fillStyle = '#8a99a8';
    g.fillRect(4, 4, 1, 2); g.fillRect(6, 3, 1, 2);
  });
}

function circle(g, cx, cy, r) {
  g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill();
}
function tri(g, x1, y1, x2, y2, x3, y3) {
  g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.lineTo(x3, y3); g.closePath(); g.fill();
}

function person({ shirt, shirtDark, hood, pack, weapon, lying, skin = '#e8c09a', hair = '#3a2a1a' }) {
  return mk(g => {
    if (lying) { g.translate(5.5, 9.5); g.rotate(Math.PI / 2); g.translate(-5.5, -9.5); }
    // shadow
    g.fillStyle = 'rgba(0,0,0,0.28)';
    g.beginPath(); g.ellipse(5.5, 16.6, 3.4, 1.1, 0, 0, Math.PI * 2); g.fill();
    if (pack) { g.fillStyle = '#7a5a34'; g.fillRect(1, 6, 2, 5); }
    // head
    g.fillStyle = skin; g.fillRect(4, 3, 3, 3);
    g.fillStyle = hood || hair; g.fillRect(4, 2, 3, hood ? 2 : 1);
    if (hood) { g.fillStyle = hood; g.fillRect(3, 3, 1, 2); g.fillRect(7, 3, 1, 2); }
    // body + arms
    g.fillStyle = shirt; g.fillRect(3, 6, 5, 5);
    g.fillStyle = shirtDark; g.fillRect(2, 6, 1, 4); g.fillRect(8, 6, 1, 4);
    // legs + boots
    g.fillStyle = '#2e2a28'; g.fillRect(3, 11, 2, 4); g.fillRect(6, 11, 2, 4);
    g.fillStyle = '#1c1816'; g.fillRect(3, 15, 2, 1); g.fillRect(6, 15, 2, 1);
    if (weapon) { g.fillStyle = '#b0b6bd'; g.fillRect(9, 2, 1, 9); g.fillStyle = '#8a9298'; g.fillRect(9, 1, 1, 1); }
  });
}

function buildAtlas() {
  const a = {
    grass: [0, 1, 2, 3].map(i => ground('#22381a', ['#2f4d22', '#3b5f2a', '#1b2d14'], 11 + i * 97)),
    dirt: [0, 1, 2, 3].map(i => ground('#2e2818', ['#3a3220', '#282212', '#403626'], 7 + i * 131)),
    water: [water(0), water(1)],
    tree: [treeRound(), treePine()],
    bush: bush(),
    rock: rock(),
    floor: floorTile(),
    wall_w: palisade(),
    wall_s: stoneWall(),
    door: door(),
    soil: soil(),
    crops: [cropStage(0), cropStage(1), cropStage(2), cropStage(3)],
    bed: bed(),
    campfire: [campfire(0), campfire(1), campfire(2)],
    post: post(),
    trap: trap(),
    workshop: workshop(),
    kitchen: kitchen(),
    settler: {
      worker: person({ shirt: '#b8a878', shirtDark: '#98885c' }),
      farmer: person({ shirt: '#4f8a35', shirtDark: '#3d6c28' }),
      guard: person({ shirt: '#3a7ea0', shirtDark: '#2c6280', weapon: true }),
    },
    sleeper: {
      worker: person({ shirt: '#b8a878', shirtDark: '#98885c', lying: true }),
      farmer: person({ shirt: '#4f8a35', shirtDark: '#3d6c28', lying: true }),
      guard: person({ shirt: '#3a7ea0', shirtDark: '#2c6280', lying: true }),
    },
    raider: person({ shirt: '#7a2828', shirtDark: '#5c1e1e', hood: '#601c1c', weapon: true, skin: '#d8b090' }),
    trader: person({ shirt: '#c8a040', shirtDark: '#a88430', pack: true }),
  };
  return a;
}

// which sprite covers the whole cell (no ground underneath needed)
const FULL = new Set(['water', 'floor', 'wall_w', 'wall_s', 'door']);
// ground drawn underneath partial sprites
const UNDER = {
  tree: 'grass', bush: 'grass', rock: 'grass',
  campfire: 'dirt', trap: 'dirt', workshop: 'dirt', kitchen: 'dirt', post: 'dirt', bed: 'dirt',
};

function sprite(a, t, x, y, f) {
  switch (t) {
    case 'water': return a.water[(x + y + (f >> 4)) % 2];
    case 'tree': return a.tree[(x * 7 + y * 11) % 3 === 0 ? 1 : 0];
    case 'bush': return a.bush;
    case 'rock': return a.rock;
    case 'floor': return a.floor;
    case 'wall_w': return a.wall_w;
    case 'wall_s': return a.wall_s;
    case 'door': return a.door;
    case 'bed': return a.bed;
    case 'campfire': return a.campfire[(f >> 2) % 3];
    case 'post': return a.post;
    case 'trap': return a.trap;
    case 'workshop': return a.workshop;
    case 'kitchen': return a.kitchen;
  }
  return null;
}

export function drawMapTiles(ctx, f) {
  if (!A) A = buildAtlas();
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  const cam = G.cam;
  const onScreen = (x, y) => x >= cam.x && y >= cam.y && x < cam.x + VIEW_W && y < cam.y + VIEW_H;

  for (let sy = 0; sy < VIEW_H; sy++) {
    for (let sx = 0; sx < VIEW_W; sx++) {
      const x = cam.x + sx, y = cam.y + sy;
      const tl = tileAt(x, y);
      const t = tl.t;
      const px = sx * CW, py = sy * CH;
      const v = (x * 7 + y * 13) % 4;
      // ground layer
      if (t === 'grass' || t === 'grass2') ctx.drawImage(A.grass[v], px, py);
      else if (t === 'dirt') ctx.drawImage(A.dirt[v], px, py);
      else if (t === 'farm') ctx.drawImage(A.soil, px, py);
      else if (FULL.has(t)) { /* sprite covers */ }
      else ctx.drawImage(A[UNDER[t] || 'grass'][v], px, py);
      // feature layer
      const sp = sprite(A, t, x, y, f);
      if (sp) ctx.drawImage(sp, px, py);
      if (t === 'farm') {
        const g = tl.growth || 0;
        const stage = g >= 100 ? 3 : g >= 60 ? 2 : g >= 25 ? 1 : 0;
        ctx.drawImage(A.crops[stage], px, py);
      }
      // planned build: ghost sprite
      if (tl.build) {
        const gs = sprite(A, tl.build.id, x, y, f) || (tl.build.id === 'farm' ? A.soil : null);
        if (gs) {
          ctx.globalAlpha = 0.45;
          ctx.drawImage(gs, px, py);
          ctx.globalAlpha = 1;
        }
        ctx.strokeStyle = 'rgba(200,210,230,0.5)';
        ctx.strokeRect(px + 0.5, py + 0.5, CW - 1, CH - 1);
      }
      // designation highlight
      if (tl.desig) {
        ctx.fillStyle = 'rgba(232,200,96,0.26)';
        ctx.fillRect(px, py, CW, CH);
      }
    }
  }

  // entities (world → screen offset; skip anything off-camera)
  const blit = (img, x, y) => { if (onScreen(x, y)) ctx.drawImage(img, (x - cam.x) * CW, (y - cam.y) * CH); };
  if (G.trader) blit(A.trader, G.trader.x, G.trader.y);
  for (const r of G.raiders) blit(A.raider, r.x, r.y);
  for (const s of G.settlers) {
    if (s.away || !onScreen(s.x, s.y)) continue;
    const set = s.sleeping ? A.sleeper : A.settler;
    ctx.drawImage(set[s.role] || set.worker, (s.x - cam.x) * CW, (s.y - cam.y) * CH);
    if (s.starving && (f >> 3) % 2) {
      ctx.fillStyle = 'rgba(224,80,64,0.3)';
      ctx.fillRect((s.x - cam.x) * CW, (s.y - cam.y) * CH, CW, CH);
    }
  }

  // night: darken, then warm glow around visible fires
  if (isNight()) {
    ctx.fillStyle = 'rgba(8,12,38,0.45)';
    ctx.fillRect(0, 0, VIEW_W * CW, VIEW_H * CH);
    ctx.globalCompositeOperation = 'lighter';
    for (let sy = 0; sy < VIEW_H; sy++) for (let sx = 0; sx < VIEW_W; sx++) {
      if (tileAt(cam.x + sx, cam.y + sy).t !== 'campfire') continue;
      const cx = sx * CW + CW / 2, cy = sy * CH + CH / 2;
      const rad = CW * 5;
      const grad = ctx.createRadialGradient(cx, cy, 2, cx, cy, rad);
      grad.addColorStop(0, 'rgba(255,150,50,0.22)');
      grad.addColorStop(1, 'rgba(255,150,50,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(cx - rad, cy - rad, rad * 2, rad * 2);
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  // cursor
  const c = G.cursor;
  if (inMap(c.x, c.y) && onScreen(c.x, c.y)) {
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 1;
    ctx.strokeRect((c.x - cam.x) * CW + 0.5, (c.y - cam.y) * CH + 0.5, CW - 1, CH - 1);
  }
  ctx.restore();
}
