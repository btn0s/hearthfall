// Dawn coordinator — commune events, world growth, autosave.
import { G } from './state.js';
import { communeDawn } from './game.js';
import { worldDawn } from './world.js';
import { save } from './save.js';

export function onDawn() {
  communeDawn();
  if (!G.gameOver) {
    worldDawn();
    save();
  }
}
