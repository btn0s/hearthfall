import { describe, it, expect } from 'vitest';
import { BALANCE } from '../js/balance.js';

describe('BALANCE', () => {
  it('keeps roadmap-named tuning values', () => {
    expect(BALANCE.hunger.rate).toBe(0.075);
    expect(BALANCE.crop.growthRate).toBe(0.23);
    expect(BALANCE.morale.drift).toBe(0.0004);
    expect(BALANCE.raid.timerNormal).toBe(420);
    expect(BALANCE.raid.timerHorde).toBe(560);
    expect(BALANCE.hunger.eatTrigger).toBe(72);
    expect(BALANCE.hunger.mealRelief).toBe(65);
    expect(BALANCE.hunger.foodRelief).toBe(46);
  });

  it('lists work costs used by findJob', () => {
    expect(BALANCE.work.douse).toBe(6);
    expect(BALANCE.work.chop).toBe(18);
    expect(BALANCE.work.mine).toBe(26);
  });
});
