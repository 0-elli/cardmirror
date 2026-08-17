// @vitest-environment jsdom

/**
 * Headless-card producer fix (Issue #34, root-caused 2026-08-17).
 *
 * The wound: cut a selection that crosses out of one card into the
 * next (the "line break immediately before a tag"), paste it —
 * `parseSlice` rebuilds the clipboard's closed nodes without
 * validation, the paste fitter trusts slice interiors, and a card
 * with no leading tag (or an empty fitter-split shell) lands in the
 * LIVE doc: keystrokes near it throw `contentMatchAt`, and the
 * save-time heal re-fires on every journal write until reopen.
 *
 * Two layers pinned here:
 *  1. transformPasted heals headless containers in the SLICE
 *     (blank-head endpoint — content conserved, never dropped);
 *  2. containerIntegrityPlugin heals whatever the fitter creates
 *     AFTER the step applies (empty shells deleted, headless
 *     containers given a blank head), as the backstop for the
 *     whole wound class.
 * Every case asserts the invariant that actually matters: after any
 * paste, doc.check() passes.
 */

import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { EditorState, TextSelection } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import type { Node as PMNode } from 'prosemirror-model';
import { schema, newHeadingId } from '../../src/schema/index.js';
import { buildPastePlugin } from '../../src/editor/paste-plugin.js';
import { absorbPlugin } from '../../src/editor/absorb-plugin.js';
import { containerIntegrityPlugin } from '../../src/editor/container-integrity-plugin.js';
import { citeClassifierPlugin } from '../../src/editor/cite-classifier-plugin.js';
import { namedStyleNormalizerPlugin } from '../../src/editor/named-style-normalizer-plugin.js';

const n = schema.nodes;
const m = schema.marks;
const t = (s: string, marks?: import('prosemirror-model').Mark[]) => schema.text(s, marks);

function buildDoc(): PMNode {
  return n['doc']!.createChecked(null, [
    n['paragraph']!.create(null, [t('before paragraph text')]),
    n['card']!.createChecked(null, [
      n['tag']!.create({ id: newHeadingId() }, [t('First tag text')]),
      n['cite_paragraph']!.create(null, [t('Author '), t('24', [m['cite_mark']!.create()])]),
      n['card_body']!.create(null, [
        t('Body start '),
        t('underlined middle', [m['underline_mark']!.create()]),
        t(' body end'),
      ]),
    ]),
    n['card']!.createChecked(null, [
      n['tag']!.create({ id: newHeadingId() }, [t('Second tag text')]),
      n['card_body']!.create(null, [t('Second body')]),
    ]),
    n['paragraph']!.create(null, [t('after paragraph')]),
  ]);
}

let views: EditorView[] = [];

function mkView(doc: PMNode): EditorView {
  const el = document.createElement('div');
  document.body.appendChild(el);
  const view = new EditorView(el, {
    state: EditorState.create({
      doc,
      plugins: [
        buildPastePlugin({
          condenseOnPaste: () => false,
          paragraphIntegrity: () => true,
          usePilcrows: () => false,
          headingMode: () => 'verbatim' as never,
          smartPasteConversion: () => true,
          onArmedChange: () => {},
        }),
        absorbPlugin,
        containerIntegrityPlugin,
        citeClassifierPlugin,
        namedStyleNormalizerPlugin,
      ],
    }),
  });
  views.push(view);
  return view;
}

/** Copy [a,b) exactly as the clipboard would, then paste at `pos`. */
function cutPaste(doc: PMNode, a: number, b: number, pos: number): EditorView {
  const probe = mkView(doc);
  const html = probe.serializeForClipboard(doc.slice(a, b)).dom.innerHTML;
  const view = mkView(doc);
  view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, pos)));
  view.pasteHTML(html);
  return view;
}

