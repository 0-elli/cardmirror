/**
 * The `pasteCursor` setting: where the cursor lands after a paste that
 * splits a card around pasted structure (a whole card / tag / heading
 * pasted into a card body).
 *
 *  - 'after' (the default): the end of the pasted content — matching
 *    every other paste. When the destination's post-cursor remainder is
 *    absorbed into the last pasted container, "end of pasted" stops at
 *    the boundary BEFORE that remainder (content the user never pasted).
 *  - 'tag': the legacy F7/setHeading convention — the end of the FIRST
 *    pasted head's text, ready to rename it.
 */

import { afterEach, describe, expect, it } from 'vitest';
import { EditorState, TextSelection } from 'prosemirror-state';
import { Fragment, Slice, type Node as PMNode } from 'prosemirror-model';
import { schema, newHeadingId } from '../../src/schema/index.js';
import { absorbPlugin } from '../../src/editor/absorb-plugin.js';
import { tryPasteSplitContainer } from '../../src/editor/paste-plugin.js';
import { settings } from '../../src/editor/settings.js';

const tag = (t: string, id = newHeadingId()) => schema.nodes['tag']!.create({ id }, schema.text(t));
const cardBody = (t: string) => schema.nodes['card_body']!.create(null, t ? schema.text(t) : []);
const card = (...k: PMNode[]) => schema.nodes['card']!.createChecked(null, k);
const makeDoc = (kids: PMNode[]) => schema.nodes['doc']!.createChecked(null, kids);
const closedSlice = (...nodes: PMNode[]) => new Slice(Fragment.fromArray(nodes), 0, 0);

function posInText(doc: PMNode, text: string, offset: number): number {
  let pos = -1;
  doc.descendants((n, p) => {
    if (pos === -1 && n.isText && n.text === text) pos = p + offset;
    return pos === -1;
  });
  if (pos < 0) throw new Error(`text not found: ${text}`);
  return pos;
}

/** The text node the selection head sits in (by its text), plus the
 *  selection's offset within its parent textblock. */
function cursorContext(state: EditorState): { blockText: string; atEnd: boolean } {
  const $head = state.selection.$head;
  return {
    blockText: $head.parent.textContent,
    atEnd: $head.parentOffset === $head.parent.content.size,
  };
}

function paste(doc: PMNode, cursor: number, slice: Slice): EditorState {
  const base = EditorState.create({ doc, plugins: [absorbPlugin] });
  const state = base.apply(base.tr.setSelection(TextSelection.create(base.doc, cursor)));
  const tr = tryPasteSplitContainer(state, slice);
  if (!tr) throw new Error('split path did not fire');
  return state.apply(tr);
}

afterEach(() => settings.set('pasteCursor', 'after'));

describe('pasteCursor setting on container-splitting pastes', () => {
  const destDoc = () => makeDoc([card(tag('DEST', 'd1'), cardBody('HEADTAIL'))]);
  const pastedCard = () => card(tag('PASTEDTAG'), cardBody('PASTEDBODY'));

  it("default 'after': cursor at the end of the pasted content, before the absorbed remainder", () => {
    const after = paste(destDoc(), posInText(destDoc(), 'HEADTAIL', 4), closedSlice(pastedCard()));
    const ctx = cursorContext(after);
    // The last pasted container absorbed the destination's "TAIL"
    // remainder as a following card_body — the cursor stops at the end
    // of the PASTED body, not after the absorbed tail.
    expect(ctx.blockText).toBe('PASTEDBODY');
    expect(ctx.atEnd).toBe(true);
  });

  it("'tag': legacy F7 convention — cursor at the end of the first pasted head", () => {
    settings.set('pasteCursor', 'tag');
    const after = paste(destDoc(), posInText(destDoc(), 'HEADTAIL', 4), closedSlice(pastedCard()));
    const ctx = cursorContext(after);
    expect(ctx.blockText).toBe('PASTEDTAG');
    expect(ctx.atEnd).toBe(true);
  });

  it("default 'after' with two pasted cards: cursor in the LAST pasted card", () => {
    const second = card(tag('SECONDTAG'), cardBody('SECONDBODY'));
    const after = paste(
      destDoc(),
      posInText(destDoc(), 'HEADTAIL', 4),
      closedSlice(pastedCard(), second),
    );
    const ctx = cursorContext(after);
    expect(ctx.blockText).toBe('SECONDBODY');
    expect(ctx.atEnd).toBe(true);
  });
});
