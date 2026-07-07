// Tile-graphics mode: procedurally drawn pixel-art sprites, no external assets.
// Sprites are pre-rendered onto small offscreen canvases and blitted per cell.
import { G, tileAt, inMap, isNight, isWinter, insideHouse, selBounds, structMax } from './game.js';
import { VIEW_W, VIEW_H, CELL_W as CW, CELL_H as CH, STRUCT_HP } from './data.js';

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
function tentSprite() {
  return mk(g => {
    g.fillStyle = 'rgba(0,0,0,0.25)';
    g.beginPath(); g.ellipse(5.5, 16.6, 4.6, 1.2, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#8a7450'; tri(g, 5.5, 5, 10.5, 16, 0.5, 16);
    g.fillStyle = '#a98f63'; tri(g, 5.5, 5.5, 8.5, 16, 2.5, 16);
    g.fillStyle = '#2a2018'; tri(g, 5.5, 9, 7.2, 16, 3.8, 16);
    g.fillStyle = '#6a5638'; g.fillRect(5, 3, 1, 3);
  });
}
function cabinSprite() {
  return mk(g => {
    g.fillStyle = 'rgba(0,0,0,0.25)';
    g.beginPath(); g.ellipse(5.5, 16.8, 4.8, 1.1, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#5b4028'; g.fillRect(1, 9, 9, 8);
    g.fillStyle = '#4a3520';
    for (let y = 10; y <= 16; y += 2) g.fillRect(1, y, 9, 1);
    g.fillStyle = '#7a5a34'; tri(g, 5.5, 2.5, 11, 9.5, 0, 9.5);
    g.fillStyle = '#8f6c42'; tri(g, 5.5, 3.5, 9, 8.5, 2, 8.5);
    g.fillStyle = '#2a2018'; g.fillRect(4.5, 12, 2, 5);
    g.fillStyle = '#ffd860'; g.fillRect(7.5, 11, 1.5, 1.5);
  });
}
function longhouseSprite() {
  return mk(g => {
    g.fillStyle = 'rgba(0,0,0,0.28)';
    g.beginPath(); g.ellipse(5.5, 17, 5.2, 1.1, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#5b4028'; g.fillRect(0.5, 10, 10, 7);
    g.fillStyle = '#4a3520';
    for (let y = 11; y <= 16; y += 2) g.fillRect(0.5, y, 10, 1);
    g.fillStyle = '#6f5330';
    g.beginPath(); g.moveTo(0, 10); g.lineTo(3, 4); g.lineTo(8, 4); g.lineTo(11, 10); g.closePath(); g.fill();
    g.fillStyle = '#7f5e38'; g.fillRect(3, 4, 5, 1);
    g.fillStyle = '#2a2018'; g.fillRect(4.5, 12, 2, 5);
    g.fillStyle = '#ffd860'; g.fillRect(2, 12, 1.5, 1.5); g.fillRect(8, 12, 1.5, 1.5);
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

// jagged dark crack, overlaid on badly damaged structures
function crack() {
  return mk(g => {
    g.strokeStyle = 'rgba(10,8,6,0.8)';
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(2, 2); g.lineTo(5, 7); g.lineTo(3.5, 11); g.lineTo(6.5, 16);
    g.moveTo(5, 7); g.lineTo(8, 9);
    g.stroke();
  });
}

// small free-standing flame, overlaid on burning tiles
function flame(frame) {
  return mk(g => {
    const h = [8, 11, 9][frame];
    g.fillStyle = 'rgba(224,96,32,0.85)';
    tri(g, 3, 17 - h, 5.5, 17, 0.5, 17);
    tri(g, 8, 15 - h * 0.8, 10.5, 17, 5.5, 17);
    g.fillStyle = 'rgba(255,144,48,0.9)';
    tri(g, 3, 18.5 - h * 0.7, 4.8, 17, 1.2, 17);
    tri(g, 8, 17 - h * 0.55, 9.8, 17, 6.2, 17);
    g.fillStyle = '#ffd860';
    tri(g, 3 + frame * 0.5, 17 - h * 0.35, 4.2, 17, 1.8, 17);
  });
}

// the Beacon: a tall stone-footed pyre, roaring when lit
function beaconSprite(frame) {
  return mk(g => {
    g.fillStyle = '#54544f';
    g.fillRect(1, 15, 9, 2);
    g.fillStyle = '#6f6f6a';
    g.fillRect(2, 13, 7, 2);
    g.fillStyle = '#4a3520';
    g.fillRect(4, 6, 3, 8);
    g.fillRect(2, 9, 7, 2);
    const h = [11, 14, 12][frame];
    g.fillStyle = '#e06020'; tri(g, 5.5, 13 - h, 9, 12, 2, 12);
    g.fillStyle = '#ff9030'; tri(g, 5.5, 14 - h * 0.75, 8, 12, 3, 12);
    g.fillStyle = '#ffd860'; tri(g, 5.5 + (frame - 1) * 0.6, 14 - h * 0.45, 7, 12, 4, 12);
  });
}

function person({ shirt, shirtDark, hood = null, pack = false, weapon = false, torch = false, crest = false, lying = false, skin = '#e8c09a', hair = '#3a2a1a' }) {
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
    if (crest) { g.fillStyle = '#e8c040'; g.fillRect(4, 1, 3, 1); }
    // body + arms
    g.fillStyle = shirt; g.fillRect(3, 6, 5, 5);
    g.fillStyle = shirtDark; g.fillRect(2, 6, 1, 4); g.fillRect(8, 6, 1, 4);
    // legs + boots
    g.fillStyle = '#2e2a28'; g.fillRect(3, 11, 2, 4); g.fillRect(6, 11, 2, 4);
    g.fillStyle = '#1c1816'; g.fillRect(3, 15, 2, 1); g.fillRect(6, 15, 2, 1);
    if (weapon) { g.fillStyle = '#b0b6bd'; g.fillRect(9, 2, 1, 9); g.fillStyle = '#8a9298'; g.fillRect(9, 1, 1, 1); }
    if (torch) {
      g.fillStyle = '#6a4a24'; g.fillRect(9, 4, 1, 7);
      g.fillStyle = '#ff9030'; g.fillRect(8.5, 2, 2, 2);
      g.fillStyle = '#ffd860'; g.fillRect(9, 1, 1, 1);
    }
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
    wall_w: palisade(),
    wall_s: stoneWall(),
    door: door(),
    soil: soil(),
    crops: [cropStage(0), cropStage(1), cropStage(2), cropStage(3)],
    bed: bed(),
    tent: tentSprite(),
    cabin: cabinSprite(),
    longhouse: longhouseSprite(),
    campfire: [campfire(0), campfire(1), campfire(2)],
    post: post(),
    trap: trap(),
    workshop: workshop(),
    kitchen: kitchen(),
    beacon: [beaconSprite(0), beaconSprite(1), beaconSprite(2)],
    flame: [flame(0), flame(1), flame(2)],
    crack: crack(),
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
    raiders: {
      raider: person({ shirt: '#7a2828', shirtDark: '#5c1e1e', hood: '#601c1c', weapon: true, skin: '#d8b090' }),
      brute: person({ shirt: '#8a5a28', shirtDark: '#6a441e', hood: '#5a3a16', weapon: true, skin: '#d8b090' }),
      skirmisher: person({ shirt: '#7a4a7a', shirtDark: '#5c375c', hood: '#4a2c4a', pack: true, skin: '#d8b090' }),
      torcher: person({ shirt: '#6a2828', shirtDark: '#4c1e1e', hood: '#3c1616', torch: true, skin: '#d8b090' }),
      warlord: person({ shirt: '#4a1a1a', shirtDark: '#331111', hood: '#181214', weapon: true, crest: true, skin: '#d8b090' }),
    },
    trader: person({ shirt: '#c8a040', shirtDark: '#a88430', pack: true }),
  };
  return a;
}

// which sprite covers the whole cell (no ground underneath needed)
const FULL = new Set(['water', 'wall_w', 'wall_s', 'door']);
// ground drawn underneath partial sprites
const UNDER = {
  tree: 'grass', bush: 'grass', rock: 'grass',
  campfire: 'dirt', trap: 'dirt', workshop: 'dirt', kitchen: 'dirt', post: 'dirt', bed: 'dirt', beacon: 'dirt',
  tent: 'dirt', cabin: 'dirt', longhouse: 'dirt',
};

function sprite(a, t, x, y, f) {
  switch (t) {
    case 'water': return a.water[(x + y + (f >> 4)) % 2];
    case 'tree': return a.tree[(x * 7 + y * 11) % 3 === 0 ? 1 : 0];
    case 'bush': return a.bush;
    case 'rock': return a.rock;
    case 'wall_w': return a.wall_w;
    case 'wall_s': return a.wall_s;
    case 'door': return a.door;
    case 'bed': return a.bed;
    case 'tent': return a.tent;
    case 'cabin': return a.cabin;
    case 'longhouse': return a.longhouse;
    case 'campfire': return a.campfire[(f >> 2) % 3];
    case 'beacon': return a.beacon[(f >> 2) % 3];
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
  // everything (especially the additive night glow) stays inside the map region
  ctx.beginPath();
  ctx.rect(0, 0, VIEW_W * CW, VIEW_H * CH);
  ctx.clip();
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
      if (STRUCT_HP[t] && tl.hp !== undefined && tl.hp < structMax(t) * 0.5) ctx.drawImage(A.crack, px, py);
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
        ctx.fillStyle = tl.desig === 'fish' ? 'rgba(120,200,232,0.3)' : 'rgba(232,200,96,0.26)';
        ctx.fillRect(px, py, CW, CH);
      }
      // fire overlay
      if (tl.burning) {
        ctx.fillStyle = 'rgba(255,120,32,0.18)';
        ctx.fillRect(px, py, CW, CH);
        ctx.drawImage(A.flame[((x * 3 + y) + (f >> 2)) % 3], px, py);
      }
    }
  }

  // winter lies over the land like a sheet
  if (isWinter()) {
    ctx.fillStyle = 'rgba(198,214,232,0.16)';
    ctx.fillRect(0, 0, VIEW_W * CW, VIEW_H * CH);
  }

  // entities (world → screen offset; skip anything off-camera)
  const blit = (img, x, y) => { if (onScreen(x, y)) ctx.drawImage(img, (x - cam.x) * CW, (y - cam.y) * CH); };
  if (G.trader) blit(A.trader, G.trader.x, G.trader.y);
  for (const r of G.raiders) blit(A.raiders[r.type] || A.raiders.raider, r.x, r.y);
  for (const s of G.settlers) {
    if (s.away || insideHouse(s) || !onScreen(s.x, s.y)) continue; // house sleepers are indoors
    const set = (s.sleeping || s.downed) ? A.sleeper : A.settler;
    ctx.drawImage(set[s.role] || set.worker, (s.x - cam.x) * CW, (s.y - cam.y) * CH);
    if (s.downed) {
      ctx.fillStyle = 'rgba(192,64,48,0.32)';
      ctx.fillRect((s.x - cam.x) * CW, (s.y - cam.y) * CH, CW, CH);
    } else if (s.starving && (f >> 3) % 2) {
      ctx.fillStyle = 'rgba(224,80,64,0.3)';
      ctx.fillRect((s.x - cam.x) * CW, (s.y - cam.y) * CH, CW, CH);
    }
  }

  // night: darken, then warm glow around visible fires (hearths and hazards)
  if (isNight()) {
    ctx.fillStyle = 'rgba(8,12,38,0.45)';
    ctx.fillRect(0, 0, VIEW_W * CW, VIEW_H * CH);
    ctx.globalCompositeOperation = 'lighter';
    for (let sy = 0; sy < VIEW_H; sy++) for (let sx = 0; sx < VIEW_W; sx++) {
      const tl = tileAt(cam.x + sx, cam.y + sy);
      const lit = tl.t === 'campfire' || tl.t === 'beacon' || tl.burning;
      if (!lit) continue;
      const cx = sx * CW + CW / 2, cy = sy * CH + CH / 2;
      const rad = CW * (tl.t === 'beacon' ? 9 : 5);
      const grad = ctx.createRadialGradient(cx, cy, 2, cx, cy, rad);
      grad.addColorStop(0, 'rgba(255,150,50,0.22)');
      grad.addColorStop(1, 'rgba(255,150,50,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(cx - rad, cy - rad, rad * 2, rad * 2);
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  // selection marquee
  const sb = selBounds();
  if (sb) {
    const rx = (Math.max(sb.x0, cam.x) - cam.x) * CW;
    const ry = (Math.max(sb.y0, cam.y) - cam.y) * CH;
    const rw = (Math.min(sb.x1, cam.x + VIEW_W - 1) - Math.max(sb.x0, cam.x) + 1) * CW;
    const rh = (Math.min(sb.y1, cam.y + VIEW_H - 1) - Math.max(sb.y0, cam.y) + 1) * CH;
    if (rw > 0 && rh > 0) {
      ctx.fillStyle = 'rgba(120,160,255,0.14)';
      ctx.fillRect(rx, ry, rw, rh);
      ctx.strokeStyle = 'rgba(170,200,255,0.85)';
      ctx.lineWidth = 1;
      ctx.strokeRect(rx + 0.5, ry + 0.5, rw - 1, rh - 1);
    }
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
