// Pixel-art elder portraits for the advisor window: one face per civ,
// three mood expressions each, drawn once onto small canvases and cached.
// Same procedural-pixel style as the sprite atlas — no external assets.

const U = 4; // one "pixel" in canvas units
export const PORTRAIT_W = 17 * U, PORTRAIT_H = 18 * U;

const SKIN = '#d8b090', SHADE = '#bc9572', LINE = '#5a4432', DARK = '#241c14', WHITE = '#e8e4d8';

const cache = new Map();

function r(g, x, y, w, h, c) { g.fillStyle = c; g.fillRect(x * U, y * U, w * U, h * U); }

// head, ears, nose, age lines, neck, shoulders
function base(g, v) {
  r(g, 2, 14, 13, 4, v.garb);
  r(g, 2, 14, 13, 1, v.garbLight);
  r(g, 6, 12, 5, 2, SHADE);            // neck
  r(g, 4, 3, 9, 9, SKIN);              // face
  r(g, 4, 3, 1, 9, SHADE);             // side shading
  r(g, 12, 4, 1, 8, SHADE);
  r(g, 3, 7, 1, 2, SKIN);              // ears
  r(g, 13, 7, 1, 2, SKIN);
  r(g, 5, 9, 1, 1, SHADE);             // age lines
  r(g, 11, 9, 1, 1, SHADE);
  r(g, 8, 7, 1, 2, SHADE);             // nose
  r(g, 8, 9, 2, 1, LINE);
}

function eyes(g, mood) {
  if (mood === 'alarm') {
    r(g, 5, 5, 3, 2, WHITE); r(g, 9, 5, 3, 2, WHITE);   // wide eyes
    r(g, 6, 5, 1, 2, DARK); r(g, 10, 5, 1, 2, DARK);
    r(g, 5, 3, 3, 1, LINE); r(g, 9, 3, 3, 1, LINE);     // brows shot up
  } else if (mood === 'wary') {
    r(g, 5, 6, 3, 1, WHITE); r(g, 9, 6, 3, 1, WHITE);   // narrowed
    r(g, 6, 6, 1, 1, DARK); r(g, 10, 6, 1, 1, DARK);
    r(g, 5, 5, 3, 1, LINE); r(g, 9, 5, 3, 1, LINE);     // knitted brows
    r(g, 7, 4, 1, 1, LINE); r(g, 9, 4, 1, 1, LINE);
  } else {
    r(g, 5, 6, 3, 1, WHITE); r(g, 9, 6, 3, 1, WHITE);
    r(g, 6, 6, 1, 1, DARK); r(g, 10, 6, 1, 1, DARK);
    r(g, 5, 5, 3, 1, SHADE); r(g, 9, 5, 3, 1, SHADE);   // soft brows
  }
}

function mouth(g, mood) {
  if (mood === 'alarm') { r(g, 7, 10, 3, 2, DARK); r(g, 7, 10, 3, 1, '#6a3028'); }
  else if (mood === 'wary') { r(g, 6, 11, 5, 1, LINE); }
  else { r(g, 6, 11, 5, 1, LINE); r(g, 6, 10, 1, 1, LINE); r(g, 10, 10, 1, 1, LINE); } // a small smile
}

// per-civ headwear, garments, and facial hair
const VARIANTS = {
  tillers: { // Elder Maren: grey bun, green shawl
    garb: '#3d6c28', garbLight: '#4f8a35',
    top(g) {
      r(g, 3, 2, 11, 2, '#b8b4a8');
      r(g, 3, 3, 2, 3, '#b8b4a8'); r(g, 12, 3, 2, 3, '#b8b4a8');
      r(g, 6, 0, 5, 2, '#b8b4a8');           // the bun
      r(g, 3, 2, 11, 1, '#cac6ba');
    },
  },
  wardens: { // Captain Bryn: steel half-helm, blue cloak
    garb: '#2c6280', garbLight: '#3a7ea0',
    top(g) {
      r(g, 3, 1, 11, 3, '#8a92a0');
      r(g, 3, 1, 11, 1, '#aab2c0');
      r(g, 2, 3, 2, 3, '#8a92a0'); r(g, 13, 3, 2, 3, '#8a92a0');
      r(g, 8, 0, 1, 1, '#c04040');           // crest stub
    },
    beard(g) { r(g, 5, 11, 7, 2, '#8a8478'); r(g, 6, 13, 5, 1, '#8a8478'); },
  },
  ratcatchers: { // Aunt Odessa: mustard headscarf, earring
    garb: '#7a4a30', garbLight: '#96603e',
    top(g) {
      r(g, 3, 1, 11, 3, '#c8a040');
      r(g, 3, 1, 11, 1, '#e0bc58');
      r(g, 2, 3, 2, 7, '#c8a040');           // scarf drape
      r(g, 13, 3, 2, 4, '#a88430');
      r(g, 13, 9, 1, 1, '#e0bc58');          // earring
    },
  },
  masons: { // Master Hewe: bald, great grey beard
    garb: '#54544f', garbLight: '#6f6f6a',
    top(g) {
      r(g, 4, 2, 9, 1, SHADE);               // bald crown highlight
      r(g, 4, 2, 9, 1, '#e0c4a0');
    },
    beard(g) {
      r(g, 4, 9, 9, 5, '#b0aca0');
      r(g, 5, 14, 7, 1, '#b0aca0');
      r(g, 4, 9, 9, 1, '#c4c0b4');
    },
  },
};

export function elderPortrait(civId, mood) {
  const key = `${civId}|${mood}`;
  let c = cache.get(key);
  if (!c) {
    c = document.createElement('canvas');
    c.width = PORTRAIT_W; c.height = PORTRAIT_H;
    const g = c.getContext('2d');
    g.fillStyle = '#1a1610';
    g.fillRect(0, 0, c.width, c.height);
    const v = VARIANTS[civId] || VARIANTS.tillers;
    base(g, v);
    if (v.beard) v.beard(g);
    v.top(g);
    eyes(g, mood);
    mouth(g, mood);
    cache.set(key, c);
  }
  return c;
}
