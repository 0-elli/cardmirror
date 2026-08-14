// @vitest-environment jsdom
/**
 * Receive pill: the popup's footer "Join session" action. Unconditional
 * (joining needs no session state), hidden only where collab itself is
 * (web edition / join prompt not wired).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { ReceivePillController } from '../../src/editor/pairing/receive-pill-ui.js';
import { settings } from '../../src/editor/settings.js';
import { setCollabSessionJoinPrompt } from '../../src/editor/collab/collab-hooks.js';
import * as collabGate from '../../src/editor/collab/collab-gate.js';

function mountPill(): HTMLElement {
  const parent = document.createElement('div');
  document.body.appendChild(parent);
  const pill = new ReceivePillController();
  pill.mount({ parent, getFocusedView: () => null });
  return parent;
}

beforeEach(() => {
  settings.set('pairingEnabled', true);
});

afterEach(() => {
  document.body.innerHTML = '';
  settings.set('pairingEnabled', false);
  setCollabSessionJoinPrompt(null);
  vi.restoreAllMocks();
});

describe('receive pill Join session footer', () => {
  it('shows with the collab gate open and joins on click (empty inbox included)', () => {
    vi.spyOn(collabGate, 'collabEnabled').mockReturnValue(true);
    const joinPrompt = vi.fn();
    setCollabSessionJoinPrompt(joinPrompt);
    const root = mountPill();
    (root.querySelector('.pmd-receive-bar') as HTMLElement).click();

    const btn = root.querySelector('.pmd-receive-action') as HTMLButtonElement;
    expect(btn).toBeTruthy();
    expect(btn.textContent).toContain('Join session');
    expect((btn.closest('.pmd-receive-actions') as HTMLElement).hidden).toBe(false);
    // Present even with nothing received — joining is always possible.
    expect(root.querySelector('.pmd-receive-empty')).toBeTruthy();

    btn.click();
    expect(joinPrompt).toHaveBeenCalledTimes(1);
    // The click closes the popup so the join prompt isn't underneath it.
    expect((root.querySelector('.pmd-receive-pill') as HTMLElement).dataset['open']).toBe('false');
  });

  it('stays hidden while the collab gate is closed or the prompt is unwired', () => {
    vi.spyOn(collabGate, 'collabEnabled').mockReturnValue(true);
    // Gate open but no prompt registered → hidden.
    const root = mountPill();
    (root.querySelector('.pmd-receive-bar') as HTMLElement).click();
    expect((root.querySelector('.pmd-receive-actions') as HTMLElement).hidden).toBe(true);
  });
});
