// @vitest-environment jsdom
//
// Enter at the BOTTOM of a live view (`self_ref`). The mirror is read-only —
// the split Enter would normally produce is rejected by the content plugin's
// filter, and every later handler in the Enter chain that claims the key dies
// the same way, so the key read as dead (field report 2026-07-24, demo aff).
// `enterBelowSelfRef` gives the bottom edge its one legal meaning: a fresh
// paragraph BELOW the window, caret inside it. Everywhere else in the mirror
// the key must stay unhandled (any split would edit the projection).
import { describe, it, expect } from 'vitest';
import { EditorState, Selection, TextSelection } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import type { Node as PMNode } from 'prosemirror-model';
import { schema, newHeadingId } from '../../src/schema/index.js';
import { createSelfRefNode, isSelfRef } from '../../src/editor/self-transclusion.js';
import { selfRefNodeViews } from '../../src/editor/self-transclusion-nodeview.js';
import { makeSelfRefPlugin } from '../../src/editor/self-transclusion-plugin.js';
import { enterBelowSelfRef } from '../../src/editor/self-transclusion-commands.js';

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
      plugins: [makeSelfRefPlugin()],
    }),
    nodeViews: selfRefNodeViews,
  });
}
function selfRefAt(view: EditorView): { node: PMNode; pos: number } {
  let r: { node: PMNode; pos: number } | null = null;
  view.state.doc.descendants((n, pos) => {
    if (!r && isSelfRef(n)) r = { node: n, pos };
    return !r;
  });
  return r!;
}
/** Caret at the last legal cursor position inside the window. */
function caretAtWindowBottom(view: EditorView): void {
  const { node, pos } = selfRefAt(view);
  const sel = Selection.near(view.state.doc.resolve(pos + node.nodeSize - 1), -1);
  view.dispatch(view.state.tr.setSelection(sel));
}
const run = (view: EditorView): boolean =>
  enterBelowSelfRef(view.state, view.dispatch.bind(view));

const BASE = () => [
  block('Src', 'src'),
  card('Alpha', 'alpha'),
  block('Home', 'home'),
  createSelfRefNode(schema, 'src', '↳ Src'),
];

describe('enterBelowSelfRef', () => {
  it('at the window bottom: inserts a paragraph below the window, caret inside it', () => {
    const view = mount(BASE());
    caretAtWindowBottom(view);
    const { node, pos } = selfRefAt(view);
    const after = pos + node.nodeSize;
    expect(run(view)).toBe(true); // dispatched through the read-only filter
    const sib = view.state.doc.nodeAt(after);
    expect(sib?.type.name).toBe('paragraph');
    expect(sib?.content.size).toBe(0);
    expect(view.state.selection.empty).toBe(true);
    expect(view.state.selection.$head.pos).toBe(after + 1); // caret in the new line
    // The window itself is untouched.
    const again = view.state.doc.nodeAt(pos)!;
    expect(isSelfRef(again)).toBe(true);
    expect(again.content.eq(node.content)).toBe(true);
    view.destroy();
  });

  it('mid-window (end of the mirrored tag, body still below): unhandled, doc unchanged', () => {
    const view = mount(BASE());
    const { node, pos } = selfRefAt(view);
    let tagEnd = -1;
    view.state.doc.nodesBetween(pos + 1, pos + node.nodeSize - 1, (n, p) => {
      if (tagEnd < 0 && n.type.name === 'tag') tagEnd = p + 1 + n.content.size;
      return tagEnd < 0;
    });
    expect(tagEnd).toBeGreaterThan(0);
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, tagEnd)));
    const before = view.state.doc.toString();
    expect(run(view)).toBe(false);
    expect(view.state.doc.toString()).toBe(before);
    view.destroy();
  });

  it('end of a textblock OUTSIDE any window: unhandled (normal Enter pipeline)', () => {
    const view = mount(BASE());
    let homeEnd = -1;
    view.state.doc.descendants((n, p) => {
      if (homeEnd < 0 && n.type.name === 'block' && n.attrs['id'] === 'home') {
        homeEnd = p + 1 + n.content.size;
      }
      return homeEnd < 0;
    });
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, homeEnd)));
    expect(run(view)).toBe(false);
    view.destroy();
  });
});