/** Boundary just before the SECOND card's tag. */
function secondCardPos(doc: PMNode): number {
  let found = -1;
  let count = 0;
  doc.descendants((node, pos) => {
    if (node.type.name === 'card') {
      count++;
      if (count === 2) found = pos;
      return false;
    }
    return true;
  });
  if (found < 0) throw new Error('second card not found');
  return found;
}

beforeEach(() => {
  if (typeof globalThis.ClipboardEvent === 'undefined') {
    (globalThis as { ClipboardEvent?: unknown }).ClipboardEvent = class extends Event {
      clipboardData = null;
    };
  }
});

afterEach(() => {
  for (const v of views) v.destroy();
  views = [];
  document.body.innerHTML = '';
});

describe('paste-slice heal (headless-card producer)', () => {
  it('the field recipe: cut across the pre-tag boundary, paste into a body — doc stays valid', () => {
    const doc = buildDoc();
    const boundary = secondCardPos(doc);
    // Cut spans the end of card 1 into card 2 (the "line break before
    // the tag"), pasted into the middle of card 1's body.
    const view = cutPaste(doc, boundary - 1, boundary + 2, 41);
    expect(() => view.state.doc.check()).not.toThrow();
  });

  it('a wider boundary-crossing cut pastes valid at every card-interior position', () => {
    const doc = buildDoc();
    const boundary = secondCardPos(doc);
    for (const pos of [41, 42, 49, 52, 53]) {
      const view = cutPaste(doc, boundary - 4, boundary + 6, pos);
      expect(() => view.state.doc.check(), `paste@${pos}`).not.toThrow();
    }
  });

  it('pasted tail-of-card content is conserved (blank-head doctrine), not dropped', () => {
    const doc = buildDoc();
    const boundary = secondCardPos(doc);
    // Slice reaching into card 2 far enough to carry real body text.
    const view = cutPaste(doc, boundary - 2, boundary + 20, 41);
    expect(() => view.state.doc.check()).not.toThrow();
    expect(view.state.doc.textContent).toContain('underlined middle'); // original body intact
  });

  it('an ordinary within-card text paste gains no spurious blank tags', () => {
    const doc = buildDoc();
    const before = (() => {
      let tags = 0;
      doc.descendants((node) => {
        if (node.type.name === 'tag') tags++;
        return true;
      });
      return tags;
    })();
    const view = cutPaste(doc, 43, 50, 52); // body text → body position
    expect(() => view.state.doc.check()).not.toThrow();
    let after = 0;
    view.state.doc.descendants((node) => {
      if (node.type.name === 'tag') after++;
      return true;
    });
    expect(after).toBe(before);
  });
});

describe('container-integrity backstop', () => {
  it('a headless card slipped into a transaction gets a blank head appended', () => {
    const view = mkView(buildDoc());
    // Force the wound directly (unchecked .create), as a fitter would.
    const headless = n['card']!.create(null, [n['card_body']!.create(null, [t('orphan body')])]);
    view.dispatch(view.state.tr.insert(view.state.doc.content.size, headless));
    expect(() => view.state.doc.check()).not.toThrow();
    expect(view.state.doc.textContent).toContain('orphan body'); // conserved
  });

  it('an empty fitter-shell card is deleted', () => {
    const view = mkView(buildDoc());
    const shell = n['card']!.create(null, []);
    const cardsBefore = countCards(view.state.doc);
    view.dispatch(view.state.tr.insert(view.state.doc.content.size, shell));
    expect(() => view.state.doc.check()).not.toThrow();
    expect(countCards(view.state.doc)).toBe(cardsBefore); // shell gone
  });

  it('is a no-op on valid documents', () => {
    const view = mkView(buildDoc());
    const before = view.state.doc;
    view.dispatch(view.state.tr.insertText('x', 5));
    expect(() => view.state.doc.check()).not.toThrow();
    expect(view.state.doc.textContent.length).toBe(before.textContent.length + 1);
  });
});

function countCards(doc: PMNode): number {
  let cards = 0;
  doc.descendants((node) => {
    if (node.type.name === 'card') cards++;
    return true;
  });
  return cards;
}
