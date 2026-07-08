// The mobile landing draws itself with the game's own art: the title
// screen's flame-graded block wordmark, and a living campfire scene built
// from the real sprite atlas. No screenshots, no fakery — the game renders
// its own welcome mat for screens too small to play on.
import { getAtlas } from './tiles.js';
import { FONT } from './glyph.js';

const GATE_MQ = '(max-width: 899px), ((pointer: coarse) and (max-width: 1200px))';
const FLAME = ['#ffdf70', '#ffc050', '#ff9030', '#e06020', '#b04818'];

function drawLogo(cv) {
  const word = 'HEARTHFALL';
  const cols = word.length * 4 - 1;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const cssW = Math.min(340, window.innerWidth - 32);
  const s = Math.max(1, Math.floor((cssW * dpr) / cols));
  cv.width = cols * s;
  cv.height = 5 * s;
  cv.style.width = `${cv.width / dpr}px`;
  cv.style.height = `${cv.height / dpr}px`;
  const g = cv.getContext('2d');
  for (let r = 0; r < 5; r++) {
    g.fillStyle = FLAME[r];
    let x = 0;
    for (const ch of word) {
      const row = FONT[ch][r];
      for (let i = 0; i < 3; i++) {
        if (row[i] === '█') g.fillRect((x + i) * s, r * s, s, s);
      }
      x += 4;
    }
  }
}

// A slice of the world at night: tents by the fire, folk gathered, forest
// at the edges — animated with the same frames the game uses.
function startScene(cv) {
  const A = getAtlas();
  const CW = 11, CH = 19;
  const COLS = 13, S = 3;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const skyH = 26; // sky rows above the ground, in sprite px
  cv.width = COLS * CW * S * dpr / 2;
  cv.height = (skyH + CH) * S * dpr / 2;
  cv.style.width = `${COLS * CW * S / 2}px`;
  cv.style.height = `${(skyH + CH) * S / 2}px`;
  const g = cv.getContext('2d');
  g.imageSmoothingEnabled = false;
  const sc = (S * dpr) / 2;

  // fixed starfield (deterministic, no Math.random needed)
  const stars = [];
  for (let i = 0; i < 26; i++) stars.push([(i * 37) % (COLS * CW), (i * 13) % (skyH - 4) + 2, i % 3]);

  function frame(t) {
    const f = (t / 180) | 0;
    g.fillStyle = '#0a0d1c';                       // night sky
    g.fillRect(0, 0, cv.width, cv.height);
    for (const [sx, sy, tw] of stars) {
      g.fillStyle = (f + tw) % 4 === 0 ? '#3a4560' : '#8a94b2';
      g.fillRect(sx * sc, sy * sc, sc, sc);
    }
    const gy = skyH * sc;                          // ground line
    const blit = (img, col, dy = 0) => g.drawImage(img, col * CW * sc, gy + dy * sc, CW * sc, CH * sc);
    for (let c = 0; c < COLS; c++) blit(A.grass[(c * 7) % 4], c);
    blit(A.tree[1], 0); blit(A.tree[0], 1);
    blit(A.tent, 3);
    blit(A.settler.farmer, 4);
    blit(A.campfire[f % 3], 6);
    blit(A.settler.worker, 8);
    blit(A.settler.guard, 9);
    blit(A.tent, 10);
    blit(A.tree[0], 12);
    // the fire's warm glow, breathing
    const cx = 6.5 * CW * sc, cy = gy + 12 * sc;
    const rad = (CW * 4 + (f % 3)) * sc;
    const grad = g.createRadialGradient(cx, cy, 2, cx, cy, rad);
    grad.addColorStop(0, 'rgba(255,150,50,0.28)');
    grad.addColorStop(1, 'rgba(255,150,50,0)');
    g.fillStyle = grad;
    g.fillRect(cx - rad, cy - rad, rad * 2, rad * 2);
    if (cv.isConnected && window.getComputedStyle(cv).display !== 'none') requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

if (window.matchMedia(GATE_MQ).matches) {
  const logo = document.getElementById('mg-logo');
  const scene = document.getElementById('mg-scene');
  if (logo) drawLogo(logo);
  if (scene) startScene(scene);
}
