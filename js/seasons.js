// Time and season helpers.
import { G } from './state.js';
import { SEASONS, SEASON_LEN } from './data.js';

export const timeStr = () => `${String(Math.floor(G.min / 60)).padStart(2, '0')}:${String(G.min % 60).padStart(2, '0')}`;
export const isNight = () => G.min < 320 || G.min >= 1200;
export const seasonIdx = () => Math.floor(((G.day - 1) % (SEASON_LEN * 4)) / SEASON_LEN);
export const season = () => SEASONS[seasonIdx()];
export const isWinter = () => seasonIdx() === 3;
export const daysToWinter = () => Math.max(0, SEASON_LEN * 3 - ((G.day - 1) % (SEASON_LEN * 4)));
export const isHordeDay = (day) => day >= 12 && day % 12 === 0;
