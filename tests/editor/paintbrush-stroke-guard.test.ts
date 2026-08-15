// @vitest-environment jsdom

/**
 * Paintbrush stroke handshake (field incident 2026-08-14): with a
 * brush armed, ONLY a primary-button drag (or double/triple-click
 * select) that began inside the editor may paint. Before the guard,
 * any mouseup over any live selection painted it — so an armed brush
 * plus select-all plus right-click (a context-menu attempt, which
 * preserves the selection) highlighted a shared document wall-to-wall
 * in a single event.
 *
 * Pinned here, per accident path:
 *  - right-click release over a live selection never paints
 *  - a mouseup with no preceding in-editor mousedown never paints
 *    (stale/keyboard-made selections are unreachable)
 *  - shift-click extends never paint (that's select-to-copy)
 *  - a stationary single click never paints
 *  - a gesture begun on the ribbon or in another pane never paints
 * and, so the guard can't eat the feature:
 *  - genuine drags still paint
 *  - double-click word selects still paint
 */

import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { EditorState, TextSelection } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import type { Node as PMNode } from 'prosemirror-model';
import { schema, newHeadingId } from '../../src/schema/index.js';
import { wireColorPanel, type ColorPanelHandle } from '../../src/editor/color-panel.js';
import { settings } from '../../src/editor/settings.js';

function buildRibbonStubs(): void {
  const ids = [
    'highlight-btn', 'highlight-picker-btn', 'highlight-bar',
    'shading-btn', 'shading-picker-btn', 'shading-bar',
    'fontcolor-btn', 'fontcolor-picker-btn', 'fontcolor-bar', 'fontcolor-glyph',
  ];
  for (const id of ids) {
    const el = document.createElement(id.endsWith('-btn') ? 'button' : 'div');
    el.id = id;
    document.body.appendChild(el);
  }
}

function cardWith(body: PMNode[]): PMNode {
  return schema.nodes['doc']!.createChecked(null, [
    schema.nodes['card']!.createChecked(null, [
      schema.nodes['tag']!.create({ id: newHeadingId() }, schema.text('Tag')),
      schema.nodes['card_body']!.create(null, body),
    ]),
  ]);
}

let view: EditorView;
let handle: ColorPanelHandle;

function mount(doc: PMNode): void {
  const container = document.createElement('div');
  document.body.appendChild(container);
  view = new EditorView(container, { state: EditorState.create({ doc }) });
  handle = wireColorPanel({
    get view() {
      return view;
    },
  });
}

function selectAll(): void {
  const doc = view.state.doc;
  view.dispatch(
    view.state.tr.setSelection(TextSelection.create(doc, 1, doc.content.size - 1)),
  );
}

function mouse(
  type: 'mousedown' | 'mouseup',
  target: EventTarget,
  init: MouseEventInit,
): void {
  target.dispatchEvent(new MouseEvent(type, { bubbles: true, ...init }));
}

/** Fraction of the doc's text carrying the highlight mark. */
function highlightedShare(): number {
  let marked = 0;
  let total = 0;
  view.state.doc.descendants((node) => {
    if (node.isText) {
      total += node.text?.length ?? 0;
      if (node.marks.some((m) => m.type.name === 'highlight')) {
        marked += node.text?.length ?? 0;
      }
    }
    return true;
  });
  return total === 0 ? 0 : marked / total;
}

beforeEach(() => {
  buildRibbonStubs();
  settings.set('lastHighlightColor', 'yellow');
  // jsdom has no layout: PM's own mousedown handler calls
  // posAtCoords -> document.elementFromPoint, which doesn't exist
  // there. Stub it so dispatching real mousedowns doesn't error out
  // of PM's handler (ours runs at document level either way).
  (document as unknown as { elementFromPoint: (x: number, y: number) => Element | null })
    .elementFromPoint = () => null;
});

afterEach(() => {
  view?.destroy();
  document.body.innerHTML = '';
  settings.set('lastHighlightColor', 'yellow');
});

