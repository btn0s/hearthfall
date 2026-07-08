import { BUILDS, STRUCT_HP } from './data.js';
import { G } from './state.js';

export const buildDef = (id) => BUILDS.find(b => b.id === id);

export function structMax(t) {
  const base = STRUCT_HP[t];
  if (!base) return 0;
  return (t === 'wall_w' || t === 'wall_s') ? Math.round(base * G.mods.wallHp) : base;
}

export const structDamaged = (tl) => STRUCT_HP[tl.t] && tl.hp !== undefined && tl.hp <= structMax(tl.t) - 15;
