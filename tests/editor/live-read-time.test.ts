// @vitest-environment jsdom

/**
 * Live enclosing-container read time (`liveContainerReadTime`, default
 * on): the word-count readout's second segment shows the smallest
 * container enclosing the cursor — card, analytic unit, or block
 * section — or the selection's time when one exists. Pocket/hat
 * headings and loose doc-level content show nothing (design call,
 * 2026-07-26). With `liveSelectionWordCount` on, a selection is
 * already the primary readout, so the segment is dropped.
 */

import { describe, expect, it, afterEach } from 'vitest';
import { EditorState, TextSelection } from 'prosemirror-state';
import type { Node as PMNode } from 'prosemirror-model';
import { schema, newHeadingId } from '../../src/schema/index.js';
import {
  findEnclosingContainer,
  liveContainerSegment,
} from '../../src/editor/live-read-time.js';
import { settings } from '../../src/editor/settings.js';

function tag(text: string): PMNode {
  return schema.nodes['tag']!.create({ id: newHeadingId() }, schema.text(text));
}
function card(tagText: string, bodyText: string): PMNode {
  return schema.nodes['card']!.createChecked(null, [
    tag(tagText),
    schema.nodes['card_body']!.create(null, schema.text(bodyText)),
  ]);
}
function analytic(tagText: string, bodyText: string): PMNode {
  return schema.nodes['analytic_unit']!.createChecked(null, [
    schema.nodes['analytic']!.create({ id: newHeadingId() }, schema.text(tagText)),
    schema.nodes['card_body']!.create(null, schema.text(bodyText)),
  ]);
}
function heading(type: 'pocket' | 'hat' | 'block', text: string): PMNode {
  return schema.nodes[type]!.create({ id: newHeadingId() }, schema.text(text));
}
function para(text: string): PMNode {
  return schema.nodes['paragraph']!.create(null, schema.text(text));
}

/** State with the cursor inside the text node containing `needle`. */
function stateAt(children: PMNode[], needle: string): EditorState {
  const doc = schema.nodes['doc']!.createChecked(null, children);
  let at = -1;
  doc.descendants((node, pos) => {
    if (at >= 0) return false;
    if (node.isText && (node.text ?? '').includes(needle)) {
      at = pos + 1;
      return false;
    }
    return true;
  });
  if (at < 0) throw new Error(`text "${needle}" not found`);
  return EditorState.create({ doc, selection: TextSelection.create(doc, at) });
}

function textOfRange(state: EditorState, c: { from: number; to: number }): string {
  return state.doc.textBetween(c.from, c.to, ' ', ' ');
}

afterEach(() => {
  settings.set('liveContainerReadTime', true);
  settings.set('liveSelectionWordCount', false);
  settings.set('readers', [
    { name: 'Reader 1', wpm: 200 },
    { name: 'Reader 2', wpm: 250 },
  ]);
});

describe('findEnclosingContainer', () => {
  const children = [
    heading('pocket', 'Pocket A'),
    heading('hat', 'Hat A'),
    heading('block', 'Block One'),
    card('Alpha tag', 'alpha body'),
    para('loose analysis under block one'),
    heading('block', 'Block Two'),
    card('Beta tag', 'beta body'),
    analytic('Gamma analytic', 'gamma body'),
  ];

  it('cursor in a card body → the card', () => {
    const state = stateAt(children, 'alpha body');
    const c = findEnclosingContainer(state)!;
    expect(c.label).toBe('Card');
    expect(textOfRange(state, c)).toContain('Alpha tag');
    expect(textOfRange(state, c)).not.toContain('Block One');
  });

  it('cursor in an analytic unit → the unit, not the block', () => {
    const state = stateAt(children, 'gamma body');
    const c = findEnclosingContainer(state)!;
    expect(c.label).toBe('Analytic');
    expect(textOfRange(state, c)).toContain('Gamma analytic');
    expect(textOfRange(state, c)).not.toContain('Beta tag');
  });

  it('cursor in a loose paragraph under a block → the block section', () => {
    const state = stateAt(children, 'loose analysis');
    const c = findEnclosingContainer(state)!;
    expect(c.label).toBe('Block');
    const text = textOfRange(state, c);
    expect(text).toContain('Block One');
    expect(text).toContain('alpha body'); // section spans its cards
    expect(text).not.toContain('Block Two'); // ends at equal-level heading
  });

  it('cursor ON a block heading → its own section', () => {
    const state = stateAt(children, 'Block Two');
    const c = findEnclosingContainer(state)!;
    expect(c.label).toBe('Block');
    const text = textOfRange(state, c);
    expect(text).toContain('beta body');
    expect(text).toContain('gamma body'); // runs to end of doc
  });

  it('pocket / hat headings stay silent', () => {
    expect(findEnclosingContainer(stateAt(children, 'Pocket A'))).toBeNull();
    expect(findEnclosingContainer(stateAt(children, 'Hat A'))).toBeNull();
  });

  it('loose paragraph with no preceding block stays silent', () => {
    const state = stateAt(
      [heading('hat', 'Hat Solo'), para('orphan paragraph'), heading('block', 'Later Block')],
      'orphan paragraph',
    );
    expect(findEnclosingContainer(state)).toBeNull();
  });
});

describe('liveContainerSegment', () => {
  const children = [heading('block', 'Block One'), card('Alpha tag', 'alpha body two three')];

  it('renders label, count, and the first two readers', () => {
    settings.set('readers', [
      { name: 'Amy', wpm: 200 },
      { name: 'Ben', wpm: 100 },
      { name: 'Cal', wpm: 300 },
    ]);
    const seg = liveContainerSegment(stateAt(children, 'alpha body'))!;
    expect(seg).toMatch(/^Card \d/);
    expect(seg).toContain('Amy: ');
    expect(seg).toContain('Ben: ');
    expect(seg).not.toContain('Cal'); // first two readers only
  });

  it('gates on the setting', () => {
    settings.set('liveContainerReadTime', false);
    expect(liveContainerSegment(stateAt(children, 'alpha body'))).toBeNull();
  });

  it('a selection shows Sel — unless liveSelectionWordCount already does', () => {
    const base = stateAt(children, 'alpha body');
    const sel = base.apply(
      base.tr.setSelection(
        TextSelection.create(base.doc, base.selection.from, base.selection.from + 5),
      ),
    );
    expect(liveContainerSegment(sel)).toMatch(/^Sel \d/);
    settings.set('liveSelectionWordCount', true);
    expect(liveContainerSegment(sel)).toBeNull();
  });
});
