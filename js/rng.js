export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const state = { r: mulberry32((Date.now() % 2147483647) >>> 0) };

export const rnd = () => state.r();
export const rint = (a, b) => a + Math.floor(state.r() * (b - a + 1));
export const choice = (arr) => arr[Math.floor(state.r() * arr.length)];
export const chance = (p) => state.r() < p;
