// @vitest-environment jsdom
// Backspace/Delete with the caret at a GAP between blocks (field
// report, beta.22): a click in the blank spacing between paragraphs
// parks the caret at a non-textblock position that LOOKS like the
// start of the next line. The old gap handler deleted the previous
// block's last character ("it deletes the period after westlaw") or,
// when the adjacent block was empty, only moved the caret ("didnt get
// rid of the return and just moved up" — with the second press
// working). A gap between two blocks now JOINS them when the schema
// allows (the user's evident intent: remove the return), normalizes
// the caret otherwise, and keeps the original edge-of-doc behavior.
import { describe, expect, it } from 'vitest';
import { EditorState, TextSelection } from 'prosemirror-state';
import { schema, newHeadingId } from '../../src/schema/index.js';
import {
  blockBackspaceNodeSelect,
  blockDeleteNodeSelect,
} from '../../src/editor/boundary-cursor-keymap.js';

const para = (t: string) =>
  schema.nodes['paragraph']!.create(null, t ? schema.text(t) : null);
const tag = (t: string) => schema.nodes['tag']!.create({ id: newHeadingId() }, schema.text(t));
const body = (t: string) => schema.nodes['card_body']!.create(null, schema.text(t));
const card = (...kids: unknown[]) => schema.nodes['card']!.create(null, kids as never);
const doc = (...kids: unknown[]) => schema.nodes['doc']!.create(null, kids as never);

/** State with an empty selection parked at the given (gap) position —
 *  the shape a blank-spacing click produces. */
function stateAtGap(d: ReturnType<typeof doc>, pos: number): EditorState {
  const s = EditorState.create({ doc: d });
  const sel = new (TextSelection as unknown as {
    new ($p: unknown): TextSelection;
  })(d.resolve(pos));
  return s.apply(s.tr.setSelection(sel));
}

function run(cmd: typeof blockBackspaceNodeSelect, s: EditorState): EditorState | null {
  let out: EditorState | null = null;
  const handled = cmd(s, (tr) => { out = s.apply(tr); }, undefined);
  return handled ? (out ?? s) : null;
}

describe('backspace at a between-blocks gap', () => {
  it('joins two paragraphs — the period survives, the return goes', () => {
    const d = doc(para('Circuit, No. 01-1296, Westlaw.'), para('The district court granted.'));
    const s = stateAtGap(d, d.firstChild!.nodeSize);
    const after = run(blockBackspaceNodeSelect, s)!;
    expect(after).not.toBeNull();
    expect(after.doc.childCount).toBe(1);
    expect(after.doc.firstChild!.textContent).toBe(
      'Circuit, No. 01-1296, Westlaw.The district court granted.',
    );
  });

  it('removes a blank line on the FIRST press (no dead move-only press)', () => {
    const d = doc(para('the only thing you should be doing'), para(''), para('fixing'));
    // Gap between the blank line and 'fixing'.
    const s = stateAtGap(d, d.child(0).nodeSize + d.child(1).nodeSize);
    const after = run(blockBackspaceNodeSelect, s)!;
    expect(after.doc.childCount).toBe(2);
    expect(after.doc.child(1).textContent).toBe('fixing');
  });

  it('never merges card into card — caret normalizes, doc untouched', () => {
    const d = doc(card(tag('A'), body('one')), card(tag('B'), body('two')));
    const s = stateAtGap(d, d.firstChild!.nodeSize);
    const after = run(blockBackspaceNodeSelect, s)!;
    expect(after.doc.eq(d)).toBe(true);
    // Caret moved into the following card's tag start.
    expect(after.selection.$head.parent.type.name).toBe('tag');
    expect(after.selection.$head.parentOffset).toBe(0);
  });

  it('edge gap past the last block keeps the original edit-in-body behavior', () => {
    const d = doc(para('last line.'));
    const s = stateAtGap(d, d.content.size);
    const after = run(blockBackspaceNodeSelect, s)!;
    expect(after.doc.firstChild!.textContent).toBe('last line');
  });
});

describe('forward delete at a between-blocks gap', () => {
  it('joins the two blocks', () => {
    const d = doc(para('alpha'), para('beta'));
    const s = stateAtGap(d, d.firstChild!.nodeSize);
    const after = run(blockDeleteNodeSelect, s)!;
    expect(after.doc.childCount).toBe(1);
    expect(after.doc.firstChild!.textContent).toBe('alphabeta');
  });
});
