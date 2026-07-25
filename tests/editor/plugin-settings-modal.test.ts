// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/editor/toast.js', () => ({ showToast: vi.fn() }));

import type { CardMirrorPluginApi } from '../../src/editor/plugin-api.js';
import { isAnyOverlayOpen } from '../../src/editor/overlay-stack.js';
import {
  installPluginRegistry,
  registerPluginDefinition,
  resetPluginRegistryForTests,
} from '../../src/editor/plugin-registry.js';
import { getPluginSettingValue } from '../../src/editor/plugin-settings.js';
import { openPluginSettingsModal } from '../../src/editor/plugin-settings-modal.js';

const stubApi = { showToast: () => {} } as unknown as CardMirrorPluginApi;

function registerDemo(): void {
  installPluginRegistry(() => stubApi);
  const res = registerPluginDefinition({
    id: 'demo',
    name: 'Demo',
    apiVersion: 1,
    commands: [{ id: 'demo.x', label: 'X', run: () => {} }],
    settings: [
      { key: 'on', label: 'Auto-send', type: 'boolean', default: true, description: 'Send as you go' },
      { key: 'endpoint', label: 'Endpoint', type: 'text', default: 'a' },
      { key: 'batch', label: 'Batch', type: 'number', default: 5 },
      { key: 'mode', label: 'Mode', type: 'select', default: 'fast', options: ['fast', 'careful'] },
    ],
  });
  expect(res.ok).toBe(true);
}

const dialog = (): HTMLElement | null => document.querySelector('.pmd-plugin-settings-dialog');

beforeEach(() => {
  document.body.innerHTML = '';
  localStorage.clear();
  registerDemo();
});
afterEach(() => {
  // Whatever a test left open, close it so the shared overlay stack
  // doesn't bleed into the next test.
  document.querySelector<HTMLButtonElement>('.pmd-plugin-settings-dialog .pmd-text-prompt-ok')?.click();
  resetPluginRegistryForTests();
});

describe('plugin settings modal', () => {
  it('renders a titled control per declared setting', () => {
    openPluginSettingsModal('demo', 'Demo');
    const d = dialog()!;
    expect(d.querySelector('.pmd-route-header')!.textContent).toBe('Demo settings');
    const rows = [...d.querySelectorAll('.pmd-plugin-settings-row')];
    expect(rows.length).toBe(4);
    expect(rows[0]!.querySelector('input[type=checkbox]')).toBeTruthy();
    expect(rows[0]!.querySelector('.pmd-settings-row-desc')!.textContent).toBe('Send as you go');
    expect(rows[1]!.querySelector('input[type=text]')).toBeTruthy();
    expect(rows[2]!.querySelector('input[type=number]')).toBeTruthy();
    const select = rows[3]!.querySelector('select')!;
    expect([...select.options].map((o) => o.value)).toEqual(['fast', 'careful']);
    expect(select.value).toBe('fast');
  });

  it('does not open for a plugin with no declared settings', () => {
    openPluginSettingsModal('ghost', 'Ghost');
    expect(dialog()).toBeNull();
    expect(isAnyOverlayOpen()).toBe(false);
  });

  it('applies each control change immediately', () => {
    openPluginSettingsModal('demo', 'Demo');
    const d = dialog()!;
    const fire = (el: Element): boolean => el.dispatchEvent(new Event('change', { bubbles: true }));

    const checkbox = d.querySelector<HTMLInputElement>('input[type=checkbox]')!;
    checkbox.checked = false;
    fire(checkbox);
    expect(getPluginSettingValue('demo', 'on')).toBe(false);

    const text = d.querySelector<HTMLInputElement>('input[type=text]')!;
    text.value = 'http://localhost:9';
    fire(text);
    expect(getPluginSettingValue('demo', 'endpoint')).toBe('http://localhost:9');

    const number = d.querySelector<HTMLInputElement>('input[type=number]')!;
    number.value = '12';
    fire(number);
    expect(getPluginSettingValue('demo', 'batch')).toBe(12);

    const select = d.querySelector<HTMLSelectElement>('select')!;
    select.value = 'careful';
    fire(select);
    expect(getPluginSettingValue('demo', 'mode')).toBe('careful');
  });

  it('snaps an unparseable number entry back to the live value', () => {
    openPluginSettingsModal('demo', 'Demo');
    const number = dialog()!.querySelector<HTMLInputElement>('input[type=number]')!;
    number.value = '';
    number.dispatchEvent(new Event('change', { bubbles: true }));
    expect(getPluginSettingValue('demo', 'batch')).toBe(5);
    expect(number.value).toBe('5');
  });

  it('shows stored values, not defaults, on reopen', () => {
    localStorage.setItem('plugin:demo', JSON.stringify({ __settings: { mode: 'careful', batch: 9 } }));
    openPluginSettingsModal('demo', 'Demo');
    const d = dialog()!;
    expect(d.querySelector<HTMLSelectElement>('select')!.value).toBe('careful');
    expect(d.querySelector<HTMLInputElement>('input[type=number]')!.value).toBe('9');
  });

  it('Done and Escape both close and pop the overlay stack', () => {
    openPluginSettingsModal('demo', 'Demo');
    expect(isAnyOverlayOpen()).toBe(true);
    document.querySelector<HTMLButtonElement>('.pmd-text-prompt-ok')!.click();
    expect(dialog()).toBeNull();
    expect(isAnyOverlayOpen()).toBe(false);

    openPluginSettingsModal('demo', 'Demo');
    expect(isAnyOverlayOpen()).toBe(true);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(dialog()).toBeNull();
    expect(isAnyOverlayOpen()).toBe(false);
  });
});
