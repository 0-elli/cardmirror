import { describe, it, expect } from 'vitest';
import { schema, newHeadingId } from '../../src/schema/index.js';
import { salvageDoc } from '../../src/schema/salvage.js';

/**
 * Last-resort salvage (audit follow-on): drop the MINIMAL invalid
 * subtrees from a doc that fails check() even after the heals, fill
 * generatable required content instead of discarding containers, and
 * report every loss with a type + text preview.
 */

const tag = (t: string) =>
  schema.nodes['tag']!.create({ id: newHeadingId() }, schema.text(t));
const body = (t: string) => schema.nodes['card_body']!.create(null, schema.text(t));
const para = (t: string) => schema.nodes['paragraph']!.create(null, t ? schema.text(t) : undefined);
/** UNCHECKED constructors — building the invalid shapes under test. */
const card = (...children: import('prosemirror-model').Node[]) =>
  schema.nodes['card']!.create(null, children);
const doc = (...children: import('prosemirror-model').Node[]) =>
  schema.nodes['doc']!.create(null, children);

describe('salvageDoc', () => {
  it('valid doc: untouched, nothing dropped', () => {
    const d = doc(para('intro'), card(tag('t'), body('b')));
    const s = salvageDoc(d)!;
    expect(s.dropped).toEqual([]);
    expect(s.doc.eq(d)).toBe(true);
  });

  it('isolates the DEEPEST invalid node: illegal child dropped, card kept', () => {
    const d = doc(
      para('before'),
      card(tag('keep tag'), para('poisoned paragraph'), body('keep body')),
      para('after'),
    );
    const s = salvageDoc(d)!;
    expect(() => s.doc.check()).not.toThrow();
    expect(s.dropped).toEqual([
      { type: 'paragraph', textPreview: 'poisoned paragraph' },
    ]);
    expect(s.doc.textContent).toContain('keep tag');
    expect(s.doc.textContent).toContain('keep body');
    expect(s.doc.textContent).toContain('before');
    expect(s.doc.textContent).toContain('after');
    expect(s.doc.textContent).not.toContain('poisoned');
  });

  it('fills missing REQUIRED content instead of discarding what follows', () => {
    // A headless card reaching salvage directly (the load pipeline's
    // heals would normally re-shape this first): the body survives
    // behind a generated empty head, not dropped.
    const d = doc(card(body('stranded body')));
    const s = salvageDoc(d)!;
    expect(() => s.doc.check()).not.toThrow();
    expect(s.dropped).toEqual([]);
    expect(s.doc.textContent).toContain('stranded body');
    const c = s.doc.firstChild!;
    expect(c.type.name).toBe('card');
    expect(c.firstChild!.type.name).toBe('tag');
  });

  it('reports a no-text drop with an empty preview', () => {
    // An empty table_row is legal, but a row containing an illegal
    // child keeps the row and drops the child; a hollow illegal node
    // with no text reports textPreview ''.
    const hollowCell = schema.nodes['table_cell']!.create(); // paragraph+ violated
    const row = schema.nodes['table_row']!.create(null, [
      hollowCell,
      schema.nodes['table_cell']!.create(null, [para('kept cell')]),
    ]);
    const d = doc(schema.nodes['table']!.create(null, [row]));
    const s = salvageDoc(d)!;
    expect(() => s.doc.check()).not.toThrow();
    // The hollow cell is FILLED (paragraph generated), not dropped —
    // fill-completion beats dropping.
    expect(s.dropped).toEqual([]);
    expect(s.doc.textContent).toContain('kept cell');
  });

  it('handles damage nested inside a live zone', () => {
    const zone = schema.nodes['transclusion_ref']!.create(
      { src: 'x.cmir', base: 'doc' },
      [card(tag('zone tag'), para('zone poison'), body('zone body'))],
    );
    const s = salvageDoc(doc(para('top'), zone))!;
    expect(() => s.doc.check()).not.toThrow();
    expect(s.dropped).toEqual([{ type: 'paragraph', textPreview: 'zone poison' }]);
    expect(s.doc.textContent).toContain('zone tag');
    expect(s.doc.textContent).toContain('zone body');
  });

  it('multiple damaged spots all resolve in one pass', () => {
    const d = doc(
      card(tag('c1'), para('bad1'), body('good1')),
      card(tag('c2'), body('good2'), para('bad2')),
    );
    const s = salvageDoc(d)!;
    expect(() => s.doc.check()).not.toThrow();
    expect(s.dropped.map((x) => x.textPreview).sort()).toEqual(['bad1', 'bad2']);
    expect(s.doc.textContent).toContain('good1');
    expect(s.doc.textContent).toContain('good2');
  });
});
