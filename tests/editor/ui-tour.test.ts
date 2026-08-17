// @vitest-environment jsdom

/**
 * UI tour (spotlight onboarding, 2026-08-18). Pinned:
 *  - sequencing: next/back/skip/Esc, dots, Done ends
 *  - availability adapter: absent target → adapted centered card (the
 *    single-pane speech-stack case), never a crash or a silent skip
 *  - null/renamed target degrades to the adapted card (resilience)
 *  - interactive step advances its card when the palette opens
 *  - auto-start policy: fresh profile tours once; a profile with
 *    recent files is marked seen WITHOUT touring
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../src/editor/quick-card-search-ui.js', () => {
  const listeners = new Set<() => void>();
  return {
    quickCardSearchUI: {
      isOpen: () => false,
      close: vi.fn(),
    },
    onQuickCardSearchOpen: (cb: () => void) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    __fireOpen: () => {
      for (const cb of listeners) cb();
    },
  };
});

import { UiTourController, startUiTour, maybeAutoStartUiTour } from '../../src/editor/ui-tour.js';
import { settings } from '../../src/editor/settings.js';
import * as qcs from '../../src/editor/quick-card-search-ui.js';

function buildChrome(opts: { speech?: boolean } = {}): void {
  const ids = [
    'file-stack',
    'formatting-panel',
    'nav-panel',
    'read-mode-btn',
    'timer-toggle-btn',
    'settings-btn',
  ];
  for (const id of ids) {
    const el = document.createElement('div');
    el.id = id;
    // jsdom has no layout — give rects manually.
    el.getBoundingClientRect = () =>
      ({ left: 10, top: 10, width: 80, height: 40, right: 90, bottom: 50 }) as DOMRect;
    document.body.appendChild(el);
  }
  if (opts.speech) {
    const s = document.createElement('div');
    s.id = 'speech-stack';
    s.getBoundingClientRect = () =>
      ({ left: 100, top: 10, width: 80, height: 40, right: 180, bottom: 50 }) as DOMRect;
    document.body.appendChild(s);
  }
  const learn = document.createElement('div');
  const manage = document.createElement('button');
  manage.id = 'manage-flashcards-btn';
  learn.appendChild(manage);
  learn.getBoundingClientRect = () =>
    ({ left: 200, top: 10, width: 60, height: 40, right: 260, bottom: 50 }) as DOMRect;
  document.body.appendChild(learn);
  const pm = document.createElement('div');
  pm.className = 'ProseMirror';
  pm.getBoundingClientRect = () =>
    ({ left: 10, top: 100, width: 500, height: 400, right: 510, bottom: 500 }) as DOMRect;
  document.body.appendChild(pm);
}

const card = () => document.querySelector<HTMLElement>('.pmd-tour-card');
const btn = (label: string) =>
  [...document.querySelectorAll<HTMLButtonElement>('.pmd-tour-card button')].find(
    (b) => b.textContent === label,
  );

beforeEach(() => {
  settings.set('hasSeenUiTour', false);
  settings.set('navPaneVisible', true);
});

afterEach(() => {
  document.body.innerHTML = '';
  localStorage.clear();
  vi.useRealTimers();
});

describe('UI tour', () => {
  it('walks forward and back through the full sequence and ends on Done', () => {
    buildChrome({ speech: true });
    const tour = new UiTourController();
    tour.start();
    expect(tour.running).toBe(true);
    expect(card()!.textContent).toContain('Welcome');

    btn('Next')!.click();
    expect(card()!.textContent).toContain('The editor');
    btn('Back')!.click();
    expect(card()!.textContent).toContain('Welcome');

    // Forward through everything: welcome + 11 more steps.
    for (let i = 0; i < 11; i++) btn('Next')!.click();
    expect(card()!.textContent).toContain('That’s the tour');
    btn('Done')!.click();
    expect(tour.running).toBe(false);
    expect(document.querySelector('.pmd-tour')).toBeNull();
  });

  it('Escape skips out at any step', () => {
    buildChrome();
    const tour = new UiTourController();
    tour.start();
    btn('Next')!.click();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(tour.running).toBe(false);
  });

  it('a structurally absent target shows the adapted card instead of skipping', () => {
    buildChrome({ speech: false }); // single-pane: no speech stack
    const tour = new UiTourController();
    tour.start();
    // welcome → editor → styles → nav → files → read mode → speech
    for (let i = 0; i < 6; i++) btn('Next')!.click();
    expect(card()!.textContent).toContain('Speech docs');
    expect(card()!.textContent).toContain('three-pane workspace');
    // and the tour continues normally
    btn('Next')!.click();
    expect(card()!.textContent).toContain('Timer');
  });

  it('a missing/renamed target degrades to the adapted card, not a crash', () => {
    buildChrome();
    document.getElementById('formatting-panel')!.remove();
    const tour = new UiTourController();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    tour.start();
    btn('Next')!.click(); // editor
    btn('Next')!.click(); // styles — target gone
    expect(card()!.textContent).toContain('Structural styles');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('target missing'));
    warn.mockRestore();
  });

  it('the interactive step advances its card when the palette opens', () => {
    buildChrome({ speech: true });
    const tour = new UiTourController();
    tour.start();
    for (let i = 0; i < 10; i++) btn('Next')!.click();
    expect(card()!.textContent).toContain('command bar');
    (qcs as unknown as { __fireOpen: () => void }).__fireOpen();
    expect(card()!.textContent).toContain('prefixes narrow it');
  });

  it('auto-start tours a fresh profile once and marks upgraders seen without touring', () => {
    vi.useFakeTimers();
    buildChrome({ speech: true });

    // Upgrader: recent files exist → marked seen, no overlay.
    localStorage.setItem('pmd-recent-files', JSON.stringify(['/some/file.docx']));
    maybeAutoStartUiTour();
    vi.advanceTimersByTime(2000);
    expect(document.querySelector('.pmd-tour')).toBeNull();
    expect(settings.get('hasSeenUiTour')).toBe(true);

    // Fresh profile: tours once the chrome exists, and only once.
    settings.set('hasSeenUiTour', false);
    localStorage.removeItem('pmd-recent-files');
    maybeAutoStartUiTour();
    vi.advanceTimersByTime(2000);
    expect(document.querySelector('.pmd-tour')).not.toBeNull();
    expect(settings.get('hasSeenUiTour')).toBe(true);
  });

  it('startUiTour marks the tour seen', () => {
    buildChrome();
    startUiTour();
    expect(settings.get('hasSeenUiTour')).toBe(true);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
  });
});
