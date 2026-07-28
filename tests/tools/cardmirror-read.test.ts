/**
 * cardmirror-read library — rendering + round-trip.
 *
 * The CLI's value is fidelity to the app's own formats, so the tests
 * drive the lib with docs built from the real schema and bytes from
 * the real serializer.
 */
import { describe, it, expect } from 'vitest';
import { schema, newHeadingId } from '../../src/schema/index.js';
import { serializeNative } from '../../src/native/index.js';
import {
  renderPlainText,
  toUncompressedJson,
  parseToDoc,
} from '../../src/tools/cardmirror-read-lib.js';

const n = schema.nodes;
const m = schema.marks;

function demoDoc() {
  return n['doc']!.createChecked(null, [
    n['pocket']!.create({ id: newHeadingId() }, schema.text('1AC')),
    n['block']!.create({ id: newHeadingId() }, schema.text('Governance ADV')),
    n['card']!.createChecked(null, [
      n['tag']!.create({ id: newHeadingId() }, schema.text('Space law collapses')),
      n['cite_paragraph']!.create(null, schema.text('Author 21, qualified')),
      n['card_body']!.create(null, [
        schema.text('plain '),
        schema.text('read ', [m['highlight']!.create()]),
        schema.text('aloud', [m['highlight']!.create()]),
        schema.text(' and ', [m['underline_mark']!.create()]),
        schema.text('kept', [m['underline_mark']!.create()]),
      ]),
    ]),
  ]);
}

describe('renderPlainText', () => {
  it('renders outline levels, cite lines, and merged mark runs', () => {
    const text = renderPlainText(demoDoc(), 'demo.cmir');
    expect(text).toContain('# 1AC');
    expect(text).toContain('### Governance ADV');
    expect(text).toContain('#### Space law collapses');
    expect(text).toContain('Cite: Author 21, qualified');
    // Adjacent same-mark text nodes merge into ONE wrapper pair, with
    // whitespace kept outside the markers.
    expect(text).toContain('plain ==read aloud== __and kept__');
    expect(text).not.toContain('====');
  });
});

describe('json + parse round trip', () => {
  it('uncompressed json of real serialized bytes matches the doc', async () => {
    const doc = demoDoc();
    const bytes = serializeNative(doc, { appVersion: 'test' });
    const json = await toUncompressedJson(bytes, 'cmir');
    const envelope = JSON.parse(json);
    expect(envelope.format).toBe('cardmirror-doc');
    expect(envelope.doc.type).toBe('doc');
    // And the doc parses back identically through the app's own path.
    const parsed = await parseToDoc(bytes, 'cmir');
    expect(parsed.toJSON()).toEqual(doc.toJSON());
  });
});
