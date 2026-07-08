import { describe, it, expect } from 'vitest';
import { aButtonKey } from '../js/gamepad.js';

describe('aButtonKey', () => {
  it('confirms in NORMAL mode', () => {
    expect(aButtonKey('NORMAL', null)).toBe('Enter');
  });
  it('confirms while browsing the build menu (no selection yet)', () => {
    expect(aButtonKey('BUILD', null)).toBe('Enter');
  });
  it('paints while placing a selected building', () => {
    expect(aButtonKey('BUILD', { id: 'tent' })).toBe('Paint');
  });
  it('single-demolishes in CANCEL mode', () => {
    expect(aButtonKey('CANCEL', null)).toBe('Enter');
  });
});
