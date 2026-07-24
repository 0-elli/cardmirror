// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest';

const hostState = vi.hoisted(() => ({ host: {} as Record<string, unknown> }));
const settingsState = vi.hoisted(() => ({
  overrides: {} as Record<string, string | string[]>,
}));

vi.mock('../../src/editor/toast.js', () => ({ showToast: vi.fn() }));
vi.mock('../../src/editor/text-prompt.js', () => ({ confirmDialog: vi.fn() }));
vi.mock('../../src/editor/settings.js', () => ({
  settings: {
    get: (k: string) => (k === 'ribbonKeyOverrides' ? settingsState.overrides : true),
    set: (k: string, v: unknown) => {
      if (k === 'ribbonKeyOverrides') settingsState.overrides = v as Record<string, string>;
    },
  },
}));
vi.mock('../../src/editor/host/index.js', () => ({
  getElectronHost: () => hostState.host,
}));

import { renderPluginsPanel } from '../../src/editor/plugins-settings-ui.js';
import { confirmDialog } from '../../src/editor/text-prompt.js';

/** Wait out the panel's initial `refresh()` microtask. */
const settled = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  document.body.innerHTML = '';
  settingsState.overrides = {};
  hostState.host = {
    pluginList: () => Promise.resolve([{ id: 'demo', name: 'Demo', version: '1.0.0' }]),
  };
  vi.mocked(confirmDialog).mockReset();
});

describe('plugins settings panel styling', () => {
  it('dresses its widgets in the shared settings classes', async () => {
    window.__registerCardMirrorPlugin = (() => ({ ok: true })) as never;
    const el = document.createElement('div');
    renderPluginsPanel(el);
    await settled();

    expect(el.querySelector('.pmd-plugins-input')!.classList).toContain('pmd-settings-text');
    // Every button in the panel — install, per-plugin actions, dev loader —
    // uses the settings button style rather than the bare UA control.
    const buttons = [...el.querySelectorAll('button')];
    expect(buttons.length).toBeGreaterThan(2);
    expect(buttons.every((b) => b.classList.contains('pmd-install-info-btn'))).toBe(true);
    expect(el.querySelector('.pmd-plugins-row input')!.classList).toContain('pmd-settings-toggle');
    expect(el.querySelectorAll('.pmd-settings-section-title').length).toBe(3);
  });

  it('renders the gated message as a styled placeholder, not bare text', () => {
    window.__registerCardMirrorPlugin = undefined;
    const el = document.createElement('div');
    renderPluginsPanel(el);
    expect(el.querySelector('.pmd-settings-empty')!.textContent).toBe(
      'Restart CardMirror to activate plugins.',
    );
  });
});

describe('install consent flow (two-phase)', () => {
  /** Drive the panel through an install attempt against a recording host. */
  async function runInstall(consent: boolean): Promise<{ calls: string[]; messages: string[] }> {
    const calls: string[] = [];
    hostState.host = {
      pluginList: () => Promise.resolve([]),
      pluginInstallInspect: (ref: string) => {
        calls.push(`inspect:${ref}`);
        return Promise.resolve({
          ok: true,
          pending: 'tok-1',
          ownerRepo: 'somebody/thing',
          plugin: { id: 'thing', name: 'Thing', version: '1.0.0', author: 'Nice Name' },
        });
      },
      pluginInstallCommit: (token: string) => {
        calls.push(`commit:${token}`);
        return Promise.resolve({ ok: true, plugin: { id: 'thing' } });
      },
      pluginInstallDiscard: (token: string) => {
        calls.push(`discard:${token}`);
        return Promise.resolve();
      },
      pluginUninstall: () => {
        calls.push('uninstall');
        return Promise.resolve();
      },
      pluginLoad: () => Promise.resolve({ ok: true }),
    };
    const messages: string[] = [];
    vi.mocked(confirmDialog).mockImplementation((msg: string) => {
      messages.push(msg);
      return Promise.resolve(consent);
    });
    window.__registerCardMirrorPlugin = (() => ({ ok: true })) as never;
    const el = document.createElement('div');
    renderPluginsPanel(el);
    await settled();
    const input = el.querySelector<HTMLInputElement>('.pmd-plugins-input')!;
    input.value = 'somebody/thing';
    el.querySelector<HTMLButtonElement>('.pmd-plugins-install button')!.click();
    await settled();
    await settled();
    return { calls, messages };
  }

  it('declining consent discards the staged install — never a disk write, never an uninstall', async () => {
    // The regression this pins: the old flow installed (overwriting any
    // existing version) BEFORE consent, then deleted the whole install on
    // decline — so declining a reinstall destroyed a working plugin.
    const { calls } = await runInstall(false);
    expect(calls).toContain('inspect:somebody/thing');
    expect(calls).toContain('discard:tok-1');
    expect(calls.some((c) => c.startsWith('commit'))).toBe(false);
    expect(calls).not.toContain('uninstall');
  });

  it('consent names the ACTUAL owner/repo, not just manifest-controlled fields', async () => {
    const { calls, messages } = await runInstall(true);
    expect(messages[0]).toContain('github.com/somebody/thing');
    expect(messages[0]).toContain('full access');
    expect(calls).toContain('commit:tok-1');
  });
});

describe('uninstall cleans up completely (Shreeram review, 2026-07-24)', () => {
  it('deregisters live commands and purges the plugin\'s key overrides', async () => {
    const { installPluginRegistry, registerPluginDefinition, pluginCommandIds, resetPluginRegistryForTests } =
      await import('../../src/editor/plugin-registry.js');
    resetPluginRegistryForTests();
    installPluginRegistry(() => ({}) as never);
    registerPluginDefinition({
      id: 'demo',
      name: 'Demo',
      apiVersion: 1,
      commands: [{ id: 'demo.hello', label: 'Hi', run: () => {} }],
    });
    settingsState.overrides = { 'demo.hello': 'Mod-Alt-5', openSettings: 'Mod-Alt-6' };
    const calls: string[] = [];
    hostState.host = {
      pluginList: () => Promise.resolve([{ id: 'demo', name: 'Demo', version: '1.0.0' }]),
      pluginUninstall: (id: string) => {
        calls.push(`uninstall:${id}`);
        return Promise.resolve();
      },
    };
    vi.mocked(confirmDialog).mockResolvedValue(true);
    window.__registerCardMirrorPlugin = (() => ({ ok: true })) as never;
    const el = document.createElement('div');
    renderPluginsPanel(el);
    await settled();
    const uninstallBtn = [...el.querySelectorAll('button')].find(
      (b) => b.textContent === 'Uninstall',
    )!;
    uninstallBtn.click();
    await settled();
    await settled();
    expect(calls).toContain('uninstall:demo');
    expect(pluginCommandIds()).toEqual([]); // deregistered NOW, not at restart
    expect(settingsState.overrides['demo.hello']).toBeUndefined();
    expect(settingsState.overrides['openSettings']).toBe('Mod-Alt-6'); // static untouched
    resetPluginRegistryForTests();
  });
});
