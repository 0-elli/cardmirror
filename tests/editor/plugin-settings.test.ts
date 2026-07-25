// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/editor/toast.js', () => ({ showToast: vi.fn() }));

import type { CardMirrorPluginApi } from '../../src/editor/plugin-api.js';
import { createPluginApi } from '../../src/editor/plugin-api.js';
import {
  installPluginRegistry,
  registerPluginDefinition,
  resetPluginRegistryForTests,
  type PluginDefinition,
} from '../../src/editor/plugin-registry.js';
import {
  getPluginSettingValue,
  resetPluginSettingListenersForTests,
  setPluginSettingValue,
  subscribePluginSettings,
} from '../../src/editor/plugin-settings.js';

const stubApi = { showToast: () => {} } as unknown as CardMirrorPluginApi;

function register(settings: PluginDefinition['settings']): void {
  installPluginRegistry(() => stubApi);
  const res = registerPluginDefinition({
    id: 'demo',
    name: 'Demo',
    apiVersion: 1,
    commands: [{ id: 'demo.x', label: 'X', run: () => {} }],
    settings,
  });
  expect(res.ok).toBe(true);
}

beforeEach(() => localStorage.clear());
afterEach(() => {
  resetPluginRegistryForTests();
  resetPluginSettingListenersForTests();
});

describe('plugin setting values', () => {
  it('falls back to declared defaults when nothing is stored', () => {
    register([
      { key: 'on', label: 'On', type: 'boolean', default: true },
      { key: 'mode', label: 'Mode', type: 'select', default: 'fast', options: ['fast', 'careful'] },
    ]);
    expect(getPluginSettingValue('demo', 'on')).toBe(true);
    expect(getPluginSettingValue('demo', 'mode')).toBe('fast');
    expect(getPluginSettingValue('demo', 'undeclared')).toBeUndefined();
  });

  it('round-trips writes inside the plugin storage bag without clobbering it', () => {
    register([{ key: 'batch', label: 'Batch', type: 'number', default: 5 }]);
    localStorage.setItem('plugin:demo', JSON.stringify({ own: 'data' }));
    setPluginSettingValue('demo', 'batch', 9);
    expect(getPluginSettingValue('demo', 'batch')).toBe(9);
    const bag = JSON.parse(localStorage.getItem('plugin:demo')!) as Record<string, unknown>;
    expect(bag['own']).toBe('data');
    expect(bag['__settings']).toEqual({ batch: 9 });
  });

  it('degrades type-corrupted stored values to the default', () => {
    register([
      { key: 'batch', label: 'Batch', type: 'number', default: 5 },
      { key: 'mode', label: 'Mode', type: 'select', default: 'fast', options: ['fast', 'careful'] },
    ]);
    localStorage.setItem(
      'plugin:demo',
      JSON.stringify({ __settings: { batch: 'lots', mode: 'reckless' } }),
    );
    expect(getPluginSettingValue('demo', 'batch')).toBe(5);
    expect(getPluginSettingValue('demo', 'mode')).toBe('fast');
  });

  it('notifies subscribers on write and contains a throwing listener', () => {
    register([{ key: 'on', label: 'On', type: 'boolean', default: false }]);
    const seen: Array<[string, unknown]> = [];
    const boom = vi.fn(() => {
      throw new Error('listener boom');
    });
    subscribePluginSettings('demo', boom);
    const unsub = subscribePluginSettings('demo', (k, v) => seen.push([k, v]));
    setPluginSettingValue('demo', 'on', true);
    expect(seen).toEqual([['on', true]]);
    expect(boom).toHaveBeenCalledOnce();
    unsub();
    setPluginSettingValue('demo', 'on', false);
    expect(seen.length).toBe(1);
  });

  it('api.settings serves values and change events to the plugin', () => {
    register([{ key: 'on', label: 'On', type: 'boolean', default: false }]);
    const api = createPluginApi('demo', {
      appVersion: '0.0.0',
      getView: () => null,
      findViewForDocId: () => null,
      getDocIdentity: () => null,
      ensureDocId: () => null,
    });
    expect(api.settings.get('on')).toBe(false);
    const events: unknown[] = [];
    api.settings.onChanged((key, value) => events.push([key, value]));
    setPluginSettingValue('demo', 'on', true);
    expect(api.settings.get('on')).toBe(true);
    expect(events).toEqual([['on', true]]);
  });
});
