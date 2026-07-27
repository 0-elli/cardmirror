// @vitest-environment jsdom
/**
 * Palette result paging over a large file corpus (perf batch,
 * 2026-07-27): file matches are ranked in full but materialized and
 * rendered 50 at a time — the per-keystroke DOM rebuild and result-
 * object churn must stay bounded no matter how big the search folders
 * are. Drives the real singleton with a mocked Electron host.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const hostState = vi.hoisted(() => ({
  files: [] as Array<{ path: string; relPath: string; mtimeMs: number; size: number }>,
}));

vi.mock('../../src/editor/host/index.js', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../../src/editor/host/index.js')>();
  return {
    ...mod,
    // Only the Electron host is faked (file listing); everything else —
    // notably getHost(), which ribbon-commands reads at import — stays real.
    getElectronHost: () => ({
      listCmirFiles: async () => hostState.files,
      onCmirFileIndexUpdated: () => () => {},
      readFileAtPath: async () => null,
    }),
  };
});

import { quickCardSearchUI } from '../../src/editor/quick-card-search-ui.js';
import { settings } from '../../src/editor/settings.js';

function openPalette(): void {
  quickCardSearchUI.open({
    view: null,
    paneEl: null,
    runCommand: () => {},
    openFilePath: () => {},
  });
}

function type(q: string): void {
  const input = document.querySelector<HTMLInputElement>('.pmd-qcs-input')!;
  input.value = q;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

const rowCount = (): number => document.querySelectorAll('.pmd-qcs-row').length;
const moreEl = (): HTMLElement | null => document.querySelector('.pmd-qcs-more');

/** Let the open-time listCmirFiles round-trip + re-search settle. */
const settle = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  hostState.files = Array.from({ length: 120 }, (_, i) => ({
    path: `/root/Warming ${i}.cmir`,
    relPath: `Neg/Warming ${i}.cmir`,
    mtimeMs: i,
    size: 1,
  }));
  settings.set('fileSearchRoots', ['/root']);
});

afterEach(() => {
  if (quickCardSearchUI.isOpen()) quickCardSearchUI.close();
  document.body.innerHTML = '';
});

describe('palette file paging', () => {
  it('file browse renders 50 rows per page with an accurate overflow count', async () => {
    openPalette();
    await settle(); // open() kicks the file-list load immediately
    type('f '); // file prefix, empty query = browse everything
    expect(rowCount()).toBe(50);
    expect(moreEl()?.textContent).toContain('Showing 50 of 120');

    const firstRowText = document.querySelector('.pmd-qcs-row')?.textContent;
    moreEl()!.click();
    expect(rowCount()).toBe(100);
    // Earlier rows keep their identity/order as the window grows.
    expect(document.querySelector('.pmd-qcs-row')?.textContent).toBe(firstRowText);

    moreEl()!.click();
    expect(rowCount()).toBe(120);
    expect(moreEl()).toBeNull(); // everything shown — no overflow row
  });

  it('everything search folds file matches in behind other sources, same paging', async () => {
    openPalette();
    await settle();
    type('warming'); // no prefix — matches all 120 files by name
    expect(rowCount()).toBe(50);
    const more = moreEl();
    expect(more?.textContent).toMatch(/Showing 50 of \d+ — show more/);
  });

  it('file list is requested at open, so the first keystroke searches it synchronously', async () => {
    openPalette();
    await settle(); // list arrives while the bar is still empty
    type('warming 7'); // first "keystroke": files must already be searchable
    expect(rowCount()).toBeGreaterThan(0);
    expect(
      [...document.querySelectorAll('.pmd-qcs-row-name')].some(
        (el) => el.textContent === 'Warming 7',
      ),
    ).toBe(true);
  });
});
