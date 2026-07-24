// @vitest-environment jsdom
//
// Drag/drop interacting with a live view's read-only filter (field report
// 2026-07-24, demo aff): two symptoms with one root cause. The filter's
// `editsInsideView` resolved EVERY step of a transaction against the
// pre-transaction doc — but a move transaction's insert step (and an undo's
// re-insert step) are expressed in post-delete coordinates. When the deleted
// content sat ABOVE a live view, the insert position, shifted down and read
// against the wrong doc, landed numerically inside the view's old span — so
// the whole transaction was silently rejected:
//   1. dropping content at a slot just past a live view did nothing, and
//   2. undoing a move OF the live view (by less than its own size) did
//      nothing — permanently, since a filtered undo never pops the history
//      item.
// The filter must check each step against `tr.docs[i]`, the doc that step
// actually applies to.
import { describe, it, expect } from 'vitest';
import { EditorState } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { history, undo } from 'prosemirror-history';
import type { Node as PMNode } from 'prosemirror-model';
import { schema, newHeadingId } from '../../src/schema/index.js';
import { createSelfRefNode, isSelfRef } from '../../src/editor/self-transclusion.js';
import { selfRefNodeViews } from '../../src/editor/self-transclusion-nodeview.js';
import { makeSelfRefPlugin } from '../../src/editor/self-transclusion-plugin.js';
import { buildMoveTransaction } from '../../src/editor/drag-controller.js';

const block = (t: string, id: string): PMNode =>
  schema.nodes['block']!.create({ id }, schema.text(t));
function card(tag: string, body: string): PMNode {
  return schema.nodes['card']!.createChecked(null, [
    schema.nodes['tag']!.create({ id: newHeadingId() }, schema.text(tag)),
    schema.nodes['card_body']!.create(null, schema.text(body)),
  ]);
}
function mount(children: PMNode[]): EditorView {
  const el = document.createElement('div');
  document.body.appendChild(el);
  return new EditorView(el, {
    state: EditorState.create({
      doc: schema.nodes['doc']!.create(null, children),
      plugins: [history(), makeSelfRefPlugin()],
    }),
    nodeViews: selfRefNodeViews,
  });
}
function findNode(view: EditorView, pred: (n: PMNode) => boolean): { node: PMNode; pos: number } {
  let r: { node: PMNode; pos: number } | null = null;
  view.state.doc.descendants((n, pos) => {
    if (!r && pred(n)) r = { node: n, pos };
    return !r;
  });
  return r!;
}
const tagText = (n: PMNode): string => n.firstChild?.textContent ?? '';

/** Doc: Src block + two source cards, a small Mover card, the live view
 *  (mirroring the Src section — bigger than Mover), then a Tail block. */
function build(): EditorView {
  return mount([
    block('Src', 'src'),
    card('One', 'one body text'),
    card('Two', 'two body text'),
    card('Mover', 'm'),
    createSelfRefNode(schema, 'src', '↳ Src'),
    block('Tail', 'tail'),
  ]);
}

describe('drops landing just past a live view', () => {
  it('a card dragged from above the view to the slot right after it actually moves', () => {
    const view = build();
    const mover = findNode(view, (n) => n.type.name === 'card' && tagText(n) === 'Mover');
    const tail = findNode(view, (n) => n.type.name === 'block' && n.attrs['id'] === 'tail');
    // The slot "immediately after the live view" = the Tail block's position.
    const tr = buildMoveTransaction(
      view.state,
      [{ from: mover.pos, to: mover.pos + mover.node.nodeSize, id: null, type: 'card', level: 4, label: 'Mover' }],
      tail.pos,
    );
    expect(tr).not.toBeNull();
    view.dispatch(tr!);
    // The move landed: Mover now sits between the view and Tail.
    const order = view.state.doc.content.content.map((n) =>
      n.type.name === 'card' ? `card:${tagText(n)}` : n.type.name === 'block' ? `block:${n.textContent}` : n.type.name,
    );
    expect(order).toEqual([
      'block:Src',
      'card:One',
      'card:Two',
      'self_ref',
      'card:Mover',
      'block:Tail',
    ]);
    view.destroy();
  });

  it('a card dragged from above the view to the slot right before it actually moves', () => {
    const view = build();
    // Put the mover ABOVE the source cards so the delete shifts the view's span.
    const one = findNode(view, (n) => n.type.name === 'card' && tagText(n) === 'One');
    const ref = findNode(view, isSelfRef);
    const tr = buildMoveTransaction(
      view.state,
      [{ from: one.pos, to: one.pos + one.node.nodeSize, id: null, type: 'card', level: 4, label: 'One' }],
      ref.pos,
    );
    expect(tr).not.toBeNull();
    view.dispatch(tr!);
    const cards = view.state.doc.content.content
      .filter((n) => n.type.name === 'card')
      .map(tagText);
    expect(cards).toEqual(['Two', 'Mover', 'One']);
    view.destroy();
  });
});

describe('undoing a move of the live view itself', () => {
  it('moving the view up by less than its own size stays undoable', () => {
    const view = build();
    const before = view.state.doc;
    const ref = findNode(view, isSelfRef);
    const mover = findNode(view, (n) => n.type.name === 'card' && tagText(n) === 'Mover');
    // Drag the view up over the small Mover card (move distance < the view's
    // own nodeSize — the geometry whose undo used to be silently rejected).
    const tr = buildMoveTransaction(
      view.state,
      [{ from: ref.pos, to: ref.pos + ref.node.nodeSize, id: null, type: 'self_ref', level: 0, label: 'view' }],
      mover.pos,
    );
    expect(tr).not.toBeNull();
    view.dispatch(tr!);
    // The move itself landed (view now above Mover).
    const refAfter = findNode(view, isSelfRef);
    expect(refAfter.pos).toBeLessThan(
      findNode(view, (n) => n.type.name === 'card' && tagText(n) === 'Mover').pos,
    );
    // Undo restores the original document — this used to no-op forever.
    const undone = undo(view.state, view.dispatch.bind(view));
    expect(undone).toBe(true);
    expect(view.state.doc.eq(before)).toBe(true);
    view.destroy();
  });
});
