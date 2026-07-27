import { describe, it, expect } from 'vitest';
import { Slice } from 'prosemirror-model';
import { schema, newHeadingId } from '../../src/schema/index.js';
import { checkedSliceFromJSON, sliceJsonIsValid } from '../../src/schema/slice-check.js';

/**
 * Validated slice reconstruction (audit tier 2): closed nodes inside a
 * stored slice get a full recursive check — they're the ones the step
 * machinery splices in verbatim — while legitimately-open edge nodes
 * (mid-card copies) still pass, since the Fitter closes those on
 * insertion.
 */

const card = (tagText: string, bodyText: string) =>
  schema.nodes['card']!.createChecked(null, [
    schema.nodes['tag']!.create({ id: newHeadingId() }, schema.text(tagText)),
    schema.nodes['card_body']!.create(null, schema.text(bodyText)),
  ]);

const doc = () =>
  schema.nodes['doc']!.createChecked(null, [
    schema.nodes['paragraph']!.create(null, schema.text('intro words')),
    card('Tag here', 'body evidence here'),
    schema.nodes['paragraph']!.create(null, schema.text('outro words')),
  ]);

describe('checkedSliceFromJSON', () => {
  it('round-trips a closed whole-card slice', () => {
    const d = doc();
    const from = d.child(0).nodeSize;
    const slice = d.slice(from, from + d.child(1).nodeSize);
    const back = checkedSliceFromJSON(slice.toJSON());
    expect(back.content.firstChild!.type.name).toBe('card');
  });

  it('accepts a legitimately OPEN slice with a headless card on the left spine', () => {
    const d = doc();
    // From mid-body OUT of the card into the trailing paragraph: the
    // slice's left spine is card→card_body cut open, so its card
    // arrives with NO tag — exactly what a real cross-boundary copy
    // produces and what the Fitter closes on insertion. (A slice fully
    // inside one textblock sheds its shared ancestors and is closed.)
    let at = -1;
    d.descendants((n, pos) => {
      if (at >= 0) return false;
      if (n.isText && (n.text ?? '').includes('body evidence')) {
        at = pos + (n.text ?? '').indexOf('body evidence');
        return false;
      }
      return true;
    });
    const outro = d.content.size - 4; // inside the trailing paragraph
    const slice = d.slice(at + 2, outro);
    expect(slice.openStart).toBeGreaterThanOrEqual(2);
    expect(slice.content.firstChild!.type.name).toBe('card');
    expect(slice.content.firstChild!.firstChild!.type.name).not.toBe('tag'); // headless-open
    expect(() => checkedSliceFromJSON(slice.toJSON())).not.toThrow();
  });

  it('rejects a CLOSED hollow card hidden in the slice', () => {
    const hollow = schema.nodes['card']!.create(); // unchecked, empty
    const slice = new Slice(
      schema.nodes['doc']!.create(null, [card('ok', 'fine'), hollow]).content,
      0,
      0,
    );
    const json = slice.toJSON();
    expect(() => checkedSliceFromJSON(json)).toThrow(/Invalid content/);
    expect(sliceJsonIsValid(json)).toBe(false);
  });

  it('rejects a closed headless card carrying content', () => {
    const headless = schema.nodes['card']!.create(null, [
      schema.nodes['card_body']!.create(null, schema.text('stranded')),
    ]);
    const slice = new Slice(
      schema.nodes['doc']!.create(null, [headless]).content,
      0,
      0,
    );
    expect(sliceJsonIsValid(slice.toJSON())).toBe(false);
  });

  it('rejects unknown node types; non-object garbage degrades to a harmless empty slice', () => {
    expect(sliceJsonIsValid({ content: [{ type: 'no-such-node' }] })).toBe(false);
    // Slice.fromJSON turns non-object input into Slice.empty, which
    // inserts nothing — structurally harmless, so the guard passes it.
    expect(sliceJsonIsValid('nonsense')).toBe(true);
  });

  it('accepts a plain inline text slice', () => {
    const d = doc();
    const slice = d.slice(2, 8); // inside the intro paragraph
    expect(() => checkedSliceFromJSON(slice.toJSON())).not.toThrow();
  });
});
