// Reusable focusable list menu for screens and modals.
import { fillBg, str } from '../gfx.js';
import { drawWidgets } from '../ui.js';

/**
 * @param {object} opts
 * @param {string} opts.id
 * @param {Array<{key?: string, label: () => string, fg?: string, act: () => void, disabled?: () => boolean}>} opts.items
 * @param {number} opts.x0
 * @param {number} opts.y0
 * @param {number} opts.w
 * @param {number} [opts.rowH=1]
 * @param {boolean} [opts.modal=true]
 * @param {boolean} [opts.pausesSim=false]
 * @param {(f: number) => void} [opts.drawChrome]
 * @param {Record<string, () => void>} [opts.keymapExtra]
 */
export function makeListScreen({ id, items, x0, y0, w, rowH = 1, modal = true, pausesSim = false, drawChrome, keymapExtra = {} }) {
  const scr = {
    id, modal, pausesSim, focus: 0,
    widgets: items.map((it, i) => ({
      rect: { x: x0, y: y0 + i * rowH, w, h: rowH },
      focusable: true,
      disabled: it.disabled,
      onActivate: it.act,
      draw(wd, focused) {
        const dis = it.disabled && it.disabled();
        const bg = focused ? '#22304a' : '#12151e';
        if (focused) fillBg(x0, wd.rect.y, w, rowH, bg);
        const prefix = it.key != null ? `${it.key}) ` : '';
        str(x0 + (it.key != null ? 2 : 1), wd.rect.y,
          `${focused ? '►' : ' '}${prefix}${it.label()}`,
          dis ? '#5a5f6a' : (focused ? '#ffe8a0' : (it.fg || '#e8d8a0')), focused ? bg : undefined);
      },
    })),
    keymap: {
      ...keymapExtra,
      ...(items.some(it => it.key != null)
        ? Object.fromEntries(items.filter(it => it.key != null).map(it => [it.key, it.act]))
        : {}),
    },
    onKey(k) {
      const it = items.find(i => i.key === k);
      if (it && !(it.disabled && it.disabled())) it.act();
    },
    draw(f) {
      if (drawChrome) drawChrome(f);
      drawWidgets(scr, f);
    },
  };
  return scr;
}
