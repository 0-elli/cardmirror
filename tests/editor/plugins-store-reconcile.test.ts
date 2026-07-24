// @vitest-environment jsdom
// Boot reconciliation for plugin leftovers (Shreeram review, 2026-07-24):
// enabled flags, `plugin:<id>` storage bags, and dot-namespaced key
// overrides must not outlive the plugin's install DIRECTORY — the one
// unambiguous "really uninstalled" signal. A plugin that merely failed
// to load is still installed and must lose nothing.
import { describe, it, expect, beforeEach } from 'vitest';
import {
  isPluginEnabled,
  setPluginEnabled,
  reconcilePluginState,
} from '../../src/editor/plugins-store.js';
import { settings } from '../../src/editor/settings.js';

beforeEach(() => {
  localStorage.clear();
  settings.set('ribbonKeyOverrides', {});
});

describe('reconcilePluginState', () => {
  it('prunes flags, bags, and overrides of directory-absent plugins only', () => {
    setPluginEnabled('alive', true);
    setPluginEnabled('gone', true);
    localStorage.setItem('plugin:alive', '{"x":1}');
    localStorage.setItem('plugin:gone', '{"x":2}');
    settings.set('ribbonKeyOverrides', {
      'alive.go': 'Mod-Alt-1',
      'gone.go': 'Mod-Alt-2',
      // Static commands have no dots — must never be touched.
      openSettings: 'Mod-Alt-3',
    });

    reconcilePluginState(new Set(['alive']));

    expect(isPluginEnabled('alive')).toBe(true);
    expect(isPluginEnabled('gone')).toBe(false);
    expect(localStorage.getItem('plugin:alive')).not.toBeNull();
    expect(localStorage.getItem('plugin:gone')).toBeNull();
    const overrides = settings.get('ribbonKeyOverrides');
    expect(overrides['alive.go']).toBe('Mod-Alt-1');
    expect(overrides['gone.go']).toBeUndefined();
    expect(overrides['openSettings']).toBe('Mod-Alt-3');
  });

  it('an installed-but-not-loaded plugin keeps everything (load failure ≠ uninstall)', () => {
    setPluginEnabled('flaky', true);
    settings.set('ribbonKeyOverrides', { 'flaky.go': 'Mod-Alt-4' });
    // 'flaky' IS in the installed set — it just never registered this session.
    reconcilePluginState(new Set(['flaky']));
    expect(isPluginEnabled('flaky')).toBe(true);
    expect(settings.get('ribbonKeyOverrides')['flaky.go']).toBe('Mod-Alt-4');
  });
});
