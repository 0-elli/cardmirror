// @vitest-environment jsdom

/**
 * Debate Decoded account row: Disconnect must fully clear the
 * connected state (field report 2026-08-17). The "Connected as …"
 * chip's class carries `display: flex`, which outranks the `hidden`
 * attribute's UA rule — so hiding it wasn't enough: its stale contents
 * stayed painted until the dialog was rebuilt. jsdom applies no CSS,
 * so the regression pin is the DOM-honesty half of the fix: after
 * Disconnect the chip is hidden AND empty, and the disconnected
 * controls are back.
 */

import { describe, expect, it, vi, afterEach } from 'vitest';

// The settings modal calls a long tail of host methods while
// rendering; only the account-row ones matter here. Everything else
// gets a benign async no-op via Proxy. Hoisted: vi.mock factories run
// before module-level consts.
const hostState = vi.hoisted(() => {
  const state = { host: {} as Record<string, unknown> };
  const proxiedHost = new Proxy(
    {},
    {
      get(_t, prop: string) {
        if (prop in state.host) return state.host[prop];
        if (prop === 'kind') return 'electron';
        return () => Promise.resolve(undefined);
      },
    },
  );
  return Object.assign(state, { proxiedHost });
});

vi.mock('../../src/editor/toast.js', () => ({ showToast: vi.fn() }));
// benchmark-ui transitively imports editor/index.ts, whose module body
// wires the real app's DOM at import time — fatal in a bare jsdom.
vi.mock('../../src/editor/benchmark-ui.js', () => ({ launchBenchmarkOverlay: vi.fn() }));
vi.mock('../../src/editor/host/index.js', () => ({
  getElectronHost: () => hostState.proxiedHost,
  getHost: () => hostState.proxiedHost,
  isWindowsHost: () => false,
}));

import { openSettings, closeSettings } from '../../src/editor/settings-ui.js';
import { settings } from '../../src/editor/settings.js';

const settled = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

// jsdom lacks ResizeObserver (the modal's tab-strip arrows use one).
class FakeResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
(globalThis as { ResizeObserver?: unknown }).ResizeObserver ??= FakeResizeObserver;

afterEach(() => {
  closeSettings();
  document.body.innerHTML = '';
  hostState.host = {};
});

describe('pairing account row disconnect', () => {
  it('Disconnect empties and hides the Connected chip and restores the connect controls', async () => {
    hostState.host = {
      pairingAccountStatus: async () => ({
        enabled: true,
        connected: true,
        expiresAt: Date.now() + 86_400_000,
        email: 'user@example.com',
      }),
      pairingDisconnectAccount: vi.fn(async () => ({ connected: false, expiresAt: 0 })),
      onPairingEntitlementChanged: () => () => {},
    };

    // The row's controls are dependency-disabled while pairing is off.
    settings.set('pairingEnabled', true);
    openSettings();
    await settled();

    const chip = document.querySelector<HTMLElement>('.pmd-pairing-account-connected');
    const input = document.querySelector<HTMLInputElement>(
      '.pmd-pairing-account-controls .pmd-settings-text',
    );
    expect(chip, 'account row rendered').not.toBeNull();
    expect(chip!.hidden).toBe(false);
    expect(chip!.textContent).toContain('Connected as user@example.com');
    expect(input!.hidden).toBe(true);

    const disconnectBtn = [
      ...document.querySelectorAll<HTMLButtonElement>('.pmd-pairing-account-controls button'),
    ].find((b) => b.textContent === 'Disconnect')!;
    expect(disconnectBtn.hidden).toBe(false);
    expect(disconnectBtn.disabled).toBe(false);
    disconnectBtn.click();
    await settled();

    // The failure mode: chip hidden but still holding "Connected as …",
    // kept visible by its class's display rule.
    expect(chip!.hidden).toBe(true);
    expect(chip!.textContent).toBe('');
    expect(input!.hidden).toBe(false);
    expect(disconnectBtn.hidden).toBe(true);
  });
});
