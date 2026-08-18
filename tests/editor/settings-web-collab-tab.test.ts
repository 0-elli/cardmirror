// @vitest-environment jsdom
/**
 * Web Collaboration tab visibility (web-collab Phase 3): the pairing
 * tab is electronOnly, EXCEPT on a browser host with the collab gate
 * open — where it surfaces carrying only its non-electronOnly rows
 * (account linking + self-host relay), never the card-sharing set.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { vi } from 'vitest';

type WinStub = { electronAPI?: unknown };

async function loadTabs(): Promise<() => { id: string }[]> {
  vi.resetModules();
  const mod = await import('../../src/editor/settings-categories.js');
  return mod.visibleCategoryTabs;
}

afterEach(() => {
  delete (window as unknown as WinStub).electronAPI;
  window.localStorage.clear();
});

describe('Collaboration tab on web', () => {
  it('hidden on a browser host with the gate closed (shipped default)', async () => {
    delete (window as unknown as WinStub).electronAPI;
    const tabs = (await loadTabs())();
    expect(tabs.some((t) => t.id === 'pairing')).toBe(false);
    // Other electronOnly tabs stay hidden too.
    expect(tabs.some((t) => t.id === 'plugins')).toBe(false);
  });

  it('appears on a browser host once the collab gate is open', async () => {
    delete (window as unknown as WinStub).electronAPI;
    window.localStorage.setItem('pmd-collab-web', '1');
    const tabs = (await loadTabs())();
    expect(tabs.some((t) => t.id === 'pairing')).toBe(true);
    expect(tabs.some((t) => t.id === 'plugins')).toBe(false); // only pairing opens
  });

  it('always present on Electron', async () => {
    (window as unknown as WinStub).electronAPI = {};
    const tabs = (await loadTabs())();
    expect(tabs.some((t) => t.id === 'pairing')).toBe(true);
  });

  it('web-visible pairing rows are exactly the account + self-host relay set', async () => {
    vi.resetModules();
    delete (window as unknown as WinStub).electronAPI;
    const { SETTING_METADATA } = await import('../../src/editor/settings.js');
    const webRows = SETTING_METADATA.filter(
      (m) => m.category === 'pairing' && !m.electronOnly && !m.windowsOnly,
    ).map((m) => m.key);
    expect(webRows).toEqual(['pairingConnectedUntil', 'pairingRelayUrl', 'pairingRelayToken']);
  });
});
