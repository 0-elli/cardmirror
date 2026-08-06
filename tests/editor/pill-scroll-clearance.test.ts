// @vitest-environment jsdom
/**
 * Typing at the doc's end must auto-scroll the caret clear of the
 * pill tray (pill-scroll-clearance.ts). The tray floats fixed over
 * the editor's bottom-left; the doc's padding runway made room to
 * scroll but PM's type-time auto-scroll didn't know the strip was
 * obscured — the caret parked behind the pills (field reports
 * 2026-07-15 and 2026-08-05).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { EditorState } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { schema, newHeadingId } from '../../src/schema/index.js';
import {
  pillScrollClearancePlugin,
  trayBottomClearance,
} from '../../src/editor/pill-scroll-clearance.js';

function mkView(): EditorView {
  const el = document.createElement('div');
  document.body.appendChild(el);
  const doc = schema.nodes['doc']!.createChecked(null, [
    schema.nodes['card']!.createChecked(null, [
      schema.nodes['tag']!.create({ id: newHeadingId() }, schema.text('Alpha')),
      schema.nodes['card_body']!.create(null, schema.text('body')),
    ]),
  ]);
  return new EditorView(el, {
    state: EditorState.create({ doc, plugins: [pillScrollClearancePlugin()] }),
  });
}

/** Stand up a pill tray whose rect reports the given height (jsdom
 *  has no layout, so the rect is stubbed). */
function mountTray(height: number): HTMLElement {
  const tray = document.createElement('div');
  tray.className = 'pmd-pill-tray';
  tray.getBoundingClientRect = () =>
    ({ height, width: 120, top: 700, bottom: 700 + height, left: 0, right: 120 }) as DOMRect;
  document.body.appendChild(tray);
  return tray;
}

beforeEach(() => {
  document.documentElement.classList.remove('pmd-pill-tray-active');
});
afterEach(() => {
  document.body.innerHTML = '';
  document.documentElement.classList.remove('pmd-pill-tray-active');
});

describe('pill scroll clearance', () => {
  it('no tray → PM stock values (threshold 0 / margin 5)', () => {
    const view = mkView();
    const threshold = view.someProp('scrollThreshold') as Record<string, number>;
    const margin = view.someProp('scrollMargin') as Record<string, number>;
    expect(threshold['bottom']).toBe(0);
    expect(margin['bottom']).toBe(5);
    expect(threshold['top']).toBe(0);
    expect(margin['top']).toBe(5);
    view.destroy();
  });

  it('active tray adds its measured height (plus breathing room) to the bottom side', () => {
    const view = mkView();
    mountTray(30);
    document.documentElement.classList.add('pmd-pill-tray-active');
    const threshold = view.someProp('scrollThreshold') as Record<string, number>;
    const margin = view.someProp('scrollMargin') as Record<string, number>;
    expect(threshold['bottom']).toBe(44); // 30 + 14 breathing
    expect(margin['bottom']).toBe(49); // + PM's base 5
    // Unobscured sides untouched.
    expect(threshold['top']).toBe(0);
    expect(margin['left']).toBe(5);
    view.destroy();
  });

  it('the getters re-measure live: tray growth and hide are seen without rebuilds', () => {
    const view = mkView();
    const tray = mountTray(30);
    document.documentElement.classList.add('pmd-pill-tray-active');
    const margin = view.someProp('scrollMargin') as Record<string, number>;
    expect(margin['bottom']).toBe(49);
    // Panel expands…
    tray.getBoundingClientRect = () =>
      ({ height: 400, width: 120, top: 330, bottom: 730, left: 0, right: 120 }) as DOMRect;
    expect(margin['bottom']).toBe(145); // clamped: 140 cap + base 5
    // …tray hides.
    document.documentElement.classList.remove('pmd-pill-tray-active');
    expect(margin['bottom']).toBe(5);
    view.destroy();
  });

  it('multi-pane: only the tray-anchored pane gets the clearance', () => {
    const pane = document.createElement('div');
    pane.className = 'pmd-pane';
    const inner = document.createElement('div');
    pane.appendChild(inner);
    document.body.appendChild(pane);
    mountTray(30);
    document.documentElement.classList.add('pmd-pill-tray-active');

    expect(trayBottomClearance(inner)).toBe(0); // not the anchor pane
    pane.classList.add('pmd-pane-pill-anchored');
    expect(trayBottomClearance(inner)).toBe(44);
  });
});