describe('paintbrush stroke handshake', () => {
  it('the incident shape: armed brush + select-all + right-click paints NOTHING', () => {
    mount(cardWith([schema.text('the entire document body sits here unhighlighted')]));
    handle.togglePaintbrush('highlight');
    selectAll();
    // A context-menu attempt preserves the selection; both halves of
    // the right-click arrive with button 2.
    mouse('mousedown', view.dom, { button: 2, clientX: 40, clientY: 12 });
    mouse('mouseup', view.dom, { button: 2, clientX: 40, clientY: 12 });
    expect(highlightedShare()).toBe(0);
  });

  it('a bare mouseup over a live selection paints nothing (no gesture, no stroke)', () => {
    mount(cardWith([schema.text('keyboard made this selection')]));
    handle.togglePaintbrush('highlight');
    selectAll();
    mouse('mouseup', view.dom, { button: 0, clientX: 40, clientY: 12 });
    expect(highlightedShare()).toBe(0);
  });

  it('shift-click extending a selection paints nothing', () => {
    mount(cardWith([schema.text('click here then shift click there')]));
    handle.togglePaintbrush('highlight');
    selectAll(); // stands in for the browser's shift-extended selection
    mouse('mousedown', view.dom, { button: 0, shiftKey: true, clientX: 80, clientY: 12 });
    mouse('mouseup', view.dom, { button: 0, shiftKey: true, clientX: 80, clientY: 12 });
    expect(highlightedShare()).toBe(0);
  });

  it('a stationary single click inside a selection paints nothing', () => {
    mount(cardWith([schema.text('selected text about to be clicked')]));
    handle.togglePaintbrush('highlight');
    selectAll();
    mouse('mousedown', view.dom, { button: 0, clientX: 40, clientY: 12 });
    mouse('mouseup', view.dom, { button: 0, clientX: 41, clientY: 12, detail: 1 });
    expect(highlightedShare()).toBe(0);
  });

  it('a gesture begun outside the editor (ribbon) paints nothing on release over it', () => {
    mount(cardWith([schema.text('selection lives on through a ribbon click')]));
    handle.togglePaintbrush('highlight');
    selectAll();
    const ribbonBtn = document.getElementById('shading-btn')!;
    mouse('mousedown', ribbonBtn, { button: 0, clientX: 5, clientY: 5 });
    mouse('mouseup', view.dom, { button: 0, clientX: 60, clientY: 12 });
    expect(highlightedShare()).toBe(0);
  });

  it('a gesture begun in another pane paints nothing in this one', () => {
    const mkView = (doc: PMNode): EditorView => {
      const el = document.createElement('div');
      document.body.appendChild(el);
      return new EditorView(el, { state: EditorState.create({ doc }) });
    };
    const a = mkView(cardWith([schema.text('pane a words')]));
    const b = mkView(cardWith([schema.text('pane b words')]));
    const ref = { view: a as EditorView | null };
    const h = wireColorPanel({
      get view() {
        return ref.view;
      },
    });
    h.togglePaintbrush('highlight');
    ref.view = a;
    a.dispatch(a.state.tr.setSelection(TextSelection.create(a.state.doc, 1, 5)));
    // Stroke starts in pane B, but the active view resolves to pane A
    // at release — the element mismatch must block the paint.
    mouse('mousedown', b.dom, { button: 0, clientX: 10, clientY: 10 });
    mouse('mouseup', a.dom, { button: 0, clientX: 60, clientY: 10 });
    const marked = a.state.doc.rangeHasMark(1, 5, schema.marks['highlight']!);
    expect(marked).toBe(false);
    a.destroy();
    b.destroy();
  });

  it('a genuine primary-button drag still paints', () => {
    mount(cardWith([schema.text('drag across these words')]));
    handle.togglePaintbrush('highlight');
    mouse('mousedown', view.dom, { button: 0, clientX: 10, clientY: 10 });
    selectAll(); // the drag's selection
    mouse('mouseup', view.dom, { button: 0, clientX: 90, clientY: 10 });
    expect(highlightedShare()).toBeGreaterThan(0);
  });

  it('a double-click word select still paints (no pointer travel, detail 2)', () => {
    mount(cardWith([schema.text('doubleclicked word')]));
    handle.togglePaintbrush('highlight');
    mouse('mousedown', view.dom, { button: 0, clientX: 30, clientY: 10, detail: 2 });
    selectAll(); // the word selection the double click made
    mouse('mouseup', view.dom, { button: 0, clientX: 30, clientY: 10, detail: 2 });
    expect(highlightedShare()).toBeGreaterThan(0);
  });
});
