// @vitest-environment jsdom
/**
 * The shared dialog primitives must register on the overlay stack for
 * their whole lifetime. Background key handlers (the home screen's 1-9
 * number shortcuts and its Escape) check `isAnyOverlayOpen()` to stand
 * down while a modal is up — a dialog that skips registration leaks its
 * keys through: picking a pane slot with '1' over the home screen ALSO
 * fired home action 1 (the three-pane open-from-command-bar bug,
 * 2026-07-26).
 */

import { describe, it, expect, afterEach } from 'vitest';
import {
  promptForText,
  promptForChoice,
  promptForRouteChoice,
  alertDialog,
  confirmDialog,
} from '../../src/editor/text-prompt.js';
import { isAnyOverlayOpen } from '../../src/editor/overlay-stack.js';

function pressKey(key: string): void {
  document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('dialog primitives register on the overlay stack', () => {
  it('promptForRouteChoice: open ⇒ overlay open; number key resolves AND pops', async () => {
    const p = promptForRouteChoice<'a' | 'b'>({
      message: 'Pick',
      choices: [
        { value: 'a', label: 'A' },
        { value: 'b', label: 'B' },
      ],
    });
    expect(isAnyOverlayOpen()).toBe(true); // home-screen shortcuts stand down
    pressKey('2');
    await expect(p).resolves.toBe('b');
    expect(isAnyOverlayOpen()).toBe(false); // fully deregistered on close
  });

  it('promptForChoice: Escape cancels and pops', async () => {
    const p = promptForChoice<'x'>({ message: 'Pick', choices: [{ value: 'x', label: 'X' }] });
    expect(isAnyOverlayOpen()).toBe(true);
    pressKey('Escape');
    await expect(p).resolves.toBeNull();
    expect(isAnyOverlayOpen()).toBe(false);
  });

  it('promptForText: cancel via Escape pops', async () => {
    const p = promptForText({ message: 'Name?' });
    expect(isAnyOverlayOpen()).toBe(true);
    pressKey('Escape');
    await expect(p).resolves.toBeNull();
    expect(isAnyOverlayOpen()).toBe(false);
  });

  it('alertDialog / confirmDialog register and pop', async () => {
    const a = alertDialog('Heads up');
    expect(isAnyOverlayOpen()).toBe(true);
    pressKey('Enter');
    await a;
    expect(isAnyOverlayOpen()).toBe(false);

    const c = confirmDialog('Sure?');
    expect(isAnyOverlayOpen()).toBe(true);
    pressKey('Escape');
    await expect(c).resolves.toBe(false);
    expect(isAnyOverlayOpen()).toBe(false);
  });

  it('stacked dialogs: only the topmost reacts to a key', async () => {
    const bottom = promptForRouteChoice<'keep'>({
      message: 'Bottom',
      choices: [{ value: 'keep', label: 'Keep' }],
    });
    const top = confirmDialog('Top');
    // One Escape closes ONLY the top dialog; the bottom stays open.
    pressKey('Escape');
    await expect(top).resolves.toBe(false);
    expect(isAnyOverlayOpen()).toBe(true);
    let bottomSettled = false;
    void bottom.then(() => (bottomSettled = true));
    await new Promise((r) => setTimeout(r, 0));
    expect(bottomSettled).toBe(false);
    // Now the bottom dialog is top again and takes its number key.
    pressKey('1');
    await expect(bottom).resolves.toBe('keep');
    expect(isAnyOverlayOpen()).toBe(false);
  });
});
