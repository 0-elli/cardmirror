// @vitest-environment jsdom

/**
 * `navKeepPlaceOnLevelChange` — the nav pane keeps the cursor's section at
 * the top of the outline across a level change instead of snapping back to
 * the top of the document.
 *
 * jsdom has no layout: `offsetTop` / `clientHeight` / `scrollHeight` are all
 * 0, so the anchoring math would be indistinguishable from the fallback. The
 * geometry is stubbed instead — every row is `ROW_H` tall in DOM order, the
 * list viewport is `VIEWPORT_H` — which is exactly the shape a real browser
 * reports and lets the tests assert the offset the panel actually computes.
 *
 * The scroll RESET on the flag-off path can't be observed the same way:
 * jsdom stores `scrollTop` as a plain number and never re-clamps it when the
 * list is emptied, so the browser's "wipe the list, lose the offset" is
 * simply absent here. The honest assertion is that the panel writes
 * `scrollTop` only when the feature is on — with the flag off it doesn't
 * touch the offset at all, which in a real browser is precisely today's
 * snap-to-top.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { EditorState, TextSelection } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import type { Node as PMNode } from 'prosemirror-model';
import { schema, newHeadingId } from '../../src/schema/index.js';
import { NavigationPanel } from '../../src/editor/nav-panel.js';
import { settings } from '../../src/editor/settings.js';

const ROW_H = 20;
const VIEWPORT_H = 40;

const node = (name: string, attrs: Record<string, unknown> | null, content?: PMNode | PMNode[]): PMNode =>
  schema.nodes[name]!.create(attrs, content);

const heading = (name: string, text: string): PMNode =>
  node(name, { id: newHeadingId() }, schema.text(text));

const card = (tagText: string, bodyText: string): PMNode =>
  node('card', null, [
    heading('tag', tagText),
    node('card_body', null, schema.text(bodyText)),
  ]);

/**
 * Four rows at level 3 (pocket + three blocks), eight at level 4 (each
 * block's card joins them) — enough that a mid-document anchor lands at a
 * distinct, unclamped offset at both depths, and the last one clamps.
 */
function makeDoc(): PMNode {
  return node('doc', null, [
    heading('pocket', 'Pocket'),
    heading('block', 'Block one'),
    card('Tag one', 'body one'),
    card('Tag two', 'body two'),
    heading('block', 'Block two'),
    card('Tag three', 'body three'),
    heading('block', 'Block three'),
    card('Tag four', 'body four'),
  ]);
}

/** Position inside the Nth (1-based) card body — a plain cursor parked in
 *  card text, which is where a reader's cursor actually sits. */
function inCardBody(doc: PMNode, n: number): number {
  let seen = 0;
  let found = -1;
  doc.descendants((child, pos) => {
    if (child.type.name !== 'card_body') return true;
    seen++;
    if (seen === n && found < 0) found = pos + 1;
    return false;
  });
  return found;
}

function mountView(doc: PMNode): EditorView {
  const host = document.createElement('div');
  document.body.appendChild(host);
  return new EditorView(host, { state: EditorState.create({ doc }) });
}

function listOf(panel: NavigationPanel): HTMLElement {
  return (panel as unknown as { listEl: HTMLElement }).listEl;
}

function rootOf(panel: NavigationPanel): HTMLElement {
  return (panel as unknown as { root: HTMLElement }).root;
}

/** Click the header's `1 2 3 4` button — the real entry point, same one the
 *  context menu's "Show heading level N" routes through. */
function clickLevel(panel: NavigationPanel, level: number): void {
  const btn = rootOf(panel).querySelector<HTMLButtonElement>(
    `.pmd-nav-level-btn[data-level="${level}"]`,
  );
  if (!btn) throw new Error(`no level button ${level}`);
  btn.click();
}

/** Record every `scrollTop` write the panel makes to the outline list. */
function recordScroll(listEl: HTMLElement): number[] {
  const writes: number[] = [];
  let value = 0;
  Object.defineProperty(listEl, 'scrollTop', {
    configurable: true,
    get: () => value,
    set: (v: number) => {
      writes.push(v);
      value = v;
    },
  });
  return writes;
}

/** Stub the layout a browser would report: rows stacked `ROW_H` apart in DOM
 *  order inside a `VIEWPORT_H`-tall scroller. */
