// @vitest-environment jsdom

/**
 * Trim panel header layout.
 *
 * The card identity row is a block-level component: everywhere else it
 * is appended straight to a dialog and owns its full width. This header
 * once appended it as a flex SIBLING of the title, which put three
 * items in one row inside a 24rem panel. The identity label and the
 * read-time both set `white-space: nowrap`, so neither could shrink,
 * the title collapsed into a narrow multi-line column, and the rest of
 * the header overflowed past the panel's right edge.
 *
 * Layout itself isn't observable in jsdom, so what's pinned here is the
 * structure that layout depends on: identity on its own line, title and
 * total sharing the row above it.
 */

import { describe, expect, it } from 'vitest';
import { buildTrimHead } from '../../src/editor/card-cutter-ui.js';

function identityStub(): HTMLElement {
  const row = document.createElement('div');
  row.className = 'pmd-cardcutter-card-id';
  const text = document.createElement('span');
  text.className = 'pmd-cardcutter-card-id-text';
  text.textContent = 'Empirics prove---federal expansion is correlated to public health outcomes';
  row.appendChild(text);
  return row;
}

describe('trim panel header', () => {
  it('puts the card identity on its own line, not beside the title', () => {
    const { head } = buildTrimHead('Trim the read (optional)', identityStub());
    const children = Array.from(head.children);
    expect(children).toHaveLength(2);
    expect(children[0]!.className).toBe('pmd-cardcutter-trim-head-top');
    expect(children[1]!.className).toBe('pmd-cardcutter-card-id');
  });

  it('keeps the title and the read-time together in the top row', () => {
    const { head, total } = buildTrimHead("Couldn't hit ≤20s — trim more?", identityStub());
    const top = head.querySelector('.pmd-cardcutter-trim-head-top')!;
    const kids = Array.from(top.children).map((el) => el.className);
    expect(kids).toEqual(['pmd-cardcutter-trim-title', 'pmd-cardcutter-trim-total']);
    expect(top.querySelector('.pmd-cardcutter-trim-title')!.textContent).toBe(
      "Couldn't hit ≤20s — trim more?",
    );
    // The caller writes the running total into this node afterwards.
    expect(total.parentElement).toBe(top);
  });

  it('never nests the identity row inside the title row', () => {
    const { head } = buildTrimHead('Trim the read (optional)', identityStub());
    const top = head.querySelector('.pmd-cardcutter-trim-head-top')!;
    expect(top.querySelector('.pmd-cardcutter-card-id')).toBeNull();
  });
});
