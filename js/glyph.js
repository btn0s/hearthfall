// Block-letter wordmark shared by title screen and mobile landing.
import { put } from './gfx.js';

export const FONT = {
  H: ['█ █', '█ █', '███', '█ █', '█ █'],
  E: ['███', '█  ', '██ ', '█  ', '███'],
  A: ['███', '█ █', '███', '█ █', '█ █'],
  R: ['██ ', '█ █', '██ ', '█ █', '█ █'],
  T: ['███', ' █ ', ' █ ', ' █ ', ' █ '],
  F: ['███', '█  ', '██ ', '█  ', '█  '],
  L: ['█  ', '█  ', '█  ', '█  ', '███'],
};

export function drawBig(x0, y0, word, colors) {
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