function stubGeometry(listEl: HTMLElement): void {
  Object.defineProperty(HTMLLIElement.prototype, 'offsetTop', {
    configurable: true,
    get(this: HTMLLIElement) {
      const parent = this.parentElement;
      if (!parent) return 0;
      return Array.prototype.indexOf.call(parent.children, this) * ROW_H;
    },
  });
  Object.defineProperty(listEl, 'clientHeight', {
    configurable: true,
    get: () => VIEWPORT_H,
  });
  Object.defineProperty(listEl, 'scrollHeight', {
    configurable: true,
    get: () => listEl.children.length * ROW_H,
  });
}

interface Harness {
  panel: NavigationPanel;
  view: EditorView;
  writes: number[];
  rowLabels(): string[];
}

const open: Harness[] = [];

function setup(doc: PMNode = makeDoc()): Harness {
  const view = mountView(doc);
  const panel = new NavigationPanel(document.createElement('div'));
  panel.attach(view);
  const listEl = listOf(panel);
  stubGeometry(listEl);
  const writes = recordScroll(listEl);
  const h: Harness = {
    panel,
    view,
    writes,
    rowLabels: () => [...listEl.children].map((li) => li.textContent ?? ''),
  };
  open.push(h);
  return h;
}

function putCursor(view: EditorView, pos: number): void {
  view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, pos)));
}

beforeEach(() => {
  settings.set('navKeepPlaceOnLevelChange', false);
  settings.set('navMaxLevel', 3);
});

afterEach(() => {
  for (const h of open.splice(0)) {
    h.panel.destroy();
    h.view.destroy();
  }
  delete (HTMLLIElement.prototype as unknown as Record<string, unknown>)['offsetTop'];
  settings.set('navKeepPlaceOnLevelChange', false);
});

describe('nav level change with navKeepPlaceOnLevelChange OFF', () => {
  it('leaves the scroll offset alone — the rebuild lands at the top, as before', () => {
    const h = setup();
    putCursor(h.view, inCardBody(h.view.state.doc, 3));
    clickLevel(h.panel, 4);
    expect(h.writes).toEqual([]);
  });
});

describe('nav level change with navKeepPlaceOnLevelChange ON', () => {
  beforeEach(() => settings.set('navKeepPlaceOnLevelChange', true));

  it("pins the cursor's own row to the top when the new level renders it", () => {
    const h = setup();
    putCursor(h.view, inCardBody(h.view.state.doc, 3));
    clickLevel(h.panel, 4);
    // Pocket, Block one, Tag one, Tag two, Block two, [Tag three], …
    expect(h.rowLabels()[5]).toContain('Tag three');
    expect(h.writes).toEqual([5 * ROW_H]);
  });

  it('clamps at the bottom of the list rather than scrolling past it', () => {
    const h = setup();
    putCursor(h.view, inCardBody(h.view.state.doc, 4));
    clickLevel(h.panel, 4);
    // Row 7 wants 140; eight rows in a 40-tall viewport cap at 120.
    expect(h.rowLabels()[7]).toContain('Tag four');
    expect(h.writes).toEqual([8 * ROW_H - VIEWPORT_H]);
  });

  it('falls back to the nearest rendered ancestor when the row collapses away', () => {
    const h = setup();
    putCursor(h.view, inCardBody(h.view.state.doc, 2));
    clickLevel(h.panel, 4);
    expect(h.writes).toEqual([3 * ROW_H]); // its own row, at level 4

    clickLevel(h.panel, 3); // tags collapse under their blocks
    expect(h.rowLabels()).toHaveLength(4);
    expect(h.rowLabels()[1]).toContain('Block one');
    expect(h.writes[1]).toBe(1 * ROW_H); // the block that owns the card
  });

  it('does nothing when the cursor sits ahead of the first heading', () => {
    const doc = node('doc', null, [
      node('paragraph', null, schema.text('loose intro')),
      heading('pocket', 'Pocket'),
      heading('block', 'Block one'),
      card('Tag one', 'body one'),
    ]);
    const h = setup(doc);
    putCursor(h.view, 1); // inside the leading paragraph
    clickLevel(h.panel, 4);
    expect(h.writes).toEqual([]);
  });

  it('does nothing on a document with no headings at all', () => {
    const doc = node('doc', null, [node('paragraph', null, schema.text('just prose'))]);
    const h = setup(doc);
    putCursor(h.view, 1);
    clickLevel(h.panel, 4);
    expect(h.rowLabels()).toHaveLength(0);
    expect(h.writes).toEqual([]);
  });

  it('does nothing on a panel with no view attached (mobile shell boot)', () => {
    const panel = new NavigationPanel(document.createElement('div'));
    const writes = recordScroll(listOf(panel));
    expect(() => clickLevel(panel, 4)).not.toThrow();
    expect(writes).toEqual([]);
    panel.destroy();
  });
});
